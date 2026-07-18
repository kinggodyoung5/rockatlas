import genreData from './genres.json' with { type: 'json' }
import type { Genre } from '../types/music'

export interface GenreCatalog {
  schemaVersion: number
  updatedAt: string
  genres: Genre[]
}

export const genreCatalog = genreData as GenreCatalog
export const genres = genreCatalog.genres
export const genreById = Object.fromEntries(genres.map((genre) => [genre.id, genre])) as Record<Genre['id'], Genre>
