import { taxonomyGenres, taxonomyMoods, taxonomySubgenres } from '../data/taxonomy'
import type { Band, BandTaxonomyV2, EraId, GenreId, Member, Relation, RelationKind, SourceRef, Track } from '../types/music'
import type { GenreTaxonomyId, MoodId, MoodScore } from '../types/taxonomy'

export type IntakeSeverity = 'error' | 'warning' | 'info'

export interface IntakeIssue {
  severity: IntakeSeverity
  code: string
  message: string
}

export interface IntakeCandidate {
  key: string
  band: Band
  issues: IntakeIssue[]
  canApprove: boolean
}

export interface IntakeResult {
  candidates: IntakeCandidate[]
  globalIssues: IntakeIssue[]
}

type UnknownRecord = Record<string, unknown>

const legacyGenreIds: GenreId[] = ['classic-rock', 'hard-rock', 'progressive-art', 'punk-rock', 'alternative-indie', 'britpop-indie', 'heavy-metal', 'extreme-metal']
const relationKinds: RelationKind[] = ['sounds-like', 'influenced-by', 'influenced', 'shared-scene', 'evolution']
const eraIds: EraId[] = ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']

const legacyByTaxonomy: Record<GenreTaxonomyId, GenreId> = {
  'classic-roots-rock': 'classic-rock',
  'hard-glam-rock': 'hard-rock',
  'pop-soft-rock': 'classic-rock',
  'progressive-art-psychedelic': 'progressive-art',
  'punk-emo': 'punk-rock',
  'indie-britpop-garage': 'britpop-indie',
  'post-punk-goth-new-wave': 'alternative-indie',
  'alternative-grunge': 'alternative-indie',
  'shoegaze-dream-post': 'britpop-indie',
  'traditional-power-thrash-metal': 'heavy-metal',
  'folk-symphonic-metal': 'heavy-metal',
  'extreme-metal': 'extreme-metal',
  'modern-alternative-metal': 'heavy-metal',
}

const taxonomyByLegacy: Record<GenreId, GenreTaxonomyId> = {
  'classic-rock': 'classic-roots-rock',
  'hard-rock': 'hard-glam-rock',
  'progressive-art': 'progressive-art-psychedelic',
  'punk-rock': 'punk-emo',
  'alternative-indie': 'alternative-grunge',
  'britpop-indie': 'indie-britpop-garage',
  'heavy-metal': 'traditional-power-thrash-metal',
  'extreme-metal': 'extreme-metal',
}

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const number = (value: unknown) => typeof value === 'number' ? value : Number(value)
const stringList = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : typeof value === 'string' ? value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean) : []
export const slugify = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/\p{Mark}+/gu, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const markdownLinkPattern = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g

function safeHost(value: string): string {
  try { return new URL(value).hostname } catch { return '' }
}
const isGoogleRedirect = (value: string) => /(^|\.)google\.[a-z.]+$/i.test(safeHost(value))
/** Gemini's search-grounding mode rewrites every citation as a Google redirect (…/search?q=<real url>); unwrap it to reach the real target. */
function unwrapGoogleRedirect(value: string): string {
  if (!isGoogleRedirect(value)) return value
  try {
    const parsed = new URL(value)
    const inner = parsed.searchParams.get('q') || parsed.searchParams.get('url')
    return inner ? unwrapGoogleRedirect(inner) : value
  } catch { return value }
}
/** Gemini occasionally wraps a URL in markdown syntax, and search-grounded answers wrap the real link in a Google redirect on either side of the link — pick whichever side is a direct, non-Google URL. */
function stripMarkdownToUrl(value: string): string {
  const trimmed = value.trim()
  const wholeMatch = /^\[([^\]]*)\]\((\S+)\)$/.exec(trimmed)
  if (wholeMatch) {
    const [, label, target] = wholeMatch
    const candidates = [label.trim(), unwrapGoogleRedirect(target.trim()), target.trim()]
    return candidates.find((candidate) => /^https?:\/\//.test(candidate) && !isGoogleRedirect(candidate)) ?? candidates[0]
  }
  const urlMatches = [...trimmed.matchAll(/https?:\/\/[^\s)\]]+/g)].map((match) => unwrapGoogleRedirect(match[0]))
  const direct = urlMatches.find((url) => !isGoogleRedirect(url))
  if (direct) return direct
  return urlMatches[0] ?? trimmed
}
/** For prose fields, markdown links should collapse to their visible label text. */
function stripMarkdownToText(value: string): string {
  return value.replace(markdownLinkPattern, (_match, label: string, url: string) => (label.trim() || stripMarkdownToUrl(url))).trim()
}
const textUrl = (value: unknown) => stripMarkdownToUrl(text(value))
const textProse = (value: unknown) => stripMarkdownToText(text(value))
const normalizeTaxonomyLabel = (value: unknown) => text(value)
  .toLocaleLowerCase()
  .normalize('NFKC')
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9가-힣]+/g, '')

