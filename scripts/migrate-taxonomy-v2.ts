import { readFile, writeFile } from 'node:fs/promises'
import type { GenreTaxonomyId, MoodId, MoodScore } from '../src/types/taxonomy.ts'

interface LegacyBand {
  id: string
  name: string
  subgenres: string[]
  taxonomyV2?: Classification
  [key: string]: unknown
}
interface CatalogFile { schemaVersion: number; updatedAt: string; bands: LegacyBand[] }
interface TaxonomyFile { genres: Array<{ id: GenreTaxonomyId }>; subgenres: Array<{ id: string }>; moods: Array<{ id: MoodId }> }
interface Classification {
  primaryGenreId: GenreTaxonomyId
  secondaryGenreIds: GenreTaxonomyId[]
  subgenreIds: string[]
  moodScores: Partial<Record<MoodId, MoodScore>>
  reviewStatus: 'draft'
  reviewNote: string
}
type Draft = Omit<Classification, 'subgenreIds' | 'reviewStatus' | 'reviewNote'> & { addSubgenreIds?: string[] }

const G = {
  classic: 'classic-roots-rock', hard: 'hard-glam-rock', pop: 'pop-soft-rock', prog: 'progressive-art-psychedelic',
  punk: 'punk-emo', indie: 'indie-britpop-garage', postPunk: 'post-punk-goth-new-wave', alt: 'alternative-grunge',
  dream: 'shoegaze-dream-post', traditional: 'traditional-power-thrash-metal', folkMetal: 'folk-symphonic-metal',
  extreme: 'extreme-metal', modernMetal: 'modern-alternative-metal',
} as const satisfies Record<string, GenreTaxonomyId>

const S: Record<string, string> = {
  '팝 록': 'pop-rock', '사이키델릭 록': 'psychedelic-rock', '아트 록': 'art-rock', '블루스 록': 'blues-rock',
  '루츠 록': 'roots-rock', '하드 록': 'hard-rock', '모드 록': 'mod-rock', '록 오페라': 'rock-opera',
  '포크 록': 'folk-rock', '프로토 메탈': 'proto-metal', '아레나 록': 'arena-rock', '글램 메탈': 'glam-metal',
  '스페이스 록': 'space-rock', '프로그레시브 록': 'progressive-rock', '실험 록': 'experimental-rock',
  '심포닉 프로그': 'symphonic-prog', '네오 프로그': 'neo-prog', '포스트 프로그': 'post-prog',
  '프로그레시브 메탈': 'progressive-metal', '펑크 록': 'punk-rock', '팝 펑크': 'pop-punk',
  '개러지 펑크': 'garage-punk', '포스트 펑크': 'post-punk', '레게 록': 'reggae-rock', '아나키 펑크': 'anarcho-punk',
  '얼터너티브 록': 'alternative-rock', '전자 록': 'electronic-rock', '인디 록': 'indie-rock',
  '노이즈 팝': 'noise-pop', '노이즈 록': 'noise-rock', '노 웨이브': 'no-wave', '그런지': 'grunge',
  '얼터너티브 메탈': 'alternative-metal', '슬러지 메탈': 'sludge-metal', '헤비 메탈': 'traditional-heavy-metal',
  '둠 메탈': 'doom-metal', 'NWOBHM': 'nwobhm', '스피드 메탈': 'speed-metal', '스래시 메탈': 'thrash-metal',
  '아트 메탈': 'art-metal', '데스 메탈': 'death-metal', '테크니컬 데스 메탈': 'technical-death-metal',
  '프로그레시브 데스 메탈': 'progressive-death-metal', '멜로딕 데스 메탈': 'melodic-death-metal',
  '파워 메탈': 'power-metal', '네오클래시컬 메탈': 'neoclassical-metal', '고딕 록': 'gothic-rock',
  '인더스트리얼 록': 'industrial-rock', '인더스트리얼 메탈': 'industrial-metal',
  '노이에 도이체 헤르테': 'neue-deutsche-harte', '재즈 록': 'jazz-rock', '소프트 록': 'soft-rock',
  '서던 록': 'southern-rock', '포스트 록': 'post-rock', '인스트루멘털 록': 'instrumental-rock',
  '슈게이즈': 'shoegaze', '드림 팝': 'dream-pop', '포스트 브릿팝': 'post-britpop', '일렉트로팝': 'electropop',
  '인디 팝': 'indie-pop', '브릿팝': 'britpop', '신스팝': 'synthpop', '댄스 펑크': 'dance-punk',
  '포스트 펑크 리바이벌': 'post-punk-revival', '포스트 그런지': 'post-grunge', '팝': 'pop-rock'
}

