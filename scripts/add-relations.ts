/**
 * Adds researched relations from a batch file, both directions, skipping pairs that already have one.
 *   node --experimental-strip-types scripts/add-relations.ts scripts/data/relation-batches/<file>.json
 *
 * Batch file: { "note": "...", "pairs": [{ from, to, kind, strength, fromNote, toNote, source: { label, url, publisher } }] }
 * `kind` is from `from`'s side ('influenced' = from influenced to). Every pair must carry a source URL —
 * that is the point of keeping batches as files: each relation can be traced back to why it exists.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Json = Record<string, any>
const batchPath = process.argv[2]
if (!batchPath) throw new Error('배치 파일 경로가 필요합니다.')
const catalogPath = resolve('src/data/catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Json
const batch = JSON.parse(await readFile(resolve(batchPath), 'utf8')) as { pairs: Json[] }
const byId = new Map<string, Json>(catalog.bands.map((band: Json) => [band.id, band]))
const now = new Date().toISOString()
const inverse: Record<string, string> = { 'influenced-by': 'influenced', influenced: 'influenced-by' }
const kinds = new Set(['sounds-like', 'influenced-by', 'influenced', 'shared-scene'])

let added = 0
const skipped: string[] = []
for (const pair of batch.pairs) {
  const from = byId.get(pair.from)
  const to = byId.get(pair.to)
  if (!from || !to) throw new Error(`밴드 없음: ${pair.from} / ${pair.to}`)
  if (!kinds.has(pair.kind)) throw new Error(`${pair.from}→${pair.to}: 관계 종류 ${pair.kind}는 이 스크립트로 넣지 않음 (멤버 연결은 Studio 패널 사용)`)
  if (!pair.source?.url?.startsWith('https://')) throw new Error(`${pair.from}→${pair.to}: 출처 URL 없음`)
  if (!pair.fromNote?.trim() || !pair.toNote?.trim()) throw new Error(`${pair.from}→${pair.to}: 설명 누락`)
  const source = { ...pair.source, accessedAt: now.slice(0, 10) }
  for (const [band, target, kind, note] of [[from, to, pair.kind, pair.fromNote], [to, from, inverse[pair.kind] ?? pair.kind, pair.toNote]] as const) {
    if (band.relations.some((relation: Json) => relation.targetBandId === target.id)) { skipped.push(`${band.id}→${target.id}`); continue }
    band.relations.push({ targetBandId: target.id, kind, strength: pair.strength ?? 2, note, source, reviewStatus: 'reviewed', reviewedBy: 'ROCK ATLAS editorial (AI 보조)', reviewedAt: now })
    added += 1
  }
}
catalog.updatedAt = now
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`관계 ${added}건 추가 (${batch.pairs.length}쌍)${skipped.length ? ` · 이미 있어 건너뜀: ${skipped.join(', ')}` : ''}`)
