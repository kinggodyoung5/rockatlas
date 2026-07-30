import { ArrowRight, AudioWaveform, FlaskConical, Gauge, Mountain, MoonStar, Radio, RotateCcw, Route, Share2, Sparkles, SunMedium, Weight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { hitchhikingDirectionById, type HitchhikingDirectionId } from '../config/hitchhiking'
import { publicBandById, publicBands } from '../data/publicBands'
import { availableHitchhikingDirections, recommendHitchhikingBands, type JourneyStep } from '../lib/hitchhiking'
import type { Band } from '../types/music'
import { BandImage } from './BandImage'

const directionIcons = {
  weight: Weight,
  sparkles: Sparkles,
  radio: Radio,
  flask: FlaskConical,
  gauge: Gauge,
  moon: MoonStar,
  sun: SunMedium,
  waves: AudioWaveform,
  mountain: Mountain,
}

interface HitchhikingPanelProps {
  band: Band
  visitedIds: string[]
  journeySteps: JourneyStep[]
  onTravel: (band: Band, direction: HitchhikingDirectionId) => void
  onResetJourney: () => void
  onShareJourney: () => void
}

export function HitchhikingPanel({
  band,
  visitedIds,
  journeySteps,
  onTravel,
  onResetJourney,
  onShareJourney,
}: HitchhikingPanelProps) {
  const [directionId, setDirectionId] = useState<HitchhikingDirectionId | null>(null)
  const [page, setPage] = useState(0)
  const direction = directionId ? hitchhikingDirectionById[directionId] : null
  const availableDirections = useMemo(
    () => availableHitchhikingDirections(band, publicBands),
    [band],
  )
  const recommendations = useMemo(
    () => directionId
      ? recommendHitchhikingBands(band, publicBands, directionId, { visitedIds, limit: 12 })
      : [],
    [band, directionId, visitedIds],
  )
  const visibleRecommendations = recommendations.slice(page * 3, page * 3 + 3)
  const routeSteps = journeySteps
    .map((step) => ({ ...step, band: publicBandById[step.bandId] }))
    .filter((step): step is JourneyStep & { band: Band } => Boolean(step.band))
    .slice(-6)

  useEffect(() => {
    setDirectionId(null)
    setPage(0)
  }, [band.id])

  const selectDirection = (nextDirection: HitchhikingDirectionId) => {
    setDirectionId(nextDirection)
    setPage(0)
  }

  const showNextCandidates = () => {
    const nextPage = (page + 1) * 3 >= recommendations.length ? 0 : page + 1
    setPage(nextPage)
  }

  return (
    <section className="hitchhiking-panel" aria-labelledby="hitchhiking-title">
      <div className="hitchhiking-heading">
        <div>
          <span className="eyebrow"><Route size={15} /> HITCHHIKING ROUTE 2.0</span>
          <h2 id="hitchhiking-title">다음에는 어떤 소리로 갈까요?</h2>
          <p>현재 밴드의 실제 성향에서 자연스럽게 이어지는 방향만 골라 보여줍니다.</p>
        </div>
        <div className="hitchhiking-current"><span>YOU ARE HERE</span><strong>{band.name}</strong></div>
      </div>

      <div
        className="hitchhiking-directions"
        style={{ '--direction-count': availableDirections.length } as React.CSSProperties}
        aria-label="추천 방향 선택"
      >
        {availableDirections.map(({ direction: item, editorialBridge }) => {
          const Icon = directionIcons[item.iconKey]
          const active = item.id === directionId
          return (
            <button
              key={item.id}
              className={active ? 'is-active' : ''}
              style={{ '--direction-color': item.accent } as React.CSSProperties}
              aria-pressed={active}
              onClick={() => selectDirection(item.id)}
            >
              <Icon size={21} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
                {editorialBridge && <em>검수된 연결을 통한 경로</em>}
              </span>
              <ArrowRight size={17} />
            </button>
          )
        })}
      </div>

      {direction && (
        <div className="hitchhiking-results" style={{ '--direction-color': direction.accent } as React.CSSProperties}>
          <div className="hitchhiking-results-heading">
            <div><span>SELECTED DIRECTION</span><strong>{direction.resultLabel}</strong></div>
            <button onClick={showNextCandidates}>다른 후보 3개 <RotateCcw size={14} /></button>
          </div>
          <div className="hitchhiking-candidates">
            {visibleRecommendations.map((item) => (
              <button key={item.band.id} className="hitchhiking-card" onClick={() => onTravel(item.band, direction.id)}>
                <div className="hitchhiking-card-image"><BandImage band={item.band} /></div>
                <div className="hitchhiking-card-copy">
                  <span>{item.directionGain >= 0.75 ? '확실한 방향 전환' : item.directionGain >= 0.2 ? '자연스러운 다음 걸음' : '이 방향을 더 깊게'}</span>
                  <strong>{item.band.name}</strong>
                  <ul>
                    <li>{item.reasons[0]}</li>
                    <li>{item.reasons[2]}</li>
                  </ul>
                  <em>이 밴드로 이동 <ArrowRight size={14} /></em>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="hitchhiking-route">
        <div className="hitchhiking-route-label"><Route size={15} /><span><strong>나의 여행 경로</strong><small>이 브라우저에 자동 저장됩니다.</small></span></div>
        <div className="hitchhiking-route-steps">
          {routeSteps.map((step, index) => (
            <span key={`${step.bandId}-${index}`}>
              {index > 0 && <ArrowRight size={12} />}
              <strong>{step.band.name}</strong>
              {step.via && step.via !== 'connection' && <small>{hitchhikingDirectionById[step.via].label}</small>}
            </span>
          ))}
        </div>
        <div className="hitchhiking-route-actions">
          {journeySteps.length > 1 && <button onClick={onShareJourney}><Share2 size={14} /> 여정 공유</button>}
          <button onClick={onResetJourney}><RotateCcw size={14} /> 여기서 새로 시작</button>
        </div>
      </div>
    </section>
  )
}
