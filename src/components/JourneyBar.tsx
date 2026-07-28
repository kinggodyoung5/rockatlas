import { Clock3, Heart, RotateCcw } from 'lucide-react'
import { publicBandById as bandById } from '../data/publicBands'
import type { Band } from '../types/music'

interface JourneyBarProps {
  historyIds: string[]
  favoriteIds: string[]
  onSelect: (band: Band) => void
  onClearHistory: () => void
}

export function JourneyBar({ historyIds, favoriteIds, onSelect, onClearHistory }: JourneyBarProps) {
  if (historyIds.length === 0 && favoriteIds.length === 0) return null

  const history = historyIds.map((id) => bandById[id]).filter(Boolean).slice(0, 6)
  const favorites = favoriteIds.map((id) => bandById[id]).filter(Boolean)

  return (
    <section className="journey-bar" aria-label="나의 탐험 기록">
      <div className="journey-group">
        <span className="journey-label"><Clock3 size={14} /> 최근 탐험</span>
        <div className="journey-chips">
          {history.map((band) => <button key={band.id} onClick={() => onSelect(band)}>{band.name}</button>)}
        </div>
        {history.length > 0 && <button className="journey-clear" onClick={onClearHistory} aria-label="탐험 기록 지우기"><RotateCcw size={13} /></button>}
      </div>
      <div className="journey-group favorites-group">
        <span className="journey-label"><Heart size={14} fill="currentColor" /> 저장한 밴드</span>
        <div className="journey-chips favorite-chips">
          {favorites.length > 0
            ? favorites.slice(0, 5).map((band) => <button key={band.id} onClick={() => onSelect(band)}>{band.name}</button>)
            : <span className="journey-empty">카드의 하트를 눌러 저장하세요</span>}
        </div>
      </div>
    </section>
  )
}