const genreAliasMap = new Map<string, GenreTaxonomyId>(taxonomyGenres.flatMap((genre) =>
  [genre.id, genre.name, genre.displayName, genre.englishName].map((label) => [normalizeTaxonomyLabel(label), genre.id] as const),
))
const subgenreAliasMap = new Map<string, string>(taxonomySubgenres.flatMap((subgenre) =>
  [subgenre.id, subgenre.name, subgenre.englishName].map((label) => [normalizeTaxonomyLabel(label), subgenre.id] as const),
))
// A few very common short forms Gemini reaches for that don't exactly match any registered subgenre name
// (our subgenre is "전통 헤비메탈"/"Traditional Heavy Metal", but the everyday term is just "헤비메탈"/"Heavy Metal").
const extraSubgenreAliases: Record<string, string> = {
  헤비메탈: 'traditional-heavy-metal', heavymetal: 'traditional-heavy-metal',
  펑크: 'punk-rock', punk: 'punk-rock',
  메탈코어: 'metalcore', metalcore: 'metalcore',
}
for (const [label, subgenreId] of Object.entries(extraSubgenreAliases)) {
  const key = normalizeTaxonomyLabel(label)
  if (!subgenreAliasMap.has(key)) subgenreAliasMap.set(key, subgenreId)
}
// Gemini reasonably guesses well-known genre words ("Heavy Metal", "Grunge") that are actually one of our
// subgenres, not the name of the (oddly-combined) parent genre bucket they belong to. Resolve those to their
// parent genre instead of rejecting the whole band for "no valid primary genre".
const parentGenreIdBySubgenreId = new Map<string, GenreTaxonomyId>(
  taxonomyGenres.flatMap((genre) => genre.subgenreIds.map((subgenreId) => [subgenreId, genre.id] as const)),
)
const moodAliasMap = new Map<string, MoodId>(taxonomyMoods.flatMap((mood) =>
  [mood.id, mood.name].map((label) => [normalizeTaxonomyLabel(label), mood.id] as const),
))
// Keep this list conservative: these are old prompt IDs and common rephrasings that carry the
// same meaning as exactly one ROCK ATLAS mood. Ambiguous words should keep producing a warning
// instead of being silently forced into the wrong mood.
const extraMoodAliases: Partial<Record<MoodId, string[]>> = {
  'bright-upbeat': ['upbeat-bright', 'bright-happy', 'happy-upbeat', '밝고 경쾌한', '유쾌하고 신나는'],
  'fast-driving': ['driving-fast', 'fast-paced', 'energetic-driving', '질주감 있는', '빠르고 에너지 넘치는'],
  'groovy-danceable': ['groovy-funky', 'funky-groovy', 'danceable-groovy', 'groovy', 'funky', '그루비-펑키', '펑키하고 그루비한', '춤추기 좋은', '댄서블'],
  'aggressive-heavy': ['heavy-aggressive', 'aggressive-intense', '강하고 공격적인'],
  'massive-heavy': ['heavy-massive', 'massive-powerful', '무겁고 압도적인'],
  'slow-calm': ['calm-slow', 'slow-mellow', '느리고 잔잔한'],
  'melancholic-lonely': ['lonely-melancholic', 'sad-lonely', '쓸쓸하고 우울한'],
  'dark-gloomy': ['gloomy-dark', 'dark-ominous', '음울하고 어두운'],
  'warm-comforting': ['comforting-warm', 'warm-gentle', '편안하고 따뜻한'],
  'romantic-emotional': ['emotional-romantic', 'emotional-melodic', '감성적이고 낭만적인'],
  'youth-rebellious': ['rebellious-youthful', 'youthful-rebellious', '젊고 반항적인'],
  'hopeful-uplifting': ['uplifting-hopeful', 'positive-uplifting', '벅차고 희망적인'],
  'dreamy-ethereal': ['ethereal-dreamy', 'dreamy-atmospheric', '몽환적이고 공간감 있는'],
  'cold-urban': ['urban-cold', 'cold-modern', '도시적이고 차가운'],
  'cosmic-psychedelic': ['psychedelic-cosmic', 'spacey-psychedelic', '환각적이고 우주적인'],
  'noisy-wall': ['wall-of-sound', 'noise-wall', 'dense-noisy', '노이즈가 겹겹이 쌓인'],
  'acoustic-organic': ['organic-acoustic', 'natural-acoustic', '자연스럽고 어쿠스틱한'],
  'electronic-synth': ['synth-electronic', 'electronic-synthesizer', '신스와 전자음이 많은'],
  'epic-cinematic': ['cinematic-epic', 'grand-cinematic', '영화적이고 웅장한'],
  'technical-complex': ['complex-technical', 'technical-intricate', '테크니컬하고 복잡한'],
  'experimental-weird': ['weird-experimental', 'experimental-unusual', '기묘하고 실험적인'],
  'long-form-immersive': ['immersive-long-form', 'long-immersive', '긴 호흡에 몰입하는'],
  'riff-solo-driven': ['guitar-driven', 'riff-driven', 'riff-and-solo', '리프와 솔로 중심'],
  'anthemic-live': ['live-anthemic', 'arena-anthemic', 'singalong-live', '공연장 떼창형', '라이브 앤섬형'],
}
for (const [moodId, labels] of Object.entries(extraMoodAliases) as [MoodId, string[]][]) {
  labels.forEach((label) => {
    const key = normalizeTaxonomyLabel(label)
    if (!moodAliasMap.has(key)) moodAliasMap.set(key, moodId)
  })
}
const canonicalMoodKeys = new Set(taxonomyMoods.flatMap((mood) =>
  [mood.id, mood.name].map((label) => normalizeTaxonomyLabel(label)),
))

const resolveGenreId = (value: unknown): GenreTaxonomyId | undefined => {
  const direct = genreAliasMap.get(normalizeTaxonomyLabel(value))
  if (direct) return direct
  const viaSubgenre = subgenreAliasMap.get(normalizeTaxonomyLabel(value))
  return viaSubgenre ? parentGenreIdBySubgenreId.get(viaSubgenre) : undefined
}
const resolveSubgenreId = (value: unknown) => subgenreAliasMap.get(normalizeTaxonomyLabel(value))
export const resolveMoodId = (value: unknown) => moodAliasMap.get(normalizeTaxonomyLabel(value))

function eraFromYear(year: number): EraId {
  const candidate = `${Math.min(2020, Math.max(1960, Math.floor(year / 10) * 10))}s` as EraId
  return eraIds.includes(candidate) ? candidate : '2020s'
}

function youtubeId(value: unknown) {
  const input = textUrl(value)
  if (!input) return ''
  try {
    const url = new URL(input)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0]
    if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] ?? ''
    return url.searchParams.get('v') ?? ''
  } catch {
    return /^[\w-]{6,20}$/.test(input) ? input : ''
  }
}

function normalizeSources(value: unknown, name: string, raw: UnknownRecord): SourceRef[] {
  const sources: SourceRef[] = []
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!isRecord(entry)) return
      const publisher = text(entry.publisher) as SourceRef['publisher']
      const allowed: SourceRef['publisher'][] = ['Wikipedia', 'Wikidata', 'Wikimedia Commons', 'MusicBrainz', 'YouTube', 'Editorial']
      const url = textUrl(entry.url)
      if (!allowed.includes(publisher) || !url) return
      sources.push({
        label: text(entry.label) || `${name} — ${publisher}`,
        url,
        publisher,
        externalId: text(entry.externalId) || undefined,
        note: text(entry.note) || '외부 조사에서 가져온 초안 · 운영자 확인 필요',
        official: typeof entry.official === 'boolean' ? entry.official : undefined,
      })
    })
  }
  const wikidataId = text(raw.wikidataId ?? raw.wikidata_id)
  const musicBrainzId = text(raw.musicBrainzId ?? raw.musicbrainzId ?? raw.musicbrainz_id)
  const wikipediaUrl = textUrl(raw.wikipediaUrl ?? raw.wikipedia_url)
  const youtubeChannelUrl = textUrl(raw.youtubeChannelUrl ?? raw.officialYoutubeUrl ?? raw.youtube_channel_url)
  if (wikidataId && !sources.some((item) => item.publisher === 'Wikidata')) sources.push({ label: `${name} — Wikidata`, url: `https://www.wikidata.org/wiki/${wikidataId}`, publisher: 'Wikidata', externalId: wikidataId, note: '외부 조사에서 가져온 식별자 · 운영자 확인 필요' })
  if (musicBrainzId && !sources.some((item) => item.publisher === 'MusicBrainz')) sources.push({ label: `${name} — MusicBrainz`, url: `https://musicbrainz.org/artist/${musicBrainzId}`, publisher: 'MusicBrainz', externalId: musicBrainzId, note: '외부 조사에서 가져온 식별자 · 운영자 확인 필요' })
  if (wikipediaUrl && !sources.some((item) => item.publisher === 'Wikipedia')) sources.push({ label: `${name} — Wikipedia`, url: wikipediaUrl, publisher: 'Wikipedia', note: '외부 조사에서 가져온 출처 · 운영자 확인 필요' })
  if (youtubeChannelUrl && /^https:\/\/(www\.)?youtube\.com\//.test(youtubeChannelUrl) && !sources.some((item) => item.publisher === 'YouTube')) {
    sources.push({
      label: `${name} — 공식 YouTube`,
      url: youtubeChannelUrl,
      publisher: 'YouTube',
      official: true,
      externalId: youtubeChannelUrl.match(/(?:channel\/|youtube\.com\/)(UC[\w-]+|@[\w.-]+)/)?.[1],
      note: '외부 조사에서 가져온 공식 채널 · 운영자 확인 필요',
    })
  }
  return sources
}

function normalizeMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) return []
  return value.flatMap<Member>((entry) => {
    if (typeof entry === 'string') return [{ name: entry.trim(), role: '역할 확인 필요', status: 'current' as const }]
    if (!isRecord(entry) || !text(entry.name)) return []
    const status = ['current', 'former', 'touring'].includes(text(entry.status)) ? text(entry.status) as Member['status'] : 'current'
    return [{ name: text(entry.name), role: text(entry.role) || '역할 확인 필요', status, activeYears: text(entry.activeYears) || undefined }]
  })
}

function normalizeTracks(value: unknown, name: string): Track[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    const raw = typeof entry === 'string' ? { title: entry } : isRecord(entry) ? entry : null
    if (!raw || !text(raw.title ?? raw.name)) return []
    const title = text(raw.title ?? raw.name)
    const id = youtubeId(raw.youtubeId ?? raw.youtubeUrl ?? raw.url)
    const year = number(raw.year)
    return [{
      id: slugify(text(raw.id) || title) || `track-${index + 1}`,
      title,
      year: Number.isInteger(year) && year > 1900 ? year : undefined,
      album: text(raw.album) || undefined,
      guide: textProse(raw.guide ?? raw.description) || undefined,
      youtubeId: id,
      source: {
        label: `${name} — ${title}`,
        url: id ? `https://www.youtube.com/watch?v=${id}` : textUrl(raw.url) || 'https://www.youtube.com/',
        publisher: 'YouTube',
        official: false,
        note: '곡 정보와 링크는 운영자 확인 전 초안입니다.',
      },
      reviewStatus: 'draft',
    }]
  })
}

function normalizeRelations(value: unknown): Relation[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const targetBandId = slugify(text(entry.targetBandId ?? entry.targetId ?? entry.targetBandName ?? entry.targetName))
    if (!targetBandId) return []
    const kind = relationKinds.includes(text(entry.kind) as RelationKind) ? text(entry.kind) as RelationKind : 'sounds-like'
    const rawStrength = Math.round(number(entry.strength))
    // Gemini often rates strength on its own 1-5 scale; clamp toward the nearer end instead of silently
    // collapsing an out-of-range "5" (meant as strongest) down to 1 (weakest).
    const strength = (Number.isFinite(rawStrength) ? Math.min(3, Math.max(1, rawStrength)) : 1) as 1 | 2 | 3
    return [{ targetBandId, kind, strength, note: textProse(entry.note) || '외부 조사에서 제안된 관계 · 근거 확인 필요', reviewStatus: 'draft' }]
  })
}

function normalizeTaxonomy(raw: UnknownRecord, legacy: GenreId): BandTaxonomyV2 {
  const taxonomyRaw = isRecord(raw.taxonomyV2) ? raw.taxonomyV2 : isRecord(raw.taxonomy) ? raw.taxonomy : {}
  const primaryGenreId = resolveGenreId(taxonomyRaw.primaryGenreId ?? taxonomyRaw.primaryGenre ?? raw.primaryGenreId ?? raw.genre) ?? taxonomyByLegacy[legacy]
  const secondaryGenreIds = stringList(taxonomyRaw.secondaryGenreIds ?? taxonomyRaw.secondaryGenres ?? raw.secondaryGenreIds ?? raw.secondaryGenres)
    .flatMap((value) => {
      const id = resolveGenreId(value)
      return id && id !== primaryGenreId ? [id] : []
    })
  const requestedSubgenres = stringList(taxonomyRaw.subgenreIds ?? taxonomyRaw.subgenres ?? raw.subgenreIds ?? raw.subgenres)
    .flatMap((value) => {
      const id = resolveSubgenreId(value)
      return id ? [id] : []
    })
  const moodScores: Partial<Record<MoodId, MoodScore>> = {}
  const moodRaw = isRecord(taxonomyRaw.moodScores) ? taxonomyRaw.moodScores : isRecord(taxonomyRaw.moods) ? taxonomyRaw.moods : isRecord(raw.moodScores) ? raw.moodScores : isRecord(raw.moods) ? raw.moods : {}
  Object.entries(moodRaw).forEach(([label, value]) => {
    const id = resolveMoodId(label)
    const score = Math.round(number(value))
    if (id && score >= 1 && score <= 5) moodScores[id] = score as MoodScore
  })
  return {
    primaryGenreId,
    secondaryGenreIds: [...new Set(secondaryGenreIds)],
    subgenreIds: [...new Set(requestedSubgenres)],
    moodScores,
    reviewStatus: 'draft',
    reviewNote: '외부 조사 JSON에서 가져온 분류 초안 · 운영자 검수 필요',
  }
}

function normalizeBand(value: unknown, index: number): Band | null {
  if (!isRecord(value)) return null
  const name = text(value.name ?? value.bandName ?? value.artist)
  const formedValue = number(value.formed ?? value.yearFormed ?? value.formedYear)
  const formed = Number.isInteger(formedValue) && formedValue >= 1900 && formedValue <= new Date().getFullYear() ? formedValue : 0
  const requestedLegacy = text(value.primaryGenre) as GenreId
  const taxonomyInput = isRecord(value.taxonomyV2) ? value.taxonomyV2 : isRecord(value.taxonomy) ? value.taxonomy : {}
  const requestedTaxonomy = resolveGenreId(taxonomyInput.primaryGenreId ?? taxonomyInput.primaryGenre ?? value.primaryGenreId ?? value.genre)
  const legacy = legacyGenreIds.includes(requestedLegacy) ? requestedLegacy : requestedTaxonomy ? legacyByTaxonomy[requestedTaxonomy] : 'classic-rock'
  const taxonomyV2 = normalizeTaxonomy(value, legacy)
  const taxonomySubgenreNames = taxonomyV2.subgenreIds.map((id) => taxonomySubgenres.find((item) => item.id === id)?.name).filter((item): item is string => Boolean(item))
  // Use only the resolved official (Korean) subgenre names here — mixing in Gemini's raw input duplicated every
  // subgenre as an English/Korean pair whenever the raw value didn't exactly match the canonical name.
  const subgenres = [...new Set(taxonomySubgenreNames)]
  const id = slugify(text(value.id) || name) || `intake-band-${Date.now()}-${index}`
  const imageRaw = isRecord(value.image) ? value.image : {}
  const creditRaw = isRecord(imageRaw.credit) ? imageRaw.credit : {}
  const sources = normalizeSources(value.sources, name || id, value)
  return {
    id,
    name,
    formed,
    origin: text(value.origin ?? value.city),
    countryCode: text(value.countryCode ?? value.country_code ?? value.country).toUpperCase(),
    activeYears: text(value.activeYears ?? value.active_years) || (formed ? `${formed}–현재` : ''),
    primaryGenre: legacy,
    genreIds: [legacy],
    subgenres,
    eraTags: [{ era: eraFromYear(formed), genreIds: [legacy], subgenres }],
    tags: stringList(value.tags),
    summary: textProse(value.summary ?? value.achievementSummary ?? value.introduction),
    style: textProse(value.style ?? value.soundDescription ?? value.musicDescription),
    image: {
      wikipediaTitle: text(imageRaw.wikipediaTitle) || name,
      fileName: text(imageRaw.fileName) || undefined,
      displayUrl: textUrl(imageRaw.displayUrl ?? value.imageUrl) || undefined,
      originalUrl: textUrl(imageRaw.originalUrl) || undefined,
      alt: text(imageRaw.alt) || `${name} 밴드 사진`,
      credit: {
        sourceUrl: textUrl(creditRaw.sourceUrl) || text(imageRaw.commonsFile ?? imageRaw.commons_file),
        creator: text(creditRaw.creator) || undefined,
        license: text(creditRaw.license) || '검토 필요',
        licenseUrl: textUrl(creditRaw.licenseUrl) || undefined,
        reviewStatus: 'needs-review',
      },
    },
    members: normalizeMembers(value.members),
    tracks: normalizeTracks(value.tracks ?? value.representativeTracks, name),
    relations: normalizeRelations(value.relations),
    sources,
    taxonomyV2,
    reviewStatus: 'draft',
  }
}

