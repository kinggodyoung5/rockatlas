import { readFile } from 'node:fs/promises'
import { HITCHHIKING_DIRECTIONS } from '../src/config/hitchhiking.ts'

interface MoodDefinition { id: string; name: string }
interface TaxonomyFile { moods: MoodDefinition[] }
interface CatalogBand {
  id: string
  name: string
  taxonomyV2?: { primaryGenreId: string; moodScores: Record<string, number> }
}
interface CatalogFile { bands: CatalogBand[] }

const taxonomy = JSON.parse(await readFile(new URL('../src/data/taxonomy.v2.json', import.meta.url), 'utf8')) as TaxonomyFile
const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as CatalogFile
const minimumMoodCount = 3
const strongScore = 3
const minimumAxisCandidates = Math.max(6, Math.ceil(catalog.bands.length * 0.05))

const rows = catalog.bands.map((band) => {
  const scores = band.taxonomyV2?.moodScores ?? {}
  return { ...band, scores, moodCount: Object.keys(scores).length, strongCount: Object.values(scores).filter((score) => score >= strongScore).length }
})
const errors: string[] = []
const sparseBands = rows.filter((band) => band.moodCount < minimumMoodCount)
const noStrongMood = rows.filter((band) => band.strongCount === 0)
if (sparseBands.length) errors.push(`분위기 ${minimumMoodCount}개 미만 밴드 ${sparseBands.length}개: ${sparseBands.map((band) => band.name).join(', ')}`)
if (noStrongMood.length) errors.push(`3점 이상 핵심 분위기가 없는 밴드 ${noStrongMood.length}개: ${noStrongMood.map((band) => band.name).join(', ')}`)

const moodCoverage = taxonomy.moods.map((mood) => {
  const values = rows.map((band) => band.scores[mood.id]).filter((score): score is number => typeof score === 'number' && score > 0)
  return {
    ...mood,
    any: values.length,
    strong: values.filter((score) => score >= strongScore).length,
    average: values.length ? values.reduce((sum, score) => sum + score, 0) / values.length : 0,
  }
})
const unusedMoods = moodCoverage.filter((mood) => mood.any === 0)
if (unusedMoods.length) errors.push(`아무 밴드에도 쓰이지 않는 분위기: ${unusedMoods.map((mood) => mood.name).join(', ')}`)

const axisCoverage = HITCHHIKING_DIRECTIONS.map((axis) => {
  const candidates = rows.filter((band) => axis.entryRules.some((rule) => {
    const all = Object.entries(rule.all).every(([id, threshold]) => (band.scores[id] ?? 0) >= threshold)
    const any = !rule.any || Object.entries(rule.any).some(([id, threshold]) => (band.scores[id] ?? 0) >= threshold)
    return all && any
  }))
  if (candidates.length < minimumAxisCandidates) errors.push(`${axis.label} 후보가 ${candidates.length}개뿐입니다. 최소 ${minimumAxisCandidates}개가 필요합니다.`)
  return { ...axis, candidates }
})

const distribution = new Map<number, number>()
rows.forEach((band) => distribution.set(band.moodCount, (distribution.get(band.moodCount) ?? 0) + 1))
const averageMoodCount = rows.reduce((sum, band) => sum + band.moodCount, 0) / rows.length

console.log('ROCK ATLAS 분위기 커버리지 진단')
console.log(`밴드 ${rows.length} · 분위기 ${taxonomy.moods.length}/${taxonomy.moods.length} 사용 · 밴드당 평균 ${averageMoodCount.toFixed(2)}개`)
console.log(`분포 ${[...distribution.entries()].sort(([a], [b]) => a - b).map(([count, bands]) => `${count}개=${bands}밴드`).join(' · ')}`)
console.log(`최소 기준 미달 ${sparseBands.length} · 핵심 점수 없음 ${noStrongMood.length}`)

console.log('\n히치하이킹 방향 후보')
axisCoverage.forEach((axis) => console.log(`- ${axis.label}: ${axis.candidates.length}개`))

console.log('\n분위기별 3점 이상 밴드')
moodCoverage.forEach((mood) => console.log(`- ${mood.name} (${mood.id}): ${mood.strong}개 · 사용 평균 ${mood.average.toFixed(2)}`))

const nicheMoods = moodCoverage.filter((mood) => mood.strong < 5)
if (nicheMoods.length) console.log(`\n참고: 3점 이상 밴드가 5개 미만인 희소 분위기 · ${nicheMoods.map((mood) => `${mood.name} ${mood.strong}개`).join(' · ')}`)

if (errors.length) {
  console.error('\n보완 필요')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  console.log('\n히치하이킹 2.0 방향 탐색에 필요한 분위기 커버리지 충족')
}
