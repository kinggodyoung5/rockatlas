import publicCatalog from './generated/public-band-index.json' with { type: 'json' }
import type { Band } from '../types/music'

interface PublicCatalogFile {
  schemaVersion: number
  updatedAt: string
  bands: Band[]
}

export const publicCatalogFile = publicCatalog as PublicCatalogFile
export const publicBands = publicCatalogFile.bands
export const publicBandById = Object.fromEntries(publicBands.map((band) => [band.id, band])) as Record<string, Band>

const detailCache = new Map<string, Promise<Band>>()

export function loadPublicBand(id: string) {
  const cached = detailCache.get(id)
  if (cached) return cached
  const request = fetch(`./data/bands/${encodeURIComponent(id)}.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`밴드 상세 정보를 불러오지 못했습니다. (${response.status})`)
      return response.json() as Promise<Band>
    })
    .catch((error) => {
      detailCache.delete(id)
      throw error
    })
  detailCache.set(id, request)
  return request
}
