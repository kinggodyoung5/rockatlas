import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Compass, Menu, Share2, Shuffle, X } from 'lucide-react'
import { AllBandsPage } from './components/AllBandsPage'
import { BandDetail } from './components/BandDetail'
import { DiscoveryHome } from './components/DiscoveryHome'
import { GenreExplorerPage } from './components/GenreExplorerPage'
import { JourneyBar } from './components/JourneyBar'
import { MoodFinderPage } from './components/MoodFinderPage'
import { SharePanel } from './components/SharePanel'
import { loadPublicBand, publicBandById, publicBands as bands } from './data/publicBands'
import { siteContent as staticSiteContent } from './data/siteContent'
import type { SiteContent } from './data/siteContent'
import { taxonomyGenres } from './data/taxonomy'
import { defaultRoute, parseExplorerRoute, routeToSearch, type ExplorerRoute } from './lib/explorerRoute'
import { decodeJourney, encodeJourney, type JourneyStep, type JourneyVia } from './lib/hitchhiking'
import { positionStyle } from './lib/imagePosition'
import { checkStudioAvailability, studioUnavailableMessage } from './lib/studioApiClient'
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

function useStudioAvailability() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let cancelled = false
    void checkStudioAvailability().then((result) => {
      if (!cancelled) setAvailable(result)
    })
    return () => { cancelled = true }
  }, [])
  return available
}

