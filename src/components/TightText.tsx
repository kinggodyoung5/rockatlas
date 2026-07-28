import type { ReactNode } from 'react'
import { useTightenToFit, type TightenMode } from '../lib/useTightenToFit'

interface TightTextProps {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'strong'
  mode?: TightenMode
  className?: string
  children: ReactNode
}

/**
 * Renders text that trims its own tracking (and, for headlines, its size) when that removes an
 * awkward trailing line. See useTightenToFit — text that genuinely needs the extra line is untouched.
 */
export function TightText({ as: Tag = 'span', mode = 'fit-line', className, children }: TightTextProps) {
  const ref = useTightenToFit<HTMLElement>(mode)
  return <Tag ref={ref as never} className={className}>{children}</Tag>
}
