import { ArrowDown, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { eras } from '../data/eras'
import { taxonomyGenres, taxonomyMoodById, taxonomyMoodPresets, taxonomyMoods } from '../data/taxonomy'
import type { Band, EraId } from '../types/music'
import type { GenreTaxonomyId, MoodGroupId, MoodId, MoodPreset } from '../types/taxonomy'
import { countryName } from '../lib/countryNames'
import { findMoodMatches, maxSelectedMoods } from '../lib/moodFinder'
import { BandCard } from './BandCard'

const groupLabels: Record<MoodGroupId, string> = { energy: '에너지와 속도', emotion: '감정과 정서', texture: '공간감과 음색', listening: '구성과 감상 방식' }
// Cosmic-themed palette: sun orange, nebula purple, nebula cyan (texture holds "우주적이고 환각적인"), starlight gold.
const groupColors: Record<MoodGroupId, string> = { energy: '#e86335', emotion: '#9b7fd4', texture: '#4fb8c9', listening: '#d9a25c' }

type MoodFilterPatch = Partial<{ selectedMoodIds: MoodId[]; excludeMoodId: MoodId | 'all'; genreId: GenreTaxonomyId | 'all'; eraId: EraId | 'all'; countryCode: string | 'all' }>

interface MoodFinderPageProps {
  bands: Band[]
  selectedMoodIds: MoodId[]
  excludeMoodId: MoodId | 'all'
  genreId: GenreTaxonomyId | 'all'
  eraId: EraId | 'all'
  countryCode: string | 'all'
  favoriteIds: string[]
  sectionLabel: string
  sectionTitle: string
  sectionDescription: string
  presets?: MoodPreset[]
  onFilter: (patch: MoodFilterPatch) => void
  /** 두 번째 인자: 지금 보이는 목록 순서(상세의 이전·다음 이동용). */
  onSelectBand: (band: Band, listIds?: string[]) => void
  onToggleFavorite: (bandId: string) => void
}

const sameMoods = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((id) => right.includes(id))

export function MoodFinderPage({ bands, selectedMoodIds, excludeMoodId, genreId, eraId, countryCode, favoriteIds, sectionLabel, sectionTitle, sectionDescription, presets = taxonomyMoodPresets, onFilter, onSelectBand, onToggleFavorite }: MoodFinderPageProps) {
  const resultsRef = useRef<HTMLElement>(null)
  const [resultsVisible, setResultsVisible] = useState(false)
  const countries = [...new Set(bands.map((band) => band.countryCode).filter(Boolean))].sort((a, b) => countryName(a).localeCompare(countryName(b), 'ko'))
  const toggleMood = (id: MoodId) => {
    if (selectedMoodIds.includes(id)) onFilter({ selectedMoodIds: selectedMoodIds.filter((item) => item !== id) })
    else if (selectedMoodIds.length < maxSelectedMoods) onFilter({ selectedMoodIds: [...selectedMoodIds, id], ...(excludeMoodId === id ? { excludeMoodId: 'all' as const } : {}) })
  }
  const applyPreset = (preset: MoodPreset) => onFilter({ selectedMoodIds: preset.moodIds.slice(0, maxSelectedMoods), excludeMoodId: preset.excludeMoodIds?.[0] ?? 'all' })
  const results = findMoodMatches(bands, { selectedMoodIds, excludeMoodId, genreId, eraId, countryCode })

  // 무드 카드 24개 아래에 결과가 있으므로, 결과가 화면 밖일 때만 "결과 보기" 버튼을 띄운다(plan P3-4).
  useEffect(() => {
    const target = resultsRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { rootMargin: '0px 0px -30% 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const listIds = results.map((item) => item.band).map((band) => band.id)
  return (
    <main id="top" className="catalog-page mood-page" tabIndex={-1}>
      <section className="catalog-hero shell"><span className="section-no">{sectionLabel}</span><h1>{sectionTitle}</h1><p>{sectionDescription}</p><strong>{selectedMoodIds.length}/{maxSelectedMoods} 선택</strong></section>
      {presets.length > 0 && <section className="mood-presets shell" aria-label="추천 조합">
        <h2>이럴 때 듣기</h2>
        <div>{presets.map((preset) => {
          const active = sameMoods(preset.moodIds, selectedMoodIds) && excludeMoodId === (preset.excludeMoodIds?.[0] ?? 'all')
          return <button key={preset.id} className={active ? 'is-selected' : ''} aria-pressed={active} onClick={() => applyPreset(preset)}>
            <strong>{preset.name}</strong>
            <small>{preset.moodIds.map((id) => taxonomyMoodById[id]?.name ?? id).join(' + ')}{preset.excludeMoodIds?.length ? ` · ${taxonomyMoodById[preset.excludeMoodIds[0]]?.name} 제외` : ''}</small>
          </button>
        })}</div>
      </section>}
      <section className="mood-browser shell">
        {(Object.keys(groupLabels) as MoodGroupId[]).map((groupId) => <div className="mood-group" key={groupId} style={{ '--mood-group-color': groupColors[groupId] } as React.CSSProperties}><h2>{groupLabels[groupId]}</h2><div className="mood-card-grid">{taxonomyMoods.filter((mood) => mood.groupId === groupId).map((mood) => {
          const selected = selectedMoodIds.includes(mood.id)
          const count = bands.filter((band) => (band.taxonomyV2?.moodScores[mood.id] ?? 0) >= 2).length
          return <button key={mood.id} className={selected ? 'is-selected' : ''} aria-pressed={selected} disabled={!selected && selectedMoodIds.length >= maxSelectedMoods} onClick={() => toggleMood(mood.id)}><span>{String(mood.order).padStart(2, '0')}</span><strong>{mood.name}</strong><p>{mood.description}</p><em>{count} BANDS</em></button>
        })}</div></div>)}
      </section>
      <section className="catalog-controls shell mood-result-controls">
        <div className="catalog-select-grid">
          <label>이건 빼고<select value={excludeMoodId} onChange={(event) => onFilter({ excludeMoodId: event.target.value as MoodId | 'all' })}><option value="all">빼지 않음</option>{taxonomyMoods.filter((mood) => !selectedMoodIds.includes(mood.id)).map((mood) => <option key={mood.id} value={mood.id}>{mood.name}</option>)}</select></label>
          <label>대표 장르<select value={genreId} onChange={(event) => onFilter({ genreId: event.target.value as GenreTaxonomyId | 'all' })}><option value="all">모든 장르</option>{taxonomyGenres.map((genre) => <option key={genre.id} value={genre.id}>{genre.displayName}</option>)}</select></label>
          <label>활동 시대<select value={eraId} onChange={(event) => onFilter({ eraId: event.target.value as EraId | 'all' })}><option value="all">모든 시대</option>{eras.map((era) => <option key={era.id} value={era.id}>{era.label}</option>)}</select></label>
          <label>국가<select value={countryCode} onChange={(event) => onFilter({ countryCode: event.target.value })}><option value="all">모든 국가</option>{countries.map((code) => <option key={code} value={code}>{countryName(code)}</option>)}</select></label>
        </div>
        <button className="filter-reset" onClick={() => onFilter({ selectedMoodIds: [], excludeMoodId: 'all', genreId: 'all', eraId: 'all', countryCode: 'all' })}><RotateCcw size={14} /> 선택 초기화</button>
      </section>
      <section ref={resultsRef} className="catalog-results shell" id="mood-results">
        <div className="result-heading"><h2>{selectedMoodIds.length ? `${results.length}개의 추천` : '분위기를 선택하세요'}</h2><p>{selectedMoodIds.length ? '일치도는 편집 점수의 조합이며 5% 단위로 표시합니다. 막대는 고른 분위기별 점수(5점 만점)입니다.' : '분위기를 선택하면 결과가 여기에 나타납니다.'}</p></div>
        {results.length > 0 && <div className="band-grid mood-result-grid">{results.map(({ band, percent, scores }, index) => <div key={band.id} className="mood-result">
          <div className="mood-match">
            <strong>{percent}% 일치</strong>
            <ul className="mood-match-bars">{selectedMoodIds.map((id, moodIndex) => <li key={id}>
              <span>{taxonomyMoodById[id]?.name ?? id}</span>
              <i aria-hidden="true"><b style={{ width: `${(scores[moodIndex] / 5) * 100}%` }} /></i>
              <em>{scores[moodIndex]}</em>
            </li>)}</ul>
          </div>
          <BandCard band={band} index={index} onSelect={(band) => onSelectBand(band, listIds)} isFavorite={favoriteIds.includes(band.id)} onToggleFavorite={onToggleFavorite} />
        </div>)}</div>}
        {selectedMoodIds.length > 0 && results.length === 0 && <div className="empty-state"><p>이 분위기 조합의 좌표에는 아직 밴드가 없습니다. 조건을 하나 줄여 보세요.</p></div>}
      </section>
      {selectedMoodIds.length > 0 && !resultsVisible && <button className="mood-results-jump" onClick={scrollToResults}>결과 {results.length}팀 보기 <ArrowDown size={15} /></button>}
    </main>
  )
}
