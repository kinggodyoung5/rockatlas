import type { CSSProperties } from 'react'
import type { ImagePosition } from '../data/siteContent'

/** Legacy Studio presets, kept parseable so existing siteContent.json values keep working after the
 *  editor moved to precise percentages. */
const presets: Record<string, string> = {
  center: '50% 50%',
  top: '50% 0%',
  bottom: '50% 100%',
  left: '0% 50%',
  right: '100% 50%',
}

export interface PositionXY { x: number; y: number }

/** Parses any stored position into x/y percentages. Falls back to dead center on anything unrecognized. */
export function parsePosition(value: ImagePosition | undefined): PositionXY {
  const raw = (value ?? '').trim()
  if (!raw) return { x: 50, y: 50 }
  const normalized = presets[raw] ?? raw
  const parts = normalized.split(/\s+/)
  const toPercent = (part: string | undefined, fallback: number) => {
    if (!part) return fallback
    const named = presets[part]
    if (named) return Number.parseFloat(part === 'left' || part === 'right' ? named.split(' ')[0] : named.split(' ')[1])
    const parsed = Number.parseFloat(part)
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : fallback
  }
  return { x: toPercent(parts[0], 50), y: toPercent(parts[1], 50) }
}

export const formatPosition = ({ x, y }: PositionXY): ImagePosition => `${Math.round(x)}% ${Math.round(y)}%`

/** CSS can't branch on a JSON value, so the mobile override rides along as a custom property and a
 *  media query in index.css swaps it in below the mobile breakpoint. */
export function positionStyle(desktop: ImagePosition | undefined, mobile: ImagePosition | undefined): CSSProperties {
  const resolvedDesktop = formatPosition(parsePosition(desktop))
  const style: Record<string, string> = { '--art-position': resolvedDesktop, objectPosition: resolvedDesktop }
  if (mobile) style['--art-position-mobile'] = formatPosition(parsePosition(mobile))
  return style as CSSProperties
}
