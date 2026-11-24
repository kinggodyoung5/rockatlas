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
  /** Optional short display labels for the genre card's front teaser, used instead of the first
   *  three subgenreIds names when those would repeat a word (e.g. "프로그레시브 록"/"프로그레시브 메탈")
   *  and wrap to two lines. Doesn't affect the subgenre filter chips shown inside the genre page. */
  cardSubgenreLabels?: string[]
  /** 장르 해설 (plan P4-5): 어디서 시작됐고 어떻게 갈라졌나. 문단은 빈 줄로 나눈다. */
  history?: string
  /** "여기서 시작하세요": 이 순서로 들어 보라는 입문 밴드 3~5팀. */
  starterBandIds?: string[]
  /** 핵심 음반 3~5장. */
  keyAlbums?: Array<{ bandId: string; title: string; year: number; note: string }>
  /** 해설의 근거(위키백과 장르 문서 등). */
  sources?: Array<{ label: string; url: string }>
}

export interface TaxonomySubgenre {
  id: SubgenreId
  name: string
  englishName: string
  aliases?: string[]
  /** 한두 문장 정의 (plan P4-5). 용어 사전과 세부장르 칩에 쓴다. */
  description?: string
  /** 대표 밴드. 비어 있으면 화면이 수록 밴드에서 자동으로 고른다. */
  exampleBandIds?: string[]
}

export interface TaxonomyMood {
  id: MoodId
  groupId: MoodGroupId
  name: string
  description: string
  order: number
  iconKey: string
}

/** 느낌으로 찾기 상단의 이름 붙은 무드 조합(plan P3-4). Studio 디자인 작업실에서 편집한다. */
export interface MoodPreset {
  id: string
  name: string
  description?: string
  moodIds: MoodId[]
  excludeMoodIds?: MoodId[]
}

export interface TaxonomyCatalog {
  schemaVersion: 2
  updatedAt: string
  genres: TaxonomyGenre[]
  subgenres: TaxonomySubgenre[]
  moods: TaxonomyMood[]
  moodPresets?: MoodPreset[]
}
