import { useCallback, useEffect, useRef } from 'react'

/**
 * `fit-line`  — headline behaviour: pull the text onto a single line by tightening tracking and, if
 *               that isn't enough, shaving a little off the font size. Used for card titles, where a
 *               lone trailing word reads as a layout mistake.
 * `no-orphan` — body behaviour: only tighten tracking, and only to erase a nearly-empty last line.
 *               Font size stays put so paragraphs across cards keep matching.
 */
export type TightenMode = 'fit-line' | 'no-orphan'

/** Tracking past roughly this starts to look visibly cramped in Korean text. */
const MAX_TIGHTEN_EM = 0.05
const ORPHAN_STEP_EM = 0.005
/** Titles may shrink to this share of their CSS size — enough for the longest three-segment genre
 *  names, small enough that neighbouring cards still look like a set. */
const MIN_FONT_SCALE = 0.78
/** A last line at or under this share of the width is the orphan we're trying to remove. */
const ORPHAN_RATIO = 0.35
/** scrollWidth rounds to whole pixels, so text measuring "exactly" the available width still wraps.
 *  Aim a hair under to stay on the right side of that rounding. */
const FIT_EPSILON_PX = 1.5

function readMetrics(element: HTMLElement) {
  const styles = getComputedStyle(element)
  const fontSize = Number.parseFloat(styles.fontSize) || 0
  const parsedLine = Number.parseFloat(styles.lineHeight)
  const lineHeight = Number.isFinite(parsedLine) ? parsedLine : fontSize * 1.2
  // Several headings already carry negative tracking from the stylesheet. Our budget has to stack on
  // top of that, otherwise writing an absolute value here silently *loosens* the text instead.
  const parsedTracking = Number.parseFloat(styles.letterSpacing)
  const baseTrackingPx = Number.isFinite(parsedTracking) ? parsedTracking : 0
  return { fontSize, lineHeight, baseTrackingPx }
}

/** Applies `tightenEm` of extra tightening beyond whatever the stylesheet already set. */
function applyTightening(element: HTMLElement, baseTrackingPx: number, fontSize: number, tightenEm: number) {
  element.style.letterSpacing = `${(baseTrackingPx - tightenEm * fontSize).toFixed(3)}px`
}

function countLines(element: HTMLElement, lineHeight: number) {
  if (!lineHeight) return 1
  return Math.max(1, Math.round(element.scrollHeight / lineHeight))
}

/** Width the text would need with no wrapping, at whatever tracking/size is currently applied. */
function naturalWidth(element: HTMLElement) {
  const previous = element.style.whiteSpace
  element.style.whiteSpace = 'nowrap'
  const width = element.scrollWidth
  element.style.whiteSpace = previous
  return width
}

function clear(element: HTMLElement) {
  element.style.letterSpacing = ''
  element.style.fontSize = ''
}

function fitToSingleLine(element: HTMLElement) {
  const { fontSize, lineHeight, baseTrackingPx } = readMetrics(element)
  if (!fontSize || countLines(element, lineHeight) < 2) return

  const available = element.clientWidth
  const target = available - FIT_EPSILON_PX
  const natural = naturalWidth(element)
  if (!available || !natural || natural <= target) return

  // Tracking is the cheaper fix visually, so spend it first — one gap per character, minus the last.
  const gaps = Math.max(1, element.textContent?.length ?? 1)
  const overflowPx = natural - target
  const tightenEm = Math.min(MAX_TIGHTEN_EM, overflowPx / (gaps * fontSize))
  applyTightening(element, baseTrackingPx, fontSize, tightenEm)

  // Whatever tracking couldn't absorb comes out of the font size.
  const afterTracking = naturalWidth(element)
  if (afterTracking > target) {
    const scale = Math.max(MIN_FONT_SCALE, target / afterTracking)
    element.style.fontSize = `${(fontSize * scale).toFixed(2)}px`
  }

  // If the budget still wasn't enough, the text honestly needs two lines — don't leave it shrunken.
  const { lineHeight: finalLine } = readMetrics(element)
  if (countLines(element, finalLine) > 1) clear(element)
}

function removeOrphanLine(element: HTMLElement) {
  const { fontSize, lineHeight, baseTrackingPx } = readMetrics(element)
  const baseline = countLines(element, lineHeight)
  if (baseline < 2) return

  // Only act when the tail line is nearly empty; a full last line is just normal wrapping.
  const range = document.createRange()
  range.selectNodeContents(element)
  const lineBoxes = Array.from(range.getClientRects()).filter((rect) => rect.width > 0)
  const lastLine = lineBoxes.at(-1)
  if (!lastLine || !element.clientWidth) return
  if (lastLine.width / element.clientWidth > ORPHAN_RATIO) return

  for (let tighten = ORPHAN_STEP_EM; tighten <= MAX_TIGHTEN_EM + 1e-9; tighten += ORPHAN_STEP_EM) {
    applyTightening(element, baseTrackingPx, fontSize, tighten)
    if (countLines(element, lineHeight) < baseline) return
  }
  element.style.letterSpacing = ''
}

/**
 * Returns a ref callback that keeps the attached element's tracking (and, in `fit-line` mode, its
 * font size) trimmed just enough to avoid an awkward trailing line. Re-runs on container resize and
 * once web fonts settle, since both change text metrics.
 */
export function useTightenToFit<T extends HTMLElement>(mode: TightenMode = 'fit-line') {
  const elementRef = useRef<T | null>(null)

  const measure = useCallback(() => {
    const element = elementRef.current
    if (!element) return
    clear(element)
    if (mode === 'fit-line') fitToSingleLine(element)
    else removeOrphanLine(element)
  }, [mode])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    let frame = 0
    let timer = 0
    // Defer so breakpoint-driven font-size changes have landed before we measure; measuring inline
    // during a resize can otherwise re-apply sizes computed for the previous breakpoint. rAF is the
    // right timing when visible, but it's throttled in hidden tabs and offscreen iframes (the Studio
    // preview is one), so a timer backs it up — measure() is idempotent, so running twice is fine.
    const schedule = () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      frame = requestAnimationFrame(measure)
      timer = window.setTimeout(measure, 80)
    }
    measure()
    document.fonts?.ready.then(schedule).catch(() => {})
    const observer = new ResizeObserver(schedule)
    // Observe the container, not the element itself — we mutate the element's own size, and feeding
    // that back in would loop.
    if (element.parentElement) observer.observe(element.parentElement)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [measure])

  return useCallback((node: T | null) => {
    elementRef.current = node
    if (node) measure()
  }, [measure])
}
