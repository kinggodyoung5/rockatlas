import { AlertTriangle, Check, Database, ExternalLink, HelpCircle } from 'lucide-react'
import type { IdentityProvider, IntakeFactCheck, IntakeIdentityVerification, RankedIdentityCandidate } from '../lib/intakeVerification'

interface IntakeVerificationCardProps {
  verification: IntakeIdentityVerification
  onSelect: (provider: IdentityProvider, id: string) => void
  onUseFact: (fact: IntakeFactCheck) => void
}

const providerLabel = (provider: IdentityProvider) => provider === 'wikidata' ? 'Wikidata' : 'MusicBrainz'

function CandidateOption({ candidate, provider, selected, onSelect }: {
  candidate: RankedIdentityCandidate
  provider: IdentityProvider
  selected: boolean
  onSelect: (provider: IdentityProvider, id: string) => void
}) {
  const meta = [
    candidate.entityType,
    candidate.origin ?? candidate.area,
    candidate.country,
    candidate.formed,
  ].filter(Boolean).join(' · ')
  return <button type="button" className={selected ? 'is-selected' : ''} onClick={() => onSelect(provider, candidate.id)}>
    <span><strong>{candidate.name}</strong><small>{meta || candidate.description || candidate.id}</small><em>일치도 {candidate.matchScore} · {candidate.matchReasons.slice(0, 2).join(' · ') || '추가 확인 필요'}</em></span>
    {selected ? <Check size={15} /> : <HelpCircle size={15} />}
  </button>
}

export function IntakeVerificationCard({ verification, onSelect, onUseFact }: IntakeVerificationCardProps) {
  return (
    <section className="intake-verification" data-status={verification.status}>
      <header>
        <span>{verification.status === 'verified' ? <Check size={17} /> : <AlertTriangle size={17} />}</span>
        <div><strong>외부 자료 교차검증</strong><small>{verification.message}</small></div>
        <em>{verification.status === 'verified' ? '자동 확인 완료' : `확인 필요 ${verification.manualActionCount}`}</em>
      </header>

      <div className="intake-provider-grid">
        {([verification.wikidata, verification.musicbrainz] as const).map((resolution) => (
          <article key={resolution.provider} data-status={resolution.status}>
            <h5><Database size={14} /> {providerLabel(resolution.provider)}</h5>
            <p>{resolution.message}</p>
            {resolution.selected && <div className="intake-selected-source">
              <span><strong>{resolution.selected.name}</strong><small>{resolution.selected.id}</small></span>
              <a href={resolution.selected.url} target="_blank" rel="noreferrer" aria-label="원문 열기"><ExternalLink size={14} /></a>
            </div>}
            {resolution.selected && resolution.candidates.length > 1 && <details className="intake-alternative-sources">
              <summary>다른 후보가 맞다면 변경</summary>
              <div className="intake-provider-options">
                {resolution.candidates.slice(0, 3).map((candidate) => (
                  <CandidateOption key={candidate.id} candidate={candidate} provider={resolution.provider} selected={candidate.id === resolution.selected?.id} onSelect={onSelect} />
                ))}
              </div>
            </details>}
            {!resolution.selected && <div className="intake-provider-options">
              {resolution.candidates.slice(0, 3).map((candidate) => (
                <CandidateOption key={candidate.id} candidate={candidate} provider={resolution.provider} selected={false} onSelect={onSelect} />
              ))}
              {!resolution.candidates.length && <small>후보를 찾지 못했습니다. 초안 추가 후 기존 수동 검색기를 사용할 수 있습니다.</small>}
            </div>}
          </article>
        ))}
      </div>

      <div className="intake-fact-checks">
        {verification.facts.map((fact) => (
          <article key={fact.id} data-status={fact.status}>
            <span><strong>{fact.label}</strong><small>입력 {fact.entered} · 외부 {fact.external}</small></span>
            <em>{fact.status === 'verified' ? '일치' : fact.status === 'missing' ? '자료 없음' : '확인 필요'}</em>
            {fact.status === 'review' && fact.external !== '자료 없음' && <button type="button" onClick={() => onUseFact(fact)}>외부 값 사용</button>}
          </article>
        ))}
      </div>
    </section>
  )
}
