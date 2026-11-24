import { describe, expect, it } from 'vitest'
import type { Band } from '../types/music'
import { publicBands } from '../data/publicBands'
import { mutualNeighbors, scoreBandSimilarity, similarBands } from './bandSimilarity'

function band(overrides: Partial<Band> & Pick<Band, 'id' | 'name'>): Band {
  const { id, name, ...rest } = overrides
  return {
    id,
    name,
    formed: 2000,
    origin: 'Test',
    countryCode: 'US',
    activeYears: '2000–현재',
    primaryGenre: 'classic-rock',
    genreIds: ['classic-rock'],
    subgenres: ['Pop Rock'],
    eraTags: [{ era: '2000s', genreIds: ['classic-rock'], subgenres: ['Pop Rock'] }],
    tags: [],
    summary: 'Test summary',
    style: 'Test style',
    image: { wikipediaTitle: '', alt: '', credit: { sourceUrl: '', license: '검토 필요', reviewStatus: 'needs-review' } },
    members: [],
    tracks: [],
    relations: [],
    sources: [],
    reviewStatus: 'published',
    taxonomyV2: {
      primaryGenreId: 'pop-soft-rock',
      secondaryGenreIds: [],
      subgenreIds: ['pop-rock'],
      moodScores: { 'bright-upbeat': 4, 'groovy-danceable': 3 },
      reviewStatus: 'reviewed',
    },
    ...rest,
  }
}

describe('band similarity', () => {
  it('rewards shared taxonomy and era, and drops pairs with no shared subgenre', () => {
    const subject = band({ id: 'a', name: 'A' })
    const close = band({ id: 'b', name: 'B' })
    const distant = band({
      id: 'c',
      name: 'C',
      countryCode: 'GB',
      eraTags: [{ era: '1970s', genreIds: ['progressive-art'], subgenres: [] }],
      taxonomyV2: {
        primaryGenreId: 'extreme-metal',
        secondaryGenreIds: [],
        subgenreIds: ['black-metal'],
        moodScores: { 'aggressive-heavy': 5 },
        reviewStatus: 'reviewed',
      },
    })
    expect(scoreBandSimilarity(subject, close, [subject, close, distant]).score).toBeGreaterThan(0)
    expect(scoreBandSimilarity(subject, distant, [subject, close, distant]).score).toBe(0)
  })

  it('gives no points for sharing a country', () => {
    const subject = band({ id: 'a', name: 'A' })
    const sameCountry = band({ id: 'b', name: 'B' })
    const otherCountry = band({ id: 'c', name: 'C', countryCode: 'GB' })
    const population = [subject, sameCountry, otherCountry]
    expect(scoreBandSimilarity(subject, sameCountry, population).score).toBe(scoreBandSimilarity(subject, otherCountry, population).score)
  })

  it('weights a rare shared subgenre above a common one', () => {
    const taxonomy = (subgenreIds: string[]) => ({ primaryGenreId: 'pop-soft-rock' as const, secondaryGenreIds: [], subgenreIds: subgenreIds as never[], moodScores: {}, reviewStatus: 'reviewed' as const })
    const subject = band({ id: 's', name: 'S', taxonomyV2: taxonomy(['pop-rock', 'shoegaze']) })
    const common = band({ id: 'c', name: 'C', taxonomyV2: taxonomy(['pop-rock']) })
    const rare = band({ id: 'r', name: 'R', taxonomyV2: taxonomy(['shoegaze']) })
    const filler = Array.from({ length: 6 }, (_, index) => band({ id: `f${index}`, name: `F${index}`, taxonomyV2: taxonomy(['pop-rock']) }))
    const population = [subject, common, rare, ...filler]
    expect(scoreBandSimilarity(subject, rare, population).score).toBeGreaterThan(scoreBandSimilarity(subject, common, population).score)
    expect(scoreBandSimilarity(subject, rare, population).sharedSubgenres).toEqual(['shoegaze'])
  })

  it('excludes the subject and sorts the strongest match first', () => {
    const subject = band({ id: 'a', name: 'A' })
    const close = band({ id: 'b', name: 'B' })
    const noTaxonomy = band({ id: 'c', name: 'C', taxonomyV2: undefined })
    expect(similarBands(subject, [noTaxonomy, subject, close]).map((result) => result.band.id)).toEqual(['b'])
  })

  it('keeps the prototype neighbours (regression)', () => {
    const top = (id: string, count: number) => similarBands(publicBands.find((item) => item.id === id)!, publicBands).slice(0, count).map((item) => item.band.id)
    expect(top('megadeth', 5)).toEqual(expect.arrayContaining(['metallica', 'motorhead', 'anthrax']))
    expect(top('the-strokes', 3)).toEqual(['arctic-monkeys', 'the-vaccines', 'the-libertines'])
    expect(top('coldplay', 3)).toEqual(['snow-patrol', 'starsailor', 'keane'])
  })

  it('finds mutual neighbours only when both sides rank each other', () => {
    const pairs = mutualNeighbors(publicBands, 5)
    const has = (a: string, b: string) => pairs.some((pair) => pair.bandIds.join() === [a, b].sort().join())
    expect(has('arctic-monkeys', 'the-strokes')).toBe(true)
    for (const pair of pairs.slice(0, 20)) expect(pair.bandIds[0] < pair.bandIds[1]).toBe(true)
  })
})
