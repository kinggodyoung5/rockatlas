import type { Band, EraId } from '../types/music'
import type { GenreTaxonomyId } from '../types/taxonomy'
import type { CatalogSort } from './explorerRoute'

/** Decade a band was formed in, as an era id ("1977" → "1970s"). Bands formed after the last listed
 *  decade still map to their own decade id; the era picker simply never offers it. */
export function formedEra(formed: number): EraId {
  return `${Math.floor(formed / 10) * 10}s` as EraId
}

export interface CatalogFilter {
  query: string
  genreId: GenreTaxonomyId | 'all'
  subgenreId: string | 'all'
  /** Formation decade — not the band's active-era tags. A 1977 band whose defining work came in the
   *  1980s still belongs under "1970s" here; the mood finder's era filter is the one that uses activity. */
  eraId: EraId | 'all'
  countryCode: string | 'all'
}

export function matchesCatalogFilter(band: Band, filter: CatalogFilter): boolean {
  const taxonomy = band.taxonomyV2
  const normalized = filter.query.trim().toLocaleLowerCase()
  if (normalized) {
    const searchable = `${band.name} ${band.origin} ${band.tags.join(' ')} ${band.subgenres.join(' ')} ${band.members.map((member) => member.name).join(' ')}`.toLocaleLowerCase()
    if (!searchable.includes(normalized)) return false
  }
  return (filter.genreId === 'all' || taxonomy?.primaryGenreId === filter.genreId)
    && (filter.subgenreId === 'all' || Boolean(taxonomy?.subgenreIds.includes(filter.subgenreId)))
    && (filter.eraId === 'all' || formedEra(band.formed) === filter.eraId)
    && (filter.countryCode === 'all' || band.countryCode === filter.countryCode)
}

export function sortCatalog(bands: Band[], sort: CatalogSort): Band[] {
  return [...bands].sort((a, b) => sort === 'formed-asc' ? a.formed - b.formed
    : sort === 'formed-desc' ? b.formed - a.formed
      : a.name.localeCompare(b.name, 'en'))
}

/** 검색어를 뺀 필터 수 — 모바일 "필터 (2)" 버튼에 쓴다. */
export function activeFilterCount(filter: Omit<CatalogFilter, 'query'>) {
  return [filter.genreId, filter.subgenreId, filter.eraId, filter.countryCode].filter((value) => value !== 'all').length
}

/** 이름순 목록의 A–Z 색인. 글자마다 첫 밴드의 위치를 돌려준다. "The "는 건너뛰지 않는다(정렬과 같게).
 *  숫자·기호로 시작하면 '#'. */
export function letterIndex(sortedBands: Pick<Band, 'name'>[]) {
  const index = new Map<string, number>()
  sortedBands.forEach((band, position) => {
    const first = band.name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
    const letter = /[A-Z]/.test(first) ? first : '#'
    if (!index.has(letter)) index.set(letter, position)
  })
  return index
}
