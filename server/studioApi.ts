import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnv, type Plugin } from 'vite'

// Loaded from .env.local (gitignored — see *.local in .gitignore), never bundled into client code.
const youtubeApiKey = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '').YOUTUBE_API_KEY

const catalogPath = resolve('src/data/catalog.json')
const catalogHistoryPath = resolve('src/data/catalog-history.json')
const siteContentPath = resolve('src/data/siteContent.json')
const genresPath = resolve('src/data/genres.json')
const taxonomyPath = resolve('src/data/taxonomy.v2.json')
const uploadsPath = resolve('public/uploads')
const fontUploadsPath = resolve('public/uploads/fonts')

type JsonObject = Record<string, unknown>
type HistoryEntry = { id: string; createdAt: string; label: string; catalog: JsonObject }
type HealthEntry = { id: string; label: string; url: string; kind: 'link' | 'image' | 'font'; bandId?: string }
type CatalogBandPayload = {
  id?: unknown
  name?: unknown
  formed?: unknown
  reviewStatus?: unknown
  relations?: unknown
  taxonomyV2?: unknown
}
type CommandResult = { exitCode: number; output: string; durationMs: number }
type ExternalSearchCandidate = {
  id: string
  name: string
  description: string
  url: string
  aliases?: string[]
  score?: number
  entityType?: string
  country?: string
  origin?: string
  area?: string
  formed?: number
  begin?: string
  end?: string
  ended?: boolean
  musicBrainzId?: string
  youtubeChannelId?: string
  imageFile?: string
  wikipediaUrl?: string
}

type FactAuditBandPayload = {
  id?: unknown
  name?: unknown
  formed?: unknown
  origin?: unknown
  countryCode?: unknown
  activeYears?: unknown
  sources?: unknown
  members?: unknown
  tracks?: unknown
}

type FactEvidence = {
  id: 'formed' | 'country' | 'origin' | 'active-end'
  label: string
  localValue: string
  externalValue: string
  status: 'verified' | 'review' | 'missing'
  confidence: 'high' | 'medium' | 'low'
  sources: string[]
  message: string
}

let preflightInProgress = false
const externalSearchCache = new Map<string, { expiresAt: number; results: ExternalSearchCandidate[] }>()
const factAuditCache = new Map<string, { expiresAt: number; payload: unknown }>()

const isLocalRequest = (origin: string) => !origin || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)

async function readBody(request: AsyncIterable<unknown>, maxBytes: number) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array)
    size += buffer.length
    if (size > maxBytes) throw new Error('요청 파일 크기가 허용 범위를 초과했습니다.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonObject
}

async function readHistory(): Promise<HistoryEntry[]> {
  try {
    return JSON.parse(await readFile(catalogHistoryPath, 'utf8')) as HistoryEntry[]
  } catch {
    return []
  }
}

async function archiveCatalog(label: string) {
  const current = JSON.parse(await readFile(catalogPath, 'utf8')) as JsonObject
  const history = await readHistory()
  history.unshift({ id: `${Date.now()}`, createdAt: new Date().toISOString(), label, catalog: current })
  await writeFile(catalogHistoryPath, `${JSON.stringify(history.slice(0, 20), null, 2)}\n`, 'utf8')
}

