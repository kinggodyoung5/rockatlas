import taxonomyData from './taxonomy.v2.json' with { type: 'json' }
import type { GenreTaxonomyId, MoodId, SubgenreId, TaxonomyCatalog } from '../types/taxonomy'

export const taxonomy = taxonomyData as TaxonomyCatalog
export const taxonomyGenres = [...taxonomy.genres].sort((a, b) => a.order - b.order)
export const taxonomySubgenres = taxonomy.subgenres
export const taxonomyMoods = [...taxonomy.moods].sort((a, b) => a.order - b.order)

export const taxonomyGenreById = Object.fromEntries(
  taxonomyGenres.map((genre) => [genre.id, genre]),
) as Record<GenreTaxonomyId, TaxonomyCatalog['genres'][number]>

export const taxonomySubgenreById = Object.fromEntries(
  taxonomySubgenres.map((subgenre) => [subgenre.id, subgenre]),
) as Record<SubgenreId, TaxonomyCatalog['subgenres'][number]>

export const taxonomyMoodById = Object.fromEntries(
  taxonomyMoods.map((mood) => [mood.id, mood]),
) as Record<MoodId, TaxonomyCatalog['moods'][number]>
