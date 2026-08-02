import content from './siteContent.json' with { type: 'json' }
import type { GenreTaxonomyId } from '../types/taxonomy'

/** A CSS object-position value. Legacy presets ('center', 'top', …) still parse, but the Studio's drag
 *  control now writes precise percentages ('50% 80%') so art can be framed exactly instead of snapped
 *  to five coarse presets. */
export type ImagePosition = string

export interface GenreVisualSettings {
  artMode: 'image' | 'none'
  imageUrl: string
  imagePosition: ImagePosition
  /** Optional separate framing for narrow screens — cards are far more cropped on mobile, so the
   *  desktop framing frequently doesn't survive the aspect-ratio change. Falls back to imagePosition. */
  imagePositionMobile?: ImagePosition
  imageOpacity: number
  imageScale: number
}

export interface HitchhikingDirectionCopy {
  label: string
  description: string
  resultLabel: string
}

export interface BandDetailCopy {
  hitchhikingEyebrow: string
  hitchhikingTitle: string
  hitchhikingDescription: string
  hitchhikingOtherCandidatesLabel: string
  hitchhikingMoveLabel: string
  hitchhikingJourneyLabel: string
  hitchhikingJourneyHint: string
  hitchhikingShareLabel: string
  hitchhikingRestartLabel: string
  /** Keyed by HitchhikingDirectionId (kept as a plain string here to avoid a config/ ↔ data/ import cycle). */
  hitchhikingDirections: Record<string, HitchhikingDirectionCopy>
  relationEyebrow: string
  relationTitle: string
  relationDescription: string
  relationEmptyMessage: string
}

export interface SiteContent {
  schemaVersion: number
  updatedAt: string
  brandSuffix: string
  heroTitle: string
  heroDescription: string
  genreSectionLabel: string
  genreSectionTitle: string
  genreSectionDescription: string
  manifestoLabel: string
  manifestoTitle: string
  manifestoButtonLabel: string
  moodSectionLabel: string
  moodSectionTitle: string
  moodSectionDescription: string
  allBandsSectionLabel: string
  allBandsSectionTitle: string
  allBandsSectionDescription: string
  headerTagline: string
  /** Header nav button linking out to wherever the operator wants suggestions sent (a form, email, chat
   *  invite, ...). Hidden entirely when the URL is empty rather than showing a dead link. */
  suggestionButtonLabel: string
  suggestionLinkUrl: string
  footerTagline: string
  footerDescription: string
  footerLocation: string
  theme: {
    fontPreset: 'modern' | 'classic' | 'editorial' | 'impact'
    customFontName: string
    customFontUrl: string
    customFontFormat: 'woff2' | 'woff' | 'truetype' | 'opentype' | ''
    customFontTarget: 'all' | 'body' | 'heading'
    baseFontScale: number
    bodyWeight: 400 | 500 | 600 | 700
    bodyItalic: boolean
    headingWeight: 700 | 800 | 900
    headingItalic: boolean
    backgroundColor: string
    surfaceColor: string
    accentColor: string
    mutedColor: string
    heroArtMode: 'vinyl' | 'image' | 'none'
    heroImageUrl: string
    heroImagePosition: ImagePosition
    heroImagePositionMobile?: ImagePosition
    /** Single header/footer banner image — replaces the old separate logo mark + wordmark text/image toggle. */
    bannerImageUrl: string
    cosmicMode: 'off' | 'subtle' | 'deep'
    starDensity: number
    nebulaIntensity: number
    motionIntensity: number
    cosmicColor: string
    cosmicBackgroundUrl: string
    cosmicBackgroundPosition: 'center' | 'top' | 'bottom'
    cosmicBackgroundOpacity: number
    genreCardStyle: 'record' | 'minimal'
    genreCardColumns: 3 | 4
    genreCardGap: number
    manifestoBackgroundMode: 'accent' | 'image'
    manifestoImageUrl: string
    manifestoImagePosition: ImagePosition
    manifestoImagePositionMobile?: ImagePosition
    manifestoOverlayOpacity: number
  }
  genreVisuals: Record<GenreTaxonomyId, GenreVisualSettings>
  explorerVisuals: {
    allBands: GenreVisualSettings
    moods: GenreVisualSettings
  }
  sectionVisibility: Record<SiteSectionId, boolean>
  sectionOrder: SiteSectionId[]
  bandDetailCopy: BandDetailCopy
}

export type SiteSectionId = 'genres' | 'manifesto'

export const siteContent = content as SiteContent