function unwrapBands(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  if (Array.isArray(payload.bands)) return payload.bands
  if (isRecord(payload.data) && Array.isArray(payload.data.bands)) return payload.data.bands
  if (payload.name || payload.bandName || payload.artist) return [payload]
  return []
}

export interface YoutubeCheckResult {
  ok: boolean
  title?: string
  authorName?: string
  reason?: 'format' | 'unavailable' | 'mismatch' | 'network'
  error?: string
}

const normalizeVideoMatchText = (value: string) => value
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9가-힣]+/g, '')

const videoMatchesExpected = (actual: string, expected: string) => {
  const actualKey = normalizeVideoMatchText(actual)
  const expectedKey = normalizeVideoMatchText(expected)
  return Boolean(expectedKey && actualKey.includes(expectedKey))
}

const youtubeSearchUrl = (bandName: string, trackTitle: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${bandName} ${trackTitle}`)}`

const commonsSearchUrl = (bandName: string) =>
  `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(bandName)}&title=Special:MediaSearch&type=image`

/** Confirms a YouTube video exists and that its oEmbed title/author match the requested band and track. */
export async function checkYoutubeVideo(id: string, expected?: { bandName: string; trackTitle: string }): Promise<YoutubeCheckResult> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return { ok: false, reason: 'format', error: '유효한 YouTube ID 형식이 아닙니다.' }
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`)
    if (!response.ok) return { ok: false, reason: 'unavailable', error: '영상을 찾을 수 없거나 공개 상태가 아닙니다.' }
    const data = (await response.json()) as { title?: unknown; author_name?: unknown }
    const title = typeof data.title === 'string' ? data.title : undefined
    const authorName = typeof data.author_name === 'string' ? data.author_name : undefined
    if (expected && (!title || !videoMatchesExpected(title, expected.trackTitle) || !videoMatchesExpected(`${title} ${authorName ?? ''}`, expected.bandName))) {
      return {
        ok: false,
        reason: 'mismatch',
        title,
        authorName,
        error: `영상 제목·채널이 "${expected.bandName} — ${expected.trackTitle}"과 일치하지 않습니다${title ? ` (확인된 제목: ${title})` : ''}.`,
      }
    }
    return { ok: true, title, authorName }
  } catch {
    return { ok: false, reason: 'network', error: 'YouTube 확인 중 네트워크 오류가 발생했습니다.' }
  }
}

export interface CommonsLookupResult {
  ok: boolean
  fileName?: string
  originalUrl?: string
  displayUrl?: string
  creator?: string
  license?: string
  licenseUrl?: string
  sourceUrl?: string
  error?: string
}

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

type CommonsImageInfo = { url?: string; thumburl?: string; extmetadata?: Record<string, { value?: unknown }> }

async function fetchCommonsImageInfo(title: string): Promise<CommonsImageInfo | null> {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${title}`)}&prop=imageinfo&iiprop=extmetadata%7Curl&iiurlwidth=800&format=json&origin=*`
  const response = await fetch(apiUrl)
  if (!response.ok) return null
  const data = await response.json() as { query?: { pages?: Record<string, { missing?: unknown; imageinfo?: CommonsImageInfo[] }> } }
  const page = Object.values(data.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!page || page.missing !== undefined || !info) return null
  return info
}

/** Gemini often guesses a close-but-not-exact filename (wrong dashes, spacing, date order); fall back to a Commons file search before giving up. */
async function searchCommonsFileTitle(query: string): Promise<string | null> {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap|drawing`)}&gsrnamespace=6&gsrlimit=1&format=json&origin=*`
  const response = await fetch(searchUrl)
  if (!response.ok) return null
  const data = await response.json() as { query?: { pages?: Record<string, { title?: string }> } }
  const hit = Object.values(data.query?.pages ?? {})[0]?.title
  return hit ? hit.replace(/^File:/i, '') : null
}

const normalizeForMatch = (value: string) => value.toLocaleLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣]+/g, '')

export interface IdentifierCheckResult {
  ok: boolean
  label?: string
  error?: string
}

/** Confirms a Wikidata QID actually exists and its label/aliases plausibly name this band. Gemini frequently cites
 *  a syntactically valid but completely unrelated QID (a building, a category page, a random article) as if it had
 *  verified it — this catches that instead of trusting the string at face value. */
export async function checkWikidataEntity(qid: string, bandName: string): Promise<IdentifierCheckResult> {
  if (!/^Q\d+$/.test(qid)) return { ok: false, error: '유효한 Wikidata ID 형식이 아닙니다.' }
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels%7Caliases&languages=en%7Cko&format=json&origin=*`
    const response = await fetch(url)
    if (!response.ok) return { ok: false, error: 'Wikidata 조회에 실패했습니다.' }
    const data = await response.json() as {
      entities?: Record<string, {
        missing?: unknown
        labels?: Record<string, { value?: string }>
        aliases?: Record<string, Array<{ value?: string }>>
      }>
    }
    const entity = data.entities?.[qid]
    if (!entity || entity.missing !== undefined) return { ok: false, error: `Wikidata에 ${qid} 항목이 존재하지 않습니다.` }
    const candidates = [
      entity.labels?.en?.value,
      entity.labels?.ko?.value,
      ...(entity.aliases?.en ?? []).map((item) => item.value),
      ...(entity.aliases?.ko ?? []).map((item) => item.value),
    ].filter((value): value is string => Boolean(value))
    const matches = candidates.some((label) => normalizeForMatch(label).includes(normalizeForMatch(bandName)) || normalizeForMatch(bandName).includes(normalizeForMatch(label)))
    if (!matches) return { ok: false, label: candidates[0], error: `${qid}은(는) "${candidates[0] ?? '알 수 없음'}" 항목이라 밴드 이름과 관련 없어 보입니다.` }
    return { ok: true, label: candidates[0] }
  } catch {
    return { ok: false, error: 'Wikidata 조회 중 네트워크 오류가 발생했습니다.' }
  }
}

/** Confirms a MusicBrainz artist MBID actually resolves and its name plausibly matches this band. Gemini frequently
 *  fabricates a syntactically valid UUID that doesn't correspond to any real MusicBrainz artist at all. */
