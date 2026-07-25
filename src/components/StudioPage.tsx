import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Database, Download, ExternalLink, FileUp, Link2, Loader2, Palette, Plus, Save, Search, Sparkles, Wand2 } from 'lucide-react'
import { bands as initialBands, catalogFile } from '../data/bands'
import { eras } from '../data/eras'
import { genres as initialGenres } from '../data/genres'
import { siteContent, type SiteContent } from '../data/siteContent'
import { taxonomy, taxonomyGenreById, taxonomyGenres, taxonomyMoods, taxonomySubgenreById } from '../data/taxonomy'
import type { Band, BandEraTag, BandTaxonomyV2, EraId, GenreId, Member, Relation, RelationKind, SourceRef, Track } from '../types/music'
import type { GenreTaxonomyId, MoodGroupId, MoodId, MoodScore } from '../types/taxonomy'
import { scoreBandSimilarity } from '../lib/bandSimilarity'
import { finalizeIntakeBand, lookupCommonsImage, type CommonsLookupResult } from '../lib/bandIntake'
import { BandIntakePanel } from './BandIntakePanel'
import { DesignStudioPanel } from './DesignStudioPanel'
import { DataManagerPanel, type DeletedBandRecord } from './DataManagerPanel'
import { ExternalSourceFinder, type ExternalCandidate } from './ExternalSourceFinder'

const relationLabels: Record<RelationKind, string> = {
  'sounds-like': '비슷한 소리',
  'influenced-by': '영향을 받음',
  influenced: '영향을 줌',
  'shared-scene': '같은 장면',
  evolution: '계보의 확장',
}

const moodGroupLabels: Record<MoodGroupId, string> = {
  energy: '에너지와 속도',
  emotion: '감정과 정서',
  texture: '공간감과 음색',
  listening: '구성과 감상 방식',
}

const legacyGenreByTaxonomy: Record<GenreTaxonomyId, GenreId> = {
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

const clone = <T,>(value: T): T => structuredClone(value)
const splitList = (value: string | undefined) => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
const slugify = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const asEra = (year: number): EraId => {
  const decade = Math.floor(year / 10) * 10
  const candidate = `${Math.min(2020, Math.max(1960, decade))}s` as EraId
  return eras.some((era) => era.id === candidate) ? candidate : '2020s'
}

function createTaxonomyDraft(): BandTaxonomyV2 {
  return {
    primaryGenreId: 'classic-roots-rock',
    secondaryGenreIds: [],
    subgenreIds: [],
    moodScores: {},
    reviewStatus: 'draft',
    reviewNote: 'Studio에서 생성한 taxonomy v2 초안',
  }
}

function createDraftBand(): Band {
  const year = new Date().getFullYear()
  const name = '새 밴드'
  return {
    id: `new-band-${Date.now()}`,
    name,
    formed: year,
    origin: '',
    countryCode: '',
    activeYears: `${year}–현재`,
    primaryGenre: 'classic-rock',
    genreIds: ['classic-rock'],
    subgenres: [],
    eraTags: [{ era: asEra(year), genreIds: ['classic-rock'], subgenres: [], note: '' }],
    tags: [],
    summary: '',
    style: '',
    image: {
      wikipediaTitle: name,
      alt: `${name} 밴드 사진`,
      credit: { sourceUrl: '', license: '검토 필요', reviewStatus: 'needs-review' },
    },
    members: [],
    tracks: [],
    relations: [],
    sources: [
      { label: `${name} — Wikipedia`, url: 'https://en.wikipedia.org/', publisher: 'Wikipedia', note: 'Studio 신규 초안' },
      { label: `${name} — Wikidata`, url: 'https://www.wikidata.org/', publisher: 'Wikidata', note: '식별자 연결 대기' },
      { label: `${name} — MusicBrainz`, url: 'https://musicbrainz.org/', publisher: 'MusicBrainz', note: '식별자 연결 대기' },
      { label: `${name} — 공식 YouTube`, url: 'https://www.youtube.com/', publisher: 'YouTube', official: false, note: '공식 채널 연결 대기' },
    ],
    taxonomyV2: createTaxonomyDraft(),
    reviewStatus: 'draft',
  }
}

const membersToText = (members: Member[]) => members.map((member) => [member.name, member.role, member.status, member.activeYears ?? ''].join(' | ')).join('\n')
const tracksToText = (tracks: Track[]) => tracks.map((track) => [track.title, track.youtubeId, track.year ?? '', track.album ?? '', track.guide ?? ''].join(' | ')).join('\n')
const youtubeIdFromInput = (value: string | undefined) => {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0]
    if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] ?? ''
    return url.searchParams.get('v') ?? trimmed
  } catch {
    return trimmed
  }
}
const youtubeTrackUrl = (bandName: string, trackTitle: string, youtubeId: string) => youtubeId
  ? `https://www.youtube.com/watch?v=${youtubeId}`
  : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${bandName} ${trackTitle}`)}`
const erasToText = (eraTags: BandEraTag[]) => eraTags.map((tag) => [tag.era, tag.subgenres.join(', '), tag.note ?? ''].join(' | ')).join('\n')

function parseMembers(value: string): Member[] {
  return value.split(/\r?\n/).map((line) => line.split('|').map((item) => item.trim())).filter(([name]) => Boolean(name)).map(([name, role, status, activeYears]) => ({
    name,
    role: role || '역할 미정',
    status: status === 'former' || status === 'touring' ? status : 'current',
    activeYears: activeYears || undefined,
  }))
}

