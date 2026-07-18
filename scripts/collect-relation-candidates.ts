import { bands } from '../src/data/bands.ts'

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
const bandById = new Map(bands.map((band) => [band.id, band]))
const extracts = new Map<string, string>()
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function wikipediaTitle(url: string) {
  const parsed = new URL(url)
  return decodeURIComponent(parsed.pathname.replace(/^\/wiki\//, ''))
}

async function fetchExtractBatch(bandIds: string[]) {
  const requested = bandIds.map((bandId) => {
    const band = bandById.get(bandId)!
    const source = band.sources.find((item) => item.publisher === 'Wikipedia')!
    return { bandId, title: wikipediaTitle(source.url) }
  })
  const api = new URL('https://en.wikipedia.org/w/api.php')
  api.search = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    redirects: '1',
    format: 'json',
    origin: '*',
    titles: requested.map((item) => item.title).join('|'),
  }).toString()
  let response: Response | undefined
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(api, { headers: { 'User-Agent': 'RockAtlasRelationReview/0.1' } })
    if (response.ok) break
    await sleep(2_000 * (2 ** attempt))
  }
  if (!response?.ok) throw new Error(`Wikipedia batch ${response?.status ?? 'network error'}`)
  const data = await response.json() as { query?: { pages?: Record<string, { title?: string; extract?: string }> } }
  const pages = Object.values(data.query?.pages ?? {})
  for (const item of requested) {
    const page = pages.find((candidate) => normalize(candidate.title ?? '') === normalize(item.title))
    extracts.set(item.bandId, page?.extract ?? '')
  }
}

function findMention(extract: string, bandName: string) {
  const aliases = [bandName]
  if (bandName.startsWith('The ')) aliases.push(bandName.slice(4))
  for (const alias of aliases) {
    const index = extract.toLocaleLowerCase().indexOf(alias.toLocaleLowerCase())
    if (index >= 0) {
      return extract.slice(Math.max(0, index - 140), Math.min(extract.length, index + alias.length + 220)).replace(/\s+/g, ' ').trim()
    }
  }
  return undefined
}

const uniquePairs = new Map<string, { leftId: string; rightId: string }>()
for (const band of bands) {
  for (const relation of band.relations) {
    const ids = [band.id, relation.targetBandId].sort()
    uniquePairs.set(ids.join('::'), { leftId: ids[0], rightId: ids[1] })
  }
}

for (let index = 0; index < bands.length; index += 10) {
  await fetchExtractBatch(bands.slice(index, index + 10).map((band) => band.id))
  await sleep(2_000)
}

const results = []
for (const { leftId, rightId } of uniquePairs.values()) {
  const left = bandById.get(leftId)!
  const right = bandById.get(rightId)!
  const leftSource = left.sources.find((item) => item.publisher === 'Wikipedia')!
  const rightSource = right.sources.find((item) => item.publisher === 'Wikipedia')!
  const leftMentionsRight = findMention(extracts.get(leftId) ?? '', right.name)
  const rightMentionsLeft = findMention(extracts.get(rightId) ?? '', left.name)
  results.push({
    pairKey: [leftId, rightId].sort().join('::'),
    left: { id: left.id, name: left.name, url: leftSource.url, mention: leftMentionsRight },
    right: { id: right.id, name: right.name, url: rightSource.url, mention: rightMentionsLeft },
    candidate: Boolean(leftMentionsRight || rightMentionsLeft),
  })
}

const asJson = process.argv.includes('--json')
if (asJson) {
  console.log(JSON.stringify({ collectedAt: new Date().toISOString(), results }, null, 2))
} else {
  const withCandidate = results.filter((result) => result.candidate)
  console.log('ROCK ATLAS 관계 근거 후보')
  console.log(`Wikipedia 본문 상호 언급 ${withCandidate.length}/${results.length}`)
  for (const result of results) {
    console.log(`\n- ${result.left.name} ↔ ${result.right.name}: ${result.candidate ? '후보 있음' : '별도 조사 필요'}`)
    if (result.left.mention) console.log(`  ${result.left.name} 문서: ${result.left.mention}`)
    if (result.right.mention) console.log(`  ${result.right.name} 문서: ${result.right.mention}`)
  }
  console.log(`\n정규화 검사: ${normalize('The Who')} · 자동 승인하지 않았습니다.`)
}
