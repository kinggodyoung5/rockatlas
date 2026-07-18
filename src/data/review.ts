import type { Band, ReviewStatus, SourceRef } from '../types/music'

export type ReviewCheckId = 'editorial' | 'identifiers' | 'image-rights' | 'official-videos' | 'relations'

export interface ReviewCheck {
  id: ReviewCheckId
  label: string
  passed: boolean
  detail: string
}

export interface BandReview {
  bandId: string
  status: ReviewStatus
  checks: ReviewCheck[]
  passedChecks: number
  totalChecks: number
  readyToPublish: boolean
}

export interface CatalogReviewSummary {
  totalBands: number
  draftBands: number
  reviewedBands: number
  publishedBands: number
  readyBands: number
  totalTracks: number
  officialTracks: number
  embeddableTracks: number
  pendingTracks: number
  totalRelations: number
  pendingRelations: number
  pendingImages: number
}

const hasStableIdentifier = (sources: SourceRef[], publisher: SourceRef['publisher'], pattern: RegExp) =>
  sources.some((source) => source.publisher === publisher && Boolean(source.externalId && pattern.test(source.externalId)))

export function reviewBand(band: Band): BandReview {
  const hasWikidataId = hasStableIdentifier(band.sources, 'Wikidata', /^Q\d+$/)
  const hasMusicBrainzId = hasStableIdentifier(
    band.sources,
    'MusicBrainz',
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  const image = band.image.credit
  const imageReady = image.reviewStatus === 'verified'
    && Boolean(image.creator && (image.license === 'Public domain' || image.licenseUrl))
    && Boolean(image.reviewedAt)
    && /commons\.wikimedia\.org/.test(image.sourceUrl)
  const pendingTracks = band.tracks.filter((track) =>
    track.reviewStatus === 'draft'
    || track.source.official !== true
    || !track.source.embedStatus
    || !track.source.embedCheckedAt,
  )
  const officialTracks = band.tracks.filter((track) => track.source.official === true)
  const embeddableTracks = band.tracks.filter((track) => track.source.embedStatus === 'allowed')
  const pendingRelations = band.relations.filter((relation) => relation.reviewStatus === 'draft' || !relation.source)

  const checks: ReviewCheck[] = [
    {
      id: 'editorial',
      label: '밴드 본문 승인',
      passed: band.reviewStatus !== 'draft' && Boolean(band.reviewedBy && band.reviewedAt),
      detail: band.reviewStatus === 'draft'
        ? '편집 초안 상태'
        : band.reviewedBy && band.reviewedAt
          ? `${band.reviewedBy} · ${band.reviewedAt}`
          : '검수자와 검수 시각 확인 필요',
    },
    {
      id: 'identifiers',
      label: '외부 식별자 교차확인',
      passed: hasWikidataId && hasMusicBrainzId,
      detail: `Wikidata ${hasWikidataId ? '확인' : '미확인'} · MusicBrainz ${hasMusicBrainzId ? '확인' : '미확인'}`,
    },
    {
      id: 'image-rights',
      label: '이미지 권리 확인',
      passed: imageReady,
      detail: imageReady ? `${image.creator} · ${image.license}` : 'Commons 원본·저작자·라이선스 확인 필요',
    },
    {
      id: 'official-videos',
      label: '공식 영상 확인',
      passed: pendingTracks.length === 0,
      detail: pendingTracks.length === 0
        ? `공식 채널 ${officialTracks.length}개 · 임베드 허용 ${embeddableTracks.length}개 · 재생 목록 제외 ${band.tracks.length - embeddableTracks.length}개`
        : `공식 채널 ${officialTracks.length}/${band.tracks.length} · 임베드 상태 검수 필요`,
    },
    {
      id: 'relations',
      label: '관계 근거 확인',
      passed: pendingRelations.length === 0,
      detail: pendingRelations.length === 0 ? `${band.relations.length}개 승인` : `${pendingRelations.length}/${band.relations.length}개 미확인`,
    },
  ]

  const passedChecks = checks.filter((check) => check.passed).length
  return {
    bandId: band.id,
    status: band.reviewStatus,
    checks,
    passedChecks,
    totalChecks: checks.length,
    readyToPublish: band.reviewStatus === 'published' && passedChecks === checks.length,
  }
}

export function summarizeCatalogReview(bands: Band[]): CatalogReviewSummary {
  const reviews = bands.map(reviewBand)
  const tracks = bands.flatMap((band) => band.tracks)
  const relations = bands.flatMap((band) => band.relations)

  return {
    totalBands: bands.length,
    draftBands: bands.filter((band) => band.reviewStatus === 'draft').length,
    reviewedBands: bands.filter((band) => band.reviewStatus === 'reviewed').length,
    publishedBands: bands.filter((band) => band.reviewStatus === 'published').length,
    readyBands: reviews.filter((review) => review.readyToPublish).length,
    totalTracks: tracks.length,
    officialTracks: tracks.filter((track) => track.source.official === true).length,
    embeddableTracks: tracks.filter((track) => track.source.embedStatus === 'allowed').length,
    pendingTracks: tracks.filter((track) =>
      track.reviewStatus === 'draft'
      || track.source.official !== true
      || !track.source.embedStatus
      || !track.source.embedCheckedAt,
    ).length,
    totalRelations: relations.length,
    pendingRelations: relations.filter((relation) => relation.reviewStatus === 'draft' || !relation.source).length,
    pendingImages: bands.filter((band) => band.image.credit.reviewStatus !== 'verified').length,
  }
}