function parseTracks(value: string, current: Track[], bandName: string): Track[] {
  const usedIds = new Set<string>()
  return value.split(/\r?\n/).map((line) => line.split('|').map((item) => item.trim())).filter(([title]) => Boolean(title)).map(([title, youtubeInput, year, album, guide], index) => {
    const youtubeId = youtubeIdFromInput(youtubeInput)
    const existing = current.find((track) => track.youtubeId === youtubeId && youtubeId) ?? current.find((track) => track.title === title)
    const baseId = slugify(title) || `track-${index + 1}`
    let id = existing?.id ?? baseId
    while (usedIds.has(id)) id = `${baseId}-${index + 1}`
    usedIds.add(id)
    if (existing) {
      const videoChanged = existing.youtubeId !== youtubeId
      const youtubeUrl = youtubeTrackUrl(bandName, title, youtubeId)
      return {
        ...existing,
        id,
        title,
        youtubeId,
        year: Number(year) || undefined,
        album: album || undefined,
        guide: guide || undefined,
        reviewStatus: videoChanged ? 'draft' : existing.reviewStatus,
        source: videoChanged ? {
          ...existing.source,
          url: youtubeUrl,
          official: false,
          channelName: undefined,
          channelType: undefined,
          embedStatus: undefined,
          embedCheckedAt: undefined,
          note: '대표곡 외부 링크 변경됨 · 제목과 연결 대상 재검수 필요',
        } : existing.source,
      }
    }
    return {
      id,
      title,
      youtubeId,
      year: Number(year) || undefined,
      album: album || undefined,
      guide: guide || undefined,
      reviewStatus: 'draft',
      source: {
        label: `${title} — YouTube`,
        url: youtubeTrackUrl(bandName, title, youtubeId),
        publisher: 'YouTube',
        official: false,
        note: youtubeId ? 'Studio에서 추가한 대표곡 외부 링크 · 연결 대상 검수 필요' : '직접 영상이 없어 밴드명·곡명 YouTube 검색 링크를 사용합니다.',
      },
    }
  })
}

function parseEraTags(value: string, genreIds: GenreId[], current: BandEraTag[]): BandEraTag[] {
  return value.split(/\r?\n/).map((line) => line.split('|').map((item) => item.trim())).filter(([era]) => eras.some((item) => item.id === era)).map(([era, subgenres, note]) => ({
    era: era as EraId,
    genreIds: current.find((item) => item.era === era)?.genreIds ?? genreIds,
    subgenres: splitList(subgenres),
    note: note || undefined,
  }))
}

function sourceId(band: Band, publisher: SourceRef['publisher']) {
  return band.sources.find((source) => source.publisher === publisher)?.externalId ?? ''
}

function sourceUrl(band: Band, publisher: SourceRef['publisher']) {
  return band.sources.find((source) => source.publisher === publisher)?.url ?? ''
}

function updateYoutubeSource(band: Band, url: string): Band {
  const sources = [...band.sources]
  const index = sources.findIndex((source) => source.publisher === 'YouTube')
  const source: SourceRef = {
    ...(index >= 0 ? sources[index] : { label: `${band.name} — 공식 YouTube`, publisher: 'YouTube' }),
    label: `${band.name} — 공식 YouTube`,
    publisher: 'YouTube',
    url: url || 'https://www.youtube.com/',
    official: Boolean(url),
    externalId: url.match(/(?:channel\/|youtube\.com\/)(UC[\w-]+|@[\w.-]+)/)?.[1],
    note: url ? '외부 재생 제한 시 사용하는 공식 채널 링크' : '공식 채널 연결 대기',
  }
  if (index >= 0) sources[index] = source
  else sources.push(source)
  return { ...band, sources }
}

function applyCommonsLookup(band: Band, lookup: CommonsLookupResult): Band {
  if (!lookup.ok || !lookup.originalUrl || !lookup.sourceUrl) return band
  const verified = Boolean(lookup.license && (lookup.license === 'Public domain' || lookup.licenseUrl))
  const sources = band.sources.filter((source) => !(source.publisher === 'Wikimedia Commons' && source.url !== lookup.sourceUrl))
  const hasSource = sources.some((source) => source.publisher === 'Wikimedia Commons' && source.url === lookup.sourceUrl)
  return {
    ...band,
    image: {
      ...band.image,
      fileName: lookup.fileName ?? band.image.fileName,
      originalUrl: lookup.originalUrl,
      displayUrl: lookup.displayUrl ?? lookup.originalUrl,
      credit: {
        sourceUrl: lookup.sourceUrl,
        creator: lookup.creator ?? band.image.credit.creator,
        license: lookup.license ?? band.image.credit.license,
        licenseUrl: lookup.license === 'Public domain' ? undefined : lookup.licenseUrl,
        reviewStatus: verified ? 'verified' : 'needs-review',
        reviewedAt: verified ? new Date().toISOString() : undefined,
      },
    },
    sources: hasSource ? sources : [...sources, { label: `${band.name} — Wikimedia Commons`, url: lookup.sourceUrl, publisher: 'Wikimedia Commons', note: 'Commons API로 자동 확인한 이미지 출처' }],
  }
}

function updateExternalSource(band: Band, publisher: 'Wikidata' | 'MusicBrainz', externalId: string): Band {
  const sources = [...band.sources]
  const index = sources.findIndex((source) => source.publisher === publisher)
  const url = publisher === 'Wikidata'
    ? externalId ? `https://www.wikidata.org/wiki/${externalId}` : 'https://www.wikidata.org/'
    : externalId ? `https://musicbrainz.org/artist/${externalId}` : 'https://musicbrainz.org/'
  const source: SourceRef = {
    ...(index >= 0 ? sources[index] : { label: `${band.name} — ${publisher}`, publisher }),
    label: `${band.name} — ${publisher}`,
    publisher,
    url,
    externalId: externalId || undefined,
    note: externalId ? 'Studio에서 연결한 외부 식별자' : '식별자 연결 대기',
  }
  if (index >= 0) sources[index] = source
  else sources.push(source)
  return { ...band, sources }
}

function completeness(band: Band) {
  return [
    { label: '기본 정보', passed: Boolean(band.name && band.origin && band.countryCode && band.formed) },
    { label: '소개·소리 설명', passed: band.summary.length >= 30 && band.style.length >= 40 },
    { label: '장르·시대', passed: band.subgenres.length > 0 && band.eraTags.length > 0 },
    { label: '멤버·대표곡', passed: band.members.length > 0 && band.tracks.length > 0 },
    { label: '이미지 권리', passed: band.image.credit.reviewStatus === 'verified' },
    { label: '관계', passed: band.relations.length > 0 },
    { label: '새 탐색 분류', passed: Boolean(band.taxonomyV2?.primaryGenreId && band.taxonomyV2.subgenreIds.length && Object.keys(band.taxonomyV2.moodScores).length) },
  ]
}

