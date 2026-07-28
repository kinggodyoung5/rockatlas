import { Check, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { studioFetchJson } from '../lib/studioApiClient'

export interface CommonsImageCandidate {
  fileName: string
  thumbUrl: string
  originalUrl: string
  sourceUrl: string
  creator: string
  license: string
  licenseUrl: string
}

interface CommonsImageFinderProps {
  initialQuery: string
  onSelect: (candidate: CommonsImageCandidate) => void
}

export function CommonsImageFinder({ initialQuery, onSelect }: CommonsImageFinderProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<CommonsImageCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('밴드 이름으로 검색하면 Commons 사진 후보를 썸네일과 함께 보여줍니다.')

  const search = async () => {
    const q = query.trim()
    if (q.length < 2) { setMessage('검색어를 두 글자 이상 입력하세요.'); return }
    setLoading(true)
    setMessage('Wikimedia Commons에서 검색하는 중…')
    try {
      const data = await studioFetchJson<{ results: CommonsImageCandidate[] }>(`/api/studio/commons-image-search?q=${encodeURIComponent(q)}`)
      setResults(data.results)
      setMessage(data.results.length ? `${data.results.length}개 후보를 찾았습니다. 라이선스를 확인하고 선택하세요.` : '검색 결과가 없습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Commons 검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="commons-image-finder">
      <div className="external-search-bar">
        <label>이미지 검색<input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} /></label>
        <button onClick={() => void search()} disabled={loading}>{loading ? <LoaderCircle className="is-spinning" size={15} /> : <Search size={15} />} 이미지 검색</button>
      </div>
      <p className="external-search-message">{message}</p>
      <div className="youtube-candidate-grid">
        {results.map((item) => (
          <article key={item.fileName}>
            {item.thumbUrl && <img src={item.thumbUrl} alt="" loading="lazy" />}
            <div><strong>{item.fileName.replace(/^File:/, '')}</strong><small>{item.creator || '저작자 미상'} · {item.license || '라이선스 확인 필요'}</small></div>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label="Commons에서 열기"><ExternalLink size={13} /></a>
            <button disabled={!item.license} onClick={() => onSelect(item)}><Check size={13} /> 이 사진 선택</button>
          </article>
        ))}
      </div>
    </div>
  )
}
