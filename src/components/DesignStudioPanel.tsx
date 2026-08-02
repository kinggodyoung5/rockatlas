import { ArrowDown, ArrowUp, ExternalLink, FileUp, ImagePlus, Monitor, Orbit, Save, Smartphone, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MoodGroupId, TaxonomyGenre, TaxonomyMood } from '../types/taxonomy'
import { HITCHHIKING_DIRECTIONS } from '../config/hitchhiking'
import type { BandDetailCopy, SiteContent, SiteSectionId } from '../data/siteContent'
import { formatFileSize, optimizeImageUpload, type StudioImageAssetType } from '../lib/imageUpload'
import { studioFetchJson } from '../lib/studioApiClient'
import { ImagePositionPicker } from './ImagePositionPicker'

interface DesignStudioPanelProps {
  value: SiteContent
  dirty: boolean
  message: string
  genres: TaxonomyGenre[]
  moods: TaxonomyMood[]
  genresDirty: boolean
  genreMessage: string
  onChange: (patch: Partial<SiteContent>) => void
  onGenresChange: (genres: TaxonomyGenre[]) => void
  onMoodsChange: (moods: TaxonomyMood[]) => void
  onSave: () => Promise<void>
  onSaveGenres: () => Promise<void>
}

const sectionNames: Record<SiteSectionId, string> = { genres: '장르 탐색', manifesto: '마무리 선언' }
const moodGroupNames: Record<MoodGroupId, string> = { energy: '에너지와 속도', emotion: '감정과 정서', texture: '공간감과 음색', listening: '구성과 감상 방식' }
type ExplorerVisualKey = keyof SiteContent['explorerVisuals']

function colorToAccent(hex: string) {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '128 128 128'
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)).join(' ')
}

