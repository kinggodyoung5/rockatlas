import type { Band, BandEraTag, Genre, GenreId } from '../types/music'
import { slugify } from '../lib/bandIntake'

interface StudioBandBasicsProps {
  draft: Band
  selectedId: string
  isExisting: boolean
  passedChecks: number
  totalChecks: number
  genres: Genre[]
  onChange: (patch: Partial<Band>) => void
  onReviewStatus: (status: Band['reviewStatus']) => void
  onEraText: (value: string) => BandEraTag[]
  onPrimaryGenre: (genreId: GenreId) => void
  onToggleSecondaryGenre: (genreId: GenreId) => void
}

const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const erasToText = (eraTags: BandEraTag[]) => eraTags.map((tag) => [tag.era, tag.subgenres.join(', '), tag.note ?? ''].join(' | ')).join('\n')

export function StudioBandBasics({ draft, selectedId, isExisting, passedChecks, totalChecks, genres, onChange, onReviewStatus, onEraText, onPrimaryGenre, onToggleSecondaryGenre }: StudioBandBasicsProps) {
  return <>
    <section id="studio-band-editor-title" className="studio-editor-title">
      <div>
        <span>{isExisting ? 'EDIT BAND' : 'NEW BAND'}</span>
        <h2>{draft.name}</h2>
        <p>완성도 {passedChecks}/{totalChecks} · ID {draft.id}</p>
      </div>
      <label>사이트 표시 상태<select value={draft.reviewStatus} onChange={(event) => onReviewStatus(event.target.value as Band['reviewStatus'])}><option value="draft">초안 · 사이트 숨김</option><option value="published">공개 · 사이트 표시</option></select></label>
    </section>

    <section className="studio-form-section">
      <div className="studio-section-heading"><span>01</span><div><h3>기본 정보와 소개</h3><p>목록 카드와 상세 첫 화면에 바로 반영됩니다.</p></div></div>
      <div className="studio-form-grid">
        <label>밴드 이름<input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        <label>고유 ID<input value={draft.id} readOnly={isExisting} onChange={(event) => onChange({ id: slugify(event.target.value) })} /><small>{isExisting ? '기존 관계 보호를 위해 ID는 잠겨 있습니다.' : '영문 소문자와 하이픈으로 저장됩니다.'}</small></label>
        <label>결성 연도<input type="number" value={draft.formed} onChange={(event) => onChange({ formed: Number(event.target.value) })} /></label>
        <label>활동 기간<input value={draft.activeYears} onChange={(event) => onChange({ activeYears: event.target.value })} placeholder="1960–1970" /></label>
        <label>결성지<input value={draft.origin} onChange={(event) => onChange({ origin: event.target.value })} placeholder="리버풀, 잉글랜드" /></label>
        <label>국가 코드<input value={draft.countryCode} maxLength={2} onChange={(event) => onChange({ countryCode: event.target.value.toUpperCase() })} placeholder="GB" /></label>
      </div>
      <label className="studio-wide-field">업적과 발자취 중심 소개<textarea value={draft.summary} onChange={(event) => onChange({ summary: event.target.value })} rows={4} placeholder="언제 등장해 무엇을 바꾸었고 어떤 계보를 남겼는지 구체적으로 적습니다." /><small>{draft.summary.length}자 · 30자 이상 권장</small></label>
      <label className="studio-wide-field">어떤 음악을 하나요?<textarea value={draft.style} onChange={(event) => onChange({ style: event.target.value })} rows={5} placeholder="리듬, 기타, 보컬, 프로덕션과 곡 전개를 청자가 상상할 수 있게 적습니다." /><small>{draft.style.length}자 · 40자 이상 권장</small></label>
    </section>

    <section className="studio-form-section">
      <div className="studio-section-heading"><span>02</span><div><h3>활동 시대와 핵심 태그</h3><p>시대별 변화는 상세 화면과 시대 필터에 계속 사용됩니다. 장르 분류는 바로 아래의 새 탐색 분류에서 관리하세요.</p></div></div>
      <label className="studio-wide-field">핵심 태그<input value={draft.tags.join(', ')} onChange={(event) => onChange({ tags: splitList(event.target.value) })} placeholder="기타 질감, 변박, 스튜디오 실험" /></label>
      <label className="studio-wide-field">시대별 분류 <small>한 줄에 시대 | 세부 장르 | 설명</small><textarea key={`${selectedId}-eras`} defaultValue={erasToText(draft.eraTags)} onBlur={(event) => onChange({ eraTags: onEraText(event.target.value) })} rows={4} placeholder="1990s | 얼터너티브 록, 아트 록 | 기타 중심에서 전자음향으로 확장" /></label>
      <details className="legacy-taxonomy-fields"><summary>구형 8장르 호환 데이터 · 새 분류에서 자동 동기화됩니다</summary><div className="studio-form-grid">
        <label>구형 주 장르<select value={draft.primaryGenre} onChange={(event) => onPrimaryGenre(event.target.value as GenreId)}>{genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select></label>
        <label>구형 표시용 세부 장르<input value={draft.subgenres.join(', ')} onChange={(event) => onChange({ subgenres: splitList(event.target.value) })} /></label>
        <fieldset className="studio-checkboxes studio-grid-span"><legend>구형 장르 교차점</legend>{genres.map((genre) => <label key={genre.id}><input type="checkbox" checked={draft.genreIds.includes(genre.id)} disabled={genre.id === draft.primaryGenre} onChange={() => onToggleSecondaryGenre(genre.id)} />{genre.name}</label>)}</fieldset>
      </div></details>
    </section>
  </>
}
