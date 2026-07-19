import { readFile, writeFile } from 'node:fs/promises'

interface ImageDecision {
  fileName: string
  sourceUrl: string
  creator: string
  license: string
  licenseUrl?: string
}

interface CatalogBand {
  id: string
  name: string
  image: {
    fileName?: string
    displayUrl?: string
    originalUrl?: string
    credit: {
      sourceUrl: string
      creator?: string
      license: string
      licenseUrl?: string
      reviewStatus: 'verified' | 'needs-review'
      reviewedAt?: string
    }
  }
  sources: Array<Record<string, unknown> & { publisher: string; url: string }>
}

interface CatalogFile {
  schemaVersion: number
  updatedAt: string
  bands: CatalogBand[]
}

const reviewedAt = '2026-07-19'
const catalogUrl = new URL('../src/data/catalog.json', import.meta.url)

// Wikimedia Commons file pages and extmetadata were checked on 2026-07-19.
const decisions: Record<string, ImageDecision> = {
  megadeth: { fileName: 'Megadeth_-_Wacken_Open_Air_2023_12.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Megadeth_-_Wacken_Open_Air_2023_12.jpg', creator: 'Frank Schwichtenberg', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  travis: { fileName: 'Travis_band_zz.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Travis_band_zz.jpg', creator: 'Debbie R', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  'imagine-dragons': { fileName: 'Imagine_Dragons_2013.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Imagine_Dragons_2013.jpg', creator: 'Alexandra Sermon', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  oasis: { fileName: 'Oasis_Noel_and_Liam_WF.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Oasis_Noel_and_Liam_WF.jpg', creator: 'Will Fresch', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  queen: { fileName: 'Queen 1984 011.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Queen_1984_011.jpg', creator: 'Thomas Steffan', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'one-republic': { fileName: 'OneRepublic 2016.JPG', sourceUrl: 'https://commons.wikimedia.org/wiki/File:OneRepublic_2016.JPG', creator: 'Jeffrey Beall', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0' },
  kent: { fileName: 'Kent-sthlm2010.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kent-sthlm2010.jpg', creator: 'Membroza', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  coldplay: { fileName: 'Coldplay Glasto24 290624 (26) (53836754632) (cropped).jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coldplay_Glasto24_290624_(26)_(53836754632)_(cropped).jpg', creator: 'Raph_PH', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
  'judas-priest': { fileName: 'JudasPriest.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:JudasPriest.jpg', creator: 'Zach Petersen', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0' },
  'two-door-cinema-club': { fileName: 'Two Door Cinema Club, Tufnell Park Dome, London (29312606633).jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Two_Door_Cinema_Club,_Tufnell_Park_Dome,_London_(29312606633).jpg', creator: 'Drew de F Fawkes', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
  'green-day': { fileName: 'Green Day on 3 Jun 2022.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Green_Day_on_3_Jun_2022.jpg', creator: 'Sven Mandel; montage by Ggoofy14', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'theory-of-a-deadman': { fileName: 'Theory of a Deadman performing.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Theory_of_a_Deadman_performing.jpg', creator: 'Patricia H.', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
  'bon-jovi': { fileName: 'Bon_Jovi_1.jpg', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bon_Jovi_1.jpg', creator: 'Rosana Prada', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0' },
}

const catalog = JSON.parse(await readFile(catalogUrl, 'utf8')) as CatalogFile

for (const [bandId, decision] of Object.entries(decisions)) {
  const band = catalog.bands.find((item) => item.id === bandId)
  if (!band) throw new Error(`카탈로그에서 ${bandId}를 찾지 못했습니다.`)
  const redirectBase = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(decision.fileName)}`
  band.image = {
    ...band.image,
    fileName: decision.fileName,
    displayUrl: `${redirectBase}?width=1280`,
    originalUrl: redirectBase,
    credit: {
      sourceUrl: decision.sourceUrl,
      creator: decision.creator,
      license: decision.license,
      licenseUrl: decision.licenseUrl,
      reviewStatus: 'verified',
      reviewedAt,
    },
  }
  const source = {
    label: `${band.name} 이미지 — Wikimedia Commons`,
    url: decision.sourceUrl,
    publisher: 'Wikimedia Commons',
    accessedAt: reviewedAt,
    note: `${decision.creator} · ${decision.license} · Commons 메타데이터 재검수`,
  }
  const sourceIndex = band.sources.findIndex((item) => item.publisher === 'Wikimedia Commons')
  if (sourceIndex >= 0) band.sources[sourceIndex] = source
  else band.sources.push(source)
}

catalog.updatedAt = new Date().toISOString()
await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`이미지 권리 검수 ${Object.keys(decisions).length}건 반영 완료`)
