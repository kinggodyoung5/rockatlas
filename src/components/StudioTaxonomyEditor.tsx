import { taxonomySubgenreById } from '../data/taxonomy'
import type { BandTaxonomyV2 } from '../types/music'
import type { GenreTaxonomyId, MoodGroupId, MoodId, MoodScore, TaxonomyGenre, TaxonomyMood } from '../types/taxonomy'

const moodGroupLabels: Record<MoodGroupId, string> = {
  energy: '에너지와 속도',
  emotion: '감정과 정서',
  texture: '공간감과 음색',
  listening: '구성과 감상 방식',
}

interface StudioTaxonomyEditorProps {
  value: BandTaxonomyV2
  genres: TaxonomyGenre[]
  moods: TaxonomyMood[]
  availableSubgenreIds: string[]
  onPrimary: (id: GenreTaxonomyId) => void
  onReviewStatus: (status: BandTaxonomyV2['reviewStatus']) => void
  onToggleSecondary: (id: GenreTaxonomyId) => void
  onToggleSubgenre: (id: string) => void
  onMoodScore: (id: MoodId, score: MoodScore) => void
  onReviewNote: (note: string) => void
}

export function StudioTaxonomyEditor({ value, genres, moods, availableSubgenreIds, onPrimary, onReviewStatus, onToggleSecondary, onToggleSubgenre, onMoodScore, onReviewNote }: StudioTaxonomyEditorProps) {
  return <section className="studio-form-section taxonomy-editor">
    <div className="studio-section-heading"><span>02B</span><div><h3>새 장르·분위기 탐색 분류</h3><p>13개 장르 화면과 느낌으로 찾기에 사용될 v2 분류입니다. 기존 분류는 전환이 끝날 때까지 함께 보존됩니다.</p></div></div>
    <div className="studio-form-grid">
      <label>대표 장르<select value={value.primaryGenreId} onChange={(event) => onPrimary(event.target.value as GenreTaxonomyId)}>{genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select></label>
      <label>분류 검수 상태<select value={value.reviewStatus} onChange={(event) => onReviewStatus(event.target.value as BandTaxonomyV2['reviewStatus'])}><option value="draft">초안 · 검토 필요</option><option value="reviewed">운영자 검수 완료</option></select></label>
    </div>
    <fieldset className="studio-checkboxes taxonomy-genre-options"><legend>보조 상위 장르 · 기본 목록에는 중복 노출되지 않음</legend>{genres.map((genre) => <label key={genre.id}><input type="checkbox" checked={value.secondaryGenreIds.includes(genre.id)} disabled={genre.id === value.primaryGenreId} onChange={() => onToggleSecondary(genre.id)} />{genre.displayName}</label>)}</fieldset>

    <div className="taxonomy-subgenre-panel">
      <div><strong>관련 세부 장르</strong><small>대표·보조 장르에 속한 항목과 현재 선택된 교차 항목만 표시합니다.</small></div>
      <div className="taxonomy-subgenre-grid">
        {availableSubgenreIds.map((id) => {
          const subgenre = taxonomySubgenreById[id]
          if (!subgenre) return null
          const selected = value.subgenreIds.includes(id)
          return <button type="button" key={id} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => onToggleSubgenre(id)}>{subgenre.name}<small>{subgenre.englishName}</small></button>
        })}
      </div>
    </div>

    <div className="mood-score-editor">
      <div className="mood-score-intro"><strong>분위기 점수</strong><small>0은 미지정, 3은 분명한 특징, 5는 핵심 정체성입니다. 의미 있는 분위기만 남기세요.</small></div>
      {(Object.keys(moodGroupLabels) as MoodGroupId[]).map((groupId) => (
        <fieldset key={groupId}><legend>{moodGroupLabels[groupId]}</legend><div className="mood-score-grid">
          {moods.filter((mood) => mood.groupId === groupId).map((mood) => {
            const score = value.moodScores[mood.id] ?? 0
            return <label key={mood.id} className={score > 0 ? 'is-scored' : ''}><span><strong>{mood.name}</strong><em>{score}/5</em></span><small>{mood.description}</small><input type="range" min="0" max="5" step="1" value={score} onChange={(event) => onMoodScore(mood.id, Number(event.target.value) as MoodScore)} aria-label={`${mood.name} 점수`} /></label>
          })}
        </div></fieldset>
      ))}
    </div>
    <label className="studio-wide-field">분류 검토 메모<textarea value={value.reviewNote ?? ''} onChange={(event) => onReviewNote(event.target.value)} rows={3} placeholder="대표 장르 선택 근거나 나중에 확인할 사항을 적습니다." /></label>
  </section>
}
