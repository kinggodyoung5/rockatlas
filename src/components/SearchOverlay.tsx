import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { searchEntries, searchKindLabels, type SearchEntry } from '../lib/searchIndex'

let indexPromise: Promise<SearchEntry[]> | undefined
const loadIndex = () => (indexPromise ??= fetch('./data/search-index.json').then((response) => {
  if (!response.ok) throw new Error('검색 색인을 불러오지 못했습니다.')
  return response.json() as Promise<SearchEntry[]>
}).catch((error) => { indexPromise = undefined; throw error }))

interface SearchOverlayProps {
  open: boolean
  onClose: () => void
  onPick: (entry: SearchEntry) => void
}

/** 통합 검색 (plan P5-3). 헤더 버튼, `/`, Ctrl+K로 연다. 색인은 처음 열 때 한 번만 불러온다. */
export function SearchOverlay({ open, onClose, onPick }: SearchOverlayProps) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setQuery('')
    setCursor(0)
    requestAnimationFrame(() => inputRef.current?.focus())
    if (!index) loadIndex().then(setIndex).catch((reason) => setError(reason instanceof Error ? reason.message : '검색 색인을 불러오지 못했습니다.'))
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow; returnFocusRef.current?.focus?.() }
  }, [open])

  const groups = useMemo(() => index ? searchEntries(index, query) : [], [index, query])
  const flat = groups.flatMap((group) => group.items)
  useEffect(() => { setCursor(0) }, [query])

  if (!open) return null
  const pick = (entry: SearchEntry) => { onPick(entry); onClose() }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((value) => Math.min(value + 1, flat.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((value) => Math.max(value - 1, 0)) }
    else if (event.key === 'Enter' && flat[cursor]) { event.preventDefault(); pick(flat[cursor]) }
    else if (event.key === 'Tab') event.preventDefault()
  }
  let position = -1

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="ROCK ATLAS 검색" onKeyDown={onKeyDown}>
      <button className="search-overlay-backdrop" aria-label="검색 닫기" tabIndex={-1} onClick={onClose} />
      <div className="search-overlay-panel">
        <label className="search-overlay-input">
          <Search size={20} />
          <span className="sr-only">밴드, 멤버, 곡, 음반, 장르, 분위기 검색</span>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="밴드·멤버·곡·음반·장르·분위기" role="combobox" aria-expanded={flat.length > 0} aria-controls="search-results" aria-activedescendant={flat[cursor] ? `search-item-${cursor}` : undefined} autoComplete="off" />
          <button onClick={onClose} aria-label="검색 닫기"><X size={18} /></button>
        </label>
        <div id="search-results" className="search-overlay-results" role="listbox" aria-label="검색 결과">
          {error && <p className="search-overlay-note">{error}</p>}
          {!error && !index && <p className="search-overlay-note">검색 색인을 불러오는 중입니다…</p>}
          {index && !query.trim() && <p className="search-overlay-note">예: 너바나, Smells Like, 슈게이즈, Dave Grohl · 위아래 화살표로 고르고 Enter</p>}
          {index && query.trim() && !flat.length && <p className="search-overlay-note">이 좌표에서는 아무것도 찾지 못했습니다.</p>}
          {groups.map((group) => <section key={group.kind}>
            <h3>{searchKindLabels[group.kind]}</h3>
            <ul>{group.items.map((entry) => {
              position += 1
              const itemPosition = position
              return <li key={`${entry.t}-${entry.label}-${entry.bandId ?? entry.subgenreId ?? entry.moodId}-${entry.trackId ?? ''}`} id={`search-item-${itemPosition}`} role="option" aria-selected={itemPosition === cursor} className={itemPosition === cursor ? 'is-active' : ''} onMouseEnter={() => setCursor(itemPosition)} onClick={() => pick(entry)}>
                <strong>{entry.label}</strong>{entry.sub && <small>{entry.sub}</small>}
              </li>
            })}</ul>
          </section>)}
        </div>
      </div>
    </div>
  )
}
