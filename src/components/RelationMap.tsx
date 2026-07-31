import { ArrowRight, GitBranch } from 'lucide-react'
import type { BandDetailCopy } from '../data/siteContent'
import { publicBandById as bandById } from '../data/publicBands'
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
  copy: BandDetailCopy
}

export function RelationMap({ band, onSelect, visitedIds, copy }: RelationMapProps) {
  const hasRelations = band.relations.length > 0
  return (
    <section className="relation-panel" aria-labelledby="relation-title">
      <div className="section-heading compact">
        <span className="eyebrow"><GitBranch size={15} /> {copy.relationEyebrow}</span>
        <h2 id="relation-title">{copy.relationTitle}</h2>
        <p>{copy.relationDescription}</p>
      </div>
      {hasRelations ? (
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
      ) : (
        <p className="relation-empty">{copy.relationEmptyMessage}</p>
      )}
    </section>
  )
}
