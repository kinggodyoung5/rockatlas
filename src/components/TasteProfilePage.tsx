import { ArrowRight, Download, Share2, Sparkles, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { taxonomyGenreById, taxonomyMoodById } from '../data/taxonomy'
import { buildTasteProfile, minimumTasteInputs, recommendForProfile, starterBands, stepOutside, tasteSentence } from '../lib/tasteProfile'
import type { Band } from '../types/music'
import { BandCard } from './BandCard'
import { BandImage } from './BandImage'

interface TasteProfilePageProps {
  bands: Band[]
  favoriteIds: string[]
  historyIds: string[]
  journeyIds: string[]
  /** 공유받은 프로필이면 그 밴드 id. 이때는 읽기 전용이다. */
  sharedIds: string[]
  /** 홈의 "취향으로 시작하기"에서 왔으면 입력이 있어도 고르기 화면부터 보여 준다. */
  startWithPicker?: boolean
  onSelectBand: (band: Band) => void
  onToggleFavorite: (bandId: string) => void
  onAddFavorites: (bandIds: string[]) => void
  onMoods: () => void
  onShare: (url: string) => void
  onExport: () => unknown
  onImport: (payload: unknown) => void
}

/** 내 취향 (plan P3-5) + 시작 화면 "3팀 고르기" (plan P3-6). 계산은 전부 이 브라우저 안에서 한다. */
export function TasteProfilePage({ bands, favoriteIds, historyIds, journeyIds, sharedIds, startWithPicker = false, onSelectBand, onToggleFavorite, onAddFavorites, onMoods, onShare, onExport, onImport }: TasteProfilePageProps) {
  const readOnly = sharedIds.length > 0
  const profile = useMemo(() => readOnly
    ? buildTasteProfile({ favoriteIds: sharedIds }, bands)
    : buildTasteProfile({ favoriteIds, journeyIds, historyIds }, bands), [bands, favoriteIds, historyIds, journeyIds, readOnly, sharedIds])
  const seenIds = readOnly ? sharedIds : [...favoriteIds, ...historyIds, ...journeyIds]
  const recommendations = useMemo(() => recommendForProfile(profile, bands, seenIds), [bands, profile, seenIds])
  const outside = useMemo(() => stepOutside(profile, bands, seenIds, 3, recommendations.map((item) => item.band)), [bands, profile, recommendations, seenIds])
  const [picking, setPicking] = useState(startWithPicker || (!readOnly && profile.inputs.length < minimumTasteInputs))
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const starters = useMemo(() => starterBands(bands), [bands])
  const favorites = favoriteIds.map((id) => bands.find((band) => band.id === id)).filter((band): band is Band => Boolean(band))

  if (picking && !readOnly) {
    const togglePick = (id: string) => setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    return (
      <main id="top" className="catalog-page taste-page" tabIndex={-1}>
        <section className="catalog-hero shell"><span className="section-no">START</span><h1>좋아하는 밴드 3팀을 골라 보세요</h1><p>고른 밴드의 분위기와 장르로 취향 지도를 만들고, 아직 안 들어 본 밴드를 추천합니다. 고른 밴드는 저장 목록에 들어갑니다.</p><strong>{picked.length}팀 선택</strong></section>
        <section className="taste-picker shell">
          <div className="taste-picker-grid">{starters.map((band) => {
            const selected = picked.includes(band.id) || favoriteIds.includes(band.id)
            return <button key={band.id} className={selected ? 'is-selected' : ''} aria-pressed={selected} disabled={favoriteIds.includes(band.id)} onClick={() => togglePick(band.id)}>
              <div className="taste-picker-image"><BandImage band={band} /></div>
              <strong>{band.name}</strong>
              <small>{band.taxonomyV2 ? taxonomyGenreById[band.taxonomyV2.primaryGenreId]?.displayName : band.primaryGenre}</small>
            </button>
          })}</div>
          <div className="taste-picker-actions">
            <button className="primary-button" disabled={picked.length + Math.min(favoriteIds.length, minimumTasteInputs) < minimumTasteInputs} onClick={() => { onAddFavorites(picked); setPicked([]); setPicking(false) }}>이 밴드들로 시작 <ArrowRight size={16} /></button>
            <button className="text-button" onClick={onMoods}>잘 모르겠어요 → 느낌으로 찾기</button>
            {profile.inputs.length >= minimumTasteInputs && <button className="text-button" onClick={() => setPicking(false)}>지금 프로필 보기</button>}
          </div>
        </section>
      </main>
    )
  }

  const topMoods = profile.topMoods.slice(0, 8)
  const maxMood = Math.max(5, ...topMoods.map((item) => item.value))
  const sentence = tasteSentence(profile)
  const exportFile = () => {
    const blob = new Blob([`${JSON.stringify(onExport(), null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rock-atlas-my-taste-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const importFile = async (file: File) => {
    try {
      onImport(JSON.parse(await file.text()))
      setMessage('가져왔습니다. 저장한 밴드와 탐험 기록을 이 파일의 내용으로 바꿨습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '파일을 읽지 못했습니다.')
    }
  }
  const shareUrl = () => {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('view', 'profile')
    url.searchParams.set('p', favoriteIds.join('.'))
    onShare(url.toString())
  }

  return (
    <main id="top" className="catalog-page taste-page" tabIndex={-1}>
      <section className="catalog-hero shell">
        <span className="section-no">{readOnly ? 'SHARED TASTE' : 'MY TASTE'}</span>
        <h1>{readOnly ? '공유받은 취향 지도' : '내 취향 지도'}</h1>
        <p>{sentence ? `${sentence}.` : '저장한 밴드가 늘어날수록 지도가 선명해집니다.'} {readOnly ? `저장한 밴드 ${profile.inputs.length}팀을 바탕으로 했습니다.` : `저장한 밴드 ${favoriteIds.length}팀${historyIds.length ? `과 방문 기록 ${historyIds.length}팀` : ''}을 바탕으로, 이 브라우저 안에서만 계산했습니다.`}</p>
        {!readOnly && <div className="taste-actions">
          <button className="text-button" onClick={() => setPicking(true)}><Sparkles size={15} /> 밴드 더 고르기</button>
          {favoriteIds.length > 0 && <button className="text-button" onClick={shareUrl}><Share2 size={15} /> 취향 공유</button>}
          <button className="text-button" onClick={exportFile}><Download size={15} /> 내보내기</button>
          <button className="text-button" onClick={() => importRef.current?.click()}><Upload size={15} /> 가져오기</button>
          <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }} />
        </div>}
        {message && <p className="taste-message" role="status">{message}</p>}
      </section>

      <section className="taste-summary shell">
        <div className="taste-moods">
          <h2>자주 끌린 분위기</h2>
          <svg viewBox={`0 0 320 ${topMoods.length * 30}`} role="img" aria-label={topMoods.map((item) => `${taxonomyMoodById[item.moodId]?.name} ${item.value.toFixed(1)}`).join(', ')}>
            {topMoods.map((item, index) => <g key={item.moodId} transform={`translate(0 ${index * 30})`}>
              <text x="0" y="13" className="taste-bar-label">{taxonomyMoodById[item.moodId]?.name}</text>
              <rect x="0" y="18" width="320" height="6" className="taste-bar-track" />
              <rect x="0" y="18" width={(item.value / maxMood) * 320} height="6" className="taste-bar-fill" />
              <text x="320" y="13" textAnchor="end" className="taste-bar-value">{item.value.toFixed(1)}</text>
            </g>)}
          </svg>
        </div>
        <div className="taste-shares">
          <h2>장르</h2>
          <ul>{profile.genres.slice(0, 5).map((item) => <li key={item.genreId}><span>{taxonomyGenreById[item.genreId]?.displayName}</span><em>{Math.round(item.share * 100)}%</em></li>)}</ul>
          <h2>결성 시대</h2>
          <ul>{profile.decades.map((item) => <li key={item.decade}><span>{item.decade}년대</span><em>{Math.round(item.share * 100)}%</em></li>)}</ul>
        </div>
      </section>

      {recommendations.length > 0 && <section className="catalog-results shell">
        <div className="result-heading"><h2>아직 안 가본 추천 {recommendations.length}팀</h2><p>취향 지도와 분위기 모양이 가까운 순서입니다. 한 장르는 최대 4팀까지만 넣었습니다.</p></div>
        <div className="band-grid">{recommendations.map((item, index) => <div key={item.band.id} className="taste-result">
          {item.sharedMoods.length > 0 && <small className="taste-why">{item.sharedMoods.slice(0, 2).map((id) => taxonomyMoodById[id]?.name).join(' · ')}</small>}
          <BandCard band={item.band} index={index} onSelect={onSelectBand} isFavorite={favoriteIds.includes(item.band.id)} onToggleFavorite={onToggleFavorite} />
        </div>)}</div>
      </section>}

      {outside.length > 0 && <section className="catalog-results shell taste-outside">
        <div className="result-heading"><h2>취향 밖으로 한 걸음</h2><p>지금까지 안 들어 본 장르지만, 좋아하는 분위기를 하나 이상 함께 가진 밴드입니다.</p></div>
        <div className="band-grid">{outside.map((item, index) => <div key={item.band.id} className="taste-result">
          <small className="taste-why">{taxonomyGenreById[item.band.taxonomyV2!.primaryGenreId]?.displayName} · {item.sharedMoods.slice(0, 2).map((id) => taxonomyMoodById[id]?.name).join(' · ')}</small>
          <BandCard band={item.band} index={index} onSelect={onSelectBand} isFavorite={favoriteIds.includes(item.band.id)} onToggleFavorite={onToggleFavorite} />
        </div>)}</div>
      </section>}

      {!readOnly && favorites.length > 0 && <section className="catalog-results shell">
        <div className="result-heading"><h2>저장한 밴드 {favorites.length}팀</h2></div>
        <div className="band-grid">{favorites.map((band, index) => <BandCard key={band.id} band={band} index={index} onSelect={onSelectBand} isFavorite onToggleFavorite={onToggleFavorite} />)}</div>
      </section>}
    </main>
  )
}
