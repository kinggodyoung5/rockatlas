import { AlertTriangle, CheckCircle2, Database, LoaderCircle, Pause, Play, RefreshCw, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyExternalFact, auditBandFacts, type CatalogFactAudit, type FactEvidence } from '../lib/factAudit'
import type { Band } from '../types/music'

const storageKey = 'rock-atlas-fact-audit-v1'

interface CatalogFactAuditPanelProps {
  bands: Band[]
  selectedBandId: string
  onSelectBand: (band: Band) => void
  onUpdateBand: (band: Band) => void
}

function loadStoredAudits(): Record<string, CatalogFactAudit> {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, CatalogFactAudit> } catch { return {} }
}

export function CatalogFactAuditPanel({ bands, selectedBandId, onSelectBand, onUpdateBand }: CatalogFactAuditPanelProps) {
  const [audits, setAudits] = useState<Record<string, CatalogFactAudit>>(loadStoredAudits)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const stopRef = useRef(false)
  const selected = bands.find((band) => band.id === selectedBandId) ?? bands[0]

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(audits)) }, [audits])

  const summary = useMemo(() => {
    const values = Object.values(audits).filter((audit) => bands.some((band) => band.id === audit.bandId))
    return {
      checked: values.length,
      verified: values.filter((item) => item.status === 'verified').length,
      review: values.filter((item) => item.status === 'review').length,
      error: values.filter((item) => item.status === 'error').length,
    }
  }, [audits, bands])

  const run = async (targets: Band[]) => {
    if (running || !targets.length) return
    stopRef.current = false
    setRunning(true)
    setProgress({ done: 0, total: targets.length, current: targets[0].name })
    for (let index = 0; index < targets.length; index += 1) {
      if (stopRef.current) break
      const band = targets[index]
      setProgress({ done: index, total: targets.length, current: band.name })
      try {
        const result = await auditBandFacts(band)
        setAudits((current) => ({ ...current, [band.id]: result }))
      } catch (error) {
        setAudits((current) => ({ ...current, [band.id]: {
          bandId: band.id, bandName: band.name, checkedAt: new Date().toISOString(), status: 'error', linkedAcrossSources: false,
          identity: { wikidataId: '', musicBrainzId: '', wikidataName: '', musicBrainzName: '' }, facts: [], albums: [], externalMembers: [], memberChecks: [], trackChecks: [],
          issues: [{ severity: 'error', code: 'network', message: error instanceof Error ? error.message : '외부 검사 실패' }],
        } }))
      }
      setProgress({ done: index + 1, total: targets.length, current: band.name })
      if (index < targets.length - 1 && !stopRef.current) await new Promise((resolve) => window.setTimeout(resolve, 1_050))
    }
    setRunning(false)
  }

  const applyFact = (band: Band, fact: FactEvidence) => {
    onUpdateBand(applyExternalFact(band, fact))
    setAudits((current) => {
      const next = { ...current }
      delete next[band.id]
      return next
    })
  }

  const unresolved = Object.values(audits)
    .filter((audit) => audit.status !== 'verified' && bands.some((band) => band.id === audit.bandId))
    .sort((left, right) => (left.status === 'error' ? -1 : 1) - (right.status === 'error' ? -1 : 1) || left.bandName.localeCompare(right.bandName))

  return <details className="catalog-fact-audit" open>
    <summary><Database size={14} /> 외부 사실 정밀 검수 <em>{summary.checked}/{bands.length}</em></summary>
    <div className="catalog-fact-audit-body">
      <div className="catalog-fact-audit-intro">
        <div><strong>기존 밴드도 같은 기준으로 다시 확인합니다</strong><p>Wikidata와 MusicBrainz의 실제 ID·밴드명·결성연도·국가·결성지·앨범을 다시 조회합니다. 일치하지 않는 항목만 아래에 남습니다.</p></div>
        <div className="catalog-fact-audit-actions">
          <button type="button" disabled={!selected || running} onClick={() => selected && void run([selected])}><RefreshCw size={14} /> 선택 밴드 검사</button>
          <button type="button" className="is-primary" disabled={running} onClick={() => void run(bands)}><Play size={14} /> 전체 {bands.length}개 이어서 검사</button>
          {running && <button type="button" onClick={() => { stopRef.current = true }}><Pause size={14} /> 안전하게 중지</button>}
        </div>
      </div>
      <div className="catalog-fact-audit-summary">
        <span data-state="good"><CheckCircle2 size={15} /><b>{summary.verified}</b> 일치</span>
        <span data-state="attention"><AlertTriangle size={15} /><b>{summary.review}</b> 확인 필요</span>
        <span data-state="danger"><AlertTriangle size={15} /><b>{summary.error}</b> 식별 오류</span>
        <span><Database size={15} /><b>{bands.length - summary.checked}</b> 미검사</span>
      </div>
      {running && <div className="catalog-fact-audit-progress"><LoaderCircle className="is-spinning" size={16} /><span><strong>{progress.current}</strong><small>{progress.done}/{progress.total} · 중간에 멈춰도 완료 결과는 보존됩니다.</small></span><progress value={progress.done} max={progress.total} /></div>}
      {!running && summary.checked > 0 && !unresolved.length && <p className="catalog-fact-audit-clear"><CheckCircle2 size={16} /> 검사한 밴드에서 구조화 사실 불일치를 찾지 못했습니다.</p>}
      <div className="catalog-fact-audit-list">
        {unresolved.map((audit) => {
          const band = bands.find((item) => item.id === audit.bandId)
          if (!band) return null
          const reviewFacts = audit.facts.filter((fact) => fact.status === 'review')
          const uncertainTracks = audit.trackChecks.filter((track) => track.status === 'review')
          return <article key={audit.bandId} data-status={audit.status}>
            <header><span><strong>{audit.bandName}</strong><small>{audit.linkedAcrossSources ? '두 식별자 직접 연결 확인' : '식별자 연결 확인 필요'} · {new Date(audit.checkedAt).toLocaleString('ko-KR')}</small></span><button type="button" onClick={() => onSelectBand(band)}><Wrench size={13} /> 편집 화면 열기</button></header>
            {audit.issues.length > 0 && <ul>{audit.issues.map((issue) => <li key={`${issue.code}-${issue.message}`} data-severity={issue.severity}>{issue.message}</li>)}</ul>}
            {reviewFacts.length > 0 && <div className="catalog-fact-fixes">{reviewFacts.map((fact) => <div key={fact.id}><span><strong>{fact.label}</strong><small>현재 {fact.localValue || '없음'} → 외부 {fact.externalValue} · {fact.sources.join('·')} · 신뢰도 {fact.confidence === 'high' ? '높음' : '보통'}</small></span><button type="button" onClick={() => applyFact(band, fact)}>외부 값 적용</button></div>)}</div>}
            {uncertainTracks.length > 0 && <p className="catalog-track-warning">앨범 대조 필요: {uncertainTracks.map((track) => track.title).join(', ')}</p>}
            {audit.memberChecks.some((member) => member.status === 'missing') && <p className="catalog-member-note">MusicBrainz 멤버 관계에서 찾지 못한 이름이 있습니다. 데이터베이스 누락일 수도 있으므로 자동 삭제하지 않습니다: {audit.memberChecks.filter((member) => member.status === 'missing').map((member) => member.name).join(', ')}</p>}
          </article>
        })}
      </div>
      <small className="catalog-fact-audit-footnote">전체 검사는 MusicBrainz 사용 규칙에 맞춰 천천히 진행됩니다. 결과는 이 PC 브라우저에 저장되며, 외부 값은 버튼을 눌러야만 편집본에 반영됩니다.</small>
    </div>
  </details>
}
