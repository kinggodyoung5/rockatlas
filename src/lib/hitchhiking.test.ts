import { describe, expect, it } from 'vitest'
import { HITCHHIKING_DIRECTIONS } from '../config/hitchhiking'
import { publicBands } from '../data/publicBands'
import { availableHitchhikingDirections, decodeJourney, encodeJourney, recommendHitchhikingBands, type JourneyStep } from './hitchhiking'

describe('히치하이킹 방향 추천', () => {
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
    expect(directions).toEqual(expect.arrayContaining(['heavier', 'faster', 'experimental', 'grander']))
    expect(directions).not.toContain('dreamier')
    expect(directions).not.toContain('accessible')
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
