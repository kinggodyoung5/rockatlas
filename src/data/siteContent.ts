import content from './siteContent.json' with { type: 'json' }
import type { GenreTaxonomyId } from '../types/taxonomy'

export interface GenreVisualSettings {
  artMode: 'image' | 'none'
  imageUrl: string
  imagePosition: 'center' | 'top' | 'bottom' | 'left' | 'right'
  imageOpacity: number
  imageScale: number
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
    heroImagePosition: 'center' | 'top' | 'bottom' | 'left' | 'right'
    logoMode: 'mark' | 'image'
    logoImageUrl: string
    wordmarkMode: 'text' | 'image'
    wordmarkImageUrl: string
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
  }
  genreVisuals: Record<GenreTaxonomyId, GenreVisualSettings>
  explorerVisuals: {
    allBands: GenreVisualSettings
    moods: GenreVisualSettings
  }
  sectionVisibility: Record<SiteSectionId, boolean>
  sectionOrder: SiteSectionId[]
}

export type SiteSectionId = 'genres' | 'bands' | 'manifesto'

export const siteContent = content as SiteContent
