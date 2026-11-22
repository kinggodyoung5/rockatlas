import { describe, expect, it } from 'vitest'
import type { Band } from '../types/music'
import { findMemberOverlaps, normalizeMemberName } from './memberOverlap'
import { isMusicalRelation } from './relationLabels'
import { publicBands } from '../data/publicBands'

const band = (id: string, formed: number, members: string[], relations: Band['relations'] = []): Band => ({
  id, name: id, formed, origin: '', countryCode: 'US', activeYears: '', primaryGenre: 'hard-rock', genreIds: ['hard-rock'],
  subgenres: [], eraTags: [], tags: [], summary: '', style: '',
  image: { wikipediaTitle: id, alt: id, credit: { sourceUrl: '', license: '', reviewStatus: 'needs-review' } },
  members: members.map((name) => ({ name, role: '', status: 'former' })), tracks: [], relations, sources: [], reviewStatus: 'published',
})

describe('member overlap detection', () => {
  it('normalizes accents, quoted nicknames and spacing', () => {
    expect(normalizeMemberName('Mikkey Dee')).toBe(normalizeMemberName('mikkey  dee'))
    expect(normalizeMemberName('Teemu Mäntysaari')).toBe('teemumantysaari')
    expect(normalizeMemberName('Joakim "Jolly" Karlsson')).toBe('joakimkarlsson')
    expect(normalizeMemberName('Steve DiGiorgio')).toBe(normalizeMemberName('Steve Di Giorgio'))
  })

  it('finds a shared person and groups people per band pair', () => {
    const result = findMemberOverlaps([band('a', 1970, ['Ritchie Blackmore', 'Roger Glover']), band('b', 1975, ['Ritchie Blackmore', 'Roger Glover', 'Cozy Powell'])])
    expect(result).toEqual([{ pairKey: 'a|b', bandIds: ['a', 'b'], people: ['Ritchie Blackmore', 'Roger Glover'] }])
  })

  it('skips pairs that already have any relation, recorded decisions, and anonymous names', () => {
    const linked = [band('a', 1970, ['X Person'], [{ targetBandId: 'b', kind: 'shared-scene', strength: 1, note: '', reviewStatus: 'draft' }]), band('b', 1975, ['X Person'])]
    expect(findMemberOverlaps(linked)).toEqual([])
    const decided = [band('foreigner', 1976, ['Mick Jones']), band('the-clash', 1976, ['Mick Jones'])]
    expect(findMemberOverlaps(decided, [{ pairKey: 'foreigner|the-clash', person: 'Mick Jones', decision: 'namesake', decidedAt: '' }])).toEqual([])
    expect(findMemberOverlaps([band('a', 1, ['Vessel']), band('b', 2, ['Vessel'])])).toEqual([])
  })
})

describe('member-link relations in the catalog', () => {
  it('never uses the retired evolution kind and always names people', () => {
    for (const item of publicBands) {
      for (const relation of item.relations) {
        expect(relation.kind, `${item.id}→${relation.targetBandId}`).not.toBe('evolution')
        if (relation.kind === 'member-link') expect(relation.linkType, `${item.id}→${relation.targetBandId}`).toBeTruthy()
      }
    }
  })

  it('treats member links as non-musical', () => {
    expect(isMusicalRelation({ kind: 'member-link' })).toBe(false)
    expect(isMusicalRelation({ kind: 'influenced-by' })).toBe(true)
  })
})
