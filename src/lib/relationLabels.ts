import type { Relation, RelationKind } from '../types/music'

/** One source of truth for how relation kinds read on the public site and in Studio — they used to
 *  disagree ('evolution' showed as "세대 전환" publicly but "계보의 확장" in Studio). */
export const relationLabels: Record<RelationKind, string> = {
  'sounds-like': '닮은 사운드',
  'influenced-by': '영향을 받음',
  influenced: '영향을 줌',
  'shared-scene': '같은 장면',
  // Most of these are bands joined by a member (successor bands, a member leaving to start another);
  // a few older ones are genre-history readings still awaiting re-classification (plan P2-2).
  evolution: '계보로 이어짐',
}

export type RelationEvidence = 'sourced' | 'editorial'

/** A relation counts as sourced only when it links to where the claim can be checked. */
export function relationEvidence(relation: Pick<Relation, 'source'>): RelationEvidence {
  return relation.source?.url ? 'sourced' : 'editorial'
}
