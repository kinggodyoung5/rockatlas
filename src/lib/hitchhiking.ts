import { HITCHHIKING_DIRECTIONS, hitchhikingDirectionById, type HitchhikingDirection, type HitchhikingDirectionId, type HitchhikingEntryRule } from '../config/hitchhiking'
import { taxonomyGenreById, taxonomyMoodById, taxonomySubgenreById } from '../data/taxonomy'
import type { Band } from '../types/music'
import type { MoodId } from '../types/taxonomy'
import { scoreBandSimilarity } from './bandSimilarity'
import { isMusicalRelation } from './relationLabels'

export type JourneyVia = HitchhikingDirectionId | 'connection'

export interface JourneyStep {
  bandId: string
  via?: JourneyVia
}

export interface HitchhikingRecommendation {
  band: Band
  score: number
  directionMatch: number
  directionLevel: number
  directionGain: number
  leadMoodId: MoodId
  /** 여정에서 이미 지나온 밴드인지. 점수에서 뒤로 미루고, 카드에 "이미 지나온 곳"으로 표시한다. */
  visited: boolean
  /** [대표 무드 점수, 출발 밴드 대비 차이, 이어지는 이유]. */
  reasons: string[]
}

export interface JourneyShift {
  direction: HitchhikingDirection
  delta: number
}

export interface AvailableHitchhikingDirection {
  direction: HitchhikingDirection
  sourceSignal: number
  candidateCount: number
}

interface RecommendationOptions {
  visitedIds?: string[]
  limit?: number
}

const validJourneyVia = new Set<string>([...HITCHHIKING_DIRECTIONS.map((direction) => direction.id), 'connection'])
const safeBandIdPattern = /^[a-z0-9][a-z0-9-]*$/i
const minimumForwardGain = 0.2
const ceilingDirectionLevel = 4

function moodEntries(direction: HitchhikingDirection) {
  return Object.entries(direction.moodWeights) as Array<[MoodId, number]>
}

export function directionLevel(band: Band, direction: HitchhikingDirection) {
  const scores = band.taxonomyV2?.moodScores ?? {}
  const entries = moodEntries(direction)
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (!totalWeight) return 0
  return entries.reduce((sum, [moodId, weight]) => sum + (scores[moodId] ?? 0) * weight, 0) / totalWeight
}

function meetsMoodThresholds(scores: Partial<Record<MoodId, number>>, thresholds: Partial<Record<MoodId, number>>, mode: 'all' | 'any' | 'none') {
  const entries = Object.entries(thresholds) as Array<[MoodId, number]>
  if (mode === 'none') return entries.every(([moodId, threshold]) => (scores[moodId] ?? 0) < threshold)
  return mode === 'all'
    ? entries.every(([moodId, threshold]) => (scores[moodId] ?? 0) >= threshold)
    : entries.some(([moodId, threshold]) => (scores[moodId] ?? 0) >= threshold)
}

export function directionEntrySignal(band: Band, direction: HitchhikingDirection) {
  const scores = band.taxonomyV2?.moodScores ?? {}
  const rules: readonly HitchhikingEntryRule[] = direction.entryRules
  return rules.reduce((strongest, rule) => {
    if (!meetsMoodThresholds(scores, rule.all, 'all')) return strongest
    if (rule.any && !meetsMoodThresholds(scores, rule.any, 'any')) return strongest
    if (rule.none && !meetsMoodThresholds(scores, rule.none, 'none')) return strongest
    const primaryMoodIds = Object.keys(rule.all) as MoodId[]
    return Math.max(strongest, ...primaryMoodIds.map((moodId) => scores[moodId] ?? 0))
  }, 0)
}

/**
 * 모든 밴드에 같은 버튼을 강제로 노출하지 않는다.
 * 현재 밴드가 방향별 직접 핵심 조건 또는 조건부 분위기 조합을 충족하고,
 * 자연스럽게 이어질 후보가 충분한 방향만 최대 네 개까지 보여준다.
 */
