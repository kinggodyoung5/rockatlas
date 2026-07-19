import { ArrowLeft, RotateCcw } from 'lucide-react'
import { taxonomyGenreById, taxonomyMoodById, taxonomySubgenreById } from '../data/taxonomy'
import type { Band } from '../types/music'
import type { GenreTaxonomyId, MoodId } from '../types/taxonomy'
import { BandCard } from './BandCard'

interface GenreExplorerPageProps {
  bands: Band[]
  genreId: GenreTaxonomyId
  subgenreId: string | 'all'
  moodId: MoodId | 'all'
  favoriteIds: string[]
  onBack: () => void
  onSelectBand: (band: Band) => void
  onToggleFavorite: (bandId: string) => void
  onFilter: (patch: { subgenreId?: string | 'all'; moodId?: MoodId | 'all' }) => void
}

export function GenreExplorerPage({ bands, genreId, subgenreId, moodId, favoriteIds, onBack, onSelectBand, onToggleFavorite, onFilter }: GenreExplorerPageProps) {
  const genre = taxonomyGenreById[genreId]
  const genreBands = bands.filter((band) => band.taxonomyV2?.primaryGenreId === genreId)
  const subgenres = genre.subgenreIds.map((id) => ({ id, count: genreBands.filter((band) => band.taxonomyV2?.subgenreIds.includes(id)).length })).filter((item) => item.count > 0)
  const visible = genreBands.filter((band) => {
    const inSubgenre = subgenreId === 'all' || band.taxonomyV2?.subgenreIds.includes(subgenreId)
    const inMood = moodId === 'all' || (band.taxonomyV2?.moodScores[moodId] ?? 0) >= 2
    return inSubgenre && inMood
  })
  return (
    <main id="top" className="catalog-page" tabIndex={-1} style={{ '--active-genre': genre.color } as React.CSSProperties}>
      <section className="catalog-hero shell">
        <button className="catalog-back" onClick={onBack}><ArrowLeft size={16} /> 이전 페이지</button>
        <span className="section-no">GENRE {String(genre.order).padStart(2, '0')}</span>
        <h1>{genre.name}</h1><p>{genre.description}</p><strong>{genre.vibeDescription}</strong>
      </section>
      <section className="catalog-controls shell" aria-label="장르 필터">
        <div className="filter-block"><span>세부 장르</span><div className="filter-chips"><button className={subgenreId === 'all' ? 'active' : ''} onClick={() => onFilter({ subgenreId: 'all' })}>전체 <em>{genreBands.length}</em></button>{subgenres.map((item) => <button key={item.id} className={`${subgenreId === item.id ? 'active' : ''} ${item.count >= 3 ? 'is-prominent' : ''}`} onClick={() => onFilter({ subgenreId: item.id })}>{taxonomySubgenreById[item.id]?.name ?? item.id} <em>{item.count}</em></button>)}</div></div>
        <div className="filter-block"><span>빠른 분위기</span><div className="filter-chips"><button className={moodId === 'all' ? 'active' : ''} onClick={() => onFilter({ moodId: 'all' })}>전체</button>{genre.quickMoodIds.map((id) => <button key={id} className={moodId === id ? 'active' : ''} onClick={() => onFilter({ moodId: id })}>{taxonomyMoodById[id].name}</button>)}</div></div>
        {(subgenreId !== 'all' || moodId !== 'all') && <button className="filter-reset" onClick={() => onFilter({ subgenreId: 'all', moodId: 'all' })}><RotateCcw size={14} /> 필터 초기화</button>}
      </section>
      <section className="catalog-results shell"><div className="result-heading"><h2>{visible.length}개의 밴드</h2><p>한 밴드는 대표 장르 한 곳에만 나타납니다.</p></div>{visible.length ? <div className="band-grid">{visible.map((band, index) => <BandCard key={band.id} band={band} index={index} onSelect={onSelectBand} isFavorite={favoriteIds.includes(band.id)} onToggleFavorite={onToggleFavorite} />)}</div> : <div className="empty-state"><p>현재 이 조건에 등록된 밴드가 없습니다.</p><button onClick={() => onFilter({ subgenreId: 'all', moodId: 'all' })}>필터 초기화</button></div>}</section>
    </main>
  )
}
