/**
 * 2026-11-24 `audit:mood-evidence` 판정 중 "확실" 항목 반영 (docs/CONTENT_BACKLOG.md 6번).
 * 0~1점이던 무드만 올린다. 이미 그 점수 이상이면 건드리지 않는다.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const fixes: Array<[string, string, number]> = [
  ['queen', 'riff-solo-driven', 4], ['rage-against-the-machine', 'riff-solo-driven', 5], ['children-of-bodom', 'riff-solo-driven', 5],
  ['bullet-for-my-valentine', 'riff-solo-driven', 5], ['wintersun', 'riff-solo-driven', 4], ['sepultura', 'riff-solo-driven', 4],
  ['skid-row', 'riff-solo-driven', 4], ['toto', 'riff-solo-driven', 4], ['the-smashing-pumpkins', 'riff-solo-driven', 4],
  ['manowar', 'riff-solo-driven', 3], ['sabaton', 'riff-solo-driven', 3],
  ['linkin-park', 'electronic-synth', 4], ['muse', 'electronic-synth', 4], ['beck', 'electronic-synth', 4],
  ['bad-omens', 'electronic-synth', 4], ['neon-trees', 'electronic-synth', 3], ['spiritbox', 'electronic-synth', 3],
  ['maroon-5', 'groovy-danceable', 4], ['rage-against-the-machine', 'groovy-danceable', 4], ['blur', 'groovy-danceable', 3],
  ['sum-41', 'youth-rebellious', 4], ['misfits', 'youth-rebellious', 4],
  ['opeth', 'aggressive-heavy', 3], ['opeth', 'massive-heavy', 3], ['sleep-token', 'massive-heavy', 4], ['killswitch-engage', 'massive-heavy', 4],
  ['royal-blood', 'anthemic-live', 4], ['korpiklaani', 'acoustic-organic', 4],
]
const path = resolve('src/data/catalog.json')
const catalog = JSON.parse(await readFile(path, 'utf8'))
const byId = new Map(catalog.bands.map((band: any) => [band.id, band]))
let applied = 0
for (const [id, mood, score] of fixes) {
  const band: any = byId.get(id)
  if (!band?.taxonomyV2) throw new Error(`밴드 없음: ${id}`)
  if ((band.taxonomyV2.moodScores[mood] ?? 0) >= score) continue
  band.taxonomyV2.moodScores[mood] = score
  applied += 1
}
catalog.updatedAt = new Date().toISOString()
await writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`무드 점수 ${applied}/${fixes.length}건 반영`)
