import catalog from './catalog.json' with { type: 'json' }
import type { Band, GenreId, PendingRelation } from '../types/music'

export interface CatalogFile {
  schemaVersion: number
  updatedAt: string
  bands: Band[]
  pendingRelations?: PendingRelation[]
}

export const catalogFile = catalog as CatalogFile
export const bands = catalogFile.bands
export const publicBands = bands.filter((band) => band.reviewStatus !== 'draft')
export const bandById = Object.fromEntries(bands.map((band) => [band.id, band])) as Record<string, Band>
export const publicBandById = Object.fromEntries(publicBands.map((band) => [band.id, band])) as Record<string, Band>
export const bandsByGenre = (genreId: GenreId) => publicBands.filter((band) => band.primaryGenre === genreId)