function suggestionScore(subject: Band, candidate: Band) {
  if (subject.taxonomyV2 && candidate.taxonomyV2) {
    const result = scoreBandSimilarity(subject, candidate)
    return { score: result.score, reason: result.reasons.join(', ') || '새 장르·분위기·시대 교차' }
  }
  let score = subject.primaryGenre === candidate.primaryGenre ? 5 : 0
  const reasons: string[] = []
  const commonGenres = subject.genreIds.filter((item) => candidate.genreIds.includes(item))
  const commonSubgenres = subject.subgenres.filter((item) => candidate.subgenres.some((other) => other.toLocaleLowerCase() === item.toLocaleLowerCase()))
  const commonTags = subject.tags.filter((item) => candidate.tags.some((other) => other.toLocaleLowerCase() === item.toLocaleLowerCase()))
  const commonEras = subject.eraTags.filter((item) => candidate.eraTags.some((other) => other.era === item.era)).map((item) => item.era)
  score += commonGenres.length * 2 + commonSubgenres.length * 3 + commonTags.length * 2 + commonEras.length
  if (commonSubgenres.length) reasons.push(commonSubgenres.slice(0, 2).join(' · '))
  if (commonTags.length) reasons.push(commonTags.slice(0, 2).join(' · '))
  if (!reasons.length && commonEras.length) reasons.push(`${commonEras[0]} 활동 시기`)
  return { score, reason: reasons.join(', ') || '주 장르와 시대 교차' }
}