function StudioGate() {
  const [status, setStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')
  useEffect(() => {
    let cancelled = false
    void checkStudioAvailability().then((available) => {
      if (!cancelled) setStatus(available ? 'available' : 'unavailable')
    })
    return () => { cancelled = true }
  }, [])

  if (status === 'checking') return <main className="route-loading">저장 가능한 Studio인지 확인하는 중입니다…</main>
  if (status === 'unavailable') {
    return (
      <main className="studio-unavailable-page">
        <span>LOCAL STUDIO REQUIRED</span>
        <h1>이 화면에서는 편집할 수 없습니다</h1>
        <p>{studioUnavailableMessage}</p>
        <p>브라우저 주소가 <strong>127.0.0.1:5173</strong>이고, Studio 실행 창이 열려 있어야 저장할 수 있습니다.</p>
        <a href="./">공개 화면으로 돌아가기</a>
      </main>
    )
  }
  return <Suspense fallback={<main className="route-loading">Studio를 불러오는 중입니다…</main>}><StudioPage /></Suspense>
}

function getBandIdFromHash() {
  const match = window.location.hash.match(/^#band=(.+)$/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

function ExplorerApp() {
  const [route, setRoute] = useState<ExplorerRoute>(() => parseExplorerRoute())
  const routeRef = useRef(route)
  const initialBandId = getBandIdFromHash()
  const [selectedBandId, setSelectedBandId] = useState<string | null>(initialBandId)
  const [selectedBand, setSelectedBand] = useState<Band | null>(() => initialBandId ? publicBandById[initialBandId] ?? null : null)
  const [bandLoading, setBandLoading] = useState(Boolean(initialBandId))
  const [bandLoadError, setBandLoadError] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBand, setShareBand] = useState<Band | null>(null)
  const [shareJourneyUrl, setShareJourneyUrl] = useState('')
  const {
    favoriteIds,
    historyIds,
    journeySteps,
    toggleFavorite,
    recordVisit,
    clearHistory,
    startJourney,
    travelJourney,
    restoreJourney,
  } = useExplorerState()
  const isLivePreview = new URLSearchParams(window.location.search).get('livePreview') === '1'
  const [previewOverride, setPreviewOverride] = useState<SiteContent | null>(null)
  const siteContent = previewOverride ?? staticSiteContent
  const studioPreview = new URLSearchParams(window.location.search).get('studioPreview') === '1'
  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  const studioAvailable = useStudioAvailability()

  useEffect(() => {
    if (!selectedBandId) {
      setBandLoading(false)
      setBandLoadError('')
      return
    }
    let cancelled = false
    setBandLoading(true)
    setBandLoadError('')
    const load = studioPreview && isLocal
      ? import('./data/bands').then(({ bandById }) => {
          const band = bandById[selectedBandId]
          if (!band) throw new Error('스튜디오에 저장된 밴드를 찾지 못했습니다.')
          return band
        })
      : loadPublicBand(selectedBandId)
    void load.then((band) => {
      if (!cancelled) setSelectedBand(band)
    }).catch((error) => {
      if (!cancelled) setBandLoadError(error instanceof Error ? error.message : '밴드 상세 정보를 불러오지 못했습니다.')
    }).finally(() => {
      if (!cancelled) setBandLoading(false)
    })
    return () => { cancelled = true }
  }, [isLocal, selectedBandId, studioPreview])

  useEffect(() => {
    if (!isLivePreview) return
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'rockatlas-preview' && event.data.siteContent) setPreviewOverride(event.data.siteContent as SiteContent)
    }
    window.addEventListener('message', handleMessage)
    window.parent.postMessage({ type: 'rockatlas-preview-ready' }, '*')
    return () => window.removeEventListener('message', handleMessage)
  }, [isLivePreview])

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    const onPopState = (event: PopStateEvent) => {
      setShareOpen(false)
      const nextRoute = parseExplorerRoute()
      routeRef.current = nextRoute
      setRoute(nextRoute)
      const nextBandId = getBandIdFromHash()
      setSelectedBandId(nextBandId)
      setSelectedBand(nextBandId ? publicBandById[nextBandId] ?? null : null)
      const restoredJourney = decodeJourney(typeof event.state?.hitchJourney === 'string' ? event.state.hitchJourney : '')
      if (nextBandId && restoredJourney.length) restoreJourney(restoredJourney)
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
  }, [restoreJourney])

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
    setSelectedBandId(null)
    setSelectedBand(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const goHome = useCallback(() => updateRoute(defaultRoute()), [updateRoute])
  const scrollToGenres = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    document.getElementById('genres')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
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

  const navigateToBand = useCallback((band: Band, currentJourney: JourneyStep[], nextJourney: JourneyStep[]) => {
    window.history.replaceState({ ...window.history.state, rockAtlasScrollY: window.scrollY, hitchJourney: encodeJourney(currentJourney) }, '', window.location.href)
    window.history.pushState({ rockAtlasNavigation: true, rockAtlasScrollY: 0, bandId: band.id, hitchJourney: encodeJourney(nextJourney) }, '', `${window.location.pathname}${window.location.search}#band=${encodeURIComponent(band.id)}`)
    setSelectedBandId(band.id)
    setSelectedBand(band)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openBand = useCallback((band: Band) => {
    const nextJourney = [{ bandId: band.id }]
    startJourney(band.id)
    navigateToBand(band, journeySteps, nextJourney)
  }, [journeySteps, navigateToBand, startJourney])

  const travelToBand = useCallback((band: Band, via: JourneyVia) => {
    const nextJourney = journeySteps.at(-1)?.bandId === band.id
      ? journeySteps
      : [...journeySteps, { bandId: band.id, via }].slice(-12)
    travelJourney(band.id, via)
    navigateToBand(band, journeySteps, nextJourney)
  }, [journeySteps, navigateToBand, travelJourney])

  const closeBand = useCallback(() => {
    if (window.history.state?.rockAtlasNavigation) {
      window.history.back()
      return
    }
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
    setSelectedBandId(null)
    setSelectedBand(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const surpriseMe = () => openBand(bands[Math.floor(Math.random() * bands.length)])
  const shareBandUrl = shareBand
    ? new URL(`bands/${encodeURIComponent(shareBand.id)}/`, `${window.location.origin}${window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname.replace(/[^/]*$/, '')}`).toString()
    : undefined
  const openJourneyShare = useCallback(() => {
    if (!selectedBand || journeySteps.length < 2) return
    const url = new URL(window.location.href)
    url.searchParams.delete('studioPreview')
    url.searchParams.delete('livePreview')
    url.searchParams.set('journey', encodeJourney(journeySteps))
    url.hash = `band=${encodeURIComponent(selectedBand.id)}`
    setShareBand(null)
    setShareJourneyUrl(url.toString())
    setShareOpen(true)
  }, [journeySteps, selectedBand])
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

  if (selectedBandId && bandLoading) {
    return <main className="route-loading" aria-live="polite">밴드 항해 기록을 불러오는 중입니다…</main>
  }

  if (selectedBandId && bandLoadError) {
    return <main className="route-loading"><p>{bandLoadError}</p><button onClick={closeBand}>이전 페이지</button></main>
  }

  if (selectedBand) {
    const journeyNames = journeySteps
      .map((step) => publicBandById[step.bandId]?.name)
      .filter((name): name is string => Boolean(name))
    return <div className={appClassName} style={themeStyle}>
      {fontFaceRule && <style>{fontFaceRule}</style>}
      <BandDetail
        band={selectedBand}
        onBack={closeBand}
        isFavorite={favoriteIds.includes(selectedBand.id)}
        onToggleFavorite={toggleFavorite}
        visitedIds={historyIds}
        journeySteps={journeySteps}
        onTravelBand={travelToBand}
        onResetJourney={() => startJourney(selectedBand.id)}
        onShareJourney={openJourneyShare}
        onShare={() => {
          setShareJourneyUrl('')
          setShareBand(selectedBand)
          setShareOpen(true)
        }}
      />
      <SharePanel
        open={shareOpen}
        title={shareJourneyUrl ? '나의 ROCK ATLAS 히치하이킹 여정' : `${selectedBand.name} — ROCK ATLAS`}
        description={shareJourneyUrl ? journeyNames.join(' → ') : `${selectedBand.name}의 발자취와 음악, 연결된 밴드를 함께 살펴보세요.`}
        url={shareJourneyUrl || shareBandUrl}
        onClose={() => setShareOpen(false)}
      />
    </div>
  }

  const manifesto = <section className={`manifesto manifesto-bg-${siteContent.theme.manifestoBackgroundMode}`} key="manifesto">{siteContent.theme.manifestoBackgroundMode === 'image' && siteContent.theme.manifestoImageUrl && <img className="manifesto-bg-image" src={siteContent.theme.manifestoImageUrl} alt="" style={positionStyle(siteContent.theme.manifestoImagePosition, siteContent.theme.manifestoImagePositionMobile)} />}{siteContent.theme.manifestoBackgroundMode === 'image' && <div className="manifesto-bg-overlay" style={{ opacity: siteContent.theme.manifestoOverlayOpacity }} />}<div className="shell manifesto-inner"><span>{siteContent.manifestoLabel}</span><h2>{siteContent.manifestoTitle.split('\n').map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}</h2><button onClick={surpriseMe}>{siteContent.manifestoButtonLabel} <ArrowRight /></button></div></section>
  const homeMain = (
    <main id="top" tabIndex={-1}>
      <section className="hero shell">
        <div className="hero-copy"><span className="eyebrow"><Compass size={15} /> WESTERN ROCK DISCOVERY ARCHIVE</span><h1 className="hero-title-long">{siteContent.heroTitle.split('\n').map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}</h1>{siteContent.heroDescription && <p>{siteContent.heroDescription}</p>}<div className="hero-actions"><a className="primary-button" href="#genres" onClick={scrollToGenres}>장르부터 탐색 <ArrowDown size={17} /></a><button className="text-button" onClick={surpriseMe}><Shuffle size={16} /> 아무 밴드나 만나기</button><button className="text-button" onClick={() => { setShareJourneyUrl(''); setShareBand(null); setShareOpen(true) }}><Share2 size={16} /> 지도 공유하기</button></div></div>
        {siteContent.theme.cosmicMode !== 'off' && siteContent.theme.heroArtMode !== 'image' && <div className="cosmic-navigation-graphic" aria-hidden="true"><span className="cosmic-sun">RA</span><i className="orbit orbit-one"><b /></i><i className="orbit orbit-two"><b /></i><i className="orbit orbit-three"><b /></i><em>ROCK / DEEP SPACE / 13 SYSTEMS</em></div>}
        <div className={`hero-art hero-art-${siteContent.theme.heroArtMode}`} aria-hidden="true">{siteContent.theme.heroArtMode === 'vinyl' && <><div className="vinyl-ring ring-one" /><div className="vinyl-ring ring-two" /><div className="vinyl-ring ring-three" /></>}{siteContent.theme.heroArtMode === 'image' && siteContent.theme.heroImageUrl && <img className="hero-custom-image" src={siteContent.theme.heroImageUrl} alt="" loading="eager" decoding="async" fetchPriority="high" style={positionStyle(siteContent.theme.heroImagePosition, siteContent.theme.heroImagePositionMobile)} />}<div className="hero-stamp"><span>{bands.length}</span>CURATED<br />BANDS</div><div className="hero-label">PLAY LOUD<br />EXPLORE DEEP</div></div>
        <div className="hero-index" aria-hidden="true">VOL. 01 / 2026</div>
      </section>
      <div className="shell"><JourneyBar historyIds={historyIds} favoriteIds={favoriteIds} onSelect={openBand} onClearHistory={clearHistory} /></div>
      {siteContent.sectionOrder.map((sectionId) => {
        if (!siteContent.sectionVisibility[sectionId]) return null
        if (sectionId === 'genres') return <DiscoveryHome key="genres" bands={bands} label={siteContent.genreSectionLabel} title={siteContent.genreSectionTitle} description={siteContent.genreSectionDescription} genreVisuals={siteContent.genreVisuals} explorerVisuals={siteContent.explorerVisuals} onGenre={goGenre} onAllBands={goBands} onMoods={goMoods} />
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
  const wordmarkText = (label: string, tagline: string, suffix?: string) => siteContent.theme.wordmarkMode === 'image' && siteContent.theme.wordmarkImageUrl
    ? <span><span className="wordmark-image-row"><img className="wordmark-text-image" src={siteContent.theme.wordmarkImageUrl} alt={label} />{suffix && <i className="wordmark-by">{suffix}</i>}</span><small>{tagline}</small></span>
    : <span><strong>{label} {suffix && <i className="wordmark-by">{suffix}</i>}</strong><small>{tagline}</small></span>
  return (
    <div className={appClassName} style={themeStyle}>
      {fontFaceRule && <style>{fontFaceRule}</style>}<a className="skip-link" href="#top">본문으로 건너뛰기</a>
      <header className="site-header shell"><a className="wordmark" href="./" onClick={(event) => { event.preventDefault(); goHome() }} aria-label="Rock Atlas 홈">{siteContent.theme.logoMode === 'image' && siteContent.theme.logoImageUrl ? <img className="wordmark-mark-image" src={siteContent.theme.logoImageUrl} alt="" /> : <span className="wordmark-mark">RA</span>}{wordmarkText('ROCK ATLAS', siteContent.headerTagline, siteContent.brandSuffix)}</a><nav id="main-navigation" className={mobileMenu ? 'main-nav is-open' : 'main-nav'} aria-label="주요 메뉴">{navLink('home', '장르', goHome)}{navLink('bands', '모든 밴드', goBands)}{navLink('moods', '느낌으로 찾기', goMoods)}<button onClick={() => { surpriseMe(); setMobileMenu(false) }}><Shuffle size={15} /> 랜덤 탐험</button>{studioAvailable && <a href="?studio=1">Studio</a>}</nav><button className="menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label={mobileMenu ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={mobileMenu} aria-controls="main-navigation">{mobileMenu ? <X /> : <Menu />}</button></header>
      {content}
      {studioAvailable && <a className="local-edit-shortcut" href="?studio=1#design">화면 수정</a>}
      <footer className="site-footer shell"><div className="wordmark">{siteContent.theme.logoMode === 'image' && siteContent.theme.logoImageUrl ? <img className="wordmark-mark-image" src={siteContent.theme.logoImageUrl} alt="" /> : <span className="wordmark-mark">RA</span>}{wordmarkText('ROCK ATLAS', siteContent.footerTagline)}</div><p>{bands.length}개 밴드를 수록했습니다. {siteContent.footerDescription}</p><span>{siteContent.footerLocation}</span></footer>
      <SharePanel open={shareOpen} title="ROCK ATLAS — 락의 세계를 여행하는 안내서" description="락의 계보를 함께 여행할 사람에게 메인 지도를 보내보세요." onClose={() => setShareOpen(false)} />
    </div>
  )
}

export default function App() {
  if (new URLSearchParams(window.location.search).get('studio') === '1') return <StudioGate />
  if (new URLSearchParams(window.location.search).get('review') === 'videos') return <Suspense fallback={<main className="route-loading">검수 화면을 불러오는 중입니다…</main>}><VideoReviewPage /></Suspense>
  return <ExplorerApp />
}
