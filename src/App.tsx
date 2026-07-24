import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Compass, Menu, Share2, Shuffle, X } from 'lucide-react'
import { AllBandsPage } from './components/AllBandsPage'
import { BandDetail } from './components/BandDetail'
import { DiscoveryHome } from './components/DiscoveryHome'
import { GenreExplorerPage } from './components/GenreExplorerPage'
import { JourneyBar } from './components/JourneyBar'
import { MoodFinderPage } from './components/MoodFinderPage'
import { SharePanel } from './components/SharePanel'
import { bandById, publicBandById, publicBands as bands } from './data/bands'
import { siteContent } from './data/siteContent'
import { taxonomyGenres } from './data/taxonomy'
import { defaultRoute, parseExplorerRoute, routeToSearch, type ExplorerRoute } from './lib/explorerRoute'
import { useExplorerState } from './hooks/useExplorerState'
import type { Band } from './types/music'
import type { GenreTaxonomyId, MoodId } from './types/taxonomy'

const fontSets = {
  modern: { body: '"Pretendard Variable", Pretendard, "Noto Sans KR", Inter, Arial, sans-serif', heading: '"Pretendard Variable", Arial, "Noto Sans KR", sans-serif' },
  classic: { body: 'Georgia, "Noto Serif KR", serif', heading: 'Georgia, "Noto Serif KR", serif' },
  editorial: { body: 'Inter, Pretendard, sans-serif', heading: '"Arial Narrow", Impact, Pretendard, sans-serif' },
  impact: { body: '"Pretendard Variable", Pretendard, "Noto Sans KR", Inter, Arial, sans-serif', heading: '"Black Han Sans", "Pretendard Variable", Arial, sans-serif' },
}

const StudioPage = lazy(() => import('./components/StudioPage').then((module) => ({ default: module.StudioPage })))
const VideoReviewPage = lazy(() => import('./components/VideoReviewPage').then((module) => ({ default: module.VideoReviewPage })))

