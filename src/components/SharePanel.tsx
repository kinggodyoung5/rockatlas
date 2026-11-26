import { Check, Copy, Share2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDialog } from '../hooks/useDialog'

interface SharePanelProps {
  open: boolean
  title: string
  description: string
  url?: string
  onClose: () => void
}

export function SharePanel({ open, title, description, url: suppliedUrl, onClose }: SharePanelProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const url = suppliedUrl ?? (typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`)

  // Esc·포커스 가두기·스크롤 잠금·닫을 때 여는 버튼으로 포커스 복귀는 공용 훅이 맡는다 (plan P5-5).
  useDialog(open, panelRef, onClose, { initialFocus: closeRef })
  useEffect(() => {
    if (open) return
    setCopied(false)
    setError('')
  }, [open])

  if (!open) return null

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setError('')
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setError('자동 복사가 차단되었습니다. 위 주소를 직접 선택해 복사하세요.') }
  }
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, text: description, url })
      else await copyLink()
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name !== 'AbortError') setError('기기 공유를 열지 못했습니다. 링크 복사를 이용하세요.')
    }
  }

  return (
    <div className="share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={panelRef} className="share-panel" role="dialog" aria-modal="true" aria-labelledby="share-title" aria-describedby="share-description">
        <button ref={closeRef} className="share-close" onClick={onClose} aria-label="공유 화면 닫기"><X size={19} /></button>
        <span className="section-no">SHARE THE MAP</span>
        <h2 id="share-title">ROCK ATLAS 공유하기</h2>
        <p id="share-description">{description}</p>
        <label>공유 주소<input value={url} readOnly onFocus={(event) => event.currentTarget.select()} /></label>
        <div className="share-actions">
          <button className="primary-button" onClick={() => void share()}><Share2 size={16} /> 기기로 공유</button>
          <button onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '복사됨' : '링크 복사'}</button>
        </div>
        <span className="share-status" role="status" aria-live="polite">{error || (copied ? '공유 주소를 클립보드에 복사했습니다.' : '')}</span>
      </section>
    </div>
  )
}