async function validateCatalogBands(bands: CatalogBandPayload[]) {
  const errors: string[] = []
  if (!bands.length) errors.push('밴드 목록을 비운 상태로 저장할 수 없습니다.')
  const ids = bands.map((band) => typeof band.id === 'string' ? band.id.trim() : '')
  const names = bands.map((band) => typeof band.name === 'string' ? band.name.trim() : '')
  const normalizedNames = names.map((name) => name.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
  const idSet = new Set(ids)
  if (ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) errors.push('모든 밴드 ID는 영문 소문자·숫자·하이픈 형식이어야 합니다.')
  if (idSet.size !== ids.length) errors.push('중복된 밴드 ID가 있습니다.')
  if (names.some((name) => !name)) errors.push('이름이 비어 있는 밴드가 있습니다.')
  if (new Set(normalizedNames).size !== normalizedNames.length) errors.push('중복된 밴드 이름이 있습니다.')

  const taxonomyCatalog = JSON.parse(await readFile(taxonomyPath, 'utf8')) as {
    genres?: Array<{ id?: string }>
    subgenres?: Array<{ id?: string }>
    moods?: Array<{ id?: string }>
  }
  const genreIds = new Set((taxonomyCatalog.genres ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))
  const subgenreIds = new Set((taxonomyCatalog.subgenres ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))
  const moodIds = new Set((taxonomyCatalog.moods ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))

  bands.forEach((band, index) => {
    const label = names[index] || ids[index] || `${index + 1}번째 밴드`
    if (!Number.isInteger(band.formed) || Number(band.formed) < 1900 || Number(band.formed) > new Date().getFullYear()) errors.push(`${label}: 결성 연도가 올바르지 않습니다.`)
    if (!['draft', 'published'].includes(String(band.reviewStatus))) errors.push(`${label}: 공개 상태 값이 올바르지 않습니다.`)
    if (!Array.isArray(band.relations)) errors.push(`${label}: 관계 목록 형식이 올바르지 않습니다.`)
    else band.relations.forEach((relation) => {
      if (!relation || typeof relation !== 'object') return errors.push(`${label}: 관계 항목 형식이 올바르지 않습니다.`)
      const target = String((relation as { targetBandId?: unknown }).targetBandId ?? '')
      if (!idSet.has(target)) errors.push(`${label}: 존재하지 않는 관계 대상 ${target || '(빈 ID)'}`)
      if (target === ids[index]) errors.push(`${label}: 자기 자신을 관계 대상으로 지정할 수 없습니다.`)
    })

    if (!band.taxonomyV2 || typeof band.taxonomyV2 !== 'object' || Array.isArray(band.taxonomyV2)) return errors.push(`${label}: 새 장르·분위기 분류가 없습니다.`)
    const taxonomy = band.taxonomyV2 as { primaryGenreId?: unknown; secondaryGenreIds?: unknown; subgenreIds?: unknown; moodScores?: unknown; reviewStatus?: unknown }
    const primaryGenreId = String(taxonomy.primaryGenreId ?? '')
    if (!genreIds.has(primaryGenreId)) errors.push(`${label}: 존재하지 않는 대표 장르 ${primaryGenreId || '(빈 ID)'}`)
    if (!Array.isArray(taxonomy.secondaryGenreIds) || taxonomy.secondaryGenreIds.some((id) => !genreIds.has(String(id)))) errors.push(`${label}: 보조 장르 중 존재하지 않는 값이 있습니다.`)
    if (!Array.isArray(taxonomy.subgenreIds) || taxonomy.subgenreIds.some((id) => !subgenreIds.has(String(id)))) errors.push(`${label}: 세부 장르 중 존재하지 않는 값이 있습니다.`)
    if (!taxonomy.moodScores || typeof taxonomy.moodScores !== 'object' || Array.isArray(taxonomy.moodScores)) errors.push(`${label}: 분위기 점수 형식이 올바르지 않습니다.`)
    else Object.entries(taxonomy.moodScores as Record<string, unknown>).forEach(([id, score]) => {
      if (!moodIds.has(id) || !Number.isInteger(score) || Number(score) < 1 || Number(score) > 5) errors.push(`${label}: 분위기 ${id} 점수는 허용 ID와 1~5 정수만 사용할 수 있습니다.`)
    })
    if (!['draft', 'reviewed'].includes(String(taxonomy.reviewStatus))) errors.push(`${label}: 분류 검수 상태가 올바르지 않습니다.`)
  })

  if (errors.length) throw new Error(`저장 전 안전 검사에서 ${errors.length}건을 발견했습니다.\n- ${errors.slice(0, 12).join('\n- ')}${errors.length > 12 ? `\n- 외 ${errors.length - 12}건` : ''}`)
}

function validatePendingRelations(pendingRelations: unknown[], bands: CatalogBandPayload[]) {
  const errors: string[] = []
  const bandIds = new Set(bands.map((band) => String(band.id ?? '')))
  const pendingIds = new Set<string>()
  pendingRelations.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${index + 1}번째 보류 관계 형식이 올바르지 않습니다.`)
      return
    }
    const pending = item as Record<string, unknown>
    const id = String(pending.id ?? '')
    const sourceBandId = String(pending.sourceBandId ?? '')
    const targetBandId = String(pending.targetBandId ?? '')
    if (!id || pendingIds.has(id)) errors.push(`보류 관계 ID가 비어 있거나 중복되었습니다: ${id || '(빈 ID)'}`)
    pendingIds.add(id)
    if (!bandIds.has(sourceBandId)) errors.push(`${id}: 출발 밴드 ${sourceBandId || '(빈 ID)'}가 없습니다.`)
    if (bandIds.has(targetBandId)) errors.push(`${id}: 대상 밴드 ${targetBandId}가 이미 있으므로 먼저 자동 연결해야 합니다.`)
    if (!targetBandId || sourceBandId === targetBandId) errors.push(`${id}: 대상 밴드 ID가 비어 있거나 자기 자신입니다.`)
    if (!String(pending.sourceBandName ?? '').trim() || !String(pending.note ?? '').trim()) errors.push(`${id}: 밴드 이름 또는 관계 설명이 비어 있습니다.`)
    if (!['sounds-like', 'influenced-by', 'influenced', 'shared-scene', 'evolution'].includes(String(pending.kind))) errors.push(`${id}: 관계 종류가 올바르지 않습니다.`)
    if (![1, 2, 3].includes(Number(pending.strength))) errors.push(`${id}: 관계 강도는 1~3이어야 합니다.`)
  })
  if (errors.length) throw new Error(`보류 관계 안전 검사에서 ${errors.length}건을 발견했습니다.\n- ${errors.slice(0, 12).join('\n- ')}`)
}

async function runCommand(executable: string, args: string[]): Promise<CommandResult> {
  const startedAt = Date.now()
  return await new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      windowsHide: true,
      shell: false,
      env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' },
    })
    const chunks: Buffer[] = []
    let bytes = 0
    const collect = (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes <= 2_000_000) chunks.push(chunk)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('error', rejectCommand)
    child.once('close', (code) => {
      resolveCommand({
        exitCode: code ?? 1,
        output: Buffer.concat(chunks).toString('utf8').trim(),
        durationMs: Date.now() - startedAt,
      })
    })
  })
}

function commandSummary(output: string) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return lines.slice(-2).join(' · ').slice(0, 320) || '출력 없이 완료'
}

function json(response: { setHeader(name: string, value: string): void; end(body?: string): void }, payload: unknown) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function wikidataClaimValue(entity: Record<string, unknown>, property: string) {
  const claims = entity.claims as Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> | undefined
  return claims?.[property]?.[0]?.mainsnak?.datavalue?.value
}

function wikidataEntityId(entity: Record<string, unknown>, property: string) {
  const value = wikidataClaimValue(entity, property)
  return value && typeof value === 'object' && 'id' in value ? String((value as { id?: unknown }).id ?? '') : ''
}

function wikidataString(entity: Record<string, unknown>, property: string) {
  const value = wikidataClaimValue(entity, property)
  return typeof value === 'string' ? value : ''
}

function wikidataYear(entity: Record<string, unknown>, property: string) {
  const value = wikidataClaimValue(entity, property)
  const time = value && typeof value === 'object' && 'time' in value ? String((value as { time?: unknown }).time ?? '') : ''
  const match = /^[+-](\d{4,})-/.exec(time)
  return match ? Number(match[1]) : undefined
}

function wikidataLabel(entity: Record<string, unknown> | undefined) {
  const labels = entity?.labels as Record<string, { value?: string }> | undefined
  // 'mul' is Wikidata's language-independent label, used for names that are
  // identical across languages (e.g. most band names) instead of a separate
  // 'en' entry. Skipping it made otherwise-correct items look nameless.
  return labels?.ko?.value ?? labels?.en?.value ?? labels?.mul?.value ?? ''
}

const normalizedText = (value: string) => value
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/\p{Mark}+/gu, '')
  .replace(/[^a-z0-9가-힣]+/g, '')

function sourceExternalId(sources: unknown, publisher: string) {
  if (!Array.isArray(sources)) return ''
  const source = sources.find((item) => item && typeof item === 'object' && String((item as Record<string, unknown>).publisher ?? '') === publisher) as Record<string, unknown> | undefined
  return String(source?.externalId ?? '').trim()
}

function factEvidence(
  id: FactEvidence['id'],
  label: string,
  localValue: string,
  externalValues: Array<{ source: string; value?: string }>,
  similar: (local: string, external: string) => boolean = (local, external) => normalizedText(local) === normalizedText(external),
): FactEvidence {
  const available = externalValues.filter((item): item is { source: string; value: string } => Boolean(item.value))
  if (!available.length) return { id, label, localValue, externalValue: '', status: 'missing', confidence: 'low', sources: [], message: '외부 구조화 자료에 값이 없습니다.' }
  const groups = new Map<string, Array<{ source: string; value: string }>>()
  available.forEach((item) => {
    const key = normalizedText(item.value)
    groups.set(key, [...(groups.get(key) ?? []), item])
  })
  const strongest = [...groups.values()].sort((left, right) => right.length - left.length)[0]
  const externalValue = strongest[0].value
  const matches = similar(localValue, externalValue)
  const confidence = strongest.length >= 2 ? 'high' : 'medium'
  return {
    id,
    label,
    localValue,
    externalValue,
    status: matches ? 'verified' : 'review',
    confidence,
    sources: strongest.map((item) => item.source),
    message: matches
      ? `${strongest.map((item) => item.source).join('·')} 자료와 일치합니다.`
      : `${strongest.map((item) => item.source).join('·')} 값과 달라 운영자 확인이 필요합니다.`,
  }
}

async function fetchJsonWithRetry<T>(url: URL, signal: AbortSignal, attempt = 0): Promise<T> {
  const result = await fetch(url, { signal, headers: { 'User-Agent': 'RockAtlasStudio/0.2 (local catalog editor; personal project)', Accept: 'application/json' } })
  if (result.ok) return result.json() as Promise<T>
  if ((result.status === 429 || result.status >= 500) && attempt < 2) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_100 * (attempt + 1)))
    return fetchJsonWithRetry<T>(url, signal, attempt + 1)
  }
  throw new Error(`${url.hostname} 응답 오류 (${result.status})`)
}

async function buildFactAudit(band: FactAuditBandPayload, signal: AbortSignal) {
  const id = String(band.id ?? '').trim()
  const name = String(band.name ?? '').trim()
  const wikidataId = sourceExternalId(band.sources, 'Wikidata')
  const musicBrainzId = sourceExternalId(band.sources, 'MusicBrainz')
  if (!name) throw new Error('밴드 이름이 필요합니다.')

  let wikidataEntity: Record<string, unknown> | undefined
  let wikidataError = ''
  if (/^Q\d+$/.test(wikidataId)) {
    try {
      const url = new URL('https://www.wikidata.org/w/api.php')
      url.search = new URLSearchParams({ action: 'wbgetentities', ids: wikidataId, props: 'labels|aliases|claims|sitelinks', languages: 'en|ko|mul', sitefilter: 'enwiki|kowiki', format: 'json', origin: '*' }).toString()
      const payload = await fetchJsonWithRetry<{ entities?: Record<string, Record<string, unknown>> }>(url, signal)
      wikidataEntity = payload.entities?.[wikidataId]
      if (!wikidataEntity || 'missing' in wikidataEntity) wikidataError = 'Wikidata 항목이 존재하지 않습니다.'
    } catch (error) { wikidataError = error instanceof Error ? error.message : 'Wikidata 확인 실패' }
  } else wikidataError = 'Wikidata ID가 없거나 형식이 잘못되었습니다.'

  type MbRelation = { type?: string; direction?: string; begin?: string | null; end?: string | null; artist?: { id?: string; name?: string }; url?: { resource?: string } }
  type MbReleaseGroup = { id?: string; title?: string; 'first-release-date'?: string; 'primary-type'?: string }
  type MbArtist = { id?: string; name?: string; type?: string; country?: string; aliases?: Array<{ name?: string }>; area?: { name?: string }; 'begin-area'?: { name?: string }; 'life-span'?: { begin?: string; end?: string; ended?: boolean }; relations?: MbRelation[]; 'release-groups'?: MbReleaseGroup[] }
  let musicBrainz: MbArtist | undefined
  let musicBrainzError = ''
  if (/^[0-9a-f-]{36}$/i.test(musicBrainzId)) {
    try {
      const url = new URL(`https://musicbrainz.org/ws/2/artist/${musicBrainzId}`)
      url.search = new URLSearchParams({ inc: 'aliases+artist-rels+release-groups+url-rels', fmt: 'json' }).toString()
      musicBrainz = await fetchJsonWithRetry<MbArtist>(url, signal)
    } catch (error) { musicBrainzError = error instanceof Error ? error.message : 'MusicBrainz 확인 실패' }
  } else musicBrainzError = 'MusicBrainz ID가 없거나 형식이 잘못되었습니다.'

  const labels = wikidataEntity?.labels as Record<string, { value?: string }> | undefined
  const aliases = wikidataEntity?.aliases as Record<string, Array<{ value?: string }>> | undefined
  const wikidataNames = [labels?.en?.value, labels?.ko?.value, labels?.mul?.value, ...(aliases?.en ?? []).map((item) => item.value), ...(aliases?.ko ?? []).map((item) => item.value), ...(aliases?.mul ?? []).map((item) => item.value)].filter((value): value is string => Boolean(value))
  const nameMatchesWikidata = !wikidataEntity || wikidataNames.some((value) => normalizedText(value) === normalizedText(name))
  const musicBrainzNames = [musicBrainz?.name, ...(musicBrainz?.aliases ?? []).map((alias) => alias.name)].filter((value): value is string => Boolean(value))
  const nameMatchesMusicBrainz = !musicBrainz?.name || musicBrainzNames.some((value) => normalizedText(value) === normalizedText(name))
  const linkedMusicBrainzId = wikidataEntity ? wikidataString(wikidataEntity, 'P434') : ''
  const linkedAcrossSources = Boolean(linkedMusicBrainzId && musicBrainzId && linkedMusicBrainzId === musicBrainzId)

  const localFormed = String(band.formed ?? '')
  // A MusicBrainz Person life-span starts at birth, not at career debut.
  // Only Group records can safely supply a formation/end year here.
  const isMusicBrainzGroup = musicBrainz?.type === 'Group'
  const mbFormed = isMusicBrainzGroup ? musicBrainz?.['life-span']?.begin?.slice(0, 4) ?? '' : ''
  const wdFormed = wikidataEntity ? String(wikidataYear(wikidataEntity, 'P571') ?? '') : ''
  const localCountry = String(band.countryCode ?? '').toUpperCase()
  const localOrigin = String(band.origin ?? '')
  const mbOrigin = musicBrainz?.['begin-area']?.name ?? musicBrainz?.area?.name ?? ''
  const localEnd = String(band.activeYears ?? '').match(/(\d{4})(?!.*\d)/)?.[1] ?? ''
  const mbEnd = isMusicBrainzGroup ? musicBrainz?.['life-span']?.end?.slice(0, 4) ?? '' : ''
  const facts: FactEvidence[] = [
    factEvidence('formed', '결성 연도', localFormed, [{ source: 'MusicBrainz', value: mbFormed }, { source: 'Wikidata', value: wdFormed }], (local, external) => Math.abs(Number(local) - Number(external)) <= 1),
    factEvidence('country', '국가 코드', localCountry, [{ source: 'MusicBrainz', value: musicBrainz?.country }]),
    factEvidence('origin', '결성지', localOrigin, [{ source: 'MusicBrainz', value: mbOrigin }], (local, external) => normalizedText(local).includes(normalizedText(external)) || normalizedText(external).includes(normalizedText(local))),
    factEvidence('active-end', '활동 종료 연도', localEnd, [{ source: 'MusicBrainz', value: mbEnd }]),
  ]

  const memberRelations = (musicBrainz?.relations ?? []).filter((relation) => relation.type === 'member of band' && relation.direction === 'backward' && relation.artist?.name)
  const externalMembers = memberRelations.map((relation) => ({ name: relation.artist!.name!, begin: relation.begin ?? '', end: relation.end ?? '' }))
  const albums = (musicBrainz?.['release-groups'] ?? [])
    .filter((item) => item.title && item['primary-type'] === 'Album')
    .map((item) => ({ id: item.id ?? '', title: item.title!, year: Number(item['first-release-date']?.slice(0, 4)) || undefined }))
    .sort((left, right) => (left.year ?? 9999) - (right.year ?? 9999) || left.title.localeCompare(right.title))
  const albumByName = new Map(albums.map((album) => [normalizedText(album.title), album]))
  // Linked release groups are capped by MusicBrainz. When the cap is reached,
  // an unmatched local album is inconclusive rather than an error.
  const albumListIsComplete = albums.length < 25
  const tracks = Array.isArray(band.tracks) ? band.tracks as Array<Record<string, unknown>> : []
  const trackChecks = tracks.map((track) => {
    const album = String(track.album ?? '').trim()
    const matchedAlbum = album ? albumByName.get(normalizedText(album)) : undefined
    const year = Number(track.year) || undefined
    return {
      id: String(track.id ?? ''), title: String(track.title ?? ''), album, year,
      status: !album ? 'missing' : !matchedAlbum ? (albumListIsComplete ? 'review' : 'missing') : year && matchedAlbum.year && Math.abs(year - matchedAlbum.year) > 1 ? 'review' : 'verified',
      externalAlbum: matchedAlbum?.title ?? '', externalYear: matchedAlbum?.year,
    }
  })
  const localMembers = Array.isArray(band.members) ? band.members as Array<Record<string, unknown>> : []
  const externalMemberNames = new Set(externalMembers.map((member) => normalizedText(member.name)))
  const memberChecks = localMembers.map((member) => ({
    name: String(member.name ?? ''),
    status: externalMemberNames.has(normalizedText(String(member.name ?? ''))) ? 'verified' : 'missing',
  }))
  const issues = [
    ...(wikidataError ? [{ severity: 'error', code: 'wikidata', message: wikidataError }] : []),
    ...(musicBrainzError ? [{ severity: 'error', code: 'musicbrainz', message: musicBrainzError }] : []),
    ...(!nameMatchesWikidata ? [{ severity: 'error', code: 'wikidata-name', message: `Wikidata 이름이 ${name}과 일치하지 않습니다.` }] : []),
    ...(!nameMatchesMusicBrainz ? [{ severity: 'error', code: 'musicbrainz-name', message: `MusicBrainz 이름 “${musicBrainz?.name}”이 ${name}과 일치하지 않습니다.` }] : []),
    ...(wikidataEntity && musicBrainz && !linkedAcrossSources ? [{ severity: 'warning', code: 'cross-link', message: 'Wikidata가 현재 MusicBrainz ID를 직접 가리키지 않습니다.' }] : []),
    ...facts.filter((fact) => fact.status === 'review').map((fact) => ({ severity: 'warning', code: `fact-${fact.id}`, message: `${fact.label}: 로컬 “${fact.localValue || '없음'}” ↔ 외부 “${fact.externalValue}”` })),
    ...trackChecks.filter((track) => track.status === 'review').map((track) => ({ severity: 'warning', code: `track-${track.id}`, message: `${track.title}: 앨범·발매연도를 MusicBrainz 음반 목록에서 일치시키지 못했습니다.` })),
  ]
  return {
    bandId: id,
    bandName: name,
    checkedAt: new Date().toISOString(),
    status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length ? 'review' : 'verified',
    linkedAcrossSources,
    identity: { wikidataId, musicBrainzId, wikidataName: wikidataNames[0] ?? '', musicBrainzName: musicBrainz?.name ?? '' },
    facts,
    albums,
    externalMembers,
    memberChecks,
    trackChecks,
    issues,
  }
}

