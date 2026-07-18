import content from './siteContent.json' with { type: 'json' }

export interface SiteContent {
  schemaVersion: number
  updatedAt: string
  brandSuffix: string
  heroTitle: string
  heroDescription: string
  genreSectionLabel: string
  genreSectionTitle: string
  genreSectionDescription: string
  theme: {
    fontPreset: 'modern' | 'classic' | 'editorial'
    baseFontScale: number
    headingWeight: 700 | 800 | 900
    backgroundColor: string
    surfaceColor: string
    accentColor: string
    mutedColor: string
    heroArtMode: 'vinyl' | 'image' | 'none'
    heroImageUrl: string
    heroImagePosition: 'center' | 'top' | 'bottom' | 'left' | 'right'
  }
  sectionVisibility: Record<SiteSectionId, boolean>
  sectionOrder: SiteSectionId[]
}

export type SiteSectionId = 'genres' | 'bands' | 'manifesto'

export const siteContent = content as SiteContent
