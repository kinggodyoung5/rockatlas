import { mkdir, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type JsonRecord = Record<string, unknown>
type Catalog = { schemaVersion: number; updatedAt: string; bands: JsonRecord[] }

const root = resolve('.')
const catalogPath = resolve(root, 'src/data/catalog.json')
const generatedDir = resolve(root, 'src/data/generated')
const detailDir = resolve(root, 'public/data/bands')
const shareDir = resolve(root, 'public/bands')
const siteUrl = 'https://kinggodyoung5.github.io/rockatlas/'
const defaultShareImage = `${siteUrl}assets/social/rock-atlas-share-v1.jpg`

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

async function removeStaleJson(directory: string, allowedNames: Set<string>) {
  await mkdir(directory, { recursive: true })
  for (const name of await readdir(directory)) {
    if (name.endsWith('.json') && !allowedNames.has(name)) await unlink(resolve(directory, name))
  }
}

async function removeStaleShareDirectories(directory: string, allowedIds: Set<string>) {
  await mkdir(directory, { recursive: true })
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name) && !allowedIds.has(entry.name)) {
      await rm(resolve(directory, entry.name), { recursive: true })
    }
  }
}

function compactBand(band: JsonRecord) {
  const image = band.image as JsonRecord
  const taxonomy = band.taxonomyV2 as JsonRecord | undefined
  const members = Array.isArray(band.members) ? band.members as JsonRecord[] : []
  const relations = Array.isArray(band.relations) ? band.relations as JsonRecord[] : []
  const eraTags = Array.isArray(band.eraTags) ? band.eraTags as JsonRecord[] : []
  return {
    id: band.id,
    name: band.name,
    formed: band.formed,
    origin: band.origin,
    countryCode: band.countryCode,
    activeYears: band.activeYears,
    primaryGenre: band.primaryGenre,
    genreIds: band.genreIds,
    subgenres: band.subgenres,
    eraTags: eraTags.map(({ era, genreIds, subgenres }) => ({ era, genreIds, subgenres })),
    tags: band.tags,
    summary: band.summary,
    style: '',
    image: {
      wikipediaTitle: image.wikipediaTitle ?? band.name,
      displayUrl: image.displayUrl,
      alt: image.alt ?? `${band.name} 밴드 사진`,
      credit: { sourceUrl: '', license: '', reviewStatus: 'needs-review' },
    },
    members: members.map(({ name, status }) => ({ name, role: '', status })),
    tracks: [],
    relations: relations.map(({ targetBandId, kind, strength, reviewStatus }) => ({ targetBandId, kind, strength, note: '', reviewStatus })),
    sources: [],
    taxonomyV2: taxonomy,
    reviewStatus: band.reviewStatus,
  }
}

function shareHtml(band: JsonRecord) {
  const id = String(band.id)
  const name = String(band.name)
  const summary = String(band.summary ?? '')
  const image = band.image as JsonRecord | undefined
  const imageUrl = String(image?.displayUrl ?? defaultShareImage)
  const canonical = `${siteUrl}bands/${encodeURIComponent(id)}/`
  const destination = `../../#band=${encodeURIComponent(id)}`
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)} — ROCK ATLAS</title>
  <meta name="description" content="${escapeHtml(summary)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="ROCK ATLAS" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${escapeHtml(name)} — ROCK ATLAS" />
  <meta property="og:description" content="${escapeHtml(summary)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:alt" content="${escapeHtml(`${name} 밴드 사진`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(name)} — ROCK ATLAS" />
  <meta name="twitter:description" content="${escapeHtml(summary)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <meta http-equiv="refresh" content="0; url=${destination}" />
</head>
<body>
  <p><a href="${destination}">${escapeHtml(name)}의 ROCK ATLAS 상세 페이지로 이동</a></p>
  <script>location.replace(${JSON.stringify(destination)})</script>
</body>
</html>
`
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Catalog
const publicBands = catalog.bands.filter((band) => band.reviewStatus !== 'draft')
const allowedDetails = new Set(publicBands.map((band) => `${band.id}.json`))
const allowedShareIds = new Set(publicBands.map((band) => String(band.id)))

await mkdir(generatedDir, { recursive: true })
await removeStaleJson(detailDir, allowedDetails)
await removeStaleShareDirectories(shareDir, allowedShareIds)

await writeFile(
  resolve(generatedDir, 'public-band-index.json'),
  `${JSON.stringify({ schemaVersion: catalog.schemaVersion, updatedAt: catalog.updatedAt, bands: publicBands.map(compactBand) })}\n`,
  'utf8',
)

await Promise.all(publicBands.flatMap((band) => {
  const id = String(band.id)
  const bandShareDir = resolve(shareDir, id)
  return [
    writeFile(resolve(detailDir, `${id}.json`), `${JSON.stringify(band)}\n`, 'utf8'),
    mkdir(bandShareDir, { recursive: true }).then(() => writeFile(resolve(bandShareDir, 'index.html'), shareHtml(band), 'utf8')),
  ]
}))

console.log(`공개 데이터 생성 완료 · 목록 ${publicBands.length}개 · 상세 ${publicBands.length}개 · 공유 페이지 ${publicBands.length}개`)
