import { describe, expect, it } from 'vitest'
import { publicBands } from '../data/publicBands'
import { taxonomyMoodById, taxonomyMoodPresets } from '../data/taxonomy'
import { findMoodMatches } from './moodFinder'

describe('느낌으로 찾기', () => {
  it('고르게 맞는 밴드를 앞에 두고 선택 순서대로 점수를 돌려준다', () => {
    const results = findMoodMatches(publicBands, { selectedMoodIds: ['aggressive-heavy', 'fast-driving'] })
    expect(results.length).toBeGreaterThan(5)
    expect(results[0].scores).toHaveLength(2)
    for (let index = 1; index < results.length; index += 1) expect(results[index - 1].match).toBeGreaterThanOrEqual(results[index].match)
  })

  it('"이건 빼고" 무드가 3점 이상인 밴드를 뺀다', () => {
    const all = findMoodMatches(publicBands, { selectedMoodIds: ['melancholic-lonely'] })
    const excluded = findMoodMatches(publicBands, { selectedMoodIds: ['melancholic-lonely'], excludeMoodId: 'dark-gloomy' })
    expect(excluded.length).toBeLessThan(all.length)
    expect(excluded.every((item) => (item.band.taxonomyV2?.moodScores['dark-gloomy'] ?? 0) < 3)).toBe(true)
  })

  it('모든 추천 조합은 실제 무드를 쓰고 결과가 5팀 이상 나온다', () => {
    expect(taxonomyMoodPresets.length).toBeGreaterThanOrEqual(6)
    for (const preset of taxonomyMoodPresets) {
      for (const id of [...preset.moodIds, ...(preset.excludeMoodIds ?? [])]) expect(taxonomyMoodById[id], `${preset.id}: ${id}`).toBeDefined()
      const results = findMoodMatches(publicBands, { selectedMoodIds: preset.moodIds, excludeMoodId: preset.excludeMoodIds?.[0] })
      expect(results.length, preset.name).toBeGreaterThanOrEqual(5)
    }
  })
})
