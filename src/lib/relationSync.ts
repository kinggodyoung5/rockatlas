import type { Band, PendingRelation, Relation, RelationKind } from '../types/music'

export const inverseRelationKind = (kind: RelationKind): RelationKind =>
  kind === 'influenced-by' ? 'influenced' : kind === 'influenced' ? 'influenced-by' : kind

export function resolvePendingRelations(bandsList: Band[], pendingList: PendingRelation[]) {
  let bands = bandsList
  const remaining: PendingRelation[] = []
  let resolvedCount = 0

  for (const pending of pendingList) {
    const source = bands.find((band) => band.id === pending.sourceBandId)
    const target = bands.find((band) => band.id === pending.targetBandId)
    if (!source || !target || pending.sourceBandId === pending.targetBandId) {
      remaining.push(pending)
      continue
    }

    if (!source.relations.some((relation) => relation.targetBandId === pending.targetBandId)) {
      const forward: Relation = {
        targetBandId: pending.targetBandId,
        kind: pending.kind,
        strength: pending.strength,
        note: pending.note,
        reviewStatus: 'draft',
      }
      bands = bands.map((band) => band.id === source.id ? { ...band, relations: [...band.relations, forward] } : band)
    }

    if (!target.relations.some((relation) => relation.targetBandId === pending.sourceBandId)) {
      const mirrored: Relation = {
        targetBandId: pending.sourceBandId,
        kind: inverseRelationKind(pending.kind),
        strength: pending.strength,
        note: `${pending.sourceBandName} 쪽에서 추가한 연결 관계 (자동 생성 · 필요하면 다듬으세요)`,
        reviewStatus: 'draft',
        mirroredFrom: pending.sourceBandId,
      }
      bands = bands.map((band) => band.id === target.id ? { ...band, relations: [...band.relations, mirrored] } : band)
    }
    resolvedCount += 1
  }

  return { bands, remaining, resolvedCount }
}

export function syncMirroredRelation(
  bandsList: Band[],
  ownBandId: string,
  ownBandName: string,
  previous: Relation | undefined,
  next: Relation | undefined,
) {
  let bands = bandsList
  let changed = false

  if (previous) {
    const oldTarget = bands.find((band) => band.id === previous.targetBandId)
    if (oldTarget) {
      const filtered = oldTarget.relations.filter((relation) => !(relation.targetBandId === ownBandId && relation.mirroredFrom === ownBandId))
      if (filtered.length !== oldTarget.relations.length) {
        bands = bands.map((band) => band.id === oldTarget.id ? { ...band, relations: filtered } : band)
        changed = true
      }
    }
  }

  if (next && next.targetBandId !== ownBandId) {
    const newTarget = bands.find((band) => band.id === next.targetBandId)
    if (newTarget && !newTarget.relations.some((relation) => relation.targetBandId === ownBandId)) {
      const mirrored: Relation = {
        targetBandId: ownBandId,
        kind: inverseRelationKind(next.kind),
        strength: next.strength,
        note: `${ownBandName} 쪽에서 추가한 연결 관계 (자동 생성 · 필요하면 다듬으세요)`,
        reviewStatus: 'draft',
        mirroredFrom: ownBandId,
      }
      bands = bands.map((band) => band.id === newTarget.id ? { ...band, relations: [...band.relations, mirrored] } : band)
      changed = true
    }
  }

  return { bands, changed }
}
