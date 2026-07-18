import { bands } from '../src/data/bands.ts'

interface MetadataValue {
  value?: string
}

interface SearchPage {
  title: string
  imageinfo?: Array<{
    url?: string
    thumburl?: string
    descriptionurl?: string
    mime?: string
    extmetadata?: Record<string, MetadataValue>
  }>
}

const args = process.argv.slice(2)
const selectedBandId = args.find((arg) => arg.startsWith('--band='))?.split('=')[1]
const asJson = args.includes('--json')
const limit = Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 8)
const selectedBands = selectedBandId
  ? bands.filter((band) => band.id === selectedBandId)
  : bands.filter((band) => band.image.credit.reviewStatus !== 'verified')

if (selectedBands.length === 0) {
  console.error(selectedBandId ? `밴드를 찾을 수 없습니다: ${selectedBandId}` : '대체 이미지 검색이 필요한 밴드가 없습니다.')
  process.exit(1)
}

const decodeHtml = (value: string) => value
  .replace(/<br\s*\/?>/gi, ' · ')
  .replace(/<[^>]+>/g, ' ')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#039;', "'")
  .replaceAll('&nbsp;', ' ')
  .replace(/\s+/g, ' ')
  .trim()

async function searchBand(name: string) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `"${name}" filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(Math.min(Math.max(limit, 1), 20)),
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '800',
    iiextmetadatalanguage: 'en',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ImageDescription|Credit|Categories',
  }).toString()
  const response = await fetch(url, { headers: { 'User-Agent': 'RockAtlasImageReview/0.1 (local metadata review tool)' } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url.hostname}`)
  const data = await response.json() as { query?: { pages?: Record<string, SearchPage> } }

  return Object.values(data.query?.pages ?? {}).map((page) => {
    const info = page.imageinfo?.[0]
    const metadata = info?.extmetadata ?? {}
    return {
      fileName: page.title.replace(/^File:/, ''),
      mime: info?.mime,
      imageUrl: info?.thumburl ?? info?.url,
      originalUrl: info?.url,
      sourceUrl: info?.descriptionurl,
      creator: decodeHtml(metadata.Artist?.value ?? metadata.Credit?.value ?? ''),
      license: decodeHtml(metadata.LicenseShortName?.value ?? ''),
      licenseUrl: metadata.LicenseUrl?.value,
      description: decodeHtml(metadata.ImageDescription?.value ?? '').slice(0, 280),
    }
  })
}

const results = []
for (const band of selectedBands) {
  results.push({ bandId: band.id, bandName: band.name, candidates: await searchBand(band.name) })
}

if (asJson) {
  console.log(JSON.stringify({ collectedAt: new Date().toISOString(), results }, null, 2))
} else {
  console.log('ROCK ATLAS Commons 대체 이미지 검색')
  for (const result of results) {
    console.log(`\n${result.bandName}`)
    for (const [index, candidate] of result.candidates.entries()) {
      console.log(`  ${index + 1}. ${candidate.fileName} · ${candidate.license || '라이선스 미상'} · ${candidate.creator || '저작자 미상'}`)
      if (candidate.description) console.log(`     ${candidate.description}`)
    }
  }
  console.log('\n밴드 전체 또는 공연 장면인지 Commons 원본 페이지에서 확인한 뒤 verifiedImages에 반영하세요.')
}
