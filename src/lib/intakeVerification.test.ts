import { describe, expect, it } from 'vitest'
import { applyVerifiedIdentity, buildIdentityVerification, rankIdentityCandidates, type ExternalIdentityCandidate } from './intakeVerification'
import type { Band } from '../types/music'

const band = {
  name: 'Dream Theater',
  formed: 1985,
  origin: 'Boston, Massachusetts, United States',
  countryCode: 'US',
} as Band

const wikidata: ExternalIdentityCandidate[] = [{
  id: 'Q191879',
  name: 'Dream Theater',
  description: 'American progressive metal band',
  entityType: 'musical group',
  url: 'https://www.wikidata.org/wiki/Q191879',
  formed: 1985,
  musicBrainzId: '28503ab7-8bf2-4666-a7bd-2644bfc7cb1d',
  youtubeChannelId: 'UCsomechannel',
  imageFile: 'Dream Theater live.jpg',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Dream_Theater',
}]

const musicbrainz: ExternalIdentityCandidate[] = [{
  id: '28503ab7-8bf2-4666-a7bd-2644bfc7cb1d',
  name: 'Dream Theater',
  description: 'Group',
  entityType: 'Group',
  url: 'https://musicbrainz.org/artist/28503ab7-8bf2-4666-a7bd-2644bfc7cb1d',
  formed: 1985,
  country: 'US',
  origin: 'Boston',
  score: 100,
}]

describe('intake identity verification', () => {
  it('ranks the matching group ahead of a same-name person', () => {
    const ranked = rankIdentityCandidates(band, [
      { id: 'person', name: 'Dream Theater', description: 'person', entityType: 'human', url: 'https://example.com/person' },
      ...musicbrainz,
    ])
    expect(ranked[0].id).toBe(musicbrainz[0].id)
  })

  it('does not penalize formation facts before a name-only research has loaded them', () => {
    const ranked = rankIdentityCandidates({ name: 'Dream Theater', formed: 0, origin: '', countryCode: '' }, musicbrainz)
    expect(ranked[0].matchScore).toBeGreaterThanOrEqual(75)
    expect(ranked[0].matchReasons.some((reason) => reason.includes('연도'))).toBe(false)
  })

  it('auto-selects identifiers that cross-link and agrees on core facts', () => {
    const result = buildIdentityVerification(band, wikidata, musicbrainz)
    expect(result.status).toBe('verified')
    expect(result.linkedAcrossSources).toBe(true)
    expect(result.manualActionCount).toBe(0)
    expect(result.wikidata.selected?.id).toBe('Q191879')
  })

  it('requires review when the formation year conflicts', () => {
    const result = buildIdentityVerification(band, wikidata, [{ ...musicbrainz[0], formed: 1995 }])
    expect(result.status).toBe('review')
    expect(result.facts.find((fact) => fact.id === 'formed')?.status).toBe('review')
  })

  it('fills exact external sources without replacing editorial data', () => {
    const verification = buildIdentityVerification(band, wikidata, musicbrainz)
    const result = applyVerifiedIdentity({
      ...band,
      id: 'dream-theater',
      activeYears: '1985–present',
      primaryGenre: 'heavy-metal',
      genreIds: ['heavy-metal'],
      subgenres: [],
      eraTags: [],
      tags: [],
      summary: 'summary',
      style: 'style',
      members: [],
      tracks: [],
      relations: [],
      sources: [],
      image: {
        wikipediaTitle: 'Dream Theater',
        alt: 'Dream Theater',
        credit: { sourceUrl: '', license: '검토 필요', reviewStatus: 'needs-review' },
      },
      reviewStatus: 'draft',
    }, verification)
    expect(result.sources.map((source) => source.publisher)).toEqual(expect.arrayContaining(['Wikidata', 'MusicBrainz', 'Wikipedia', 'YouTube']))
    expect(result.image.credit.sourceUrl).toBe('File:Dream Theater live.jpg')
  })
})
