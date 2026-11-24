import type { Band, EraId } from '../types/music'
import type { GenreTaxonomyId, MoodId } from '../types/taxonomy'

export interface MoodFinderFilter {
  selectedMoodIds: MoodId[]
  /** "이건 빼고": 이 무드가 3점 이상인 밴드는 결과에서 뺀다. */
  excludeMoodId?: MoodId | 'all'
  genreId?: GenreTaxonomyId | 'all'
  eraId?: EraId | 'all'
  countryCode?: string | 'all'
}

export interface MoodMatch {
  band: Band
  /** 선택한 무드 순서대로의 점수. 결과 카드의 작은 막대에 쓴다. */
  scores: number[]
  match: number
  percent: number
}

export const maxSelectedMoods = 3
const excludeThreshold = 3

/** 일치도 = 평균 × 0.7 + 최소 × 0.3. 하나만 높고 나머지가 비는 밴드보다 고르게 맞는 밴드를 앞에 둔다. */
export function findMoodMatches(bands: readonly Band[], filter: MoodFinderFilter): MoodMatch[] {
  const { selectedMoodIds } = filter
  if (!selectedMoodIds.length) return []
  return bands.map((band) => {
    const scores = selectedMoodIds.map((id): number => band.taxonomyV2?.moodScores[id] ?? 0)
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const match = average * 0.7 + Math.min(...scores) * 0.3
    return { band, scores, average, match, percent: Math.round((match / 5) * 20) * 5 }
  }).filter(({ band, scores, average, match }) => (scores.length === 1 ? scores[0] >= 2 : average >= 2)
    && match > 0
    && (!filter.excludeMoodId || filter.excludeMoodId === 'all' || (band.taxonomyV2?.moodScores[filter.excludeMoodId] ?? 0) < excludeThreshold)
    && (!filter.genreId || filter.genreId === 'all' || band.taxonomyV2?.primaryGenreId === filter.genreId)
    && (!filter.eraId || filter.eraId === 'all' || band.eraTags.some((tag) => tag.era === filter.eraId))
    && (!filter.countryCode || filter.countryCode === 'all' || band.countryCode === filter.countryCode))
    .sort((a, b) => b.match - a.match || a.band.name.localeCompare(b.band.name, 'en'))
    .map(({ band, scores, match, percent }) => ({ band, scores, match, percent }))
}
