import { HITCHHIKING_DIRECTIONS, hitchhikingDirectionById, type HitchhikingDirection, type HitchhikingDirectionId } from '../config/hitchhiking'
import { taxonomyGenreById, taxonomyMoodById } from '../data/taxonomy'
import type { Band } from '../types/music'
import type { MoodId } from '../types/taxonomy'
import { scoreBandSimilarity } from './bandSimilarity'

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
  reasons: string[]
}

export interface AvailableHitchhikingDirection {
  direction: HitchhikingDirection
  sourceSignal: number
  editorialBridge: boolean
  candidateCount: number
}

interface RecommendationOptions {
  visitedIds?: string[]
  limit?: number
}

const validJourneyVia = new Set<string>([...HITCHHIKING_DIRECTIONS.map((direction) => direction.id), 'connection'])
const safeBandIdPattern = /^[a-z0-9][a-z0-9-]*$/i
const directionTriggerWeight = 0.5

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

function strongestSourceSignal(band: Band, direction: HitchhikingDirection) {
  const scores = band.taxonomyV2?.moodScores ?? {}
  return moodEntries(direction).reduce((strongest, [moodId, weight]) => {
    const rawScore = scores[moodId] ?? 0
    // 낮은 가중치의 분위기는 추천 순위를 다듬는 보조 신호일 뿐,
    // 그 분위기 하나만으로 방향 버튼을 만들지는 않는다.
    if (rawScore < 3 || weight < directionTriggerWeight) return strongest
    return Math.max(strongest, rawScore * (0.65 + weight * 0.35))
  }, 0)
}

/**
 * 모든 밴드에 같은 버튼을 강제로 노출하지 않는다.
 * 현재 밴드가 실제로 가진 3점 이상 분위기 또는 직접 검수된 관계를 통해
 * 한 단계 건너갈 수 있는 방향만 최대 네 개까지 보여준다.
 */
export function availableHitchhikingDirections(subject: Band, candidates: Band[], limit = 4): AvailableHitchhikingDirection[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  return HITCHHIKING_DIRECTIONS
    .map((direction): AvailableHitchhikingDirection & { rank: number } => {
      const sourceSignal = strongestSourceSignal(subject, direction)
      const subjectLevel = directionLevel(subject, direction)
      const editorialBridge = subject.relations.some((relation) => {
        const target = candidateById.get(relation.targetBandId)
        return Boolean(target && strongestSourceSignal(target, direction) >= 3 && directionLevel(target, direction) > subjectLevel)
      })
      const candidateCount = recommendHitchhikingBands(subject, candidates, direction.id, { limit: 3 }).length
      return {
        direction,
        sourceSignal: Math.round(sourceSignal * 10) / 10,
        editorialBridge,
        candidateCount,
        rank: sourceSignal * 10 + directionLevel(subject, direction) * 4 + (editorialBridge ? 18 : 0),
      }
    })
    .filter((item) => (item.sourceSignal >= 3 || item.editorialBridge) && item.candidateCount >= 3)
    .sort((left, right) => right.rank - left.rank || left.direction.label.localeCompare(right.direction.label, 'ko'))
    .slice(0, limit)
    .map(({ rank: _rank, ...item }) => item)
}

export function isNaturalHitchhikingTransition(subject: Band, candidate: Band) {
  const left = subject.taxonomyV2
  const right = candidate.taxonomyV2
  if (!left || !right) return false
  const editorialRelation = subject.relations.some((relation) => relation.targetBandId === candidate.id)
    || candidate.relations.some((relation) => relation.targetBandId === subject.id)
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

function directionReason(gain: number) {
  if (gain >= 0.75) return '지금보다 방향 변화가 확실한 선택'
  if (gain >= 0.2) return '익숙함을 유지하며 한 걸음 이동'
  return '이미 깊은 위치에서 새로운 결을 발견'
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
      const relation = subject.relations.find((item) => item.targetBandId === candidate.id)
        ?? candidate.relations.find((item) => item.targetBandId === subject.id)
      const continuityReason = relation?.note || similarity.reasons[0]
        || `${taxonomyGenreById[candidate.taxonomyV2!.primaryGenreId]?.displayName ?? '새로운 록의 계보'} 쪽으로 장르가 확장`
      const forwardStep = Math.min(Math.max(gain, 0), 1.5)
      const overshoot = Math.max(0, gain - 1.75)
      const score =
        candidateLevel * 12
        + forwardStep * 24
        - overshoot * 12
        + Math.min(0, gain) * 8
        + similarity.score * 0.9
        + (relation ? 8 : 0)
        - (visited.has(candidate.id) ? 24 : 0)

      return {
        band: candidate,
        score: Math.round(score * 10) / 10,
        directionMatch: Math.round((candidateLevel / 5) * 100),
        directionLevel: Math.round(candidateLevel * 10) / 10,
        directionGain: Math.round(gain * 10) / 10,
        leadMoodId: leadMood.moodId,
        reasons: [
          `${taxonomyMoodById[leadMood.moodId]?.name ?? leadMood.moodId} ${leadMood.rawScore}/5`,
          directionReason(gain),
          continuityReason,
        ],
      }
    })
    .filter((item) => item.directionLevel > 0)
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
