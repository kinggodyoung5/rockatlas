import { describe, expect, it } from 'vitest'
import { publicBandById, publicBands } from '../data/publicBands'
import { activeFilterCount, formedEra, letterIndex, matchesCatalogFilter, sortCatalog, type CatalogFilter } from './catalogFilters'

const none: CatalogFilter = { query: '', genreId: 'all', subgenreId: 'all', eraId: 'all', countryCode: 'all' }

describe('catalog filters', () => {
  it('maps a formation year to its decade', () => {
    expect(formedEra(1977)).toBe('1970s')
    expect(formedEra(1980)).toBe('1980s')
    expect(formedEra(2019)).toBe('2010s')
  })

  it('filters the era by formation year, not by active-era tags', () => {
    const direStraits = publicBandById['dire-straits']
    expect(direStraits.formed).toBe(1977)
    expect(direStraits.eraTags.map((tag) => tag.era)).not.toContain('1970s')
    expect(matchesCatalogFilter(direStraits, { ...none, eraId: '1970s' })).toBe(true)
    expect(matchesCatalogFilter(direStraits, { ...none, eraId: '1980s' })).toBe(false)
  })

  it('every band lands in exactly one formation decade', () => {
    const eras = ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'] as const
    for (const band of publicBands) {
      const hits = eras.filter((eraId) => matchesCatalogFilter(band, { ...none, eraId }))
      expect(hits.length, band.name).toBeLessThanOrEqual(1)
    }
  })

  it('searches names case-insensitively and sorts by name by default', () => {
    expect(publicBands.filter((band) => matchesCatalogFilter(band, { ...none, query: 'METALLICA' })).map((band) => band.id)).toContain('metallica')
    const sorted = sortCatalog(publicBands.slice(0, 20), 'name').map((band) => band.name)
    expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b, 'en')))
  })

  it('counts active filters without the search query', () => {
    expect(activeFilterCount({ genreId: 'all', subgenreId: 'all', eraId: 'all', countryCode: 'all' })).toBe(0)
    expect(activeFilterCount({ genreId: 'extreme-metal', subgenreId: 'all', eraId: '1980s', countryCode: 'all' })).toBe(2)
  })

  it('builds an A–Z index with the first position of each letter', () => {
    const index = letterIndex([{ name: '10cc' }, { name: 'ABBA' }, { name: 'AC/DC' }, { name: 'Mötley Crüe' }, { name: 'Muse' }])
    expect([...index]).toEqual([['#', 0], ['A', 1], ['M', 3]])
    const real = letterIndex(sortCatalog(publicBands, 'name'))
    expect(real.get('M')).toBeGreaterThan(real.get('A')!)
  })
})