async function fetchWikidataCandidates(query: string, signal: AbortSignal): Promise<ExternalSearchCandidate[]> {
  const searchUrl = new URL('https://www.wikidata.org/w/api.php')
  searchUrl.search = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language: 'en',
    uselang: 'ko',
    type: 'item',
    limit: '8',
    format: 'json',
    origin: '*',
  }).toString()
  const searchResponse = await fetch(searchUrl, { signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor)' } })
  if (!searchResponse.ok) throw new Error(`Wikidata 응답 오류 (${searchResponse.status})`)
  const searchPayload = await searchResponse.json() as {
    search?: Array<{ id: string; label?: string; description?: string; concepturi?: string; aliases?: string[] }>
  }
  const searchResults = searchPayload.search ?? []
  if (!searchResults.length) return []

  const entityUrl = new URL('https://www.wikidata.org/w/api.php')
  entityUrl.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: searchResults.map((item) => item.id).join('|'),
    props: 'labels|aliases|claims|sitelinks',
    languages: 'en|ko|mul',
    sitefilter: 'enwiki|kowiki',
    format: 'json',
    origin: '*',
  }).toString()
  const entityResponse = await fetch(entityUrl, { signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor)' } })
  if (!entityResponse.ok) throw new Error(`Wikidata 상세 응답 오류 (${entityResponse.status})`)
  const entityPayload = await entityResponse.json() as { entities?: Record<string, Record<string, unknown>> }
  const entities = entityPayload.entities ?? {}

  const referencedIds = [...new Set(Object.values(entities).flatMap((entity) =>
    [wikidataEntityId(entity, 'P31'), wikidataEntityId(entity, 'P495'), wikidataEntityId(entity, 'P740')].filter(Boolean),
  ))]
  let references: Record<string, Record<string, unknown>> = {}
  if (referencedIds.length) {
    const referenceUrl = new URL('https://www.wikidata.org/w/api.php')
    referenceUrl.search = new URLSearchParams({
      action: 'wbgetentities',
      ids: referencedIds.join('|'),
      props: 'labels',
      languages: 'en|ko|mul',
      format: 'json',
      origin: '*',
    }).toString()
    const referenceResponse = await fetch(referenceUrl, { signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor)' } })
    if (referenceResponse.ok) {
      const referencePayload = await referenceResponse.json() as { entities?: Record<string, Record<string, unknown>> }
      references = referencePayload.entities ?? {}
    }
  }

  return searchResults.map((item) => {
    const entity = entities[item.id] ?? {}
    const aliases = entity.aliases as Record<string, Array<{ value?: string }>> | undefined
    const sitelinks = entity.sitelinks as Record<string, { title?: string; url?: string }> | undefined
    const enwiki = sitelinks?.enwiki
    const kowiki = sitelinks?.kowiki
    const wikipediaUrl = enwiki?.url
      || (enwiki?.title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.title.replace(/ /g, '_'))}` : '')
      || kowiki?.url
      || (kowiki?.title ? `https://ko.wikipedia.org/wiki/${encodeURIComponent(kowiki.title.replace(/ /g, '_'))}` : '')
    const entityTypeId = wikidataEntityId(entity, 'P31')
    const countryId = wikidataEntityId(entity, 'P495')
    const originId = wikidataEntityId(entity, 'P740')
    return {
      id: item.id,
      name: wikidataLabel(entity) || item.label || item.id,
      description: item.description ?? '',
      url: item.concepturi ?? `https://www.wikidata.org/wiki/${item.id}`,
      aliases: [
        ...(item.aliases ?? []),
        ...(aliases?.en ?? []).map((alias) => alias.value ?? ''),
        ...(aliases?.ko ?? []).map((alias) => alias.value ?? ''),
        ...(aliases?.mul ?? []).map((alias) => alias.value ?? ''),
      ].filter(Boolean).slice(0, 8),
      entityType: wikidataLabel(references[entityTypeId]),
      country: wikidataLabel(references[countryId]),
      origin: wikidataLabel(references[originId]),
      formed: wikidataYear(entity, 'P571'),
      musicBrainzId: wikidataString(entity, 'P434'),
      youtubeChannelId: wikidataString(entity, 'P2397'),
      imageFile: wikidataString(entity, 'P18'),
      wikipediaUrl,
    }
  })
}

