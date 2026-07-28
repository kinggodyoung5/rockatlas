import { Check, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { useState } from 'react'

export interface YoutubeChannelCandidate {
  channelId: string
  title: string
  description: string
  thumbnailUrl: string
  subscriberCount: string
  url: string
}

interface YoutubeChannelFinderProps {
  initialQuery: string
  onSelect: (candidate: YoutubeChannelCandidate) => void
}

export function YoutubeChannelFinder({ initialQuery, onSelect }: YoutubeChannelFinderProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<YoutubeChannelCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('밴드 이름으로 검색하면 구독자 수와 함께 채널 후보를 보여줍니다.')

  const search = async () => {
    const q = query.trim()
    if (q.length < 2) { setMessage('검색어를 두 글자 이상 입력하세요.'); return }
    setLoading(true)
    setMessage('YouTube 채널을 검색하는 중…')
    try {
      const response = await fetch(`/api/studio/youtube-search?type=channel&q=${encodeURIComponent(q)}`)
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json() as { results: YoutubeChannelCandidate[] }
      setResults(data.results)
      setMessage(data.results.length ? `${data.results.length}개 채널을 찾았습니다. 구독자 수와 설명을 보고 공식 채널을 선택하세요.` : '검색 결과가 없습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'YouTube 채널 검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="youtube-channel-finder">
      <div className="external-search-bar">
        <label>채널 검색<input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} placeholder="예: King Gizzard official" /></label>
        <button onClick={() => void search()} disabled={loading}>{loading ? <LoaderCircle className="is-spinning" size={15} /> : <Search size={15} />} 채널 검색</button>
      </div>
      <p className="external-search-message">{message}</p>
      <div className="youtube-channel-grid">
        {results.map((item) => (
          <article key={item.channelId}>
            {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" loading="lazy" />}
            <div>
              <strong>{item.title}</strong>
              <small>{item.subscriberCount ? `구독자 ${Number(item.subscriberCount).toLocaleString()}명` : '구독자 수 비공개'}</small>
              {item.description && <small>{item.description}</small>}
            </div>
            <a href={item.url} target="_blank" rel="noreferrer" aria-label="YouTube에서 열기"><ExternalLink size={13} /></a>
            <button onClick={() => onSelect(item)}><Check size={13} /> 이 채널 선택</button>
          </article>
        ))}
      </div>
    </div>
  )
}
