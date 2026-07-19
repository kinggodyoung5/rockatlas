import { CheckCircle2, Clipboard, FileJson, Inbox, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildGeminiResearchPrompt, forceIntakeDraft, inspectBandIntake, type IntakeResult } from '../lib/bandIntake'
import type { Band } from '../types/music'

interface BandIntakePanelProps {
  bands: Band[]
  onAddBands: (bands: Band[]) => void
}

const storageKey = 'rock-atlas-band-intake-v1'

export function BandIntakePanel({ bands, onAddBands }: BandIntakePanelProps) {
  const [raw, setRaw] = useState(() => localStorage.getItem(storageKey) ?? '')
  const [result, setResult] = useState<IntakeResult>({ candidates: [], globalIssues: [] })
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('Gemini 답변은 저장 전까지 이 브라우저에 임시 보관됩니다.')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (raw) localStorage.setItem(storageKey, raw)
    else localStorage.removeItem(storageKey)
  }, [raw])

  const inspect = (nextRaw = raw) => {
    const next = inspectBandIntake(nextRaw, bands)
    setResult(next)
    setSelectedKeys(new Set(next.candidates.filter((candidate) => candidate.canApprove).map((candidate) => candidate.key)))
    const valid = next.candidates.filter((candidate) => candidate.canApprove).length
    setMessage(next.globalIssues.length ? 'JSON을 읽는 중 문제가 발견됐습니다.' : `${next.candidates.length}개를 읽었습니다. ${valid}개는 초안 추가가 가능합니다.`)
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildGeminiResearchPrompt())
      setMessage('Gem 지침을 복사했습니다. Gemini의 Gem 지침에 한 번만 붙여넣으세요. 이후 채팅에는 밴드 이름만 입력하면 됩니다.')
    } catch {
      setMessage('복사 권한이 없어 실패했습니다. 브라우저의 클립보드 권한을 확인하세요.')
    }
  }

  const loadFile = async (file: File) => {
    const nextRaw = await file.text()
    setRaw(nextRaw)
    inspect(nextRaw)
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
    onAddBands(approved.map((candidate) => {
      const draft = forceIntakeDraft(candidate.band)
      return { ...draft, relations: draft.relations.filter((relation) => existingIds.has(relation.targetBandId) || approvedIds.has(relation.targetBandId)) }
    }))
    const remaining = result.candidates.filter((candidate) => !approved.some((item) => item.key === candidate.key))
    setResult({ ...result, candidates: remaining })
    setSelectedKeys(new Set())
    if (!remaining.length) setRaw('')
    setMessage(`${approved.length}개를 비공개 초안으로 추가했습니다. 상단의 ‘전체 저장’을 누르면 파일에 반영됩니다.`)
  }

  const clear = () => {
    setRaw('')
    setResult({ candidates: [], globalIssues: [] })
    setSelectedKeys(new Set())
    setMessage('검수함을 비웠습니다.')
  }

  const validSelectedCount = result.candidates.filter((candidate) => candidate.canApprove && selectedKeys.has(candidate.key)).length

  return (
    <section id="intake" className="studio-form-section band-intake-panel">
      <div className="studio-section-heading"><span><Inbox size={22} /></span><div><h3>새 밴드 검수함</h3><p>Gemini 조사 결과를 자동으로 정리하고, 중복·필수 정보·분류값을 확인한 뒤 안전한 비공개 초안으로만 추가합니다.</p></div></div>

      <ol className="intake-steps">
        <li><strong>1</strong><span><b>Gem 지침 최초 1회 등록</b>복사한 내용을 Gemini의 Gem 지침에 저장합니다.</span></li>
        <li><strong>2</strong><span><b>결과 붙여넣기</b>코드 블록이나 설명이 섞여 있어도 자동으로 JSON을 찾습니다.</span></li>
        <li><strong>3</strong><span><b>검사 후 초안 추가</b>오류 없는 항목만 선택해 기존 목록 뒤에 추가합니다.</span></li>
      </ol>

      <div className="intake-actions">
        <button type="button" className="is-primary" onClick={() => void copyPrompt()}><Clipboard size={16} /> Gemini Gem 지침 복사</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} /> JSON 파일 선택</button>
        <input ref={fileRef} hidden type="file" accept="application/json,.json,text/plain" onChange={(event) => event.target.files?.[0] && void loadFile(event.target.files[0])} />
        <button type="button" onClick={clear}><Trash2 size={15} /> 비우기</button>
      </div>

      <label className="intake-textarea">Gemini 답변 붙여넣기
        <textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={10} placeholder={'Gemini 답변 전체를 여기에 붙여넣으세요.\n```json ... ``` 형태도 그대로 넣으면 됩니다.'} />
      </label>
      <div className="intake-inspect-row"><button type="button" className="is-primary" disabled={!raw.trim()} onClick={() => inspect()}><FileJson size={16} /> 자동 정리·검사</button><span>{message}</span></div>

      {result.globalIssues.map((issue) => <p key={issue.code} className="intake-global-error">{issue.message}</p>)}

      {result.candidates.length > 0 && <div className="intake-results">
        <header><div><strong>검사 결과</strong><span>초록색은 바로 초안 추가 가능, 빨간색은 JSON 수정이 필요합니다.</span></div><button type="button" className="is-primary" disabled={!validSelectedCount} onClick={approve}><ShieldCheck size={16} /> 선택한 {validSelectedCount}개 초안 추가</button></header>
        <div className="intake-candidate-list">
          {result.candidates.map((candidate) => {
            const errors = candidate.issues.filter((issue) => issue.severity === 'error')
            const warnings = candidate.issues.filter((issue) => issue.severity === 'warning')
            return <article key={candidate.key} data-status={candidate.canApprove ? 'ready' : 'blocked'}>
              <label className="intake-candidate-head"><input type="checkbox" disabled={!candidate.canApprove} checked={selectedKeys.has(candidate.key)} onChange={() => setSelectedKeys((current) => { const next = new Set(current); if (next.has(candidate.key)) next.delete(candidate.key); else next.add(candidate.key); return next })} /><span><strong>{candidate.band.name || '이름 없음'}</strong><small>{candidate.band.id} · {candidate.band.formed} · {candidate.band.countryCode || '국가 미입력'}</small></span><em>{candidate.canApprove ? <><CheckCircle2 size={15} /> 초안 추가 가능</> : `수정 필요 ${errors.length}`}</em></label>
              <div className="intake-candidate-summary"><span>대표 장르 <b>{candidate.band.taxonomyV2?.primaryGenreId}</b></span><span>세부 장르 <b>{candidate.band.taxonomyV2?.subgenreIds.length ?? 0}</b></span><span>분위기 <b>{Object.keys(candidate.band.taxonomyV2?.moodScores ?? {}).length}</b></span><span>출처 <b>{candidate.band.sources.length}</b></span></div>
              {candidate.issues.length > 0 && <ul>{candidate.issues.map((issue, index) => <li key={`${issue.code}-${index}`} data-severity={issue.severity}>{issue.message}</li>)}</ul>}
              {!errors.length && warnings.length > 0 && <p>경고는 초안 추가를 막지 않습니다. 추가 후 왼쪽 밴드 목록에서 내용을 보완할 수 있습니다.</p>}
            </article>
          })}
        </div>
      </div>}

      <div className="intake-safety-note"><ShieldCheck size={18} /><p><strong>기존 밴드는 덮어쓰지 않습니다.</strong> 중복 ID·이름·외부 식별자는 차단하며, 가져온 밴드·관계·곡·이미지는 모두 검수 전 상태로 고정됩니다.</p></div>
    </section>
  )
}
