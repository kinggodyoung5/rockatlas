/**
 * 분류 검수 대기열(plan P3-1)의 이상치 판정. 무드 점수는 히치하이킹·느낌으로 찾기·유사도의 유일한
 * 입력이라, 사람이 183팀을 처음부터 다 보는 대신 "어디부터 볼지"를 정해 준다.
 *
 * 이 파일은 타입만 가져온다. Node 스크립트(`scripts/audit-mood-coverage.ts`)와 Studio 화면이 같은
 * 판정을 쓰도록, 히치하이킹 방향 수 같은 앱 쪽 계산은 인자로 받는다.
 */
import type { GenreTaxonomyId, MoodId } from '../types/taxonomy'

export interface ReviewableBand {
  id: string
  name: string
  taxonomyV2?: {
    primaryGenreId: GenreTaxonomyId
    subgenreIds: string[]
    moodScores: Partial<Record<MoodId, number>>
    reviewStatus: 'draft' | 'reviewed'
  }
}

export type ReviewFlagKind = 'peer-outlier' | 'few-strong' | 'thin-directions' | 'off-genre'

export interface MoodDeviation {
  moodId: MoodId
  score: number
  peerMean: number
}

export interface TaxonomyReviewRow {
  id: string
  name: string
  primaryGenreId?: GenreTaxonomyId
  reviewStatus: 'draft' | 'reviewed' | 'missing'
  peerCount: number
  /** 같은 장르·세부장르 동료 평균과의 무드 벡터 코사인 유사도(0~1). 동료가 부족하면 null. */
  peerSimilarity: number | null
  deviations: MoodDeviation[]
  strongMoodCount: number
  directionCount: number
  flags: ReviewFlagKind[]
}

export interface TaxonomyReviewOptions<T extends ReviewableBand = ReviewableBand> {
  /** 장르별 빠른 무드 3개(taxonomy.v2.json의 quickMoodIds). */
  quickMoodIdsByGenre: Partial<Record<GenreTaxonomyId, readonly string[]>>
  /** 이 밴드에서 열리는 히치하이킹 방향 수. 스크립트는 진입 규칙만, Studio는 후보 수까지 따진다. */
  directionCount: (band: T) => number
}

export const reviewFlagLabels: Record<ReviewFlagKind, string> = {
  'peer-outlier': '같은 계열과 점수가 크게 다름',
  'few-strong': '3점 이상 무드가 2개 이하',
  'thin-directions': '히치하이킹 방향 1개 이하',
  'off-genre': '대표 장르의 핵심 무드가 모두 3점 미만',
}

const strongScore = 3
/** 한 무드에서 동료 평균과 이만큼 벌어지면 "다르다"로 센다. */
const deviationThreshold = 2
/** 동료 평균 벡터와의 코사인 유사도가 이보다 낮으면 이상치로 표시한다. 무드는 밴드당 5개 안팎으로
 *  드문드문 매겨지므로, 무드 하나의 차이가 아니라 전체 모양이 얼마나 다른지로 본다. */
const outlierSimilarity = 0.5
const minimumPeers = 3

const score = (band: ReviewableBand, moodId: string) => band.taxonomyV2?.moodScores[moodId as MoodId] ?? 0
const sharedCount = (left: string[], right: string[]) => left.filter((id) => right.includes(id)).length

/** 비교 대상: 같은 대표 장르 + 세부장르 1개 이상 공유. 부족하면 장르와 무관하게 세부장르 2개 이상 공유. */
export function taxonomyPeers(band: ReviewableBand, bands: ReviewableBand[]) {
  const own = band.taxonomyV2
  if (!own) return []
  const others = bands.filter((other) => other.id !== band.id && other.taxonomyV2)
  const close = others.filter((other) => other.taxonomyV2!.primaryGenreId === own.primaryGenreId && sharedCount(own.subgenreIds, other.taxonomyV2!.subgenreIds) >= 1)
  if (close.length >= minimumPeers) return close
  return others.filter((other) => sharedCount(own.subgenreIds, other.taxonomyV2!.subgenreIds) >= 2)
}

export function moodDeviations(band: ReviewableBand, peers: ReviewableBand[]): MoodDeviation[] {
  if (peers.length < minimumPeers) return []
  const moodIds = new Set<string>()
  for (const item of [band, ...peers]) Object.keys(item.taxonomyV2?.moodScores ?? {}).forEach((id) => moodIds.add(id))
  return [...moodIds]
    .map((moodId) => ({ moodId: moodId as MoodId, score: score(band, moodId), peerMean: peers.reduce((sum, peer) => sum + score(peer, moodId), 0) / peers.length }))
    .filter((item) => Math.abs(item.score - item.peerMean) >= deviationThreshold)
    .sort((left, right) => Math.abs(right.score - right.peerMean) - Math.abs(left.score - left.peerMean) || left.moodId.localeCompare(right.moodId))
}

export function peerSimilarity(band: ReviewableBand, peers: ReviewableBand[]) {
  if (peers.length < minimumPeers) return null
  const moodIds = new Set<string>()
  for (const item of [band, ...peers]) Object.keys(item.taxonomyV2?.moodScores ?? {}).forEach((id) => moodIds.add(id))
  let dot = 0, own = 0, mean = 0
  for (const moodId of moodIds) {
    const value = score(band, moodId)
    const peerMean = peers.reduce((sum, peer) => sum + score(peer, moodId), 0) / peers.length
    dot += value * peerMean; own += value * value; mean += peerMean * peerMean
  }
  return own && mean ? Math.round((dot / Math.sqrt(own * mean)) * 100) / 100 : 0
}

export function buildTaxonomyReviewRows<T extends ReviewableBand>(bands: T[], options: TaxonomyReviewOptions<T>): TaxonomyReviewRow[] {
  return bands.map((band) => {
    const taxonomy = band.taxonomyV2
    const peers = taxonomyPeers(band, bands)
    const deviations = moodDeviations(band, peers)
    const similarity = peerSimilarity(band, peers)
    const strongMoodCount = Object.values(taxonomy?.moodScores ?? {}).filter((value) => (value ?? 0) >= strongScore).length
    const directionCount = taxonomy ? options.directionCount(band) : 0
    const quickMoodIds = taxonomy ? options.quickMoodIdsByGenre[taxonomy.primaryGenreId] ?? [] : []
    const flags: ReviewFlagKind[] = []
    if (similarity !== null && similarity < outlierSimilarity) flags.push('peer-outlier')
    if (strongMoodCount <= 2) flags.push('few-strong')
    if (directionCount <= 1) flags.push('thin-directions')
    if (quickMoodIds.length && quickMoodIds.every((moodId) => score(band, moodId) < strongScore)) flags.push('off-genre')
    return {
      id: band.id,
      name: band.name,
      primaryGenreId: taxonomy?.primaryGenreId,
      reviewStatus: taxonomy?.reviewStatus ?? 'missing',
      peerCount: peers.length,
      peerSimilarity: similarity,
      deviations,
      strongMoodCount,
      directionCount,
      flags,
    }
  })
}

/** 대기열 순서: 미검수 먼저, 그 안에서 표시가 많은 순, 같으면 동료와 덜 닮은 순. */
export function sortReviewQueue(rows: TaxonomyReviewRow[]) {
  const pending = (row: TaxonomyReviewRow) => Number(row.reviewStatus === 'reviewed')
  return [...rows].sort((left, right) => pending(left) - pending(right)
    || right.flags.length - left.flags.length
    || (left.peerSimilarity ?? 1) - (right.peerSimilarity ?? 1)
    || left.name.localeCompare(right.name, 'en'))
}
