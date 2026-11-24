import { Check, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { studioFetchJson } from '../lib/studioApiClient'
import type { Track } from '../types/music'

export interface YoutubeCandidate {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
  url: string
}

interface YoutubeTrackFinderProps {
  bandName: string
  tracks: Track[]
  onSelect: (trackId: string, candidate: YoutubeCandidate) => void
  /** 밴드의 공식 YouTube 채널 ID(UC…). 있으면 업로드 목록에서 먼저 찾는다. */
  channelId?: string
}

export function YoutubeTrackFinder({ bandName, tracks, onSelect, channelId }: YoutubeTrackFinderProps) {
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YoutubeCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('대표곡을 고르고 검색하면 후보 영상을 썸네일과 함께 보여줍니다.')

  useEffect(() => {
    if (!tracks.some((track) => track.id === trackId)) setTrackId(tracks[0]?.id ?? '')
  }, [tracks, trackId])

  const selectedTrack = tracks.find((track) => track.id === trackId)
  const effectiveQuery = query || `${bandName} ${selectedTrack?.title ?? ''}`.trim()

  const search = async () => {
    if (effectiveQuery.length < 2) return
    setLoading(true)
    setMessage('YouTube에서 검색하는 중…')
    try {
      // 공식 채널 ID가 있으면 먼저 그 채널 업로드 목록에서 곡 제목으로 찾는다(쿼터 1/쪽). 없을 때만 일반 검색(쿼터 100).
      if (channelId && !query) {
        const fromChannel = await studioFetchJson<{ results: YoutubeCandidate[] }>(`/api/studio/youtube-search?channelId=${encodeURIComponent(channelId)}&q=${encodeURIComponent(selectedTrack?.title ?? '')}`).catch(() => ({ results: [] as YoutubeCandidate[] }))
        if (fromChannel.results.length) {
          setResults(fromChannel.results)
          setMessage(`공식 채널 업로드에서 ${fromChannel.results.length}개 후보를 찾았습니다.`)
          return
        }
      }
      const data = await studioFetchJson<{ results: YoutubeCandidate[] }>(`/api/studio/youtube-search?q=${encodeURIComponent(effectiveQuery)}`)
      setResults(data.results)
      setMessage(data.results.length ? `${data.results.length}개 후보를 찾았습니다.` : '검색 결과가 없습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'YouTube 검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="youtube-track-finder">
      <div className="external-search-bar">
        <label>대표곡 선택
          <select value={trackId} onChange={(event) => { setTrackId(event.target.value); setQuery('') }}>
            {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
          </select>
        </label>
        <label>검색어<input value={effectiveQuery} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} /></label>
        <button onClick={() => void search()} disabled={loading || !trackId}>{loading ? <LoaderCircle className="is-spinning" size={15} /> : <Search size={15} />} 영상 검색</button>
      </div>
      <p className="external-search-message">{message}</p>
      <div className="youtube-candidate-grid">
        {results.map((item) => (
          <article key={item.videoId}>
            {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" loading="lazy" />}
            <div><strong>{item.title}</strong><small>{item.channelTitle}</small></div>
            <a href={item.url} target="_blank" rel="noreferrer" aria-label="YouTube에서 열기"><ExternalLink size={13} /></a>
            <button onClick={() => onSelect(trackId, item)}><Check size={13} /> 이 영상 선택</button>
          </article>
        ))}
      </div>
    </div>
  )
}
