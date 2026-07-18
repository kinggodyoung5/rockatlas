import { ArrowDown, ArrowUp, ExternalLink, FileUp, ImagePlus, Monitor, Save, Smartphone } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Genre } from '../types/music'
import type { SiteContent, SiteSectionId } from '../data/siteContent'

interface DesignStudioPanelProps {
  value: SiteContent
  dirty: boolean
  message: string
  genres: Genre[]
  genresDirty: boolean
  genreMessage: string
  onChange: (patch: Partial<SiteContent>) => void
  onGenresChange: (genres: Genre[]) => void
  onSave: () => Promise<void>
  onSaveGenres: () => Promise<void>
}

const sectionNames: Record<SiteSectionId, string> = { genres: '장르 탐색', bands: '밴드 목록', manifesto: '마무리 선언' }

function colorToAccent(hex: string) {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '128 128 128'
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)).join(' ')
}

export function DesignStudioPanel({ value, dirty, message, genres, genresDirty, genreMessage, onChange, onGenresChange, onSave, onSaveGenres }: DesignStudioPanelProps) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [fontMessage, setFontMessage] = useState('WOFF2 권장 · WOFF, TTF, OTF 지원 · 최대 9MB')
  const uploadRef = useRef<HTMLInputElement>(null)
  const fontUploadRef = useRef<HTMLInputElement>(null)
  const changeTheme = (patch: Partial<SiteContent['theme']>) => onChange({ theme: { ...value.theme, ...patch } })
  const moveSection = (id: SiteSectionId, direction: -1 | 1) => {
    const order = [...value.sectionOrder]
    const index = order.indexOf(id)
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= order.length) return
    ;[order[index], order[nextIndex]] = [order[nextIndex], order[index]]
    onChange({ sectionOrder: order })
  }
  const updateGenre = (id: Genre['id'], patch: Partial<Genre>) => onGenresChange(genres.map((genre) => genre.id === id ? { ...genre, ...patch } : genre))
  const moveGenre = (id: Genre['id'], direction: -1 | 1) => {
    const next = [...genres]
    const index = next.findIndex((genre) => genre.id === id)
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onGenresChange(next)
  }
  const uploadHero = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
      reader.readAsDataURL(file)
    })
    const response = await fetch('/api/studio/upload', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) })
    if (!response.ok) throw new Error(await response.text())
    const result = await response.json() as { url: string }
    changeTheme({ heroImageUrl: result.url, heroArtMode: 'image' })
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
      const response = await fetch('/api/studio/upload-font', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, dataUrl }) })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json() as { url: string; format: SiteContent['theme']['customFontFormat']; name: string }
      changeTheme({ customFontName: result.name, customFontUrl: result.url, customFontFormat: result.format })
      setFontMessage(`${file.name} 업로드 완료 · 디자인 저장을 눌러 확정하세요.`)
    } catch (error) {
      setFontMessage(error instanceof Error ? error.message : '폰트 업로드에 실패했습니다.')
    }
  }

  return (
    <section id="design" className="studio-site-settings design-studio-v2">
      <div className="studio-section-heading"><span>UI</span><div><h3>디자인 Studio 2</h3><p>문구, 폰트, 색상, 히어로 이미지, 섹션과 장르 카드를 운영자가 직접 관리합니다.</p></div></div>

      <div className="studio-design-columns">
        <div className="studio-design-controls">
          <details open><summary>브랜드와 첫 화면 문구</summary><div className="studio-form-grid">
            <label>ROCK ATLAS 뒤 문구<input value={value.brandSuffix} onChange={(event) => onChange({ brandSuffix: event.target.value })} /></label>
            <label>중앙 제목<input value={value.heroTitle} onChange={(event) => onChange({ heroTitle: event.target.value })} /></label>
            <label className="studio-grid-span">부가설명 <small>비우면 숨깁니다.</small><textarea value={value.heroDescription} onChange={(event) => onChange({ heroDescription: event.target.value })} rows={3} /></label>
            <label>장르 구역 표기<input value={value.genreSectionLabel} onChange={(event) => onChange({ genreSectionLabel: event.target.value })} /></label>
            <label>장르 구역 제목<input value={value.genreSectionTitle} onChange={(event) => onChange({ genreSectionTitle: event.target.value })} /></label>
            <label className="studio-grid-span">장르 구역 설명<textarea value={value.genreSectionDescription} onChange={(event) => onChange({ genreSectionDescription: event.target.value })} rows={3} /></label>
          </div></details>

          <details open><summary>폰트와 색상</summary><div className="studio-form-grid">
            <label>폰트 프리셋<select value={value.theme.fontPreset} onChange={(event) => changeTheme({ fontPreset: event.target.value as SiteContent['theme']['fontPreset'] })}><option value="modern">모던 산세리프</option><option value="classic">클래식 세리프</option><option value="editorial">에디토리얼 콘덴스드</option></select></label>
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

          <details><summary>히어로 그림</summary><div className="studio-form-grid">
            <label>표시 방식<select value={value.theme.heroArtMode} onChange={(event) => changeTheme({ heroArtMode: event.target.value as SiteContent['theme']['heroArtMode'] })}><option value="vinyl">기본 레코드 그래픽</option><option value="image">업로드 이미지</option><option value="none">그림 숨김</option></select></label>
            <label>이미지 위치<select value={value.theme.heroImagePosition} onChange={(event) => changeTheme({ heroImagePosition: event.target.value as SiteContent['theme']['heroImagePosition'] })}><option value="center">가운데</option><option value="top">위</option><option value="bottom">아래</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></label>
            <label className="studio-grid-span">이미지 URL<input value={value.theme.heroImageUrl} onChange={(event) => changeTheme({ heroImageUrl: event.target.value })} placeholder="https:// 또는 ./uploads/..." /></label>
            <button className="studio-upload-button studio-grid-span" onClick={() => uploadRef.current?.click()}><ImagePlus size={15} /> PNG·JPG·WebP 업로드</button>
            <input ref={uploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void uploadHero(event.target.files[0])} />
          </div></details>

          <details><summary>섹션 표시와 순서</summary><div className="studio-section-order">
            {value.sectionOrder.map((id, index) => <div key={id}><label><input type="checkbox" checked={value.sectionVisibility[id]} onChange={(event) => onChange({ sectionVisibility: { ...value.sectionVisibility, [id]: event.target.checked } })} />{sectionNames[id]}</label><span><button onClick={() => moveSection(id, -1)} disabled={index === 0} aria-label={`${sectionNames[id]} 위로`}><ArrowUp size={13} /></button><button onClick={() => moveSection(id, 1)} disabled={index === value.sectionOrder.length - 1} aria-label={`${sectionNames[id]} 아래로`}><ArrowDown size={13} /></button></span></div>)}
          </div></details>
        </div>

        <div className={`studio-live-preview is-${previewMode}`} style={{ '--preview-bg': value.theme.backgroundColor, '--preview-paper': value.theme.surfaceColor, '--preview-accent': value.theme.accentColor } as React.CSSProperties}>
          {value.theme.customFontUrl && <style>{`@font-face{font-family:RockAtlasCustom;src:url("${value.theme.customFontUrl}") format("${value.theme.customFontFormat}");font-display:swap;font-weight:100 900;font-style:normal;}`}</style>}
          <div className="studio-preview-toolbar"><span>실시간 미리보기</span><button className={previewMode === 'desktop' ? 'is-active' : ''} onClick={() => setPreviewMode('desktop')} aria-label="PC 미리보기"><Monitor size={14} /></button><button className={previewMode === 'mobile' ? 'is-active' : ''} onClick={() => setPreviewMode('mobile')} aria-label="모바일 미리보기"><Smartphone size={14} /></button></div>
          <div className={`studio-preview-canvas font-${value.theme.fontPreset}`} style={{ fontSize: `${value.theme.baseFontScale}em`, fontFamily: value.theme.customFontUrl && value.theme.customFontTarget !== 'heading' ? 'RockAtlasCustom' : undefined, fontWeight: value.theme.bodyWeight, fontStyle: value.theme.bodyItalic ? 'italic' : 'normal' }}>
            <header><strong>ROCK ATLAS <i>{value.brandSuffix}</i></strong><small>GENRE · BANDS · STUDIO</small></header>
            <main><span>WESTERN ROCK DISCOVERY ARCHIVE</span><h4 style={{ fontWeight: value.theme.headingWeight, fontStyle: value.theme.headingItalic ? 'italic' : 'normal', fontFamily: value.theme.customFontUrl && value.theme.customFontTarget !== 'body' ? 'RockAtlasCustom' : undefined }}>{value.heroTitle}</h4>{value.heroDescription && <p>{value.heroDescription}</p>}<button>장르부터 탐색</button><div className={`preview-art mode-${value.theme.heroArtMode}`} style={value.theme.heroArtMode === 'image' ? { backgroundImage: `url(${value.theme.heroImageUrl})`, backgroundPosition: value.theme.heroImagePosition } : undefined} /></main>
            {value.sectionVisibility.genres && <footer><small>{value.genreSectionLabel}</small><strong>{value.genreSectionTitle}</strong><p>{value.genreSectionDescription}</p></footer>}
          </div>
        </div>
      </div>

      <div className="studio-site-actions"><span className={dirty ? 'is-dirty' : ''}>{message}</span><a href="./" target="_blank" rel="noreferrer"><ExternalLink size={14} /> 실제 화면</a><button onClick={() => void onSave()}><Save size={15} /> 디자인 저장</button></div>

      <details className="studio-genre-editor"><summary>9개 장르 카드 편집</summary><div className="studio-genre-editor-grid">
        {genres.map((genre, index) => <details key={genre.id}><summary><span style={{ background: genre.color }} />{String(index + 1).padStart(2, '0')} · {genre.name}</summary><div>
          <div className="studio-genre-order-actions studio-grid-span"><button onClick={() => moveGenre(genre.id, -1)} disabled={index === 0}><ArrowUp size={12} /> 위로</button><button onClick={() => moveGenre(genre.id, 1)} disabled={index === genres.length - 1}><ArrowDown size={12} /> 아래로</button></div>
          <label>한국어 이름<input value={genre.name} onChange={(event) => updateGenre(genre.id, { name: event.target.value })} /></label>
          <label>영문 이름<input value={genre.englishName} onChange={(event) => updateGenre(genre.id, { englishName: event.target.value })} /></label>
          <label>색상<input type="color" value={genre.color} onChange={(event) => updateGenre(genre.id, { color: event.target.value, accent: colorToAccent(event.target.value) })} /></label>
          <label>함께 보는 장르<input value={genre.foldedGenres.join(', ')} onChange={(event) => updateGenre(genre.id, { foldedGenres: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
          <label className="studio-grid-span">설명<textarea value={genre.description} onChange={(event) => updateGenre(genre.id, { description: event.target.value })} rows={3} /></label>
        </div></details>)}
      </div><div className="studio-site-actions"><span className={genresDirty ? 'is-dirty' : ''}>{genreMessage}</span><button onClick={() => void onSaveGenres()}><Save size={15} /> 장르 카드 저장</button></div></details>
    </section>
  )
}
