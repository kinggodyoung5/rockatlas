import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { Band } from '../types/music'

const imageCache = new Map<string, string | null>()

interface BandImageProps {
  band: Band
  className?: string
  eager?: boolean
}

export function BandImage({ band, className = '', eager = false }: BandImageProps) {
  const cacheKey = band.image.wikipediaTitle
  const [src, setSrc] = useState<string | null | undefined>(band.image.displayUrl ?? imageCache.get(cacheKey))

  useEffect(() => {
    if (band.image.displayUrl) {
      setSrc(band.image.displayUrl)
      return
    }
    setSrc(imageCache.get(cacheKey))
    if (imageCache.has(cacheKey)) return
    const controller = new AbortController()
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '1000',
      titles: band.image.wikipediaTitle,
    })

    fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const page = Object.values(data?.query?.pages ?? {})[0] as { thumbnail?: { source?: string } } | undefined
        const nextSrc = page?.thumbnail?.source ?? null
        imageCache.set(cacheKey, nextSrc)
        setSrc(nextSrc)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        imageCache.set(cacheKey, null)
        setSrc(null)
      })

    return () => controller.abort()
  }, [band.image.displayUrl, band.image.wikipediaTitle, cacheKey])

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
      className={`band-image ${className}`}
      src={src}
      alt={band.image.alt}
      loading={eager ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onError={() => setSrc(null)}
    />
  )
}