export function availableHitchhikingDirections(subject: Band, candidates: Band[], limit = 4): AvailableHitchhikingDirection[] {
  return HITCHHIKING_DIRECTIONS
    .map((direction): AvailableHitchhikingDirection & { rank: number } => {
      const sourceSignal = directionEntrySignal(subject, direction)
      const candidateCount = recommendHitchhikingBands(subject, candidates, direction.id, { limit: 3 }).length
      return {
        direction,
        sourceSignal: Math.round(sourceSignal * 10) / 10,
        candidateCount,
        rank: sourceSignal * 10 + directionLevel(subject, direction) * 4,
      }
    })
    .filter((item) => item.sourceSignal > 0 && item.candidateCount >= 3)
    .sort((left, right) => right.rank - left.rank || left.direction.label.localeCompare(right.direction.label, 'ko'))
    .slice(0, limit)
    .map(({ rank: _rank, ...item }) => item)
}

export function isNaturalHitchhikingTransition(subject: Band, candidate: Band) {
  const left = subject.taxonomyV2
  const right = candidate.taxonomyV2
  if (!left || !right) return false
  // Member links are about people, not sound, so they never make a transition "natural" (plan 3.2).
  const editorialRelation = subject.relations.some((relation) => isMusicalRelation(relation) && relation.targetBandId === candidate.id)
    || candidate.relations.some((relation) => isMusicalRelation(relation) && relation.targetBandId === subject.id)
  const samePrimaryGenre = left.primaryGenreId === right.primaryGenreId
  const primaryGenreCrossing = left.secondaryGenreIds.includes(right.primaryGenreId)
    || right.secondaryGenreIds.includes(left.primaryGenreId)
  const commonSubgenre = left.subgenreIds.some((id) => right.subgenreIds.includes(id))
  return editorialRelation || samePrimaryGenre || primaryGenreCrossing || commonSubgenre
}

function strongestDirectionMood(band: Band, direction: HitchhikingDirection) {
  const scores = band.taxonomyV2?.moodScores ?? {}
  return moodEntries(direction)
    .map(([moodId, weight]) => ({ moodId, rawScore: scores[moodId] ?? 0, weightedScore: (scores[moodId] ?? 0) * weight }))
    .sort((left, right) => right.weightedScore - left.weightedScore || right.rawScore - left.rawScore)[0]
}

