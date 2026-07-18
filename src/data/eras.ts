import type { EraId } from '../types/music'

export interface EraOption {
  id: EraId
  label: string
  years: string
}

export const eras: EraOption[] = [
  { id: '1960s', label: '1960년대', years: '1960–1969' },
  { id: '1970s', label: '1970년대', years: '1970–1979' },
  { id: '1980s', label: '1980년대', years: '1980–1989' },
  { id: '1990s', label: '1990년대', years: '1990–1999' },
  { id: '2000s', label: '2000년대', years: '2000–2009' },
  { id: '2010s', label: '2010년대', years: '2010–2019' },
  { id: '2020s', label: '2020년대', years: '2020–현재' },
]

export const eraById = Object.fromEntries(eras.map((era) => [era.id, era])) as Record<EraId, EraOption>
