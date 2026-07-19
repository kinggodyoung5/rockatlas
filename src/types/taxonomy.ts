export type GenreTaxonomyId =
  | 'classic-roots-rock'
  | 'hard-glam-rock'
  | 'pop-soft-rock'
  | 'progressive-art-psychedelic'
  | 'punk-emo'
  | 'indie-britpop-garage'
  | 'post-punk-goth-new-wave'
  | 'alternative-grunge'
  | 'shoegaze-dream-post'
  | 'traditional-power-thrash-metal'
  | 'folk-symphonic-metal'
  | 'extreme-metal'
  | 'modern-alternative-metal'

export type MoodId =
  | 'bright-upbeat'
  | 'fast-driving'
  | 'groovy-danceable'
  | 'aggressive-heavy'
  | 'massive-heavy'
  | 'slow-calm'
  | 'melancholic-lonely'
  | 'dark-gloomy'
  | 'warm-comforting'
  | 'romantic-emotional'
  | 'youth-rebellious'
  | 'hopeful-uplifting'
  | 'dreamy-ethereal'
  | 'cold-urban'
  | 'cosmic-psychedelic'
  | 'noisy-wall'
  | 'acoustic-organic'
  | 'electronic-synth'
  | 'epic-cinematic'
  | 'technical-complex'
  | 'experimental-weird'
  | 'long-form-immersive'
  | 'riff-solo-driven'
  | 'anthemic-live'

export type MoodGroupId = 'energy' | 'emotion' | 'texture' | 'listening'
export type MoodScore = 0 | 1 | 2 | 3 | 4 | 5
export type SubgenreId = string

export interface TaxonomyGenre {
  id: GenreTaxonomyId
  name: string
  displayName: string
  englishName: string
  description: string
  vibeDescription: string
  order: number
  color: string
  accent: string
  iconKey: string
  subgenreIds: SubgenreId[]
  quickMoodIds: MoodId[]
  featuredBandIds: string[]
}

export interface TaxonomySubgenre {
  id: SubgenreId
  name: string
  englishName: string
}

export interface TaxonomyMood {
  id: MoodId
  groupId: MoodGroupId
  name: string
  description: string
  order: number
  iconKey: string
}

export interface TaxonomyCatalog {
  schemaVersion: 2
  updatedAt: string
  genres: TaxonomyGenre[]
  subgenres: TaxonomySubgenre[]
  moods: TaxonomyMood[]
}
