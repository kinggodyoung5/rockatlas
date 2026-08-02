import { describe, expect, it } from 'vitest'
import type { Band } from '../types/music'
import { applyExternalFact, type FactEvidence } from './factAudit'

const band = { formed: 2000, countryCode: 'US', origin: 'Boston, United States', activeYears: '2000–현재' } as Band
const fact = (id: FactEvidence['id'], value: string): FactEvidence => ({ id, label: id, localValue: '', externalValue: value, status: 'review', confidence: 'medium', sources: ['MusicBrainz'], message: '' })

describe('applyExternalFact', () => {
  it('applies only an explicitly reviewed external fact', () => {
    expect(applyExternalFact(band, fact('formed', '2001')).formed).toBe(2001)
    expect(applyExternalFact(band, fact('country', 'GB')).countryCode).toBe('GB')
    expect(applyExternalFact(band, fact('origin', 'London')).origin).toBe('London')
  })

  it('replaces a current activity marker with a verified end year', () => {
    expect(applyExternalFact(band, fact('active-end', '2019')).activeYears).toBe('2000–2019')
  })
})
