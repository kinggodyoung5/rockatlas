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
  | 'evolution'

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
}

export interface Track extends ReviewRecord {
  id: string
  title: string
  year?: number
  album?: string
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
}
