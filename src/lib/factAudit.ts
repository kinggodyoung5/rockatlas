import type { Band } from '../types/music'
import { studioFetchJson } from './studioApiClient'

export type FactAuditStatus = 'verified' | 'review' | 'error'

export interface FactEvidence {
  id: 'formed' | 'country' | 'origin' | 'active-end'
  label: string
  localValue: string
  externalValue: string
  status: 'verified' | 'review' | 'missing'
  confidence: 'high' | 'medium' | 'low'
  sources: string[]
  message: string
}

export interface FactAuditIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
}

export interface CatalogFactAudit {
  bandId: string
  bandName: string
  checkedAt: string
  status: FactAuditStatus
  linkedAcrossSources: boolean
  identity: {
    wikidataId: string
    musicBrainzId: string
    wikidataName: string
    musicBrainzName: string
  }
  facts: FactEvidence[]
  albums: Array<{ id: string; title: string; year?: number }>
  externalMembers: Array<{ name: string; begin: string; end: string }>
  memberChecks: Array<{ name: string; status: 'verified' | 'missing' }>
  trackChecks: Array<{
    id: string
    title: string
    album: string
    year?: number
    status: 'verified' | 'review' | 'missing'
    externalAlbum: string
    externalYear?: number
  }>
  issues: FactAuditIssue[]
  cached?: boolean
}

export async function auditBandFacts(band: Band) {
  return studioFetchJson<CatalogFactAudit>('/api/studio/fact-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ band }),
  })
}

export function applyExternalFact(band: Band, fact: FactEvidence): Band {
  if (!fact.externalValue || fact.status !== 'review') return band
  if (fact.id === 'formed') return { ...band, formed: Number(fact.externalValue) || band.formed }
  if (fact.id === 'country') return { ...band, countryCode: fact.externalValue.toUpperCase() }
  if (fact.id === 'origin') return { ...band, origin: fact.externalValue }
  if (fact.id === 'active-end') {
    const current = band.activeYears.trim()
    const next = /\d{4}\s*[–-]\s*(?:present|현재|\d{4})$/i.test(current)
      ? current.replace(/(\d{4}\s*[–-]\s*)(?:present|현재|\d{4})$/i, `$1${fact.externalValue}`)
      : `${band.formed}–${fact.externalValue}`
    return { ...band, activeYears: next }
  }
  return band
}
