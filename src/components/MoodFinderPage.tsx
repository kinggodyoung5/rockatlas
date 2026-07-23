import { RotateCcw } from 'lucide-react'
import { eras } from '../data/eras'
import { taxonomyGenres, taxonomyMoods } from '../data/taxonomy'
import type { Band, EraId } from '../types/music'
import type { GenreTaxonomyId, MoodGroupId, MoodId } from '../types/taxonomy'
import { countryName } from '../lib/countryNames'
import { BandCard } from './BandCard'

const groupLabels: Record<MoodGroupId, string> = { energy: '에너지와 속도', emotion: '감정과 정서', texture: '공간감과 음색', listening: '구성과 감상 방식' }

interface MoodFinderPageProps {
  bands: Band[]
  selectedMoodIds: MoodId[]
  genreId: GenreTaxonomyId | 'all'
  eraId: EraId | 'all'
  countryCode: string | 'all'
  favoriteIds: string[]
  sectionLabel: string
  sectionTitle: string
  sectionDescription: string
  onFilter: (patch: Partial<{ selectedMoodIds: MoodId[]; genreId: GenreTaxonomyId | 'all'; eraId: EraId | 'all'; countryCode: string | 'all' }>) => void
  onSelectBand: (band: Band) => void
  onToggleFavorite: (bandId: string) => void
}

export function MoodFinderPage({ bands, selectedMoodIds, genreId, eraId, countryCode, favoriteIds, sectionLabel, sectionTitle, sectionDescription, onFilter, onSelectBand, onToggleFavorite }: MoodFinderPageProps) {
  const countries = [...new Set(bands.map((band) => band.countryCode).filter(Boolean))].sort((a, b) => countryName(a).localeCompare(countryName(b), 'ko'))
  const toggleMood = (id: MoodId) => {
    if (selectedMoodIds.includes(id)) onFilter({ selectedMoodIds: selectedMoodIds.filter((item) => item !== id) })
    else if (selectedMoodIds.length < 3) onFilter({ selectedMoodIds: [...selectedMoodIds, id] })
  }
  const results = bands.map((band) => {
    const scores = selectedMoodIds.map((id) => band.taxonomyV2?.moodScores[id] ?? 0)
    const average = scores.length ? scores.reduce<number>((sum, score) => sum + score, 0) / scores.length : 0
    const minimum = scores.length ? Math.min(...scores) : 0
    const match = average * .7 + minimum * .3
    return { band, scores, match, percent: Math.round((match / 5) * 20) * 5 }
  }).filter(({ band, scores, match }) => selectedMoodIds.length > 0
    && (selectedMoodIds.length === 1 ? scores[0] >= 2 : scores.reduce<number>((sum, score) => sum + score, 0) / scores.length >= 2)
    && (genreId === 'all' || band.taxonomyV2?.primaryGenreId === genreId)
    && (eraId === 'all' || band.eraTags.some((tag) => tag.era === eraId))
    && (countryCode === 'all' || band.countryCode === countryCode)
    && match > 0).sort((a, b) => b.match - a.match || a.band.name.localeCompare(b.band.name, 'en'))
  return (
    <main id="top" className="catalog-page mood-page" tabIndex={-1}>
      <section className="catalog-hero shell"><span className="section-no">{sectionLabel}</span><h1>{sectionTitle}</h1><p>{sectionDescription}</p><strong>{selectedMoodIds.length}/3 선택</strong></section>
      <section className="mood-browser shell">
        {(Object.keys(groupLabels) as MoodGroupId[]).map((groupId) => <div className="mood-group" key={groupId}><h2>{groupLabels[groupId]}</h2><div className="mood-card-grid">{taxonomyMoods.filter((mood) => mood.groupId === groupId).map((mood) => {
          const selected = selectedMoodIds.includes(mood.id)
          const count = bands.filter((band) => (band.taxonomyV2?.moodScores[mood.id] ?? 0) >= 2).length
          return <button key={mood.id} className={selected ? 'is-selected' : ''} aria-pressed={selected} disabled={!selected && selectedMoodIds.length >= 3} onClick={() => toggleMood(mood.id)}><span>{String(mood.order).padStart(2, '0')}</span><strong>{mood.name}</strong><p>{mood.description}</p><em>{count} BANDS</em></button>
        })}</div></div>)}
      </section>
      <section className="catalog-controls shell mood-result-controls">
        <div className="catalog-select-grid"><label>대표 장르<select value={genreId} onChange={(event) => onFilter({ genreId: event.target.value as GenreTaxonomyId | 'all' })}><option value="all">모든 장르</option>{taxonomyGenres.map((genre) => <option key={genre.id} value={genre.id}>{genre.displayName}</option>)}</select></label><label>시대<select value={eraId} onChange={(event) => onFilter({ eraId: event.target.value as EraId | 'all' })}><option value="all">모든 시대</option>{eras.map((era) => <option key={era.id} value={era.id}>{era.label}</option>)}</select></label><label>국가<select value={countryCode} onChange={(event) => onFilter({ countryCode: event.target.value })}><option value="all">모든 국가</option>{countries.map((code) => <option key={code} value={code}>{countryName(code)}</option>)}</select></label></div>
        <button className="filter-reset" onClick={() => onFilter({ selectedMoodIds: [], genreId: 'all', eraId: 'all', countryCode: 'all' })}><RotateCcw size={14} /> 선택 초기화</button>
      </section>
      <section className="catalog-results shell"><div className="result-heading"><h2>{selectedMoodIds.length ? `${results.length}개의 추천` : '분위기를 선택하세요'}</h2><p>{selectedMoodIds.length ? '일치도는 편집 점수의 조합이며 5% 단위로 표시합니다.' : '분위기를 선택하면 결과가 여기에 나타납니다.'}</p></div>{results.length > 0 && <div className="band-grid mood-result-grid">{results.map(({ band, percent }, index) => <div key={band.id} className="mood-result"><div className="mood-match"><strong>{percent}% 일치</strong><span>{selectedMoodIds.filter((id) => (band.taxonomyV2?.moodScores[id] ?? 0) >= 2).map((id) => taxonomyMoods.find((mood) => mood.id === id)?.name).join(' · ')}</span></div><BandCard band={band} index={index} onSelect={onSelectBand} isFavorite={favoriteIds.includes(band.id)} onToggleFavorite={onToggleFavorite} /></div>)}</div>}{selectedMoodIds.length > 0 && results.length === 0 && <div className="empty-state"><p>선택한 분위기를 함께 만족하는 밴드가 없습니다. 조건을 줄여보세요.</p></div>}</section>
    </main>
  )
}
