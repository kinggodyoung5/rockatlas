import { ArrowRight, GitBranch } from 'lucide-react'
import type { BandDetailCopy } from '../data/siteContent'
import { publicBandById as bandById } from '../data/publicBands'
import type { Band, Relation } from '../types/music'
import { memberLinkLabels, relationEvidence, relationGroups, relationLabels } from '../lib/relationLabels'

interface RelationMapProps {
  band: Band
  onSelect: (band: Band) => void
  visitedIds: string[]
  copy: BandDetailCopy
}

/** The card describes the *other* band, so influence reads from its side: the band this one was
 *  influenced by is its "선배", the one it influenced is its "후배". */
function nodeLabel(relation: Relation) {
  if (relation.kind === 'influenced-by') return '영향을 준 선배'
  if (relation.kind === 'influenced') return '영향을 받은 후배'
  if (relation.kind === 'member-link') return relation.linkType ? memberLinkLabels[relation.linkType] : relationLabels['member-link']
  return relationLabels[relation.kind]
}

export function RelationMap({ band, onSelect, visitedIds, copy }: RelationMapProps) {
  const visible = band.relations.filter((relation) => bandById[relation.targetBandId])
  const groups = relationGroups
    .map((group) => ({
      ...group,
      relations: visible
        .filter((relation) => (group.kinds as readonly string[]).includes(relation.kind))
        // Seniors before juniors, then the band's own order.
        .sort((left, right) => group.kinds.indexOf(left.kind as never) - group.kinds.indexOf(right.kind as never)),
    }))
    .filter((group) => group.relations.length > 0)

  return (
    <section className="relation-panel" aria-labelledby="relation-title">
      <div className="section-heading compact">
        <span className="eyebrow"><GitBranch size={15} /> {copy.relationEyebrow}</span>
        <h2 id="relation-title">{copy.relationTitle}</h2>
        <p>{copy.relationDescription}</p>
      </div>
      {groups.length ? (
        <div className="relation-map">
          <div className="relation-core">
            <span>YOU ARE HERE</span>
            <strong>{band.name}</strong>
          </div>
          <div className="relation-rail" aria-hidden="true" />
          <div className="relation-nodes">
            {groups.map((group) => (
              <div key={group.id} className={`relation-group relation-group-${group.id}`}>
                <div className="relation-group-heading"><h3>{group.title}</h3><p>{group.description}</p></div>
                <div className="relation-group-grid">
                  {group.relations.map((item) => {
                    const target = bandById[item.targetBandId]
                    const nextBands = target.relations
                      .filter((next) => next.kind !== 'member-link' || item.kind === 'member-link')
                      .map((next) => bandById[next.targetBandId])
                      .filter((next): next is Band => Boolean(next) && next.id !== band.id)
                      .slice(0, 2)
                    return (
                      <button key={`${item.targetBandId}-${item.kind}`} className="relation-node" onClick={() => onSelect(target)}>
                        <span className="node-kind">
                          {nodeLabel(item)}
                          {relationEvidence(item) === 'sourced' && <em className="node-sourced" title={item.source?.label}> · 출처 확인</em>}
                          {visitedIds.includes(target.id) && <em> · VISITED</em>}
                        </span>
                        <strong>{target.name}</strong>
                        {item.kind === 'member-link' && item.people?.length ? <span className="node-people">{item.people.join(', ')}</span> : null}
                        <p>{item.note}</p>
                        {nextBands.length > 0 && <span className="node-next">그다음: {nextBands.map((next) => next.name).join(' · ')}</span>}
                        <span className="node-arrow">탐험하기 <ArrowRight size={14} /></span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="relation-empty">{copy.relationEmptyMessage}</p>
      )}
    </section>
  )
}
