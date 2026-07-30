import { describe, expect, it } from 'vitest'
import type { Band } from '../types/music'
import { getStudioDiagnostics } from './studioDiagnostics'

function band(id: string, name: string, patch: Partial<Band> = {}): Band {
  return {
    id,
    name,
    formed: 2000,
    origin: 'Test',
    countryCode: 'US',
    activeYears: '2000–현재',
    primaryGenre: 'alternative-indie',
    genreIds: ['alternative-indie'],
    subgenres: ['Indie Rock'],
    tags: [],
    eraTags: [],
    summary: '검사용 밴드 소개입니다.',
    style: '검사용 밴드 음악 설명입니다.',
    image: { wikipediaTitle: name, alt: name, credit: { sourceUrl: 'https://example.com/image', license: 'CC BY 4.0', reviewStatus: 'verified' } },
    members: [],
    tracks: [],
    relations: [],
    sources: [
      { label: 'Wikidata', url: 'https://www.wikidata.org/', publisher: 'Wikidata', externalId: 'Q1' },
      { label: 'MusicBrainz', url: 'https://musicbrainz.org/', publisher: 'MusicBrainz', externalId: '00000000-0000-0000-0000-000000000000' },
    ],
    taxonomyV2: { primaryGenreId: 'alternative-grunge', secondaryGenreIds: [], subgenreIds: [], moodScores: {}, reviewStatus: 'reviewed' },
    reviewStatus: 'published',
    ...patch,
  }
}

describe('getStudioDiagnostics', () => {
  it('정상 공개 밴드에는 경고를 만들지 않는다', () => {
    expect(getStudioDiagnostics([band('alpha', 'Alpha')])).toEqual([])
  })

  it('중복 이름과 잘못된 관계를 찾아낸다', () => {
    const issues = getStudioDiagnostics([
      band('alpha', 'Alpha', { relations: [{ targetBandId: 'missing', kind: 'sounds-like', strength: 1, note: '', reviewStatus: 'draft' }] }),
      band('alpha-two', 'Alpha'),
    ])
    expect(issues.some((issue) => issue.message.includes('존재하지 않는 관계 대상'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('중복 밴드 이름'))).toBe(true)
  })

  it('초안 밴드의 출처와 권리 누락은 공개 경고에서 제외한다', () => {
    const draft = band('draft', 'Draft', {
      reviewStatus: 'draft',
      image: { wikipediaTitle: 'Draft', alt: 'Draft', credit: { sourceUrl: '', license: '검토 필요', reviewStatus: 'needs-review' } },
      sources: [],
    })
    expect(getStudioDiagnostics([draft])).toEqual([])
  })
})
