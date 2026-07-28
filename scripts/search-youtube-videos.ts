import { bands } from '../src/data/bands.ts'
import { writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const selectedBandId = args.find((arg) => arg.startsWith('--band='))?.split('=')[1]
const selectedTrackId = args.find((arg) => arg.startsWith('--track='))?.split('=')[1]
const customQuery = args.find((arg) => arg.startsWith('--query='))?.slice('--query='.length)
const asJson = args.includes('--json')
const searchAll = args.includes('--all')
const blockedOnly = args.includes('--blocked-only')
const draftOnly = args.includes('--draft-only')
const needsDirect = args.includes('--needs-direct')
const officialOnly = args.includes('--official-only')
const compactJson = args.includes('--compact')
const outputPath = args.find((arg) => arg.startsWith('--output='))?.slice('--output='.length)
const candidateLimit = Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 12)
const selectedBands = searchAll
  ? bands.filter((band) => !draftOnly || band.reviewStatus === 'draft')
  : bands.filter((item) => item.id === selectedBandId)

if (selectedBands.length === 0) {
  console.error('사용법: npm run search:videos -- --band=<band-id> [--track=<track-id>] 또는 --all')
  process.exit(1)
}

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '').replace(/^the/, '')
const labelPattern = /(abkco|4ad|rhino|warner|parlophone|atlantic|columbia|capitol|universal|sony|geffen|emi|nuclear blast|roadrunner|earmusic|relapse)/i
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function extractJsonObjects(html: string, marker: string) {
  const objects: unknown[] = []
  let cursor = 0
  while (objects.length < 12) {
    const markerIndex = html.indexOf(marker, cursor)
    if (markerIndex < 0) break
    const start = html.indexOf('{', markerIndex + marker.length)
    if (start < 0) break
    let depth = 0
    let inString = false
    let escaped = false
    let end = start
    for (; end < html.length; end += 1) {
      const char = html[end]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          end += 1
          break
        }
      }
    }
    try {
      objects.push(JSON.parse(html.slice(start, end)))
    } catch {
      // YouTube markup can change; skip only the malformed renderer.
    }
    cursor = end
  }
  return objects
}

async function search(bandName: string, trackTitle: string) {
  const url = new URL('https://www.youtube.com/results')
  url.search = new URLSearchParams({ search_query: `${bandName} ${trackTitle} official audio` }).toString()
  let response: Response | undefined
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      response = await fetch(url, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+667',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        },
      })
      break
    } catch (error) {
      if (attempt === 3) throw error
      await sleep(2000 * 2 ** attempt)
    }
  }
  if (!response) throw new Error('YouTube 검색 응답이 없습니다.')
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  const html = await response.text()
  const renderers = extractJsonObjects(html, '"videoRenderer":') as Array<{
    videoId?: string
    title?: { runs?: Array<{ text?: string }>; simpleText?: string }
    ownerText?: { runs?: Array<{ text?: string; navigationEndpoint?: { browseEndpoint?: { browseId?: string } } }> }
    badges?: Array<{ metadataBadgeRenderer?: { label?: string } }>
    publishedTimeText?: { simpleText?: string }
    lengthText?: { simpleText?: string }
  }>

  const candidates = renderers
    .filter((item) => item.videoId)
    .map((item) => ({
      youtubeId: item.videoId,
      title: item.title?.runs?.map((run) => run.text).join('') ?? item.title?.simpleText,
      channelName: item.ownerText?.runs?.[0]?.text,
      channelId: item.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
      verifiedBadge: item.badges?.some((badge) => badge.metadataBadgeRenderer?.label === 'Verified'),
      published: item.publishedTimeText?.simpleText,
      duration: item.lengthText?.simpleText,
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
    }))

  if (!officialOnly) return candidates.slice(0, candidateLimit)
  const normalizedBand = normalize(bandName)
  return candidates.filter((candidate) => {
    const channelName = candidate.channelName ?? ''
    const normalizedChannel = normalize(channelName.replace(/(?:vevo|official|- topic)$/i, ''))
    return candidate.verifiedBadge
      || normalizedChannel === normalizedBand
      || /(?:vevo|official|- topic)$/i.test(channelName)
      || labelPattern.test(channelName)
  }).slice(0, candidateLimit)
}

const results = []
let queryCount = 0
for (const band of selectedBands) {
  const tracks = customQuery
    ? [{ id: 'custom-query', title: customQuery, source: {} }]
    : selectedTrackId ? band.tracks.filter((track) => track.id === selectedTrackId) : band.tracks
  const targetTracks = needsDirect ? tracks.filter((track) => !('youtubeId' in track) || !track.youtubeId) : tracks
  if (targetTracks.length === 0 && (selectedTrackId || customQuery)) {
    console.error(`트랙을 찾을 수 없습니다: ${selectedTrackId}`)
    process.exit(1)
  }
  for (const track of targetTracks) {
    if (blockedOnly && 'embedStatus' in track.source && track.source.embedStatus === 'allowed') continue
    const currentYoutubeId = 'youtubeId' in track ? track.youtubeId : undefined
    if (queryCount > 0) await sleep(900)
    queryCount += 1
    let candidates: Awaited<ReturnType<typeof search>> = []
    try {
      candidates = (await search(band.name, track.title)).filter((candidate) => candidate.youtubeId !== currentYoutubeId)
    } catch (error) {
      console.error(`${band.name} — ${track.title}: 검색 실패 (${error instanceof Error ? error.message : String(error)})`)
    }
    results.push({
      bandId: band.id,
      bandName: band.name,
      trackId: track.id,
      expectedTitle: track.title,
      currentYoutubeId,
      candidates,
    })
  }
}

if (asJson || outputPath) {
  const output = compactJson ? results.map((result) => ({
    ...result,
    candidates: result.candidates.map(({ youtubeId, title, channelName, channelId }) => ({ youtubeId, title, channelName, channelId })),
  })) : results
  const serialized = JSON.stringify({ results: output }, null, compactJson ? 0 : 2)
  if (outputPath) {
    await writeFile(outputPath, `${serialized}\n`, 'utf8')
    console.log(`YouTube 후보 ${results.length}곡을 ${outputPath}에 저장했습니다.`)
  } else console.log(serialized)
} else {
  console.log(`ROCK ATLAS YouTube 공식 영상 검색 — ${searchAll ? `${selectedBands.length}개 밴드` : selectedBands[0].name}`)
  for (const result of results) {
    console.log(`\n${result.bandName} — ${result.expectedTitle}`)
    for (const [index, candidate] of result.candidates.entries()) {
      console.log(`  ${index + 1}. ${candidate.youtubeId} · ${candidate.channelName ?? '?'}${candidate.verifiedBadge ? ' ✓' : ''} · ${candidate.title}`)
    }
  }
  console.log('\n채널의 공식성, 영상 제목, oEmbed와 실제 임베드 상태를 다시 확인한 뒤 데이터에 반영하세요.')
}
