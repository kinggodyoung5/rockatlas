import { CheckCircle2, Clipboard, FileJson, Inbox, Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildGeminiResearchPrompt, finalizeIntakeBand, inspectBandIntake, lookupCommonsImage, refreshCandidateReviewState, type IntakeCandidate, type IntakeResult } from '../lib/bandIntake'
import { applyVerifiedIdentity, buildIdentityVerification, searchIdentityVerification, type IdentityProvider, type IntakeFactCheck, type IntakeIdentityVerification } from '../lib/intakeVerification'
import type { Band, PendingRelation } from '../types/music'
import { IntakeVerificationCard } from './IntakeVerificationCard'
import { BandResearchStarter } from './BandResearchStarter'

interface BandIntakePanelProps {
  bands: Band[]
  onAddBands: (bands: Band[], pendingRelations: PendingRelation[]) => void
}

const storageKey = 'rock-atlas-band-intake-v1'

export function BandIntakePanel({ bands, onAddBands }: BandIntakePanelProps) {
  const [raw, setRaw] = useState(() => localStorage.getItem(storageKey) ?? '')
  const [result, setResult] = useState<IntakeResult>({ candidates: [], globalIssues: [] })
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [editorialApprovedKeys, setEditorialApprovedKeys] = useState<Set<string>>(new Set())
  const [verifications, setVerifications] = useState<Record<string, IntakeIdentityVerification>>({})
  const [message, setMessage] = useState('Gemini 답변은 저장 전까지 이 브라우저에 임시 보관됩니다.')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (raw) localStorage.setItem(storageKey, raw)
    else localStorage.removeItem(storageKey)
  }, [raw])

  const applyVerification = async (candidate: IntakeCandidate, verification: IntakeIdentityVerification) => {
    candidate.band = applyVerifiedIdentity(candidate.band, verification)
    const selectedWikidata = Boolean(verification.wikidata.selected)
    const selectedMusicBrainz = Boolean(verification.musicbrainz.selected)
    const removableCodes = new Set<string>()
    if (selectedWikidata) ['no-wikidata', 'wikidata-mismatch'].forEach((code) => removableCodes.add(code))
    if (selectedMusicBrainz) ['no-musicbrainz', 'musicbrainz-mismatch'].forEach((code) => removableCodes.add(code))
    if (candidate.band.sources.some((source) => source.publisher === 'Wikipedia')) removableCodes.add('no-wikipedia')
    if (candidate.band.sources.some((source) => source.publisher === 'YouTube' && source.official)) removableCodes.add('no-official-channel')
    candidate.issues = candidate.issues.filter((issue) => !removableCodes.has(issue.code) && !['identity-verified', 'identity-review', 'image-auto-verified', 'external-ready'].includes(issue.code))

    const imageHint = candidate.band.image.credit.sourceUrl
    if (imageHint?.startsWith('File:')) {
      const image = await lookupCommonsImage(imageHint, candidate.band.name)
      if (image.ok && image.originalUrl && image.sourceUrl && image.license && (image.license === 'Public domain' || image.licenseUrl)) {
        candidate.band.image = {
          ...candidate.band.image,
          fileName: image.fileName,
          originalUrl: image.originalUrl,
          displayUrl: image.displayUrl ?? image.originalUrl,
          credit: {
            sourceUrl: image.sourceUrl,
            creator: image.creator,
            license: image.license,
            licenseUrl: image.licenseUrl,
            reviewStatus: 'verified',
            reviewedAt: new Date().toISOString(),
          },
        }
        if (!candidate.band.sources.some((source) => source.publisher === 'Wikimedia Commons' && source.url === image.sourceUrl)) {
          candidate.band.sources = [...candidate.band.sources, {
            label: `${candidate.band.name} — Wikimedia Commons`,
            url: image.sourceUrl,
            publisher: 'Wikimedia Commons',
            note: 'Wikidata 이미지와 Commons API에서 자동 확인한 원본·권리 출처',
          }]
        }
        candidate.issues = candidate.issues.filter((issue) => !['no-image', 'image-lookup-failed'].includes(issue.code))
        candidate.issues.push({ severity: 'info', code: 'image-auto-verified', message: `Wikidata가 연결한 Commons 사진과 라이선스를 자동 확인했습니다: ${image.license}` })
      }
    }

    candidate.issues.push({
      severity: verification.status === 'verified' ? 'info' : 'warning',
      code: verification.status === 'verified' ? 'identity-verified' : 'identity-review',
      message: verification.message,
    })
    refreshCandidateReviewState(candidate, false)
    if (verification.status === 'verified') {
      candidate.issues.push({ severity: 'info', code: 'external-ready', message: '외부 신원·핵심 사실·링크 확인을 마쳤습니다. 아래 소개·분류 요약을 읽고 한 번만 승인하면 공개 준비가 끝납니다.' })
    }
  }

  const inspect = async (nextRaw = raw) => {
    setBusy(true)
    setMessage('JSON 구조와 분류·곡 정보를 먼저 정리하는 중…')
    const next = await inspectBandIntake(nextRaw, bands)
    setResult(next)
    setVerifications({})
    setEditorialApprovedKeys(new Set())
    const verifiable = next.candidates.filter((candidate) => candidate.canApprove)
    const completedVerifications: Record<string, IntakeIdentityVerification> = {}
    if (!next.globalIssues.length && verifiable.length) {
      for (let index = 0; index < verifiable.length; index += 1) {
        const candidate = verifiable[index]
        setMessage(`외부 자료 자동 교차검증 중… ${index + 1}/${verifiable.length} · ${candidate.band.name}`)
        try {
          const verification = await searchIdentityVerification(candidate.band)
          await applyVerification(candidate, verification)
          completedVerifications[candidate.key] = verification
          setVerifications((current) => ({ ...current, [candidate.key]: verification }))
          setResult({ ...next, candidates: [...next.candidates] })
        } catch (error) {
          candidate.issues.push({ severity: 'warning', code: 'identity-search-failed', message: error instanceof Error ? error.message : '외부 자료 자동 검색에 실패했습니다. 초안 추가 후 다시 검색할 수 있습니다.' })
        }
        if (index < verifiable.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 1050))
      }
    }
    setSelectedKeys(new Set(next.candidates.filter((candidate) => candidate.canApprove).map((candidate) => candidate.key)))
    const valid = next.candidates.filter((candidate) => candidate.canApprove).length
    const externallyVerified = Object.values(completedVerifications).filter((verification) => verification.status === 'verified').length
    const needsAttention = Object.values(completedVerifications).filter((verification) => verification.status !== 'verified').length
    setMessage(next.globalIssues.length
      ? 'JSON을 읽는 중 문제가 발견됐습니다.'
      : `${next.candidates.length}개를 읽었습니다. ${valid}개 추가 가능 · 외부 자동 확인 ${externallyVerified}개${needsAttention ? ` · 애매한 항목만 ${needsAttention}개 확인` : ''}. 소개·분류는 요약을 읽고 한 번만 승인하세요.`)
    setBusy(false)
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildGeminiResearchPrompt())
      setMessage('Gem 지침 v7을 복사했습니다. 기존 지침을 교체하세요. Studio 검증 자료와 정식 세부 장르 ID를 우선하고, 관계·외부 ID·링크는 Gemini가 만들지 않습니다.')
    } catch {
      setMessage('복사 권한이 없어 실패했습니다. 브라우저의 클립보드 권한을 확인하세요.')
    }
  }

  const loadFile = async (file: File) => {
    const nextRaw = await file.text()
    setRaw(nextRaw)
    await inspect(nextRaw)
    if (fileRef.current) fileRef.current.value = ''
  }

  const approve = () => {
    const approved = result.candidates.filter((candidate) => candidate.canApprove && selectedKeys.has(candidate.key))
    if (!approved.length) {
      setMessage('추가할 수 있는 밴드를 먼저 선택하세요.')
      return
    }
    const approvedIds = new Set(approved.map((candidate) => candidate.band.id))
    const existingIds = new Set(bands.map((band) => band.id))
    const reviewedCount = approved.filter((candidate) => candidate.band.reviewStatus === 'published').length
    const pendingRelations = approved.flatMap((candidate) => candidate.pendingRelations)
    onAddBands(approved.map((candidate) => {
      const finalized = finalizeIntakeBand(candidate.band)
      return { ...finalized, relations: finalized.relations.filter((relation) => existingIds.has(relation.targetBandId) || approvedIds.has(relation.targetBandId)) }
    }), pendingRelations)
    const remaining = result.candidates.filter((candidate) => !approved.some((item) => item.key === candidate.key))
    setResult({ ...result, candidates: remaining })
    setSelectedKeys(new Set())
    setMessage(`${approved.length}개를 추가했습니다 (운영자 공개 승인 ${reviewedCount}개 · 나머지는 비공개 초안)${pendingRelations.length ? ` · 보류 중인 관계 ${pendingRelations.length}개는 상대 밴드가 추가되면 자동으로 연결됩니다` : ''}. 상단의 ‘전체 저장’이 성공할 때까지 원본 JSON은 이 입력칸과 브라우저에 보존됩니다.`)
  }

  const clear = () => {
    setRaw('')
    setResult({ candidates: [], globalIssues: [] })
    setVerifications({})
    setEditorialApprovedKeys(new Set())
    setSelectedKeys(new Set())
    setMessage('검수함을 비웠습니다.')
  }

  const validSelectedCount = result.candidates.filter((candidate) => candidate.canApprove && selectedKeys.has(candidate.key)).length

  const selectIdentityCandidate = async (key: string, provider: IdentityProvider, id: string) => {
    const candidate = result.candidates.find((item) => item.key === key)
    const current = verifications[key]
    if (!candidate || !current) return
    const manual = {
      wikidata: provider === 'wikidata' ? id : current.wikidata.selected?.id,
      musicbrainz: provider === 'musicbrainz' ? id : current.musicbrainz.selected?.id,
    }
    const nextVerification = buildIdentityVerification(candidate.band, current.wikidata.candidates, current.musicbrainz.candidates, manual)
    await applyVerification(candidate, nextVerification)
    setEditorialApprovedKeys((current) => { const next = new Set(current); next.delete(key); return next })
    setVerifications((all) => ({ ...all, [key]: nextVerification }))
    setResult((currentResult) => ({ ...currentResult, candidates: [...currentResult.candidates] }))
  }

  const useExternalFact = async (key: string, fact: IntakeFactCheck) => {
    const candidate = result.candidates.find((item) => item.key === key)
    const current = verifications[key]
    if (!candidate || !current || fact.external === '자료 없음') return
    if (fact.id === 'formed') candidate.band = { ...candidate.band, formed: Number(fact.external) || candidate.band.formed }
    if (fact.id === 'country' && /^[A-Z]{2}$/i.test(fact.external)) candidate.band = { ...candidate.band, countryCode: fact.external.toUpperCase() }
    if (fact.id === 'origin') candidate.band = { ...candidate.band, origin: fact.external }
    const nextVerification = buildIdentityVerification(candidate.band, current.wikidata.candidates, current.musicbrainz.candidates, {
      wikidata: current.wikidata.selected?.id,
      musicbrainz: current.musicbrainz.selected?.id,
    })
    await applyVerification(candidate, nextVerification)
    setEditorialApprovedKeys((current) => { const next = new Set(current); next.delete(key); return next })
    setVerifications((all) => ({ ...all, [key]: nextVerification }))
    setResult((currentResult) => ({ ...currentResult, candidates: [...currentResult.candidates] }))
  }

  const toggleEditorialApproval = (candidate: IntakeCandidate) => {
    const approved = !editorialApprovedKeys.has(candidate.key)
    refreshCandidateReviewState(candidate, approved)
    if (candidate.band.reviewStatus === 'published') {
      candidate.band.reviewedBy = 'Studio 운영자'
      candidate.band.reviewedAt = new Date().toISOString()
      candidate.issues = candidate.issues.filter((issue) => issue.code !== 'operator-approved')
      candidate.issues.push({ severity: 'info', code: 'operator-approved', message: '운영자가 소개·분류·관계 후보를 확인해 공개 준비 완료로 승인했습니다.' })
    } else {
      candidate.issues = candidate.issues.filter((issue) => issue.code !== 'operator-approved')
      if (approved) setMessage(`${candidate.band.name}: 이미지 권리·출처·필수 설명 중 아직 해결할 항목이 있어 비공개 초안으로 유지합니다. 노란색 안내만 보완하면 다시 한 번 승인할 수 있습니다.`)
    }
    setEditorialApprovedKeys((current) => {
      const next = new Set(current)
      if (candidate.band.reviewStatus === 'published') next.add(candidate.key)
      else next.delete(candidate.key)
      return next
    })
    setResult((current) => ({ ...current, candidates: [...current.candidates] }))
  }

  return (
    <section id="intake" className="studio-form-section band-intake-panel">
      <div className="studio-section-heading"><span><Inbox size={22} /></span><div><h3>새 밴드 검수함 2.0</h3><p>Gemini는 음악 내용 초안만 만들고, 정확한 외부 ID·사진·출처는 Studio가 직접 찾아 교차 확인합니다. 애매한 항목만 운영자가 고르면 됩니다.</p></div></div>

      <BandResearchStarter />

      <ol className="intake-steps">
        <li><strong>1</strong><span><b>Gem 지침 최초 1회 등록</b>복사한 내용을 Gemini의 Gem 지침에 저장합니다.</span></li>
        <li><strong>2</strong><span><b>결과 붙여넣기</b>코드 블록이나 설명이 섞여 있어도 자동으로 JSON을 찾습니다.</span></li>
        <li><strong>3</strong><span><b>전체 자동 확인</b>Wikidata와 MusicBrainz가 같은 밴드를 가리키는지 확인하고, 충돌하는 후보만 선택지로 보여줍니다.</span></li>
      </ol>

      <div className="intake-actions">
        <button type="button" className="is-primary" onClick={() => void copyPrompt()}><Clipboard size={16} /> Gemini Gem 지침 v7 복사</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} /> JSON 파일 선택</button>
        <input ref={fileRef} hidden type="file" accept="application/json,.json,text/plain" onChange={(event) => event.target.files?.[0] && void loadFile(event.target.files[0])} />
        <button type="button" onClick={clear}><Trash2 size={15} /> 비우기</button>
      </div>

      <label className="intake-textarea">Gemini 답변 붙여넣기
        <textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={10} placeholder={'Gemini 답변 전체를 여기에 붙여넣으세요.\n```json ... ``` 형태도 그대로 넣으면 됩니다.'} />
      </label>
      <div className="intake-inspect-row"><button type="button" className="is-primary" disabled={!raw.trim() || busy} onClick={() => void inspect()}>{busy ? <Loader2 size={16} className="is-spinning" /> : <FileJson size={16} />} 전체 자동 확인</button><span>{message}</span></div>

      {result.globalIssues.map((issue) => <p key={issue.code} className="intake-global-error">{issue.message}</p>)}

      {result.candidates.length > 0 && <div className="intake-results">
        <header>
          <div><strong>검사 결과</strong><span>초록색은 바로 초안 추가 가능, 빨간색은 아래 빨간 글씨(오류)를 고쳐야 추가할 수 있습니다.</span></div>
          {validSelectedCount > 0
            ? <button type="button" className="is-primary" onClick={approve}><ShieldCheck size={16} /> 선택한 {validSelectedCount}개 초안 추가</button>
            : <span className="intake-no-selection">추가 가능한 항목이 없습니다 — 아래에서 빨간 글씨(오류)를 확인하세요.</span>}
        </header>
        <div className="intake-candidate-list">
          {result.candidates.map((candidate) => {
            const errors = candidate.issues.filter((issue) => issue.severity === 'error')
            const warnings = candidate.issues.filter((issue) => issue.severity === 'warning')
            return <article key={candidate.key} data-status={candidate.canApprove ? 'ready' : 'blocked'}>
              <label className="intake-candidate-head"><input type="checkbox" disabled={!candidate.canApprove} checked={selectedKeys.has(candidate.key)} onChange={() => setSelectedKeys((current) => { const next = new Set(current); if (next.has(candidate.key)) next.delete(candidate.key); else next.add(candidate.key); return next })} /><span><strong>{candidate.band.name || '이름 없음'}</strong><small>{candidate.band.id} · {candidate.band.formed} · {candidate.band.countryCode || '국가 미입력'}</small></span><em>{candidate.canApprove ? (candidate.band.reviewStatus === 'published' ? <><ShieldCheck size={15} /> 공개 준비 완료</> : verifications[candidate.key]?.status === 'verified' ? <><CheckCircle2 size={15} /> 내용 확인만 남음</> : <><CheckCircle2 size={15} /> 초안 추가 가능</>) : `수정 필요 ${errors.length}`}</em></label>
              <div className="intake-candidate-summary"><span>대표 장르 <b>{candidate.band.taxonomyV2?.primaryGenreId}</b></span><span>세부 장르 <b>{candidate.band.taxonomyV2?.subgenreIds.length ?? 0}</b></span><span>분위기 <b>{Object.keys(candidate.band.taxonomyV2?.moodScores ?? {}).length}</b></span><span>출처 <b>{candidate.band.sources.length}</b></span></div>
              {verifications[candidate.key] && <IntakeVerificationCard
                verification={verifications[candidate.key]}
                onSelect={(provider, id) => void selectIdentityCandidate(candidate.key, provider, id)}
                onUseFact={(fact) => void useExternalFact(candidate.key, fact)}
              />}
              {verifications[candidate.key]?.status === 'verified' && <details className="intake-editorial-preview">
                <summary>소개·분류·관계 후보 빠른 확인</summary>
                <div><strong>업적·발자취</strong><p>{candidate.band.summary || '소개문 없음'}</p></div>
                <div><strong>어떤 음악인가요</strong><p>{candidate.band.style || '음악 설명 없음'}</p></div>
                <div><strong>분류</strong><p>{candidate.band.taxonomyV2?.primaryGenreId} · {candidate.band.taxonomyV2?.subgenreIds.join(', ') || '세부 장르 없음'} · 분위기 {Object.keys(candidate.band.taxonomyV2?.moodScores ?? {}).length}개</p></div>
                <div><strong>장르 변화</strong><p>{candidate.band.eraTags.length > 1
                  ? candidate.band.eraTags.map((tag) => `${tag.era}: ${tag.subgenres.join('·')}${tag.note ? ` — ${tag.note}` : ''}`).join(' / ')
                  : '뚜렷한 장기 노선 변화 없음 — 결성 시대의 핵심 장르를 현재까지 유지하는 것으로 처리'}</p></div>
                <div><strong>관계 후보</strong><p>{candidate.band.relations.length || candidate.pendingRelations.length ? [...candidate.band.relations.map((relation) => `${relation.targetBandId} (${relation.kind})`), ...candidate.pendingRelations.map((relation) => `${relation.targetBandId} (${relation.kind}, 추가 대기)`) ].join(' · ') : '없음'}</p></div>
                <label><input type="checkbox" checked={editorialApprovedKeys.has(candidate.key)} onChange={() => toggleEditorialApproval(candidate)} /> 위 소개·분류·관계 후보를 읽고 공개로 추가</label>
              </details>}
              {candidate.issues.length > 0 && <ul>{candidate.issues.map((issue, index) => <li key={`${issue.code}-${index}`} data-severity={issue.severity}>{issue.message}</li>)}</ul>}
              {!errors.length && warnings.length > 0 && <p>경고는 초안 추가를 막지 않습니다. 추가 후 왼쪽 밴드 목록에서 내용을 보완할 수 있습니다.</p>}
            </article>
          })}
        </div>
      </div>}

      <div className="intake-safety-note"><ShieldCheck size={18} /><p><strong>기존 밴드는 덮어쓰지 않습니다.</strong> 중복 ID·이름·외부 식별자는 차단합니다. 두 데이터베이스가 교차 연결되고 핵심 정보와 권리까지 확인된 경우만 공개 준비 완료로 표시합니다. 확신이 부족하면 삭제하지 않고 비공개 초안으로 보존합니다.</p></div>
    </section>
  )
}
