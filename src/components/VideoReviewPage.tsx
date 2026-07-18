import { useEffect, useMemo, useState } from 'react'
import { bands } from '../data/bands'

interface PlayerEvent {
  data: number
  target: YouTubePlayer
}

interface PlayerErrorEvent extends PlayerEvent {
  data: number
}

interface YouTubePlayer {
  cueVideoById: (videoId: string) => void
  destroy: () => void
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer
  PlayerState: { CUED: number }
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

type ResultStatus = 'allowed' | 'blocked' | 'timeout'

interface VideoResult {
  band: string
  track: string
  youtubeId: string
  status: ResultStatus
  errorCode?: number
}

const allJobs = bands.flatMap((band) => band.tracks.map((track) => ({
  band: band.name,
  track: track.title,
  youtubeId: track.youtubeId,
})))

const requestedIds = new Set(new URLSearchParams(window.location.search).get('ids')?.split(',').filter(Boolean) ?? [])
const jobsById = new Map(allJobs.map((job) => [job.youtubeId, job]))
const jobs = requestedIds.size > 0
  ? [...requestedIds].map((youtubeId) => jobsById.get(youtubeId) ?? { band: 'Candidate', track: youtubeId, youtubeId })
  : allJobs

export function VideoReviewPage() {
  const [results, setResults] = useState<VideoResult[]>([])
  const [phase, setPhase] = useState<'loading' | 'running' | 'complete'>('loading')

  useEffect(() => {
    let player: YouTubePlayer | undefined
    let index = 0
    let timer = 0
    let disposed = false

    const inspectNext = () => {
      if (disposed || !player) return
      if (index >= jobs.length) {
        setPhase('complete')
        return
      }
      player.cueVideoById(jobs[index].youtubeId)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => settle('timeout'), 10_000)
    }

    const settle = (status: ResultStatus, errorCode?: number) => {
      if (disposed || index >= jobs.length) return
      window.clearTimeout(timer)
      const job = jobs[index]
      setResults((current) => [...current, { ...job, status, errorCode }])
      index += 1
      window.setTimeout(inspectNext, 120)
    }

    const createPlayer = () => {
      if (disposed || !window.YT) return
      const mount = document.getElementById('youtube-review-player')
      if (!mount) return
      setPhase('running')
      player = new window.YT.Player(mount, {
        width: '640',
        height: '360',
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 0, controls: 0, enablejsapi: 1, origin: window.location.origin, rel: 0 },
        events: {
          onReady: inspectNext,
          onStateChange: (event: PlayerEvent) => {
            if (event.data === window.YT?.PlayerState.CUED) settle('allowed')
          },
          onError: (event: PlayerErrorEvent) => settle('blocked', event.data),
        },
      })
    }

    if (window.YT?.Player) {
      createPlayer()
    } else {
      window.onYouTubeIframeAPIReady = createPlayer
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
    }

    return () => {
      disposed = true
      window.clearTimeout(timer)
      player?.destroy()
      window.onYouTubeIframeAPIReady = undefined
    }
  }, [])

  const totals = useMemo(() => ({
    allowed: results.filter((result) => result.status === 'allowed').length,
    blocked: results.filter((result) => result.status === 'blocked').length,
    timeout: results.filter((result) => result.status === 'timeout').length,
  }), [results])

  return (
    <main className="video-review-page" data-review-status={phase}>
      <div>
        <span className="section-no">INTERNAL / VIDEO REVIEW</span>
        <h1>YouTube 임베드 검수</h1>
        <p>공식 채널로 확인된 {jobs.length}개 영상을 IFrame Player API로 차례로 cue하여 임베드 허용 상태를 검사합니다.</p>
        <strong data-review-progress>{results.length}/{jobs.length}</strong>
        <p data-review-summary>허용 {totals.allowed} · 차단 {totals.blocked} · 시간 초과 {totals.timeout}</p>
      </div>
      <div id="youtube-review-player" className="video-review-player" />
      <ol>
        {results.map((result) => (
          <li key={result.youtubeId} data-result={result.status} data-youtube-id={result.youtubeId}>
            <strong>{result.band}</strong> — {result.track}
            <span>{result.status}{result.errorCode ? ` (${result.errorCode})` : ''}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
