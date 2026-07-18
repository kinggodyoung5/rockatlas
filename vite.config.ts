import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const catalogPath = resolve('src/data/catalog.json')
const catalogHistoryPath = resolve('src/data/catalog-history.json')
const siteContentPath = resolve('src/data/siteContent.json')
const genresPath = resolve('src/data/genres.json')
const uploadsPath = resolve('public/uploads')

type JsonObject = Record<string, unknown>
type HistoryEntry = { id: string; createdAt: string; label: string; catalog: JsonObject }

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

function json(response: { setHeader(name: string, value: string): void; end(body?: string): void }, payload: unknown) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function studioApi(): Plugin {
  return {
    name: 'rock-atlas-studio-api',
    configureServer(server) {
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
          const bands = payload.bands as Array<{ id?: string }> | undefined
          if (payload.schemaVersion !== 1 || !Array.isArray(bands)) throw new Error('지원하지 않는 카탈로그 형식입니다.')
          const ids = bands.map((band) => band.id)
          if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('밴드 ID가 비어 있거나 중복되었습니다.')
          await archiveCatalog(typeof payload.changeNote === 'string' ? payload.changeNote : 'Studio 저장')
          const nextCatalog = { schemaVersion: 1, updatedAt: new Date().toISOString(), bands }
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
          if (payload.schemaVersion !== 1 || !Array.isArray(genres) || genres.length !== 9) throw new Error('장르 9개가 모두 필요합니다.')
          if (genres.some((genre) => !genre.id || !genre.name || !/^#[0-9a-f]{6}$/i.test(genre.color ?? ''))) throw new Error('장르 이름과 색상을 확인하세요.')
          const nextGenres = { schemaVersion: 1, updatedAt: new Date().toISOString(), genres }
          await writeFile(genresPath, `${JSON.stringify(nextGenres, null, 2)}\n`, 'utf8')
          json(response, { ok: true, updatedAt: nextGenres.updatedAt })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '장르 저장 실패')
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
          const requiredStrings = ['brandSuffix', 'heroTitle', 'heroDescription', 'genreSectionLabel', 'genreSectionTitle', 'genreSectionDescription']
          if (payload.schemaVersion !== 1 || requiredStrings.some((key) => typeof payload[key] !== 'string')) throw new Error('지원하지 않는 사이트 설정 형식입니다.')
          if (!(payload.heroTitle as string).trim() || !(payload.genreSectionTitle as string).trim()) throw new Error('메인·장르 제목은 비워 둘 수 없습니다.')
          if (!payload.theme || !payload.sectionVisibility || !Array.isArray(payload.sectionOrder)) throw new Error('테마와 섹션 설정이 누락되었습니다.')
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
          const fileName = `hero-${Date.now()}.${extension}`
          await writeFile(resolve(uploadsPath, fileName), buffer)
          json(response, { ok: true, url: `./uploads/${fileName}` })
        } catch (error) {
          response.statusCode = 400
          response.end(error instanceof Error ? error.message : '이미지 업로드 실패')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), studioApi()],
  base: './',
})
