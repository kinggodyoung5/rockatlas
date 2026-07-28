import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadEnv, type Plugin } from 'vite'

// Loaded from .env.local (gitignored — see *.local in .gitignore), never bundled into client code.
const youtubeApiKey = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '').YOUTUBE_API_KEY

const catalogPath = resolve('src/data/catalog.json')
const catalogHistoryPath = resolve('src/data/catalog-history.json')
const siteContentPath = resolve('src/data/siteContent.json')
const genresPath = resolve('src/data/genres.json')
const taxonomyPath = resolve('src/data/taxonomy.v2.json')
const uploadsPath = resolve('public/uploads')
const fontUploadsPath = resolve('public/uploads/fonts')

type JsonObject = Record<string, unknown>
type HistoryEntry = { id: string; createdAt: string; label: string; catalog: JsonObject }
type HealthEntry = { id: string; label: string; url: string; kind: 'link' | 'image' | 'font'; bandId?: string }
type CatalogBandPayload = {
  id?: unknown
  name?: unknown
  formed?: unknown
  reviewStatus?: unknown
  relations?: unknown
  taxonomyV2?: unknown
}

const isLocalRequest = (origin: string) => !origin || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)

async function readBody(request: AsyncIterable<unknown>, maxBytes: number) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array)
    size += buffer.length
    if (size > maxBytes) throw new Error('요청 파일 크기가 허용 범위를 초과했습니다.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonObject
}

async function readHistory(): Promise<HistoryEntry[]> {
  try {
    return JSON.parse(await readFile(catalogHistoryPath, 'utf8')) as HistoryEntry[]
  } catch {
    return []
  }
}

async function archiveCatalog(label: string) {
  const current = JSON.parse(await readFile(catalogPath, 'utf8')) as JsonObject
  const history = await readHistory()
  history.unshift({ id: `${Date.now()}`, createdAt: new Date().toISOString(), label, catalog: current })
  await writeFile(catalogHistoryPath, `${JSON.stringify(history.slice(0, 20), null, 2)}\n`, 'utf8')
}