const drafts: Record<string, Draft> = {
  'the-beatles': { primaryGenreId: G.classic, secondaryGenreIds: [G.pop, G.prog], moodScores: { 'bright-upbeat': 4, 'warm-comforting': 3, 'cosmic-psychedelic': 3, 'experimental-weird': 4, 'anthemic-live': 4 } },
  'the-rolling-stones': { primaryGenreId: G.classic, secondaryGenreIds: [G.hard], moodScores: { 'groovy-danceable': 5, 'riff-solo-driven': 4, 'anthemic-live': 4, 'acoustic-organic': 3 } },
  'the-who': { primaryGenreId: G.classic, secondaryGenreIds: [G.hard, G.prog], moodScores: { 'aggressive-heavy': 4, 'riff-solo-driven': 4, 'epic-cinematic': 3, 'anthemic-live': 5 } },
  'led-zeppelin': { primaryGenreId: G.hard, secondaryGenreIds: [G.classic, G.prog], moodScores: { 'massive-heavy': 5, 'acoustic-organic': 3, 'epic-cinematic': 4, 'riff-solo-driven': 5 } },
  'acdc': { primaryGenreId: G.hard, secondaryGenreIds: [], moodScores: { 'fast-driving': 4, 'groovy-danceable': 4, 'riff-solo-driven': 5, 'anthemic-live': 5 } },
  'guns-n-roses': { primaryGenreId: G.hard, secondaryGenreIds: [], moodScores: { 'aggressive-heavy': 4, 'romantic-emotional': 3, 'riff-solo-driven': 5, 'anthemic-live': 4 } },
  'pink-floyd': { primaryGenreId: G.prog, secondaryGenreIds: [G.classic], moodScores: { 'melancholic-lonely': 4, 'dreamy-ethereal': 5, 'cosmic-psychedelic': 5, 'experimental-weird': 5, 'long-form-immersive': 5 } },
  'king-crimson': { primaryGenreId: G.prog, secondaryGenreIds: [], moodScores: { 'dark-gloomy': 4, 'technical-complex': 5, 'experimental-weird': 5, 'long-form-immersive': 4 } },
  'yes': { primaryGenreId: G.prog, secondaryGenreIds: [], moodScores: { 'hopeful-uplifting': 4, 'epic-cinematic': 5, 'technical-complex': 5, 'long-form-immersive': 5 } },
  'porcupine-tree': { primaryGenreId: G.prog, secondaryGenreIds: [G.modernMetal], moodScores: { 'massive-heavy': 3, 'melancholic-lonely': 4, 'dreamy-ethereal': 4, 'technical-complex': 4, 'long-form-immersive': 4 } },
  'ramones': { primaryGenreId: G.punk, secondaryGenreIds: [], moodScores: { 'bright-upbeat': 4, 'fast-driving': 5, 'youth-rebellious': 5, 'anthemic-live': 4 } },
  'the-clash': { primaryGenreId: G.punk, secondaryGenreIds: [G.postPunk], moodScores: { 'fast-driving': 4, 'groovy-danceable': 4, 'youth-rebellious': 5, 'experimental-weird': 3 } },
  'sex-pistols': { primaryGenreId: G.punk, secondaryGenreIds: [], moodScores: { 'fast-driving': 4, 'aggressive-heavy': 5, 'youth-rebellious': 5 } },
  'radiohead': { primaryGenreId: G.alt, secondaryGenreIds: [G.prog, G.dream], moodScores: { 'melancholic-lonely': 5, 'dreamy-ethereal': 4, 'cold-urban': 4, 'electronic-synth': 4, 'experimental-weird': 5 } },
  'pixies': { primaryGenreId: G.alt, secondaryGenreIds: [G.indie], moodScores: { 'youth-rebellious': 3, 'noisy-wall': 4, 'experimental-weird': 4, 'anthemic-live': 3 } },
  'sonic-youth': { primaryGenreId: G.alt, secondaryGenreIds: [G.postPunk], moodScores: { 'cold-urban': 4, 'noisy-wall': 5, 'experimental-weird': 5 } },
  'nirvana': { primaryGenreId: G.alt, secondaryGenreIds: [G.punk], moodScores: { 'aggressive-heavy': 4, 'melancholic-lonely': 5, 'youth-rebellious': 5, 'noisy-wall': 4, 'anthemic-live': 4 } },
  'pearl-jam': { primaryGenreId: G.alt, secondaryGenreIds: [G.classic], moodScores: { 'hopeful-uplifting': 3, 'romantic-emotional': 4, 'riff-solo-driven': 4, 'anthemic-live': 5 } },
  'alice-in-chains': { primaryGenreId: G.alt, secondaryGenreIds: [G.modernMetal], moodScores: { 'massive-heavy': 5, 'melancholic-lonely': 5, 'dark-gloomy': 5, 'riff-solo-driven': 4 } },
  'black-sabbath': { primaryGenreId: G.traditional, secondaryGenreIds: [G.extreme, G.hard], moodScores: { 'massive-heavy': 5, 'dark-gloomy': 5, 'long-form-immersive': 3, 'riff-solo-driven': 5 } },
  'iron-maiden': { primaryGenreId: G.traditional, secondaryGenreIds: [], moodScores: { 'fast-driving': 4, 'epic-cinematic': 5, 'riff-solo-driven': 5, 'anthemic-live': 5 } },
  'metallica': { primaryGenreId: G.traditional, secondaryGenreIds: [], moodScores: { 'fast-driving': 5, 'aggressive-heavy': 5, 'epic-cinematic': 4, 'riff-solo-driven': 5, 'anthemic-live': 5 } },
  'tool': { primaryGenreId: G.prog, secondaryGenreIds: [G.modernMetal], moodScores: { 'massive-heavy': 5, 'dark-gloomy': 4, 'technical-complex': 5, 'experimental-weird': 4, 'long-form-immersive': 5 } },
  'slayer': { primaryGenreId: G.traditional, secondaryGenreIds: [G.extreme], moodScores: { 'fast-driving': 5, 'aggressive-heavy': 5, 'dark-gloomy': 4, 'riff-solo-driven': 5 } },
  'death': { primaryGenreId: G.extreme, secondaryGenreIds: [G.prog], moodScores: { 'fast-driving': 4, 'aggressive-heavy': 5, 'dark-gloomy': 4, 'technical-complex': 5 } },
  'children-of-bodom': { primaryGenreId: G.extreme, secondaryGenreIds: [G.traditional], moodScores: { 'fast-driving': 5, 'aggressive-heavy': 5, 'epic-cinematic': 4, 'technical-complex': 4 } },
  'the-cure': { primaryGenreId: G.postPunk, secondaryGenreIds: [G.alt, G.dream], moodScores: { 'melancholic-lonely': 5, 'dark-gloomy': 5, 'romantic-emotional': 4, 'dreamy-ethereal': 4, 'cold-urban': 5 } },
  'nine-inch-nails': { primaryGenreId: G.modernMetal, secondaryGenreIds: [G.alt], moodScores: { 'aggressive-heavy': 5, 'dark-gloomy': 5, 'electronic-synth': 5, 'experimental-weird': 4 } },
  'rammstein': { primaryGenreId: G.modernMetal, secondaryGenreIds: [], moodScores: { 'aggressive-heavy': 4, 'massive-heavy': 5, 'electronic-synth': 5, 'epic-cinematic': 4, 'anthemic-live': 5 } },
  'steely-dan': { primaryGenreId: G.pop, secondaryGenreIds: [G.prog, G.classic], moodScores: { 'groovy-danceable': 5, 'cold-urban': 3, 'technical-complex': 4, 'experimental-weird': 2 } },
  'lynyrd-skynyrd': { primaryGenreId: G.classic, secondaryGenreIds: [G.hard], moodScores: { 'warm-comforting': 3, 'acoustic-organic': 4, 'riff-solo-driven': 5, 'anthemic-live': 5 } },
  'mogwai': { primaryGenreId: G.dream, secondaryGenreIds: [G.prog], moodScores: { 'slow-calm': 4, 'dreamy-ethereal': 5, 'noisy-wall': 4, 'epic-cinematic': 5, 'long-form-immersive': 5 } },
  'my-bloody-valentine': { primaryGenreId: G.dream, secondaryGenreIds: [G.alt], moodScores: { 'romantic-emotional': 4, 'dreamy-ethereal': 5, 'noisy-wall': 5, 'experimental-weird': 4 } },
  'megadeth': { primaryGenreId: G.traditional, secondaryGenreIds: [], moodScores: { 'fast-driving': 5, 'aggressive-heavy': 5, 'technical-complex': 5, 'riff-solo-driven': 5 } },
  'travis': { primaryGenreId: G.indie, secondaryGenreIds: [G.pop], moodScores: { 'melancholic-lonely': 4, 'warm-comforting': 3, 'romantic-emotional': 4, 'anthemic-live': 3 } },
  'imagine-dragons': { primaryGenreId: G.pop, secondaryGenreIds: [G.alt], moodScores: { 'bright-upbeat': 3, 'massive-heavy': 3, 'hopeful-uplifting': 4, 'electronic-synth': 4, 'anthemic-live': 5 } },
  'oasis': { primaryGenreId: G.indie, secondaryGenreIds: [G.alt], moodScores: { 'bright-upbeat': 4, 'youth-rebellious': 4, 'riff-solo-driven': 3, 'anthemic-live': 5 } },
  'queen': { primaryGenreId: G.hard, secondaryGenreIds: [G.pop, G.prog], moodScores: { 'bright-upbeat': 4, 'romantic-emotional': 4, 'epic-cinematic': 5, 'technical-complex': 3, 'anthemic-live': 5 } },
  'one-republic': { primaryGenreId: G.pop, secondaryGenreIds: [], moodScores: { 'bright-upbeat': 3, 'romantic-emotional': 4, 'hopeful-uplifting': 4, 'electronic-synth': 3, 'anthemic-live': 5 } },
  'kent': { primaryGenreId: G.alt, secondaryGenreIds: [G.postPunk, G.pop], moodScores: { 'melancholic-lonely': 5, 'romantic-emotional': 4, 'cold-urban': 4, 'electronic-synth': 4 } },
  'coldplay': { primaryGenreId: G.pop, secondaryGenreIds: [G.alt], moodScores: { 'warm-comforting': 4, 'romantic-emotional': 5, 'hopeful-uplifting': 5, 'anthemic-live': 5 } },
  'judas-priest': { primaryGenreId: G.traditional, secondaryGenreIds: [], moodScores: { 'fast-driving': 4, 'epic-cinematic': 4, 'riff-solo-driven': 5, 'anthemic-live': 5 } },
  'two-door-cinema-club': { primaryGenreId: G.indie, secondaryGenreIds: [G.postPunk, G.pop], moodScores: { 'bright-upbeat': 5, 'fast-driving': 4, 'groovy-danceable': 5, 'electronic-synth': 4 } },
  'green-day': { primaryGenreId: G.punk, secondaryGenreIds: [G.alt], moodScores: { 'bright-upbeat': 4, 'fast-driving': 4, 'youth-rebellious': 5, 'anthemic-live': 5 } },
  'theory-of-a-deadman': { primaryGenreId: G.alt, secondaryGenreIds: [G.hard], moodScores: { 'groovy-danceable': 4, 'massive-heavy': 4, 'riff-solo-driven': 4, 'anthemic-live': 4 } },
  'bon-jovi': { primaryGenreId: G.hard, secondaryGenreIds: [G.pop], moodScores: { 'bright-upbeat': 4, 'romantic-emotional': 4, 'hopeful-uplifting': 4, 'riff-solo-driven': 4, 'anthemic-live': 5 } }
}

