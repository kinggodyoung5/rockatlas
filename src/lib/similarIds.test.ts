import { describe, expect, it } from 'vitest'
import { publicBands } from '../data/publicBands'
import { similarBandIds } from './similarIds'

describe('없는 밴드 주소 제안', () => {
  const ids = publicBands.map((band) => band.id)
  it('오타와 줄임을 가까운 밴드로', () => {
    expect(similarBandIds('metalica', ids)[0]).toBe('metallica')
    expect(similarBandIds('ironmaiden', ids)[0]).toBe('iron-maiden')
    expect(similarBandIds('radiohed', ids)[0]).toBe('radiohead')
  })
  it('엉뚱한 값에는 제안하지 않는다', () => expect(similarBandIds('zzzzqqqqxxxx', ids)).toEqual([]))
})
