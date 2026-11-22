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
