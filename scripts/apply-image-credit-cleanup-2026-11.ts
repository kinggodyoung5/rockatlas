/**
 * 이미지 저작자 표기 정리 (plan P4-6). Commons "Artist" 필드를 그대로 옮겨 오면서 안내문·URL·파일명이 섞인 11건을
 * 저작자 이름만 남긴다. 2026-11-24 Commons API로 원문을 다시 확인했다. 라이선스·출처 URL은 바꾸지 않는다.
 * (Metallica의 "Library of Congress Life"는 실제 등록 계정명이라 그대로 둔다.)
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const creators: Record<string, string> = {
  'the-velvet-underground': 'Photographer unknown (Verve Records publicity photo)',
  'kings-of-leon': 'Alterna2',
  'the-strokes': 'Cancha General, Luiz Jagger, Eric Farias, Denisvm, monophonic.grrrl (composite)',
  aerosmith: 'Flickr users daigooliva, c32, edvill, photo_grafitti (composite)',
  cream: 'General Artists Corporation / Atco Records (publicity photo)',
  rancid: 'Tiffany Hagler-Geard',
  'stone-temple-pilots': 'BWRBrett (English Wikipedia)',
  'blind-guardian': 'pigliapost (Flickr)',
  // 저작자가 요청한 표기: "Adam Kliczek, http://memoriesstay.com"
  mastodon: 'Adam Kliczek, http://memoriesstay.com',
  audioslave: 'Simon Jacquier',
  'flotsam-and-jetsam': 'Lilly M (Małgorzata Miłaszewska)',
}
const path = resolve('src/data/catalog.json')
const catalog = JSON.parse(await readFile(path, 'utf8'))
let changed = 0
for (const band of catalog.bands) {
  const next = creators[band.id]
  if (next && band.image.credit.creator !== next) { band.image.credit.creator = next; changed += 1 }
}
catalog.updatedAt = new Date().toISOString()
await writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`이미지 저작자 표기 ${changed}건 정리`)
