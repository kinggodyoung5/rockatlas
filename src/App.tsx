import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, Compass, Menu, Search, Shuffle, X } from 'lucide-react'
import { BandCard } from './components/BandCard'
import { BandDetail } from './components/BandDetail'
import { JourneyBar } from './components/JourneyBar'
import { TrackModal } from './components/TrackModal'
import { VideoReviewPage } from './components/VideoReviewPage'
import { StudioPage } from './components/StudioPage'
import { bandById, publicBandById, publicBands as bands } from './data/bands'
import { eras } from './data/eras'
import { genres } from './data/genres'
import { siteContent } from './data/siteContent'
import { useExplorerState } from './hooks/useExplorerState'
import type { Band, EraId, GenreId, Track } from './types/music'

function getBandFromHash() {
  const match = window.location.hash.match(/^#band=(.+)$/)
  if (!match) return null
  const id = decodeURIComponent(match[1])
  const studioPreview = new URLSearchParams(window.location.search).get('studioPreview') === '1'
  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  return studioPreview && isLocal ? bandById[id] ?? null : publicBandById[id] ?? null
}

function ExplorerApp() {
  const [selectedGenre, setSelectedGenre] = useState<GenreId | 'all'>('all')
  const [selectedEra, setSelectedEra] = useState<EraId | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selectedBand, setSelectedBand] = useState<Band | null>(() => getBandFromHash())
  const [trackSelection, setTrackSelection] = useState<{ band: Band; track: Track } | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const { favoriteIds, historyIds, toggleFavorite, recordVisit, clearHistory } = useExplorerState()

  useEffect(() => {
    const onPopState = () => setSelectedBand(getBandFromHash())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (selectedBand) recordVisit(selectedBand.id)
  }, [recordVisit, selectedBand])

  const visibleBands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return bands.filter((band) => {
      const inGenre = selectedGenre === 'all' || band.primaryGenre === selectedGenre
      const inEra = selectedEra === 'all' || band.eraTags.some((eraTag) => eraTag.era === selectedEra)
      const searchable = `${band.name} ${band.origin} ${band.tags.join(' ')} ${band.subgenres.join(' ')} ${band.eraTags.map((eraTag) => eraTag.note ?? '').join(' ')}`.toLocaleLowerCase()
      return inGenre && inEra && (!normalized || searchable.includes(normalized))
    })
  }, [query, selectedEra, selectedGenre])

  const openBand = useCallback((band: Band) => {
    window.history.pushState({ bandId: band.id }, '', `#band=${encodeURIComponent(band.id)}`)
    setSelectedBand(band)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const closeBand = useCallback(() => {
    window.history.pushState({}, '', `${window.location.pathname}${window.location.search}`)
    setSelectedBand(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const playTrack = useCallback((band: Band, track: Track) => setTrackSelection({ band, track }), [])
  const closeTrack = useCallback(() => setTrackSelection(null), [])

  const selectGenre = (genreId: GenreId | 'all') => {
    setSelectedGenre(genreId)
    window.setTimeout(() => document.getElementById('bands')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const surpriseMe = () => openBand(bands[Math.floor(Math.random() * bands.length)])

  if (selectedBand) {
    return (
      <>
        <BandDetail
          band={selectedBand}
          onBack={closeBand}
          onSelectBand={openBand}
          onPlayTrack={(track) => playTrack(selectedBand, track)}
          isFavorite={favoriteIds.includes(selectedBand.id)}
          onToggleFavorite={toggleFavorite}
          visitedIds={historyIds}
        />
        <TrackModal selection={trackSelection} onClose={closeTrack} />
      </>
    )
  }

  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  const fontSets = {
    modern: { body: 'Pretendard, "Noto Sans KR", Inter, Arial, sans-serif', heading: 'Arial, "Noto Sans KR", sans-serif' },
    classic: { body: 'Georgia, "Noto Serif KR", serif', heading: 'Georgia, "Noto Serif KR", serif' },
    editorial: { body: 'Inter, Pretendard, sans-serif', heading: '"Arial Narrow", Impact, Pretendard, sans-serif' },
  }
  const fonts = fontSets[siteContent.theme.fontPreset]
  const themeStyle = {
    '--paper': siteContent.theme.surfaceColor,
    '--ink': siteContent.theme.backgroundColor,
    '--orange': siteContent.theme.accentColor,
    '--muted': siteContent.theme.mutedColor,
    '--font-body': fonts.body,
    '--font-heading': fonts.heading,
    '--font-scale': siteContent.theme.baseFontScale,
    '--heading-weight': siteContent.theme.headingWeight,
  } as React.CSSProperties

  const genreSection = (
    <section id="genres" className="genre-section" key="genres">
      <div className="shell">
        <div className="section-heading">
          <span className="section-no">{siteContent.genreSectionLabel}</span>
          <div><h2>{siteContent.genreSectionTitle}</h2>{siteContent.genreSectionDescription && <p>{siteContent.genreSectionDescription}</p>}</div>
        </div>
        <div className="genre-grid">
          {genres.map((genre, index) => {
            const count = bands.filter((band) => band.primaryGenre === genre.id).length
            return (
              <button key={genre.id} className="genre-card" onClick={() => selectGenre(genre.id)} style={{ '--genre-color': genre.color, '--genre-rgb': genre.accent } as React.CSSProperties}>
                <span className="genre-index">{String(index + 1).padStart(2, '0')}</span><span className="genre-count">{count} BANDS</span>
                <h3>{genre.name}</h3><strong>{genre.englishName}</strong><p>{genre.description}</p>
                <span className="folded-label">함께 보는 장르</span><span className="folded-list">{genre.foldedGenres.slice(0, 3).join(' · ')}</span><span className="genre-arrow"><ArrowRight /></span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )

  const bandsSection = (
    <section id="bands" className="bands-section shell" key="bands">
      <div className="bands-toolbar">
        <div><span className="section-no">02 / THE INDEX</span><h2>{selectedGenre === 'all' ? '전체 밴드' : genres.find((genre) => genre.id === selectedGenre)?.name}</h2><p>{visibleBands.length}개의 출발점</p></div>
        <label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">밴드 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="밴드, 국가, 스타일 검색" />{query && <button onClick={() => setQuery('')} aria-label="검색어 지우기"><X size={16} /></button>}</label>
      </div>
      <div className="genre-filters" aria-label="장르 필터"><button className={selectedGenre === 'all' ? 'active' : ''} onClick={() => setSelectedGenre('all')}>전체</button>{genres.map((genre) => <button key={genre.id} className={selectedGenre === genre.id ? 'active' : ''} onClick={() => setSelectedGenre(genre.id)}>{genre.name}</button>)}</div>
      <div className="era-filters" aria-label="시대 필터"><span>시대</span><button className={selectedEra === 'all' ? 'active' : ''} onClick={() => setSelectedEra('all')}>모든 시대</button>{eras.map((era) => <button key={era.id} className={selectedEra === era.id ? 'active' : ''} onClick={() => setSelectedEra(era.id)}>{era.label}</button>)}</div>
      {visibleBands.length > 0 ? <div className="band-grid">{visibleBands.map((band, index) => <BandCard key={band.id} band={band} index={index} onSelect={openBand} isFavorite={favoriteIds.includes(band.id)} onToggleFavorite={toggleFavorite} />)}</div> : <div className="empty-state"><p>이 조건에 맞는 밴드를 찾지 못했습니다.</p><button onClick={() => { setQuery(''); setSelectedGenre('all'); setSelectedEra('all') }}>필터 초기화</button></div>}
    </section>
  )

  const manifestoSection = (
    <section className="manifesto" key="manifesto"><div className="shell manifesto-inner"><span>NOT A RANKING</span><h2>순위를 매기지 않습니다.<br />다음 음악으로 가는 <em>길</em>을 만듭니다.</h2><button onClick={surpriseMe}>첫 번째 노드 선택하기 <ArrowRight /></button></div></section>
  )
  const sectionMap = { genres: genreSection, bands: bandsSection, manifesto: manifestoSection }

  return (
    <div className={`app-shell theme-${siteContent.theme.fontPreset}`} style={themeStyle}>
      <header className="site-header shell">
        <a className="wordmark" href="#top" aria-label="Rock Atlas 홈">
          <span className="wordmark-mark">RA</span>
          <span><strong>ROCK ATLAS <i className="wordmark-by">{siteContent.brandSuffix}</i></strong><small>AMPLIFY YOUR TASTE</small></span>
        </a>
        <nav className={mobileMenu ? 'main-nav is-open' : 'main-nav'} aria-label="주요 메뉴">
          <a href="#genres" onClick={() => setMobileMenu(false)}>장르</a>
          <a href="#bands" onClick={() => setMobileMenu(false)}>밴드</a>
          <button onClick={() => { surpriseMe(); setMobileMenu(false) }}><Shuffle size={15} /> 랜덤 탐험</button>
          {isLocal && <a href="?studio=1">Studio</a>}
        </nav>
        <button className="menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label="메뉴 열기">
          {mobileMenu ? <X /> : <Menu />}
        </button>
      </header>

      <main id="top">
        <section className="hero shell">
          <div className="hero-copy">
            <span className="eyebrow"><Compass size={15} /> WESTERN ROCK DISCOVERY ARCHIVE</span>
            <h1 className="hero-title-long">{siteContent.heroTitle}</h1>
            {siteContent.heroDescription && <p>{siteContent.heroDescription}</p>}
            <div className="hero-actions">
              <a className="primary-button" href={siteContent.sectionVisibility.genres ? '#genres' : '#bands'}>장르부터 탐색 <ArrowDown size={17} /></a>
              <button className="text-button" onClick={surpriseMe}><Shuffle size={16} /> 아무 밴드나 만나기</button>
            </div>
          </div>
          <div className={`hero-art hero-art-${siteContent.theme.heroArtMode}`} aria-hidden="true">
            {siteContent.theme.heroArtMode === 'vinyl' && <><div className="vinyl-ring ring-one" /><div className="vinyl-ring ring-two" /><div className="vinyl-ring ring-three" /></>}
            {siteContent.theme.heroArtMode === 'image' && siteContent.theme.heroImageUrl && <img className="hero-custom-image" src={siteContent.theme.heroImageUrl} alt="" style={{ objectPosition: siteContent.theme.heroImagePosition }} />}
            <div className="hero-stamp"><span>{bands.length}</span>CURATED<br />BANDS</div>
            <div className="hero-label">PLAY LOUD<br />EXPLORE DEEP</div>
          </div>
          <div className="hero-index" aria-hidden="true">VOL. 01 / 2026</div>
        </section>

        <div className="shell">
          <JourneyBar
            historyIds={historyIds}
            favoriteIds={favoriteIds}
            onSelect={openBand}
            onClearHistory={clearHistory}
          />
        </div>

        {siteContent.sectionOrder.map((sectionId) => siteContent.sectionVisibility[sectionId] ? sectionMap[sectionId] : null)}
      </main>

      {isLocal && <a className="local-edit-shortcut" href="?studio=1#design">화면 수정</a>}

      <footer className="site-footer shell">
        <div className="wordmark"><span className="wordmark-mark">RA</span><span><strong>ROCK ATLAS</strong><small>BETA ARCHIVE</small></span></div>
        <p>{bands.length}개 밴드를 수록했습니다. 각 밴드는 주 장르 한 곳에 배치되고 교차 장르는 상세에서 이어집니다.</p>
        <span>SEOUL / 2026</span>
      </footer>
    </div>
  )
}

export default function App() {
  if (new URLSearchParams(window.location.search).get('studio') === '1') {
    return <StudioPage />
  }
  if (new URLSearchParams(window.location.search).get('review') === 'videos') {
    return <VideoReviewPage />
  }
  return <ExplorerApp />
}
