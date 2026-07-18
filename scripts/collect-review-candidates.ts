import { bands } from '../src/data/bands.ts'

interface WikidataCandidate {
  id: string
  label: string
  description?: string
  url: string
}

interface MusicBrainzArtist {
  id: string
  name: string
  type?: string
  country?: string
  score?: number
  'begin-area'?: { name?: string }
  'life-span'?: { begin?: string; end?: string; ended?: boolean }
}

const args = process.argv.slice(2)
const selectedBandId = args.find((arg) => arg.startsWith('--band='))?.split('=')[1]
const asJson = args.includes('--json')
const selectedBands = selectedBandId ? bands.filter((band) => band.id === selectedBandId) : bands

if (selectedBands.length === 0) {
  console.error(`밴드를 찾을 수 없습니다: ${selectedBandId}`)
  process.exit(1)
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function fetchJson<T>(url: URL, headers?: HeadersInit, attempt = 0): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RockAtlasDataReview/0.2 (local metadata review tool)',
      ...headers,
    },
  })
  if (response.ok) return response.json() as Promise<T>

  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get('retry-after'))
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1500 * 2 ** attempt
    console.error(`${url.hostname} ${response.status}: ${wait}ms 뒤 재시도합니다.`)
    await sleep(wait)
    return fetchJson<T>(url, headers, attempt + 1)
  }

  throw new Error(`${response.status} ${response.statusText}: ${url.hostname}`)
}

async function findWikidata(name: string): Promise<WikidataCandidate[]> {
  const url = new URL('https://www.wikidata.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'wbsearchentities',
    search: name,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '3',
    format: 'json',
    origin: '*',
  }).toString()
  const data = await fetchJson<{ search?: Array<{ id: string; label: string; description?: string; concepturi: string }> }>(url)
  return (data.search ?? []).map((item) => ({ id: item.id, label: item.label, description: item.description, url: item.concepturi }))
}

const normalizeTitle = (value: string) => value.replaceAll('_', ' ').trim().toLocaleLowerCase()

async function resolveWikidataFromWikipedia() {
  const result = new Map<string, WikidataCandidate[]>()
  const chunks = Array.from({ length: Math.ceil(selectedBands.length / 20) }, (_, index) => selectedBands.slice(index * 20, index * 20 + 20))

  for (const chunk of chunks) {
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      redirects: '1',
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      titles: chunk.map((band) => band.image.wikipediaTitle).join('|'),
    }).toString()
    const data = await fetchJson<{
      query?: {
        pages?: Record<string, { title: string; pageprops?: { wikibase_item?: string } }>
        redirects?: Array<{ from: string; to: string }>
      }
    }>(url)
    const redirects = new Map((data.query?.redirects ?? []).map((item) => [normalizeTitle(item.from), normalizeTitle(item.to)]))
    const pages = Object.values(data.query?.pages ?? {})

    for (const band of chunk) {
      const requested = normalizeTitle(band.image.wikipediaTitle)
      const resolved = redirects.get(requested) ?? requested
      const page = pages.find((item) => normalizeTitle(item.title) === resolved)
      const id = page?.pageprops?.wikibase_item
      if (id) {
        result.set(band.id, [{ id, label: page?.title ?? band.name, description: 'Wikipedia 문서에 연결된 Wikidata 항목', url: `https://www.wikidata.org/wiki/${id}` }])
      }
    }
  }

  return result
}

async function findMusicBrainz(name: string): Promise<MusicBrainzArtist[]> {
  const url = new URL('https://musicbrainz.org/ws/2/artist/')
  url.search = new URLSearchParams({ query: `artist:"${name.replaceAll('"', '\\"')}" AND type:group`, limit: '3', fmt: 'json' }).toString()
  const data = await fetchJson<{ artists?: MusicBrainzArtist[] }>(url, {
    Accept: 'application/json',
    'User-Agent': 'RockAtlasDataReview/0.1 (local metadata review tool)',
  })
  return data.artists ?? []
}

const wikidataByBandId = await resolveWikidataFromWikipedia()
const results = []
for (const [index, band] of selectedBands.entries()) {
  const wikidata = wikidataByBandId.get(band.id) ?? await findWikidata(band.name)
  const musicbrainz = await findMusicBrainz(band.name)
  results.push({
    bandId: band.id,
    expected: { name: band.name, formed: band.formed, countryCode: band.countryCode },
    wikidata,
    musicbrainz: musicbrainz.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      country: item.country,
      beginArea: item['begin-area']?.name,
      begin: item['life-span']?.begin,
      end: item['life-span']?.end,
      ended: item['life-span']?.ended,
      score: item.score,
    })),
  })
  if (index < selectedBands.length - 1) await sleep(1150)
}

if (asJson) {
  console.log(JSON.stringify({ collectedAt: new Date().toISOString(), results }, null, 2))
} else {
  console.log('ROCK ATLAS 외부 식별자 후보')
  for (const result of results) {
    const wd = result.wikidata.map((item) => `${item.id} ${item.label}${item.description ? ` (${item.description})` : ''}`).join(' | ')
    const mb = result.musicbrainz.map((item) => `${item.id} ${item.name} · ${item.country ?? '?'} · ${item.begin ?? '?'}`).join(' | ')
    console.log(`\n${result.expected.name} (${result.expected.formed}, ${result.expected.countryCode})`)
    console.log(`  Wikidata: ${wd || '후보 없음'}`)
    console.log(`  MusicBrainz: ${mb || '후보 없음'}`)
  }
  console.log('\n후보는 자동 승인되지 않습니다. 이름·결성 연도·국가를 확인한 뒤 데이터 소스의 externalId에 반영하세요.')
}
