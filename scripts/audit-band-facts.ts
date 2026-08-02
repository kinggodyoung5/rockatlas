import { bands } from '../src/data/bands.ts'

interface MusicBrainzArtist {
  name: string
  country?: string
  'begin-area'?: { name?: string }
  'life-span'?: { begin?: string; end?: string; ended?: boolean }
  relations?: Array<{
    type?: string
    direction?: string
    begin?: string | null
    end?: string | null
    artist?: { name?: string }
  }>
}

interface WikidataEntity {
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>
}

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const selectedBandId = args.find((arg) => arg.startsWith('--band='))?.split('=')[1]
const fromBandId = args.find((arg) => arg.startsWith('--from='))?.split('=')[1]
const fromIndex = fromBandId ? bands.findIndex((band) => band.id === fromBandId) : 0
const toBandId = args.find((arg) => arg.startsWith('--to='))?.split('=')[1]
const toIndex = toBandId ? bands.findIndex((band) => band.id === toBandId) : bands.length - 1
const selectedBands = selectedBandId ? bands.filter((band) => band.id === selectedBandId) : fromIndex >= 0 && toIndex >= fromIndex ? bands.slice(fromIndex, toIndex + 1) : bands
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

if (selectedBands.length === 0) {
  console.error(`밴드를 찾을 수 없습니다: ${selectedBandId}`)
  process.exit(1)
}

async function fetchJson<T>(url: URL, attempt = 0): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'RockAtlasFactAudit/0.1 (local editorial review tool)' } })
  if (response.ok) return response.json() as Promise<T>
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get('retry-after'))
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1_500 * (2 ** attempt))
    return fetchJson<T>(url, attempt + 1)
  }
  throw new Error(`${response.status} ${response.statusText}: ${url.hostname}`)
}

const wikidataIds = selectedBands.map((band) => band.sources.find((source) => source.publisher === 'Wikidata')?.externalId).filter(Boolean) as string[]
const wikidata: { entities: Record<string, WikidataEntity> } = { entities: {} }
for (let offset = 0; offset < wikidataIds.length; offset += 50) {
  const wikidataUrl = new URL('https://www.wikidata.org/w/api.php')
  wikidataUrl.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: wikidataIds.slice(offset, offset + 50).join('|'),
    props: 'claims',
    format: 'json',
    origin: '*',
  }).toString()
  const batch = await fetchJson<{ entities?: Record<string, WikidataEntity> }>(wikidataUrl)
  Object.assign(wikidata.entities, batch.entities ?? {})
}

const countryByWikidataId: Record<string, string> = {
  Q30: 'US',
  Q27: 'IE',
  Q33: 'FI',
  Q145: 'GB',
  Q183: 'DE',
  Q408: 'AU',
}

function claimValue(entity: WikidataEntity | undefined, property: string) {
  return entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value
}

function wikidataYear(entity: WikidataEntity | undefined) {
  const value = claimValue(entity, 'P571') as { time?: string } | undefined
  const match = value?.time?.match(/[+-](\d{4})-/)
  return match ? Number(match[1]) : undefined
}

function wikidataCountry(entity: WikidataEntity | undefined) {
  const value = claimValue(entity, 'P495') as { id?: string } | undefined
  return value?.id ? countryByWikidataId[value.id] : undefined
}

const normalizeName = (value: string) => value.normalize('NFKD').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase()
const musicBrainzMemberAliases: Record<string, string> = {
  'Johnny Rotten': 'John Lydon',
  'David Lovering': 'Dave Lovering',
  'Henkka Seppälä': 'Henkka Blacksmith',
  'Janne Wirman': 'Janne Warman',
  'Richard Kruspe': 'Richard Z. Kruspe',
  'Flake Lorenz': 'Christian Lorenz',
  'Frank Carter': 'Sex Pistols feat. Frank Carter',
}
const discrepancies: string[] = []
const sourceDifferences: string[] = []
let matchedMembers = 0
let checkedMembers = 0

console.log('ROCK ATLAS 밴드 사실 교차 감사')

