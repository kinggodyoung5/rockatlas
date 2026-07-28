import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Catalog = { bands: Array<{ id: string; name: string; reviewStatus: string }> }

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const catalog = JSON.parse(await readFile(resolve('src/data/catalog.json'), 'utf8')) as Catalog
const publicBands = catalog.bands.filter((band) => band.reviewStatus !== 'draft')
const indexHtml = await readFile(resolve('dist/index.html'), 'utf8')
const errors: string[] = []

if (/modulepreload[^>]+catalog-data/i.test(indexHtml)) {
  errors.push('메인 HTML이 전체 catalog-data 청크를 다시 선로딩합니다.')
}
if (!indexHtml.includes('assets/social/rock-atlas-share-v1.jpg')) {
  errors.push('메인 공유 이미지 메타데이터가 빌드 결과에 없습니다.')
}

for (const band of publicBands) {
  try {
    await access(resolve('dist/data/bands', `${band.id}.json`))
  } catch {
    errors.push(`${band.name}: 상세 JSON이 없습니다.`)
  }

  try {
    const shareHtml = await readFile(resolve('dist/bands', band.id, 'index.html'), 'utf8')
    const expectedTitle = `${escapeHtml(band.name)} — ROCK ATLAS`
    const expectedPath = `/bands/${encodeURIComponent(band.id)}/`
    if (!shareHtml.includes(expectedTitle) || !shareHtml.includes(expectedPath)) {
      errors.push(`${band.name}: 공유 페이지 메타데이터가 올바르지 않습니다.`)
    }
  } catch {
    errors.push(`${band.name}: 공유 HTML이 없습니다.`)
  }
}

if (errors.length) {
  console.error(`공개 빌드 검증 실패 ${errors.length}건\n- ${errors.slice(0, 20).join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(
    `공개 빌드 검증 통과 · 상세 JSON ${publicBands.length}개 · 공유 페이지 ${publicBands.length}개 · 메인 전체 카탈로그 선로딩 없음`,
  )
}
