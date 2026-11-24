import type { Album, Band, Milestone, Track } from '../types/music'

/** 연표 한 줄 (plan P4-1). 음반 ● / 사건 ◆ / 대표곡 ♪. 대표곡은 수록 음반이 연표에 있으면 그 아래로 들어간다. */
export type TimelineEntry =
  | { kind: 'formed'; year: number; key: string }
  | { kind: 'album'; year: number; key: string; album: Album; tracks: Track[] }
  | { kind: 'milestone'; year: number; key: string; milestone: Milestone }
  | { kind: 'track'; year: number; key: string; track: Track }

/** 제목 비교용: 대소문자·따옴표·말줄임표·괄호 속 판본 표기를 무시한다. */
export function normalizeAlbumTitle(title: string) {
  return title.toLocaleLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/…/g, '...')
    .replace(/\s*[([].*?(edition|remaster|deluxe|version|판).*?[)\]]\s*/g, ' ')
    .replace(/[^a-z0-9가-힣']+/g, ' ')
    .trim()
}

const typeOrder: Record<TimelineEntry['kind'], number> = { formed: 0, milestone: 1, album: 2, track: 3 }

export interface TimelineOptions {
  /** 입문 추천 음반만 보일지. 추천 음반이 하나도 없으면 무시하고 정규 음반 전체를 보인다. */
  essentialOnly?: boolean
}

export function buildBandTimeline(band: Pick<Band, 'formed' | 'tracks' | 'albums' | 'milestones'>, options: TimelineOptions = {}): TimelineEntry[] {
  const allAlbums = band.albums ?? []
  const hasEssentials = allAlbums.some((album) => album.essential)
  const albums = options.essentialOnly && hasEssentials ? allAlbums.filter((album) => album.essential) : allAlbums
  const albumKeys = new Map(albums.map((album) => [normalizeAlbumTitle(album.title), album]))
  const tracksByAlbum = new Map<Album, Track[]>()
  const looseTracks: Track[] = []
  for (const track of band.tracks) {
    const album = track.album ? albumKeys.get(normalizeAlbumTitle(track.album)) : undefined
    if (album) tracksByAlbum.set(album, [...(tracksByAlbum.get(album) ?? []), track])
    else if (typeof track.year === 'number') looseTracks.push(track)
  }
  const hasFormedMilestone = (band.milestones ?? []).some((item) => item.type === 'formed')
  const entries: TimelineEntry[] = [
    ...(hasFormedMilestone ? [] : [{ kind: 'formed' as const, year: band.formed, key: `formed-${band.formed}` }]),
    ...(band.milestones ?? []).map((milestone, index) => ({ kind: 'milestone' as const, year: milestone.year, key: `milestone-${index}`, milestone })),
    ...albums.map((album, index) => ({ kind: 'album' as const, year: album.year, key: `album-${index}-${album.title}`, album, tracks: (tracksByAlbum.get(album) ?? []).sort((a, b) => (a.year ?? 0) - (b.year ?? 0)) })),
    ...looseTracks.map((track) => ({ kind: 'track' as const, year: track.year!, key: `track-${track.id}`, track })),
  ]
  return entries.sort((a, b) => a.year - b.year || typeOrder[a.kind] - typeOrder[b.kind])
}

/** 대표곡의 앨범명이 음반 목록에 없으면 오타일 수 있다(검증 경고용). 싱글은 제외. */
export function tracksMissingFromAlbums(band: Pick<Band, 'tracks' | 'albums'>) {
  if (!band.albums?.length) return []
  const titles = new Set(band.albums.map((album) => normalizeAlbumTitle(album.title)))
  return band.tracks.filter((track) => track.album && track.releaseType !== 'single' && !titles.has(normalizeAlbumTitle(track.album)))
}
