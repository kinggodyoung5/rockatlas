import type { MemberLinkType, Relation, RelationKind } from '../types/music'

/** One source of truth for how relation kinds read on the public site and in Studio — they used to
 *  disagree (the retired 'evolution' kind showed as "세대 전환" publicly but "계보의 확장" in Studio). */
export const relationLabels: Record<RelationKind, string> = {
  'sounds-like': '닮은 사운드',
  'influenced-by': '영향을 받음',
  influenced: '영향을 줌',
  'shared-scene': '같은 장면',
  'member-link': '멤버로 이어짐',
}

export const memberLinkLabels: Record<MemberLinkType, string> = {
  successor: '후신 밴드',
  moved: '멤버 이동',
  shared: '멤버 겸업',
  session: '세션 참여',
}

/** How the public relation section groups kinds: history of influence, shared sound/scene, and people.
 *  Order here is display order. */
export const relationGroups = [
  { id: 'influence', title: '영향의 흐름', description: '이 밴드에 영향을 준 선배와 영향을 받은 후배', kinds: ['influenced-by', 'influenced'] },
  { id: 'scene', title: '같은 장면 · 닮은 소리', description: '같은 시대·신에서 활동했거나 소리가 닮은 밴드', kinds: ['shared-scene', 'sounds-like'] },
  { id: 'people', title: '멤버로 이어진 밴드', description: '같은 사람이 거쳐 간 밴드입니다. 소리가 비슷하다는 뜻은 아닙니다.', kinds: ['member-link'] },
] as const satisfies ReadonlyArray<{ id: string; title: string; description: string; kinds: readonly RelationKind[] }>

/** Relation kinds that describe the music itself. A member link is a fact about people and must never
 *  feed similarity or recommendation scores. */
export const isMusicalRelation = (relation: Pick<Relation, 'kind'>) => relation.kind !== 'member-link'

export type RelationEvidence = 'sourced' | 'editorial'

/** A relation counts as sourced only when it links to where the claim can be checked. */
export function relationEvidence(relation: Pick<Relation, 'source'>): RelationEvidence {
  return relation.source?.url ? 'sourced' : 'editorial'
}