async function validateCatalogBands(bands: CatalogBandPayload[]) {
  const errors: string[] = []
  if (!bands.length) errors.push('밴드 목록을 비운 상태로 저장할 수 없습니다.')
  const ids = bands.map((band) => typeof band.id === 'string' ? band.id.trim() : '')
  const names = bands.map((band) => typeof band.name === 'string' ? band.name.trim() : '')
  const normalizedNames = names.map((name) => name.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
  const idSet = new Set(ids)
  if (ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) errors.push('모든 밴드 ID는 영문 소문자·숫자·하이픈 형식이어야 합니다.')
  if (idSet.size !== ids.length) errors.push('중복된 밴드 ID가 있습니다.')
  if (names.some((name) => !name)) errors.push('이름이 비어 있는 밴드가 있습니다.')
  if (new Set(normalizedNames).size !== normalizedNames.length) errors.push('중복된 밴드 이름이 있습니다.')

  const taxonomyCatalog = JSON.parse(await readFile(taxonomyPath, 'utf8')) as {
    genres?: Array<{ id?: string }>
    subgenres?: Array<{ id?: string }>
    moods?: Array<{ id?: string }>
  }
  const genreIds = new Set((taxonomyCatalog.genres ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))
  const subgenreIds = new Set((taxonomyCatalog.subgenres ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))
  const moodIds = new Set((taxonomyCatalog.moods ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)))

  bands.forEach((band, index) => {
    const label = names[index] || ids[index] || `${index + 1}번째 밴드`
    if (!Number.isInteger(band.formed) || Number(band.formed) < 1900 || Number(band.formed) > new Date().getFullYear()) errors.push(`${label}: 결성 연도가 올바르지 않습니다.`)
    if (!['draft', 'published'].includes(String(band.reviewStatus))) errors.push(`${label}: 공개 상태 값이 올바르지 않습니다.`)
    if (!Array.isArray(band.relations)) errors.push(`${label}: 관계 목록 형식이 올바르지 않습니다.`)
    else band.relations.forEach((relation) => {
      if (!relation || typeof relation !== 'object') return errors.push(`${label}: 관계 항목 형식이 올바르지 않습니다.`)
      const target = String((relation as { targetBandId?: unknown }).targetBandId ?? '')
      if (!idSet.has(target)) errors.push(`${label}: 존재하지 않는 관계 대상 ${target || '(빈 ID)'}`)
      if (target === ids[index]) errors.push(`${label}: 자기 자신을 관계 대상으로 지정할 수 없습니다.`)
    })

    if (!band.taxonomyV2 || typeof band.taxonomyV2 !== 'object' || Array.isArray(band.taxonomyV2)) return errors.push(`${label}: 새 장르·분위기 분류가 없습니다.`)
    const taxonomy = band.taxonomyV2 as { primaryGenreId?: unknown; secondaryGenreIds?: unknown; subgenreIds?: unknown; moodScores?: unknown; reviewStatus?: unknown }
    const primaryGenreId = String(taxonomy.primaryGenreId ?? '')
    if (!genreIds.has(primaryGenreId)) errors.push(`${label}: 존재하지 않는 대표 장르 ${primaryGenreId || '(빈 ID)'}`)
    if (!Array.isArray(taxonomy.secondaryGenreIds) || taxonomy.secondaryGenreIds.some((id) => !genreIds.has(String(id)))) errors.push(`${label}: 보조 장르 중 존재하지 않는 값이 있습니다.`)
    if (!Array.isArray(taxonomy.subgenreIds) || taxonomy.subgenreIds.some((id) => !subgenreIds.has(String(id)))) errors.push(`${label}: 세부 장르 중 존재하지 않는 값이 있습니다.`)
    if (!taxonomy.moodScores || typeof taxonomy.moodScores !== 'object' || Array.isArray(taxonomy.moodScores)) errors.push(`${label}: 분위기 점수 형식이 올바르지 않습니다.`)
    else Object.entries(taxonomy.moodScores as Record<string, unknown>).forEach(([id, score]) => {
      if (!moodIds.has(id) || !Number.isInteger(score) || Number(score) < 1 || Number(score) > 5) errors.push(`${label}: 분위기 ${id} 점수는 허용 ID와 1~5 정수만 사용할 수 있습니다.`)
    })
    if (!['draft', 'reviewed'].includes(String(taxonomy.reviewStatus))) errors.push(`${label}: 분류 검수 상태가 올바르지 않습니다.`)
  })

  if (errors.length) throw new Error(`저장 전 안전 검사에서 ${errors.length}건을 발견했습니다.\n- ${errors.slice(0, 12).join('\n- ')}${errors.length > 12 ? `\n- 외 ${errors.length - 12}건` : ''}`)
}

