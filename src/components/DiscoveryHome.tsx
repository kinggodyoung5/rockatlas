import { ArrowRight, AudioWaveform, Grid3X3 } from 'lucide-react'
import { taxonomyGenres, taxonomySubgenreById } from '../data/taxonomy'
import type { SiteContent } from '../data/siteContent'
import type { Band } from '../types/music'
import type { GenreTaxonomyId } from '../types/taxonomy'

interface DiscoveryHomeProps {
  bands: Band[]
  label: string
  title: string
  description: string
  genreVisuals: SiteContent['genreVisuals']
  onGenre: (genreId: GenreTaxonomyId) => void
  onAllBands: () => void
  onMoods: () => void
}

export function DiscoveryHome({ bands, label, title, description, genreVisuals, onGenre, onAllBands, onMoods }: DiscoveryHomeProps) {
  return (
    <section id="genres" className="genre-section discovery-home">
      <div className="shell">
        <div className="section-heading">
          <span className="section-no">{label}</span>
          <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        </div>
        <div className="genre-grid discovery-grid">
          {taxonomyGenres.map((genre, index) => {
            const count = bands.filter((band) => band.taxonomyV2?.primaryGenreId === genre.id).length
            const visual = genreVisuals[genre.id]
            return (
              <button key={genre.id} className={`genre-card discovery-card ${visual.artMode === 'image' && visual.imageUrl ? 'has-art' : ''}`} onClick={() => onGenre(genre.id)} style={{ '--genre-color': genre.color, '--genre-rgb': genre.accent, '--genre-art-opacity': visual.imageOpacity, '--genre-art-scale': visual.imageScale } as React.CSSProperties}>
                {visual.artMode === 'image' && visual.imageUrl && <span className="genre-card-art" aria-hidden="true"><img src={visual.imageUrl} alt="" loading="lazy" decoding="async" style={{ objectPosition: visual.imagePosition }} /></span>}
                <span className="genre-card-top"><span className="genre-index">{String(index + 1).padStart(2, '0')}</span><span className="genre-count">{count} BANDS</span></span>
                <span className="genre-card-copy"><h3>{genre.displayName}</h3><strong>{genre.englishName}</strong><p>{genre.vibeDescription}</p></span>
                <span className="genre-card-foot"><span><span className="folded-label">세부 장르</span><span className="folded-list">{genre.subgenreIds.slice(0, 3).map((id) => taxonomySubgenreById[id]?.name ?? id).join(' · ')}</span></span><span className="genre-arrow"><ArrowRight /></span></span>
              </button>
            )
          })}
          <button className="genre-card discovery-card explorer-card" onClick={onAllBands} style={{ '--genre-color': '#202126' } as React.CSSProperties}>
            <span className="explorer-badge">EXPLORER</span><Grid3X3 size={25} /><h3>모든 밴드 보기</h3><strong>ALL BANDS</strong><p>이름, 시대, 국가, 장르와 세부 장르로 전체 목록을 살펴봅니다.</p><span className="genre-count">{bands.length} BANDS</span><span className="genre-arrow"><ArrowRight /></span>
          </button>
          <button className="genre-card discovery-card explorer-card mood-explorer-card" onClick={onMoods} style={{ '--genre-color': '#e86335' } as React.CSSProperties}>
            <span className="explorer-badge">EXPLORER</span><AudioWaveform size={25} /><h3>느낌으로 찾기</h3><strong>MOOD FINDER</strong><p>장르 이름을 몰라도 지금 듣고 싶은 분위기로 밴드를 발견합니다.</p><span className="genre-count">24 MOODS</span><span className="genre-arrow"><ArrowRight /></span>
          </button>
        </div>
      </div>
    </section>
  )
}
