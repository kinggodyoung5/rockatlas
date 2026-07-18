import { bands } from '../src/data/bands.ts'
import type { RelationKind } from '../src/types/music.ts'

const compatibleReverseKinds: Record<RelationKind, RelationKind[]> = {
  'shared-scene': ['shared-scene'],
  'sounds-like': ['sounds-like'],
  influenced: ['influenced-by'],
  'influenced-by': ['influenced'],
  evolution: ['evolution'],
}

const bandById = new Map(bands.map((band) => [band.id, band]))
const missing: string[] = []
const mismatched: string[] = []
const sourced: string[] = []
const unsourced: string[] = []
const pairs = new Map<string, string[]>()

for (const band of bands) {
  for (const relation of band.relations) {
    const target = bandById.get(relation.targetBandId)
    if (!target) continue
    const reverse = target.relations.find((candidate) => candidate.targetBandId === band.id)
    const label = `${band.name} → ${target.name} (${relation.kind})`
    const pairKey = [band.id, target.id].sort().join('::')
    const pairRelations = pairs.get(pairKey) ?? []
    pairRelations.push(label)
    pairs.set(pairKey, pairRelations)
    if (!reverse) missing.push(label)
    else if (!compatibleReverseKinds[relation.kind].includes(reverse.kind)) {
      mismatched.push(`${label} ↔ ${reverse.kind}`)
    }
    if (relation.source) sourced.push(label)
    else unsourced.push(label)
  }
}

console.log('ROCK ATLAS 관계 감사')
console.log(`관계 ${bands.flatMap((band) => band.relations).length} · 출처 연결 ${sourced.length}`)
console.log(`역방향 누락 ${missing.length} · 종류 불일치 ${mismatched.length}`)
console.log(`고유 밴드 쌍 ${pairs.size}`)

if (process.argv.includes('--pairs')) {
  console.log('\n고유 밴드 쌍')
  for (const relations of pairs.values()) console.log(`- ${relations.join(' ↔ ')}`)
}

if (missing.length > 0) {
  console.log('\n역방향 누락')
  for (const item of missing) console.log(`- ${item}`)
}
if (mismatched.length > 0) {
  console.log('\n종류 불일치')
  for (const item of mismatched) console.log(`- ${item}`)
}

if (unsourced.length > 0) {
  console.log('\n출처 미검수')
  for (const item of unsourced) console.log(`- ${item}`)
}

if (process.argv.includes('--strict') && (mismatched.length > 0 || (process.argv.includes('--require-reciprocal') && missing.length > 0))) {
  process.exitCode = 1
}
