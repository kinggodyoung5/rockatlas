import { RotateCcw, Search, X } from 'lucide-react'
import { eras } from '../data/eras'
import { taxonomyGenreById, taxonomyGenres, taxonomySubgenreById } from '../data/taxonomy'
import type { Band, EraId } from '../types/music'
import type { GenreTaxonomyId } from '../types/taxonomy'
import type { CatalogSort } from '../lib/explorerRoute'
import { countryName } from '../lib/countryNames'
import { BandCard } from './BandCard'

interface AllBandsPageProps {
  bands: Band[]
  query: string
  genreId: GenreTaxonomyId | 'all'
  subgenreId: string | 'all'
  eraId: EraId | 'all'
  countryCode: string | 'all'
  sort: CatalogSort
  favoriteIds: string[]
  onFilter: (patch: Partial<{ query: string; genreId: GenreTaxonomyId | 'all'; subgenreId: string | 'all'; eraId: EraId | 'all'; countryCode: string | 'all'; sort: CatalogSort }>, replace?: boolean) => void
  onSelectBand: (band: Band) => void
  onToggleFavorite: (bandId: string) => void
}

export function AllBandsPage({ bands, query, genreId, subgenreId, eraId, countryCode, sort, favoriteIds, onFilter, onSelectBand, onToggleFavorite }: AllBandsPageProps) {
  const countries = [...new Set(bands.map((band) => band.countryCode).filter(Boolean))].sort((a, b) => countryName(a).localeCompare(countryName(b), 'ko'))
  const availableSubgenres = [...new Set(bands.flatMap((band) => band.taxonomyV2?.subgenreIds ?? []))].sort((a, b) => (taxonomySubgenreById[a]?.name ?? a).localeCompare(taxonomySubgenreById[b]?.name ?? b, 'ko'))
  const normalized = query.trim().toLocaleLowerCase()
  const visible = bands.filter((band) => {
    const taxonomy = band.taxonomyV2
    const searchable = `${band.name} ${band.origin} ${band.tags.join(' ')} ${band.subgenres.join(' ')} ${band.members.map((member) => member.name).join(' ')}`.toLocaleLowerCase()
    return (!normalized || searchable.includes(normalized))
      && (genreId === 'all' || taxonomy?.primaryGenreId === genreId)
      && (subgenreId === 'all' || taxonomy?.subgenreIds.includes(subgenreId))
      && (eraId === 'all' || band.eraTags.some((tag) => tag.era === eraId))
      && (countryCode === 'all' || band.countryCode === countryCode)
  }).sort((a, b) => sort === 'formed-asc' ? a.formed - b.formed : sort === 'formed-desc' ? b.formed - a.formed : a.name.localeCompare(b.name, 'en'))
  const reset = () => onFilter({ query: '', genreId: 'all', subgenreId: 'all', eraId: 'all', countryCode: 'all', sort: 'name' })
  return (
    <main id="top" className="catalog-page all-bands-page" tabIndex={-1}>
      <section className="catalog-hero shell"><span className="section-no">THE COMPLETE INDEX</span><h1>모든 밴드 보기</h1><p>{bands.length}개의 출발점을 이름, 시대, 국가와 장르로 좁혀보세요.</p></section>
      <section className="catalog-controls shell">
        <label className="search-field catalog-search"><Search size={18} /><span className="sr-only">밴드 검색</span><input value={query} onChange={(event) => onFilter({ query: event.target.value }, true)} placeholder="밴드, 국가, 스타일 검색" />{query && <button onClick={() => onFilter({ query: '' }, true)} aria-label="검색어 지우기"><X size={16} /></button>}</label>
        <div className="catalog-select-grid">
          <label>대표 장르<select value={genreId} onChange={(event) => onFilter({ genreId: event.target.value as GenreTaxonomyId | 'all', subgenreId: 'all' })}><option value="all">모든 장르</option>{taxonomyGenres.map((genre) => <option key={genre.id} value={genre.id}>{genre.displayName}</option>)}</select></label>
          <label>세부 장르<select value={subgenreId} onChange={(event) => onFilter({ subgenreId: event.target.value })}><option value="all">모든 세부 장르</option>{availableSubgenres.map((id) => <option key={id} value={id}>{taxonomySubgenreById[id]?.name ?? id}</option>)}</select></label>
          <label>결성 시대<select value={eraId} onChange={(event) => onFilter({ eraId: event.target.value as EraId | 'all' })}><option value="all">모든 시대</option>{eras.map((era) => <option key={era.id} value={era.id}>{era.label}</option>)}</select></label>
          <label>국가<select value={countryCode} onChange={(event) => onFilter({ countryCode: event.target.value })}><option value="all">모든 국가</option>{countries.map((code) => <option key={code} value={code}>{countryName(code)}</option>)}</select></label>
          <label>정렬<select value={sort} onChange={(event) => onFilter({ sort: event.target.value as CatalogSort })}><option value="name">이름순</option><option value="formed-asc">결성 연도 오래된 순</option><option value="formed-desc">결성 연도 최신 순</option></select></label>
        </div>
        <div className="catalog-control-summary"><span>{visible.length} / {bands.length} BANDS</span><button className="filter-reset" onClick={reset}><RotateCcw size={14} /> 전체 초기화</button></div>
      </section>
      <section className="catalog-results shell">{visible.length ? <div className="band-grid">{visible.map((band, index) => <BandCard key={band.id} band={band} index={index} onSelect={onSelectBand} isFavorite={favoriteIds.includes(band.id)} onToggleFavorite={onToggleFavorite} />)}</div> : <div className="empty-state"><p>이 조건에 맞는 밴드를 찾지 못했습니다.</p><button onClick={reset}>필터 초기화</button></div>}</section>
    </main>
  )
}
