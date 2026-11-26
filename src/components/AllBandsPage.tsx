import { ChevronDown, Heart, LayoutGrid, List, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { eras } from '../data/eras'
import { taxonomyGenreById, taxonomyGenres, taxonomySubgenreById } from '../data/taxonomy'
import type { Band, EraId } from '../types/music'
import type { GenreTaxonomyId } from '../types/taxonomy'
import type { CatalogSort } from '../lib/explorerRoute'
import { countryName } from '../lib/countryNames'
import { activeFilterCount, letterIndex, matchesCatalogFilter, sortCatalog } from '../lib/catalogFilters'
import { BandCard } from './BandCard'

type FilterPatch = Partial<{ query: string; genreId: GenreTaxonomyId | 'all'; subgenreId: string | 'all'; eraId: EraId | 'all'; countryCode: string | 'all'; sort: CatalogSort }>

interface AllBandsPageProps {
  bands: Band[]
  query: string
  genreId: GenreTaxonomyId | 'all'
  subgenreId: string | 'all'
  eraId: EraId | 'all'
  countryCode: string | 'all'
  sort: CatalogSort
  favoriteIds: string[]
  sectionLabel: string
  sectionTitle: string
  sectionDescription: string
  /** Bumped by a parent nav action (e.g. a dedicated "search" menu entry) to move focus into
   *  the search field even when this page is already mounted. Ignored on plain page visits. */
  searchFocusToken?: number
  onFilter: (patch: FilterPatch, replace?: boolean) => void
  onSelectBand: (band: Band) => void
  onToggleFavorite: (bandId: string) => void
}

type ViewMode = 'grid' | 'list'
const viewKey = 'rock-atlas:catalog-view'
const pageSize = 48
const readView = (): ViewMode => { try { return window.localStorage.getItem(viewKey) === 'list' ? 'list' : 'grid' } catch { return 'grid' } }

/** 모든 밴드 보기 (plan P5-1): 칩 필터, 모바일 필터 시트, 카드/목록 전환, A–Z 색인, 48팀씩 이어 그리기. */
export function AllBandsPage({ bands, query, genreId, subgenreId, eraId, countryCode, sort, favoriteIds, sectionLabel, sectionTitle, sectionDescription, searchFocusToken, onFilter, onSelectBand, onToggleFavorite }: AllBandsPageProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sheetButtonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ViewMode>(readView)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [renderCount, setRenderCount] = useState(pageSize)
  const [pendingJump, setPendingJump] = useState<number | null>(null)

  useEffect(() => { if (searchFocusToken) searchInputRef.current?.focus() }, [searchFocusToken])
  useEffect(() => { try { window.localStorage.setItem(viewKey, view) } catch { /* 저장 못 해도 화면은 그대로 */ } }, [view])

  const countries = useMemo(() => [...new Set(bands.map((band) => band.countryCode).filter(Boolean))].sort((a, b) => countryName(a).localeCompare(countryName(b), 'ko')), [bands])
  const genreSubgenres = useMemo(() => {
    if (genreId === 'all') return []
    const counts = new Map<string, number>()
    for (const band of bands) if (band.taxonomyV2?.primaryGenreId === genreId) for (const id of band.taxonomyV2.subgenreIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || (taxonomySubgenreById[a[0]]?.name ?? a[0]).localeCompare(taxonomySubgenreById[b[0]]?.name ?? b[0], 'ko'))
  }, [bands, genreId])
  const visible = useMemo(() => sortCatalog(bands.filter((band) => matchesCatalogFilter(band, { query, genreId, subgenreId, eraId, countryCode })), sort), [bands, query, genreId, subgenreId, eraId, countryCode, sort])
  const letters = useMemo(() => sort === 'name' ? letterIndex(visible) : new Map<string, number>(), [sort, visible])
  const filterCount = activeFilterCount({ genreId, subgenreId, eraId, countryCode })

  // 필터가 바뀌면 처음 48팀부터 다시 그린다.
  useEffect(() => { setRenderCount(pageSize) }, [query, genreId, subgenreId, eraId, countryCode, sort])
  // 목록 끝이 보이면 48팀씩 더.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setRenderCount((count) => count + pageSize) }, { rootMargin: '600px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visible.length, renderCount >= visible.length])
  // A–Z: 아직 안 그린 위치면 거기까지 그린 뒤 이동한다.
  useEffect(() => {
    if (pendingJump === null) return
    const target = resultsRef.current?.querySelector(':scope > .band-grid, :scope > .band-list')?.children[pendingJump] as HTMLElement | undefined
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); setPendingJump(null) }
  }, [pendingJump, renderCount])
  const jumpTo = (position: number) => { setRenderCount((count) => Math.max(count, position + pageSize)); setPendingJump(position) }

  // 모바일 필터 시트: Esc로 닫고, 닫으면 여는 버튼으로 포커스를 돌려준다.
  useEffect(() => {
    if (!sheetOpen) return
    sheetRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); sheetButtonRef.current?.focus() }
  }, [sheetOpen])

  const reset = () => onFilter({ query: '', genreId: 'all', subgenreId: 'all', eraId: 'all', countryCode: 'all', sort: 'name' })
  const applied: Array<{ key: string; label: string; clear: FilterPatch }> = []
  if (genreId !== 'all') applied.push({ key: 'genre', label: taxonomyGenreById[genreId]?.displayName ?? genreId, clear: { genreId: 'all', subgenreId: 'all' } })
  if (subgenreId !== 'all') applied.push({ key: 'subgenre', label: taxonomySubgenreById[subgenreId]?.name ?? subgenreId, clear: { subgenreId: 'all' } })
  if (eraId !== 'all') applied.push({ key: 'era', label: `${eras.find((era) => era.id === eraId)?.label ?? eraId} 결성`, clear: { eraId: 'all' } })
  if (countryCode !== 'all') applied.push({ key: 'country', label: countryName(countryCode), clear: { countryCode: 'all' } })
  const shown = visible.slice(0, renderCount)

  const filterChips = (
    <>
      <div className="chip-row" role="group" aria-label="대표 장르">
        <button className={genreId === 'all' ? 'active' : ''} aria-pressed={genreId === 'all'} onClick={() => onFilter({ genreId: 'all', subgenreId: 'all' })}>모든 장르</button>
        {taxonomyGenres.map((genre) => <button key={genre.id} className={genreId === genre.id ? 'active' : ''} aria-pressed={genreId === genre.id} style={{ '--chip-color': genre.color } as React.CSSProperties} onClick={() => onFilter({ genreId: genre.id, subgenreId: 'all' })}><i aria-hidden="true" />{genre.displayName}</button>)}
      </div>
      {genreSubgenres.length > 0 && <div className="chip-row chip-row-sub" role="group" aria-label="세부 장르">
        <button className={subgenreId === 'all' ? 'active' : ''} aria-pressed={subgenreId === 'all'} onClick={() => onFilter({ subgenreId: 'all' })}>전체</button>
        {genreSubgenres.map(([id, count]) => <button key={id} title={taxonomySubgenreById[id]?.description} className={subgenreId === id ? 'active' : ''} aria-pressed={subgenreId === id} onClick={() => onFilter({ subgenreId: id })}>{taxonomySubgenreById[id]?.name ?? id} <em>{count}</em></button>)}
      </div>}
      <div className="chip-row chip-row-era" role="group" aria-label="결성 시대">
        {eras.map((era) => <button key={era.id} className={eraId === era.id ? 'active' : ''} aria-pressed={eraId === era.id} onClick={() => onFilter({ eraId: eraId === era.id ? 'all' : era.id })}>{era.label.replace('년대', 's').replace(/^19|^20/, "'")}</button>)}
        <details className="country-popover">
          <summary>{countryCode === 'all' ? '국가' : countryName(countryCode)} <ChevronDown size={14} /></summary>
          <div>
            <button className={countryCode === 'all' ? 'active' : ''} onClick={(event) => { onFilter({ countryCode: 'all' }); event.currentTarget.closest('details')?.removeAttribute('open') }}>모든 국가</button>
            {countries.map((code) => <button key={code} className={countryCode === code ? 'active' : ''} onClick={(event) => { onFilter({ countryCode: code }); event.currentTarget.closest('details')?.removeAttribute('open') }}>{countryName(code)}</button>)}
          </div>
        </details>
      </div>
    </>
  )

  return (
    <main id="top" className="catalog-page all-bands-page" tabIndex={-1}>
      <section className="catalog-hero shell"><span className="section-no">{sectionLabel}</span><h1>{sectionTitle}</h1><p>{bands.length}개의 출발점을 {sectionDescription}</p></section>
      <section className="catalog-controls catalog-controls-v2 shell">
        <div className="catalog-toolbar">
          <label className="search-field catalog-search"><Search size={18} /><span className="sr-only">밴드 검색</span><input ref={searchInputRef} value={query} onChange={(event) => onFilter({ query: event.target.value }, true)} placeholder="밴드, 멤버, 국가, 스타일 검색" />{query && <button onClick={() => onFilter({ query: '' }, true)} aria-label="검색어 지우기"><X size={16} /></button>}</label>
          <button ref={sheetButtonRef} className="filter-sheet-button" aria-expanded={sheetOpen} aria-controls="catalog-filter-panel" onClick={() => setSheetOpen(true)}><SlidersHorizontal size={16} /> 필터{filterCount ? ` (${filterCount})` : ''}</button>
          <label className="catalog-sort"><span className="sr-only">정렬</span><select value={sort} onChange={(event) => onFilter({ sort: event.target.value as CatalogSort })}><option value="name">이름순</option><option value="formed-asc">결성 오래된 순</option><option value="formed-desc">결성 최신 순</option></select></label>
          <div className="view-toggle" role="group" aria-label="보기 방식">
            <button className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} aria-label="카드로 보기" onClick={() => setView('grid')}><LayoutGrid size={16} /></button>
            <button className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} aria-label="목록으로 보기" onClick={() => setView('list')}><List size={16} /></button>
          </div>
        </div>
        <div id="catalog-filter-panel" className={`catalog-filter-panel ${sheetOpen ? 'is-open' : ''}`}>
          {sheetOpen && <button className="filter-sheet-backdrop" aria-label="필터 닫기" onClick={() => setSheetOpen(false)} />}
          <div className="catalog-filter-sheet" ref={sheetRef} tabIndex={-1} role={sheetOpen ? 'dialog' : undefined} aria-modal={sheetOpen || undefined} aria-label="필터">
            <div className="filter-sheet-head"><strong>필터</strong><button onClick={() => setSheetOpen(false)}>{visible.length}팀 보기</button></div>
            {filterChips}
          </div>
        </div>
        <div className="catalog-control-summary" aria-live="polite">
          <span>{visible.length} / {bands.length} BANDS</span>
          {applied.map((item) => <button key={item.key} className="applied-chip" onClick={() => onFilter(item.clear)} aria-label={`${item.label} 필터 지우기`}>{item.label} <X size={12} /></button>)}
          {(applied.length > 0 || query) && <button className="filter-reset" onClick={reset}><RotateCcw size={14} /> 전체 초기화</button>}
        </div>
        {letters.size > 1 && <nav className="letter-index" aria-label="알파벳 색인">{[...letters].map(([letter, position]) => <button key={letter} onClick={() => jumpTo(position)}>{letter}</button>)}</nav>}
      </section>
      <section className="catalog-results shell" ref={resultsRef}>
        {visible.length === 0 && <div className="empty-state"><p>이 좌표에는 아직 등록된 밴드가 없습니다. 조건을 줄여 보세요.</p><button onClick={reset}>필터 초기화</button></div>}
        {visible.length > 0 && view === 'grid' && <div className="band-grid">{shown.map((band, index) => <BandCard key={band.id} band={band} index={index} onSelect={onSelectBand} isFavorite={favoriteIds.includes(band.id)} onToggleFavorite={onToggleFavorite} />)}</div>}
        {visible.length > 0 && view === 'list' && <ol className="band-list">{shown.map((band) => {
          const genre = band.taxonomyV2 ? taxonomyGenreById[band.taxonomyV2.primaryGenreId] : undefined
          const favorite = favoriteIds.includes(band.id)
          return <li key={band.id} style={{ '--chip-color': genre?.color } as React.CSSProperties}>
            <button className="band-list-main" onClick={() => onSelectBand(band)}><strong>{band.name}</strong><span>{genre?.displayName ?? band.primaryGenre}</span><span>{band.formed}</span><span>{countryName(band.countryCode)}</span></button>
            <button className={`band-list-favorite ${favorite ? 'is-active' : ''}`} aria-pressed={favorite} aria-label={`${band.name} ${favorite ? '저장 취소' : '저장'}`} onClick={() => onToggleFavorite(band.id)}><Heart size={15} fill={favorite ? 'currentColor' : 'none'} /></button>
          </li>
        })}</ol>}
        {renderCount < visible.length && <div ref={sentinelRef} className="load-more-sentinel"><button onClick={() => setRenderCount((count) => count + pageSize)}>{visible.length - renderCount}팀 더 보기</button></div>}
      </section>
    </main>
  )
}
