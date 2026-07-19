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
const genreIds = new Set(taxonomyGenres.map((item) => item.id))
const subgenreIds = new Set(taxonomySubgenres.map((item) => item.id))
const moodIds = new Set(taxonomyMoods.map((item) => item.id))

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
const slugify = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function eraFromYear(year: number): EraId {
  const candidate = `${Math.min(2020, Math.max(1960, Math.floor(year / 10) * 10))}s` as EraId
  return eraIds.includes(candidate) ? candidate : '2020s'
}

function youtubeId(value: unknown) {
  const input = text(value)
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
      const url = text(entry.url)
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
  const wikipediaUrl = text(raw.wikipediaUrl ?? raw.wikipedia_url)
  if (wikidataId && !sources.some((item) => item.publisher === 'Wikidata')) sources.push({ label: `${name} — Wikidata`, url: `https://www.wikidata.org/wiki/${wikidataId}`, publisher: 'Wikidata', externalId: wikidataId, note: '외부 조사에서 가져온 식별자 · 운영자 확인 필요' })
  if (musicBrainzId && !sources.some((item) => item.publisher === 'MusicBrainz')) sources.push({ label: `${name} — MusicBrainz`, url: `https://musicbrainz.org/artist/${musicBrainzId}`, publisher: 'MusicBrainz', externalId: musicBrainzId, note: '외부 조사에서 가져온 식별자 · 운영자 확인 필요' })
  if (wikipediaUrl && !sources.some((item) => item.publisher === 'Wikipedia')) sources.push({ label: `${name} — Wikipedia`, url: wikipediaUrl, publisher: 'Wikipedia', note: '외부 조사에서 가져온 출처 · 운영자 확인 필요' })
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
      guide: text(raw.guide ?? raw.description) || undefined,
      youtubeId: id,
      source: {
        label: `${name} — ${title}`,
        url: id ? `https://www.youtube.com/watch?v=${id}` : text(raw.url) || 'https://www.youtube.com/',
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
    const targetBandId = slugify(text(entry.targetBandId ?? entry.targetId))
    if (!targetBandId) return []
    const kind = relationKinds.includes(text(entry.kind) as RelationKind) ? text(entry.kind) as RelationKind : 'sounds-like'
    const rawStrength = Math.round(number(entry.strength))
    const strength = (rawStrength >= 1 && rawStrength <= 3 ? rawStrength : 1) as 1 | 2 | 3
    return [{ targetBandId, kind, strength, note: text(entry.note) || '외부 조사에서 제안된 관계 · 근거 확인 필요', reviewStatus: 'draft' }]
  })
}

