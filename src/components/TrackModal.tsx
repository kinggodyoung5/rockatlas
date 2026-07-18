import { useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { Band, Track } from '../types/music'

interface TrackModalProps {
  selection: { band: Band; track: Track } | null
  onClose: () => void
}

export function TrackModal({ selection, onClose }: TrackModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!selection) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    window.setTimeout(() => closeRef.current?.focus(), 50)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selection, onClose])

  if (!selection) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="track-modal" role="dialog" aria-modal="true" aria-labelledby="track-modal-title">
        <div className="modal-head">
          <div>
            <span>NOW PLAYING</span>
            <h2 id="track-modal-title">{selection.track.title}</h2>
            <p>{selection.band.name} · {selection.track.album ?? selection.track.year}</p>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="영상 닫기"><X /></button>
        </div>
        {selection.track.source.embedStatus === 'allowed' ? (
          <div className="video-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${selection.track.youtubeId}?autoplay=1&rel=0`}
              title={`${selection.band.name} — ${selection.track.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="video-unavailable">
            <strong>이 공식 영상은 외부 사이트 재생이 제한되어 있습니다.</strong>
            <p>깨진 플레이어 대신 YouTube의 공식 영상 페이지로 연결합니다.</p>
          </div>
        )}
        <a className="youtube-link" href={selection.track.source.url || `https://www.youtube.com/watch?v=${selection.track.youtubeId}`} target="_blank" rel="noreferrer">
          YouTube에서 직접 보기 <ExternalLink size={15} />
        </a>
      </section>
    </div>
  )
}
