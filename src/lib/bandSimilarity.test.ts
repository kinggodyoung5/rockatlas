import { describe, expect, it } from 'vitest'
import type { Band } from '../types/music'
import { scoreBandSimilarity, similarBands } from './bandSimilarity'

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
  it('rewards shared taxonomy, era and country', () => {
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
    expect(scoreBandSimilarity(subject, close).score).toBeGreaterThan(scoreBandSimilarity(subject, distant).score)
  })

  it('excludes the subject and sorts the strongest match first', () => {
    const subject = band({ id: 'a', name: 'A' })
    const close = band({ id: 'b', name: 'B' })
    const noTaxonomy = band({ id: 'c', name: 'C', taxonomyV2: undefined })
    expect(similarBands(subject, [noTaxonomy, subject, close]).map((result) => result.band.id)).toEqual(['b'])
  })
})