const formatDelta = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`

/** "Metallica 대비 무게감 +1.2". 이미 끝자락에 있는 밴드에서는 차이가 작으므로 "Metallica만큼의 무게감"으로 말한다. */
export function directionComparison(subject: Band, direction: HitchhikingDirection, gain: number) {
  if (Math.abs(gain) < 0.2) return `${subject.name}만큼의 ${direction.metricLabel}, 다른 결`
  return `${subject.name} 대비 ${direction.metricLabel} ${formatDelta(gain)}`
}

/** 여정 출발점과 지금 밴드 사이에서 가장 크게 달라진 축 두 개(차이 0.5 이상). */
export function journeyShifts(start: Band, current: Band, limit = 2): JourneyShift[] {
  return HITCHHIKING_DIRECTIONS
    .map((direction) => ({ direction, delta: Math.round((directionLevel(current, direction) - directionLevel(start, direction)) * 10) / 10 }))
    .filter((item) => Math.abs(item.delta) >= 0.5)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.direction.id.localeCompare(right.direction.id))
    .slice(0, limit)
}

export function describeJourneyShifts(shifts: JourneyShift[]) {
  return shifts.map((item) => `${item.direction.metricLabel} ${formatDelta(item.delta)}`).join(', ')
}

/**
 * 방향 일치도와 기존 밴드와의 음악적 연속성을 함께 계산한다.
 * 특정 밴드명이나 장르를 예외 처리하지 않으므로 새 공개 밴드는 자동으로 후보가 된다.
 */
export function recommendHitchhikingBands(
  subject: Band,
  candidates: Band[],
  directionId: HitchhikingDirectionId,
  options: RecommendationOptions = {},
) {
  const direction = hitchhikingDirectionById[directionId]
  const subjectLevel = directionLevel(subject, direction)
  const subjectAtCeiling = directionEntrySignal(subject, direction) >= ceilingDirectionLevel
  const visited = new Set(options.visitedIds ?? [])
  const limit = options.limit ?? 12

  return candidates
    .filter((candidate) =>
      candidate.id !== subject.id
      && candidate.reviewStatus === 'published'
      && candidate.taxonomyV2
      && isNaturalHitchhikingTransition(subject, candidate),
    )
    .map((candidate): HitchhikingRecommendation => {
      const candidateLevel = directionLevel(candidate, direction)
      const gain = candidateLevel - subjectLevel
      const similarity = scoreBandSimilarity(subject, candidate)
      const leadMood = strongestDirectionMood(candidate, direction)
      const relation = subject.relations.find((item) => isMusicalRelation(item) && item.targetBandId === candidate.id)
        ?? candidate.relations.find((item) => isMusicalRelation(item) && item.targetBandId === subject.id)
      const sharedSubgenre = similarity.sharedSubgenres[0]
      const continuityReason = relation?.note
        || (sharedSubgenre ? `같은 ${taxonomySubgenreById[sharedSubgenre]?.name ?? sharedSubgenre}` : '')
        || `${taxonomyGenreById[candidate.taxonomyV2!.primaryGenreId]?.displayName ?? '새로운 록의 계보'} 쪽으로 장르가 확장`
      const forwardStep = Math.min(Math.max(gain, 0), 1.5)
      const overshoot = Math.max(0, gain - 1.75)
      const score =
        candidateLevel * 12
        + forwardStep * 24
        - overshoot * 12
        + Math.min(0, gain) * 8
        + similarity.score * 3
        + (relation ? 8 : 0)
        - (visited.has(candidate.id) ? 24 : 0)

      return {
        band: candidate,
        score: Math.round(score * 10) / 10,
        directionMatch: Math.round((candidateLevel / 5) * 100),
        directionLevel: Math.round(candidateLevel * 10) / 10,
        directionGain: Math.round(gain * 10) / 10,
        leadMoodId: leadMood.moodId,
        visited: visited.has(candidate.id),
        reasons: [
          `${taxonomyMoodById[leadMood.moodId]?.name ?? leadMood.moodId} ${leadMood.rawScore}/5`,
          directionComparison(subject, direction, gain),
          continuityReason,
        ],
      }
    })
    .filter((item) => directionEntrySignal(item.band, direction) > 0
      && (item.directionGain >= minimumForwardGain
        || subjectAtCeiling))
    .sort((left, right) => {
      const visitOrder = Number(visited.has(left.band.id)) - Number(visited.has(right.band.id))
      return visitOrder || right.score - left.score || right.directionGain - left.directionGain || left.band.name.localeCompare(right.band.name, 'en')
    })
    .slice(0, limit)
}

export function encodeJourney(steps: JourneyStep[]) {
  return steps
    .filter((step) => safeBandIdPattern.test(step.bandId))
    .map((step) => `${step.bandId}${step.via ? `~${step.via}` : ''}`)
    .join(',')
}

export function decodeJourney(value: string | null | undefined): JourneyStep[] {
  if (!value) return []
  return value.split(',').map((segment) => {
    const [bandId, via] = segment.split('~')
    if (!safeBandIdPattern.test(bandId)) return null
    return {
      bandId,
      ...(via && validJourneyVia.has(via) ? { via: via as JourneyVia } : {}),
    }
  }).filter((step): step is JourneyStep => Boolean(step)).slice(-12)
}
