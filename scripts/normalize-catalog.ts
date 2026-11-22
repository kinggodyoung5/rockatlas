/**
 * Catalog notation normalizer (improvement plan P1-1/P1-2).
 *
 *   npm run normalize:check   → report violations, exit 1 if any
 *   npm run normalize:write   → fix what can be fixed safely, report what needs a human
 *
 * Only rewrites notation, never facts: origins are only translated through the reviewed
 * dictionaries in scripts/data/, and anything not in them is listed instead of guessed.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Json = Record<string, any>

const root = resolve('.')
const catalogPath = resolve(root, 'src/data/catalog.json')
const write = process.argv.includes('--write')

const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Json
const cityNames = JSON.parse(await readFile(resolve(root, 'scripts/data/city-names-ko.json'), 'utf8')) as Record<string, string>
const manualKoreanNames = JSON.parse(await readFile(resolve(root, 'scripts/data/korean-names-manual.json'), 'utf8')) as Record<string, string>
const wikidataKoreanNames = JSON.parse(await readFile(resolve(root, 'scripts/data/korean-names-wikidata.json'), 'utf8').catch(() => '{}')) as Record<string, string>

const regionNames = new Intl.DisplayNames(['ko'], { type: 'region' })
const countryKo = (code: string) => code === 'XW' ? '다국적' : regionNames.of(code) ?? code

/** Places whose recorded origin was wrong or too vague, checked against the band's Wikipedia article. */
const originOverrides: Record<string, string> = {
  steppenwolf: '로스앤젤레스, 미국', // formed in LA in 1967 out of the Toronto band The Sparrows
  chickenfoot: '카보산루카스, 멕시코', // formed at Sammy Hagar's club in Cabo San Lucas; the band itself is American
  'arctic-monkeys': '셰필드, 영국', // High Green is a Sheffield suburb
  'alabama-shakes': '애선스, 미국', // Athens, Alabama
  'r-e-m': '애선스, 미국', // Athens, Georgia (was transcribed as the Greek "아테네")
  'racer-x': '로스앤젤레스, 미국',
  'slash-feat-myles-kennedy-the-conspirators': '로스앤젤레스, 미국',
  'generation-axe': '다국적',
  overkill: '올드브리지, 미국',
  'lorna-shore': '뉴저지, 미국',
  'x-ambassadors': '이타카, 미국',
}

/** UK constituent countries and other spellings that should fold into the ISO country name. */
const countryWordAliases = new Set(['잉글랜드', '스코틀랜드', '웨일스', '북아일랜드', '호주', '영국', '미국'])

const violations: string[] = []
const needsHuman: string[] = []
let changes = 0
const note = (message: string) => violations.push(message)
const set = (target: Json, key: string, value: unknown, label: string) => {
  if (JSON.stringify(target[key]) === JSON.stringify(value)) return
  note(`${label}: ${JSON.stringify(target[key])} → ${JSON.stringify(value)}`)
  if (write) { target[key] = value; changes += 1 }
}

function normalizeYears(value: string) {
  return value
    .replace(/present/gi, '현재')
    .replace(/(\d{4})\s*[-—]\s*(\d{4}|현재)/g, '$1–$2')
    .replace(/(\d{4})\s*–\s*/g, '$1–')
    .replace(/\s*,\s*/g, ', ')
    .trim()
}

function normalizeOrigin(band: Json): string | null {
  if (originOverrides[band.id]) return originOverrides[band.id]
  const country = countryKo(band.countryCode)
  const origin = String(band.origin ?? '').replace(/^\[|\]$/g, '').trim()
  const parts = origin.split(',').map((part) => part.trim()).filter(Boolean)
  const city = parts[0] ?? ''
  if (/^[가-힣]/.test(city)) {
    // Already Korean: keep the city, drop the state/constituent, end with the ISO country name.
    const last = parts.at(-1) ?? ''
    if (parts.length > 1 && !countryWordAliases.has(last) && last !== country) {
      needsHuman.push(`${band.id}: 출신지 국가 "${last}"가 국가 코드 ${band.countryCode}(${country})와 다름 — "${origin}"`)
      return null
    }
    return `${city}, ${country}`
  }
  const korean = cityNames[city]
  if (!korean) {
    needsHuman.push(`${band.id}: 도시 사전에 없음 — "${origin}" (scripts/data/city-names-ko.json에 추가)`)
    return null
  }
  return `${korean}, ${country}`
}