export async function checkMusicBrainzArtist(mbid: string, bandName: string): Promise<IdentifierCheckResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mbid)) return { ok: false, error: '유효한 MusicBrainz ID 형식이 아닙니다.' }
  try {
    const response = await fetch(`https://musicbrainz.org/ws/2/artist/${mbid}?fmt=json`, { headers: { 'User-Agent': 'RockAtlasIntake/0.1 (contact: studio-operator)' } })
    if (response.status === 404) return { ok: false, error: `MusicBrainz에 ${mbid} 아티스트가 존재하지 않습니다.` }
    if (!response.ok) return { ok: false, error: 'MusicBrainz 조회에 실패했습니다.' }
    const data = await response.json() as { name?: string }
    if (!data.name) return { ok: false, error: 'MusicBrainz 응답에서 이름을 찾지 못했습니다.' }
    const matches = normalizeForMatch(data.name).includes(normalizeForMatch(bandName)) || normalizeForMatch(bandName).includes(normalizeForMatch(data.name))
    if (!matches) return { ok: false, label: data.name, error: `${mbid}은(는) "${data.name}" 아티스트라 밴드 이름과 관련 없어 보입니다.` }
    return { ok: true, label: data.name }
  } catch {
    return { ok: false, error: 'MusicBrainz 조회 중 네트워크 오류가 발생했습니다.' }
  }
}

const wikidataSearchUrl = (bandName: string) =>
  `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(bandName)}&title=Special:Search`

const musicBrainzSearchUrl = (bandName: string) =>
  `https://musicbrainz.org/search?query=${encodeURIComponent(bandName)}&type=artist`

/** Pulls the real file URL, creator and license straight from the Wikimedia Commons API, so operators never have to type rights fields by hand.
 *  `bandName`, when given, gates the result: a license lookup only confirms the file's rights are real, never that the photo is actually of this band — so if the resolved title doesn't even contain the band's name, we refuse rather than silently attaching an unrelated photo. */
export async function lookupCommonsImage(input: string, bandName?: string): Promise<CommonsLookupResult> {
  const raw = stripMarkdownToUrl(input).trim()
  if (!raw) return { ok: false, error: '이미지 파일명 또는 Commons 주소가 없습니다.' }
  const fileMatch = /File:([^?#]+)/i.exec(raw)
  const requestedTitle = decodeURIComponent(fileMatch ? fileMatch[1] : raw.replace(/^File:/i, '')).replace(/_/g, ' ')
  try {
    let title = requestedTitle
    let info = await fetchCommonsImageInfo(title)
    if (!info) {
      const searchHit = await searchCommonsFileTitle(requestedTitle)
      if (searchHit) { title = searchHit; info = await fetchCommonsImageInfo(title) }
    }
    // The requested title is often Gemini's fabricated filename, which can miss real Commons photos entirely
    // if its wording doesn't overlap with any real file title. A plain search on just the band name is a
    // meaningfully different query and catches a fair number of cases the first search missed.
    if (!info && bandName && normalizeForMatch(requestedTitle) !== normalizeForMatch(bandName)) {
      const searchHit = await searchCommonsFileTitle(bandName)
      if (searchHit) { title = searchHit; info = await fetchCommonsImageInfo(title) }
    }
    if (!info) return { ok: false, error: `Commons에서 "${requestedTitle}" 파일을 찾지 못했습니다.` }
    if (bandName && !normalizeForMatch(title).includes(normalizeForMatch(bandName))) {
      return { ok: false, error: `찾은 파일("${title}")이 밴드 이름과 관련 없어 보여 자동 확인을 중단했습니다. 사진이 맞는지 직접 확인해주세요.` }
    }
    const meta = info.extmetadata ?? {}
    const metaText = (key: string) => { const value = meta[key]?.value; return typeof value === 'string' ? stripHtml(value) : undefined }
    const creator = metaText('Artist')
    const licenseShort = metaText('LicenseShortName')
    const licenseUrl = metaText('LicenseUrl')
    const usageTerms = metaText('UsageTerms')
    const licenseLabel = licenseShort || usageTerms
    const isPublicDomain = /public domain|pd-/i.test(licenseLabel ?? '')
    const fileName = `File:${title}`
    return {
      ok: true,
      fileName,
      originalUrl: info.url,
      displayUrl: info.thumburl ?? info.url,
      creator,
      license: isPublicDomain ? 'Public domain' : licenseLabel,
      licenseUrl: isPublicDomain ? undefined : licenseUrl,
      sourceUrl: `https://commons.wikimedia.org/wiki/${fileName}`,
    }
  } catch {
    return { ok: false, error: 'Commons 조회 중 네트워크 오류가 발생했습니다.' }
  }
}

/** Gemini routinely writes plain quote marks around a nickname or quoted phrase inside a JSON string
 *  value (e.g. "James "Munky" Shaffer") instead of escaping them, which is invalid JSON — the parser
 *  reads the string as ending at the first inner quote and chokes on what follows.
 *
 *  Walks the text tracking whether we're inside a string, and for each quote encountered mid-string,
 *  looks ahead (past whitespace) to see whether it's followed by a real JSON delimiter (`,` `}` `]` `:`
 *  or end of input). If so it's a legitimate closing quote; if not, it's a literal quote that needs
 *  escaping, so it's rewritten as `\"` and the string is treated as continuing. */
function repairUnescapedQuotes(text: string): string {
  let result = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (!inString) {
      result += ch
      if (ch === '"') inString = true
      continue
    }
    if (ch === '\\') {
      result += ch + (text[i + 1] ?? '')
      i += 1
      continue
    }
    if (ch === '"') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j += 1
      const next = text[j]
      let isRealTerminator = next === undefined || ':}]'.includes(next)
      if (next === ',') {
        let afterComma = j + 1
        while (afterComma < text.length && /\s/.test(text[afterComma])) afterComma += 1
        const remainder = text.slice(afterComma)
        isRealTerminator = remainder.startsWith('"')
          || remainder.startsWith('{')
          || remainder.startsWith('[')
          || remainder.startsWith(']')
          || remainder.startsWith('}')
          || /^-?\d/.test(remainder)
          || /^(?:true|false|null)(?:\s*[,}\]])/.test(remainder)
      }
      if (isRealTerminator) {
        result += ch
        inString = false
      } else {
        result += '\\"'
      }
      continue
    }
    result += ch
  }
  return result
}

function parseLeniently(text: string): unknown {
  try { return JSON.parse(text) } catch { /* fall through to the quote repair below */ }
  return JSON.parse(repairUnescapedQuotes(text))
}

export function extractJson(textValue: string): unknown {
  const trimmed = textValue.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return parseLeniently(trimmed) } catch { /* try to recover JSON from surrounding prose */ }
  const objectStart = trimmed.indexOf('{')
  const arrayStart = trimmed.indexOf('[')
  const start = [objectStart, arrayStart].filter((item) => item >= 0).sort((a, b) => a - b)[0]
  const objectEnd = trimmed.lastIndexOf('}')
  const arrayEnd = trimmed.lastIndexOf(']')
  const end = Math.max(objectEnd, arrayEnd)
  if (start === undefined || end <= start) throw new Error('JSON 부분을 찾지 못했습니다. Gemini 답변 전체를 그대로 붙여넣어도 됩니다.')
  return parseLeniently(trimmed.slice(start, end + 1))
}

