import { ArrowLeft } from 'lucide-react'
import { taxonomyGenres, taxonomyMoods, taxonomySubgenreById } from '../data/taxonomy'
import type { Band } from '../types/music'
import type { GenreTaxonomyId, MoodGroupId, MoodId } from '../types/taxonomy'

interface GlossaryPageProps {
  bands: Band[]
  onBack: () => void
  onSubgenre: (genreId: GenreTaxonomyId, subgenreId: string) => void
  onMood: (moodId: MoodId) => void
  onSelectBand: (band: Band) => void
}

const groupLabels: Record<MoodGroupId, string> = { energy: '에너지와 속도', emotion: '감정과 정서', texture: '공간감과 음색', listening: '구성과 감상 방식' }

/** 용어 사전 (plan P4-5): 세부장르와 무드의 정의를 장르별로 묶는다. 수록 밴드가 없는 세부장르는 숨긴다. */
export function GlossaryPage({ bands, onBack, onSubgenre, onMood, onSelectBand }: GlossaryPageProps) {
  const bandsBySubgenre = new Map<string, Band[]>()
  for (const band of bands) for (const id of band.taxonomyV2?.subgenreIds ?? []) bandsBySubgenre.set(id, [...(bandsBySubgenre.get(id) ?? []), band])
  const byId = new Map(bands.map((band) => [band.id, band]))
  const examples = (subgenreId: string) => {
    const curated = (taxonomySubgenreById[subgenreId]?.exampleBandIds ?? []).map((id) => byId.get(id)).filter((band): band is Band => Boolean(band))
    if (curated.length) return curated.slice(0, 4)
    return [...(bandsBySubgenre.get(subgenreId) ?? [])].sort((a, b) => b.relations.length - a.relations.length || a.name.localeCompare(b.name, 'en')).slice(0, 3)
  }
  const moodCount = (moodId: MoodId) => bands.filter((band) => (band.taxonomyV2?.moodScores[moodId] ?? 0) >= 3).length

  return (
    <main id="top" className="catalog-page glossary-page" tabIndex={-1}>
      <section className="catalog-hero shell">
        <button className="catalog-back" onClick={onBack}><ArrowLeft size={16} /> 이전 페이지</button>
        <span className="section-no">GLOSSARY</span>
        <h1>용어 사전</h1>
        <p>세부장르와 분위기 이름이 무엇을 뜻하는지, 어떤 밴드부터 들어 보면 좋은지 모았습니다. 이름을 누르면 해당 밴드 목록으로 갑니다.</p>
      </section>
      <section className="shell glossary-section">
        <h2>세부장르</h2>
        {taxonomyGenres.map((genre) => {
          const items = genre.subgenreIds.filter((id) => bandsBySubgenre.has(id))
          if (!items.length) return null
          return <div key={genre.id} className="glossary-genre" style={{ '--active-genre': genre.color } as React.CSSProperties}>
            <h3>{genre.displayName}</h3>
            <dl>{items.map((id) => {
              const subgenre = taxonomySubgenreById[id]
              return <div key={id}>
                <dt><button onClick={() => onSubgenre(genre.id, id)}>{subgenre?.name ?? id}</button><small>{subgenre?.englishName} · {bandsBySubgenre.get(id)?.length ?? 0}팀</small></dt>
                <dd>
                  {subgenre?.description && <p>{subgenre.description}</p>}
                  <span className="glossary-examples">대표 밴드 {examples(id).map((band, index) => <span key={band.id}>{index > 0 && ', '}<button onClick={() => onSelectBand(band)}>{band.name}</button></span>)}</span>
                </dd>
              </div>
            })}</dl>
          </div>
        })}
      </section>
      <section className="shell glossary-section">
        <h2>분위기</h2>
        {(Object.keys(groupLabels) as MoodGroupId[]).map((groupId) => <div key={groupId} className="glossary-genre">
          <h3>{groupLabels[groupId]}</h3>
          <dl>{taxonomyMoods.filter((mood) => mood.groupId === groupId).map((mood) => <div key={mood.id}>
            <dt><button onClick={() => onMood(mood.id)}>{mood.name}</button><small>3점 이상 {moodCount(mood.id)}팀</small></dt>
            <dd><p>{mood.description}</p></dd>
          </div>)}</dl>
        </div>)}
      </section>
    </main>
  )
}