/** "~입니다./~습니다." → plain "~다." only for the exact endings that occur, so meaning never shifts. */
// Order matters: verb endings first, so "보입니다" never falls through to the copula rule ("보다").
const politeEndings: [RegExp, string][] = [
  [/보입니다\.$/, '보인다.'],
  [/주었습니다\.$/, '줬다.'],
  [/받았습니다\.$/, '받았다.'],
  [/합니다\.$/, '한다.'],
  [/습니다\.$/, '다.'],
  [/입니다\.$/, '이다.'],
]
function plainEnding(text: string) {
  const trimmed = text.trim()
  const rule = politeEndings.find(([pattern]) => pattern.test(trimmed))
  if (!rule) return trimmed
  const next = trimmed.replace(rule[0], rule[1])
  if (rule[1] !== '이다.') return next
  // Copula after a vowel-final noun drops its 이: "주자이다" → "주자다", "밴드이다" → "밴드다".
  return next.replace(/([가-힣])이다\.$/, (match, last: string) => ((last.charCodeAt(0) - 0xac00) % 28 === 0 ? `${last}다.` : match))
}

const aiReviewers = new Set(['자동 검수 (AI)', 'Claude (AI 검수)'])
const aiReviewerLabel = 'ROCK ATLAS editorial (AI 보조)'

for (const band of catalog.bands as Json[]) {
  const label = band.id
  set(band, 'activeYears', normalizeYears(band.activeYears), `${label}.activeYears`)
  for (const member of band.members ?? []) {
    if (member.activeYears) set(member, 'activeYears', normalizeYears(member.activeYears), `${label}.members[${member.name}].activeYears`)
  }

  const origin = normalizeOrigin(band)
  if (origin) set(band, 'origin', origin, `${label}.origin`)

  for (const relation of band.relations ?? []) {
    if (/니다\.$/.test(relation.note.trim()) && !/아니다\.$/.test(relation.note.trim())) set(relation, 'note', plainEnding(relation.note), `${label}→${relation.targetBandId}.note`)
    if (aiReviewers.has(relation.reviewedBy)) set(relation, 'reviewedBy', aiReviewerLabel, `${label}→${relation.targetBandId}.reviewedBy`)
  }

  for (const track of band.tracks ?? []) {
    if (/^single$/i.test(track.album ?? '')) {
      note(`${label}/${track.id}: album "Single" → releaseType "single"`)
      if (write) { delete track.album; track.releaseType = 'single'; changes += 1 }
    }
    if (aiReviewers.has(track.reviewedBy)) set(track, 'reviewedBy', aiReviewerLabel, `${label}/${track.id}.reviewedBy`)
  }
  if (aiReviewers.has(band.reviewedBy)) set(band, 'reviewedBy', aiReviewerLabel, `${label}.reviewedBy`)

  // Tag spellings that drifted from the taxonomy's own names (search matches the taxonomy spelling).
  const spelledTags = [...new Set((band.tags as string[]).map((tag) => tag.replace(/그란지/g, '그런지').replace(/리바이블/g, '리바이벌').replace(/슈게이징/g, '슈게이즈')))]
  set(band, 'tags', spelledTags, `${label}.tags(spelling)`)
  // Korean name as the first search alias so "메탈리카" finds Metallica. Existing tags are kept.
  const koreanName = manualKoreanNames[band.id] ?? wikidataKoreanNames[band.id]
  const currentTags = write ? band.tags as string[] : spelledTags
  if (koreanName && !currentTags.includes(koreanName)) set(band, 'tags', [koreanName, ...currentTags], `${label}.tags`)
  if (!koreanName) needsHuman.push(`${label}: 한글 이름 없음 (scripts/data/korean-names-manual.json에 추가)`)

  if (/^[a-z]/.test(band.name) && band.id !== 'blink-182') needsHuman.push(`${label}: 밴드명이 소문자로 시작함 — "${band.name}"`)
}

if (write && changes) {
  catalog.updatedAt = new Date().toISOString()
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
}

const shown = violations.slice(0, 40)
console.log(`표기 정규화 ${write ? '적용' : '검사'} · 위반 ${violations.length}건${write ? ` · 수정 ${changes}건` : ''} · 사람 확인 필요 ${needsHuman.length}건`)
for (const line of shown) console.log(`- ${line}`)
if (violations.length > shown.length) console.log(`… 외 ${violations.length - shown.length}건`)
for (const line of needsHuman) console.log(`! ${line}`)
if (!write && (violations.length || needsHuman.length)) process.exit(1)
if (write && needsHuman.length) process.exit(1)
