export type StudioImageAssetType = 'hero' | 'logo' | 'wordmark' | 'cosmic' | 'genre'

const imageLimits: Record<StudioImageAssetType, { width: number; height: number }> = {
  hero: { width: 1920, height: 1280 },
  logo: { width: 512, height: 512 },
  wordmark: { width: 1600, height: 640 },
  cosmic: { width: 1920, height: 1280 },
  genre: { width: 1200, height: 1200 },
}

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    reader.readAsDataURL(blob)
  })
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지를 압축하지 못했습니다.')), 'image/webp', 0.84)
  })
}

export interface OptimizedImageUpload {
  dataUrl: string
  originalBytes: number
  storedBytes: number
  width: number
  height: number
  optimized: boolean
}

export async function optimizeImageUpload(file: File, assetType: StudioImageAssetType): Promise<OptimizedImageUpload> {
  if (!file.type.match(/^image\/(?:png|jpeg|webp)$/)) throw new Error('PNG, JPG, WebP 이미지만 업로드할 수 있습니다.')
  if (file.size > 20_000_000) throw new Error('원본 이미지는 20MB 이하여야 합니다.')

  const bitmap = await createImageBitmap(file)
  try {
    const limit = imageLimits[assetType]
    const scale = Math.min(1, limit.width / bitmap.width, limit.height / bitmap.height)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서는 이미지 최적화를 사용할 수 없습니다.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    const compressed = await canvasBlob(canvas)
    const shouldUseCompressed = scale < 1 || compressed.size < file.size * 0.92
    const stored = shouldUseCompressed ? compressed : file
    return {
      dataUrl: await readAsDataUrl(stored),
      originalBytes: file.size,
      storedBytes: stored.size,
      width: shouldUseCompressed ? width : bitmap.width,
      height: shouldUseCompressed ? height : bitmap.height,
      optimized: shouldUseCompressed,
    }
  } finally {
    bitmap.close()
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
