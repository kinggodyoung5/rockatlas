import { useMemo } from 'react'
import { HITCHHIKING_DIRECTIONS } from '../config/hitchhiking'
import { availableHitchhikingDirections } from '../lib/hitchhiking'
import type { Band } from '../types/music'

interface StudioHitchhikingPreviewProps {
  band: Band
  catalogBands: Band[]
}

/**
 * 저장 전 초안(draft) 상태 그대로 계산한다. 무드 점수를 슬라이더로 바꾸는 즉시
 * 다시 계산되므로, 배포 전에도 어떤 히치하이킹 방향이 열리고 닫히는지 바로 확인할 수 있다.
 */
export function StudioHitchhikingPreview({ band, catalogBands }: StudioHitchhikingPreviewProps) {
  const results = useMemo(
    () => availableHitchhikingDirections(band, catalogBands, HITCHHIKING_DIRECTIONS.length),
    [band, catalogBands],
  )
  const topIds = new Set(results.slice(0, 4).map((item) => item.direction.id))

  return (
    <div className="studio-hitchhiking-preview">
      <strong>히치하이킹 방향 실시간 미리보기</strong>
      <small>지금 저장되지 않은 분위기 점수 기준으로 계산합니다. 공개 페이지에는 상위 4개만 노출됩니다.</small>
      {results.length === 0
        ? <p className="studio-hitchhiking-empty">현재 분위기 점수로는 열리는 방향이 없습니다.</p>
        : <ul className="studio-hitchhiking-list">
            {results.map((item) => {
              const isLive = topIds.has(item.direction.id)
              return (
                <li key={item.direction.id} className={isLive ? 'is-live' : 'is-overflow'}>
                  <span>{item.direction.label}</span>
                  <em>후보 {item.candidateCount}개</em>
                  {!isLive && <small>조건 충족 · 상위 4개 밖이라 공개 페이지엔 숨김</small>}
                </li>
              )
            })}
          </ul>}
    </div>
  )
}
