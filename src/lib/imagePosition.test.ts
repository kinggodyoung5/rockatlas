import { describe, expect, it } from 'vitest'
import { formatPosition, parsePosition, positionStyle } from './imagePosition'

describe('image positions', () => {
  it('keeps legacy presets compatible', () => {
    expect(parsePosition('bottom')).toEqual({ x: 50, y: 100 })
  })

  it('clamps percentages and falls back from invalid values', () => {
    expect(parsePosition('130% -20%')).toEqual({ x: 100, y: 0 })
    expect(parsePosition('nope')).toEqual({ x: 50, y: 50 })
  })

  it('formats desktop and mobile CSS values', () => {
    expect(formatPosition({ x: 49.6, y: 12.4 })).toBe('50% 12%')
    expect(positionStyle('20% 30%', '70% 80%')).toMatchObject({
      '--art-position': '20% 30%',
      '--art-position-mobile': '70% 80%',
    })
  })

  it('never sets an inline objectPosition — that would always beat the mobile media-query rule regardless of screen size', () => {
    expect(positionStyle('20% 30%', '70% 80%')).not.toHaveProperty('objectPosition')
    expect(positionStyle('20% 30%', undefined)).not.toHaveProperty('objectPosition')
  })
})
