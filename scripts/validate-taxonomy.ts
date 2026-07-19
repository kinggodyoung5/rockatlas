import { readFile } from 'node:fs/promises'

interface TaxonomyItem { id: string; order?: number }
interface GenreItem extends TaxonomyItem { subgenreIds: string[]; quickMoodIds: string[] }
interface TaxonomyFile {
  schemaVersion: number
  genres: GenreItem[]
  subgenres: TaxonomyItem[]
  moods: Array<TaxonomyItem & { groupId: string }>
}
interface BandTaxonomyV2 {
  primaryGenreId: string
  secondaryGenreIds: string[]
  subgenreIds: string[]
  moodScores: Record<string, number>
  reviewStatus: string
}
interface CatalogFile { bands: Array<{ id: string; taxonomyV2?: BandTaxonomyV2 }> }

const source = new URL('../src/data/taxonomy.v2.json', import.meta.url)
const taxonomy = JSON.parse(await readFile(source, 'utf8')) as TaxonomyFile
const catalogSource = new URL('../src/data/catalog.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogSource, 'utf8')) as CatalogFile
const errors: string[] = []

function unique(items: TaxonomyItem[], label: string) {
  const ids = items.map((item) => item.id)
  if (new Set(ids).size !== ids.length) errors.push(`${label} ID가 중복되었습니다.`)
}

unique(taxonomy.genres, '장르')
unique(taxonomy.subgenres, '세부 장르')
unique(taxonomy.moods, '분위기')

if (taxonomy.schemaVersion !== 2) errors.push('taxonomy schemaVersion은 2여야 합니다.')
if (taxonomy.genres.length !== 13) errors.push(`상위 장르는 13개여야 합니다. 현재 ${taxonomy.genres.length}개입니다.`)
if (taxonomy.moods.length !== 24) errors.push(`분위기는 24개여야 합니다. 현재 ${taxonomy.moods.length}개입니다.`)

const genreOrders = taxonomy.genres.map((genre) => genre.order)
if (new Set(genreOrders).size !== genreOrders.length) errors.push('장르 order가 중복되었습니다.')
const moodOrders = taxonomy.moods.map((mood) => mood.order)
if (new Set(moodOrders).size !== moodOrders.length) errors.push('분위기 order가 중복되었습니다.')

const subgenreIds = new Set(taxonomy.subgenres.map((item) => item.id))
const moodIds = new Set(taxonomy.moods.map((item) => item.id))
for (const genre of taxonomy.genres) {
  for (const id of genre.subgenreIds) if (!subgenreIds.has(id)) errors.push(`${genre.id}: 존재하지 않는 세부 장르 ${id}`)
  for (const id of genre.quickMoodIds) if (!moodIds.has(id)) errors.push(`${genre.id}: 존재하지 않는 분위기 ${id}`)
}

const groups = new Set(taxonomy.moods.map((mood) => mood.groupId))
if (groups.size !== 4) errors.push(`분위기 그룹은 4개여야 합니다. 현재 ${groups.size}개입니다.`)

const genreIds = new Set(taxonomy.genres.map((item) => item.id))
let migratedBands = 0
for (const band of catalog.bands) {
  const draft = band.taxonomyV2
  if (!draft) continue
  migratedBands += 1
  if (!genreIds.has(draft.primaryGenreId)) errors.push(`${band.id}: 잘못된 v2 대표 장르 ${draft.primaryGenreId}`)
  if (new Set(draft.secondaryGenreIds).size !== draft.secondaryGenreIds.length) errors.push(`${band.id}: v2 보조 장르 중복`)
  if (draft.secondaryGenreIds.includes(draft.primaryGenreId)) errors.push(`${band.id}: 대표 장르가 보조 장르에도 포함됨`)
  for (const id of draft.secondaryGenreIds) if (!genreIds.has(id)) errors.push(`${band.id}: 잘못된 v2 보조 장르 ${id}`)
  for (const id of draft.subgenreIds) if (!subgenreIds.has(id)) errors.push(`${band.id}: 잘못된 v2 세부 장르 ${id}`)
  for (const [id, score] of Object.entries(draft.moodScores)) {
    if (!moodIds.has(id)) errors.push(`${band.id}: 잘못된 v2 분위기 ${id}`)
    if (!Number.isInteger(score) || score < 0 || score > 5) errors.push(`${band.id}: 분위기 점수 범위 오류 ${id}=${score}`)
  }
  if (!['draft', 'reviewed'].includes(draft.reviewStatus)) errors.push(`${band.id}: 잘못된 taxonomy 검수 상태`)
}

console.log('ROCK ATLAS taxonomy v2 검사')
console.log(`상위 장르 ${taxonomy.genres.length} · 세부 장르 ${taxonomy.subgenres.length} · 분위기 ${taxonomy.moods.length} · 그룹 ${groups.size}`)
console.log(`taxonomy v2 밴드 ${migratedBands}/${catalog.bands.length}`)
if (errors.length) {
  for (const error of errors) console.error(`오류: ${error}`)
  process.exitCode = 1
} else {
  console.log('taxonomy 오류 없음')
}
