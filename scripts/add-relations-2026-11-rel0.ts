/**
 * One-off (improvement plan P2-6): sourced relations for bands that had none.
 *   node --experimental-strip-types scripts/add-relations-2026-11-rel0.ts
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Json = Record<string, any>
const catalogPath = resolve('src/data/catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Json
const byId = new Map<string, Json>(catalog.bands.map((band: Json) => [band.id, band]))
const now = new Date().toISOString()
const day = now.slice(0, 10)

/** kind is from `from`'s side; the reverse side gets the inverse kind. */
const pairs: { from: string; to: string; kind: string; strength: 1 | 2 | 3; fromNote: string; toNote: string; source: { label: string; url: string; publisher: string } }[] = [
  { from: 'the-libertines', to: 'the-clash', kind: 'influenced-by', strength: 3,
    fromNote: '클래시의 믹 존스가 데뷔작 Up the Bracket(2002)과 2집을 직접 프로듀싱했고, 평단은 이 밴드를 리버틴스의 음악적 선배로 꼽는다.',
    toNote: '믹 존스가 데뷔작과 2집을 직접 프로듀싱한, 2000년대 영국 개러지 록 리바이벌의 후배 밴드다.',
    source: { label: 'Wikipedia — Up the Bracket', url: 'https://en.wikipedia.org/wiki/Up_the_Bracket', publisher: 'Wikipedia' } },
  { from: 'the-libertines', to: 'the-strokes', kind: 'shared-scene', strength: 2,
    fromNote: '2000년대 초 개러지 록 리바이벌에서 뉴욕의 스트록스에 맞선 영국의 대표 주자로 함께 묶였다.',
    toNote: '2000년대 초 개러지 록 리바이벌에서 영국 쪽 대표 주자로 함께 묶인 동시대 밴드다.',
    source: { label: 'Wikipedia — The Libertines', url: 'https://en.wikipedia.org/wiki/The_Libertines', publisher: 'Wikipedia' } },
  { from: 'the-vaccines', to: 'the-strokes', kind: 'influenced-by', strength: 2,
    fromNote: '멤버들이 데뷔 당시 스트록스가 큰 영향이었다고 직접 밝혔다.',
    toNote: '데뷔 당시 큰 영향을 받았다고 밝힌 2010년대 영국 인디 록 후배 밴드다.',
    source: { label: 'TNT Magazine — Interview with The Vaccines', url: 'https://www.tntmagazine.com/leisure-entertainment/interviews/interview-with-the-vaccines/', publisher: 'Editorial' } },
  { from: 'the-vaccines', to: 'ramones', kind: 'influenced-by', strength: 2,
    fromNote: '저스틴 영이 가장 좋아하는 밴드 중 하나로 라모네스를 꼽았고, 짧고 빠른 데뷔작은 라모네스와 자주 비교됐다.',
    toNote: '저스틴 영이 가장 좋아하는 밴드로 꼽으며, 짧고 빠른 데뷔작이 자주 비교된 후배 밴드다.',
    source: { label: 'Atwood Magazine — The Vaccines celebrate a decade of their debut', url: 'https://atwoodmagazine.com/wdyx-the-vaccines-music-interview-2021-what-did-you-expect-from-the-vaccines-album-feature/', publisher: 'Editorial' } },
  { from: 'hoobastank', to: 'incubus', kind: 'shared-scene', strength: 2,
    fromNote: '캘리포니아 아고라힐스·칼라바사스 지역 신에서 함께 성장했고, 후바스탱크의 첫 공연에 인큐버스도 함께 섰다.',
    toNote: '캘리포니아 아고라힐스·칼라바사스 지역 신에서 함께 성장했고, 이 밴드의 첫 공연에 함께 섰다.',
    source: { label: 'Pollstar — Hoobastank (2002)', url: 'https://news.pollstar.com/2002/08/12/hoobastank/', publisher: 'Editorial' } },
  { from: 'hoobastank', to: 'linkin-park', kind: 'shared-scene', strength: 2,
    fromNote: '같은 캘리포니아 아고라힐스 출신으로, 결성 초기 린킨 파크 멤버들과 같은 지역 신에서 어울렸다.',
    toNote: '같은 캘리포니아 아고라힐스 출신으로, 결성 초기 같은 지역 신에서 어울린 밴드다.',
    source: { label: 'Guitar Center Podcast — Dan Estrin of Hoobastank', url: 'https://www.guitarcenter.com/riffs/interviews/guitars/guitar-center-podcast-s3-e8-dan-estrin-hoobastank', publisher: 'Editorial' } },
  { from: 'beck', to: 'sonic-youth', kind: 'shared-scene', strength: 2,
    fromNote: '1995년 롤라팔루자 투어에 함께 출연하며 1990년대 미국 얼터너티브 신의 중심 무대를 공유했다.',
    toNote: '1995년 롤라팔루자 투어에 함께 출연하며 1990년대 얼터너티브 신의 중심 무대를 공유했다.',
    source: { label: 'Lollapalooza 1995 line-up', url: 'https://grooveist.com/lineups/lollapalooza-1995-lineup/', publisher: 'Editorial' } },
  { from: 'beck', to: 'pavement', kind: 'shared-scene', strength: 2,
    fromNote: '1995년 롤라팔루자 투어에 함께 출연한 1990년대 로파이·인디 성향의 동시대 아티스트다.',
    toNote: '1995년 롤라팔루자 투어에 함께 출연한 1990년대 로파이·인디 성향의 동시대 아티스트다.',
    source: { label: 'Lollapalooza 1995 line-up', url: 'https://grooveist.com/lineups/lollapalooza-1995-lineup/', publisher: 'Editorial' } },
  { from: 'mumford-sons', to: 'florence-the-machine', kind: 'shared-scene', strength: 2,
    fromNote: '2010년대 영국 출신 포크·인디 팝으로 함께 세계적 성공을 거두며 여러 페스티벌과 공연 무대를 공유했다.',
    toNote: '2010년대 영국 출신 포크 록으로 함께 세계적 성공을 거두며 여러 페스티벌과 공연 무대를 공유했다.',
    source: { label: 'PhillyVoice — Firefly 2016 headliners', url: 'https://www.phillyvoice.com/mumford-sons-florence-machine-kings-leon-headline-firefly/', publisher: 'Editorial' } },
  { from: 'ajr', to: 'imagine-dragons', kind: 'shared-scene', strength: 2,
    fromNote: '2023년 이매진 드래곤스의 Mercury World Tour 유럽 공연에서 오프닝을 맡았다.',
    toNote: '2023년 Mercury World Tour 유럽 공연에서 오프닝을 맡은 팝 록 밴드다.',
    source: { label: 'Wikipedia — Mercury World Tour', url: 'https://en.wikipedia.org/wiki/Mercury_World_Tour', publisher: 'Wikipedia' } },
  { from: 'peach-pit', to: 'the-beatles', kind: 'influenced-by', strength: 2,
    fromNote: '닐 스미스가 비틀즈와 멤버들의 솔로작, 특히 폴 매카트니의 Ram에 빠져 이후 앨범의 방향이 바뀌었다고 밝혔다.',
    toNote: '닐 스미스가 비틀즈와 폴 매카트니의 Ram에 빠져 앨범 방향이 바뀌었다고 밝힌 캐나다 인디 밴드다.',
    source: { label: 'Magnet Magazine — A Conversation With Peach Pit', url: 'https://magnetmagazine.com/2021/09/26/a-conversation-with-peach-pit/', publisher: 'Editorial' } },
]
const inverse: Record<string, string> = { 'influenced-by': 'influenced', influenced: 'influenced-by' }
let added = 0
for (const pair of pairs) {
  const from = byId.get(pair.from)
  const to = byId.get(pair.to)
  if (!from || !to) throw new Error(`밴드 없음: ${pair.from} / ${pair.to}`)
  const source = { ...pair.source, accessedAt: day }
  for (const [band, target, kind, note] of [[from, to, pair.kind, pair.fromNote], [to, from, inverse[pair.kind] ?? pair.kind, pair.toNote]] as const) {
    if (band.relations.some((relation: Json) => relation.targetBandId === target.id)) continue
    band.relations.push({ targetBandId: target.id, kind, strength: pair.strength, note, source, reviewStatus: 'reviewed', reviewedBy: 'ROCK ATLAS editorial (AI 보조)', reviewedAt: now })
    added += 1
  }
}
catalog.updatedAt = now
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`관계 ${added}건 추가 (${pairs.length}쌍)`)