/** Warning codes that are fine for a plain draft but must be resolved before the auto-checker will elevate a band straight to 'published'. */
const reviewBlockingCodes = new Set([
  'short-summary', 'short-style', 'no-wikidata', 'no-musicbrainz', 'no-wikipedia', 'no-members',
  'no-official-channel', 'image-lookup-failed', 'no-image', 'youtube-unreachable', 'youtube-fallback',
  'english-tags', 'english-roles', 'wikidata-mismatch', 'musicbrainz-mismatch',
])

export async function inspectBandIntake(rawText: string, existingBands: Band[]): Promise<IntakeResult> {
  const globalIssues: IntakeIssue[] = []
  let payload: unknown
  try { payload = extractJson(rawText) } catch (error) {
    return { candidates: [], globalIssues: [{ severity: 'error', code: 'invalid-json', message: error instanceof Error ? error.message : 'JSON을 읽지 못했습니다.' }] }
  }
  const rawBands = unwrapBands(payload)
  if (!rawBands.length) return { candidates: [], globalIssues: [{ severity: 'error', code: 'no-bands', message: '밴드 목록을 찾지 못했습니다. bands 배열 또는 밴드 객체가 필요합니다.' }] }
  if (rawBands.length > 100) return { candidates: [], globalIssues: [{ severity: 'error', code: 'too-many', message: '한 번에 최대 100개까지 검수할 수 있습니다.' }] }

  const normalized = rawBands.map(normalizeBand)
  const incomingIds = new Set(normalized.filter((item): item is Band => Boolean(item)).map((item) => item.id))
  const knownIds = new Set([...existingBands.map((item) => item.id), ...incomingIds])
  const existingNames = new Set(existingBands.map((item) => item.name.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, '')))
  const existingExternalIds = new Set(existingBands.flatMap((item) => item.sources.map((source) => source.externalId).filter(Boolean)))
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const seenExternalIds = new Set<string>()

  const candidates = normalized.flatMap((band, index): IntakeCandidate[] => {
    if (!band) return [{ key: `invalid-${index}`, band: normalizeBand({ name: '' }, index) as Band, issues: [{ severity: 'error', code: 'invalid-band', message: `${index + 1}번째 항목은 밴드 객체가 아닙니다.` }], canApprove: false }]
    const issues: IntakeIssue[] = []
    const nameKey = band.name.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, '')
    if (!band.name) issues.push({ severity: 'error', code: 'missing-name', message: '밴드 이름이 없습니다.' })
    if (!Number.isInteger(band.formed) || band.formed < 1900 || band.formed > new Date().getFullYear()) issues.push({ severity: 'error', code: 'formed', message: '결성 연도가 없거나 올바르지 않습니다.' })
    if (!band.origin) issues.push({ severity: 'error', code: 'missing-origin', message: '결성지가 없습니다.' })
    if (!/^[A-Z]{2}$/.test(band.countryCode)) issues.push({ severity: 'error', code: 'country-code', message: '국가 코드는 GB, US처럼 영문 2자로 입력해야 합니다.' })
    if (existingBands.some((item) => item.id === band.id) || seenIds.has(band.id)) issues.push({ severity: 'error', code: 'duplicate-id', message: `이미 사용 중인 ID입니다: ${band.id}` })
    if ((nameKey && existingNames.has(nameKey)) || seenNames.has(nameKey)) issues.push({ severity: 'error', code: 'duplicate-name', message: `이미 등록됐거나 이번 묶음 안에서 중복된 이름입니다: ${band.name}` })
    const duplicateExternal = band.sources.find((source) => source.externalId && (existingExternalIds.has(source.externalId) || seenExternalIds.has(source.externalId)))
    if (duplicateExternal) issues.push({ severity: 'error', code: 'duplicate-external-id', message: `${duplicateExternal.publisher} 식별자가 기존 밴드와 중복됩니다.` })
    const wikidataId = band.sources.find((source) => source.publisher === 'Wikidata')?.externalId
    const musicBrainzId = band.sources.find((source) => source.publisher === 'MusicBrainz')?.externalId
    if (wikidataId && !/^Q\d+$/.test(wikidataId)) issues.push({ severity: 'error', code: 'wikidata-format', message: 'Wikidata ID는 Q 뒤에 숫자가 오는 형식이어야 합니다.' })
    if (musicBrainzId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(musicBrainzId)) issues.push({ severity: 'error', code: 'musicbrainz-format', message: 'MusicBrainz ID가 UUID 형식이 아닙니다.' })
    const original = isRecord(rawBands[index]) ? rawBands[index] : {}
    const originalTaxonomy = isRecord(original.taxonomyV2) ? original.taxonomyV2 : isRecord(original.taxonomy) ? original.taxonomy : {}
    const requestedPrimary = originalTaxonomy.primaryGenreId ?? originalTaxonomy.primaryGenre ?? original.primaryGenreId ?? original.genre
    const requestedLegacy = text(original.primaryGenre)
    if (!resolveGenreId(requestedPrimary) && !legacyGenreIds.includes(requestedLegacy as GenreId)) issues.push({ severity: 'error', code: 'missing-primary-genre', message: '허용된 대표 장르가 없습니다. 자동 오분류를 막기 위해 추가를 중단했습니다.' })
    const invalidSecondary = stringList(originalTaxonomy.secondaryGenreIds ?? originalTaxonomy.secondaryGenres ?? original.secondaryGenreIds ?? original.secondaryGenres).filter((value) => !resolveGenreId(value))
    const invalidSubgenres = stringList(originalTaxonomy.subgenreIds ?? originalTaxonomy.subgenres ?? original.subgenreIds ?? original.subgenres).filter((value) => !resolveSubgenreId(value))
    const originalMoods = isRecord(originalTaxonomy.moodScores) ? originalTaxonomy.moodScores : isRecord(originalTaxonomy.moods) ? originalTaxonomy.moods : isRecord(original.moodScores) ? original.moodScores : isRecord(original.moods) ? original.moods : {}
    const invalidMoods = Object.entries(originalMoods).filter(([label, value]) => !resolveMoodId(label) || !Number.isInteger(number(value)) || number(value) < 1 || number(value) > 5).map(([id]) => id)
    const remappedMoods = Object.keys(originalMoods).flatMap((label) => {
      const moodId = resolveMoodId(label)
      return moodId && !canonicalMoodKeys.has(normalizeTaxonomyLabel(label))
        ? [`${label} → ${moodId} (${taxonomyMoods.find((mood) => mood.id === moodId)?.name})`]
        : []
    })
    if (invalidSecondary.length) issues.push({ severity: 'warning', code: 'invalid-secondary-genres', message: `허용되지 않는 보조 장르를 자동 제외했습니다: ${invalidSecondary.join(', ')}` })
    if (invalidSubgenres.length) issues.push({ severity: 'warning', code: 'invalid-subgenres', message: `허용되지 않는 세부 장르를 자동 제외했습니다: ${invalidSubgenres.join(', ')}` })
    if (invalidMoods.length) issues.push({ severity: 'warning', code: 'invalid-moods', message: `허용되지 않는 분위기 ID 또는 점수를 자동 제외했습니다: ${invalidMoods.join(', ')}` })
    if (remappedMoods.length) issues.push({ severity: 'info', code: 'remapped-moods', message: `같은 뜻의 분위기 표현을 정식 항목으로 바꿨습니다: ${remappedMoods.join(', ')}` })
    const removedRelations = band.relations.filter((relation) => !knownIds.has(relation.targetBandId) || relation.targetBandId === band.id)
    if (removedRelations.length) {
      band.relations = band.relations.filter((relation) => knownIds.has(relation.targetBandId) && relation.targetBandId !== band.id)
      issues.push({ severity: 'warning', code: 'removed-relations', message: `아직 카탈로그에 없는 밴드를 가리키는 관계를 자동 제외했습니다: ${removedRelations.map((relation) => relation.targetBandId).join(', ')} (해당 밴드를 먼저 추가하면 이후 검사에서 자동으로 연결됩니다)` })
    }
    if (band.summary.length < 30) issues.push({ severity: 'warning', code: 'short-summary', message: '업적·발자취 소개가 짧습니다. 30자 이상을 권장합니다.' })
    if (band.style.length < 40) issues.push({ severity: 'warning', code: 'short-style', message: '음악 설명이 짧습니다. 소리와 구성을 40자 이상 적는 것을 권장합니다.' })
    if (!band.taxonomyV2?.subgenreIds.length) issues.push({ severity: 'warning', code: 'no-subgenres', message: 'v2 세부 장르가 없어 대표 장르만 적용됩니다.' })
    if (!Object.keys(band.taxonomyV2?.moodScores ?? {}).length) issues.push({ severity: 'warning', code: 'no-moods', message: '분위기 점수가 없어 분위기로 찾기 결과에 잘 나타나지 않습니다.' })
    if (!band.sources.some((source) => source.publisher === 'Wikidata' && source.externalId)) issues.push({ severity: 'warning', code: 'no-wikidata', message: 'Wikidata ID가 없습니다.' })
    if (!band.sources.some((source) => source.publisher === 'MusicBrainz' && source.externalId)) issues.push({ severity: 'warning', code: 'no-musicbrainz', message: 'MusicBrainz ID가 없습니다.' })
    if (!band.sources.some((source) => source.publisher === 'Wikipedia' && source.url)) issues.push({ severity: 'warning', code: 'no-wikipedia', message: 'Wikipedia 출처가 없습니다.' })
    const isPlainEnglish = (value: string) => /^[A-Za-z][A-Za-z0-9\s.,'&-]*$/.test(value.trim())
    const englishTags = band.tags.filter(isPlainEnglish)
    if (englishTags.length) issues.push({ severity: 'warning', code: 'english-tags', message: `태그가 영어로 남아있습니다. 한국어로 직접 고쳐주세요: ${englishTags.join(', ')}` })
    const englishRoleMembers = band.members.filter((member) => isPlainEnglish(member.role)).map((member) => member.name)
    if (englishRoleMembers.length) issues.push({ severity: 'warning', code: 'english-roles', message: `멤버 역할이 영어로 남아있습니다. 한국어로 직접 고쳐주세요: ${englishRoleMembers.join(', ')}` })
    if (!band.members.length) issues.push({ severity: 'warning', code: 'no-members', message: '멤버 정보가 없습니다.' })
    if (!band.sources.some((source) => source.publisher === 'YouTube' && source.official)) issues.push({ severity: 'warning', code: 'no-official-channel', message: '공식 YouTube 채널 링크가 없습니다. JSON에 youtubeChannelUrl을 포함하면 자동으로 채워집니다.' })
    if (!band.image.credit.sourceUrl) issues.push({ severity: 'warning', code: 'no-image', message: '밴드 사진이 없습니다. JSON의 image.commonsFile에 Commons 파일명을 넣으면 자동으로 채워집니다.' })
    seenIds.add(band.id)
    if (nameKey) seenNames.add(nameKey)
    band.sources.forEach((source) => { if (source.externalId) seenExternalIds.add(source.externalId) })
    return [{ key: `${band.id}-${index}`, band, issues, canApprove: !issues.some((item) => item.severity === 'error') }]
  })

  await Promise.all(candidates.map((candidate) => enrichCandidate(candidate)))
  return { candidates, globalIssues }
}

