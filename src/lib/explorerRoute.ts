import { eras } from '../data/eras'
import { taxonomyGenres, taxonomyMoods } from '../data/taxonomy'
import type { EraId } from '../types/music'
import type { GenreTaxonomyId, MoodId } from '../types/taxonomy'
import { decodeProfileIds, encodeProfileIds } from './tasteProfile'

export type ExplorerView = 'home' | 'genre' | 'bands' | 'moods' | 'profile' | 'glossary'
export type CatalogSort = 'name' | 'formed-asc' | 'formed-desc'

export interface ExplorerRoute {
  view: ExplorerView
  genreId: GenreTaxonomyId | 'all'
  subgenreId: string | 'all'
  quickMoodId: MoodId | 'all'
  selectedMoodIds: MoodId[]
  /** 느낌으로 찾기의 "이건 빼고" 무드. */
  excludeMoodId: MoodId | 'all'
  query: string
  eraId: EraId | 'all'
  countryCode: string | 'all'
  sort: CatalogSort
  /** 공유받은 취향 프로필의 밴드 id(`?view=profile&p=a.b.c`). 비어 있으면 내 프로필. */
  profileIds: string[]
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
  const exclude = params.get('exclude')
  const era = params.get('era')
  const sort = params.get('sort')
  return {
    view: view === 'genre' || view === 'bands' || view === 'moods' || view === 'profile' || view === 'glossary' ? view : 'home',
    genreId: genre && genreIds.has(genre as GenreTaxonomyId) ? genre as GenreTaxonomyId : 'all',
    subgenreId: subgenre || 'all',
    quickMoodId: mood && moodIds.has(mood as MoodId) ? mood as MoodId : 'all',
    selectedMoodIds: selected,
    excludeMoodId: exclude && moodIds.has(exclude as MoodId) && !selected.includes(exclude as MoodId) ? exclude as MoodId : 'all',
    query: params.get('q') ?? '',
    eraId: era && eraIds.has(era as EraId) ? era as EraId : 'all',
    countryCode: params.get('country')?.toUpperCase() || 'all',
    sort: sort === 'formed-asc' || sort === 'formed-desc' ? sort : 'name',
    profileIds: view === 'profile' ? decodeProfileIds(params.get('p')) : [],
  }
}

export function routeToSearch(route: ExplorerRoute) {
  const params = new URLSearchParams()
  if (route.view !== 'home') params.set('view', route.view)
  if (route.genreId !== 'all') params.set('genre', route.genreId)
  if (route.subgenreId !== 'all') params.set('subgenre', route.subgenreId)
  if (route.quickMoodId !== 'all') params.set('mood', route.quickMoodId)
  if (route.selectedMoodIds.length) params.set('selected', route.selectedMoodIds.join(','))
  if (route.excludeMoodId !== 'all') params.set('exclude', route.excludeMoodId)
  if (route.query) params.set('q', route.query)
  if (route.eraId !== 'all') params.set('era', route.eraId)
  if (route.countryCode !== 'all') params.set('country', route.countryCode)
  if (route.sort !== 'name') params.set('sort', route.sort)
  if (route.view === 'profile' && route.profileIds.length) params.set('p', encodeProfileIds(route.profileIds))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const defaultRoute = (): ExplorerRoute => ({
  view: 'home', genreId: 'all', subgenreId: 'all', quickMoodId: 'all', selectedMoodIds: [], excludeMoodId: 'all', query: '', eraId: 'all', countryCode: 'all', sort: 'name', profileIds: [],
})
