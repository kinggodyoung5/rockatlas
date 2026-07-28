import { CheckCircle2, Clipboard, FileJson, Inbox, Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildGeminiResearchPrompt, finalizeIntakeBand, inspectBandIntake, type IntakeResult } from '../lib/bandIntake'
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
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (raw) localStorage.setItem(storageKey, raw)
    else localStorage.removeItem(storageKey)
  }, [raw])

  const inspect = async (nextRaw = raw) => {
    setBusy(true)
    setMessage('JSON을 정리하고 분위기 표현·YouTube 곡명·이미지 라이선스를 자동 확인하는 중…')
    const next = await inspectBandIntake(nextRaw, bands)
    setResult(next)
    setSelectedKeys(new Set(next.candidates.filter((candidate) => candidate.canApprove).map((candidate) => candidate.key)))
    const valid = next.candidates.filter((candidate) => candidate.canApprove).length
    const readyToPublish = next.candidates.filter((candidate) => candidate.band.reviewStatus === 'published').length
    setMessage(next.globalIssues.length
      ? 'JSON을 읽는 중 문제가 발견됐습니다.'
      : `${next.candidates.length}개를 읽었습니다. ${valid}개는 초안 추가가 가능하고, 그중 ${readyToPublish}개는 자동 검수까지 완료됐습니다.`)
    setBusy(false)
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildGeminiResearchPrompt())
      setMessage('Gem 지침 v3를 복사했습니다. 기존 Gem의 지침을 이 내용으로 교체하세요. 이후 채팅에는 밴드 이름만 입력하면 됩니다.')
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
    onAddBands(approved.map((candidate) => {
      const finalized = finalizeIntakeBand(candidate.band)
      return { ...finalized, relations: finalized.relations.filter((relation) => existingIds.has(relation.targetBandId) || approvedIds.has(relation.targetBandId)) }
    }))
    const remaining = result.candidates.filter((candidate) => !approved.some((item) => item.key === candidate.key))
    setResult({ ...result, candidates: remaining })
    setSelectedKeys(new Set())
    setMessage(`${approved.length}개를 추가했습니다 (자동 검수 완료 ${reviewedCount}개 · 나머지는 비공개 초안). 상단의 ‘전체 저장’이 성공할 때까지 원본 JSON은 이 입력칸과 브라우저에 보존됩니다.`)
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
      <div className="studio-section-heading"><span><Inbox size={22} /></span><div><h3>새 밴드 검수함</h3><p>Gemini 조사 결과를 자동 정리하고, 비슷한 분위기 표현을 정식 ID로 바꾸며 YouTube 영상의 곡명·아티스트와 이미지 라이선스까지 확인합니다.</p></div></div>

      <ol className="intake-steps">
        <li><strong>1</strong><span><b>Gem 지침 최초 1회 등록</b>복사한 내용을 Gemini의 Gem 지침에 저장합니다.</span></li>
        <li><strong>2</strong><span><b>결과 붙여넣기</b>코드 블록이나 설명이 섞여 있어도 자동으로 JSON을 찾습니다.</span></li>
        <li><strong>3</strong><span><b>자동 검사 후 추가</b>깨진·엉뚱한 영상은 안전한 검색 링크로 바꾸고, 자동 확인이 남은 항목은 비공개 초안으로 추가합니다.</span></li>
      </ol>

      <div className="intake-actions">
        <button type="button" className="is-primary" onClick={() => void copyPrompt()}><Clipboard size={16} /> Gemini Gem 지침 v3 복사</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} /> JSON 파일 선택</button>
        <input ref={fileRef} hidden type="file" accept="application/json,.json,text/plain" onChange={(event) => event.target.files?.[0] && void loadFile(event.target.files[0])} />
        <button type="button" onClick={clear}><Trash2 size={15} /> 비우기</button>
      </div>

      <label className="intake-textarea">Gemini 답변 붙여넣기
        <textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={10} placeholder={'Gemini 답변 전체를 여기에 붙여넣으세요.\n```json ... ``` 형태도 그대로 넣으면 됩니다.'} />
      </label>
      <div className="intake-inspect-row"><button type="button" className="is-primary" disabled={!raw.trim() || busy} onClick={() => void inspect()}>{busy ? <Loader2 size={16} className="is-spinning" /> : <FileJson size={16} />} 자동 정리·검사</button><span>{message}</span></div>

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
              <label className="intake-candidate-head"><input type="checkbox" disabled={!candidate.canApprove} checked={selectedKeys.has(candidate.key)} onChange={() => setSelectedKeys((current) => { const next = new Set(current); if (next.has(candidate.key)) next.delete(candidate.key); else next.add(candidate.key); return next })} /><span><strong>{candidate.band.name || '이름 없음'}</strong><small>{candidate.band.id} · {candidate.band.formed} · {candidate.band.countryCode || '국가 미입력'}</small></span><em>{candidate.canApprove ? (candidate.band.reviewStatus === 'published' ? <><ShieldCheck size={15} /> 자동 검수 완료</> : <><CheckCircle2 size={15} /> 초안 추가 가능</>) : `수정 필요 ${errors.length}`}</em></label>
              <div className="intake-candidate-summary"><span>대표 장르 <b>{candidate.band.taxonomyV2?.primaryGenreId}</b></span><span>세부 장르 <b>{candidate.band.taxonomyV2?.subgenreIds.length ?? 0}</b></span><span>분위기 <b>{Object.keys(candidate.band.taxonomyV2?.moodScores ?? {}).length}</b></span><span>출처 <b>{candidate.band.sources.length}</b></span></div>
              {candidate.issues.length > 0 && <ul>{candidate.issues.map((issue, index) => <li key={`${issue.code}-${index}`} data-severity={issue.severity}>{issue.message}</li>)}</ul>}
              {!errors.length && warnings.length > 0 && <p>경고는 초안 추가를 막지 않습니다. 추가 후 왼쪽 밴드 목록에서 내용을 보완할 수 있습니다.</p>}
            </article>
          })}
        </div>
      </div>}

      <div className="intake-safety-note"><ShieldCheck size={18} /><p><strong>기존 밴드는 덮어쓰지 않습니다.</strong> 중복 ID·이름·외부 식별자는 차단합니다. YouTube 링크는 영상 존재뿐 아니라 곡명·아티스트 일치까지 확인하고, 실패하면 깨진 링크를 남기지 않고 검색 링크로 바꿉니다. Commons 권리나 다른 자동 확인이 남으면 비공개 초안으로 추가합니다.</p></div>
    </section>
  )
}