/** Runs the network-backed auto-verification (YouTube existence, Commons rights lookup) and elevates a band straight to 'published' once every automatable check is clean. */
async function enrichCandidate(candidate: IntakeCandidate): Promise<void> {
  if (!candidate.canApprove) return
  const band = candidate.band

  await Promise.all(band.tracks.map(async (track, index) => {
    const check = await checkYoutubeVideo(track.youtubeId, { bandName: band.name, trackTitle: track.title })
    if (!check.ok) {
      if (check.reason === 'network') {
        candidate.issues.push({ severity: 'warning', code: 'youtube-unreachable', message: `${track.title || `트랙 ${index + 1}`}: ${check.error} 원래 링크를 보존했으며 나중에 다시 검사해야 합니다.` })
      } else {
        band.tracks[index] = {
          ...track,
          youtubeId: '',
          source: {
            ...track.source,
            label: `${band.name} — ${track.title} YouTube 검색`,
            url: youtubeSearchUrl(band.name, track.title),
            official: false,
            note: '직접 영상 링크가 자동 검사를 통과하지 못해 정확한 밴드명·곡명 검색 링크로 대체했습니다.',
          },
          reviewStatus: 'draft',
          reviewedBy: undefined,
          reviewedAt: undefined,
        }
        candidate.issues.push({ severity: 'warning', code: 'youtube-fallback', message: `${track.title || `트랙 ${index + 1}`}: ${check.error} 깨진 직접 링크 대신 정확한 밴드명·곡명의 YouTube 검색 링크로 바꿨습니다.` })
      }
    } else {
      band.tracks[index] = { ...track, reviewStatus: 'reviewed', reviewedBy: '자동 검수 (AI)', reviewedAt: new Date().toISOString() }
      candidate.issues.push({ severity: 'info', code: 'youtube-verified', message: `${track.title}: YouTube 영상·곡명·아티스트 확인 완료${check.title ? ` (${check.title})` : ''}` })
    }
  }))

  const imageHint = band.image.credit.sourceUrl
  if (imageHint) {
    const lookup = await lookupCommonsImage(imageHint, band.name)
    const usable = lookup.ok && lookup.originalUrl && lookup.sourceUrl && lookup.license && (lookup.license === 'Public domain' || lookup.licenseUrl)
    if (usable) {
      band.image = {
        ...band.image,
        fileName: lookup.fileName,
        originalUrl: lookup.originalUrl,
        displayUrl: lookup.displayUrl ?? lookup.originalUrl,
        credit: {
          sourceUrl: lookup.sourceUrl!,
          creator: lookup.creator,
          license: lookup.license!,
          licenseUrl: lookup.licenseUrl,
          reviewStatus: 'verified',
          reviewedAt: new Date().toISOString(),
        },
      }
      if (!band.sources.some((source) => source.publisher === 'Wikimedia Commons' && source.url === lookup.sourceUrl)) {
        band.sources = [...band.sources, { label: `${band.name} — Wikimedia Commons`, url: lookup.sourceUrl!, publisher: 'Wikimedia Commons', note: 'Commons API로 자동 확인한 이미지 출처' }]
      }
      candidate.issues.push({ severity: 'info', code: 'image-verified', message: `이미지 라이선스를 Commons에서 자동 확인했습니다: ${lookup.license}` })
    } else {
      // Gemini가 지어낸 파일명(존재하지 않는 File:...)이 그대로 sourceUrl에 남으면 실제 사진처럼 보이는 허위 참조가 된다.
      // YouTube 검색 링크 대체와 동일하게, 검증 실패 시 사람이 직접 찾아볼 수 있는 Commons 검색 링크로 바꿔치기한다.
      band.image = {
        ...band.image,
        fileName: undefined,
        originalUrl: undefined,
        displayUrl: undefined,
        credit: {
          sourceUrl: commonsSearchUrl(band.name),
          creator: undefined,
          license: '검토 필요',
          licenseUrl: undefined,
          reviewStatus: 'needs-review',
        },
      }
      candidate.issues.push({ severity: 'warning', code: 'image-lookup-failed', message: `이미지 자동 확인 실패: ${lookup.error ?? '라이선스 정보가 불완전합니다'} — 존재하지 않을 수 있는 파일명 대신 Commons 검색 링크로 대체했습니다. 실제 사진은 수동으로 찾아 넣어야 합니다.` })
    }
  }

  const wikidataSource = band.sources.find((source) => source.publisher === 'Wikidata' && source.externalId)
  if (wikidataSource?.externalId) {
    const check = await checkWikidataEntity(wikidataSource.externalId, band.name)
    if (!check.ok) {
      // Gemini는 형식만 맞는 엉뚱한 QID(관련 없는 건물·카테고리 문서 등)를 실제로 확인한 것처럼 적어 내는 경우가 흔하다.
      // 잘못된 ID를 그대로 두면 사이트에서 방문자가 클릭했을 때 엉뚱한 페이지로 연결되고, 다른 밴드의 진짜 ID와 충돌할 수도 있다.
      band.sources = band.sources.map((source) => source === wikidataSource
        ? { label: `${band.name} — Wikidata`, url: wikidataSearchUrl(band.name), publisher: 'Wikidata', note: '자동 검사 실패로 검색 링크로 대체함 · 운영자 확인 필요' }
        : source)
      candidate.issues.push({ severity: 'warning', code: 'wikidata-mismatch', message: `Wikidata 확인 실패: ${check.error} 검색 링크로 대체했습니다.` })
    } else {
      candidate.issues.push({ severity: 'info', code: 'wikidata-verified', message: `Wikidata 항목을 확인했습니다: ${check.label}` })
    }
  }

  const musicBrainzSource = band.sources.find((source) => source.publisher === 'MusicBrainz' && source.externalId)
  if (musicBrainzSource?.externalId) {
    const check = await checkMusicBrainzArtist(musicBrainzSource.externalId, band.name)
    if (!check.ok) {
      band.sources = band.sources.map((source) => source === musicBrainzSource
        ? { label: `${band.name} — MusicBrainz`, url: musicBrainzSearchUrl(band.name), publisher: 'MusicBrainz', note: '자동 검사 실패로 검색 링크로 대체함 · 운영자 확인 필요' }
        : source)
      candidate.issues.push({ severity: 'warning', code: 'musicbrainz-mismatch', message: `MusicBrainz 확인 실패: ${check.error} 검색 링크로 대체했습니다.` })
    } else {
      candidate.issues.push({ severity: 'info', code: 'musicbrainz-verified', message: `MusicBrainz 아티스트를 확인했습니다: ${check.label}` })
    }
  }

  const hasError = candidate.issues.some((issue) => issue.severity === 'error')
  const hasBlockingWarning = candidate.issues.some((issue) => issue.severity === 'warning' && reviewBlockingCodes.has(issue.code))
  candidate.canApprove = !hasError
  if (!hasError && !hasBlockingWarning) {
    band.reviewStatus = 'published'
    band.reviewedBy = '자동 검수 (AI)'
    band.reviewedAt = new Date().toISOString()
    if (band.taxonomyV2) band.taxonomyV2 = { ...band.taxonomyV2, reviewStatus: 'reviewed' }
    candidate.issues.push({ severity: 'info', code: 'auto-reviewed', message: '자동 검사를 모두 통과해 공개 상태로 추가됩니다.' })
  }
}

