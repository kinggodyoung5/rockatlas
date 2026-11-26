import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { bandImageSources, type ImageVariant } from '../lib/commonsImage'
import type { Band } from '../types/music'

const imageCache = new Map<string, string | null>()

interface BandImageProps {
  band: Band
  className?: string
  /** 상세 화면 첫 이미지: 바로 불러오고 우선순위를 높인다. */
  eager?: boolean
  /** 카드(330/500px) 또는 상세(500/960/1280px). 기본은 카드. */
  variant?: ImageVariant
}

type Stage = 'thumb' | 'fallback' | 'failed'

export function BandImage({ band, className = '', eager = false, variant = eager ? 'detail' : 'card' }: BandImageProps) {
  const sources = bandImageSources(band.image, variant)
  const cacheKey = band.image.wikipediaTitle
  const [stage, setStage] = useState<Stage>('thumb')
  const [lookedUp, setLookedUp] = useState<string | null | undefined>(sources ? undefined : imageCache.get(cacheKey))

  useEffect(() => { setStage('thumb') }, [band.id, variant])

  // 저장된 이미지가 없는 밴드만 위키백과 대표 이미지를 찾아본다(초안 미리보기용).
  useEffect(() => {
    if (sources) return
    setLookedUp(imageCache.get(cacheKey))
    if (imageCache.has(cacheKey)) return
    const controller = new AbortController()
    const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '960', titles: band.image.wikipediaTitle })
    fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const page = Object.values(data?.query?.pages ?? {})[0] as { thumbnail?: { source?: string } } | undefined
        const nextSrc = page?.thumbnail?.source ?? null
        imageCache.set(cacheKey, nextSrc)
        setLookedUp(nextSrc)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        imageCache.set(cacheKey, null)
        setLookedUp(null)
      })
    return () => controller.abort()
  }, [Boolean(sources), band.image.wikipediaTitle, cacheKey])

  const src = stage === 'thumb' ? sources?.src ?? lookedUp : stage === 'fallback' ? sources?.fallback : undefined
  if (!src) {
    return (
      <div className={`band-image-fallback ${className}`} aria-label={`${band.name} 이미지 준비 중`}>
        <span className="fallback-no">{band.formed}</span>
        <ImageOff size={22} aria-hidden="true" />
        <span>WIKIMEDIA<br />PREVIEW</span>
      </div>
    )
  }

  return (
    <img
      className={`band-image ${band.image.kind === 'logo' ? 'is-logo' : ''} ${className}`}
      src={src}
      srcSet={stage === 'thumb' ? sources?.srcSet : undefined}
      sizes={stage === 'thumb' ? sources?.sizes : undefined}
      alt={band.image.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      // 썸네일이 실패하면(원본보다 큰 폭 등) 원본으로 한 번, 그것도 실패하면 자리표시로.
      onError={() => setStage((current) => current === 'thumb' && sources?.fallback && sources.fallback !== sources.src ? 'fallback' : 'failed')}
    />
  )
}