const catalogUrl = new URL('../src/data/catalog.json', import.meta.url)
const taxonomyUrl = new URL('../src/data/taxonomy.v2.json', import.meta.url)
const reportUrl = new URL('../docs/taxonomy-v2-dry-run.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8')) as CatalogFile
const taxonomy = JSON.parse(await readFile(taxonomyUrl, 'utf8')) as TaxonomyFile
const validGenres = new Set(taxonomy.genres.map((genre) => genre.id))
const validSubgenres = new Set(taxonomy.subgenres.map((subgenre) => subgenre.id))
const validMoods = new Set(taxonomy.moods.map((mood) => mood.id))
const errors: string[] = []

const migratedBands = catalog.bands.map((band) => {
  const draft = drafts[band.id]
  if (!draft) {
    errors.push(`${band.id}: 분류 초안 없음`)
    return band
  }
  const subgenreIds = [...new Set([...band.subgenres.map((name) => S[name]).filter(Boolean), ...(draft.addSubgenreIds ?? [])])]
  if (!validGenres.has(draft.primaryGenreId)) errors.push(`${band.id}: 잘못된 대표 장르 ${draft.primaryGenreId}`)
  for (const id of draft.secondaryGenreIds) if (!validGenres.has(id)) errors.push(`${band.id}: 잘못된 보조 장르 ${id}`)
  for (const id of subgenreIds) if (!validSubgenres.has(id)) errors.push(`${band.id}: 잘못된 세부 장르 ${id}`)
  for (const [id, score] of Object.entries(draft.moodScores)) {
    if (!validMoods.has(id as MoodId)) errors.push(`${band.id}: 잘못된 분위기 ${id}`)
    if (!Number.isInteger(score) || score < 0 || score > 5) errors.push(`${band.id}: 잘못된 분위기 점수 ${id}=${score}`)
  }
  const taxonomyV2: Classification = {
    primaryGenreId: draft.primaryGenreId,
    secondaryGenreIds: [...new Set(draft.secondaryGenreIds)].filter((id) => id !== draft.primaryGenreId),
    subgenreIds,
    moodScores: draft.moodScores,
    reviewStatus: 'draft',
    reviewNote: '기존 편집 데이터와 MusicBrainz 장르·태그를 교차한 1차 초안. Studio 운영자 검토 필요.',
  }
  return { ...band, taxonomyV2 }
})