function getBandFromHash() {
  const match = window.location.hash.match(/^#band=(.+)$/)
  if (!match) return null
  const id = decodeURIComponent(match[1])
  const studioPreview = new URLSearchParams(window.location.search).get('studioPreview') === '1'
  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  return studioPreview && isLocal ? bandById[id] ?? null : publicBandById[id] ?? null
}

function ExplorerApp() {
  const [route, setRoute] = useState<ExplorerRoute>(() => parseExplorerRoute())
  const routeRef = useRef(route)
  const [selectedBand, setSelectedBand] = useState<Band | null>(() => getBandFromHash())
  const [mobileMenu, setMobileMenu] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const { favoriteIds, historyIds, toggleFavorite, recordVisit, clearHistory } = useExplorerState()

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    const onPopState = (event: PopStateEvent) => {
      const nextRoute = parseExplorerRoute()
      routeRef.current = nextRoute
      setRoute(nextRoute)
      setSelectedBand(getBandFromHash())
      const savedScrollY = typeof event.state?.rockAtlasScrollY === 'number' ? event.state.rockAtlasScrollY : 0
      const restoreScroll = () => {
        const previousBehavior = document.documentElement.style.scrollBehavior
        document.documentElement.style.scrollBehavior = 'auto'
        window.scrollTo(0, savedScrollY)
        document.documentElement.style.scrollBehavior = previousBehavior
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(restoreScroll))
      window.setTimeout(restoreScroll, 180)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (selectedBand) recordVisit(selectedBand.id)
  }, [recordVisit, selectedBand])

  useEffect(() => {
    const activeGenre = route.genreId !== 'all' ? taxonomyGenres.find((genre) => genre.id === route.genreId) : undefined
    const metadata = selectedBand
      ? { title: `${selectedBand.name} — ROCK ATLAS`, description: selectedBand.summary }
      : route.view === 'genre' && activeGenre
        ? { title: `${activeGenre.displayName} — ROCK ATLAS`, description: activeGenre.description }
        : route.view === 'bands'
          ? { title: '모든 밴드 — ROCK ATLAS', description: `${bands.length}개 록 밴드를 장르·시대·국가별로 탐색합니다.` }
          : route.view === 'moods'
            ? { title: '느낌으로 찾기 — ROCK ATLAS', description: '원하는 분위기와 감각을 골라 어울리는 록 밴드를 발견합니다.' }
            : { title: 'ROCK ATLAS — 락밴드 탐험지도', description: siteContent.heroTitle }
    document.title = metadata.title
    const setMeta = (selector: string, value: string) => document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
    setMeta('meta[name="description"]', metadata.description)
    setMeta('meta[property="og:title"]', metadata.title)
    setMeta('meta[property="og:description"]', metadata.description)
    setMeta('meta[name="twitter:title"]', metadata.title)
    setMeta('meta[name="twitter:description"]', metadata.description)
  }, [route.genreId, route.view, selectedBand])

  const updateRoute = useCallback((patch: Partial<ExplorerRoute>, replace = false) => {
    const next = { ...routeRef.current, ...patch }
    routeRef.current = next
    const url = `${window.location.pathname}${routeToSearch(next)}`
    if (!replace) window.history.replaceState({ ...window.history.state, rockAtlasScrollY: window.scrollY }, '', window.location.href)
    const state = replace ? window.history.state : { rockAtlasNavigation: true, rockAtlasScrollY: 0 }
    window.history[replace ? 'replaceState' : 'pushState'](state, '', url)
    setRoute(next)
    setSelectedBand(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const goHome = useCallback(() => updateRoute(defaultRoute()), [updateRoute])
  const goGenre = useCallback((genreId: GenreTaxonomyId) => updateRoute({ ...defaultRoute(), view: 'genre', genreId }), [updateRoute])
  const goBands = useCallback(() => updateRoute({ ...defaultRoute(), view: 'bands' }), [updateRoute])
  const goMoods = useCallback(() => updateRoute({ ...defaultRoute(), view: 'moods' }), [updateRoute])
  const goBackToPreviousPage = useCallback(() => {
    if (window.history.state?.rockAtlasNavigation) {
      window.history.back()
      return
    }
    updateRoute(defaultRoute(), true)
  }, [updateRoute])

  const openBand = useCallback((band: Band) => {
    window.history.replaceState({ ...window.history.state, rockAtlasScrollY: window.scrollY }, '', window.location.href)
    window.history.pushState({ rockAtlasNavigation: true, rockAtlasScrollY: 0, bandId: band.id }, '', `${window.location.pathname}${window.location.search}#band=${encodeURIComponent(band.id)}`)
    setSelectedBand(band)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const closeBand = useCallback(() => {
    if (window.history.state?.rockAtlasNavigation) {
      window.history.back()
      return
    }
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
    setSelectedBand(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const surpriseMe = () => openBand(bands[Math.floor(Math.random() * bands.length)])
  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  const presetFonts = fontSets[siteContent.theme.fontPreset]
  const hasCustomFont = Boolean(siteContent.theme.customFontUrl)
  const fonts = {
    body: hasCustomFont && siteContent.theme.customFontTarget !== 'heading' ? 'RockAtlasCustom, sans-serif' : presetFonts.body,
    heading: hasCustomFont && siteContent.theme.customFontTarget !== 'body' ? 'RockAtlasCustom, sans-serif' : presetFonts.heading,
  }
  const themeStyle = {
    '--paper': siteContent.theme.surfaceColor,
    '--ink': siteContent.theme.backgroundColor,
    '--orange': siteContent.theme.accentColor,
    '--muted': siteContent.theme.mutedColor,
    '--font-body': fonts.body,
    '--font-heading': fonts.heading,
    '--font-scale': siteContent.theme.baseFontScale,
    '--body-weight': siteContent.theme.bodyWeight,
    '--body-style': siteContent.theme.bodyItalic ? 'italic' : 'normal',
    '--heading-weight': siteContent.theme.headingWeight,
    '--heading-style': siteContent.theme.headingItalic ? 'italic' : 'normal',
    '--cosmic-color': siteContent.theme.cosmicColor,
    '--star-spacing': `${Math.max(68, 168 - siteContent.theme.starDensity * 18)}px`,
    '--nebula-opacity': siteContent.theme.nebulaIntensity,
    '--cosmic-motion': siteContent.theme.motionIntensity,
    '--cosmic-drift-duration': `${Math.round(90 - siteContent.theme.motionIntensity * 58)}s`,
    '--cosmic-background-image': siteContent.theme.cosmicBackgroundUrl ? `url("${siteContent.theme.cosmicBackgroundUrl}")` : 'none',
    '--cosmic-background-position': siteContent.theme.cosmicBackgroundPosition,
    '--cosmic-background-opacity': siteContent.theme.cosmicBackgroundOpacity,
    '--genre-card-columns': siteContent.theme.genreCardColumns,
    '--genre-card-gap': `${siteContent.theme.genreCardGap}px`,
  } as React.CSSProperties
  const fontFaceRule = hasCustomFont ? `@font-face{font-family:RockAtlasCustom;src:url("${siteContent.theme.customFontUrl}") format("${siteContent.theme.customFontFormat}");font-display:swap;font-weight:100 900;font-style:normal;}` : ''
  const appClassName = `app-shell theme-${siteContent.theme.fontPreset} cosmic-${siteContent.theme.cosmicMode} genre-card-style-${siteContent.theme.genreCardStyle}${siteContent.theme.motionIntensity === 0 ? ' cosmic-motion-off' : ''}`

  if (selectedBand) {
    return <div className={appClassName} style={themeStyle}>{fontFaceRule && <style>{fontFaceRule}</style>}<BandDetail band={selectedBand} onBack={closeBand} onSelectBand={openBand} isFavorite={favoriteIds.includes(selectedBand.id)} onToggleFavorite={toggleFavorite} visitedIds={historyIds} /></div>
  }

  const manifesto = <section className="manifesto" key="manifesto"><div className="shell manifesto-inner"><span>{siteContent.manifestoLabel}</span><h2>{siteContent.manifestoTitle.split('\n').map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}</h2><button onClick={surpriseMe}>{siteContent.manifestoButtonLabel} <ArrowRight /></button></div></section>
  const homeMain = (
    <main id="top" tabIndex={-1}>
      <section className="hero shell">
        <div className="hero-copy"><span className="eyebrow"><Compass size={15} /> WESTERN ROCK DISCOVERY ARCHIVE</span><h1 className="hero-title-long">{siteContent.heroTitle}</h1>{siteContent.heroDescription && <p>{siteContent.heroDescription}</p>}<div className="hero-actions"><a className="primary-button" href="#genres">장르부터 탐색 <ArrowDown size={17} /></a><button className="text-button" onClick={surpriseMe}><Shuffle size={16} /> 아무 밴드나 만나기</button><button className="text-button" onClick={() => setShareOpen(true)}><Share2 size={16} /> 지도 공유하기</button></div></div>
        {siteContent.theme.cosmicMode !== 'off' && siteContent.theme.heroArtMode !== 'image' && <div className="cosmic-navigation-graphic" aria-hidden="true"><span className="cosmic-sun">RA</span><i className="orbit orbit-one"><b /></i><i className="orbit orbit-two"><b /></i><i className="orbit orbit-three"><b /></i><em>ROCK / DEEP SPACE / 13 SYSTEMS</em></div>}
        <div className={`hero-art hero-art-${siteContent.theme.heroArtMode}`} aria-hidden="true">{siteContent.theme.heroArtMode === 'vinyl' && <><div className="vinyl-ring ring-one" /><div className="vinyl-ring ring-two" /><div className="vinyl-ring ring-three" /></>}{siteContent.theme.heroArtMode === 'image' && siteContent.theme.heroImageUrl && <img className="hero-custom-image" src={siteContent.theme.heroImageUrl} alt="" loading="eager" decoding="async" fetchPriority="high" style={{ objectPosition: siteContent.theme.heroImagePosition }} />}<div className="hero-stamp"><span>{bands.length}</span>CURATED<br />BANDS</div><div className="hero-label">PLAY LOUD<br />EXPLORE DEEP</div></div>
        <div className="hero-index" aria-hidden="true">VOL. 01 / 2026</div>
      </section>
      <div className="shell"><JourneyBar historyIds={historyIds} favoriteIds={favoriteIds} onSelect={openBand} onClearHistory={clearHistory} /></div>
      {siteContent.sectionOrder.map((sectionId) => {
        if (!siteContent.sectionVisibility[sectionId]) return null
        if (sectionId === 'genres') return <DiscoveryHome key="genres" bands={bands} label={siteContent.genreSectionLabel} title={siteContent.genreSectionTitle} description={siteContent.genreSectionDescription} genreVisuals={siteContent.genreVisuals} onGenre={goGenre} onAllBands={goBands} onMoods={goMoods} />
        if (sectionId === 'manifesto') return manifesto
        return null
      })}
    </main>
  )

  const activeGenreId = route.genreId === 'all' ? taxonomyGenres[0].id : route.genreId
  const content = route.view === 'home' ? homeMain
    : route.view === 'genre' ? <GenreExplorerPage bands={bands} genreId={activeGenreId} subgenreId={route.subgenreId} moodId={route.quickMoodId} favoriteIds={favoriteIds} onBack={goBackToPreviousPage} onSelectBand={openBand} onToggleFavorite={toggleFavorite} onFilter={(patch) => updateRoute({ subgenreId: patch.subgenreId ?? route.subgenreId, quickMoodId: patch.moodId ?? route.quickMoodId }, true)} />
      : route.view === 'bands' ? <AllBandsPage bands={bands} query={route.query} genreId={route.genreId} subgenreId={route.subgenreId} eraId={route.eraId} countryCode={route.countryCode} sort={route.sort} favoriteIds={favoriteIds} sectionLabel={siteContent.allBandsSectionLabel} sectionTitle={siteContent.allBandsSectionTitle} sectionDescription={siteContent.allBandsSectionDescription} onFilter={(patch) => updateRoute(patch, true)} onSelectBand={openBand} onToggleFavorite={toggleFavorite} />
        : <MoodFinderPage bands={bands} selectedMoodIds={route.selectedMoodIds} genreId={route.genreId} eraId={route.eraId} countryCode={route.countryCode} favoriteIds={favoriteIds} sectionLabel={siteContent.moodSectionLabel} sectionTitle={siteContent.moodSectionTitle} sectionDescription={siteContent.moodSectionDescription} onFilter={(patch) => updateRoute(patch, true)} onSelectBand={openBand} onToggleFavorite={toggleFavorite} />

  const navLink = (view: 'home' | 'bands' | 'moods', label: string, action: () => void) => <a href={view === 'home' ? './' : `?view=${view}`} onClick={(event) => { event.preventDefault(); action(); setMobileMenu(false) }}>{label}</a>
  return (
    <div className={appClassName} style={themeStyle}>
      {fontFaceRule && <style>{fontFaceRule}</style>}<a className="skip-link" href="#top">본문으로 건너뛰기</a>
      <header className="site-header shell"><a className="wordmark" href="./" onClick={(event) => { event.preventDefault(); goHome() }} aria-label="Rock Atlas 홈">{siteContent.theme.logoMode === 'image' && siteContent.theme.logoImageUrl ? <img className="wordmark-mark-image" src={siteContent.theme.logoImageUrl} alt="" /> : <span className="wordmark-mark">RA</span>}{siteContent.theme.wordmarkMode === 'image' && siteContent.theme.wordmarkImageUrl ? <img className="wordmark-text-image" src={siteContent.theme.wordmarkImageUrl} alt="ROCK ATLAS" /> : <span><strong>ROCK ATLAS <i className="wordmark-by">{siteContent.brandSuffix}</i></strong><small>AMPLIFY YOUR TASTE</small></span>}</a><nav id="main-navigation" className={mobileMenu ? 'main-nav is-open' : 'main-nav'} aria-label="주요 메뉴">{navLink('home', '장르', goHome)}{navLink('bands', '모든 밴드', goBands)}{navLink('moods', '느낌으로 찾기', goMoods)}<button onClick={() => { surpriseMe(); setMobileMenu(false) }}><Shuffle size={15} /> 랜덤 탐험</button>{isLocal && <a href="?studio=1">Studio</a>}</nav><button className="menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label={mobileMenu ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={mobileMenu} aria-controls="main-navigation">{mobileMenu ? <X /> : <Menu />}</button></header>
      {content}
      {isLocal && <a className="local-edit-shortcut" href="?studio=1#design">화면 수정</a>}
      <footer className="site-footer shell"><div className="wordmark">{siteContent.theme.logoMode === 'image' && siteContent.theme.logoImageUrl ? <img className="wordmark-mark-image" src={siteContent.theme.logoImageUrl} alt="" /> : <span className="wordmark-mark">RA</span>}{siteContent.theme.wordmarkMode === 'image' && siteContent.theme.wordmarkImageUrl ? <img className="wordmark-text-image" src={siteContent.theme.wordmarkImageUrl} alt="ROCK ATLAS" /> : <span><strong>ROCK ATLAS</strong><small>BETA ARCHIVE</small></span>}</div><p>{bands.length}개 밴드를 수록했습니다. 각 밴드는 대표 장르 한 곳에 배치되고 세부 장르와 분위기로 다시 이어집니다.</p><span>SEOUL / 2026</span></footer>
      <SharePanel open={shareOpen} title="ROCK ATLAS — 락의 세계를 여행하는 안내서" description={siteContent.heroTitle} onClose={() => setShareOpen(false)} />
    </div>
  )
}

export default function App() {
  if (new URLSearchParams(window.location.search).get('studio') === '1') return <Suspense fallback={<main className="route-loading">Studio를 불러오는 중입니다…</main>}><StudioPage /></Suspense>
  if (new URLSearchParams(window.location.search).get('review') === 'videos') return <Suspense fallback={<main className="route-loading">검수 화면을 불러오는 중입니다…</main>}><VideoReviewPage /></Suspense>
  return <ExplorerApp />
}
