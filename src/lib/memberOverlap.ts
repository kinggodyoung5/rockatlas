import type { Band } from '../types/music'

/** A person found in the member lists of two bands that aren't member-linked yet. Only a *candidate*:
 *  same name ≠ same person (The Clash's Mick Jones is not Foreigner's), and a session player isn't a
 *  lineage link, so an operator decides each one (plan P2-3). */
export interface MemberOverlapCandidate {
  pairKey: string
  bandIds: [string, string]
  people: string[]
}

export type MemberLinkDecision = 'namesake' | 'session' | 'not-relevant'

export interface MemberLinkDecisionRecord {
  pairKey: string
  person: string
  decision: MemberLinkDecision
  note?: string
  decidedAt: string
}

/** Anonymous or collective names that look like people but aren't one person. */
const anonymousNames = new Set(['namelessghouls', 'vessel', 'ii', 'iii', 'iv'])

/** Comparable form of a person's name: no accents, no quoted nickname, no bracketed note, letters only. */
export function normalizeMemberName(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/["“”].*?["“”]/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export const memberPairKey = (left: string, right: string) => [left, right].sort().join('|')

export function findMemberOverlaps(bands: Band[], decisions: MemberLinkDecisionRecord[] = []): MemberOverlapCandidate[] {
  const decided = new Set(decisions.map((record) => `${record.pairKey}#${normalizeMemberName(record.person)}`))
  const bandsByPerson = new Map<string, { display: string; bandIds: Set<string> }>()
  for (const band of bands) {
    for (const member of band.members) {
      const key = normalizeMemberName(member.name)
      if (key.length < 3 || anonymousNames.has(key)) continue
      const entry = bandsByPerson.get(key) ?? { display: member.name, bandIds: new Set<string>() }
      entry.bandIds.add(band.id)
      bandsByPerson.set(key, entry)
    }
  }

  const byId = new Map(bands.map((band) => [band.id, band]))
  // Any existing relation counts: when a pair already has an influence or scene relation the operator
  // keeps that one (a pair holds a single relation), so the overlap is no longer a new candidate.
  const linked = (left: string, right: string) => byId.get(left)?.relations.some((relation) => relation.targetBandId === right)
    || byId.get(right)?.relations.some((relation) => relation.targetBandId === left)
  const candidates = new Map<string, MemberOverlapCandidate>()
  for (const [personKey, { display, bandIds }] of bandsByPerson) {
    const ids = [...bandIds].sort()
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const pairKey = memberPairKey(ids[i], ids[j])
        if (linked(ids[i], ids[j]) || decided.has(`${pairKey}#${personKey}`)) continue
        const candidate = candidates.get(pairKey) ?? { pairKey, bandIds: [ids[i], ids[j]] as [string, string], people: [] }
        candidate.people.push(display)
        candidates.set(pairKey, candidate)
      }
    }
  }
  return [...candidates.values()].sort((left, right) => right.people.length - left.people.length || left.pairKey.localeCompare(right.pairKey))
}
