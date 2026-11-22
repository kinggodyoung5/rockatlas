/**
 * Refreshes scripts/data/korean-names-wikidata.json from each band's Wikidata Korean label.
 * Bands without a Korean label go in scripts/data/korean-names-manual.json by hand.
 *   npm run collect:korean-names
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('.')
const catalog = JSON.parse(await readFile(resolve(root, 'src/data/catalog.json'), 'utf8')) as { bands: { id: string; sources: { publisher: string; externalId?: string }[] }[] }
const pairs = catalog.bands
  .map((band) => [band.id, band.sources.find((source) => source.publisher === 'Wikidata')?.externalId] as const)
  .filter((pair): pair is readonly [string, string] => Boolean(pair[1]))

const result: Record<string, string> = { _note: `Wikidata 한국어 라벨(${new Date().toISOString().slice(0, 10)} 수집). 검색 별칭으로만 쓴다. 다시 수집하려면 npm run collect:korean-names` }
const missing: string[] = []
for (let index = 0; index < pairs.length; index += 50) {
  const chunk = pairs.slice(index, index + 50)
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=ko&ids=${chunk.map(([, qid]) => qid).join('|')}`
  const response = await fetch(url, { headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor)' } })
  const data = await response.json() as { entities: Record<string, { labels?: { ko?: { value: string } } }> }
  for (const [bandId, qid] of chunk) {
    const label = data.entities[qid]?.labels?.ko?.value
    if (label) result[bandId] = label
    else missing.push(bandId)
  }
  await new Promise((done) => setTimeout(done, 800))
}
await writeFile(resolve(root, 'scripts/data/korean-names-wikidata.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(`한국어 라벨 ${Object.keys(result).length - 1}개 저장 · 라벨 없음 ${missing.length}개`)
if (missing.length) console.log(`수동 사전 확인: ${missing.join(', ')}`)
