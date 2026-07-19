import { eras } from '../data/eras'
import { taxonomyGenres, taxonomyMoods } from '../data/taxonomy'
import type { EraId } from '../types/music'
import type { GenreTaxonomyId, MoodId } from '../types/taxonomy'

export type ExplorerView = 'home' | 'genre' | 'bands' | 'moods'
export type CatalogSort = 'name' | 'formed-asc' | 'formed-desc'

export interface ExplorerRoute {
  view: ExplorerView
  genreId: GenreTaxonomyId | 'all'
  subgenreId: string | 'all'
  quickMoodId: MoodId | 'all'
  selectedMoodIds: MoodId[]
  query: string
  eraId: EraId | 'all'
  countryCode: string | 'all'
  sort: CatalogSort
}

const genreIds = new Set(taxonomyGenres.map((genre) => genre.id))
const moodIds = new Set(taxonomyMoods.map((mood) => mood.id))
const eraIds = new Set(eras.map((era) => era.id))

export function parseExplorerRoute(search = window.location.search): ExplorerRoute {
  const params = new URLSearchParams(search)
  const view = params.get('view')
  const genre = params.get('genre')
  const subgenre = params.get('subgenre')
  const mood = params.get('mood')
  const selected = (params.get('selected') ?? '').split(',').filter((id): id is MoodId => moodIds.has(id as MoodId)).slice(0, 3)
  const era = params.get('era')
  const sort = params.get('sort')
  return {
    view: view === 'genre' || view === 'bands' || view === 'moods' ? view : 'home',
    genreId: genre && genreIds.has(genre as GenreTaxonomyId) ? genre as GenreTaxonomyId : 'all',
    subgenreId: subgenre || 'all',
    quickMoodId: mood && moodIds.has(mood as MoodId) ? mood as MoodId : 'all',
    selectedMoodIds: selected,
    query: params.get('q') ?? '',
    eraId: era && eraIds.has(era as EraId) ? era as EraId : 'all',
    countryCode: params.get('country')?.toUpperCase() || 'all',
    sort: sort === 'formed-asc' || sort === 'formed-desc' ? sort : 'name',
  }
}

export function routeToSearch(route: ExplorerRoute) {
  const params = new URLSearchParams()
  if (route.view !== 'home') params.set('view', route.view)
  if (route.genreId !== 'all') params.set('genre', route.genreId)
  if (route.subgenreId !== 'all') params.set('subgenre', route.subgenreId)
  if (route.quickMoodId !== 'all') params.set('mood', route.quickMoodId)
  if (route.selectedMoodIds.length) params.set('selected', route.selectedMoodIds.join(','))
  if (route.query) params.set('q', route.query)
  if (route.eraId !== 'all') params.set('era', route.eraId)
  if (route.countryCode !== 'all') params.set('country', route.countryCode)
  if (route.sort !== 'name') params.set('sort', route.sort)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const defaultRoute = (): ExplorerRoute => ({
  view: 'home', genreId: 'all', subgenreId: 'all', quickMoodId: 'all', selectedMoodIds: [], query: '', eraId: 'all', countryCode: 'all', sort: 'name',
})