export function DesignStudioPanel({ value, dirty, message, genres, moods, genresDirty, genreMessage, onChange, onGenresChange, onMoodsChange, onSave, onSaveGenres }: DesignStudioPanelProps) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [fontMessage, setFontMessage] = useState('WOFF2 권장 · WOFF, TTF, OTF 지원 · 최대 9MB')
  const [imageMessage, setImageMessage] = useState('이미지는 용도에 맞게 자동 축소·압축되며 결과 용량을 여기에 표시합니다.')
  const uploadRef = useRef<HTMLInputElement>(null)
  const fontUploadRef = useRef<HTMLInputElement>(null)
  const bannerUploadRef = useRef<HTMLInputElement>(null)
  const cosmicUploadRef = useRef<HTMLInputElement>(null)
  const manifestoUploadRef = useRef<HTMLInputElement>(null)
  const genreUploadRef = useRef<HTMLInputElement>(null)
  const genreUploadTarget = useRef<TaxonomyGenre['id'] | null>(null)
  const explorerUploadRef = useRef<HTMLInputElement>(null)
  const explorerUploadTarget = useRef<ExplorerVisualKey | null>(null)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)
  const previewValueRef = useRef(value)
  previewValueRef.current = value
  const sendPreviewState = () => previewIframeRef.current?.contentWindow?.postMessage({ type: 'rockatlas-preview', siteContent: previewValueRef.current }, '*')
  useEffect(() => { sendPreviewState() }, [value])
  useEffect(() => {
    const handleReady = (event: MessageEvent) => { if (event.data?.type === 'rockatlas-preview-ready') sendPreviewState() }
    window.addEventListener('message', handleReady)
    return () => window.removeEventListener('message', handleReady)
  }, [])
  const changeTheme = (patch: Partial<SiteContent['theme']>) => onChange({ theme: { ...value.theme, ...patch } })
  const updateGenreVisual = (id: TaxonomyGenre['id'], patch: Partial<SiteContent['genreVisuals'][TaxonomyGenre['id']]>) => {
    onChange({ genreVisuals: { ...value.genreVisuals, [id]: { ...value.genreVisuals[id], ...patch } } })
  }
  const updateExplorerVisual = (id: ExplorerVisualKey, patch: Partial<SiteContent['explorerVisuals'][ExplorerVisualKey]>) => {
    onChange({ explorerVisuals: { ...value.explorerVisuals, [id]: { ...value.explorerVisuals[id], ...patch } } })
  }
  const changeBandDetailCopy = (patch: Partial<BandDetailCopy>) => onChange({ bandDetailCopy: { ...value.bandDetailCopy, ...patch } })
  const updateDirectionCopy = (id: string, patch: Partial<BandDetailCopy['hitchhikingDirections'][string]>) => {
    const current = value.bandDetailCopy.hitchhikingDirections[id] ?? HITCHHIKING_DIRECTIONS.find((direction) => direction.id === id)!
    changeBandDetailCopy({ hitchhikingDirections: { ...value.bandDetailCopy.hitchhikingDirections, [id]: { ...current, ...patch } } })
  }
  const moveSection = (id: SiteSectionId, direction: -1 | 1) => {
    const order = [...value.sectionOrder]
    const index = order.indexOf(id)
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= order.length) return
    ;[order[index], order[nextIndex]] = [order[nextIndex], order[index]]
    onChange({ sectionOrder: order })
  }
  const updateGenre = (id: TaxonomyGenre['id'], patch: Partial<TaxonomyGenre>) => onGenresChange(genres.map((genre) => genre.id === id ? { ...genre, ...patch } : genre))
  const moveGenre = (id: TaxonomyGenre['id'], direction: -1 | 1) => {
    const next = [...genres]
    const index = next.findIndex((genre) => genre.id === id)
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onGenresChange(next.map((genre, order) => ({ ...genre, order: order + 1 })))
  }
  const updateMood = (id: TaxonomyMood['id'], patch: Partial<TaxonomyMood>) => onMoodsChange(moods.map((mood) => mood.id === id ? { ...mood, ...patch } : mood))
  const uploadImage = async (file: File, assetType: StudioImageAssetType, assetKey = '') => {
    setImageMessage(`${file.name} 최적화 중…`)
    try {
      const optimized = await optimizeImageUpload(file, assetType)
      const result = await studioFetchJson<{ url: string }>('/api/studio/upload', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: optimized.dataUrl, assetType, assetKey }) })
      setImageMessage(`${file.name} · ${optimized.width}×${optimized.height} · ${formatFileSize(optimized.originalBytes)} → ${formatFileSize(optimized.storedBytes)}${optimized.optimized ? '로 최적화' : ' · 원본이 이미 충분히 작아 그대로 저장'} · 디자인 저장을 눌러 확정하세요.`)
      return result.url
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.')
      throw error
    }
  }
  const uploadHero = async (file: File) => {
    const url = await uploadImage(file, 'hero')
    changeTheme({ heroImageUrl: url, heroArtMode: 'image' })
  }
  const uploadBanner = async (file: File) => {
    const url = await uploadImage(file, 'wordmark')
    changeTheme({ bannerImageUrl: url })
  }
  const uploadCosmicBackground = async (file: File) => {
    const url = await uploadImage(file, 'cosmic')
    changeTheme({ cosmicBackgroundUrl: url, cosmicMode: value.theme.cosmicMode === 'off' ? 'subtle' : value.theme.cosmicMode })
  }
  const uploadManifestoBackground = async (file: File) => {
    const url = await uploadImage(file, 'cosmic', 'manifesto')
    changeTheme({ manifestoImageUrl: url, manifestoBackgroundMode: 'image' })
  }
  const uploadGenreArt = async (file: File, id: TaxonomyGenre['id']) => {
    const url = await uploadImage(file, 'genre', id)
    updateGenreVisual(id, { imageUrl: url, artMode: 'image' })
  }
  const pickGenreArt = (id: TaxonomyGenre['id']) => {
    genreUploadTarget.current = id
    genreUploadRef.current?.click()
  }
  const uploadExplorerArt = async (file: File, id: ExplorerVisualKey) => {
    const url = await uploadImage(file, 'genre', `explorer-${id}`)
    updateExplorerVisual(id, { imageUrl: url, artMode: 'image' })
  }
  const pickExplorerArt = (id: ExplorerVisualKey) => {
    explorerUploadTarget.current = id
    explorerUploadRef.current?.click()
  }
  const uploadFont = async (file: File) => {
    setFontMessage('폰트 업로드 중…')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('폰트를 읽지 못했습니다.'))
        reader.readAsDataURL(file)
      })
      const result = await studioFetchJson<{ url: string; format: SiteContent['theme']['customFontFormat']; name: string }>('/api/studio/upload-font', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, dataUrl }) })
      changeTheme({ customFontName: result.name, customFontUrl: result.url, customFontFormat: result.format })
      setFontMessage(`${file.name} 업로드 완료 · 디자인 저장을 눌러 확정하세요.`)
    } catch (error) {
      setFontMessage(error instanceof Error ? error.message : '폰트 업로드에 실패했습니다.')
    }
  }

  return (
    <section id="design" className="studio-site-settings design-studio-v2">
      <div className="studio-section-heading"><span>UI</span><div><h3>사이트 디자인</h3><p>페이지별로 나눠서 편집합니다. 전체 공통 설정(로고·폰트·색상·우주 배경)은 모든 페이지에 적용되고, 그 아래는 홈 → 마무리 선언 → 느낌으로 찾기 → 모든 밴드 순서로 각 페이지의 문구·그림만 모여 있습니다.</p></div></div>
      <p className="studio-upload-note" role="status" aria-live="polite">{imageMessage}</p>

      <div className="studio-design-columns">
        <div className="studio-design-controls">
          <p className="studio-page-group-heading">🌐 전체 공통 — 모든 페이지에 적용</p>
          <details><summary>맨 위 배너, ROCK ATLAS 뒤 문구</summary><div className="studio-form-grid">
            <label>ROCK ATLAS 뒤 문구<input value={value.brandSuffix} onChange={(event) => onChange({ brandSuffix: event.target.value })} /></label>
            <label className="studio-grid-span">배너 이미지 URL<input value={value.theme.bannerImageUrl} onChange={(event) => changeTheme({ bannerImageUrl: event.target.value })} placeholder="https:// 또는 ./uploads/..." /></label>
            <button className="studio-upload-button studio-grid-span" onClick={() => bannerUploadRef.current?.click()}><ImagePlus size={15} /> 배너 이미지 업로드 (가로형 권장)</button>
            <input ref={bannerUploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void uploadBanner(event.target.files[0])} />
            <p className="studio-upload-note studio-grid-span">헤더 배너를 바꾸면 페이지 맨 아래 푸터도 같은 이미지를 그대로 따라갑니다.</p>
          </div></details>

          <details><summary>헤더·푸터 문구</summary><div className="studio-form-grid">
            <label>헤더 워드마크 아래 태그라인<input value={value.headerTagline} onChange={(event) => onChange({ headerTagline: event.target.value })} placeholder="AMPLIFY YOUR TASTE" /></label>
            <label>푸터 태그라인<input value={value.footerTagline} onChange={(event) => onChange({ footerTagline: event.target.value })} placeholder="BETA ARCHIVE" /></label>
            <label>푸터 위치·연도 표기<input value={value.footerLocation} onChange={(event) => onChange({ footerLocation: event.target.value })} placeholder="SEOUL / 2026" /></label>
            <label className="studio-grid-span">푸터 설명 <small>"N개 밴드를 수록했습니다." 뒤에 이어서 표시됩니다.</small><textarea value={value.footerDescription} onChange={(event) => onChange({ footerDescription: event.target.value })} rows={2} /></label>
          </div></details>

          <details><summary>운영자에게 제안 버튼</summary><div className="studio-form-grid">
            <label>버튼 문구<input value={value.suggestionButtonLabel} onChange={(event) => onChange({ suggestionButtonLabel: event.target.value })} placeholder="추가/수정 제안" /></label>
            <label className="studio-grid-span">연결할 링크 <small>구글 폼, 이메일(mailto:...), 디스코드 초대 등. 비워두면 헤더에 버튼이 나타나지 않습니다.</small><input value={value.suggestionLinkUrl} onChange={(event) => onChange({ suggestionLinkUrl: event.target.value })} placeholder="https:// 또는 mailto:..." /></label>
          </div></details>

          <details open><summary>폰트와 색상</summary><div className="studio-form-grid">
            <label>폰트 프리셋<select value={value.theme.fontPreset} onChange={(event) => changeTheme({ fontPreset: event.target.value as SiteContent['theme']['fontPreset'] })}><option value="modern">모던 산세리프 (Pretendard)</option><option value="classic">클래식 세리프 (Georgia)</option><option value="editorial">에디토리얼 콘덴스드</option><option value="impact">임팩트 헤드라인 (Black Han Sans)</option></select></label>
            <label>업로드 폰트 적용 범위<select value={value.theme.customFontTarget} onChange={(event) => changeTheme({ customFontTarget: event.target.value as SiteContent['theme']['customFontTarget'] })} disabled={!value.theme.customFontUrl}><option value="all">본문과 제목 모두</option><option value="body">본문만</option><option value="heading">제목만</option></select></label>
            <label className="studio-grid-span">업로드 폰트 이름<input value={value.theme.customFontName} onChange={(event) => changeTheme({ customFontName: event.target.value })} placeholder="파일을 올리면 자동 입력됩니다." /></label>
            <button className="studio-upload-button studio-grid-span" onClick={() => fontUploadRef.current?.click()}><FileUp size={15} /> WOFF2·WOFF·TTF·OTF 폰트 업로드</button>
            <input ref={fontUploadRef} hidden type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={(event) => event.target.files?.[0] && void uploadFont(event.target.files[0])} />
            <p className="studio-upload-note studio-grid-span">{fontMessage}{value.theme.customFontUrl && <> · <button onClick={() => changeTheme({ customFontName: '', customFontUrl: '', customFontFormat: '' })}>업로드 폰트 해제</button></>}</p>
            <label>본문 굵기<select value={value.theme.bodyWeight} onChange={(event) => changeTheme({ bodyWeight: Number(event.target.value) as SiteContent['theme']['bodyWeight'] })}><option value={400}>보통 400</option><option value={500}>중간 500</option><option value={600}>약간 굵게 600</option><option value={700}>굵게 700</option></select></label>
            <label>본문 모양<select value={value.theme.bodyItalic ? 'italic' : 'normal'} onChange={(event) => changeTheme({ bodyItalic: event.target.value === 'italic' })}><option value="normal">일반</option><option value="italic">이탤릭</option></select></label>
            <label>제목 굵기<select value={value.theme.headingWeight} onChange={(event) => changeTheme({ headingWeight: Number(event.target.value) as 700 | 800 | 900 })}><option value={700}>보통</option><option value={800}>굵게</option><option value={900}>매우 굵게</option></select></label>
            <label>제목 모양<select value={value.theme.headingItalic ? 'italic' : 'normal'} onChange={(event) => changeTheme({ headingItalic: event.target.value === 'italic' })}><option value="normal">일반</option><option value="italic">이탤릭</option></select></label>
            <label>전체 글자 배율 <small>{Math.round(value.theme.baseFontScale * 100)}%</small><input type="range" min="0.85" max="1.2" step="0.05" value={value.theme.baseFontScale} onChange={(event) => changeTheme({ baseFontScale: Number(event.target.value) })} /></label>
            <label>배경색<input type="color" value={value.theme.backgroundColor} onChange={(event) => changeTheme({ backgroundColor: event.target.value })} /></label>
            <label>밝은 면·글자색<input type="color" value={value.theme.surfaceColor} onChange={(event) => changeTheme({ surfaceColor: event.target.value })} /></label>
            <label>강조색<input type="color" value={value.theme.accentColor} onChange={(event) => changeTheme({ accentColor: event.target.value })} /></label>
            <label>보조 글자색<input type="color" value={value.theme.mutedColor} onChange={(event) => changeTheme({ mutedColor: event.target.value })} /></label>
          </div></details>

          <details open><summary><Orbit size={14} /> 우주 항해 테마</summary><div className="studio-form-grid">
            <label>우주 표현<select value={value.theme.cosmicMode} onChange={(event) => changeTheme({ cosmicMode: event.target.value as SiteContent['theme']['cosmicMode'] })}><option value="off">사용하지 않음</option><option value="subtle">은은하게 · 권장</option><option value="deep">선명하게</option></select></label>
            <label>우주 보조색<input type="color" value={value.theme.cosmicColor} onChange={(event) => changeTheme({ cosmicColor: event.target.value })} /></label>
            <label>별 밀도 <small>{value.theme.starDensity}/5</small><input type="range" min="1" max="5" step="1" value={value.theme.starDensity} onChange={(event) => changeTheme({ starDensity: Number(event.target.value) })} /></label>
            <label>성운 강도 <small>{Math.round(value.theme.nebulaIntensity * 100)}%</small><input type="range" min="0" max="0.8" step="0.05" value={value.theme.nebulaIntensity} onChange={(event) => changeTheme({ nebulaIntensity: Number(event.target.value) })} /></label>
            <label>움직임 강도 <small>{Math.round(value.theme.motionIntensity * 100)}%</small><input type="range" min="0" max="1" step="0.05" value={value.theme.motionIntensity} onChange={(event) => changeTheme({ motionIntensity: Number(event.target.value) })} /></label>
            <label>배경 이미지 투명도 <small>{Math.round(value.theme.cosmicBackgroundOpacity * 100)}%</small><input type="range" min="0" max="0.65" step="0.05" value={value.theme.cosmicBackgroundOpacity} onChange={(event) => changeTheme({ cosmicBackgroundOpacity: Number(event.target.value) })} /></label>
            <label>배경 이미지 위치<select value={value.theme.cosmicBackgroundPosition} onChange={(event) => changeTheme({ cosmicBackgroundPosition: event.target.value as SiteContent['theme']['cosmicBackgroundPosition'] })}><option value="top">위</option><option value="center">가운데</option><option value="bottom">아래</option></select></label>
            <label className="studio-grid-span">선택 배경 이미지 URL<input value={value.theme.cosmicBackgroundUrl} onChange={(event) => changeTheme({ cosmicBackgroundUrl: event.target.value })} placeholder="비워도 CSS 별과 성운이 표시됩니다." /></label>
            <button className="studio-upload-button studio-grid-span" onClick={() => cosmicUploadRef.current?.click()}><Sparkles size={15} /> 은하수·성운 배경 이미지 업로드</button>
            <input ref={cosmicUploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void uploadCosmicBackground(event.target.files[0])} />
            <p className="studio-upload-note studio-grid-span">배경 이미지는 선택 사항입니다. 업로드하지 않아도 가벼운 CSS 별과 궤도선이 표시됩니다. 움직임은 사용자의 모션 줄이기 설정에서 자동으로 꺼집니다.</p>
          </div></details>

          <p className="studio-page-group-heading">🏠 홈 화면</p>
          <details><summary>첫 화면·장르 구역 문구</summary><div className="studio-form-grid">
            <label className="studio-grid-span">중앙 제목 <small>줄바꿈은 엔터로 구분합니다.</small><textarea value={value.heroTitle} onChange={(event) => onChange({ heroTitle: event.target.value })} rows={3} /></label>
            <label className="studio-grid-span">부가설명 <small>비우면 숨깁니다.</small><textarea value={value.heroDescription} onChange={(event) => onChange({ heroDescription: event.target.value })} rows={3} /></label>
            <label>장르 구역 표기<input value={value.genreSectionLabel} onChange={(event) => onChange({ genreSectionLabel: event.target.value })} /></label>
            <label>장르 구역 제목<input value={value.genreSectionTitle} onChange={(event) => onChange({ genreSectionTitle: event.target.value })} /></label>
            <label className="studio-grid-span">장르 구역 설명<textarea value={value.genreSectionDescription} onChange={(event) => onChange({ genreSectionDescription: event.target.value })} rows={3} /></label>
          </div></details>

          <details open><summary>장르 카드 배치</summary><div className="studio-form-grid">
            <label>카드 표현<select value={value.theme.genreCardStyle} onChange={(event) => changeTheme({ genreCardStyle: event.target.value as SiteContent['theme']['genreCardStyle'] })}><option value="record">이미지 위 글자 · 권장</option><option value="minimal">미니멀 · 삽화 약하게</option></select></label>
            <label>PC 열 수<select value={value.theme.genreCardColumns} onChange={(event) => changeTheme({ genreCardColumns: Number(event.target.value) as 3 | 4 })}><option value={3}>3열 · 권장</option><option value={4}>4열 · 더 촘촘하게</option></select></label>
            <label className="studio-grid-span">카드 사이 간격 <small>{value.theme.genreCardGap}px</small><input type="range" min="12" max="40" step="2" value={value.theme.genreCardGap} onChange={(event) => changeTheme({ genreCardGap: Number(event.target.value) })} /></label>
          </div></details>

          <details><summary>히어로 그림</summary><div className="studio-form-grid">
            <label>표시 방식<select value={value.theme.heroArtMode} onChange={(event) => changeTheme({ heroArtMode: event.target.value as SiteContent['theme']['heroArtMode'] })}><option value="vinyl">기본 레코드 그래픽</option><option value="image">업로드 이미지</option><option value="none">그림 숨김</option></select></label>
            <label className="studio-grid-span">이미지 URL<input value={value.theme.heroImageUrl} onChange={(event) => changeTheme({ heroImageUrl: event.target.value })} placeholder="https:// 또는 ./uploads/..." /></label>
            {value.theme.heroArtMode === 'image' && <ImagePositionPicker imageUrl={value.theme.heroImageUrl} desktopValue={value.theme.heroImagePosition} mobileValue={value.theme.heroImagePositionMobile} desktopAspect={16 / 9} mobileAspect={375 / 650} onChange={(patch) => changeTheme({ ...(patch.imagePosition !== undefined && { heroImagePosition: patch.imagePosition }), ...('imagePositionMobile' in patch && { heroImagePositionMobile: patch.imagePositionMobile }) })} />}
            <button className="studio-upload-button studio-grid-span" onClick={() => uploadRef.current?.click()}><ImagePlus size={15} /> PNG·JPG·WebP 업로드</button>
            <input ref={uploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void uploadHero(event.target.files[0])} />
          </div></details>

          <details><summary>홈 화면 구역 표시와 순서</summary><div className="studio-section-order">
            {value.sectionOrder.map((id, index) => <div key={id}><label><input type="checkbox" checked={value.sectionVisibility[id]} onChange={(event) => onChange({ sectionVisibility: { ...value.sectionVisibility, [id]: event.target.checked } })} />{sectionNames[id]}</label><span><button onClick={() => moveSection(id, -1)} disabled={index === 0} aria-label={`${sectionNames[id]} 위로`}><ArrowUp size={13} /></button><button onClick={() => moveSection(id, 1)} disabled={index === value.sectionOrder.length - 1} aria-label={`${sectionNames[id]} 아래로`}><ArrowDown size={13} /></button></span></div>)}
          </div></details>

          <p className="studio-page-group-heading">📢 마무리 선언 페이지</p>
          <details><summary>문구와 배경</summary><div className="studio-form-grid">
            <label>표기<input value={value.manifestoLabel} onChange={(event) => onChange({ manifestoLabel: event.target.value })} /></label>
            <label>버튼 문구<input value={value.manifestoButtonLabel} onChange={(event) => onChange({ manifestoButtonLabel: event.target.value })} /></label>
            <label className="studio-grid-span">제목 <small>줄바꿈은 엔터로 구분합니다.</small><textarea value={value.manifestoTitle} onChange={(event) => onChange({ manifestoTitle: event.target.value })} rows={3} /></label>
            <label>배경 표시 방식<select value={value.theme.manifestoBackgroundMode} onChange={(event) => changeTheme({ manifestoBackgroundMode: event.target.value as SiteContent['theme']['manifestoBackgroundMode'] })}><option value="accent">강조색 단색 · 기본</option><option value="image">업로드 이미지</option></select></label>
            {value.theme.manifestoBackgroundMode === 'image' && <>
              <label className="studio-grid-span">이미지 URL<input value={value.theme.manifestoImageUrl} onChange={(event) => changeTheme({ manifestoImageUrl: event.target.value })} placeholder="https:// 또는 ./uploads/..." /></label>
              <ImagePositionPicker imageUrl={value.theme.manifestoImageUrl} desktopValue={value.theme.manifestoImagePosition} mobileValue={value.theme.manifestoImagePositionMobile} desktopAspect={21 / 9} mobileAspect={375 / 430} onChange={(patch) => changeTheme({ ...(patch.imagePosition !== undefined && { manifestoImagePosition: patch.imagePosition }), ...('imagePositionMobile' in patch && { manifestoImagePositionMobile: patch.imagePositionMobile }) })} />
              <button className="studio-upload-button studio-grid-span" onClick={() => manifestoUploadRef.current?.click()}><ImagePlus size={15} /> 배경 이미지 업로드</button>
              <input ref={manifestoUploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void uploadManifestoBackground(event.target.files[0])} />
              <label className="studio-grid-span">어둡게 덮기 <small>{Math.round(value.theme.manifestoOverlayOpacity * 100)}% · 글자 가독성용</small><input type="range" min="0" max="0.85" step="0.05" value={value.theme.manifestoOverlayOpacity} onChange={(event) => changeTheme({ manifestoOverlayOpacity: Number(event.target.value) })} /></label>
            </>}
          </div></details>

          <p className="studio-page-group-heading">🎧 느낌으로 찾기 페이지</p>
          <details><summary>문구</summary><div className="studio-form-grid">
            <label>구역 표기<input value={value.moodSectionLabel} onChange={(event) => onChange({ moodSectionLabel: event.target.value })} /></label>
            <label>제목<input value={value.moodSectionTitle} onChange={(event) => onChange({ moodSectionTitle: event.target.value })} /></label>
            <label className="studio-grid-span">설명<textarea value={value.moodSectionDescription} onChange={(event) => onChange({ moodSectionDescription: event.target.value })} rows={2} /></label>
          </div></details>

          <p className="studio-page-group-heading">📀 모든 밴드 페이지</p>
          <details><summary>문구</summary><div className="studio-form-grid">
            <label>구역 표기<input value={value.allBandsSectionLabel} onChange={(event) => onChange({ allBandsSectionLabel: event.target.value })} /></label>
            <label>제목<input value={value.allBandsSectionTitle} onChange={(event) => onChange({ allBandsSectionTitle: event.target.value })} /></label>
            <label className="studio-grid-span">설명 <small>실제 밴드 수 뒤에 "N개의 출발점을 (이 설명)" 형태로 이어서 표시됩니다.</small><textarea value={value.allBandsSectionDescription} onChange={(event) => onChange({ allBandsSectionDescription: event.target.value })} rows={2} /></label>
          </div></details>

          <p className="studio-page-group-heading">🧭 밴드 상세 — 히치하이킹·연결</p>
          <details><summary>히치하이킹 문구</summary><div className="studio-form-grid">
            <label>구역 표기<input value={value.bandDetailCopy.hitchhikingEyebrow} onChange={(event) => changeBandDetailCopy({ hitchhikingEyebrow: event.target.value })} /></label>
            <label>제목<input value={value.bandDetailCopy.hitchhikingTitle} onChange={(event) => changeBandDetailCopy({ hitchhikingTitle: event.target.value })} /></label>
            <label className="studio-grid-span">설명<textarea value={value.bandDetailCopy.hitchhikingDescription} onChange={(event) => changeBandDetailCopy({ hitchhikingDescription: event.target.value })} rows={2} /></label>
            <label>다른 후보 버튼 문구<input value={value.bandDetailCopy.hitchhikingOtherCandidatesLabel} onChange={(event) => changeBandDetailCopy({ hitchhikingOtherCandidatesLabel: event.target.value })} /></label>
            <label>이동 버튼 문구<input value={value.bandDetailCopy.hitchhikingMoveLabel} onChange={(event) => changeBandDetailCopy({ hitchhikingMoveLabel: event.target.value })} /></label>
            <label>여행 경로 표기<input value={value.bandDetailCopy.hitchhikingJourneyLabel} onChange={(event) => changeBandDetailCopy({ hitchhikingJourneyLabel: event.target.value })} /></label>
            <label className="studio-grid-span">여행 경로 설명<input value={value.bandDetailCopy.hitchhikingJourneyHint} onChange={(event) => changeBandDetailCopy({ hitchhikingJourneyHint: event.target.value })} /></label>
            <label>공유 버튼 문구<input value={value.bandDetailCopy.hitchhikingShareLabel} onChange={(event) => changeBandDetailCopy({ hitchhikingShareLabel: event.target.value })} /></label>
            <label>다시 시작 버튼 문구<input value={value.bandDetailCopy.hitchhikingRestartLabel} onChange={(event) => changeBandDetailCopy({ hitchhikingRestartLabel: event.target.value })} /></label>
          </div></details>

          <details><summary>히치하이킹 방향 9개 문구</summary><div className="studio-genre-editor-grid">
            {HITCHHIKING_DIRECTIONS.map((direction) => {
              const current = value.bandDetailCopy.hitchhikingDirections[direction.id] ?? direction
              return <details key={direction.id}><summary>{direction.label}</summary><div>
                <label>방향 버튼 문구<input value={current.label} onChange={(event) => updateDirectionCopy(direction.id, { label: event.target.value })} /></label>
                <label className="studio-grid-span">방향 버튼 설명<input value={current.description} onChange={(event) => updateDirectionCopy(direction.id, { description: event.target.value })} /></label>
                <label className="studio-grid-span">선택 후 결과 문구<input value={current.resultLabel} onChange={(event) => updateDirectionCopy(direction.id, { resultLabel: event.target.value })} /></label>
              </div></details>
            })}
          </div></details>

          <details><summary>편집된 계보와 장면(에디토리얼 커넥션) 문구</summary><div className="studio-form-grid">
            <label>구역 표기<input value={value.bandDetailCopy.relationEyebrow} onChange={(event) => changeBandDetailCopy({ relationEyebrow: event.target.value })} /></label>
            <label>제목<input value={value.bandDetailCopy.relationTitle} onChange={(event) => changeBandDetailCopy({ relationTitle: event.target.value })} /></label>
            <label className="studio-grid-span">설명<textarea value={value.bandDetailCopy.relationDescription} onChange={(event) => changeBandDetailCopy({ relationDescription: event.target.value })} rows={2} /></label>
            <label className="studio-grid-span">검수된 연결이 없을 때 표시할 문구<textarea value={value.bandDetailCopy.relationEmptyMessage} onChange={(event) => changeBandDetailCopy({ relationEmptyMessage: event.target.value })} rows={2} /></label>
          </div></details>
        </div>

        <div className={`studio-live-preview-frame is-${previewMode}`}>
          <div className="studio-preview-toolbar"><span>실시간 미리보기 · 실제 화면과 동일합니다</span><button className={previewMode === 'desktop' ? 'is-active' : ''} onClick={() => setPreviewMode('desktop')} aria-label="PC 미리보기"><Monitor size={14} /></button><button className={previewMode === 'mobile' ? 'is-active' : ''} onClick={() => setPreviewMode('mobile')} aria-label="모바일 미리보기"><Smartphone size={14} /></button></div>
          <div className="studio-live-preview-viewport">
            <iframe ref={previewIframeRef} className="studio-live-preview-iframe" src="./?livePreview=1" title="실시간 미리보기" onLoad={sendPreviewState} />
          </div>
        </div>
      </div>

      <div className="studio-site-actions"><span className={dirty ? 'is-dirty' : ''}>{message}</span><a href="./" target="_blank" rel="noreferrer"><ExternalLink size={14} /> 실제 화면</a><button onClick={() => void onSave()}><Save size={15} /> 디자인 저장</button></div>

      <p className="studio-page-group-heading">🏠 홈 화면 — 13개 장르 카드</p>
      <details className="studio-genre-editor" open><summary>13개 장르 카드 문구와 삽화</summary><div className="studio-genre-editor-grid">
        {genres.map((genre, index) => {
          const visual = value.genreVisuals[genre.id]
          return <details key={genre.id}><summary><span style={{ background: genre.color }} />{String(index + 1).padStart(2, '0')} · {genre.name}</summary><div>
          <div className="studio-genre-order-actions studio-grid-span"><button onClick={() => moveGenre(genre.id, -1)} disabled={index === 0}><ArrowUp size={12} /> 위로</button><button onClick={() => moveGenre(genre.id, 1)} disabled={index === genres.length - 1}><ArrowDown size={12} /> 아래로</button></div>
          <label>정식 한국어 이름<input value={genre.name} onChange={(event) => updateGenre(genre.id, { name: event.target.value })} /></label>
          <label>색상<input type="color" value={genre.color} onChange={(event) => updateGenre(genre.id, { color: event.target.value, accent: colorToAccent(event.target.value) })} /></label>
          <label className="studio-grid-span">카드 표시 이름 <small>화면 너비에 맞춰 자연스럽게 줄바꿈됩니다.</small><textarea value={genre.displayName} onChange={(event) => updateGenre(genre.id, { displayName: event.target.value })} rows={2} /></label>
          <label className="studio-grid-span">영문 이름<textarea value={genre.englishName} onChange={(event) => updateGenre(genre.id, { englishName: event.target.value })} rows={2} /></label>
          <label className="studio-grid-span">한 줄 분위기 설명<textarea value={genre.vibeDescription} onChange={(event) => updateGenre(genre.id, { vibeDescription: event.target.value })} rows={3} /></label>
          <label>삽화 표시<select value={visual.artMode} onChange={(event) => updateGenreVisual(genre.id, { artMode: event.target.value as typeof visual.artMode })}><option value="image">이미지 표시</option><option value="none">이미지 숨김</option></select></label>
          <label className="studio-grid-span">삽화 URL<input value={visual.imageUrl} onChange={(event) => updateGenreVisual(genre.id, { imageUrl: event.target.value })} /></label>
          {visual.artMode === 'image' && <ImagePositionPicker imageUrl={visual.imageUrl} desktopValue={visual.imagePosition} mobileValue={visual.imagePositionMobile} scale={visual.imageScale} opacity={visual.imageOpacity} onChange={(patch) => updateGenreVisual(genre.id, patch)} />}
          <label>삽화 투명도 <small>{Math.round(visual.imageOpacity * 100)}%</small><input type="range" min="0.2" max="1" step="0.05" value={visual.imageOpacity} onChange={(event) => updateGenreVisual(genre.id, { imageOpacity: Number(event.target.value) })} /></label>
          <label>삽화 확대 <small>{Math.round(visual.imageScale * 100)}%</small><input type="range" min="0.8" max="1.5" step="0.05" value={visual.imageScale} onChange={(event) => updateGenreVisual(genre.id, { imageScale: Number(event.target.value) })} /></label>
          <button className="studio-upload-button studio-grid-span" onClick={() => pickGenreArt(genre.id)}><ImagePlus size={14} /> 이 장르의 삽화 교체</button>
          {visual.artMode === 'image' && visual.imageUrl && <div className="studio-genre-art-preview studio-grid-span" style={{ '--genre-preview-color': genre.color } as React.CSSProperties}><img src={visual.imageUrl} alt="" style={{ objectPosition: visual.imagePosition, opacity: visual.imageOpacity, transform: `scale(${visual.imageScale})` }} /><strong>{genre.displayName}</strong></div>}
          <label className="studio-grid-span">설명<textarea value={genre.description} onChange={(event) => updateGenre(genre.id, { description: event.target.value })} rows={3} /></label>
          <p className="studio-upload-note studio-grid-span">세부 장르 {genre.subgenreIds.length}개 · 빠른 분위기 {genre.quickMoodIds.length}개 · 고유 ID는 데이터 연결 보호를 위해 잠겨 있습니다.</p>
        </div></details>
        })}
      </div></details>
      <input ref={genreUploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0]
        const id = genreUploadTarget.current
        if (file && id) void uploadGenreArt(file, id)
        event.target.value = ''
      }} />

      {(() => {
        const renderExplorerVisual = (id: ExplorerVisualKey, label: string, color: string) => {
          const visual = value.explorerVisuals[id]
          return <details key={id} open><summary><span style={{ background: color }} />{label} 히어로 삽화</summary><div>
            <label>삽화 표시<select value={visual.artMode} onChange={(event) => updateExplorerVisual(id, { artMode: event.target.value as typeof visual.artMode })}><option value="image">이미지 표시</option><option value="none">이미지 숨김</option></select></label>
            <label className="studio-grid-span">삽화 URL<input value={visual.imageUrl} onChange={(event) => updateExplorerVisual(id, { imageUrl: event.target.value })} /></label>
            {visual.artMode === 'image' && <ImagePositionPicker imageUrl={visual.imageUrl} desktopValue={visual.imagePosition} mobileValue={visual.imagePositionMobile} scale={visual.imageScale} opacity={visual.imageOpacity} onChange={(patch) => updateExplorerVisual(id, patch)} />}
            <label>삽화 투명도 <small>{Math.round(visual.imageOpacity * 100)}%</small><input type="range" min="0.2" max="1" step="0.05" value={visual.imageOpacity} onChange={(event) => updateExplorerVisual(id, { imageOpacity: Number(event.target.value) })} /></label>
            <label>삽화 확대 <small>{Math.round(visual.imageScale * 100)}%</small><input type="range" min="0.8" max="1.5" step="0.05" value={visual.imageScale} onChange={(event) => updateExplorerVisual(id, { imageScale: Number(event.target.value) })} /></label>
            <button className="studio-upload-button studio-grid-span" onClick={() => pickExplorerArt(id)}><ImagePlus size={14} /> 이 탐색 카드의 삽화 교체</button>
            {visual.artMode === 'image' && visual.imageUrl && <div className="studio-genre-art-preview studio-grid-span" style={{ '--genre-preview-color': color } as React.CSSProperties}><img src={visual.imageUrl} alt="" style={{ objectPosition: visual.imagePosition, opacity: visual.imageOpacity, transform: `scale(${visual.imageScale})` }} /><strong>{label}</strong></div>}
          </div></details>
        }
        return <>
          <p className="studio-page-group-heading">📀 모든 밴드 페이지</p>
          <details className="studio-genre-editor" open><summary>모든 밴드 페이지 삽화</summary><div className="studio-genre-editor-grid">
            {renderExplorerVisual('allBands', '모든 밴드 보기', '#7d72bf')}
          </div></details>

          <p className="studio-page-group-heading">🎧 느낌으로 찾기 페이지 — 히어로 삽화·24개 분위기 카드</p>
          <details className="studio-genre-editor" open><summary>느낌으로 찾기 페이지 삽화</summary><div className="studio-genre-editor-grid">
            {renderExplorerVisual('moods', '느낌으로 찾기', '#e86335')}
          </div></details>
        </>
      })()}
      <input ref={explorerUploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0]
        const id = explorerUploadTarget.current
        if (file && id) void uploadExplorerArt(file, id)
        event.target.value = ''
      }} />

      <details className="studio-genre-editor"><summary>24개 분위기 카드 편집</summary><div className="studio-genre-editor-grid">
        {moods.map((mood) => <details key={mood.id}><summary>{String(mood.order).padStart(2, '0')} · {mood.name}</summary><div>
          <label>그룹<input value={moodGroupNames[mood.groupId]} readOnly /></label>
          <label>카드 이름<input value={mood.name} onChange={(event) => updateMood(mood.id, { name: event.target.value })} /></label>
          <label className="studio-grid-span">카드 설명<textarea value={mood.description} onChange={(event) => updateMood(mood.id, { description: event.target.value })} rows={3} /></label>
          <p className="studio-upload-note studio-grid-span">고유 ID와 그룹은 기존 밴드 점수 연결을 보호하기 위해 잠겨 있습니다.</p>
        </div></details>)}
      </div></details>
      <div className="studio-site-actions"><span className={genresDirty ? 'is-dirty' : ''}>{genreMessage}</span><button onClick={() => void onSaveGenres()}><Save size={15} /> 장르·분위기 카드 저장</button></div>
    </section>
  )
}
