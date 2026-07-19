import { readFile, writeFile } from 'node:fs/promises'

interface SourceRef { publisher: string; externalId?: string }
interface BandRecord { id: string; name: string; sources: SourceRef[] }
interface CatalogFile { bands: BandRecord[] }
interface TagItem { name: string; count?: number }
interface MusicBrainzArtist { genres?: TagItem[]; tags?: TagItem[] }

const catalogUrl = new URL('../src/data/catalog.json', import.meta.url)
const outputUrl = new URL('../docs/taxonomy-signals.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8')) as CatalogFile
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function fetchArtist(mbid: string) {
  const url = `https://musicbrainz.org/ws/2/artist/${mbid}?inc=genres+tags&fmt=json`
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RockAtlasTaxonomyReview/0.2 (https://github.com/kinggodyoung5/rockatlas)',
      },
    })
    if (response.ok) return await response.json() as MusicBrainzArtist
    if (attempt === 2) throw new Error(`MusicBrainz ${response.status}`)
    await wait(2200)
  }
  throw new Error('MusicBrainz 응답 없음')
}

const results = []
for (const [index, band] of catalog.bands.entries()) {
  const mbid = band.sources.find((source) => source.publisher === 'MusicBrainz')?.externalId
  if (!mbid) {
    results.push({ id: band.id, name: band.name, mbid: null, genres: [], tags: [], error: 'MBID 없음' })
    continue
  }
  try {
    const artist = await fetchArtist(mbid)
    const byCount = (a: TagItem, b: TagItem) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name)
    results.push({
      id: band.id,
      name: band.name,
      mbid,
      genres: [...(artist.genres ?? [])].sort(byCount).slice(0, 20),
      tags: [...(artist.tags ?? [])].sort(byCount).slice(0, 30),
    })
    console.log(`${index + 1}/${catalog.bands.length} ${band.name}`)
  } catch (error) {
    results.push({ id: band.id, name: band.name, mbid, genres: [], tags: [], error: error instanceof Error ? error.message : String(error) })
  }
  if (index < catalog.bands.length - 1) await wait(1100)
}

await writeFile(outputUrl, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'MusicBrainz artist genres and community tags',
  note: '장르와 분위기 편집을 위한 참고 신호이며 자동 승인 근거로 사용하지 않는다.',
  bands: results,
}, null, 2)}\n`, 'utf8')

const errors = results.filter((item) => 'error' in item)
console.log(`완료: ${results.length - errors.length}/${results.length} · 확인 실패 ${errors.length}`)
console.log('docs/taxonomy-signals.json에 저장했습니다.')
