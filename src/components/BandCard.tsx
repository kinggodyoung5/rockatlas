import { ArrowUpRight, Heart, MapPin } from 'lucide-react'
import { genreById } from '../data/genres'
import type { Band } from '../types/music'
import { BandImage } from './BandImage'

interface BandCardProps {
  band: Band
  index: number
  onSelect: (band: Band) => void
  isFavorite: boolean
  onToggleFavorite: (bandId: string) => void
}

export function BandCard({ band, index, onSelect, isFavorite, onToggleFavorite }: BandCardProps) {
  const genre = genreById[band.primaryGenre]

  return (
    <article className="band-card group" style={{ '--genre-color': genre.color } as React.CSSProperties}>
      <button className="band-card-hit" onClick={() => onSelect(band)} aria-label={`${band.name} 상세 보기`}>
        <div className="band-card-media">
          <BandImage band={band} />
          <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="card-year">EST. {band.formed}</span>
        </div>
        <div className="band-card-body">
          <div className="card-kicker">
            <span style={{ color: genre.color }}>{genre.englishName}</span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </div>
          <span className="card-subgenres">{band.subgenres.slice(0, 2).join(' · ')}</span>
          <h3>{band.name}</h3>
          <p>{band.summary}</p>
          <div className="card-origin"><MapPin size={14} aria-hidden="true" />{band.origin}</div>
        </div>
      </button>
      <button
        className={`favorite-button card-favorite ${isFavorite ? 'is-active' : ''}`}
        onClick={() => onToggleFavorite(band.id)}
        aria-label={isFavorite ? `${band.name} 저장 취소` : `${band.name} 저장`}
        aria-pressed={isFavorite}
      >
        <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
