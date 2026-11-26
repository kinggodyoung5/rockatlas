import type { BandImage } from '../types/music'

/**
 * Commons 썸네일 (plan P5-2). 원본 URL에서 폭별 썸네일 URL을 만든다.
 * Commons는 표준 폭만 만들어 준다 — 320처럼 임의 폭은 400 오류가 난다(2026-11-26 확인: 330·500 정상).
 * 원본보다 큰 폭도 거부할 수 있으므로 화면은 실패하면 원본으로 한 번 되돌린다(BandImage onError).
 */
export const commonsWidths = [330, 500, 960, 1280] as const
export type CommonsWidth = (typeof commonsWidths)[number]

const uploadPattern = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)/
const redirectPattern = /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\/[^?#]+/

export function commonsThumb(originalUrl: string | undefined, width: CommonsWidth) {
  if (!originalUrl) return undefined
  const upload = originalUrl.match(uploadPattern)
  if (upload) {
    const [, a, ab, file] = upload
    const thumbName = /\.svg$/i.test(file) ? `${file}.png` : file
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${file}/${width}px-${thumbName}`
  }
  const redirect = originalUrl.match(redirectPattern)
  if (redirect) return `${redirect[0]}?width=${width}`
  return undefined
}

export type ImageVariant = 'card' | 'detail'

const variantWidths: Record<ImageVariant, CommonsWidth[]> = { card: [330, 500], detail: [500, 960, 1280] }
const variantSizes: Record<ImageVariant, string> = {
  card: '(max-width: 760px) 50vw, 330px',
  detail: '(max-width: 760px) 100vw, 600px',
}

export interface ImageSources {
  src: string
  srcSet?: string
  sizes?: string
  /** 썸네일이 실패했을 때 한 번 시도할 주소 */
  fallback?: string
}

/** 카드는 330/500, 상세는 500/960/1280. Commons 원본이 아니면 저장된 displayUrl을 그대로 쓴다. */
export function bandImageSources(image: Pick<BandImage, 'displayUrl' | 'originalUrl'>, variant: ImageVariant): ImageSources | undefined {
  const widths = variantWidths[variant]
  const thumbs = widths.map((width) => [width, commonsThumb(image.originalUrl, width)] as const).filter((item): item is readonly [CommonsWidth, string] => Boolean(item[1]))
  if (thumbs.length) {
    return {
      src: thumbs[Math.min(1, thumbs.length - 1)][1],
      srcSet: thumbs.map(([width, url]) => `${url} ${width}w`).join(', '),
      sizes: variantSizes[variant],
      fallback: image.displayUrl ?? image.originalUrl,
    }
  }
  const src = image.displayUrl ?? image.originalUrl
  return src ? { src } : undefined
}
