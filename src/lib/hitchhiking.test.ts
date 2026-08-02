import { describe, expect, it } from 'vitest'
import { hitchhikingDirectionById, type HitchhikingDirectionId } from '../config/hitchhiking'
import { publicBands } from '../data/publicBands'
import type { Band } from '../types/music'
import type { MoodId, MoodScore } from '../types/taxonomy'
import { availableHitchhikingDirections, decodeJourney, directionEntrySignal, encodeJourney, recommendHitchhikingBands, type JourneyStep } from './hitchhiking'

describe('히치하이킹 방향 추천', () => {
  const bandWithMoods = (moodScores: Partial<Record<MoodId, MoodScore>>): Band => ({
    ...publicBands[0],
    taxonomyV2: { ...publicBands[0].taxonomyV2!, moodScores },
  })

  it('모든 공개 밴드에서 노출 가능한 방향마다 서로 다른 후보 3개 이상을 만든다', () => {
    for (const band of publicBands) {
      const available = availableHitchhikingDirections(band, publicBands)
      expect(available.length, band.name).toBeGreaterThan(0)
      expect(available.length, band.name).toBeLessThanOrEqual(4)
      for (const { direction } of available) {
        const recommendations = recommendHitchhikingBands(band, publicBands, direction.id, { limit: 3 })
        expect(recommendations.length, `${band.name} / ${direction.label}`).toBe(3)
        expect(new Set(recommendations.map((item) => item.band.id)).size).toBe(3)
        expect(recommendations.some((item) => item.band.id === band.id)).toBe(false)
      }
    }
  })

  it('Children of Bodom에는 실제 분위기와 무관한 몽환·대중 방향을 노출하지 않는다', () => {
    const band = publicBands.find((item) => item.id === 'children-of-bodom')
    expect(band).toBeDefined()
    const directions = availableHitchhikingDirections(band!, publicBands).map((item) => item.direction.id)
    expect(directions).toEqual(expect.arrayContaining(['heavier', 'faster', 'grander']))
    expect(directions).not.toContain('dreamier')
    expect(directions).not.toContain('accessible')
    expect(directions).not.toContain('experimental')
  })

  it('방향 카드는 현재 밴드가 방향별 직접·조건부 진입 규칙을 충족할 때만 열린다', () => {
    for (const band of publicBands) {
      for (const { direction } of availableHitchhikingDirections(band, publicBands)) {
        expect(directionEntrySignal(band, direction), `${band.name} / ${direction.label}`).toBeGreaterThan(0)
      }
    }
  })

  it('Radiohead에서는 전자음악 점수만으로 그루비 방향이 열리지 않는다', () => {
    const band = publicBands.find((item) => item.id === 'radiohead')
    expect(band).toBeDefined()
    expect(band!.taxonomyV2?.moodScores['groovy-danceable'] ?? 0).toBe(0)
    const directions = availableHitchhikingDirections(band!, publicBands).map((item) => item.direction.id)
    expect(directions).not.toContain('groovier')
  })

  it('Travis에서는 떼창형 3점만으로 웅장한 방향이 열리지 않는다', () => {
    const band = publicBands.find((item) => item.id === 'travis')
    expect(band).toBeDefined()
    expect(band!.taxonomyV2?.moodScores['epic-cinematic'] ?? 0).toBe(0)
    expect(band!.taxonomyV2?.moodScores['anthemic-live'] ?? 0).toBe(3)
    const directions = availableHitchhikingDirections(band!, publicBands).map((item) => item.direction.id)
    expect(directions).not.toContain('grander')
  })

  it('인접한 보조 분위기 하나만으로 의미가 다른 방향을 열지 않는다', () => {
    const cases: Array<{ direction: HitchhikingDirectionId; isolated: Partial<Record<MoodId, MoodScore>>; direct: Partial<Record<MoodId, MoodScore>>; combined: Partial<Record<MoodId, MoodScore>> }> = [
      { direction: 'heavier', isolated: { 'aggressive-heavy': 3 }, direct: { 'massive-heavy': 3 }, combined: { 'aggressive-heavy': 4, 'fast-driving': 4 } },
      { direction: 'dreamier', isolated: { 'cosmic-psychedelic': 4 }, direct: { 'dreamy-ethereal': 3 }, combined: { 'cosmic-psychedelic': 4, 'slow-calm': 3 } },
      { direction: 'accessible', isolated: { 'anthemic-live': 5 }, direct: { 'bright-upbeat': 3 }, combined: { 'anthemic-live': 4, 'romantic-emotional': 3 } },
      { direction: 'experimental', isolated: { 'technical-complex': 5 }, direct: { 'experimental-weird': 3 }, combined: { 'technical-complex': 4, 'noisy-wall': 3 } },
      { direction: 'darker', isolated: { 'melancholic-lonely': 5 }, direct: { 'dark-gloomy': 3 }, combined: { 'melancholic-lonely': 4, 'cold-urban': 2 } },
      { direction: 'warmer', isolated: { 'romantic-emotional': 5 }, direct: { 'warm-comforting': 3 }, combined: { 'romantic-emotional': 4, 'hopeful-uplifting': 3 } },
      { direction: 'grander', isolated: { 'anthemic-live': 5 }, direct: { 'epic-cinematic': 3 }, combined: { 'anthemic-live': 4, 'massive-heavy': 3 } },
    ]

    for (const item of cases) {
      const direction = hitchhikingDirectionById[item.direction]
      expect(directionEntrySignal(bandWithMoods(item.isolated), direction), `${item.direction} / isolated`).toBe(0)
      expect(directionEntrySignal(bandWithMoods(item.direct), direction), `${item.direction} / direct`).toBeGreaterThan(0)
      expect(directionEntrySignal(bandWithMoods(item.combined), direction), `${item.direction} / combined`).toBeGreaterThan(0)
    }
  })

  it('같은 입력에는 항상 같은 순서의 후보를 반환한다', () => {
    const band = publicBands[0]
    const first = recommendHitchhikingBands(band, publicBands, 'dreamier').map((item) => item.band.id)
    const second = recommendHitchhikingBands(band, publicBands, 'dreamier').map((item) => item.band.id)
    expect(first).toEqual(second)
  })

  it('이미 방문한 밴드는 새 후보보다 뒤로 보낸다', () => {
    const band = publicBands[0]
    const first = recommendHitchhikingBands(band, publicBands, 'accessible', { limit: 5 })
    const revisited = recommendHitchhikingBands(band, publicBands, 'accessible', {
      visitedIds: first.slice(0, 3).map((item) => item.band.id),
      limit: 5,
    })
    expect(revisited.slice(0, 3).some((item) => first.slice(0, 3).some((original) => original.band.id === item.band.id))).toBe(false)
  })
})

describe('히치하이킹 여정 주소', () => {
  it('방향을 포함한 경로를 안전하게 왕복한다', () => {
    const steps: JourneyStep[] = [
      { bandId: 'the-beatles' },
      { bandId: 'radiohead', via: 'experimental' },
      { bandId: 'slowdive', via: 'dreamier' },
    ]
    expect(decodeJourney(encodeJourney(steps))).toEqual(steps)
  })

  it('잘못된 밴드 ID와 방향은 버리거나 무시한다', () => {
    expect(decodeJourney('ok-band,../secret~heavier,next-band~unknown')).toEqual([
      { bandId: 'ok-band' },
      { bandId: 'next-band' },
    ])
  })
})
