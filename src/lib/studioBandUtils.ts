import { eras } from '../data/eras'
import type { Band, BandEraTag, BandTaxonomyV2, EraId, GenreId, Member, Track } from '../types/music'
import { slugify } from './bandIntake'

export const clone = <T,>(value: T): T => structuredClone(value)
export const splitList = (value: string | undefined) => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)

const asEra = (year: number): EraId => {
  const decade = Math.floor(year / 10) * 10
  const candidate = `${Math.min(2020, Math.max(1960, decade))}s` as EraId
  return eras.some((era) => era.id === candidate) ? candidate : '2020s'
}

export function createTaxonomyDraft(): BandTaxonomyV2 {
  return {
    primaryGenreId: 'classic-roots-rock',
    secondaryGenreIds: [],
    subgenreIds: [],
    moodScores: {},
    reviewStatus: 'draft',
    reviewNote: 'Studio에서 생성한 taxonomy v2 초안',
  }
}

export function createDraftBand(): Band {
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

export const membersToText = (members: Member[]) => members.map((member) => [member.name, member.role, member.status, member.activeYears ?? ''].join(' | ')).join('\n')
export const tracksToText = (tracks: Track[]) => tracks.map((track) => [track.title, track.youtubeId, track.year ?? '', track.album ?? '', track.guide ?? ''].join(' | ')).join('\n')

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

export function parseMembers(value: string): Member[] {
  return value.split(/\r?\n/).map((line) => line.split('|').map((item) => item.trim())).filter(([name]) => Boolean(name)).map(([name, role, status, activeYears]) => ({
    name,
    role: role || '역할 미정',
    status: status === 'former' || status === 'touring' ? status : 'current',
    activeYears: activeYears || undefined,
  }))
}

export function parseTracks(value: string, current: Track[], bandName: string): Track[] {
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
          url: youtubeTrackUrl(bandName, title, youtubeId),
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

export function parseEraTags(value: string, genreIds: GenreId[], current: BandEraTag[]): BandEraTag[] {
  return value.split(/\r?\n/).map((line) => line.split('|').map((item) => item.trim())).filter(([era]) => eras.some((item) => item.id === era)).map(([era, subgenres, note]) => ({
    era: era as EraId,
    genreIds: current.find((item) => item.era === era)?.genreIds ?? genreIds,
    subgenres: splitList(subgenres),
    note: note || undefined,
  }))
}
