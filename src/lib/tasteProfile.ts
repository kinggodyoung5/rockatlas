/**
 * 내 취향 프로필 (plan P3-5). 서버 없이 이 브라우저에 쌓인 행동만으로 계산한다.
 * 입력 가중치: 저장한 밴드 1.0 · 여정에 있는 밴드 0.5 · 방문만 한 밴드 0.2 (한 밴드는 가장 큰 가중치 하나만).
 */
import { taxonomyGenreById, taxonomyGenres, taxonomyMoodById, taxonomyMoods } from '../data/taxonomy'
import type { Band } from '../types/music'
import type { GenreTaxonomyId, MoodId } from '../types/taxonomy'

export interface TasteInputs {
  favoriteIds: readonly string[]
  journeyIds?: readonly string[]
  historyIds?: readonly string[]
}

export interface TasteProfile {
  inputs: Array<{ band: Band; weight: number }>
  /** 입력 밴드 무드 점수의 가중 평균(0~5). */
  moodVector: Partial<Record<MoodId, number>>
  topMoods: Array<{ moodId: MoodId; value: number }>
  genres: Array<{ genreId: GenreTaxonomyId; share: number }>
  decades: Array<{ decade: number; share: number }>
}

export const tasteWeights = { favorite: 1, journey: 0.5, history: 0.2 } as const
export const minimumTasteInputs = 3
const strongMood = 3

export function buildTasteProfile(inputs: TasteInputs, bands: readonly Band[]): TasteProfile {
  const byId = new Map(bands.map((band) => [band.id, band]))
  const weights = new Map<string, number>()
  const add = (ids: readonly string[] | undefined, weight: number) => ids?.forEach((id) => {
    if (byId.get(id)?.taxonomyV2) weights.set(id, Math.max(weights.get(id) ?? 0, weight))
  })
  add(inputs.historyIds, tasteWeights.history)
  add(inputs.journeyIds, tasteWeights.journey)
  add(inputs.favoriteIds, tasteWeights.favorite)
  const entries = [...weights].map(([id, weight]) => ({ band: byId.get(id)!, weight }))
    .sort((a, b) => b.weight - a.weight || a.band.name.localeCompare(b.band.name, 'en'))
  const total = entries.reduce((sum, item) => sum + item.weight, 0)

  const moodVector: Partial<Record<MoodId, number>> = {}
  const genreTotals = new Map<GenreTaxonomyId, number>()
  const decadeTotals = new Map<number, number>()
  for (const { band, weight } of entries) {
    for (const mood of taxonomyMoods) {
      const value = band.taxonomyV2!.moodScores[mood.id] ?? 0
      if (value) moodVector[mood.id] = (moodVector[mood.id] ?? 0) + (value * weight) / total
    }
    genreTotals.set(band.taxonomyV2!.primaryGenreId, (genreTotals.get(band.taxonomyV2!.primaryGenreId) ?? 0) + weight)
    const decade = Math.floor(band.formed / 10) * 10
    if (Number.isFinite(decade)) decadeTotals.set(decade, (decadeTotals.get(decade) ?? 0) + weight)
  }
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    inputs: entries,
    moodVector: Object.fromEntries(Object.entries(moodVector).map(([id, value]) => [id, round(value!)])),
    topMoods: (Object.entries(moodVector) as Array<[MoodId, number]>)
      .map(([moodId, value]) => ({ moodId, value: round(value) }))
      .sort((a, b) => b.value - a.value || a.moodId.localeCompare(b.moodId)),
    genres: [...genreTotals].map(([genreId, value]) => ({ genreId, share: round(value / total) }))
      .sort((a, b) => b.share - a.share || a.genreId.localeCompare(b.genreId)),
    decades: [...decadeTotals].map(([decade, value]) => ({ decade, share: round(value / total) }))
      .sort((a, b) => a.decade - b.decade),
  }
}

/** "강렬하고 공격적인 · 빠르고 질주하는 소리에 끌리는, 전통 / 파워 / 스래시 메탈 쪽 취향" */
export function tasteSentence(profile: TasteProfile) {
  const moods = profile.topMoods.slice(0, 2).map((item) => taxonomyMoodById[item.moodId]?.name ?? item.moodId)
  const genre = profile.genres[0] ? taxonomyGenreById[profile.genres[0].genreId]?.displayName : ''
  if (!moods.length) return ''
  return `${moods.join(' · ')} 소리에 끌리는${genre ? `, ${genre} 쪽` : ''} 취향`
}

function cosine(profile: TasteProfile, band: Band) {
  const scores = band.taxonomyV2?.moodScores ?? {}
  let dot = 0, left = 0, right = 0
  for (const mood of taxonomyMoods) {
    const a = profile.moodVector[mood.id] ?? 0
    const b = scores[mood.id] ?? 0
    dot += a * b; left += a * a; right += b * b
  }
  return left && right ? dot / Math.sqrt(left * right) : 0
}

export interface TasteRecommendation {
  band: Band
  similarity: number
  /** 프로필 상위 무드 중 이 밴드도 3점 이상인 것. */
  sharedMoods: MoodId[]
}

