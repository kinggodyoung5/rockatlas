import { taxonomyGenreById, taxonomyMoodById, taxonomySubgenreById } from '../data/taxonomy'
import type { Band } from '../types/music'
import type { MoodId } from '../types/taxonomy'

export interface BandSimilarity {
  band: Band
  score: number
  reasons: string[]
}

export function scoreBandSimilarity(subject: Band, candidate: Band): BandSimilarity {
  const left = subject.taxonomyV2
  const right = candidate.taxonomyV2
  if (!left || !right) return { band: candidate, score: 0, reasons: [] }
  let score = 0
  const reasons: string[] = []
  if (left.primaryGenreId === right.primaryGenreId) {
    score += 30
    reasons.push(`같은 ${taxonomyGenreById[left.primaryGenreId].displayName}`)
  } else if (left.secondaryGenreIds.includes(right.primaryGenreId) || right.secondaryGenreIds.includes(left.primaryGenreId)) {
    score += 20
    reasons.push('대표·보조 장르 교차')
  } else if (left.secondaryGenreIds.some((id) => right.secondaryGenreIds.includes(id))) {
    score += 10
    reasons.push('보조 장르 교차')
  }
  const subgenreUnion = new Set([...left.subgenreIds, ...right.subgenreIds])
  const commonSubgenres = left.subgenreIds.filter((id) => right.subgenreIds.includes(id))
  if (subgenreUnion.size) score += (commonSubgenres.length / subgenreUnion.size) * 25
  if (commonSubgenres.length) reasons.push(commonSubgenres.slice(0, 2).map((id) => taxonomySubgenreById[id]?.name ?? id).join(' · '))
  const activeMoodIds = new Set<MoodId>([...Object.keys(left.moodScores), ...Object.keys(right.moodScores)] as MoodId[])
  const moodIds = [...activeMoodIds].filter((id) => (left.moodScores[id] ?? 0) >= 2 || (right.moodScores[id] ?? 0) >= 2)
  if (moodIds.length) {
    const similarity = moodIds.reduce((sum, id) => sum + (1 - Math.abs((left.moodScores[id] ?? 0) - (right.moodScores[id] ?? 0)) / 5), 0) / moodIds.length
    score += similarity * 25
  }
  const commonMoods = moodIds.filter((id) => (left.moodScores[id] ?? 0) >= 3 && (right.moodScores[id] ?? 0) >= 3).sort((a, b) => Math.min(right.moodScores[b] ?? 0, left.moodScores[b] ?? 0) - Math.min(right.moodScores[a] ?? 0, left.moodScores[a] ?? 0))
  if (commonMoods.length) reasons.push(commonMoods.slice(0, 2).map((id) => taxonomyMoodById[id].name).join(' · '))
  const commonEras = subject.eraTags.map((tag) => tag.era).filter((era) => candidate.eraTags.some((tag) => tag.era === era))
  if (commonEras.length) score += 6
  if (subject.countryCode && subject.countryCode === candidate.countryCode) {
    score += 4
    reasons.push(`같은 ${subject.countryCode} 지역`)
  }
  const manuallyConnected = subject.relations.some((relation) => relation.targetBandId === candidate.id) || candidate.relations.some((relation) => relation.targetBandId === subject.id)
  if (manuallyConnected) score += 10
  return { band: candidate, score: Math.round(score), reasons: [...new Set(reasons)].slice(0, 3) }
}

export function similarBands(subject: Band, candidates: Band[]) {
  return candidates.filter((candidate) => candidate.id !== subject.id).map((candidate) => scoreBandSimilarity(subject, candidate)).filter((result) => result.score > 0).sort((a, b) => b.score - a.score || a.band.name.localeCompare(b.band.name, 'en'))
}