/** Deep-clones a candidate right before it's merged into the catalog. Band review status is only ever 'draft' or
 *  'published' now, and intake's auto-verification is already the gate for reaching 'published' — no clamp needed. */
export function finalizeIntakeBand(band: Band): Band {
  return structuredClone(band)
}

export function buildGeminiResearchPrompt() {
  const genreIdsText = taxonomyGenres.map((genre) => genre.id).join(', ')
  const moodIdsText = taxonomyMoods.map((mood) => `${mood.id}=${mood.name}`).join(', ')
  return `ROCK ATLAS GEM 지침 v3. 사용자가 밴드 이름만 입력하면 웹에서 사실을 확인하고 아래 형식의 JSON만 출력한다. 인사·설명·마크다운·코드펜스는 금지하며 모르는 사실·ID·링크는 추측하지 말고 빈 값으로 둔다. 문자열 값 안에 큰따옴표가 들어가면(별명, 인용구 등) 반드시 \"처럼 이스케이프한다. 예: "James \"Munky\" Shaffer".\n\n고유명사와 URL을 제외한 설명·태그·멤버 역할·관계 근거는 한국어 평서체(~다/~이다)로 쓴다. 영어 역할은 리드 보컬·기타·베이스·드럼·키보드·백보컬처럼 번역한다.\n\n{"bands":[{"name":"","formed":0,"origin":"도시, 국가","countryCode":"ISO 2글자","activeYears":"","summary":"연도·성과·영향이 드러나는 한국어 2문장","style":"리듬·기타·보컬·프로덕션·곡 전개를 설명하는 한국어 2문장","tags":["한국어 3~6개"],"genre":"장르 ID 1개","secondaryGenres":["가까운 장르 ID만"],"subgenres":["실제 세부 장르명 2~5개"],"moods":{"분위기 ID":1},"members":[{"name":"","role":"한국어 역할","status":"current|former|touring","activeYears":""}],"representativeTracks":[{"title":"","year":0,"album":"","guide":"들을 지점을 설명하는 한국어 한 문장","url":"실제로 직접 연 YouTube watch URL, 확인 못 하면 빈 문자열"}],"relations":[{"targetBandName":"관련 밴드 영문명","kind":"sounds-like|influenced-by|influenced|shared-scene|evolution","strength":1,"note":"관계 근거 한국어 한 문장"}],"wikidataId":"Q숫자","musicBrainzId":"UUID","wikipediaUrl":"https://...","youtubeChannelUrl":"실제로 연 공식 채널 URL","image":{"commonsFile":"실제로 연 Wikimedia Commons File: 파일명, 확인 못 하면 빈 문자열"}}]}\n\n대표곡은 히트 싱글·차트 진입·스트리밍 조회수 등 대중적 인지도가 가장 높은 순서로 3곡, 핵심 현재·전 멤버만, 관계는 확실한 것 최대 3개만 쓴다. YouTube URL은 검색 결과 주소를 복사하지 말고 실제 영상을 연 뒤 곡명과 아티스트가 모두 맞는지 확인한다. 분위기는 대표곡 기준 3~6개를 1~5점으로 쓰고 아래 ID를 글자 하나도 번역·조합·변형하지 말고 그대로 복사한다. 장르도 아래 ID만 쓴다. 밴드가 여러 개면 bands 배열에 모두 넣는다.\n장르 ID: ${genreIdsText}\n분위기 ID=뜻: ${moodIdsText}`
}
