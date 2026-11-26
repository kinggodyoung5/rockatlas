/**
 * 통합 검색 (plan P5-3). 인덱스는 `scripts/generate-public-data.ts`가 `public/data/search-index.json`으로 만들고,
 * 화면은 검색창을 처음 열 때 한 번 불러온다. 이 파일은 타입만 가져와서 Node 스크립트에서도 그대로 쓴다.
 */
import type { Band } from '../types/music'
import type { TaxonomyGenre, TaxonomyMood, TaxonomySubgenre } from '../types/taxonomy'

export type SearchKind = 'band' | 'member' | 'track' | 'album' | 'subgenre' | 'mood'

export interface SearchEntry {
  t: SearchKind
  label: string
  /** 보조 설명(밴드명, 장르명, 연도 등) */
  sub?: string
  /** 별칭(한글 밴드명, 영문 장르명 등) — 화면에 보이지 않고 검색에만 쓴다 */
  aka?: string[]
  bandId?: string
  trackId?: string
  genreId?: string
  subgenreId?: string
  moodId?: string
}

export const searchKindLabels: Record<SearchKind, string> = { band: '밴드', member: '멤버', track: '대표곡', album: '음반', subgenre: '세부장르', mood: '분위기' }
const kindOrder: SearchKind[] = ['band', 'member', 'track', 'album', 'subgenre', 'mood']

export function normalizeSearch(value: string) {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase().replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

interface BuildInput {
  bands: Pick<Band, 'id' | 'name' | 'formed' | 'tags' | 'members' | 'tracks' | 'albums' | 'taxonomyV2'>[]
  koreanNames: Record<string, string>
  genres: Pick<TaxonomyGenre, 'id' | 'displayName' | 'subgenreIds'>[]
  subgenres: Pick<TaxonomySubgenre, 'id' | 'name' | 'englishName' | 'aliases'>[]
  moods: Pick<TaxonomyMood, 'id' | 'name' | 'description'>[]
}

export function buildSearchIndex({ bands, koreanNames, genres, subgenres, moods }: BuildInput): SearchEntry[] {
  const entries: SearchEntry[] = []
  const genreOfSubgenre = new Map(genres.flatMap((genre) => genre.subgenreIds.map((id) => [id, genre] as const)))
  const usedSubgenres = new Set(bands.flatMap((band) => band.taxonomyV2?.subgenreIds ?? []))
  for (const band of bands) {
    const korean = koreanNames[band.id]
    entries.push({ t: 'band', label: band.name, sub: `${band.formed}`, aka: [korean, ...band.tags.slice(0, 1)].filter((item): item is string => Boolean(item)), bandId: band.id })
    const seenMembers = new Set<string>()
    for (const member of band.members) {
      if (seenMembers.has(member.name)) continue
      seenMembers.add(member.name)
      entries.push({ t: 'member', label: member.name, sub: band.name, bandId: band.id })
    }
    for (const track of band.tracks) entries.push({ t: 'track', label: track.title, sub: `${band.name}${track.year ? ` · ${track.year}` : ''}`, bandId: band.id, trackId: track.id })
    for (const album of band.albums ?? []) entries.push({ t: 'album', label: album.title, sub: `${band.name} · ${album.year}`, bandId: band.id })
  }
  for (const subgenre of subgenres) {
    if (!usedSubgenres.has(subgenre.id)) continue
    const genre = genreOfSubgenre.get(subgenre.id)
    entries.push({ t: 'subgenre', label: subgenre.name, sub: genre?.displayName, aka: [subgenre.englishName, ...(subgenre.aliases ?? [])], genreId: genre?.id, subgenreId: subgenre.id })
  }
  for (const mood of moods) entries.push({ t: 'mood', label: mood.name, sub: mood.description, moodId: mood.id })
  return entries
}

export interface SearchGroup { kind: SearchKind; items: SearchEntry[] }

/** 접두 일치(이름 또는 단어의 시작)를 먼저, 그다음 부분 일치. 종류별로 묶어 최대 perKind개. 한글 초성 검색은 하지 않는다. */
export function searchEntries(index: readonly SearchEntry[], query: string, perKind = 5): SearchGroup[] {
  const needle = normalizeSearch(query)
  if (!needle) return []
  const scored: Array<{ entry: SearchEntry; score: number }> = []
  for (const entry of index) {
    let best = 0
    for (const text of [entry.label, ...(entry.aka ?? [])]) {
      const value = normalizeSearch(text)
      if (!value) continue
      const score = value === needle ? 4 : value.startsWith(needle) ? 3 : value.split(' ').some((word) => word.startsWith(needle)) ? 2 : value.includes(needle) ? 1 : 0
      if (score > best) best = score
    }
    if (best) scored.push({ entry, score: best })
  }
  scored.sort((a, b) => b.score - a.score || a.entry.label.length - b.entry.label.length || a.entry.label.localeCompare(b.entry.label))
  return kindOrder.map((kind) => ({ kind, items: scored.filter((item) => item.entry.t === kind).slice(0, perKind).map((item) => item.entry) })).filter((group) => group.items.length)
}
