import { describe, expect, it } from 'vitest'
import { buildTaxonomyReviewRows, peerSimilarity, sortReviewQueue, taxonomyPeers, type ReviewableBand } from './taxonomyReview'

const band = (id: string, moodScores: ReviewableBand['taxonomyV2'] extends infer T ? T extends { moodScores: infer M } ? M : never : never, options: { genre?: string; subgenres?: string[]; reviewed?: boolean } = {}): ReviewableBand => ({
  id, name: id,
  taxonomyV2: { primaryGenreId: (options.genre ?? 'extreme-metal') as never, subgenreIds: options.subgenres ?? ['death-metal'], moodScores, reviewStatus: options.reviewed ? 'reviewed' : 'draft' },
})

const thrashPeers = [
  band('p1', { 'aggressive-heavy': 5, 'fast-driving': 5, 'riff-solo-driven': 4 }),
  band('p2', { 'aggressive-heavy': 5, 'fast-driving': 4, 'massive-heavy': 4 }),
  band('p3', { 'aggressive-heavy': 4, 'fast-driving': 5, 'dark-gloomy': 3 }),
]
const options = { quickMoodIdsByGenre: { 'extreme-metal': ['aggressive-heavy', 'fast-driving', 'massive-heavy'] }, directionCount: () => 3 }

describe('taxonomy review queue', () => {
  it('compares a band with same-genre bands that share a subgenre', () => {
    const subject = band('s', { 'aggressive-heavy': 5 })
    const otherGenre = band('x', { 'bright-upbeat': 5 }, { genre: 'pop-soft-rock' })
    expect(taxonomyPeers(subject, [subject, ...thrashPeers, otherGenre]).map((item) => item.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('scores a matching mood shape close to 1 and an unrelated one low', () => {
    expect(peerSimilarity(band('s', { 'aggressive-heavy': 5, 'fast-driving': 5 }), thrashPeers)).toBeGreaterThan(0.8)
    expect(peerSimilarity(band('s', { 'warm-comforting': 5, 'acoustic-organic': 4, 'slow-calm': 4 }), thrashPeers)).toBe(0)
    expect(peerSimilarity(band('s', { 'aggressive-heavy': 5 }), thrashPeers.slice(0, 2))).toBeNull()
  })

  it('flags outliers, thin mood sets, dead-end directions and off-genre scores', () => {
    const odd = band('odd', { 'warm-comforting': 5, 'acoustic-organic': 4 })
    const [row] = buildTaxonomyReviewRows([odd, ...thrashPeers], { ...options, directionCount: (item) => (item.id === 'odd' ? 1 : 3) })
    expect(row.flags).toEqual(['peer-outlier', 'few-strong', 'thin-directions', 'off-genre'])
    expect(row.deviations.map((item) => item.moodId)).toEqual(expect.arrayContaining(['warm-comforting', 'aggressive-heavy']))
  })

  it('puts unreviewed, more-flagged bands first', () => {
    const rows = buildTaxonomyReviewRows([
      band('done', { 'warm-comforting': 5 }, { reviewed: true }),
      band('fine', { 'aggressive-heavy': 5, 'fast-driving': 5, 'riff-solo-driven': 4 }),
      band('odd', { 'warm-comforting': 5 }),
      ...thrashPeers,
    ], options)
    expect(sortReviewQueue(rows)[0].id).toBe('odd')
    expect(sortReviewQueue(rows).at(-1)?.id).toBe('done')
  })
})