for (const id of Object.keys(drafts)) if (!catalog.bands.some((band) => band.id === id)) errors.push(`${id}: 카탈로그에 없는 분류 초안`)
const distribution = Object.fromEntries(taxonomy.genres.map((genre) => [genre.id, migratedBands.filter((band) => band.taxonomyV2?.primaryGenreId === genre.id).length]))
const unmappedLabels = [...new Set(catalog.bands.flatMap((band) => band.subgenres).filter((name) => !S[name] && name !== '록' && name !== '익스트림 메탈'))]
const report = { generatedAt: new Date().toISOString(), applyRequested: process.argv.includes('--apply'), errors, distribution, unmappedLabels, bands: migratedBands.map((band) => ({ id: band.id, name: band.name, taxonomyV2: band.taxonomyV2 })) }
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log('taxonomy v2 밴드 마이그레이션 dry-run')
console.log(`밴드 ${catalog.bands.length} · 분류 초안 ${Object.keys(drafts).length} · 오류 ${errors.length}`)
console.log(`대표 장르 분포: ${Object.entries(distribution).map(([id, count]) => `${id} ${count}`).join(' · ')}`)
console.log(`미매핑 표시 문자열: ${unmappedLabels.length ? unmappedLabels.join(', ') : '없음'}`)
if (errors.length) {
  for (const error of errors) console.error(`오류: ${error}`)
  process.exitCode = 1
} else if (process.argv.includes('--apply')) {
  await writeFile(catalogUrl, `${JSON.stringify({ ...catalog, schemaVersion: 2, updatedAt: new Date().toISOString(), bands: migratedBands }, null, 2)}\n`, 'utf8')
  console.log('src/data/catalog.json에 taxonomyV2를 병행 추가했습니다.')
} else {
  console.log('dry-run만 수행했습니다. catalog.json은 변경하지 않았습니다.')
}
