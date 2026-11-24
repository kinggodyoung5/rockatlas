import { publicBands } from '../data/publicBands'
import { taxonomyGenreById, taxonomyMoodById, taxonomySubgenreById } from '../data/taxonomy'
import type { Band } from '../types/music'
import type { MoodId, SubgenreId } from '../types/taxonomy'

export interface BandSimilarity {
  band: Band
  /** 대략 0~30. 흔한 무드·세부장르는 적게, 드문 것은 크게 센다(idf). */
  score: number
  /** 둘 다 3점 이상인 무드, 드문 순. */
  sharedMoods: MoodId[]
  /** 함께 가진 세부장르, 드문 순. */
  sharedSubgenres: SubgenreId[]
  /** 화면용 이유 문장. `hitchhiking.ts`가 `reasons[0]`을 연속성 이유로 쓴다. */
  reasons: string[]
}

interface IdfTables {
  mood: Map<string, number>
  subgenre: Map<string, number>
}

const strongMood = 3
const idfCache = new WeakMap<readonly Band[], IdfTables>()

/** idf(x) = ln(밴드 수 / x를 가진 밴드 수). 무드는 3점 이상만 "가진" 것으로 센다.
 *  밴드 목록 배열이 바뀔 때만 다시 계산한다. */
function idfTables(population: readonly Band[]): IdfTables {
  const cached = idfCache.get(population)
  if (cached) return cached
  const moodCounts = new Map<string, number>()
  const subgenreCounts = new Map<string, number>()
  let total = 0
  for (const band of population) {
    const taxonomy = band.taxonomyV2
    if (!taxonomy) continue
    total += 1
    for (const [moodId, value] of Object.entries(taxonomy.moodScores)) if ((value ?? 0) >= strongMood) moodCounts.set(moodId, (moodCounts.get(moodId) ?? 0) + 1)
    for (const subgenreId of new Set(taxonomy.subgenreIds)) subgenreCounts.set(subgenreId, (subgenreCounts.get(subgenreId) ?? 0) + 1)
  }
  const toIdf = (counts: Map<string, number>) => new Map([...counts].map(([id, count]) => [id, Math.log(Math.max(total, 1) / count)]))
  const tables = { mood: toIdf(moodCounts), subgenre: toIdf(subgenreCounts) }
  idfCache.set(population, tables)
  return tables
}

/**
 * 유사도 v2 (plan P3-2).
 *   Σ[둘 다 3점 이상인 무드] idf × (min − 2) × 0.9
 * + Σ[공유 세부장르] idf × 1.4
 * + 같은 대표 장르 1.5 / 대표·보조 교차 0.8
 * + 결성 연도 12년 이내면 1 − 차/12
 * 세부장르가 하나도 겹치지 않으면 0점(후보에서 제외). 같은 국가 가산점은 없다 — 음악적 근거가 아니다.
 * 관계(사실)는 점수에 넣지 않는다. 유사도는 소리의 닮음만 잰다(plan 3.4).
 */
export function scoreBandSimilarity(subject: Band, candidate: Band, population: readonly Band[] = publicBands): BandSimilarity {
  const left = subject.taxonomyV2
  const right = candidate.taxonomyV2
  const empty: BandSimilarity = { band: candidate, score: 0, sharedMoods: [], sharedSubgenres: [], reasons: [] }
  if (!left || !right || subject.id === candidate.id) return empty
  const idf = idfTables(population)
  const rightSubgenres = new Set(right.subgenreIds)
  const sharedSubgenres = [...new Set(left.subgenreIds)].filter((id) => rightSubgenres.has(id))
    .sort((a, b) => (idf.subgenre.get(b) ?? 0) - (idf.subgenre.get(a) ?? 0) || a.localeCompare(b))
  if (!sharedSubgenres.length) return empty

  const sharedMoods = (Object.keys(left.moodScores) as MoodId[])
    .filter((id) => (left.moodScores[id] ?? 0) >= strongMood && (right.moodScores[id] ?? 0) >= strongMood)
  const moodWeight = (id: MoodId) => (idf.mood.get(id) ?? 0) * (Math.min(left.moodScores[id] ?? 0, right.moodScores[id] ?? 0) - 2)
  sharedMoods.sort((a, b) => moodWeight(b) - moodWeight(a) || a.localeCompare(b))

  let score = sharedMoods.reduce((sum, id) => sum + moodWeight(id) * 0.9, 0)
  score += sharedSubgenres.reduce((sum, id) => sum + (idf.subgenre.get(id) ?? 0) * 1.4, 0)
  const samePrimary = left.primaryGenreId === right.primaryGenreId
  const crossing = left.secondaryGenreIds.includes(right.primaryGenreId) || right.secondaryGenreIds.includes(left.primaryGenreId)
  score += samePrimary ? 1.5 : crossing ? 0.8 : 0
  const yearGap = Math.abs(subject.formed - candidate.formed)
  if (Number.isFinite(yearGap) && yearGap <= 12) score += 1 - yearGap / 12

  const reasons = [
    sharedSubgenres.slice(0, 2).map((id) => taxonomySubgenreById[id]?.name ?? id).join(' · '),
    sharedMoods.length ? sharedMoods.slice(0, 2).map((id) => taxonomyMoodById[id]?.name ?? id).join(' · ') : '',
    samePrimary ? `같은 ${taxonomyGenreById[left.primaryGenreId]?.displayName ?? left.primaryGenreId}` : crossing ? '대표·보조 장르 교차' : '',
  ].filter(Boolean)
  return { band: candidate, score: Math.round(score * 10) / 10, sharedMoods, sharedSubgenres, reasons }
}

export function similarBands(subject: Band, candidates: readonly Band[]) {
  return candidates
    .filter((candidate) => candidate.id !== subject.id)
    .map((candidate) => scoreBandSimilarity(subject, candidate, candidates))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.band.name.localeCompare(b.band.name, 'en'))
}

/** 서로의 상위 k에 들어 있는 쌍만 "서로 가까운 밴드"로 인정한다. 한쪽만 가까운 경우(흔한 태그를 많이
 *  가진 밴드가 모두와 가까워 보이는 경우)를 걸러 낸다. Studio 후보와 P7 은하 지도에서 쓴다. */
export function mutualNeighbors(bands: readonly Band[], k = 5) {
  const top = new Map(bands.map((band) => [band.id, new Set(similarBands(band, bands).slice(0, k).map((item) => item.band.id))]))
  const pairs: Array<{ bandIds: [string, string]; score: number }> = []
  for (const band of bands) {
    for (const otherId of top.get(band.id) ?? []) {
      if (band.id >= otherId || !top.get(otherId)?.has(band.id)) continue
      const other = bands.find((item) => item.id === otherId)!
      pairs.push({ bandIds: [band.id, otherId], score: scoreBandSimilarity(band, other, bands).score })
    }
  }
  return pairs.sort((a, b) => b.score - a.score || a.bandIds.join().localeCompare(b.bandIds.join()))
}
