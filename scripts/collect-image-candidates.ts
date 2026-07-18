import { bands } from '../src/data/bands.ts'

interface MetadataValue {
  value?: string
}

interface PageImage {
  title: string
  pageimage?: string
  original?: { source?: string }
  thumbnail?: { source?: string }
}

interface ImageInfo {
  url?: string
  thumburl?: string
  descriptionurl?: string
  extmetadata?: Record<string, MetadataValue>
}

const args = process.argv.slice(2)
const selectedBandId = args.find((arg) => arg.startsWith('--band='))?.split('=')[1]
const asJson = args.includes('--json')
const selectedBands = selectedBandId ? bands.filter((band) => band.id === selectedBandId) : bands

if (selectedBands.length === 0) {
  console.error(`밴드를 찾을 수 없습니다: ${selectedBandId}`)
  process.exit(1)
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function fetchJson<T>(url: URL, attempt = 0): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'RockAtlasImageReview/0.1 (local metadata review tool)' },
  })
  if (response.ok) return response.json() as Promise<T>

  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get('retry-after'))
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200 * 2 ** attempt
    console.error(`${url.hostname} ${response.status}: ${wait}ms 뒤 재시도합니다.`)
    await sleep(wait)
    return fetchJson<T>(url, attempt + 1)
  }

  throw new Error(`${response.status} ${response.statusText}: ${url.hostname}`)
}

const normalizeTitle = (value: string) => value.replaceAll('_', ' ').trim().toLocaleLowerCase()
const normalizeFileName = (value: string) => normalizeTitle(value.replace(/^File:/i, ''))

const decodeHtml = (value: string) => value
  .replace(/<br\s*\/?>/gi, ' · ')
  .replace(/<[^>]+>/g, ' ')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#039;', "'")
  .replaceAll('&nbsp;', ' ')
  .replace(/\s+/g, ' ')
  .trim()

async function collectPageImages() {
  const result = new Map<string, PageImage>()
  const chunks = Array.from({ length: Math.ceil(selectedBands.length / 20) }, (_, index) => selectedBands.slice(index * 20, index * 20 + 20))

  for (const chunk of chunks) {
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      redirects: '1',
      prop: 'pageimages',
      piprop: 'name|original|thumbnail',
      pilicense: 'free',
      pithumbsize: '1200',
      titles: chunk.map((band) => band.image.wikipediaTitle).join('|'),
    }).toString()
    const data = await fetchJson<{
      query?: {
        pages?: Record<string, PageImage>
        redirects?: Array<{ from: string; to: string }>
      }
    }>(url)
    const redirects = new Map((data.query?.redirects ?? []).map((item) => [normalizeTitle(item.from), normalizeTitle(item.to)]))
    const pages = Object.values(data.query?.pages ?? {})

    for (const band of chunk) {
      const requested = normalizeTitle(band.image.wikipediaTitle)
      const resolved = redirects.get(requested) ?? requested
      const page = pages.find((item) => normalizeTitle(item.title) === resolved)
      if (page) result.set(band.id, page)
    }
  }

  return result
}

async function collectCommonsMetadata(fileNames: string[]) {
  const result = new Map<string, ImageInfo>()
  const chunks = Array.from({ length: Math.ceil(fileNames.length / 5) }, (_, index) => fileNames.slice(index * 5, index * 5 + 5))

  for (const [index, chunk] of chunks.entries()) {
    const url = new URL('https://commons.wikimedia.org/w/api.php')
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '1200',
      iiextmetadatalanguage: 'en',
      iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|UsageTerms|Credit|AttributionRequired|Restrictions',
      titles: chunk.map((fileName) => `File:${fileName}`).join('|'),
    }).toString()
    const data = await fetchJson<{ query?: { pages?: Record<string, { title: string; imageinfo?: ImageInfo[] }> } }>(url)
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0]
      if (info) result.set(normalizeFileName(page.title), info)
    }
    if (index < chunks.length - 1) await sleep(250)
  }

  return result
}

const pageImages = await collectPageImages()
const fileNames = [...new Set([...pageImages.values()].map((page) => page.pageimage).filter((value): value is string => Boolean(value)))]
const metadataByFileName = await collectCommonsMetadata(fileNames)

const results = selectedBands.map((band) => {
  const pageImage = pageImages.get(band.id)
  const fileName = pageImage?.pageimage
  const imageInfo = fileName ? metadataByFileName.get(normalizeFileName(fileName)) : undefined
  const metadata = imageInfo?.extmetadata ?? {}
  const creator = decodeHtml(metadata.Artist?.value ?? metadata.Credit?.value ?? '')
  const license = decodeHtml(metadata.LicenseShortName?.value ?? metadata.UsageTerms?.value ?? '')
  const licenseUrl = metadata.LicenseUrl?.value
  const sourceUrl = imageInfo?.descriptionurl
  const imageUrl = imageInfo?.thumburl ?? pageImage?.thumbnail?.source
  const originalUrl = imageInfo?.url ?? pageImage?.original?.source
  const freeLicense = /^(CC BY(?:-SA)?(?: \d\.\d)?|CC0|Public domain|GFDL)/i.test(license)
  const complete = Boolean(fileName && creator && license && sourceUrl && imageUrl && originalUrl && freeLicense)

  return {
    bandId: band.id,
    bandName: band.name,
    status: complete ? 'ready-for-review' : fileName ? 'needs-human-review' : 'missing-free-page-image',
    fileName,
    imageUrl,
    originalUrl,
    sourceUrl,
    creator,
    license,
    licenseUrl,
    attributionRequired: metadata.AttributionRequired?.value,
    restrictions: metadata.Restrictions?.value,
  }
})

if (asJson) {
  console.log(JSON.stringify({ collectedAt: new Date().toISOString(), results }, null, 2))
} else {
  console.log('ROCK ATLAS Commons 이미지 후보')
  for (const item of results) {
    console.log(`- ${item.bandName}: ${item.status}`)
    console.log(`  ${item.fileName ?? '자유 이용 대표 이미지 없음'}${item.license ? ` · ${item.license}` : ''}${item.creator ? ` · ${item.creator}` : ''}`)
  }
  const ready = results.filter((item) => item.status === 'ready-for-review').length
  console.log(`\n검수 후보 준비 ${ready}/${results.length} · 자동으로 verified 상태로 변경하지 않았습니다.`)
}
