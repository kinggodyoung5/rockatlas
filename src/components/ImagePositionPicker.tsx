import { Monitor, RotateCcw, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ImagePosition } from '../data/siteContent'
import { formatPosition, parsePosition, type PositionXY } from '../lib/imagePosition'

interface ImagePositionPickerProps {
  imageUrl: string
  desktopValue: ImagePosition
  mobileValue?: ImagePosition
  /** Preview box aspect ratios, so what you frame here matches what the real card crops to. */
  desktopAspect?: number
  mobileAspect?: number
  scale?: number
  opacity?: number
  onChange: (patch: { imagePosition?: ImagePosition; imagePositionMobile?: ImagePosition }) => void
}

export function ImagePositionPicker({
  imageUrl,
  desktopValue,
  mobileValue,
  desktopAspect = 552 / 530,
  mobileAspect = 343 / 340,
  scale = 1,
  opacity = 1,
  onChange,
}: ImagePositionPickerProps) {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; origin: PositionXY } | null>(null)
  const [dragging, setDragging] = useState(false)

  // Editing mobile while it has never been set starts from the desktop framing rather than snapping to centre.
  const editingMobile = mode === 'mobile'
  const activeRaw = editingMobile ? (mobileValue ?? desktopValue) : desktopValue
  const active = parsePosition(activeRaw)
  const aspect = editingMobile ? mobileAspect : desktopAspect

  const emit = (next: PositionXY) => {
    const value = formatPosition(next)
    onChange(editingMobile ? { imagePositionMobile: value } : { imagePosition: value })
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current
      const box = boxRef.current
      const img = imgRef.current
      if (!drag || !box || !img || !img.naturalWidth) return
      const boxRect = box.getBoundingClientRect()
      // Replicate object-fit: cover to find how much image actually overflows the box — that overflow is
      // the only range object-position can pan through, so it's the correct denominator for the drag.
      const coverScale = Math.max(boxRect.width / img.naturalWidth, boxRect.height / img.naturalHeight) * scale
      const overflowX = Math.max(0, img.naturalWidth * coverScale - boxRect.width)
      const overflowY = Math.max(0, img.naturalHeight * coverScale - boxRect.height)
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      // Dragging the image right reveals more of its left edge, which is a *lower* object-position.
      const nextX = overflowX ? drag.origin.x - (deltaX / overflowX) * 100 : drag.origin.x
      const nextY = overflowY ? drag.origin.y - (deltaY / overflowY) * 100 : drag.origin.y
      emit({ x: Math.min(100, Math.max(0, nextX)), y: Math.min(100, Math.max(0, nextY)) })
    }
    const handleUp = () => { dragRef.current = null; setDragging(false) }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  })

  if (!imageUrl) return null

  return (
    <div className="image-position-picker studio-grid-span">
      <div className="image-position-toolbar">
        <span>삽화 위치 <small>드래그해서 맞추세요</small></span>
        <div className="image-position-modes">
          <button type="button" className={mode === 'desktop' ? 'is-active' : ''} onClick={() => setMode('desktop')}><Monitor size={13} /> PC</button>
          <button type="button" className={mode === 'mobile' ? 'is-active' : ''} onClick={() => setMode('mobile')}><Smartphone size={13} /> 모바일</button>
        </div>
      </div>

      <div
        ref={boxRef}
        className={`image-position-stage ${dragging ? 'is-dragging' : ''}`}
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={(event) => {
          event.preventDefault()
          dragRef.current = { startX: event.clientX, startY: event.clientY, origin: active }
          setDragging(true)
        }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          draggable={false}
          style={{ objectPosition: formatPosition(active), transform: `scale(${scale})`, opacity }}
        />
        <div className="image-position-crosshair" style={{ left: `${active.x}%`, top: `${active.y}%` }} aria-hidden="true" />
      </div>

      <div className="image-position-readout">
        <span>가로 {Math.round(active.x)}% · 세로 {Math.round(active.y)}%</span>
        {editingMobile
          ? <button type="button" onClick={() => onChange({ imagePositionMobile: undefined })} disabled={!mobileValue}><RotateCcw size={12} /> PC 설정 따르기</button>
          : <button type="button" onClick={() => emit({ x: 50, y: 50 })}><RotateCcw size={12} /> 가운데로</button>}
      </div>
      {editingMobile && !mobileValue && <p className="image-position-note">아직 모바일 전용 설정이 없어 PC 설정을 그대로 씁니다. 드래그하면 모바일만 따로 저장됩니다.</p>}
    </div>
  )
}
