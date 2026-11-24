/**
 * 정규 음반 수집 (plan P4-1). 밴드의 MusicBrainz MBID로 release-group(type=album, 보조 타입 없음)을 가져온다.
 *   node --experimental-strip-types scripts/collect-albums.ts            → 후보만 scripts/data/album-candidates.json 에 저장
 *   node --experimental-strip-types scripts/collect-albums.ts --apply    → `albums`가 비어 있는 밴드에 반영
 *   ... --apply --replace                                                → 추천·해설을 안 단 밴드의 목록을 새로 받은 것으로 교체
 *   ... --only=metallica,slayer                                           → 일부 밴드만
 *
 * 부틀렉만 있는 음반은 `release-group-status=website-default`로 거른다(MusicBrainz 웹 화면과 같은 기준).
 * MusicBrainz는 초당 1회 제한이므로 요청 사이 1.2초를 쉬고, 응답은 scripts/.cache/musicbrainz/ 에 캐시한다.
 * 가져오는 것은 제목·첫 발매 연도·출처뿐이다. 입문 추천(`essential`)과 해설(`note`)은 사람이 단다.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Json = Record<string, any>
const apply = process.argv.includes('--apply')
const replace = process.argv.includes('--replace')
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7).split(',').filter(Boolean)
const cacheDir = resolve('scripts/.cache/musicbrainz')
const catalogPath = resolve('src/data/catalog.json')
const candidatesPath = resolve('scripts/data/album-candidates.json')
await mkdir(cacheDir, { recursive: true })

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))
let lastRequest = 0

async function releaseGroups(mbid: string): Promise<Json[]> {
  const cacheFile = resolve(cacheDir, `${mbid}.json`)
  try { return JSON.parse(await readFile(cacheFile, 'utf8')) } catch { /* not cached */ }
  const all: Json[] = []
  for (let offset = 0; ; offset += 100) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const wait = 1200 - (Date.now() - lastRequest)
      if (wait > 0) await sleep(wait)
      lastRequest = Date.now()
      const response = await fetch(`https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&release-group-status=website-default&fmt=json&limit=100&offset=${offset}`, {
        headers: { 'User-Agent': 'RockAtlasCatalog/0.1 (catalog maintenance script)', Accept: 'application/json' },
      })
      if (response.status === 503 || response.status === 429) { await sleep(3000 * (attempt + 1)); continue }
      if (!response.ok) throw new Error(`MusicBrainz ${response.status} for ${mbid}`)
      const page = await response.json() as Json
      all.push(...(page['release-groups'] ?? []))
      if (offset + 100 >= (page['release-group-count'] ?? 0)) {
        await writeFile(cacheFile, JSON.stringify(all), 'utf8')
        return all
      }
      break
    }
  }
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Json
const candidates: Record<string, Json[]> = {}
let applied = 0
for (const band of catalog.bands as Json[]) {
  if (only && !only.includes(band.id)) continue
  const source = (band.sources as Json[]).find((item) => item.publisher === 'MusicBrainz')
  const mbid = source?.externalId ?? source?.url?.match(/artist\/([0-9a-f-]{36})/)?.[1]
  if (!mbid) continue
  const groups = await releaseGroups(mbid)
  const studio = groups
    .filter((group) => group['primary-type'] === 'Album' && !(group['secondary-types'] ?? []).length && /^\d{4}/.test(group['first-release-date'] ?? ''))
    // 결성 전 음반은 개명 전 이름의 작품이다(Maroon 5의 Kara's Flowers, Korpiklaani의 Shaman). 연표에는 넣지 않는다.
    .filter((group) => Number(String(group['first-release-date']).slice(0, 4)) >= band.formed - 1)
  const titleCount = new Map<string, number>()
  studio.forEach((group) => titleCount.set(group.title, (titleCount.get(group.title) ?? 0) + 1))
  const albums = studio
    .map((group) => ({
      // 같은 제목이 여럿이면(Weezer의 셀프 타이틀 6장) MusicBrainz 구분명을 붙인다: "Weezer (Blue Album)".
      title: (titleCount.get(group.title) ?? 0) > 1 && group.disambiguation ? `${group.title} (${group.disambiguation})` : String(group.title),
      year: Number(String(group['first-release-date']).slice(0, 4)),
      type: 'studio' as const,
      source: { label: `${band.name} — ${group.title} (MusicBrainz)`, url: `https://musicbrainz.org/release-group/${group.id}`, publisher: 'MusicBrainz', externalId: group.id, accessedAt: new Date().toISOString().slice(0, 10) },
    }))
    .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
  candidates[band.id] = albums
  // --replace: 사람이 추천·해설을 하나도 달지 않은 음반 목록은 새로 받은 목록으로 바꾼다.
  const untouched = !(band.albums ?? []).some((album: Json) => album.essential || album.note)
  if (apply && albums.length && (!(band.albums?.length) || (replace && untouched))) { band.albums = albums; applied += 1 }
  process.stdout.write(`${band.id}: ${albums.length}장\n`)
}
await writeFile(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8')
if (apply) {
  catalog.updatedAt = new Date().toISOString()
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
}
console.log(`후보 ${Object.keys(candidates).length}팀 저장${apply ? ` · ${applied}팀에 음반 반영` : ''}`)