function normalizeTaxonomy(raw: UnknownRecord, legacy: GenreId): BandTaxonomyV2 {
  const taxonomyRaw = isRecord(raw.taxonomyV2) ? raw.taxonomyV2 : isRecord(raw.taxonomy) ? raw.taxonomy : {}
  const requestedPrimary = text(taxonomyRaw.primaryGenreId ?? raw.primaryGenreId) as GenreTaxonomyId
  const primaryGenreId = genreIds.has(requestedPrimary) ? requestedPrimary : taxonomyByLegacy[legacy]
  const secondaryGenreIds = stringList(taxonomyRaw.secondaryGenreIds).filter((id): id is GenreTaxonomyId => genreIds.has(id as GenreTaxonomyId) && id !== primaryGenreId)
  const requestedSubgenres = stringList(taxonomyRaw.subgenreIds ?? raw.subgenreIds)
  const moodScores: Partial<Record<MoodId, MoodScore>> = {}
  const moodRaw = isRecord(taxonomyRaw.moodScores) ? taxonomyRaw.moodScores : isRecord(raw.moodScores) ? raw.moodScores : {}
  Object.entries(moodRaw).forEach(([id, value]) => {
    const score = Math.round(number(value))
    if (moodIds.has(id as MoodId) && score >= 1 && score <= 5) moodScores[id as MoodId] = score as MoodScore
  })
  return {
    primaryGenreId,
    secondaryGenreIds: [...new Set(secondaryGenreIds)],
    subgenreIds: [...new Set(requestedSubgenres.filter((id) => subgenreIds.has(id)))],
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
  const requestedTaxonomy = text((isRecord(value.taxonomyV2) ? value.taxonomyV2.primaryGenreId : value.primaryGenreId)) as GenreTaxonomyId
  const legacy = legacyGenreIds.includes(requestedLegacy) ? requestedLegacy : genreIds.has(requestedTaxonomy) ? legacyByTaxonomy[requestedTaxonomy] : 'classic-rock'
  const taxonomyV2 = normalizeTaxonomy(value, legacy)
  const taxonomySubgenreNames = taxonomyV2.subgenreIds.map((id) => taxonomySubgenres.find((item) => item.id === id)?.name).filter((item): item is string => Boolean(item))
  const subgenres = [...new Set([...stringList(value.subgenres), ...taxonomySubgenreNames])]
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
    summary: text(value.summary ?? value.achievementSummary ?? value.introduction),
    style: text(value.style ?? value.soundDescription ?? value.musicDescription),
    image: {
      wikipediaTitle: text(imageRaw.wikipediaTitle) || name,
      fileName: text(imageRaw.fileName) || undefined,
      displayUrl: text(imageRaw.displayUrl ?? value.imageUrl) || undefined,
      originalUrl: text(imageRaw.originalUrl) || undefined,
      alt: text(imageRaw.alt) || `${name} 밴드 사진`,
      credit: {
        sourceUrl: text(creditRaw.sourceUrl),
        creator: text(creditRaw.creator) || undefined,
        license: text(creditRaw.license) || '검토 필요',
        licenseUrl: text(creditRaw.licenseUrl) || undefined,
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

export function extractJson(textValue: string): unknown {
  const trimmed = textValue.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(trimmed) } catch { /* try to recover JSON from surrounding prose */ }
  const objectStart = trimmed.indexOf('{')
  const arrayStart = trimmed.indexOf('[')
  const start = [objectStart, arrayStart].filter((item) => item >= 0).sort((a, b) => a - b)[0]
  const objectEnd = trimmed.lastIndexOf('}')
  const arrayEnd = trimmed.lastIndexOf(']')
  const end = Math.max(objectEnd, arrayEnd)
  if (start === undefined || end <= start) throw new Error('JSON 부분을 찾지 못했습니다. Gemini 답변 전체를 그대로 붙여넣어도 됩니다.')
  return JSON.parse(trimmed.slice(start, end + 1))
}

export function inspectBandIntake(rawText: string, existingBands: Band[]): IntakeResult {
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
    const requestedPrimary = text(originalTaxonomy.primaryGenreId ?? original.primaryGenreId)
    const requestedLegacy = text(original.primaryGenre)
    if (!genreIds.has(requestedPrimary as GenreTaxonomyId) && !legacyGenreIds.includes(requestedLegacy as GenreId)) issues.push({ severity: 'error', code: 'missing-primary-genre', message: '허용된 대표 장르 ID가 없습니다. 자동 오분류를 막기 위해 추가를 중단했습니다.' })
    const invalidSecondary = stringList(originalTaxonomy.secondaryGenreIds).filter((id) => !genreIds.has(id as GenreTaxonomyId))
    const invalidSubgenres = stringList(originalTaxonomy.subgenreIds ?? original.subgenreIds).filter((id) => !subgenreIds.has(id))
    const originalMoods = isRecord(originalTaxonomy.moodScores) ? originalTaxonomy.moodScores : isRecord(original.moodScores) ? original.moodScores : {}
    const invalidMoods = Object.entries(originalMoods).filter(([id, value]) => !moodIds.has(id as MoodId) || !Number.isInteger(number(value)) || number(value) < 1 || number(value) > 5).map(([id]) => id)
    if (invalidSecondary.length) issues.push({ severity: 'warning', code: 'invalid-secondary-genres', message: `허용되지 않는 보조 장르를 자동 제외했습니다: ${invalidSecondary.join(', ')}` })
    if (invalidSubgenres.length) issues.push({ severity: 'warning', code: 'invalid-subgenres', message: `허용되지 않는 세부 장르를 자동 제외했습니다: ${invalidSubgenres.join(', ')}` })
    if (invalidMoods.length) issues.push({ severity: 'warning', code: 'invalid-moods', message: `허용되지 않는 분위기 ID 또는 점수를 자동 제외했습니다: ${invalidMoods.join(', ')}` })
    const removedRelations = band.relations.filter((relation) => !knownIds.has(relation.targetBandId) || relation.targetBandId === band.id)
    if (removedRelations.length) {
      band.relations = band.relations.filter((relation) => knownIds.has(relation.targetBandId) && relation.targetBandId !== band.id)
      issues.push({ severity: 'warning', code: 'removed-relations', message: `등록되지 않은 대상 또는 자기 관계 ${removedRelations.length}건을 자동 제외했습니다.` })
    }
    if (band.summary.length < 30) issues.push({ severity: 'warning', code: 'short-summary', message: '업적·발자취 소개가 짧습니다. 30자 이상을 권장합니다.' })
    if (band.style.length < 40) issues.push({ severity: 'warning', code: 'short-style', message: '음악 설명이 짧습니다. 소리와 구성을 40자 이상 적는 것을 권장합니다.' })
    if (!band.taxonomyV2?.subgenreIds.length) issues.push({ severity: 'warning', code: 'no-subgenres', message: 'v2 세부 장르가 없어 대표 장르만 적용됩니다.' })
    if (!Object.keys(band.taxonomyV2?.moodScores ?? {}).length) issues.push({ severity: 'warning', code: 'no-moods', message: '분위기 점수가 없어 분위기로 찾기 결과에 잘 나타나지 않습니다.' })
    if (!band.sources.some((source) => source.publisher === 'Wikidata' && source.externalId)) issues.push({ severity: 'warning', code: 'no-wikidata', message: 'Wikidata ID가 없습니다.' })
    if (!band.sources.some((source) => source.publisher === 'MusicBrainz' && source.externalId)) issues.push({ severity: 'warning', code: 'no-musicbrainz', message: 'MusicBrainz ID가 없습니다.' })
    if (band.image.credit.reviewStatus !== 'verified') issues.push({ severity: 'info', code: 'image-review', message: '이미지는 권리 확인 전까지 자동으로 미승인 상태입니다.' })
    seenIds.add(band.id)
    if (nameKey) seenNames.add(nameKey)
    band.sources.forEach((source) => { if (source.externalId) seenExternalIds.add(source.externalId) })
    return [{ key: `${band.id}-${index}`, band, issues, canApprove: !issues.some((item) => item.severity === 'error') }]
  })
  return { candidates, globalIssues }
}

export function forceIntakeDraft(band: Band): Band {
  return {
    ...structuredClone(band),
    reviewStatus: 'draft',
    reviewedAt: undefined,
    reviewedBy: undefined,
    tracks: band.tracks.map((track) => ({ ...track, reviewStatus: 'draft', reviewedAt: undefined, reviewedBy: undefined })),
    relations: band.relations.map((relation) => ({ ...relation, reviewStatus: 'draft', reviewedAt: undefined, reviewedBy: undefined })),
    taxonomyV2: band.taxonomyV2 ? { ...band.taxonomyV2, reviewStatus: 'draft' } : undefined,
    image: { ...band.image, credit: { ...band.image.credit, reviewStatus: 'needs-review', reviewedAt: undefined } },
  }
}

export function buildGeminiResearchPrompt() {
  const genreGuide = taxonomyGenres.map((genre) => `${genre.id}: ${genre.displayName} [${genre.subgenreIds.join(', ')}]`).join('\n')
  const moodGuide = taxonomyMoods.map((mood) => `${mood.id}: ${mood.name}`).join('\n')
  return `ROCK ATLAS에 추가할 록 밴드를 조사해 주세요. 사실은 신뢰할 수 있는 출처로 교차 확인하고, 모르는 값은 추측하지 말고 빈 문자열·빈 배열로 두세요. 최종 답변은 설명이나 마크다운 없이 아래 형식의 JSON 하나만 출력하세요. 영상 임베드는 조사하지 않으며 대표곡은 곡 정보와 일반 YouTube 링크 후보만 제공합니다. 분위기 점수는 장르 고정관념이 아니라 실제 대표곡의 청감 특성을 기준으로 1~5점 중 확실한 항목만 넣으세요.\n\n{\n  "schemaVersion": 1,\n  "bands": [{\n    "id": "영문-소문자-슬러그",\n    "name": "밴드명",\n    "formed": 1970,\n    "origin": "도시, 국가",\n    "countryCode": "GB",\n    "activeYears": "1970–현재",\n    "summary": "수치·연도·대표적 성취와 영향이 드러나는 한국어 소개",\n    "style": "리듬·기타·보컬·프로덕션·곡 전개가 구체적인 한국어 설명",\n    "tags": ["핵심 특징"],\n    "taxonomyV2": {\n      "primaryGenreId": "아래 허용 ID 중 하나",\n      "secondaryGenreIds": [],\n      "subgenreIds": ["아래 허용 세부 장르 ID"],\n      "moodScores": {"허용 분위기 ID": 1}\n    },\n    "members": [{"name":"이름","role":"역할","status":"current|former|touring","activeYears":"기간"}],\n    "representativeTracks": [{"title":"곡명","year":1970,"album":"앨범","guide":"왜 대표적인지와 들을 지점","url":"https://www.youtube.com/watch?v=..."}],\n    "relations": [{"targetBandId":"이미 ROCK ATLAS에 있는 밴드 ID일 때만","kind":"sounds-like|influenced-by|influenced|shared-scene|evolution","strength":1,"note":"구체적 근거"}],\n    "wikidataId": "Q...",\n    "musicBrainzId": "UUID",\n    "wikipediaUrl": "https://...",\n    "sources": [{"label":"출처명","url":"https://...","publisher":"Wikipedia|Wikidata|MusicBrainz|Editorial"}]\n  }]\n}\n\n허용 장르와 세부 장르:\n${genreGuide}\n\n허용 분위기:\n${moodGuide}`
}
