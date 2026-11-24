import { BookOpen } from 'lucide-react'
import type { Band } from '../types/music'
import type { TaxonomyGenre } from '../types/taxonomy'

interface GenreGuideProps {
  genre: TaxonomyGenre
  bands: Band[]
  onSelectBand: (band: Band) => void
  onGlossary: () => void
}

/** 장르 페이지의 "이 장르 이야기 / 여기서 시작하세요 / 핵심 음반" (plan P4-5). 채워진 항목만 보인다. */
export function GenreGuide({ genre, bands, onSelectBand, onGlossary }: GenreGuideProps) {
  const byId = new Map(bands.map((band) => [band.id, band]))
  const starters = (genre.starterBandIds ?? []).map((id) => byId.get(id)).filter((band): band is Band => Boolean(band))
  const keyAlbums = (genre.keyAlbums ?? []).filter((album) => byId.has(album.bandId))
  const paragraphs = (genre.history ?? '').split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean)
  if (!paragraphs.length && !starters.length && !keyAlbums.length) {
    return <div className="genre-guide shell genre-guide-empty"><button className="text-button" onClick={onGlossary}><BookOpen size={15} /> 세부장르 용어 사전</button></div>
  }
  return (
    <section className="genre-guide shell" aria-label={`${genre.displayName} 안내`}>
      {paragraphs.length > 0 && <details open>
        <summary>이 장르 이야기</summary>
        {paragraphs.map((text) => <p key={text.slice(0, 40)}>{text}</p>)}
        {(genre.sources ?? []).length > 0 && <small className="genre-guide-sources">출처: {genre.sources!.map((source, index) => <span key={source.url}>{index > 0 && ', '}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}</small>}
      </details>}
      {starters.length > 0 && <div className="genre-guide-block">
        <h2>여기서 시작하세요</h2>
        <ol className="genre-starters">{starters.map((band, index) => <li key={band.id}><button onClick={() => onSelectBand(band)}><em>{index + 1}</em><strong>{band.name}</strong><small>{band.formed}</small></button></li>)}</ol>
      </div>}
      {keyAlbums.length > 0 && <div className="genre-guide-block">
        <h2>핵심 음반</h2>
        <ul className="genre-key-albums">{keyAlbums.map((album) => <li key={`${album.bandId}-${album.title}`}><button onClick={() => onSelectBand(byId.get(album.bandId)!)}><strong>{album.title}</strong><small>{byId.get(album.bandId)!.name} · {album.year}</small></button><p>{album.note}</p></li>)}</ul>
      </div>}
      <button className="text-button" onClick={onGlossary}><BookOpen size={15} /> 세부장르 용어 사전</button>
    </section>
  )
}
