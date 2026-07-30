import { describe, expect, it } from 'vitest'
import type { Band, PendingRelation, Relation } from '../types/music'
import { inverseRelationKind, resolvePendingRelations, syncMirroredRelation } from './relationSync'

function band(id: string, relations: Relation[] = []): Band {
  return {
    id,
    name: id.toUpperCase(),
    formed: 2000,
    origin: 'Test',
    countryCode: 'US',
    activeYears: '2000–현재',
    primaryGenre: 'alternative-indie',
    genreIds: ['alternative-indie'],
    subgenres: ['Indie Rock'],
    eraTags: [],
    tags: [],
    summary: '관계 동기화 테스트를 위한 충분히 긴 밴드 소개 문장이다.',
    style: '관계 동기화 테스트를 위한 충분히 긴 밴드의 음악적 특징 설명 문장이다.',
    image: { wikipediaTitle: id, alt: id, credit: { sourceUrl: '', license: '검토 필요', reviewStatus: 'needs-review' } },
    members: [],
    tracks: [],
    relations,
    sources: [],
    taxonomyV2: { primaryGenreId: 'alternative-grunge', secondaryGenreIds: [], subgenreIds: [], moodScores: {}, reviewStatus: 'draft' },
    reviewStatus: 'draft',
  }
}

function pending(targetBandId: string): PendingRelation {
  return {
    id: `alpha->${targetBandId}`,
    sourceBandId: 'alpha',
    sourceBandName: 'ALPHA',
    targetBandId,
    kind: 'influenced-by',
    strength: 3,
    note: '명확한 영향 관계',
    createdAt: '2026-07-30T00:00:00.000Z',
  }
}

describe('relation direction', () => {
  it('방향 관계만 반대로 바꾸고 대칭 관계는 유지한다', () => {
    expect(inverseRelationKind('influenced-by')).toBe('influenced')
    expect(inverseRelationKind('influenced')).toBe('influenced-by')
    expect(inverseRelationKind('shared-scene')).toBe('shared-scene')
  })
})

describe('resolvePendingRelations', () => {
  it('대상 밴드가 없으면 보류 관계를 그대로 보존한다', () => {
    const result = resolvePendingRelations([band('alpha')], [pending('beta')])
    expect(result.resolvedCount).toBe(0)
    expect(result.remaining).toHaveLength(1)
    expect(result.bands[0].relations).toEqual([])
  })

  it('대상 밴드가 생기면 양쪽 관계를 올바른 방향으로 만든다', () => {
    const result = resolvePendingRelations([band('alpha'), band('beta')], [pending('beta')])
    expect(result.resolvedCount).toBe(1)
    expect(result.remaining).toEqual([])
    expect(result.bands.find((item) => item.id === 'alpha')?.relations[0]).toMatchObject({ targetBandId: 'beta', kind: 'influenced-by' })
    expect(result.bands.find((item) => item.id === 'beta')?.relations[0]).toMatchObject({ targetBandId: 'alpha', kind: 'influenced', mirroredFrom: 'alpha' })
  })

  it('이미 존재하는 역방향 관계를 중복 생성하지 않는다', () => {
    const manualReverse: Relation = { targetBandId: 'alpha', kind: 'influenced', strength: 3, note: '기존 검수 관계', reviewStatus: 'reviewed' }
    const result = resolvePendingRelations([band('alpha'), band('beta', [manualReverse])], [pending('beta')])
    expect(result.bands.find((item) => item.id === 'beta')?.relations).toEqual([manualReverse])
    expect(result.bands.find((item) => item.id === 'alpha')?.relations).toHaveLength(1)
  })
})

describe('syncMirroredRelation', () => {
  const forward: Relation = { targetBandId: 'beta', kind: 'influenced-by', strength: 2, note: '영향', reviewStatus: 'draft' }

  it('새 관계를 추가하면 상대 밴드에 자동 미러를 만든다', () => {
    const result = syncMirroredRelation([band('alpha'), band('beta')], 'alpha', 'ALPHA', undefined, forward)
    expect(result.changed).toBe(true)
    expect(result.bands.find((item) => item.id === 'beta')?.relations[0]).toMatchObject({ targetBandId: 'alpha', kind: 'influenced', mirroredFrom: 'alpha' })
  })

  it('관계 대상을 바꾸면 이전 자동 미러를 지우고 새 대상에 만든다', () => {
    const oldMirror: Relation = { targetBandId: 'alpha', kind: 'influenced', strength: 2, note: '자동', reviewStatus: 'draft', mirroredFrom: 'alpha' }
    const result = syncMirroredRelation([band('alpha'), band('beta', [oldMirror]), band('gamma')], 'alpha', 'ALPHA', forward, { ...forward, targetBandId: 'gamma' })
    expect(result.bands.find((item) => item.id === 'beta')?.relations).toEqual([])
    expect(result.bands.find((item) => item.id === 'gamma')?.relations[0]).toMatchObject({ targetBandId: 'alpha', mirroredFrom: 'alpha' })
  })

  it('삭제할 때 운영자가 직접 쓴 역방향 관계는 보존한다', () => {
    const manualReverse: Relation = { targetBandId: 'alpha', kind: 'influenced', strength: 2, note: '수동', reviewStatus: 'reviewed' }
    const result = syncMirroredRelation([band('alpha'), band('beta', [manualReverse])], 'alpha', 'ALPHA', forward, undefined)
    expect(result.changed).toBe(false)
    expect(result.bands.find((item) => item.id === 'beta')?.relations).toEqual([manualReverse])
  })
})