function sharedTopMoods(profile: TasteProfile, band: Band, count = 6) {
  return profile.topMoods.slice(0, count).map((item) => item.moodId).filter((id) => (band.taxonomyV2?.moodScores[id] ?? 0) >= strongMood)
}

/** 아직 안 가본 추천: 프로필과 코사인 유사도 상위, 이미 본 밴드 제외, 같은 대표 장르는 최대 perGenre팀. */
export function recommendForProfile(profile: TasteProfile, bands: readonly Band[], excludeIds: readonly string[], limit = 12, perGenre = 4): TasteRecommendation[] {
  const excluded = new Set([...excludeIds, ...profile.inputs.map((item) => item.band.id)])
  const perGenreCount = new Map<string, number>()
  const result: TasteRecommendation[] = []
  const ranked = bands.filter((band) => band.taxonomyV2 && !excluded.has(band.id))
    .map((band) => ({ band, similarity: Math.round(cosine(profile, band) * 100) / 100, sharedMoods: sharedTopMoods(profile, band) }))
    .filter((item) => item.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || a.band.name.localeCompare(b.band.name, 'en'))
  for (const item of ranked) {
    const genreId = item.band.taxonomyV2!.primaryGenreId
    if ((perGenreCount.get(genreId) ?? 0) >= perGenre) continue
    perGenreCount.set(genreId, (perGenreCount.get(genreId) ?? 0) + 1)
    result.push(item)
    if (result.length >= limit) break
  }
  return result
}

/** 취향 밖으로 한 걸음: 프로필에 없는 장르 중에서 상위 무드를 1개 이상 공유하는 밴드, 장르마다 한 팀.
 *  `alsoAvoid`로 넘긴 밴드(보통 "아직 안 가본 추천")의 장르도 피해서, 정말 바깥쪽을 보여 준다. */
export function stepOutside(profile: TasteProfile, bands: readonly Band[], excludeIds: readonly string[], limit = 3, alsoAvoid: readonly Band[] = []): TasteRecommendation[] {
  const excluded = new Set([...excludeIds, ...profile.inputs.map((item) => item.band.id), ...alsoAvoid.map((band) => band.id)])
  const ownGenres = new Set<string>([...profile.genres.map((item) => item.genreId), ...alsoAvoid.flatMap((band) => band.taxonomyV2 ? [band.taxonomyV2.primaryGenreId] : [])])
  const usedGenres = new Set<string>()
  const result: TasteRecommendation[] = []
  const ranked = bands.filter((band) => band.taxonomyV2 && !excluded.has(band.id) && !ownGenres.has(band.taxonomyV2.primaryGenreId))
    .map((band) => ({ band, similarity: Math.round(cosine(profile, band) * 100) / 100, sharedMoods: sharedTopMoods(profile, band) }))
    .filter((item) => item.sharedMoods.length >= 1)
    .sort((a, b) => b.sharedMoods.length - a.sharedMoods.length || b.similarity - a.similarity || a.band.name.localeCompare(b.band.name, 'en'))
  for (const item of ranked) {
    const genreId = item.band.taxonomyV2!.primaryGenreId
    if (usedGenres.has(genreId)) continue
    usedGenres.add(genreId)
    result.push(item)
    if (result.length >= limit) break
  }
  return result
}

/** 시작 화면 "3팀 고르기" 후보(plan P3-6). 장르별 `featuredBandIds`를 먼저 쓰고, 비어 있으면
 *  관계가 많은(=다른 밴드와 많이 이어진) 공개 밴드로 채운다. 장르마다 perGenre팀. */
export function starterBands(bands: readonly Band[], perGenre = 2, limit = 24) {
  const byId = new Map(bands.map((band) => [band.id, band]))
  const columns = taxonomyGenres.map((genre) => {
    const featured = genre.featuredBandIds.map((id) => byId.get(id)).filter((band): band is Band => Boolean(band))
    const fallback = bands.filter((band) => band.taxonomyV2?.primaryGenreId === genre.id && !featured.includes(band))
      .sort((a, b) => b.relations.length - a.relations.length || a.name.localeCompare(b.name, 'en'))
    return [...featured, ...fallback].slice(0, perGenre)
  })
  // 장르를 한 바퀴씩 돌며 채운다 — 상한에 걸려도 모든 장르가 최소 한 팀은 나오게.
  const result: Band[] = []
  for (let round = 0; round < perGenre; round += 1) for (const column of columns) if (column[round]) result.push(column[round])
  return result.slice(0, limit)
}

/** 공유 주소: 저장한 밴드 id만 담는다(`?view=profile&p=a.b.c`). 받는 사람은 읽기 전용으로 본다. */
export function encodeProfileIds(ids: readonly string[]) {
  return ids.filter((id) => /^[a-z0-9][a-z0-9-]*$/i.test(id)).slice(0, 40).join('.')
}

export function decodeProfileIds(value: string | null | undefined) {
  if (!value) return []
  return [...new Set(value.split('.').filter((id) => /^[a-z0-9][a-z0-9-]*$/i.test(id)))].slice(0, 40)
}