for (const [index, band] of selectedBands.entries()) {
  const wikidataId = band.sources.find((source) => source.publisher === 'Wikidata')?.externalId
  const musicBrainzId = band.sources.find((source) => source.publisher === 'MusicBrainz')?.externalId
  if (!wikidataId || !musicBrainzId) {
    discrepancies.push(`${band.name}: 외부 식별자 누락`)
    continue
  }

  const entity = wikidata.entities[wikidataId]
  const mbUrl = new URL(`https://musicbrainz.org/ws/2/artist/${musicBrainzId}`)
  mbUrl.search = new URLSearchParams({ inc: 'artist-rels', fmt: 'json' }).toString()
  let mb: MusicBrainzArtist
  try {
    mb = await fetchJson<MusicBrainzArtist>(mbUrl)
  } catch (error) {
    discrepancies.push(`${band.name}: MusicBrainz ID 조회 실패 (${error instanceof Error ? error.message : '알 수 없는 오류'})`)
    console.log(`- ${band.name}: MusicBrainz 조회 실패`)
    if (index < selectedBands.length - 1) await sleep(1_100)
    continue
  }
  const mbYear = Number(mb['life-span']?.begin?.slice(0, 4)) || undefined
  const wdYear = wikidataYear(entity)
  const wdCountry = wikidataCountry(entity)
  const localEnd = band.activeYears.match(/(\d{4})$/)?.[1]
  const mbEnd = mb['life-span']?.end?.slice(0, 4)

  if (normalizeName(mb.name) !== normalizeName(band.name)) discrepancies.push(`${band.name}: MusicBrainz 표기 “${mb.name}”`)
  if (mb.country && mb.country !== band.countryCode) discrepancies.push(`${band.name}: 국가 ${band.countryCode} ↔ MusicBrainz ${mb.country}`)
  if (wdCountry && wdCountry !== band.countryCode) discrepancies.push(`${band.name}: 국가 ${band.countryCode} ↔ Wikidata ${wdCountry}`)
  if (localEnd && mbEnd && localEnd !== mbEnd) sourceDifferences.push(`${band.name}: 종료 연도 ${localEnd} ↔ MusicBrainz ${mbEnd}`)
  if (mbYear && mbYear !== band.formed) sourceDifferences.push(`${band.name}: 결성 ${band.formed} ↔ MusicBrainz ${mbYear}`)
  if (wdYear && wdYear !== band.formed) sourceDifferences.push(`${band.name}: 결성 ${band.formed} ↔ Wikidata ${wdYear}`)

  const memberNames = new Set((mb.relations ?? [])
    .filter((relation) => relation.type === 'member of band' && relation.direction === 'backward' && relation.artist?.name)
    .map((relation) => normalizeName(relation.artist!.name!)))
  const missingMembers = band.members.filter((member) => {
    const musicBrainzName = musicBrainzMemberAliases[member.name] ?? member.name
    return !memberNames.has(normalizeName(musicBrainzName))
  })
  checkedMembers += band.members.length
  matchedMembers += band.members.length - missingMembers.length
  if (missingMembers.length > 0) discrepancies.push(`${band.name}: MusicBrainz 멤버 관계에서 미확인 — ${missingMembers.map((member) => member.name).join(', ')}`)

  console.log(`- ${band.name}: ${band.formed} · ${band.countryCode} · ${mb['begin-area']?.name ?? '?'} · 멤버 ${band.members.length - missingMembers.length}/${band.members.length}`)
  if (index < selectedBands.length - 1) await sleep(1_100)
}

console.log(`\n밴드 ${selectedBands.length} · 선택 멤버 교차확인 ${matchedMembers}/${checkedMembers}`)
if (sourceDifferences.length > 0) {
  console.log('\n출처 간 결성 시점 차이')
  for (const item of sourceDifferences) console.log(`- ${item}`)
}
if (discrepancies.length > 0) {
  console.log('\n수동 확인 필요')
  for (const item of discrepancies) console.log(`- ${item}`)
}

if (strict && discrepancies.length > 0) process.exitCode = 1
