import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const publicDir = resolve('public')
const errors: string[] = []
const checked: string[] = []

function collectUploadPaths(value: unknown, path: string, into: Array<{ path: string; ref: string }>) {
  if (typeof value === 'string') {
    if (value.startsWith('./uploads/')) into.push({ path, ref: value })
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUploadPaths(item, `${path}[${index}]`, into))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectUploadPaths(item, path ? `${path}.${key}` : key, into)
  }
}

async function checkFile(label: string) {
  const raw = await readFile(resolve(`src/data/${label}.json`), 'utf8')
  const data = JSON.parse(raw) as unknown
  const refs: Array<{ path: string; ref: string }> = []
  collectUploadPaths(data, '', refs)
  for (const { path, ref } of refs) {
    checked.push(ref)
    const filePath = resolve(publicDir, ref.replace(/^\.\//, ''))
    if (!existsSync(filePath)) errors.push(`${label}.json: ${path} = "${ref}" — 이 파일이 public/uploads에 없습니다(커밋을 잊었을 수 있습니다: git add public/uploads)`)
  }
}

await checkFile('siteContent')
await checkFile('catalog')

console.log('ROCK ATLAS 업로드 파일 검사')
console.log(`./uploads/ 참조 ${checked.length}건 확인`)

if (errors.length > 0) {
  for (const error of errors) console.error(`오류: ${error}`)
  console.error(`\n${errors.length}개의 업로드 파일 누락을 발견했습니다. 배포 전에 public/uploads가 커밋됐는지 확인하세요.`)
  process.exitCode = 1
} else {
  console.log('\n업로드 파일 누락 없음')
}
