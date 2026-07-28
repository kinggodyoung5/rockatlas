import { AlertTriangle, CheckCircle2, ExternalLink, Image, Link2, LoaderCircle, RefreshCw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { siteContent } from '../data/siteContent'
import { studioFetchJson } from '../lib/studioApiClient'
import type { Band } from '../types/music'

type HealthStatus = 'ok' | 'redirected' | 'restricted' | 'broken' | 'error'
interface HealthEntry { id: string; label: string; url: string; kind: 'link' | 'image' | 'font'; bandId?: string }
interface HealthResult extends HealthEntry { status: HealthStatus; httpStatus: number; finalUrl: string; contentType: string; durationMs: number; detail: string }

interface LinkHealthPanelProps {
  bands: Band[]
  onSelectBand: (band: Band) => void
}

const statusLabels: Record<HealthStatus, string> = {
  ok: '정상',
  redirected: '이동됨',
  restricted: '접근 제한',
  broken: '끊김',
  error: '확인 실패',
}

export function LinkHealthPanel({ bands, onSelectBand }: LinkHealthPanelProps) {
  const [results, setResults] = useState<HealthResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'issues' | HealthStatus | 'all'>('issues')
  const [message, setMessage] = useState('공개 링크와 이미지 파일이 실제로 응답하는지 한 번에 확인합니다.')
  const activeCheck = useRef<AbortController | null>(null)

  const entries = useMemo(() => {
    const next: HealthEntry[] = []
    const add = (entry: HealthEntry) => { if (entry.url.trim()) next.push(entry) }
    bands.forEach((band) => {
      band.sources.forEach((source, index) => add({ id: `${band.id}-source-${index}`, label: `${band.name} · ${source.publisher}`, url: source.url, kind: 'link', bandId: band.id }))
      band.tracks.forEach((track) => add({ id: `${band.id}-track-${track.id}`, label: `${band.name} · ${track.title}`, url: track.source.url, kind: 'link', bandId: band.id }))
      if (band.image.displayUrl) add({ id: `${band.id}-display-image`, label: `${band.name} · 표시 이미지`, url: band.image.displayUrl, kind: 'image', bandId: band.id })
      if (band.image.originalUrl) add({ id: `${band.id}-original-image`, label: `${band.name} · 원본 이미지`, url: band.image.originalUrl, kind: 'image', bandId: band.id })
      add({ id: `${band.id}-credit`, label: `${band.name} · 이미지 출처`, url: band.image.credit.sourceUrl, kind: 'link', bandId: band.id })
    })
    if (siteContent.theme.heroImageUrl) add({ id: 'site-hero-image', label: '메인 히어로 이미지', url: siteContent.theme.heroImageUrl, kind: 'image' })
    if (siteContent.theme.customFontUrl) add({ id: 'site-custom-font', label: `업로드 폰트 · ${siteContent.theme.customFontName}`, url: siteContent.theme.customFontUrl, kind: 'font' })
    return next
  }, [bands])

  const runCheck = async () => {
    const controller = new AbortController()
    activeCheck.current?.abort()
    activeCheck.current = controller
    setLoading(true)
    setResults([])
    setMessage(`${entries.length}개 항목 검사를 시작합니다. 외부 사이트 응답에 따라 수 분 걸릴 수 있습니다.`)
    try {
      const batchSize = 120
      const collected: HealthResult[] = []
      let checkedAt = new Date().toISOString()
      for (let offset = 0; offset < entries.length; offset += batchSize) {
        const batch = entries.slice(offset, offset + batchSize)
        setMessage(`${entries.length}개 중 ${offset}개 확인 · 현재 ${offset + 1}–${Math.min(offset + batch.length, entries.length)}번째 검사 중`)
        const payload = await studioFetchJson<{ checkedAt: string; results: HealthResult[] }>('/api/studio/health-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: batch }),
          signal: controller.signal,
        })
        checkedAt = payload.checkedAt
        collected.push(...payload.results)
        setResults([...collected])
      }
      const problems = collected.filter((item) => item.status === 'broken' || item.status === 'error').length
      setMessage(`${new Date(checkedAt).toLocaleString('ko-KR')} 검사 완료 · 수정이 필요한 항목 ${problems}개`)
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'AbortError'
        ? '검사를 중단했습니다. 지금까지 확인한 결과는 아래에 남겨두었습니다.'
        : `검사 실패: ${error instanceof Error ? error.message : '로컬 Studio 서버를 확인하세요.'}`)
    } finally {
      if (activeCheck.current === controller) activeCheck.current = null
      setLoading(false)
    }
  }

  const counts = results.reduce<Record<HealthStatus, number>>((summary, result) => ({ ...summary, [result.status]: summary[result.status] + 1 }), { ok: 0, redirected: 0, restricted: 0, broken: 0, error: 0 })
  const visible = results.filter((result) => filter === 'all' || filter === 'issues' ? filter === 'all' || result.status !== 'ok' : result.status === filter)

  return (
    <section className="studio-health-panel" aria-labelledby="health-title">
      <div className="studio-section-heading"><span>URL</span><div><h3 id="health-title">전체 링크·이미지 상태</h3><p>출처, 대표곡, 밴드 이미지와 업로드 자산의 HTTP 응답과 파일 형식을 검사합니다.</p></div></div>
      <div className="health-actions">
        <button onClick={() => void runCheck()} disabled={loading}>{loading ? <LoaderCircle className="is-spinning" size={15} /> : <RefreshCw size={15} />} {loading ? '검사 중' : `${entries.length}개 전체 검사`}</button>
        {loading && <button type="button" onClick={() => activeCheck.current?.abort()}>검사 중단</button>}
        <span role="status" aria-live="polite">{message}</span>
      </div>
      {results.length > 0 && <>
        <div className="health-summary" aria-label="링크 검사 결과 요약">
          <button data-status="ok" onClick={() => setFilter('ok')}><CheckCircle2 size={14} /> 정상 {counts.ok}</button>
          <button data-status="redirected" onClick={() => setFilter('redirected')}>이동 {counts.redirected}</button>
          <button data-status="restricted" onClick={() => setFilter('restricted')}>제한 {counts.restricted}</button>
          <button data-status="broken" onClick={() => setFilter('broken')}><AlertTriangle size={14} /> 끊김 {counts.broken}</button>
          <button data-status="error" onClick={() => setFilter('error')}>실패 {counts.error}</button>
          <label>표시<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="issues">정상 제외</option><option value="all">전체</option><option value="ok">정상</option><option value="redirected">이동됨</option><option value="restricted">접근 제한</option><option value="broken">끊김</option><option value="error">확인 실패</option></select></label>
        </div>
        <div className="health-results">
          {visible.map((result) => <article key={result.id} data-status={result.status}>
            <span className="health-kind">{result.kind === 'image' ? <Image size={14} /> : <Link2 size={14} />}</span>
            <button className="health-item" onClick={() => { const band = bands.find((item) => item.id === result.bandId); if (band) onSelectBand(band) }} disabled={!result.bandId}><strong>{result.label}</strong><small>{result.detail || `${result.httpStatus || '—'} · ${result.durationMs}ms`}</small></button>
            <strong className="health-status">{statusLabels[result.status]}</strong>
            <a href={result.url} target="_blank" rel="noreferrer" aria-label={`${result.label} 열기`}><ExternalLink size={14} /></a>
          </article>)}
          {!visible.length && <p>이 조건에 해당하는 항목이 없습니다.</p>}
        </div>
      </>}
    </section>
  )
}
