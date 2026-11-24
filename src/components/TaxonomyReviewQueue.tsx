import { useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { HITCHHIKING_DIRECTIONS } from '../config/hitchhiking'
import { taxonomyGenres, taxonomyMoodById, taxonomyMoods } from '../data/taxonomy'
import { directionEntrySignal } from '../lib/hitchhiking'
import { buildTaxonomyReviewRows, reviewFlagLabels, sortReviewQueue, type TaxonomyReviewRow } from '../lib/taxonomyReview'
import type { Band } from '../types/music'
import type { GenreTaxonomyId, MoodId, MoodScore } from '../types/taxonomy'

interface TaxonomyReviewQueueProps {
  bands: Band[]
  onSelectBand: (band: Band) => void
  /** Applies a mood/review change; the operator saves the catalog as usual. */
  onUpdateBand: (band: Band) => void
}

const quickMoodIdsByGenre = Object.fromEntries(taxonomyGenres.map((genre) => [genre.id, genre.quickMoodIds])) as Partial<Record<GenreTaxonomyId, readonly string[]>>
const openDirectionCount = (band: Band) => HITCHHIKING_DIRECTIONS.filter((direction) => directionEntrySignal(band, direction) > 0).length

/** 분류 검수 대기열 (plan P3-1). 같은 장르 밴드를 한 표에 두고 무드 점수를 나란히 비교·수정한다 —
 *  점수 기준이 밴드마다 흔들리지 않게 하려는 화면이다. 기준표는 docs/TAXONOMY_V2_WORKFLOW.md. */
export function TaxonomyReviewQueue({ bands, onSelectBand, onUpdateBand }: TaxonomyReviewQueueProps) {
  const [open, setOpen] = useState(false)
  const [genreId, setGenreId] = useState<GenreTaxonomyId | 'flagged'>('flagged')
  const [showReviewed, setShowReviewed] = useState(false)

  const rows = useMemo(() => sortReviewQueue(buildTaxonomyReviewRows(bands, { quickMoodIdsByGenre, directionCount: openDirectionCount })), [bands])
  const byId = useMemo(() => new Map(bands.map((band) => [band.id, band])), [bands])
  const pendingCount = rows.filter((row) => row.reviewStatus !== 'reviewed').length

  const visible = rows.filter((row) => (showReviewed || row.reviewStatus !== 'reviewed')
    && (genreId === 'flagged' ? row.flags.length > 0 : row.primaryGenreId === genreId))
  // 표의 열: 보이는 밴드 중 누군가 점수를 준 무드만, 정해진 순서대로.
  const moodColumns = taxonomyMoods.filter((mood) => visible.some((row) => (byId.get(row.id)?.taxonomyV2?.moodScores[mood.id] ?? 0) > 0))

  const setScore = (band: Band, moodId: MoodId, value: number) => {
    if (!band.taxonomyV2) return
    const moodScores = { ...band.taxonomyV2.moodScores }
    if (value > 0) moodScores[moodId] = value as MoodScore
    else delete moodScores[moodId]
    onUpdateBand({ ...band, taxonomyV2: { ...band.taxonomyV2, moodScores } })
  }
  const markReviewed = (band: Band, reviewed: boolean) => {
    if (!band.taxonomyV2) return
    onUpdateBand({ ...band, taxonomyV2: { ...band.taxonomyV2, reviewStatus: reviewed ? 'reviewed' : 'draft' } })
  }
  const summary = (row: TaxonomyReviewRow) => row.deviations.slice(0, 2)
    .map((item) => `${taxonomyMoodById[item.moodId]?.name ?? item.moodId} ${item.score} · 동료 ${item.peerMean.toFixed(1)}`).join(' / ')

  return (
    <section className="studio-form-section taxonomy-queue">
      <div className="studio-section-heading"><span><ListChecks size={15} /></span><div>
        <h3>분류 검수 대기열 · 미검수 {pendingCount}팀</h3>
        <p>같은 장르 밴드를 나란히 놓고 무드 점수를 맞춥니다. 표시는 "먼저 볼 곳"일 뿐 틀렸다는 뜻이 아닙니다. 고친 뒤 변경 저장을 누르세요.</p>
      </div></div>
      <button className="studio-add-row" onClick={() => setOpen(!open)}>{open ? '대기열 접기' : '대기열 펼치기'}</button>
      {open && <>
        <div className="taxonomy-queue-controls">
          <label>보기<select value={genreId} onChange={(event) => setGenreId(event.target.value as GenreTaxonomyId | 'flagged')}>
            <option value="flagged">표시 있는 밴드 전체</option>
            {taxonomyGenres.map((genre) => <option key={genre.id} value={genre.id}>{genre.displayName}</option>)}
          </select></label>
          <label className="taxonomy-queue-toggle"><input type="checkbox" checked={showReviewed} onChange={(event) => setShowReviewed(event.target.checked)} />검수 완료도 보기</label>
          <small>{visible.length}팀</small>
        </div>
        <div className="taxonomy-queue-table-wrap">
          <table className="taxonomy-queue-table">
            <thead><tr>
              <th>밴드</th>
              {moodColumns.map((mood) => <th key={mood.id} title={mood.description}><span>{mood.name}</span></th>)}
              <th>검수</th>
            </tr></thead>
            <tbody>
              {visible.map((row) => {
                const band = byId.get(row.id)
                if (!band?.taxonomyV2) return null
                return <tr key={row.id} data-reviewed={row.reviewStatus === 'reviewed'}>
                  <th scope="row">
                    <button className="taxonomy-queue-name" onClick={() => onSelectBand(band)}>{band.name}</button>
                    <small>방향 {row.directionCount}개{row.peerSimilarity !== null ? ` · 동료 유사도 ${row.peerSimilarity}` : ''}</small>
                    {row.flags.length > 0 && <ul className="taxonomy-queue-flags">{row.flags.map((flag) => <li key={flag}>{reviewFlagLabels[flag]}</li>)}</ul>}
                    {summary(row) && <small>{summary(row)}</small>}
                  </th>
                  {moodColumns.map((mood) => {
                    const value = band.taxonomyV2!.moodScores[mood.id] ?? 0
                    return <td key={mood.id} data-score={value}>
                      <select value={value} aria-label={`${band.name} ${mood.name}`} onChange={(event) => setScore(band, mood.id, Number(event.target.value))}>
                        {[0, 1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score || '·'}</option>)}
                      </select>
                    </td>
                  })}
                  <td>{row.reviewStatus === 'reviewed'
                    ? <button className="is-muted" onClick={() => markReviewed(band, false)}>되돌리기</button>
                    : <button onClick={() => markReviewed(band, true)}>검수 완료</button>}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </>}
    </section>
  )
}
