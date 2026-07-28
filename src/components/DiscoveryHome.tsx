import { ArrowRight } from 'lucide-react'
import { taxonomyGenres, taxonomySubgenreById } from '../data/taxonomy'
import type { SiteContent } from '../data/siteContent'
import type { Band } from '../types/music'
import type { GenreTaxonomyId } from '../types/taxonomy'
import { positionStyle } from '../lib/imagePosition'
import { TightText } from './TightText'

interface DiscoveryHomeProps {
  bands: Band[]
  label: string
  title: string
  description: string
  genreVisuals: SiteContent['genreVisuals']
  explorerVisuals: SiteContent['explorerVisuals']
  onGenre: (genreId: GenreTaxonomyId) => void
  onAllBands: () => void
  onMoods: () => void
}

export function DiscoveryHome({ bands, label, title, description, genreVisuals, explorerVisuals, onGenre, onAllBands, onMoods }: DiscoveryHomeProps) {
  const allBandsVisual = explorerVisuals.allBands
  const moodsVisual = explorerVisuals.moods

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
                {visual.artMode === 'image' && visual.imageUrl && <span className="genre-card-art" aria-hidden="true"><img src={visual.imageUrl} alt="" loading="lazy" decoding="async" style={positionStyle(visual.imagePosition, visual.imagePositionMobile)} /></span>}
                <span className="genre-card-top"><span className="genre-index">{String(index + 1).padStart(2, '0')}</span><span className="genre-count">{count} BANDS</span></span>
                <span className="genre-card-copy"><TightText as="h3">{genre.displayName}</TightText><strong>{genre.englishName}</strong><TightText as="p" mode="no-orphan">{genre.vibeDescription}</TightText></span>
                <span className="genre-card-foot"><span><span className="folded-label">세부 장르</span><span className="folded-list">{genre.subgenreIds.slice(0, 3).map((id) => taxonomySubgenreById[id]?.name ?? id).join(' · ')}</span></span><span className="genre-arrow"><ArrowRight /></span></span>
              </button>
            )
          })}
          <button className={`genre-card discovery-card explorer-card ${allBandsVisual.artMode === 'image' && allBandsVisual.imageUrl ? 'has-art' : ''}`} onClick={onAllBands} style={{ '--genre-color': '#7d72bf', '--genre-art-opacity': allBandsVisual.imageOpacity, '--genre-art-scale': allBandsVisual.imageScale } as React.CSSProperties}>
            {allBandsVisual.artMode === 'image' && allBandsVisual.imageUrl && <span className="genre-card-art" aria-hidden="true"><img src={allBandsVisual.imageUrl} alt="" loading="lazy" decoding="async" style={positionStyle(allBandsVisual.imagePosition, allBandsVisual.imagePositionMobile)} /></span>}
            <span className="genre-card-top"><span className="explorer-badge">EXPLORER</span><span className="genre-count">{bands.length} BANDS</span></span>
            <span className="genre-card-copy"><TightText as="h3">모든 밴드 보기</TightText><strong>ALL BANDS</strong><TightText as="p" mode="no-orphan">이름, 시대, 국가, 장르와 세부 장르로 전체 목록을 살펴봅니다.</TightText></span>
            <span className="genre-card-foot"><span><span className="folded-label">전체 아카이브</span><span className="folded-list">13 장르 · {bands.length} 밴드</span></span><span className="genre-arrow"><ArrowRight /></span></span>
          </button>
          <button className={`genre-card discovery-card explorer-card mood-explorer-card ${moodsVisual.artMode === 'image' && moodsVisual.imageUrl ? 'has-art' : ''}`} onClick={onMoods} style={{ '--genre-color': '#e86335', '--genre-art-opacity': moodsVisual.imageOpacity, '--genre-art-scale': moodsVisual.imageScale } as React.CSSProperties}>
            {moodsVisual.artMode === 'image' && moodsVisual.imageUrl && <span className="genre-card-art" aria-hidden="true"><img src={moodsVisual.imageUrl} alt="" loading="lazy" decoding="async" style={positionStyle(moodsVisual.imagePosition, moodsVisual.imagePositionMobile)} /></span>}
            <span className="genre-card-top"><span className="explorer-badge">EXPLORER</span><span className="genre-count">24 MOODS</span></span>
            <span className="genre-card-copy"><TightText as="h3">느낌으로 찾기</TightText><strong>MOOD FINDER</strong><TightText as="p" mode="no-orphan">장르 이름을 몰라도 지금 듣고 싶은 분위기로 밴드를 발견합니다.</TightText></span>
            <span className="genre-card-foot"><span><span className="folded-label">분위기 탐색</span><span className="folded-list">4 그룹 · 24 분위기</span></span><span className="genre-arrow"><ArrowRight /></span></span>
          </button>
        </div>
      </div>
    </section>
  )
}