async function inspectUrl(entry: HealthEntry, localOrigin: string) {
  const startedAt = Date.now()
  try {
    const target = new URL(entry.url, localOrigin)
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('HTTP(S) 주소가 아닙니다.')
    const request = async (method: 'HEAD' | 'GET') => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      try {
        const result = await fetch(target, { method, redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 link-health-checker', ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}) } })
        await result.body?.cancel()
        return result
      } finally { clearTimeout(timeout) }
    }
    let result = await request('HEAD')
    if ([405, 501].includes(result.status)) result = await request('GET')
    const contentType = result.headers.get('content-type') ?? ''
    const isAsset = entry.kind === 'image' ? contentType.startsWith('image/') : entry.kind === 'font' ? /font|woff|octet-stream/.test(contentType) : true
    const status = result.status === 403 || result.status === 429
      ? 'restricted'
      : result.ok && !isAsset
        ? 'broken'
        : result.ok && result.redirected
          ? 'redirected'
          : result.ok
            ? 'ok'
            : result.status === 404 || result.status === 410
              ? 'broken'
              : 'error'
    return { ...entry, status, httpStatus: result.status, finalUrl: result.url, contentType, durationMs: Date.now() - startedAt, detail: result.ok && !isAsset ? `${entry.kind === 'image' ? '이미지' : '폰트'} 형식이 아닙니다.` : '' }
  } catch (error) {
    return { ...entry, status: 'error', httpStatus: 0, finalUrl: '', contentType: '', durationMs: Date.now() - startedAt, detail: error instanceof Error && error.name === 'AbortError' ? '10초 안에 응답하지 않았습니다.' : error instanceof Error ? error.message : '확인 실패' }
  }
}

export function studioApi(): Plugin {
  return {
    name: 'rock-atlas-studio-api',
    configureServer(server) {
      server.middlewares.use('/api/studio/capability', (request, response, next) => {
        if (request.method !== 'GET') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio는 로컬에서만 사용할 수 있습니다.')
        }
        json(response, { available: true, canWrite: true, mode: 'local-studio' })
      })

      server.middlewares.use('/api/studio/deploy-status', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('배포 준비 상태는 로컬에서만 확인할 수 있습니다.')
        }
        try {
          const gitPrefix = ['-c', `safe.directory=${process.cwd().replace(/\\/g, '/')}`]
          const [branchResult, commitResult, statusResult] = await Promise.all([
            runCommand('git', [...gitPrefix, 'branch', '--show-current']),
            runCommand('git', [...gitPrefix, 'log', '-1', '--pretty=format:%h %s']),
            runCommand('git', [...gitPrefix, 'status', '--short']),
          ])
          const failedResult = [branchResult, commitResult, statusResult].find((result) => result.exitCode !== 0)
          if (failedResult) throw new Error(`Git 상태를 읽지 못했습니다. ${commandSummary(failedResult.output)}`)
          const changes = statusResult.output.split(/\r?\n/)
            .filter(Boolean)
            .map((line) => ({ code: line.slice(0, 2).trim() || '?', file: line.slice(3).trim() }))
            .filter((change) => change.file !== '.claude/settings.local.json')
          json(response, {
            branch: branchResult.output || '(브랜치 없음)',
            latestCommit: commitResult.output || '커밋 기록 없음',
            clean: changes.length === 0,
            changes,
            checkedAt: new Date().toISOString(),
          })
        } catch (error) {
          response.statusCode = 500
          response.end(error instanceof Error ? error.message : 'Git 변경 상태 확인 실패')
        }
      })

      server.middlewares.use('/api/studio/preflight', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('배포 전 검사는 로컬에서만 실행할 수 있습니다.')
        }
        if (preflightInProgress) {
          response.statusCode = 409
          return response.end('이미 배포 전 검사가 실행 중입니다. 잠시 기다려주세요.')
        }
        preflightInProgress = true
        const startedAt = new Date().toISOString()
        const steps: Array<{ id: string; label: string; passed: boolean; durationMs: number; summary: string }> = []
        const npmExecutable = process.platform === 'win32' ? process.execPath : 'npm'
        const npmPrefix = process.platform === 'win32' ? [resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')] : []
        const commands = [
          { id: 'catalog', label: '밴드 데이터 검사', args: ['run', 'validate:data'] },
          { id: 'taxonomy', label: '장르·분위기 검사', args: ['run', 'validate:taxonomy'] },
          { id: 'moods', label: '분위기 커버리지 진단', args: ['run', 'audit:moods'] },
          { id: 'tests', label: '자동 회귀 테스트', args: ['test'] },
          { id: 'build', label: '프로덕션 빌드', args: ['run', 'build'] },
        ]
        try {
          for (const command of commands) {
            const result = await runCommand(npmExecutable, [...npmPrefix, ...command.args])
            steps.push({ id: command.id, label: command.label, passed: result.exitCode === 0, durationMs: result.durationMs, summary: commandSummary(result.output) })
            if (result.exitCode !== 0) break
          }
          json(response, {
            passed: steps.length === commands.length && steps.every((step) => step.passed),
            startedAt,
            finishedAt: new Date().toISOString(),
            steps,
          })
        } catch (error) {
          response.statusCode = 500
          response.end(error instanceof Error ? error.message : '배포 전 검사 실행 실패')
        } finally {
          preflightInProgress = false
        }
      })

      server.middlewares.use('/api/studio/health-check', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 검사는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 800_000)
          const entries = payload.entries as HealthEntry[] | undefined
          if (!Array.isArray(entries) || entries.length > 600) throw new Error('검사 항목은 최대 600개까지 보낼 수 있습니다.')
          if (entries.some((entry) => !entry.id || !entry.label || !entry.url || !['link', 'image', 'font'].includes(entry.kind))) throw new Error('검사 항목 형식이 올바르지 않습니다.')
          const results = new Array(entries.length)
          let cursor = 0
          const localOrigin = `http://${request.headers.host ?? '127.0.0.1:5173'}`
          await Promise.all(Array.from({ length: Math.min(8, entries.length) }, async () => {
            while (cursor < entries.length) {
              const index = cursor
              cursor += 1
              results[index] = await inspectUrl(entries[index], localOrigin)
            }
          }))
          json(response, { checkedAt: new Date().toISOString(), results })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '전체 상태 검사 실패')
        }
      })

      server.middlewares.use('/api/studio/fact-audit', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('사실 검수는 로컬 Studio에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 300_000)
          const band = payload.band as FactAuditBandPayload | undefined
          if (!band || typeof band !== 'object' || Array.isArray(band)) throw new Error('검수할 밴드 정보가 필요합니다.')
          const cacheKey = `${String(band.id ?? band.name ?? '')}:${sourceExternalId(band.sources, 'Wikidata')}:${sourceExternalId(band.sources, 'MusicBrainz')}`
          const cached = factAuditCache.get(cacheKey)
          if (cached && cached.expiresAt > Date.now()) return json(response, { ...(cached.payload as Record<string, unknown>), cached: true })
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 25_000)
          try {
            const result = await buildFactAudit(band, controller.signal)
            // Only cache a clean result for a full day. An 'error' status can come from a
            // transient external-API hiccup or gap (e.g. a Wikidata item missing an en/ko
            // label); caching that for 24h would strand the band until the cache expired.
            const ttl = result.status === 'error' ? 60_000 : 24 * 60 * 60 * 1000
            factAuditCache.set(cacheKey, { expiresAt: Date.now() + ttl, payload: result })
            json(response, result)
          } finally { clearTimeout(timeout) }
        } catch (error) {
          response.statusCode = 502
          response.end(error instanceof Error && error.name === 'AbortError' ? '외부 사실 검수가 시간 안에 끝나지 않았습니다.' : error instanceof Error ? error.message : '외부 사실 검수 실패')
        }
      })

      server.middlewares.use('/api/studio/external-search', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const query = requestUrl.searchParams.get('q')?.trim() ?? ''
        const provider = requestUrl.searchParams.get('provider')
        if (query.length < 2 || !['wikidata', 'musicbrainz'].includes(provider ?? '')) {
          response.statusCode = 400
          return response.end('검색어 두 글자 이상과 검색 제공자가 필요합니다.')
        }
        const cacheKey = `${provider}:${query.toLocaleLowerCase()}`
        const cached = externalSearchCache.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) return json(response, { provider, query, results: cached.results, cached: true })
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12_000)
          let results: ExternalSearchCandidate[] = []
          if (provider === 'wikidata') {
            results = await fetchWikidataCandidates(query, controller.signal)
          } else {
            const url = new URL('https://musicbrainz.org/ws/2/artist/')
            url.search = new URLSearchParams({ query: `artist:"${query.replace(/"/g, '')}"`, fmt: 'json', limit: '8' }).toString()
            const apiResponse = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor; personal project)', Accept: 'application/json' } })
            if (!apiResponse.ok) throw new Error(`MusicBrainz 응답 오류 (${apiResponse.status})`)
            const payload = await apiResponse.json() as { artists?: Array<{ id: string; name: string; score?: number; type?: string; disambiguation?: string; country?: string; area?: { name?: string }; 'begin-area'?: { name?: string }; 'life-span'?: { begin?: string; end?: string; ended?: boolean }; aliases?: Array<{ name: string }> }> }
            results = (payload.artists ?? []).map((item) => ({
              id: item.id,
              name: item.name,
              description: [item.type, item.disambiguation].filter(Boolean).join(' · '),
              entityType: item.type ?? '',
              url: `https://musicbrainz.org/artist/${item.id}`,
              score: item.score,
              country: item.country ?? '',
              origin: item['begin-area']?.name ?? '',
              area: item['begin-area']?.name ?? item.area?.name ?? '',
              formed: item.type === 'Group' ? Number.parseInt(item['life-span']?.begin?.slice(0, 4) ?? '', 10) || undefined : undefined,
              begin: item['life-span']?.begin ?? '',
              end: item['life-span']?.end ?? '',
              ended: Boolean(item['life-span']?.ended),
              aliases: (item.aliases ?? []).slice(0, 4).map((alias) => alias.name),
            }))
          }
          clearTimeout(timeout)
          externalSearchCache.set(cacheKey, { expiresAt: Date.now() + 60 * 60 * 1000, results })
          json(response, { provider, query, results })
        } catch (error) {
          response.statusCode = 502
          response.end(error instanceof Error && error.name === 'AbortError' ? '외부 검색 시간이 초과되었습니다.' : error instanceof Error ? error.message : '외부 검색 실패')
        }
      })

      server.middlewares.use('/api/studio/youtube-search', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        if (!youtubeApiKey) {
          response.statusCode = 501
          return response.end('YOUTUBE_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가하세요.')
        }
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const query = requestUrl.searchParams.get('q')?.trim() ?? ''
        const searchType = requestUrl.searchParams.get('type') === 'channel' ? 'channel' : 'video'
        if (query.length < 2) {
          response.statusCode = 400
          return response.end('검색어를 두 글자 이상 입력하세요.')
        }
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12_000)
          const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
          searchUrl.search = new URLSearchParams({ part: 'snippet', type: searchType, maxResults: '8', q: query, key: youtubeApiKey }).toString()
          const apiResponse = await fetch(searchUrl, { signal: controller.signal })
          const payload = await apiResponse.json() as {
            error?: { message?: string }
            items?: Array<{
              id?: { videoId?: string; channelId?: string }
              snippet?: { title?: string; channelTitle?: string; channelId?: string; description?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } }
            }>
          }
          if (!apiResponse.ok) throw new Error(payload.error?.message ?? `YouTube API 오류 (${apiResponse.status})`)

          if (searchType === 'channel') {
            const channelIds = (payload.items ?? []).map((item) => item.id?.channelId).filter((id): id is string => Boolean(id))
            let statsById: Record<string, { subscriberCount?: string; customUrl?: string }> = {}
            if (channelIds.length) {
              const statsUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
              statsUrl.search = new URLSearchParams({ part: 'snippet,statistics', id: channelIds.join(','), key: youtubeApiKey }).toString()
              const statsResponse = await fetch(statsUrl, { signal: controller.signal })
              const statsPayload = await statsResponse.json() as { items?: Array<{ id?: string; snippet?: { customUrl?: string }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }> }
              statsById = Object.fromEntries((statsPayload.items ?? []).filter((item) => item.id).map((item) => [item.id, { subscriberCount: item.statistics?.hiddenSubscriberCount ? undefined : item.statistics?.subscriberCount, customUrl: item.snippet?.customUrl }]))
            }
            clearTimeout(timeout)
            const results = (payload.items ?? [])
              .filter((item) => item.id?.channelId)
              .map((item) => {
                const channelId = item.id!.channelId!
                const stats = statsById[channelId]
                return {
                  channelId,
                  title: item.snippet?.title ?? '',
                  description: item.snippet?.description ?? '',
                  thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
                  subscriberCount: stats?.subscriberCount ?? '',
                  url: stats?.customUrl ? `https://www.youtube.com/${stats.customUrl}` : `https://www.youtube.com/channel/${channelId}`,
                }
              })
            return json(response, { query, results })
          }

          clearTimeout(timeout)
          const results = (payload.items ?? [])
            .filter((item) => item.id?.videoId)
            .map((item) => ({
              videoId: item.id!.videoId!,
              title: item.snippet?.title ?? '',
              channelTitle: item.snippet?.channelTitle ?? '',
              publishedAt: item.snippet?.publishedAt ?? '',
              thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
              url: `https://www.youtube.com/watch?v=${item.id!.videoId}`,
            }))
          json(response, { query, results })
        } catch (error) {
          response.statusCode = 502
          response.end(error instanceof Error && error.name === 'AbortError' ? 'YouTube 검색 시간이 초과되었습니다.' : error instanceof Error ? error.message : 'YouTube 검색 실패')
        }
      })

      server.middlewares.use('/api/studio/commons-image-search', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const query = requestUrl.searchParams.get('q')?.trim() ?? ''
        if (query.length < 2) {
          response.statusCode = 400
          return response.end('검색어를 두 글자 이상 입력하세요.')
        }
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12_000)
          const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
          searchUrl.search = new URLSearchParams({
            action: 'query', format: 'json', origin: '*',
            generator: 'search', gsrsearch: `${query} filetype:bitmap|drawing`, gsrnamespace: '6', gsrlimit: '12',
            prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '480',
            iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl',
          }).toString()
          const apiResponse = await fetch(searchUrl, { signal: controller.signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor)' } })
          clearTimeout(timeout)
          if (!apiResponse.ok) throw new Error(`Commons 응답 오류 (${apiResponse.status})`)
          const payload = await apiResponse.json() as {
            query?: { pages?: Record<string, {
              title?: string
              imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }>
            }> }
          }
          const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
          const results = Object.values(payload.query?.pages ?? {})
            .map((page) => ({ title: page.title ?? '', info: page.imageinfo?.[0] }))
            .filter((entry): entry is { title: string; info: NonNullable<typeof entry.info> } => Boolean(entry.info && entry.info.mime?.startsWith('image/')))
            .map((entry) => {
              const meta = entry.info.extmetadata ?? {}
              const licenseShort = meta.LicenseShortName?.value ? stripHtml(meta.LicenseShortName.value) : ''
              return {
                fileName: entry.title,
                thumbUrl: entry.info.thumburl ?? entry.info.url ?? '',
                originalUrl: entry.info.url ?? '',
                sourceUrl: entry.info.descriptionurl ?? '',
                creator: meta.Artist?.value ? stripHtml(meta.Artist.value) : '',
                license: /public domain|pd-/i.test(licenseShort) ? 'Public domain' : licenseShort,
                licenseUrl: meta.LicenseUrl?.value ?? '',
              }
            })
            .filter((item) => item.originalUrl && item.sourceUrl)
          json(response, { query, results })
        } catch (error) {
          response.statusCode = 502
          response.end(error instanceof Error && error.name === 'AbortError' ? 'Commons 검색 시간이 초과되었습니다.' : error instanceof Error ? error.message : 'Commons 검색 실패')
        }
      })

      server.middlewares.use('/api/studio/catalog', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(catalogPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 5_000_000)
          const bands = payload.bands as CatalogBandPayload[] | undefined
          if (![1, 2].includes(Number(payload.schemaVersion)) || !Array.isArray(bands)) throw new Error('지원하지 않는 카탈로그 형식입니다.')
          // Optimistic concurrency check: the browser sends the updatedAt it last knew about. If the file
          // on disk has since moved on (another save, a git checkout, a restored backup...), refuse to
          // blindly overwrite it — this is exactly the class of bug that silently reverted a day's worth
          // of edits when a long-stale Studio tab saved over newer committed data.
          const currentOnDisk = JSON.parse(await readFile(catalogPath, 'utf8')) as JsonObject
          if (typeof payload.updatedAt === 'string' && payload.updatedAt !== currentOnDisk.updatedAt) {
            response.statusCode = 409
            response.end('저장 충돌: 이 브라우저를 열어둔 사이 다른 곳에서 카탈로그가 이미 바뀌었습니다(다른 탭에서 저장했거나, Git 작업이 있었을 수 있습니다). 새로고침한 뒤 다시 편집·저장해주세요.')
            return
          }
          await validateCatalogBands(bands)
          const pendingRelations = Array.isArray(payload.pendingRelations) ? payload.pendingRelations : (currentOnDisk.pendingRelations ?? [])
          validatePendingRelations(pendingRelations as unknown[], bands)
          await archiveCatalog(typeof payload.changeNote === 'string' ? payload.changeNote : 'Studio 저장')
          const nextCatalog = { schemaVersion: 2, updatedAt: new Date().toISOString(), bands, pendingRelations }
          await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextCatalog.updatedAt, count: bands.length })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '카탈로그 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/catalog-history', async (request, response, next) => {
        if (request.method === 'GET') {
          const history = await readHistory()
          json(response, { entries: history.map(({ catalog, ...entry }) => ({ ...entry, count: Array.isArray(catalog.bands) ? catalog.bands.length : 0 })) })
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 복구는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 100_000)
          const history = await readHistory()
          const entry = history.find((item) => item.id === payload.id)
          if (!entry) throw new Error('복구할 이력을 찾지 못했습니다.')
          await archiveCatalog('이력 복구 직전 자동 백업')
          const restored: JsonObject = { ...entry.catalog, updatedAt: new Date().toISOString() }
          await writeFile(catalogPath, `${JSON.stringify(restored, null, 2)}\n`, 'utf8')
          json(response, { ok: true, count: Array.isArray(restored.bands) ? restored.bands.length : 0 })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '이력 복구 실패')
        }
      })

      server.middlewares.use('/api/studio/genres', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(genresPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 500_000)
          const genres = payload.genres as Array<{ id?: string; name?: string; color?: string }> | undefined
          if (payload.schemaVersion !== 1 || !Array.isArray(genres) || genres.length !== 8) throw new Error('기존 장르 8개가 모두 필요합니다.')
          if (genres.some((genre) => !genre.id || !genre.name || !/^#[0-9a-f]{6}$/i.test(genre.color ?? ''))) throw new Error('장르 이름과 색상을 확인하세요.')
          const nextGenres = { schemaVersion: 1, updatedAt: new Date().toISOString(), genres }
          await writeFile(genresPath, `${JSON.stringify(nextGenres, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextGenres.updatedAt })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '장르 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/taxonomy', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(taxonomyPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 1_000_000)
          const genres = payload.genres as Array<{ id?: string; name?: string; displayName?: string; englishName?: string; description?: string; vibeDescription?: string; color?: string; order?: number }> | undefined
          const subgenres = payload.subgenres as unknown[] | undefined
          const moods = payload.moods as Array<{ id?: string; groupId?: string; name?: string; description?: string; order?: number }> | undefined
          if (payload.schemaVersion !== 2 || !Array.isArray(genres) || genres.length !== 13 || !Array.isArray(subgenres) || !Array.isArray(moods)) throw new Error('13장르 분류 체계 전체가 필요합니다.')
          const genreIds = genres.map((genre) => genre.id)
          if (genreIds.some((id) => !id) || new Set(genreIds).size !== genreIds.length) throw new Error('장르 ID가 비어 있거나 중복되었습니다.')
          if (genres.some((genre) => !genre.name?.trim() || !genre.displayName?.trim() || !genre.englishName?.trim() || !genre.description?.trim() || !genre.vibeDescription?.trim() || !/^#[0-9a-f]{6}$/i.test(genre.color ?? ''))) throw new Error('장르 이름·설명·색상을 모두 확인하세요.')
          const moodIds = moods.map((mood) => mood.id)
          if (moods.length !== 24 || moodIds.some((id) => !id) || new Set(moodIds).size !== moodIds.length || moods.some((mood) => !mood.name?.trim() || !mood.description?.trim() || !mood.groupId)) throw new Error('24개 분위기 카드의 이름과 설명을 확인하세요.')
          const nextTaxonomy = { ...payload, updatedAt: new Date().toISOString(), genres: genres.map((genre, index) => ({ ...genre, order: index + 1 })) }
          await writeFile(taxonomyPath, `${JSON.stringify(nextTaxonomy, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextTaxonomy.updatedAt, count: genres.length })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '13장르 분류 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/site-content', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(siteContentPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 200_000)
          const requiredStrings = [
            'brandSuffix', 'heroTitle', 'heroDescription', 'genreSectionLabel', 'genreSectionTitle', 'genreSectionDescription',
            'manifestoLabel', 'manifestoTitle', 'manifestoButtonLabel',
            'moodSectionLabel', 'moodSectionTitle', 'moodSectionDescription',
            'allBandsSectionLabel', 'allBandsSectionTitle', 'allBandsSectionDescription',
            'headerTagline', 'suggestionButtonLabel', 'suggestionLinkUrl', 'footerTagline', 'footerDescription', 'footerLocation',
          ]
          if (![1, 2].includes(Number(payload.schemaVersion)) || requiredStrings.some((key) => typeof payload[key] !== 'string')) throw new Error('지원하지 않는 사이트 설정 형식입니다.')
          if (!(payload.heroTitle as string).trim() || !(payload.genreSectionTitle as string).trim()) throw new Error('메인·장르 제목은 비워 둘 수 없습니다.')
          if (!payload.theme || !payload.sectionVisibility || !Array.isArray(payload.sectionOrder)) throw new Error('테마와 섹션 설정이 누락되었습니다.')
          if (Number(payload.schemaVersion) >= 2 && (!payload.genreVisuals || typeof payload.genreVisuals !== 'object')) throw new Error('장르 카드 디자인 설정이 누락되었습니다.')
          if (Number(payload.schemaVersion) >= 2 && (!payload.explorerVisuals || typeof payload.explorerVisuals !== 'object')) throw new Error('탐색 카드 디자인 설정이 누락되었습니다.')
          const nextContent = { ...payload, updatedAt: new Date().toISOString() }
          await writeFile(siteContentPath, `${JSON.stringify(nextContent, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextContent.updatedAt })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '사이트 설정 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/upload', async (request, response, next) => {
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 업로드는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 8_000_000)
          const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : ''
          const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/)
          if (!match) throw new Error('PNG, JPG, WebP 이미지만 업로드할 수 있습니다.')
          const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
          const buffer = Buffer.from(match[2], 'base64')
          if (buffer.length > 5_000_000) throw new Error('이미지는 5MB 이하여야 합니다.')
          await mkdir(uploadsPath, { recursive: true })
          const assetType = typeof payload.assetType === 'string' && ['hero', 'wordmark', 'cosmic', 'genre'].includes(payload.assetType)
            ? payload.assetType
            : 'image'
          const assetKey = typeof payload.assetKey === 'string'
            ? payload.assetKey.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
            : ''
          const fileName = `${assetType}${assetKey ? `-${assetKey}` : ''}-${Date.now()}.${extension}`
          await writeFile(resolve(uploadsPath, fileName), buffer)
          json(response, { ok: true, url: `./uploads/${fileName}` })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '이미지 업로드 실패')
        }
      })

      server.middlewares.use('/api/studio/upload-font', async (request, response, next) => {
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 업로드는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 13_000_000)
          const fileName = typeof payload.fileName === 'string' ? payload.fileName : ''
          const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
          if (!['woff2', 'woff', 'ttf', 'otf'].includes(extension)) throw new Error('WOFF2, WOFF, TTF, OTF 폰트만 업로드할 수 있습니다.')
          const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : ''
          const base64 = dataUrl.match(/^data:[^;]*;base64,(.+)$/)?.[1]
          if (!base64) throw new Error('폰트 파일을 읽지 못했습니다.')
          const buffer = Buffer.from(base64, 'base64')
          if (buffer.length > 9_000_000) throw new Error('폰트는 9MB 이하여야 합니다.')
          await mkdir(fontUploadsPath, { recursive: true })
          const safeBase = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'custom-font'
          const storedName = `${safeBase}-${Date.now()}.${extension}`
          await writeFile(resolve(fontUploadsPath, storedName), buffer)
          const format = extension === 'ttf' ? 'truetype' : extension === 'otf' ? 'opentype' : extension
          json(response, { ok: true, url: `./uploads/fonts/${storedName}`, format, name: safeBase })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '폰트 업로드 실패')
        }
      })
    },
  }
}