export function StudioPage() {
  const [workspace, setWorkspace] = useState<'design' | 'data'>(() => window.location.hash === '#design' ? 'design' : 'data')
  const [catalogBands, setCatalogBands] = useState<Band[]>(() => clone(initialBands))
  const [selectedId, setSelectedId] = useState(initialBands[0]?.id ?? '')
  const [draft, setDraft] = useState<Band>(() => clone(initialBands[0] ?? createDraftBand()))
  const editorTitleRef = useRef<HTMLElement>(null)
  const isFirstSelection = useRef(true)

  useEffect(() => {
    if (isFirstSelection.current) { isFirstSelection.current = false; return }
    editorTitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedId])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('카탈로그를 불러왔습니다.')
  const [dirty, setDirty] = useState(false)
  const [commonsBusy, setCommonsBusy] = useState(false)
  const [commonsMessage, setCommonsMessage] = useState('')
  const [catalogDirty, setCatalogDirty] = useState(false)
  // Tracks the updatedAt this tab last confirmed matches disk — seeded from the bundle's load-time
  // snapshot, then advanced after every successful save so same-session saves keep working normally.
  // A long-idle tab whose bundle never reloaded will keep sending its stale value, which is exactly
  // what lets the server detect "disk moved on without me" and refuse to overwrite it.
  const [catalogBaseline, setCatalogBaseline] = useState(catalogFile.updatedAt)
  const [siteDraft, setSiteDraft] = useState<SiteContent>(() => clone(siteContent))
  const [siteDirty, setSiteDirty] = useState(false)
  const [siteMessage, setSiteMessage] = useState('현재 메인 화면 문구입니다.')
  const studioGenres = initialGenres
  const [taxonomyGenreDrafts, setTaxonomyGenreDrafts] = useState(() => clone(taxonomyGenres))
  const [taxonomyMoodDrafts, setTaxonomyMoodDrafts] = useState(() => clone(taxonomyMoods))
  const [taxonomyDirty, setTaxonomyDirty] = useState(false)
  const [taxonomyMessage, setTaxonomyMessage] = useState('현재 13개 장르 카드입니다.')
  const [trash, setTrash] = useState<DeletedBandRecord[]>([])
  const importRef = useRef<HTMLInputElement>(null)
  const isExisting = catalogBands.some((band) => band.id === selectedId)

  useEffect(() => {
    const syncWorkspace = () => setWorkspace(window.location.hash === '#design' ? 'design' : 'data')
    window.addEventListener('hashchange', syncWorkspace)
    return () => window.removeEventListener('hashchange', syncWorkspace)
  }, [])

  const openWorkspace = (next: 'design' | 'data') => {
    setWorkspace(next)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${next}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filteredBands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return catalogBands.filter((band) => !normalized || `${band.name} ${band.id} ${band.subgenres.join(' ')}`.toLocaleLowerCase().includes(normalized))
  }, [catalogBands, query])

  const suggestions = useMemo(() => catalogBands
    .filter((band) => band.id !== draft.id && !draft.relations.some((relation) => relation.targetBandId === band.id))
    .map((band) => ({ band, ...suggestionScore(draft, band) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.band.name.localeCompare(right.band.name))
    .slice(0, 6), [catalogBands, draft])

  const taxonomyDraft = draft.taxonomyV2 ?? createTaxonomyDraft()
  const activeTaxonomyGenreIds = [taxonomyDraft.primaryGenreId, ...taxonomyDraft.secondaryGenreIds]
  const taxonomyGenreDraftById = useMemo(() => Object.fromEntries(taxonomyGenreDrafts.map((genre) => [genre.id, genre])), [taxonomyGenreDrafts])
  const availableSubgenreIds = useMemo(() => {
    const related = activeTaxonomyGenreIds.flatMap((id) => taxonomyGenreDraftById[id]?.subgenreIds ?? [])
    return [...new Set([...related, ...taxonomyDraft.subgenreIds])]
  }, [activeTaxonomyGenreIds, taxonomyDraft.subgenreIds, taxonomyGenreDraftById])

  const checks = completeness(draft)
  const passedChecks = checks.filter((check) => check.passed).length

  const change = (patch: Partial<Band>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const changeTaxonomy = (patch: Partial<BandTaxonomyV2>) => {
    const nextTaxonomy = { ...taxonomyDraft, ...patch, reviewStatus: patch.reviewStatus ?? 'draft' }
    const legacyGenreIds = [...new Set([nextTaxonomy.primaryGenreId, ...nextTaxonomy.secondaryGenreIds].map((id) => legacyGenreByTaxonomy[id]))]
    const primaryGenre = legacyGenreByTaxonomy[nextTaxonomy.primaryGenreId]
    change({
      taxonomyV2: nextTaxonomy,
      primaryGenre,
      genreIds: legacyGenreIds,
      subgenres: nextTaxonomy.subgenreIds.map((id) => taxonomySubgenreById[id]?.name ?? id),
      eraTags: draft.eraTags.map((tag) => ({ ...tag, genreIds: legacyGenreIds })),
    })
  }

  const updateTaxonomyPrimary = (primaryGenreId: GenreTaxonomyId) => {
    changeTaxonomy({
      primaryGenreId,
      secondaryGenreIds: taxonomyDraft.secondaryGenreIds.filter((id) => id !== primaryGenreId),
      reviewStatus: 'draft',
    })
  }

  const toggleTaxonomySecondary = (genreId: GenreTaxonomyId) => {
    if (genreId === taxonomyDraft.primaryGenreId) return
    const secondaryGenreIds = taxonomyDraft.secondaryGenreIds.includes(genreId)
      ? taxonomyDraft.secondaryGenreIds.filter((id) => id !== genreId)
      : [...taxonomyDraft.secondaryGenreIds, genreId]
    changeTaxonomy({ secondaryGenreIds, reviewStatus: 'draft' })
  }

  const toggleTaxonomySubgenre = (subgenreId: string) => {
    const subgenreIds = taxonomyDraft.subgenreIds.includes(subgenreId)
      ? taxonomyDraft.subgenreIds.filter((id) => id !== subgenreId)
      : [...taxonomyDraft.subgenreIds, subgenreId]
    changeTaxonomy({ subgenreIds, reviewStatus: 'draft' })
  }

  const updateMoodScore = (moodId: MoodId, score: MoodScore) => {
    const moodScores = { ...taxonomyDraft.moodScores }
    if (score === 0) delete moodScores[moodId]
    else moodScores[moodId] = score
    changeTaxonomy({ moodScores, reviewStatus: 'draft' })
  }

  const changeSite = (patch: Partial<SiteContent>) => {
    setSiteDraft((current) => ({ ...current, ...patch }))
    setSiteDirty(true)
  }

  const changeTaxonomyGenres = (nextGenres: typeof taxonomyGenreDrafts) => {
    setTaxonomyGenreDrafts(nextGenres)
    setTaxonomyDirty(true)
  }

  const changeTaxonomyMoods = (nextMoods: typeof taxonomyMoodDrafts) => {
    setTaxonomyMoodDrafts(nextMoods)
    setTaxonomyDirty(true)
  }

  const selectExternalCandidate = (publisher: 'Wikidata' | 'MusicBrainz', candidate: ExternalCandidate) => {
    setDraft((current) => {
      const withSource = updateExternalSource(current, publisher, candidate.id)
      if (publisher === 'Wikidata') return withSource
      const beginYear = Number(candidate.begin?.slice(0, 4))
      const formed = Number.isFinite(beginYear) && beginYear > 1800 ? beginYear : current.formed
      const activeYears = candidate.begin
        ? `${candidate.begin.slice(0, 4)}–${candidate.ended && candidate.end ? candidate.end.slice(0, 4) : '현재'}`
        : current.activeYears
      return {
        ...withSource,
        formed,
        activeYears,
        origin: candidate.area || current.origin,
        countryCode: candidate.country || current.countryCode,
      }
    })
    setDirty(true)
    setMessage(`${publisher} 후보 ${candidate.name}을(를) 연결했습니다. MusicBrainz 후보는 결성지·국가·활동연도도 반영됩니다.`)
  }

  const runCommonsLookup = async () => {
    const hint = draft.image.credit.sourceUrl.trim() || draft.image.fileName?.trim() || ''
    if (!hint) { setCommonsMessage('Commons 파일 페이지 주소 또는 파일명을 먼저 입력하세요.'); return }
    setCommonsBusy(true)
    setCommonsMessage('Wikimedia Commons에서 저작자·라이선스를 조회하는 중…')
    const lookup = await lookupCommonsImage(hint, draft.name)
    if (lookup.ok) {
      setDraft((current) => applyCommonsLookup(current, lookup))
      setDirty(true)
      setCommonsMessage(lookup.license === 'Public domain' || lookup.licenseUrl
        ? `자동 확인 완료: ${lookup.license}. 권리 검수가 자동으로 '검수 완료'로 바뀌었습니다.`
        : '파일은 찾았지만 라이선스 URL이 없어 자동 검수하지 못했습니다. 직접 확인해주세요.')
    } else {
      setCommonsMessage(`자동 확인 실패: ${lookup.error ?? '알 수 없는 오류'}`)
    }
    setCommonsBusy(false)
  }

  const saveSiteContent = async () => {
    try {
      const response = await fetch('/api/studio/site-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteDraft),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json() as { updatedAt: string }
      setSiteDraft((current) => ({ ...current, updatedAt: result.updatedAt }))
      setSiteDirty(false)
      setSiteMessage(`사이트 문구 저장 완료 · ${new Date(result.updatedAt).toLocaleTimeString('ko-KR')}`)
    } catch (error) {
      setSiteMessage(`저장 실패: ${error instanceof Error ? error.message : '로컬 Studio 서버를 확인하세요.'}`)
    }
  }

  const saveTaxonomyGenres = async () => {
    try {
      const response = await fetch('/api/studio/taxonomy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...taxonomy, genres: taxonomyGenreDrafts, moods: taxonomyMoodDrafts }) })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json() as { updatedAt: string }
      setTaxonomyDirty(false)
      setTaxonomyMessage(`13장르 카드 저장 완료 · ${new Date(result.updatedAt).toLocaleTimeString('ko-KR')}`)
    } catch (error) { setTaxonomyMessage(`저장 실패: ${error instanceof Error ? error.message : '서버를 확인하세요.'}`) }
  }

  const chooseBand = async (band: Band) => {
    if (dirty) {
      const saved = await saveCatalog()
      if (!saved) {
        if (!window.confirm('현재 밴드 저장에 실패했습니다. 변경사항을 버리고 다른 밴드로 이동할까요?')) return
      }
    }
    setSelectedId(band.id)
    setDraft(clone(band))
    setDirty(false)
    setMessage(`${band.name} 편집 중`)
  }

  const addNewBand = async () => {
    if (dirty) {
      const saved = await saveCatalog()
      if (!saved) {
        if (!window.confirm('현재 밴드 저장에 실패했습니다. 변경사항을 버리고 새 밴드를 만들까요?')) return
      }
    }
    const next = createDraftBand()
    setSelectedId(next.id)
    setDraft(next)
    setDirty(true)
    setMessage('새 밴드는 초안으로 시작합니다.')
  }

  const updatePrimaryGenre = (primaryGenre: GenreId) => {
    const genreIds = [primaryGenre, ...draft.genreIds.filter((id) => id !== primaryGenre)]
    change({ primaryGenre, genreIds, eraTags: draft.eraTags.map((tag) => ({ ...tag, genreIds: tag.genreIds.includes(primaryGenre) ? tag.genreIds : [primaryGenre, ...tag.genreIds] })) })
  }

  const toggleSecondaryGenre = (genreId: GenreId) => {
    if (genreId === draft.primaryGenre) return
    const genreIds = draft.genreIds.includes(genreId) ? draft.genreIds.filter((id) => id !== genreId) : [...draft.genreIds, genreId]
    change({ genreIds })
  }

  const updateRelation = (index: number, patch: Partial<Relation>) => {
    const relations = draft.relations.map((relation, relationIndex) => relationIndex === index ? { ...relation, ...patch, reviewStatus: 'draft' as const } : relation)
    change({ relations })
  }

  const addRelation = (targetBandId?: string, note?: string, score = 1) => {
    const target = targetBandId ?? catalogBands.find((band) => band.id !== draft.id && !draft.relations.some((relation) => relation.targetBandId === band.id))?.id
    if (!target) return
    change({ relations: [...draft.relations, { targetBandId: target, kind: 'sounds-like', strength: score >= 10 ? 3 : score >= 6 ? 2 : 1, note: note ?? '연결 이유를 입력하세요.', reviewStatus: 'draft' }] })
  }

  const persistBands = async (nextBands: Band[], changeNote: string) => {
    const response = await fetch('/api/studio/catalog', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: catalogFile.schemaVersion, updatedAt: catalogBaseline, bands: nextBands, changeNote }),
    })
    if (!response.ok) throw new Error(await response.text())
    const result = await response.json() as { updatedAt: string; count: number }
    setCatalogBands(nextBands)
    setCatalogDirty(false)
    setCatalogBaseline(result.updatedAt)
    return result
  }

  const saveCatalog = async (changeNote = `${draft.name} 편집`) => {
    const normalizedId = slugify(draft.id)
    if (!normalizedId || (!isExisting && catalogBands.some((band) => band.id === normalizedId))) {
      setMessage('저장 실패: 밴드 ID가 비어 있거나 중복되었습니다.')
      return false
    }
    const nextDraft = { ...draft, id: normalizedId, image: { ...draft.image, alt: draft.image.alt || `${draft.name} 밴드 사진` } }
    const nextBands = isExisting ? catalogBands.map((band) => band.id === selectedId ? nextDraft : band) : [nextDraft, ...catalogBands]
    try {
      const result = await persistBands(nextBands, changeNote)
      setSelectedId(normalizedId)
      setDraft(nextDraft)
      setDirty(false)
      setMessage(`${nextDraft.name} 저장 완료 · 전체 ${result.count}개 · ${new Date(result.updatedAt).toLocaleTimeString('ko-KR')}`)
      return true
    } catch (error) {
      setMessage(`저장 실패: ${error instanceof Error ? error.message : '로컬 Studio 서버를 확인하세요.'}`)
      return false
    }
  }

  const addBands = (newBands: Band[]) => {
    setCatalogBands((current) => {
      const ids = new Set(current.map((band) => band.id))
      const names = new Set(current.map((band) => band.name.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, '')))
      const safeDrafts = newBands.map(finalizeIntakeBand).filter((band) => {
        const nameKey = band.name.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, '')
        if (!band.id || !band.name || ids.has(band.id) || names.has(nameKey)) return false
        ids.add(band.id); names.add(nameKey)
        return true
      })
      return [...safeDrafts, ...current]
    })
    setCatalogDirty(true)
    setMessage(`${newBands.length}개 초안을 추가했습니다. 변경 저장을 눌러 적용하세요.`)
  }

  const updateManagedBand = (band: Band) => {
    setCatalogBands((current) => current.map((item) => item.id === band.id ? band : item))
    if (band.id === selectedId) setDraft(clone(band))
    setCatalogDirty(true)
  }

  const deleteManagedBand = (bandId: string) => {
    const band = catalogBands.find((item) => item.id === bandId)
    if (!band) return
    const affectedRelations = catalogBands.filter((item) => item.id !== bandId && item.relations.some((relation) => relation.targetBandId === bandId)).map((item) => ({ bandId: item.id, relations: item.relations.filter((relation) => relation.targetBandId === bandId) }))
    const nextBands = catalogBands.filter((item) => item.id !== bandId).map((item) => ({ ...item, relations: item.relations.filter((relation) => relation.targetBandId !== bandId) }))
    setTrash((current) => [{ band: clone(band), affectedRelations }, ...current.filter((record) => record.band.id !== bandId)])
    setCatalogBands(nextBands)
    setCatalogDirty(true)
    if (selectedId === bandId && nextBands[0]) { setSelectedId(nextBands[0].id); setDraft(clone(nextBands[0])); setDirty(false) }
    setMessage(`${band.name}을 휴지통으로 옮겼습니다. 저장 전 복구하거나 변경 저장으로 확정하세요.`)
  }

  const restoreManagedBand = (record: DeletedBandRecord) => {
    const nextBands = [...catalogBands, clone(record.band)].map((band) => {
      const affected = record.affectedRelations.find((item) => item.bandId === band.id)
      return affected ? { ...band, relations: [...band.relations, ...clone(affected.relations)] } : band
    })
    setCatalogBands(nextBands)
    setTrash((current) => current.filter((item) => item.band.id !== record.band.id))
    setSelectedId(record.band.id); setDraft(clone(record.band)); setCatalogDirty(true); setDirty(false)
    setMessage(`${record.band.name}과 연결 관계를 복구했습니다.`)
  }

  const saveEverything = async () => {
    if (workspace === 'design') {
      if (siteDirty) await saveSiteContent()
      if (taxonomyDirty) await saveTaxonomyGenres()
      return
    }
    await saveCatalog('Studio 데이터 저장')
  }

  const exportCatalog = () => {
    const blob = new Blob([`${JSON.stringify({ schemaVersion: catalogFile.schemaVersion, updatedAt: new Date().toISOString(), bands: catalogBands }, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rock-atlas-catalog-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importCatalog = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text()) as { schemaVersion?: number; bands?: Band[] }
      if (![1, 2].includes(payload.schemaVersion ?? 0) || !Array.isArray(payload.bands) || payload.bands.length === 0) throw new Error('지원하지 않는 파일입니다.')
      if (!window.confirm(`전체 백업 ${payload.bands.length}개로 현재 작업 목록을 교체할까요?\n\n새 밴드 추가에는 아래의 ‘새 밴드 검수함’을 사용하세요.`)) return
      setCatalogBands(payload.bands)
      setSelectedId(payload.bands[0].id)
      setDraft(clone(payload.bands[0]))
      setDirty(false)
      setCatalogDirty(true)
      setMessage(`전체 백업에서 ${payload.bands.length}개 밴드를 불러왔습니다. 저장 버튼을 눌러 적용하세요.`)
    } catch (error) {
      setMessage(`가져오기 실패: ${error instanceof Error ? error.message : '파일을 읽을 수 없습니다.'}`)
    }
  }

  return (
    <main className="studio-page">
      <header className="studio-header">
        <div>
          <a href="./" className="studio-back"><ArrowLeft size={16} /> 공개 사이트</a>
          <span className="section-no">LOCAL CONTENT OPERATIONS</span>
          <h1>ROCK ATLAS <em>STUDIO</em></h1>
          <p>{workspace === 'design' ? '공개 화면의 문구·우주 테마·장르 카드 삽화를 관리합니다.' : '밴드 추가·검수·분류·관계를 한곳에서 관리합니다.'}</p>
        </div>
        <div className="studio-header-actions">
          {workspace === 'data' && <><button onClick={exportCatalog}><Download size={16} /> JSON 백업</button>
            <button onClick={() => importRef.current?.click()} title="전체 카탈로그 백업 복원용"><FileUp size={16} /> 전체 백업 복원</button>
            <input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && void importCatalog(event.target.files[0])} /></>}
          <button className="studio-save" onClick={() => void saveEverything()}><Save size={16} /> 전체 저장</button>
        </div>
      </header>

      <div className="studio-status"><span className={dirty || catalogDirty || siteDirty || taxonomyDirty ? 'is-dirty' : ''}>{dirty || catalogDirty || siteDirty || taxonomyDirty ? '저장되지 않은 변경' : '저장됨'}</span><p>{message}</p></div>

      <nav className="studio-workspace-nav" aria-label="Studio 작업 영역">
        <button className={workspace === 'design' ? 'is-active' : ''} onClick={() => openWorkspace('design')}><Palette size={18} /><span><strong>디자인</strong><small>화면·문구·색상·우주 테마·장르 삽화</small></span></button>
        <button className={workspace === 'data' ? 'is-active' : ''} onClick={() => openWorkspace('data')}><Database size={18} /><span><strong>데이터</strong><small>밴드 추가·검수·분류·관계·백업</small></span></button>
      </nav>

      <div className={`studio-layout ${workspace === 'design' ? 'is-design-workspace' : 'is-data-workspace'}`}>
        {workspace === 'data' && <aside className="studio-sidebar">
          <div className="studio-sidebar-head">
            <strong>밴드 {catalogBands.length}</strong>
            <button onClick={addNewBand}><Plus size={15} /> 새 밴드</button>
          </div>
          <label className="studio-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·장르 검색" /></label>
          <div className="studio-band-list">
            {filteredBands.map((band) => (
              <button key={band.id} className={band.id === selectedId ? 'is-active' : ''} onClick={() => chooseBand(band)}>
                <span>{band.name}<small>{band.primaryGenre} · {band.formed}</small></span>
                <em data-status={band.reviewStatus}>{band.reviewStatus === 'draft' ? '초안' : band.reviewStatus === 'published' ? '공개' : '표시'}</em>
              </button>
            ))}
          </div>
        </aside>}

        <div className="studio-editor">
          {workspace === 'design' ? <DesignStudioPanel value={siteDraft} dirty={siteDirty} message={siteMessage} genres={taxonomyGenreDrafts} moods={taxonomyMoodDrafts} genresDirty={taxonomyDirty} genreMessage={taxonomyMessage} onChange={changeSite} onGenresChange={changeTaxonomyGenres} onMoodsChange={changeTaxonomyMoods} onSave={saveSiteContent} onSaveGenres={saveTaxonomyGenres} /> : <>
          <BandIntakePanel bands={catalogBands} onAddBands={addBands} />

          <DataManagerPanel bands={catalogBands} selectedBandId={selectedId} trash={trash} onSelectBand={chooseBand} onAddBands={addBands} onDeleteBand={deleteManagedBand} onRestoreBand={restoreManagedBand} onUpdateBand={updateManagedBand} onPersist={(note) => saveCatalog(note).then(() => undefined)} />

          <section className="studio-editor-title" ref={editorTitleRef}>
            <div>
              <span>{isExisting ? 'EDIT BAND' : 'NEW BAND'}</span>
              <h2>{draft.name}</h2>
              <p>완성도 {passedChecks}/{checks.length} · ID {draft.id}</p>
            </div>
            <label>사이트 표시 상태<select value={draft.reviewStatus} onChange={(event) => {
              const reviewStatus = event.target.value as Band['reviewStatus']
              change({
                reviewStatus,
                reviewedBy: reviewStatus === 'draft' ? undefined : 'Studio operator',
                reviewedAt: reviewStatus === 'draft' ? undefined : new Date().toISOString(),
              })
            }}><option value="draft">초안 · 사이트 숨김</option><option value="reviewed">검수됨 · 사이트 표시</option><option value="published">공개</option></select></label>
          </section>

          <section className="studio-form-section">
            <div className="studio-section-heading"><span>01</span><div><h3>기본 정보와 소개</h3><p>목록 카드와 상세 첫 화면에 바로 반영됩니다.</p></div></div>
            <div className="studio-form-grid">
              <label>밴드 이름<input value={draft.name} onChange={(event) => change({ name: event.target.value })} /></label>
              <label>고유 ID<input value={draft.id} readOnly={isExisting} onChange={(event) => change({ id: slugify(event.target.value) })} /><small>{isExisting ? '기존 관계 보호를 위해 ID는 잠겨 있습니다.' : '영문 소문자와 하이픈으로 저장됩니다.'}</small></label>
              <label>결성 연도<input type="number" value={draft.formed} onChange={(event) => change({ formed: Number(event.target.value) })} /></label>
              <label>활동 기간<input value={draft.activeYears} onChange={(event) => change({ activeYears: event.target.value })} placeholder="1960–1970" /></label>
              <label>결성지<input value={draft.origin} onChange={(event) => change({ origin: event.target.value })} placeholder="리버풀, 잉글랜드" /></label>
              <label>국가 코드<input value={draft.countryCode} maxLength={2} onChange={(event) => change({ countryCode: event.target.value.toUpperCase() })} placeholder="GB" /></label>
            </div>
            <label className="studio-wide-field">업적과 발자취 중심 소개<textarea value={draft.summary} onChange={(event) => change({ summary: event.target.value })} rows={4} placeholder="언제 등장해 무엇을 바꾸었고 어떤 계보를 남겼는지 구체적으로 적습니다." /><small>{draft.summary.length}자 · 30자 이상 권장</small></label>
            <label className="studio-wide-field">어떤 음악을 하나요?<textarea value={draft.style} onChange={(event) => change({ style: event.target.value })} rows={5} placeholder="리듬, 기타, 보컬, 프로덕션과 곡 전개를 청자가 상상할 수 있게 적습니다." /><small>{draft.style.length}자 · 40자 이상 권장</small></label>
          </section>

          <section className="studio-form-section">
            <div className="studio-section-heading"><span>02</span><div><h3>활동 시대와 핵심 태그</h3><p>시대별 변화는 상세 화면과 시대 필터에 계속 사용됩니다. 장르 분류는 바로 아래의 새 탐색 분류에서 관리하세요.</p></div></div>
            <label className="studio-wide-field">핵심 태그<input value={draft.tags.join(', ')} onChange={(event) => change({ tags: splitList(event.target.value) })} placeholder="기타 질감, 변박, 스튜디오 실험" /></label>
            <label className="studio-wide-field">시대별 분류 <small>한 줄에 시대 | 세부 장르 | 설명</small><textarea key={`${selectedId}-eras`} defaultValue={erasToText(draft.eraTags)} onBlur={(event) => change({ eraTags: parseEraTags(event.target.value, draft.genreIds, draft.eraTags) })} rows={4} placeholder="1990s | 얼터너티브 록, 아트 록 | 기타 중심에서 전자음향으로 확장" /></label>
            <details className="legacy-taxonomy-fields"><summary>구형 8장르 호환 데이터 · 새 분류에서 자동 동기화됩니다</summary><div className="studio-form-grid">
              <label>구형 주 장르<select value={draft.primaryGenre} onChange={(event) => updatePrimaryGenre(event.target.value as GenreId)}>{studioGenres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select></label>
              <label>구형 표시용 세부 장르<input value={draft.subgenres.join(', ')} onChange={(event) => change({ subgenres: splitList(event.target.value) })} /></label>
              <fieldset className="studio-checkboxes studio-grid-span"><legend>구형 장르 교차점</legend>{studioGenres.map((genre) => <label key={genre.id}><input type="checkbox" checked={draft.genreIds.includes(genre.id)} disabled={genre.id === draft.primaryGenre} onChange={() => toggleSecondaryGenre(genre.id)} />{genre.name}</label>)}</fieldset>
            </div></details>
          </section>

          <section className="studio-form-section taxonomy-editor">
            <div className="studio-section-heading"><span>02B</span><div><h3>새 장르·분위기 탐색 분류</h3><p>13개 장르 화면과 느낌으로 찾기에 사용될 v2 분류입니다. 기존 분류는 전환이 끝날 때까지 함께 보존됩니다.</p></div></div>
            <div className="studio-form-grid">
              <label>대표 장르<select value={taxonomyDraft.primaryGenreId} onChange={(event) => updateTaxonomyPrimary(event.target.value as GenreTaxonomyId)}>{taxonomyGenreDrafts.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select></label>
              <label>분류 검수 상태<select value={taxonomyDraft.reviewStatus} onChange={(event) => changeTaxonomy({ reviewStatus: event.target.value as BandTaxonomyV2['reviewStatus'] })}><option value="draft">초안 · 검토 필요</option><option value="reviewed">운영자 검수 완료</option></select></label>
            </div>
            <fieldset className="studio-checkboxes taxonomy-genre-options"><legend>보조 상위 장르 · 기본 목록에는 중복 노출되지 않음</legend>{taxonomyGenreDrafts.map((genre) => <label key={genre.id}><input type="checkbox" checked={taxonomyDraft.secondaryGenreIds.includes(genre.id)} disabled={genre.id === taxonomyDraft.primaryGenreId} onChange={() => toggleTaxonomySecondary(genre.id)} />{genre.displayName}</label>)}</fieldset>

            <div className="taxonomy-subgenre-panel">
              <div><strong>관련 세부 장르</strong><small>대표·보조 장르에 속한 항목과 현재 선택된 교차 항목만 표시합니다.</small></div>
              <div className="taxonomy-subgenre-grid">
                {availableSubgenreIds.map((id) => {
                  const subgenre = taxonomySubgenreById[id]
                  if (!subgenre) return null
                  const selected = taxonomyDraft.subgenreIds.includes(id)
                  return <button type="button" key={id} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => toggleTaxonomySubgenre(id)}>{subgenre.name}<small>{subgenre.englishName}</small></button>
                })}
              </div>
            </div>

            <div className="mood-score-editor">
              <div className="mood-score-intro"><strong>분위기 점수</strong><small>0은 미지정, 3은 분명한 특징, 5는 핵심 정체성입니다. 의미 있는 분위기만 남기세요.</small></div>
              {(Object.keys(moodGroupLabels) as MoodGroupId[]).map((groupId) => (
                <fieldset key={groupId}><legend>{moodGroupLabels[groupId]}</legend><div className="mood-score-grid">
                  {taxonomyMoodDrafts.filter((mood) => mood.groupId === groupId).map((mood) => {
                    const score = taxonomyDraft.moodScores[mood.id] ?? 0
                    return <label key={mood.id} className={score > 0 ? 'is-scored' : ''}><span><strong>{mood.name}</strong><em>{score}/5</em></span><small>{mood.description}</small><input type="range" min="0" max="5" step="1" value={score} onChange={(event) => updateMoodScore(mood.id, Number(event.target.value) as MoodScore)} aria-label={`${mood.name} 점수`} /></label>
                  })}
                </div></fieldset>
              ))}
            </div>
            <label className="studio-wide-field">분류 검토 메모<textarea value={taxonomyDraft.reviewNote ?? ''} onChange={(event) => changeTaxonomy({ reviewNote: event.target.value })} rows={3} placeholder="대표 장르 선택 근거나 나중에 확인할 사항을 적습니다." /></label>
          </section>

          <section className="studio-form-section">
            <div className="studio-section-heading"><span>03</span><div><h3>멤버와 대표곡</h3><p>표 형식 대신 한 줄씩 입력하면 자동으로 구조화합니다.</p></div></div>
            <div className="studio-dual-fields">
              <label>멤버 <small>이름 | 역할 | current/former/touring | 활동연도</small><textarea key={`${selectedId}-members`} defaultValue={membersToText(draft.members)} onBlur={(event) => change({ members: parseMembers(event.target.value) })} rows={8} /></label>
              <label>대표곡 <small>제목 | YouTube ID 또는 URL | 연도 | 앨범 | 한 줄 감상 안내</small><textarea key={`${selectedId}-tracks`} defaultValue={tracksToText(draft.tracks)} onBlur={(event) => change({ tracks: parseTracks(event.target.value, draft.tracks, draft.name) })} rows={8} placeholder="Paranoid | dQw4w9WgXcQ | 1970 | Paranoid | 압축적인 리프와 속도감에 주목" /></label>
            </div>
          </section>

          <section className="studio-form-section">
            <div className="studio-section-heading"><span>04</span><div><h3>관계 연결</h3><p>분류·태그·시대가 가까운 밴드를 후보로 추천합니다. 영향 관계는 출처 확인 뒤 승인하세요.</p></div></div>
            <div className="studio-suggestions">
              <span><Sparkles size={15} /> 가까운 밴드 후보</span>
              {suggestions.map((item) => <button key={item.band.id} onClick={() => addRelation(item.band.id, `공통 요소: ${item.reason}`, item.score)}><strong>{item.band.name}</strong><small>{item.reason} · 점수 {item.score}</small><Plus size={14} /></button>)}
            </div>
            <div className="studio-relations">
              {draft.relations.map((relation, index) => (
                <div key={`${relation.targetBandId}-${index}`} className="studio-relation-row">
                  <select value={relation.targetBandId} onChange={(event) => updateRelation(index, { targetBandId: event.target.value })}>{catalogBands.filter((band) => band.id !== draft.id).map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}</select>
                  <select value={relation.kind} onChange={(event) => updateRelation(index, { kind: event.target.value as RelationKind })}>{Object.entries(relationLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select>
                  <select value={relation.strength} onChange={(event) => updateRelation(index, { strength: Number(event.target.value) as 1 | 2 | 3 })}><option value={1}>약함</option><option value={2}>중간</option><option value={3}>강함</option></select>
                  <input value={relation.note} onChange={(event) => updateRelation(index, { note: event.target.value })} aria-label="관계 이유" />
                  <button aria-label="관계 삭제" onClick={() => change({ relations: draft.relations.filter((_, relationIndex) => relationIndex !== index) })}>×</button>
                </div>
              ))}
              <button className="studio-add-row" onClick={() => addRelation()}><Plus size={15} /> 직접 관계 추가</button>
            </div>
          </section>

          <section className="studio-form-section">
            <div className="studio-section-heading"><span>05</span><div><h3>이미지와 외부 식별자</h3><p>권리 검수 전에는 이미지가 공개 승인으로 처리되지 않습니다.</p></div></div>
            <ExternalSourceFinder key={selectedId} initialQuery={draft.name} selectedWikidataId={sourceId(draft, 'Wikidata')} selectedMusicBrainzId={sourceId(draft, 'MusicBrainz')} onSelect={selectExternalCandidate} />
            <div className="studio-form-grid">
              <label>Wikidata ID<input value={sourceId(draft, 'Wikidata')} onChange={(event) => { setDraft((current) => updateExternalSource(current, 'Wikidata', event.target.value.trim())); setDirty(true) }} placeholder="Q1299" /></label>
              <label>MusicBrainz ID<input value={sourceId(draft, 'MusicBrainz')} onChange={(event) => { setDraft((current) => updateExternalSource(current, 'MusicBrainz', event.target.value.trim())); setDirty(true) }} /></label>
              <label className="studio-grid-span">공식 YouTube 채널 URL<input value={sourceUrl(draft, 'YouTube')} onChange={(event) => { setDraft((current) => updateYoutubeSource(current, event.target.value.trim())); setDirty(true) }} placeholder="https://www.youtube.com/@official-channel" /><small>곡별 링크와 함께 상세 화면 하단의 공식 채널 바로가기에 사용됩니다.</small></label>
              <label className="studio-grid-span">표시 이미지 URL<input value={draft.image.displayUrl ?? ''} onChange={(event) => change({ image: { ...draft.image, displayUrl: event.target.value } })} /></label>
              <label className="studio-grid-span">Commons 원본 페이지 또는 파일명<input value={draft.image.credit.sourceUrl} onChange={(event) => change({ image: { ...draft.image, credit: { ...draft.image.credit, sourceUrl: event.target.value } } })} placeholder="https://commons.wikimedia.org/wiki/File:... 또는 Example.jpg" /></label>
              <div className="studio-grid-span studio-inline-actions">
                <button type="button" disabled={commonsBusy || !draft.image.credit.sourceUrl.trim()} onClick={() => void runCommonsLookup()}>{commonsBusy ? <Loader2 size={15} className="is-spinning" /> : <Wand2 size={15} />} Commons에서 자동 채우기</button>
                {commonsMessage && <small>{commonsMessage}</small>}
              </div>
              <label>촬영자·제작자<input value={draft.image.credit.creator ?? ''} onChange={(event) => change({ image: { ...draft.image, credit: { ...draft.image.credit, creator: event.target.value } } })} /></label>
              <label>라이선스<input value={draft.image.credit.license} onChange={(event) => change({ image: { ...draft.image, credit: { ...draft.image.credit, license: event.target.value } } })} /></label>
              <label>라이선스 URL<input value={draft.image.credit.licenseUrl ?? ''} onChange={(event) => change({ image: { ...draft.image, credit: { ...draft.image.credit, licenseUrl: event.target.value } } })} /></label>
              <label>권리 검수<select value={draft.image.credit.reviewStatus} onChange={(event) => change({ image: { ...draft.image, credit: { ...draft.image.credit, reviewStatus: event.target.value as 'verified' | 'needs-review', reviewedAt: event.target.value === 'verified' ? new Date().toISOString().slice(0, 10) : undefined } } })}><option value="needs-review">검토 필요</option><option value="verified">검수 완료</option></select></label>
            </div>
          </section>

          <section className="studio-readiness">
            <div><span>운영 준비도</span><strong>{passedChecks}/{checks.length}</strong><p>초안은 저장할 수 있지만 공개 목록에는 나타나지 않습니다.</p></div>
            <ul>{checks.map((check) => <li key={check.label} className={check.passed ? 'is-passed' : ''}>{check.passed ? <Check size={14} /> : <span>○</span>}{check.label}</li>)}</ul>
            <div className="studio-final-actions"><a href={`./?studioPreview=1#band=${encodeURIComponent(draft.id)}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> 상세 화면 미리보기</a><button onClick={() => void saveCatalog()}><Save size={16} /> 저장</button></div>
          </section>
          </>}
        </div>
      </div>

      <footer className="studio-footer"><Link2 size={15} /> 자동 추천은 편집 후보이며, 영향 관계·이미지 권리·대표곡 외부 링크는 운영자가 확인한 뒤 승인합니다.</footer>
    </main>
  )
}
