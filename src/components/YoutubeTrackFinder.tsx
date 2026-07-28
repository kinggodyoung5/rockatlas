import { Check, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
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
}

export function YoutubeTrackFinder({ bandName, tracks, onSelect }: YoutubeTrackFinderProps) {
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
      const response = await fetch(`/api/studio/youtube-search?q=${encodeURIComponent(effectiveQuery)}`)
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json() as { results: YoutubeCandidate[] }
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
