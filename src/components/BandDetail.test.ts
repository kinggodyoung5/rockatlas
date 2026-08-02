import { describe, expect, it } from 'vitest'
import type { BandEraTag } from '../types/music'
import { groupEraTags, isStillActive } from './BandDetail'

const tag = (era: BandEraTag['era'], subgenres: string[], note?: string): BandEraTag => ({
  era,
  genreIds: ['heavy-metal'],
  subgenres,
  note,
})

describe('밴드 장르 변화 연대표', () => {
  it('현재 활동 중이며 장르가 변하지 않은 밴드는 결성 시대부터 현재까지로 표시한다', () => {
    const groups = groupEraTags([tag('1960s', ['전통 헤비메탈'])], '1969–1992, 1996–현재')
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('1960년대~현재')
  })

  it('해체하거나 활동을 끝낸 밴드는 현재로 늘리지 않는다', () => {
    const groups = groupEraTags([
      tag('1970s', ['글램 록']),
      tag('1980s', ['팝 록']),
    ], '1962–2016')
    expect(groups.at(-1)?.label).toBe('1980년대')
  })

  it('마지막 활동 구간만 보고 재결성 뒤 현재 활동 여부를 판단한다', () => {
    expect(isStillActive('2001–2013, 2019–현재')).toBe(true)
    expect(isStillActive('1962–2016')).toBe(false)
  })

  it('같은 장르 조합이 이어지면 한 줄로 합치고 설명을 보존한다', () => {
    const groups = groupEraTags([
      tag('1990s', ['얼터너티브 록'], '첫 시기.'),
      tag('2000s', ['얼터너티브 록'], '다음 시기.'),
    ], '1990–2010')
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('1990년대~2000년대')
    expect(groups[0].note).toBe('첫 시기. 다음 시기.')
  })
})
