import { ArrowRight, GitBranch } from 'lucide-react'
import { publicBandById as bandById, publicBands } from '../data/bands'
import { similarBands } from '../lib/bandSimilarity'
import type { Band, RelationKind } from '../types/music'

const relationLabels: Record<RelationKind, string> = {
  'sounds-like': '닮은 사운드',
  'influenced-by': '영향을 받음',
  influenced: '영향을 줌',
  'shared-scene': '같은 장면',
  evolution: '세대 전환',
}

interface RelationMapProps {
  band: Band
  onSelect: (band: Band) => void
  visitedIds: string[]
}

export function RelationMap({ band, onSelect, visitedIds }: RelationMapProps) {
  const sourcedRelations = band.relations.filter((item) => item.source)
  const relationTargets = new Set(band.relations.map((item) => item.targetBandId))
  const recommendations = similarBands(band, publicBands).filter((item) => !relationTargets.has(item.band.id)).slice(0, Math.max(4, 8 - band.relations.length))
  return (
    <section className="relation-panel" aria-labelledby="relation-title">
      <div className="section-heading compact">
        <span className="eyebrow"><GitBranch size={15} /> DISCOVERY MAP</span>
        <h2 id="relation-title">다음 밴드는 어디로?</h2>
        <p>연결 이유를 보고 마음이 가는 노드를 선택하세요.</p>
      </div>
      <div className="relation-map">
        <div className="relation-core">
          <span>YOU ARE HERE</span>
          <strong>{band.name}</strong>
        </div>
        <div className="relation-rail" aria-hidden="true" />
        <div className="relation-nodes">
          {band.relations.map((item) => {
            const target = bandById[item.targetBandId]
            if (!target) return null
            const nextBands = target.relations
              .map((next) => bandById[next.targetBandId])
              .filter((next): next is Band => Boolean(next) && next.id !== band.id)
              .slice(0, 2)
            return (
              <button key={`${item.targetBandId}-${item.kind}`} className="relation-node" onClick={() => onSelect(target)}>
                <span className="node-kind">{relationLabels[item.kind]} {visitedIds.includes(target.id) && <em>· VISITED</em>}</span>
                <strong>{target.name}</strong>
                <p>{item.note}</p>
                {nextBands.length > 0 && <span className="node-next">그다음: {nextBands.map((next) => next.name).join(' · ')}</span>}
                <span className="node-arrow">탐험하기 <ArrowRight size={14} /></span>
              </button>
            )
          })}
        </div>
      </div>
      {recommendations.length > 0 && (
        <div className="similarity-panel">
          <div><strong>자동 유사도 추천</strong><p>검수된 영향 관계가 아니라 장르·세부 장르·분위기·시대의 유사성으로 계산한 탐색 후보입니다.</p></div>
          <div className="similarity-grid">{recommendations.map((item) => <button key={item.band.id} onClick={() => onSelect(item.band)}><span>{item.score}% SIMILAR</span><strong>{item.band.name}</strong><p>{item.reasons.join(' · ') || '분위기와 활동 시기 교차'}</p><em>추천으로 이동 <ArrowRight size={13} /></em></button>)}</div>
        </div>
      )}
      {sourcedRelations.length > 0 && (
        <div className="relation-sources" aria-label="검수된 관계 근거">
          <strong>검수된 관계 근거</strong>
          {sourcedRelations.map((item) => {
            const target = bandById[item.targetBandId]
            return (
              <a key={`${item.targetBandId}-${item.kind}`} href={item.source!.url} target="_blank" rel="noreferrer">
                {target?.name ?? item.targetBandId} · {item.source!.publisher}
              </a>
            )
          })}
        </div>
      )}
      <p className="map-note">관계 {band.relations.length}개 중 {sourcedRelations.length}개는 근거 출처 검수를 마쳤습니다.</p>
    </section>
  )
}
