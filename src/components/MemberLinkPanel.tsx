import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import type { Band, MemberLinkType, Relation } from '../types/music'
import { findMemberOverlaps, type MemberLinkDecision, type MemberLinkDecisionRecord, type MemberOverlapCandidate } from '../lib/memberOverlap'
import { memberLinkLabels } from '../lib/relationLabels'
import { studioFetchJson } from '../lib/studioApiClient'

interface MemberLinkPanelProps {
  bands: Band[]
  /** Applies both sides of a new member link; the operator still saves the catalog as usual. */
  onLink: (updatedBands: Band[]) => void
}

const linkChoices: MemberLinkType[] = ['successor', 'moved', 'shared']
const skipChoices: { decision: MemberLinkDecision; label: string }[] = [
  { decision: 'namesake', label: '동명이인' },
  { decision: 'session', label: '세션·임시' },
  { decision: 'not-relevant', label: '연결 안 함' },
]

function linkNote(from: Band, linkType: MemberLinkType, fromIsEarlier: boolean) {
  if (linkType === 'shared') return '두 밴드에서 같은 멤버가 함께 활동했다.'
  if (linkType === 'successor') return fromIsEarlier ? `${from.name} 멤버들이 이어서 결성한 후신 밴드다.` : `${from.name} 멤버들이 이전에 함께한 전신 밴드다.`
  return fromIsEarlier ? `${from.name} 출신 멤버가 이후 활동한 밴드다.` : `${from.name} 멤버가 합류하기 전에 활동한 밴드다.`
}

/** Studio panel for the member-overlap detector (plan P2-3). Same name ≠ same person, and a session
 *  player isn't lineage, so every candidate is decided by a person, never linked automatically. */
export function MemberLinkPanel({ bands, onLink }: MemberLinkPanelProps) {
  const [decisions, setDecisions] = useState<MemberLinkDecisionRecord[]>([])
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    void studioFetchJson<{ decisions: MemberLinkDecisionRecord[] }>('/api/studio/member-link-decisions')
      .then((file) => setDecisions(file.decisions))
      .catch(() => setMessage('판정 기록을 불러오지 못했습니다. Studio 서버가 실행 중인지 확인하세요.'))
  }, [])
  const candidates = useMemo(() => findMemberOverlaps(bands, decisions), [bands, decisions])
  const byId = useMemo(() => new Map(bands.map((band) => [band.id, band])), [bands])

  const link = (candidate: MemberOverlapCandidate, linkType: MemberLinkType) => {
    const [left, right] = candidate.bandIds.map((id) => byId.get(id)!)
    const [earlier, later] = left.formed <= right.formed ? [left, right] : [right, left]
    const now = new Date().toISOString()
    const relationFor = (from: Band, to: Band): Relation => ({
      targetBandId: to.id, kind: 'member-link', linkType, people: candidate.people, strength: 2,
      note: linkNote(from, linkType, from.id === earlier.id), reviewStatus: 'reviewed', reviewedBy: 'Studio operator', reviewedAt: now,
    })
    onLink([
      { ...earlier, relations: [...earlier.relations, relationFor(earlier, later)] },
      { ...later, relations: [...later.relations, relationFor(later, earlier)] },
    ])
    setMessage(`${earlier.name} ↔ ${later.name}: ${memberLinkLabels[linkType]}으로 연결했습니다. 관계 설명을 다듬은 뒤 저장하세요.`)
  }

  const skip = async (candidate: MemberOverlapCandidate, decision: MemberLinkDecision) => {
    try {
      const file = await studioFetchJson<{ decisions: MemberLinkDecisionRecord[] }>('/api/studio/member-link-decisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairKey: candidate.pairKey, people: candidate.people, decision }),
      })
      setDecisions(file.decisions)
      setMessage(`${candidate.pairKey.replace('|', ' ↔ ')}: 후보에서 제외했습니다.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '판정을 저장하지 못했습니다.')
    }
  }

  return (
    <section className="studio-form-section member-link-panel">
      <div className="studio-section-heading"><span><Users size={15} /></span><div>
        <h3>멤버 공유 후보 {candidates.length}쌍</h3>
        <p>같은 이름의 멤버가 있는데 아직 관계가 없는 밴드 쌍입니다. 같은 사람인지, 계보로 볼 만한지 확인하고 고르세요. 소리가 비슷하다는 뜻이 아닙니다.</p>
      </div></div>
      {message && <p className="member-link-message" role="status">{message}</p>}
      {candidates.length > 0 && <button className="studio-add-row" onClick={() => setOpen(!open)}>{open ? '후보 접기' : '후보 펼치기'}</button>}
      {open && <ul className="member-link-list">
        {candidates.map((candidate) => (
          <li key={candidate.pairKey}>
            <div><strong>{candidate.bandIds.map((id) => byId.get(id)?.name ?? id).join(' ↔ ')}</strong><small>{candidate.people.join(', ')}</small></div>
            <div className="member-link-actions">
              {linkChoices.map((linkType) => <button key={linkType} onClick={() => link(candidate, linkType)}>{memberLinkLabels[linkType]}</button>)}
              {skipChoices.map(({ decision, label }) => <button key={decision} className="is-muted" onClick={() => void skip(candidate, decision)}>{label}</button>)}
            </div>
          </li>
        ))}
      </ul>}
    </section>
  )
}
