import { bands } from '../src/data/bands.ts'

interface OEmbedResponse {
  title?: string
  author_name?: string
  author_url?: string
  thumbnail_url?: string
}

const args = process.argv.slice(2)
const selectedBandId = args.find((arg) => arg.startsWith('--band='))?.split('=')[1]
const asJson = args.includes('--json')
const strict = args.includes('--strict')
const selectedBands = selectedBandId ? bands.filter((band) => band.id === selectedBandId) : bands

if (selectedBands.length === 0) {
  console.error(`밴드를 찾을 수 없습니다: ${selectedBandId}`)
  process.exit(1)
}

const normalize = (value: string) => {
  const compact = value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  return compact.startsWith('the') ? compact.slice(3) : compact
}
const labelPattern = /(abkco|4ad|rhino|warner\s*records|parlophone|atlantic\s*records|columbia\s*records|capitol\s*records|universal\s*music|sony\s*music|geffen|emi|nuclear\s*blast|roadrunner\s*records|earmusic|relapse\s*records)/i
const officialAliases: Record<string, string[]> = {
  'children-of-bodom': ['cobofficial'],
  mogwai: ['mogwaitv'],
}

async function inspectVideo(bandName: string, youtubeId: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`
  const oembedUrl = new URL('https://www.youtube.com/oembed')
  oembedUrl.search = new URLSearchParams({ url: watchUrl, format: 'json' }).toString()

  let oembed: OEmbedResponse | undefined
  let oembedStatus: number | undefined
  try {
    const response = await fetch(oembedUrl, { headers: { 'User-Agent': 'RockAtlasVideoReview/0.1' } })
    oembedStatus = response.status
    if (response.ok) oembed = await response.json() as OEmbedResponse
  } catch {
    oembedStatus = 0
  }

  let embedStatus: string | undefined
  let playableInEmbed: boolean | undefined
  let embedHttpStatus: number | undefined
  try {
    const response = await fetch(`https://www.youtube-nocookie.com/embed/${youtubeId}?hl=en`, {
      headers: { Referer: 'http://127.0.0.1:4173/', 'User-Agent': 'RockAtlasVideoReview/0.1' },
    })
    embedHttpStatus = response.status
    const html = await response.text()
    embedStatus = html.match(/"playabilityStatus":\{"status":"([^"]+)"/)?.[1]
    const playable = html.match(/"playableInEmbed":(true|false)/)?.[1]
    if (playable) playableInEmbed = playable === 'true'
  } catch {
    embedHttpStatus = 0
  }

  const authorName = oembed?.author_name ?? ''
  const normalizedBand = normalize(bandName)
  const normalizedAuthor = normalize(authorName.replace(/(?:vevo|official|- topic)$/i, ''))
  const artistChannelMatch = Boolean(normalizedBand && normalizedAuthor && normalizedAuthor === normalizedBand)
  const topicChannel = /- Topic$/i.test(authorName)
  const labelChannel = labelPattern.test(authorName)
  const aliasChannel = (officialAliases[bands.find((band) => band.name === bandName)?.id ?? ''] ?? []).includes(normalize(authorName))

  return {
    youtubeId,
    watchUrl,
    title: oembed?.title,
    authorName: oembed?.author_name,
    authorUrl: oembed?.author_url,
    oembedStatus,
    embedHttpStatus,
    embedStatus,
    playableInEmbed,
    officialCandidate: artistChannelMatch || topicChannel || labelChannel || aliasChannel,
    candidateReason: artistChannelMatch ? 'artist-name-match' : topicChannel ? 'topic-channel' : labelChannel ? 'known-label-name' : aliasChannel ? 'official-alias' : 'manual-review',
  }
}

const jobs = selectedBands.flatMap((band) => band.tracks.map((track) => ({ band, track })))
const inspected = []
for (let index = 0; index < jobs.length; index += 5) {
  const batch = jobs.slice(index, index + 5)
  inspected.push(...await Promise.all(batch.map(async ({ band, track }) => ({
    bandId: band.id,
    bandName: band.name,
    trackId: track.id,
    expectedTitle: track.title,
    expectedChannelName: track.source.channelName,
    expectedChannelType: track.source.channelType,
    ...await inspectVideo(band.name, track.youtubeId),
  }))))
}

const normalizedChannelMatches = (actual: string | undefined, expected: string | undefined) =>
  Boolean(actual && expected && normalize(actual) === normalize(expected))
const failures = inspected.filter((item) =>
  item.oembedStatus !== 200
  || item.embedHttpStatus !== 200
  || !item.officialCandidate
  || !normalizedChannelMatches(item.authorName, item.expectedChannelName),
)

if (asJson) {
  console.log(JSON.stringify({ collectedAt: new Date().toISOString(), results: inspected }, null, 2))
} else {
  console.log('ROCK ATLAS YouTube 영상 검수 후보')
  for (const item of inspected) {
    const status = item.oembedStatus === 200 && item.embedHttpStatus === 200 ? 'available' : 'unavailable'
    console.log(`- ${item.bandName} — ${item.expectedTitle}: ${status} · ${item.authorName ?? '채널 미확인'} · ${item.candidateReason}`)
    if (item.embedStatus || item.playableInEmbed !== undefined) console.log(`  embed ${item.embedStatus ?? '?'} · playableInEmbed ${item.playableInEmbed ?? '?'}`)
  }
  const available = inspected.filter((item) => item.oembedStatus === 200 && item.embedHttpStatus === 200).length
  const officialCandidates = inspected.filter((item) => item.officialCandidate).length
  console.log(`\n접근 가능 ${available}/${inspected.length} · 공식 채널 후보 ${officialCandidates}/${inspected.length} · 자동 승인하지 않았습니다.`)
}

if (strict && failures.length > 0) {
  console.error(`엄격 검증 실패: ${failures.length}/${inspected.length}`)
  for (const item of failures) {
    console.error(`- ${item.bandName} — ${item.expectedTitle}: expected=${item.expectedChannelName ?? '?'} actual=${item.authorName ?? '?'} reason=${item.candidateReason}`)
  }
  process.exit(1)
}
