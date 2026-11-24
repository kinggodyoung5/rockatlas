import { describe, expect, it } from 'vitest'
import { publicBands } from '../data/publicBands'
import { dailyBand } from './dailyBand'

describe('오늘의 밴드', () => {
  it('같은 날에는 같은 밴드, 배열 순서와 무관', () => {
    const day = new Date(2026, 10, 24, 9)
    expect(dailyBand(publicBands, day)?.id).toBe(dailyBand([...publicBands].reverse(), new Date(2026, 10, 24, 23))?.id)
  })

  it('날이 바뀌면 대체로 다른 밴드가 나온다', () => {
    const ids = new Set(Array.from({ length: 14 }, (_, index) => dailyBand(publicBands, new Date(2026, 10, 1 + index))?.id))
    expect(ids.size).toBeGreaterThanOrEqual(10)
  })
})