function json(response: { setHeader(name: string, value: string): void; end(body?: string): void }, payload: unknown) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function inspectUrl(entry: HealthEntry, localOrigin: string) {
  const startedAt = Date.now()
  try {
    const target = new URL(entry.url, localOrigin)
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('HTTP(S) 주소가 아닙니다.')
    const request = async (method: 'HEAD' | 'GET') => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      try {
        const result = await fetch(target, { method, redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 link-health-checker', ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}) } })
        await result.body?.cancel()
        return result
      } finally { clearTimeout(timeout) }
    }
    let result = await request('HEAD')
    if ([405, 501].includes(result.status)) result = await request('GET')
    const contentType = result.headers.get('content-type') ?? ''
    const isAsset = entry.kind === 'image' ? contentType.startsWith('image/') : entry.kind === 'font' ? /font|woff|octet-stream/.test(contentType) : true
    const status = result.status === 403 || result.status === 429
      ? 'restricted'
      : result.ok && !isAsset
        ? 'broken'
        : result.ok && result.redirected
          ? 'redirected'
          : result.ok
            ? 'ok'
            : result.status === 404 || result.status === 410
              ? 'broken'
              : 'error'
    return { ...entry, status, httpStatus: result.status, finalUrl: result.url, contentType, durationMs: Date.now() - startedAt, detail: result.ok && !isAsset ? `${entry.kind === 'image' ? '이미지' : '폰트'} 형식이 아닙니다.` : '' }
  } catch (error) {
    return { ...entry, status: 'error', httpStatus: 0, finalUrl: '', contentType: '', durationMs: Date.now() - startedAt, detail: error instanceof Error && error.name === 'AbortError' ? '10초 안에 응답하지 않았습니다.' : error instanceof Error ? error.message : '확인 실패' }
  }
}

export function studioApi(): Plugin {
  return {
    name: 'rock-atlas-studio-api',
    configureServer(server) {
      server.middlewares.use('/api/studio/capability', (request, response, next) => {
        if (request.method !== 'GET') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio는 로컬에서만 사용할 수 있습니다.')
        }
        json(response, { available: true, canWrite: true, mode: 'local-studio' })
      })

      server.middlewares.use('/api/studio/health-check', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 검사는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 800_000)
          const entries = payload.entries as HealthEntry[] | undefined
          if (!Array.isArray(entries) || entries.length > 600) throw new Error('검사 항목은 최대 600개까지 보낼 수 있습니다.')
          if (entries.some((entry) => !entry.id || !entry.label || !entry.url || !['link', 'image', 'font'].includes(entry.kind))) throw new Error('검사 항목 형식이 올바르지 않습니다.')
          const results = new Array(entries.length)
          let cursor = 0
          const localOrigin = `http://${request.headers.host ?? '127.0.0.1:5173'}`
          await Promise.all(Array.from({ length: Math.min(8, entries.length) }, async () => {
            while (cursor < entries.length) {
              const index = cursor
              cursor += 1
              results[index] = await inspectUrl(entries[index], localOrigin)
            }
          }))
          json(response, { checkedAt: new Date().toISOString(), results })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '전체 상태 검사 실패')
        }
      })

      server.middlewares.use('/api/studio/external-search', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const query = requestUrl.searchParams.get('q')?.trim() ?? ''
        const provider = requestUrl.searchParams.get('provider')
        if (query.length < 2 || !['wikidata', 'musicbrainz'].includes(provider ?? '')) {
          response.statusCode = 400
          return response.end('검색어 두 글자 이상과 검색 제공자가 필요합니다.')
        }
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12_000)
          let results: unknown[] = []
          if (provider === 'wikidata') {
            const url = new URL('https://www.wikidata.org/w/api.php')
            url.search = new URLSearchParams({ action: 'wbsearchentities', search: query, language: 'ko', uselang: 'ko', type: 'item', limit: '8', format: 'json', origin: '*' }).toString()
            const apiResponse = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor)' } })
            if (!apiResponse.ok) throw new Error(`Wikidata 응답 오류 (${apiResponse.status})`)
            const payload = await apiResponse.json() as { search?: Array<{ id: string; label?: string; description?: string; concepturi?: string; aliases?: string[] }> }
            results = (payload.search ?? []).map((item) => ({ id: item.id, name: item.label ?? item.id, description: item.description ?? '', url: item.concepturi ?? `https://www.wikidata.org/wiki/${item.id}`, aliases: item.aliases ?? [] }))
          } else {
            const url = new URL('https://musicbrainz.org/ws/2/artist/')
            url.search = new URLSearchParams({ query: `artist:${query}`, fmt: 'json', limit: '8' }).toString()
            const apiResponse = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor; personal project)', Accept: 'application/json' } })
            if (!apiResponse.ok) throw new Error(`MusicBrainz 응답 오류 (${apiResponse.status})`)
            const payload = await apiResponse.json() as { artists?: Array<{ id: string; name: string; score?: number; type?: string; disambiguation?: string; country?: string; area?: { name?: string }; 'begin-area'?: { name?: string }; 'life-span'?: { begin?: string; end?: string; ended?: boolean }; aliases?: Array<{ name: string }> }> }
            results = (payload.artists ?? []).map((item) => ({
              id: item.id,
              name: item.name,
              description: [item.type, item.disambiguation].filter(Boolean).join(' · '),
              url: `https://musicbrainz.org/artist/${item.id}`,
              score: item.score,
              country: item.country ?? '',
              area: item['begin-area']?.name ?? item.area?.name ?? '',
              begin: item['life-span']?.begin ?? '',
              end: item['life-span']?.end ?? '',
              ended: Boolean(item['life-span']?.ended),
              aliases: (item.aliases ?? []).slice(0, 4).map((alias) => alias.name),
            }))
          }
          clearTimeout(timeout)
          json(response, { provider, query, results })
        } catch (error) {
          response.statusCode = 502
          response.end(error instanceof Error && error.name === 'AbortError' ? '외부 검색 시간이 초과되었습니다.' : error instanceof Error ? error.message : '외부 검색 실패')
        }
      })

      server.middlewares.use('/api/studio/youtube-search', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        if (!youtubeApiKey) {
          response.statusCode = 501
          return response.end('YOUTUBE_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가하세요.')
        }
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const query = requestUrl.searchParams.get('q')?.trim() ?? ''
        const searchType = requestUrl.searchParams.get('type') === 'channel' ? 'channel' : 'video'
        if (query.length < 2) {
          response.statusCode = 400
          return response.end('검색어를 두 글자 이상 입력하세요.')
        }
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12_000)
          const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
          searchUrl.search = new URLSearchParams({ part: 'snippet', type: searchType, maxResults: '8', q: query, key: youtubeApiKey }).toString()
          const apiResponse = await fetch(searchUrl, { signal: controller.signal })
          const payload = await apiResponse.json() as {
            error?: { message?: string }
            items?: Array<{
              id?: { videoId?: string; channelId?: string }
              snippet?: { title?: string; channelTitle?: string; channelId?: string; description?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } }
            }>
          }
          if (!apiResponse.ok) throw new Error(payload.error?.message ?? `YouTube API 오류 (${apiResponse.status})`)

          if (searchType === 'channel') {
            const channelIds = (payload.items ?? []).map((item) => item.id?.channelId).filter((id): id is string => Boolean(id))
            let statsById: Record<string, { subscriberCount?: string; customUrl?: string }> = {}
            if (channelIds.length) {
              const statsUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
              statsUrl.search = new URLSearchParams({ part: 'snippet,statistics', id: channelIds.join(','), key: youtubeApiKey }).toString()
              const statsResponse = await fetch(statsUrl, { signal: controller.signal })
              const statsPayload = await statsResponse.json() as { items?: Array<{ id?: string; snippet?: { customUrl?: string }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }> }
              statsById = Object.fromEntries((statsPayload.items ?? []).filter((item) => item.id).map((item) => [item.id, { subscriberCount: item.statistics?.hiddenSubscriberCount ? undefined : item.statistics?.subscriberCount, customUrl: item.snippet?.customUrl }]))
            }
            clearTimeout(timeout)
            const results = (payload.items ?? [])
              .filter((item) => item.id?.channelId)
              .map((item) => {
                const channelId = item.id!.channelId!
                const stats = statsById[channelId]
                return {
                  channelId,
                  title: item.snippet?.title ?? '',
                  description: item.snippet?.description ?? '',
                  thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
                  subscriberCount: stats?.subscriberCount ?? '',
                  url: stats?.customUrl ? `https://www.youtube.com/${stats.customUrl}` : `https://www.youtube.com/channel/${channelId}`,
                }
              })
            return json(response, { query, results })
          }

          clearTimeout(timeout)
          const results = (payload.items ?? [])
            .filter((item) => item.id?.videoId)
            .map((item) => ({
              videoId: item.id!.videoId!,
              title: item.snippet?.title ?? '',
              channelTitle: item.snippet?.channelTitle ?? '',
              publishedAt: item.snippet?.publishedAt ?? '',
              thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
              url: `https://www.youtube.com/watch?v=${item.id!.videoId}`,
            }))
          json(response, { query, results })
        } catch (error) {
          response.statusCode = 502
          response.end(error instanceof Error && error.name === 'AbortError' ? 'YouTube 검색 시간이 초과되었습니다.' : error instanceof Error ? error.message : 'YouTube 검색 실패')
        }
      })

      server.middlewares.use('/api/studio/commons-image-search', async (request, response, next) => {
        if (request.method !== 'GET') return next()
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const query = requestUrl.searchParams.get('q')?.trim() ?? ''
        if (query.length < 2) {
          response.statusCode = 400
          return response.end('검색어를 두 글자 이상 입력하세요.')
        }
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12_000)
          const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
          searchUrl.search = new URLSearchParams({
            action: 'query', format: 'json', origin: '*',
            generator: 'search', gsrsearch: `${query} filetype:bitmap|drawing`, gsrnamespace: '6', gsrlimit: '12',
            prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '480',
            iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl',
          }).toString()
          const apiResponse = await fetch(searchUrl, { signal: controller.signal, headers: { 'User-Agent': 'RockAtlasStudio/0.1 (local catalog editor)' } })
          clearTimeout(timeout)
          if (!apiResponse.ok) throw new Error(`Commons 응답 오류 (${apiResponse.status})`)
          const payload = await apiResponse.json() as {
            query?: { pages?: Record<string, {
              title?: string
              imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }>
            }> }
          }
          const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
          const results = Object.values(payload.query?.pages ?? {})
            .map((page) => ({ title: page.title ?? '', info: page.imageinfo?.[0] }))
            .filter((entry): entry is { title: string; info: NonNullable<typeof entry.info> } => Boolean(entry.info && entry.info.mime?.startsWith('image/')))
            .map((entry) => {
              const meta = entry.info.extmetadata ?? {}
              const licenseShort = meta.LicenseShortName?.value ? stripHtml(meta.LicenseShortName.value) : ''
              return {
                fileName: entry.title,
                thumbUrl: entry.info.thumburl ?? entry.info.url ?? '',
                originalUrl: entry.info.url ?? '',
                sourceUrl: entry.info.descriptionurl ?? '',
                creator: meta.Artist?.value ? stripHtml(meta.Artist.value) : '',
                license: /public domain|pd-/i.test(licenseShort) ? 'Public domain' : licenseShort,
                licenseUrl: meta.LicenseUrl?.value ?? '',
              }
            })
            .filter((item) => item.originalUrl && item.sourceUrl)
          json(response, { query, results })
        } catch (error) {
          response.statusCode = 502
          response.end(error instanceof Error && error.name === 'AbortError' ? 'Commons 검색 시간이 초과되었습니다.' : error instanceof Error ? error.message : 'Commons 검색 실패')
        }
      })

      server.middlewares.use('/api/studio/catalog', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(catalogPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 5_000_000)
          const bands = payload.bands as CatalogBandPayload[] | undefined
          if (![1, 2].includes(Number(payload.schemaVersion)) || !Array.isArray(bands)) throw new Error('지원하지 않는 카탈로그 형식입니다.')
          // Optimistic concurrency check: the browser sends the updatedAt it last knew about. If the file
          // on disk has since moved on (another save, a git checkout, a restored backup...), refuse to
          // blindly overwrite it — this is exactly the class of bug that silently reverted a day's worth
          // of edits when a long-stale Studio tab saved over newer committed data.
          const currentOnDisk = JSON.parse(await readFile(catalogPath, 'utf8')) as JsonObject
          if (typeof payload.updatedAt === 'string' && payload.updatedAt !== currentOnDisk.updatedAt) {
            response.statusCode = 409
            response.end('저장 충돌: 이 브라우저를 열어둔 사이 다른 곳에서 카탈로그가 이미 바뀌었습니다(다른 탭에서 저장했거나, Git 작업이 있었을 수 있습니다). 새로고침한 뒤 다시 편집·저장해주세요.')
            return
          }
          await validateCatalogBands(bands)
          await archiveCatalog(typeof payload.changeNote === 'string' ? payload.changeNote : 'Studio 저장')
          const nextCatalog = { schemaVersion: 2, updatedAt: new Date().toISOString(), bands }
          await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextCatalog.updatedAt, count: bands.length })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '카탈로그 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/catalog-history', async (request, response, next) => {
        if (request.method === 'GET') {
          const history = await readHistory()
          json(response, { entries: history.map(({ catalog, ...entry }) => ({ ...entry, count: Array.isArray(catalog.bands) ? catalog.bands.length : 0 })) })
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 복구는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 100_000)
          const history = await readHistory()
          const entry = history.find((item) => item.id === payload.id)
          if (!entry) throw new Error('복구할 이력을 찾지 못했습니다.')
          await archiveCatalog('이력 복구 직전 자동 백업')
          const restored: JsonObject = { ...entry.catalog, updatedAt: new Date().toISOString() }
          await writeFile(catalogPath, `${JSON.stringify(restored, null, 2)}\n`, 'utf8')
          json(response, { ok: true, count: Array.isArray(restored.bands) ? restored.bands.length : 0 })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '이력 복구 실패')
        }
      })

      server.middlewares.use('/api/studio/genres', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(genresPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 500_000)
          const genres = payload.genres as Array<{ id?: string; name?: string; color?: string }> | undefined
          if (payload.schemaVersion !== 1 || !Array.isArray(genres) || genres.length !== 8) throw new Error('기존 장르 8개가 모두 필요합니다.')
          if (genres.some((genre) => !genre.id || !genre.name || !/^#[0-9a-f]{6}$/i.test(genre.color ?? ''))) throw new Error('장르 이름과 색상을 확인하세요.')
          const nextGenres = { schemaVersion: 1, updatedAt: new Date().toISOString(), genres }
          await writeFile(genresPath, `${JSON.stringify(nextGenres, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextGenres.updatedAt })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '장르 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/taxonomy', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(taxonomyPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 1_000_000)
          const genres = payload.genres as Array<{ id?: string; name?: string; displayName?: string; englishName?: string; description?: string; vibeDescription?: string; color?: string; order?: number }> | undefined
          const subgenres = payload.subgenres as unknown[] | undefined
          const moods = payload.moods as Array<{ id?: string; groupId?: string; name?: string; description?: string; order?: number }> | undefined
          if (payload.schemaVersion !== 2 || !Array.isArray(genres) || genres.length !== 13 || !Array.isArray(subgenres) || !Array.isArray(moods)) throw new Error('13장르 분류 체계 전체가 필요합니다.')
          const genreIds = genres.map((genre) => genre.id)
          if (genreIds.some((id) => !id) || new Set(genreIds).size !== genreIds.length) throw new Error('장르 ID가 비어 있거나 중복되었습니다.')
          if (genres.some((genre) => !genre.name?.trim() || !genre.displayName?.trim() || !genre.englishName?.trim() || !genre.description?.trim() || !genre.vibeDescription?.trim() || !/^#[0-9a-f]{6}$/i.test(genre.color ?? ''))) throw new Error('장르 이름·설명·색상을 모두 확인하세요.')
          const moodIds = moods.map((mood) => mood.id)
          if (moods.length !== 24 || moodIds.some((id) => !id) || new Set(moodIds).size !== moodIds.length || moods.some((mood) => !mood.name?.trim() || !mood.description?.trim() || !mood.groupId)) throw new Error('24개 분위기 카드의 이름과 설명을 확인하세요.')
          const nextTaxonomy = { ...payload, updatedAt: new Date().toISOString(), genres: genres.map((genre, index) => ({ ...genre, order: index + 1 })) }
          await writeFile(taxonomyPath, `${JSON.stringify(nextTaxonomy, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextTaxonomy.updatedAt, count: genres.length })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '13장르 분류 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/site-content', async (request, response, next) => {
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await readFile(siteContentPath, 'utf8'))
          return
        }
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 저장은 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 200_000)
          const requiredStrings = [
            'brandSuffix', 'heroTitle', 'heroDescription', 'genreSectionLabel', 'genreSectionTitle', 'genreSectionDescription',
            'manifestoLabel', 'manifestoTitle', 'manifestoButtonLabel',
            'moodSectionLabel', 'moodSectionTitle', 'moodSectionDescription',
            'allBandsSectionLabel', 'allBandsSectionTitle', 'allBandsSectionDescription',
            'headerTagline', 'footerTagline', 'footerDescription', 'footerLocation',
          ]
          if (![1, 2].includes(Number(payload.schemaVersion)) || requiredStrings.some((key) => typeof payload[key] !== 'string')) throw new Error('지원하지 않는 사이트 설정 형식입니다.')
          if (!(payload.heroTitle as string).trim() || !(payload.genreSectionTitle as string).trim()) throw new Error('메인·장르 제목은 비워 둘 수 없습니다.')
          if (!payload.theme || !payload.sectionVisibility || !Array.isArray(payload.sectionOrder)) throw new Error('테마와 섹션 설정이 누락되었습니다.')
          if (Number(payload.schemaVersion) >= 2 && (!payload.genreVisuals || typeof payload.genreVisuals !== 'object')) throw new Error('장르 카드 디자인 설정이 누락되었습니다.')
          if (Number(payload.schemaVersion) >= 2 && (!payload.explorerVisuals || typeof payload.explorerVisuals !== 'object')) throw new Error('탐색 카드 디자인 설정이 누락되었습니다.')
          const nextContent = { ...payload, updatedAt: new Date().toISOString() }
          await writeFile(siteContentPath, `${JSON.stringify(nextContent, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextContent.updatedAt })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '사이트 설정 저장 실패')
        }
      })

      server.middlewares.use('/api/studio/upload', async (request, response, next) => {
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 업로드는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 8_000_000)
          const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : ''
          const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/)
          if (!match) throw new Error('PNG, JPG, WebP 이미지만 업로드할 수 있습니다.')
          const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
          const buffer = Buffer.from(match[2], 'base64')
          if (buffer.length > 5_000_000) throw new Error('이미지는 5MB 이하여야 합니다.')
          await mkdir(uploadsPath, { recursive: true })
          const assetType = typeof payload.assetType === 'string' && ['hero', 'logo', 'wordmark', 'cosmic', 'genre'].includes(payload.assetType)
            ? payload.assetType
            : 'image'
          const assetKey = typeof payload.assetKey === 'string'
            ? payload.assetKey.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
            : ''
          const fileName = `${assetType}${assetKey ? `-${assetKey}` : ''}-${Date.now()}.${extension}`
          await writeFile(resolve(uploadsPath, fileName), buffer)
          json(response, { ok: true, url: `./uploads/${fileName}` })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '이미지 업로드 실패')
        }
      })

      server.middlewares.use('/api/studio/upload-font', async (request, response, next) => {
        if (request.method !== 'PUT') return next()
        if (!isLocalRequest(request.headers.origin ?? '')) {
          response.statusCode = 403
          return response.end('Studio 업로드는 로컬에서만 허용됩니다.')
        }
        try {
          const payload = await readBody(request, 13_000_000)
          const fileName = typeof payload.fileName === 'string' ? payload.fileName : ''
          const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
          if (!['woff2', 'woff', 'ttf', 'otf'].includes(extension)) throw new Error('WOFF2, WOFF, TTF, OTF 폰트만 업로드할 수 있습니다.')
          const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : ''
          const base64 = dataUrl.match(/^data:[^;]*;base64,(.+)$/)?.[1]
          if (!base64) throw new Error('폰트 파일을 읽지 못했습니다.')
          const buffer = Buffer.from(base64, 'base64')
          if (buffer.length > 9_000_000) throw new Error('폰트는 9MB 이하여야 합니다.')
          await mkdir(fontUploadsPath, { recursive: true })
          const safeBase = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'custom-font'
          const storedName = `${safeBase}-${Date.now()}.${extension}`
          await writeFile(resolve(fontUploadsPath, storedName), buffer)
          const format = extension === 'ttf' ? 'truetype' : extension === 'otf' ? 'opentype' : extension
          json(response, { ok: true, url: `./uploads/fonts/${storedName}`, format, name: safeBase })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '폰트 업로드 실패')
        }
      })
    },
  }
}
