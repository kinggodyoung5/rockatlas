import { Check, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { studioFetchJson } from '../lib/studioApiClient'

export interface ExternalCandidate {
  id: string
  name: string
  description: string
  url: string
  aliases?: string[]
  score?: number
  country?: string
  area?: string
  begin?: string
  end?: string
  ended?: boolean
}

interface ExternalSourceFinderProps {
  initialQuery: string
  selectedWikidataId: string
  selectedMusicBrainzId: string
  onSelect: (provider: 'Wikidata' | 'MusicBrainz', candidate: ExternalCandidate) => void
}

type SearchResults = { wikidata: ExternalCandidate[]; musicbrainz: ExternalCandidate[] }

export function ExternalSourceFinder({ initialQuery, selectedWikidataId, selectedMusicBrainzId, onSelect }: ExternalSourceFinderProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResults>({ wikidata: [], musicbrainz: [] })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('아티스트 이름을 검색하면 두 데이터베이스의 후보를 함께 보여줍니다.')

  useEffect(() => setQuery(initialQuery), [initialQuery])

  const search = async () => {
    const normalized = query.trim()
    if (normalized.length < 2) return setMessage('검색어를 두 글자 이상 입력하세요.')
    setLoading(true)
    setMessage('Wikidata와 MusicBrainz에서 후보를 찾고 있습니다…')
    try {
      const request = async (provider: keyof SearchResults) => {
        return (await studioFetchJson<{ results: ExternalCandidate[] }>(`/api/studio/external-search?provider=${provider}&q=${encodeURIComponent(normalized)}`)).results
      }
      const settled = await Promise.allSettled([request('wikidata'), request('musicbrainz')])
      const next = {
        wikidata: settled[0].status === 'fulfilled' ? settled[0].value : [],
        musicbrainz: settled[1].status === 'fulfilled' ? settled[1].value : [],
      }
      setResults(next)
      const failures = settled.filter((item) => item.status === 'rejected')
      const total = next.wikidata.length + next.musicbrainz.length
      setMessage(failures.length ? `${total}개 후보를 찾았습니다. 한 서비스는 응답하지 않아 나중에 다시 검색할 수 있습니다.` : `${total}개 후보를 찾았습니다. 설명과 활동지를 보고 정확한 항목을 선택하세요.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '외부 검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="external-source-finder">
      <div className="external-search-bar">
        <label>아티스트 이름<input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} placeholder="예: The Beatles" /></label>
        <button onClick={() => void search()} disabled={loading}>{loading ? <LoaderCircle className="is-spinning" size={15} /> : <Search size={15} />} 자동 검색</button>
      </div>
      <p className="external-search-message">{message}</p>
      <div className="external-candidate-columns">
        {(['wikidata', 'musicbrainz'] as const).map((provider) => {
          const label = provider === 'wikidata' ? 'Wikidata' : 'MusicBrainz'
          const selectedId = provider === 'wikidata' ? selectedWikidataId : selectedMusicBrainzId
          return <section key={provider}>
            <header><strong>{label}</strong><span>{results[provider].length}개 후보</span></header>
            <div className="external-candidate-list">
              {results[provider].map((candidate) => {
                const selected = selectedId === candidate.id
                const meta = [candidate.area, candidate.country, candidate.begin && `${candidate.begin}${candidate.end ? `–${candidate.end}` : ''}`].filter(Boolean).join(' · ')
                return <article key={candidate.id} className={selected ? 'is-selected' : ''}>
                  <div><strong>{candidate.name}</strong><small>{candidate.description || meta || candidate.id}</small>{candidate.description && meta && <small>{meta}</small>}</div>
                  <a href={candidate.url} target="_blank" rel="noreferrer" aria-label={`${candidate.name} 원문 열기`}><ExternalLink size={13} /></a>
                  <button onClick={() => onSelect(label, candidate)}>{selected ? <><Check size={13} /> 선택됨</> : '이 후보 선택'}</button>
                </article>
              })}
              {!loading && results[provider].length === 0 && <p>검색 후 후보가 여기에 표시됩니다.</p>}
            </div>
          </section>
        })}
      </div>
    </div>
  )
}
