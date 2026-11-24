import type { GenreTaxonomyId, MoodId, MoodScore, SubgenreId } from './taxonomy'

export type GenreId =
  | 'classic-rock'
  | 'hard-rock'
  | 'progressive-art'
  | 'punk-rock'
  | 'alternative-indie'
  | 'britpop-indie'
  | 'heavy-metal'
  | 'extreme-metal'

export type RelationKind =
  | 'sounds-like'
  | 'influenced-by'
  | 'influenced'
  | 'shared-scene'
  /** Bands joined by a person, not by sound: successor bands, a member leaving to start or join
   *  another, a member playing in both. Never counts as musical similarity (plan decision 3.2). */
  | 'member-link'

/** How a member-link connects the two bands. 'session' is recorded for completeness but is not drawn
 *  as a lineage line. */
export type MemberLinkType = 'successor' | 'moved' | 'shared' | 'session'

export type ReviewStatus = 'draft' | 'reviewed' | 'published'

/** Band-level visibility only has two real states on the public site — a 'reviewed' band was always shown
 *  identically to a 'published' one, so that middle state was pure UI confusion with no behavioral difference. */
export type BandReviewStatus = 'draft' | 'published'

export type EraId = '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s'

export interface BandEraTag {
  era: EraId
  genreIds: GenreId[]
  subgenres: string[]
  note?: string
}

export interface ReviewRecord {
  reviewStatus: ReviewStatus
  reviewedBy?: string
  reviewedAt?: string
}

export interface SourceRef {
  label: string
  url: string
  publisher: 'Wikipedia' | 'Wikidata' | 'Wikimedia Commons' | 'MusicBrainz' | 'YouTube' | 'Editorial'
  accessedAt?: string
  note?: string
  externalId?: string
  official?: boolean
  channelName?: string
  channelType?: 'artist' | 'label' | 'topic'
  embedStatus?: 'allowed' | 'blocked'
  embedCheckedAt?: string
}

export interface ImageCredit {
  sourceUrl: string
  creator?: string
  license: string
  licenseUrl?: string
  reviewStatus: 'verified' | 'needs-review'
  reviewedAt?: string
}

export interface Genre {
  id: GenreId
  name: string
  englishName: string
  description: string
  color: string
  accent: string
  foldedGenres: string[]
}

export interface Member {
  name: string
  role: string
  activeYears?: string
  status: 'current' | 'former' | 'touring'
  /** 사망 연도. 화면에는 "· 2016년 별세"로 표시한다(plan P4-4). */
  deceased?: number
}

/** 음반 (plan P4-1). 목록과 연도는 MusicBrainz release-group에서 가져오고, `essential`·`note`는 사람이 단다. */
export interface Album {
  title: string
  year: number
  type: 'studio' | 'ep' | 'live' | 'compilation'
  /** 입문 추천 음반 */
  essential?: boolean
  /** 한 줄 해설: 이 음반이 왜 중요한가 */
  note?: string
  source?: SourceRef
}

export type MilestoneType = 'formed' | 'lineup' | 'hiatus' | 'reunion' | 'event' | 'award'

/** 연표의 사건 (plan P4-1): 결성·멤버 변동·활동 중단·재결합·사건·수상. */
export interface Milestone {
  year: number
  type: MilestoneType
  text: string
  source?: SourceRef
}

/** "알고 계셨나요" (plan P4-7). 출처가 있어야 화면에 나온다. */
export interface Trivia {
  text: string
  source: SourceRef
}

export interface Track extends ReviewRecord {
  id: string
  title: string
  year?: number
  album?: string
  /** Set for a track released outside any album (a stand-alone single), so the UI can say so
   *  instead of treating the missing album as unfinished data. */
  releaseType?: 'single'
  guide?: string
  youtubeId: string
  source: SourceRef
}

export interface Relation extends ReviewRecord {
  targetBandId: string
  kind: RelationKind
  strength: 1 | 2 | 3
  note: string
  source?: SourceRef
  /** Set only on a relation that Studio auto-created as the reverse side of another band's relation
   *  (the value is that other band's id). Lets edits/deletes on the original keep this one in sync
   *  without ever touching a relation an operator wrote by hand, which never has this field. */
  mirroredFrom?: string
  /** member-link only (required for that kind): the people who connect the two bands. */
  people?: string[]
  /** member-link only (required for that kind). The mirrored side carries the same value. */
  linkType?: MemberLinkType
}

/** A relation dropped during intake because its target band doesn't exist in the catalog yet.
 *  Kept until a band with a matching id is added, at which point both sides get connected automatically. */
export interface PendingRelation {
  id: string
  sourceBandId: string
  sourceBandName: string
  targetBandId: string
  kind: RelationKind
  strength: 1 | 2 | 3
  note: string
  /** member-link only: carried over to both sides when the pending relation resolves. */
  people?: string[]
  linkType?: MemberLinkType
  createdAt: string
}

export interface BandImage {
  wikipediaTitle: string
  fileName?: string
  displayUrl?: string
  originalUrl?: string
  alt: string
  credit: ImageCredit
}

export interface BandTaxonomyV2 {
  primaryGenreId: GenreTaxonomyId
  secondaryGenreIds: GenreTaxonomyId[]
  subgenreIds: SubgenreId[]
  moodScores: Partial<Record<MoodId, MoodScore>>
  reviewStatus: 'draft' | 'reviewed'
  reviewNote?: string
}

export interface Band extends Omit<ReviewRecord, 'reviewStatus'> {
  reviewStatus: BandReviewStatus
  id: string
  name: string
  formed: number
  origin: string
  countryCode: string
  activeYears: string
  primaryGenre: GenreId
  genreIds: GenreId[]
  subgenres: string[]
  eraTags: BandEraTag[]
  tags: string[]
  summary: string
  style: string
  image: BandImage
  members: Member[]
  tracks: Track[]
  relations: Relation[]
  sources: SourceRef[]
  taxonomyV2?: BandTaxonomyV2
  /** 상세 화면 전용(공개 인덱스에는 넣지 않는다). */
  albums?: Album[]
  milestones?: Milestone[]
  trivia?: Trivia[]
}
