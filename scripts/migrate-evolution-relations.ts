/**
 * One-off migration (improvement plan P2-2): retire the 'evolution' relation kind.
 *  - Pairs joined by a person become 'member-link' with the people and link type recorded.
 *  - Genre-history readings with no person behind them are re-judged against sources: kept as a
 *    sourced influence/scene relation, or removed.
 * Fails if any 'evolution' relation is left that this table doesn't cover.
 *   node --experimental-strip-types scripts/migrate-evolution-relations.ts
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Json = Record<string, any>
const catalogPath = resolve('src/data/catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Json
const byId = new Map<string, Json>(catalog.bands.map((band: Json) => [band.id, band]))
const now = new Date().toISOString()

type LinkType = 'successor' | 'moved' | 'shared'
interface MemberLink {
  /** Earlier band first. */
  from: string
  to: string
  linkType: LinkType
  people: string[]
  /** Note on the earlier band's relation (describes the later band). */
  fromNote: string
  /** Note on the later band's relation (describes the earlier band). */
  toNote: string
}

const memberLinks: MemberLink[] = [
  { from: 'joy-division', to: 'new-order', linkType: 'successor', people: ['Bernard Sumner', 'Peter Hook', 'Stephen Morris'],
    fromNote: '1980년 이언 커티스가 세상을 떠난 뒤 남은 세 멤버가 이름을 바꿔 이어간 후신 밴드다.',
    toNote: '이언 커티스 사망 후 남은 세 멤버가 결성 이전에 함께했던 전신 밴드다.' },
  { from: 'oasis', to: 'beady-eye', linkType: 'successor', people: ['Liam Gallagher', 'Gem Archer', 'Andy Bell', 'Chris Sharrock'],
    fromNote: '2009년 해체 직후 리엄 갤러거와 마지막 라인업 멤버들이 그대로 이어서 결성한 후신 밴드다.',
    toNote: '리엄 갤러거와 멤버들이 2009년 해체 직전까지 함께한 전신 밴드다.' },
  { from: 'rage-against-the-machine', to: 'audioslave', linkType: 'successor', people: ['Tom Morello', 'Tim Commerford', 'Brad Wilk'],
    fromNote: '보컬 잭 드 라 로차가 탈퇴한 뒤 남은 연주진 세 명이 크리스 코넬과 함께 결성한 밴드다.',
    toNote: '기타·베이스·드럼 세 멤버가 2000년까지 함께한 전신 밴드다.' },
  { from: 'mother-love-bone', to: 'pearl-jam', linkType: 'successor', people: ['Stone Gossard', 'Jeff Ament'],
    fromNote: '1990년 보컬 앤드루 우드가 세상을 떠난 뒤 스톤 고사드와 제프 아먼트가 이어서 결성한 밴드다.',
    toNote: '스톤 고사드와 제프 아먼트가 결성 이전에 함께했던 전신 밴드다.' },
  { from: 'nirvana', to: 'foo-fighters', linkType: 'moved', people: ['Dave Grohl'],
    fromNote: '드러머 데이브 그롤이 1994년 너바나가 끝난 뒤 결성한 밴드다.',
    toNote: '데이브 그롤이 1990~1994년 드러머로 활동한 밴드다.' },
  { from: 'soundgarden', to: 'audioslave', linkType: 'moved', people: ['Chris Cornell'],
    fromNote: '보컬 크리스 코넬이 사운드가든 해체 후 합류한 밴드다.',
    toNote: '보컬 크리스 코넬이 1984~1997년 활동한 밴드다.' },
  { from: 'metallica', to: 'megadeth', linkType: 'moved', people: ['Dave Mustaine'],
    fromNote: '1983년 메탈리카에서 해고된 데이브 머스테인이 결성한 밴드다.',
    toNote: '데이브 머스테인이 1981~1983년 기타리스트로 활동하다 해고된 밴드다.' },
  { from: 'black-sabbath', to: 'ozzy-osbourne', linkType: 'moved', people: ['Ozzy Osbourne'],
    fromNote: '1979년 블랙 사바스에서 해고된 오지 오스본이 시작한 솔로 활동이다.',
    toNote: '오지 오스본이 1968~1979년(이후 재결합) 보컬로 활동한 밴드다.' },
  { from: 'black-sabbath', to: 'dio', linkType: 'moved', people: ['Ronnie James Dio'],
    fromNote: '1979~1982년 블랙 사바스의 보컬이었던 로니 제임스 디오가 이후 결성한 밴드다.',
    toNote: '로니 제임스 디오가 1979~1982년(이후 재결합) 보컬로 활동한 밴드다.' },
  { from: 'rainbow', to: 'dio', linkType: 'moved', people: ['Ronnie James Dio'],
    fromNote: '레인보우 초대 보컬 로니 제임스 디오가 이후 결성한 밴드다.',
    toNote: '로니 제임스 디오가 1975~1979년 초대 보컬로 활동한 밴드다.' },
  { from: 'mercyful-fate', to: 'king-diamond', linkType: 'moved', people: ['King Diamond', 'Michael Denner', 'Timi Hansen'],
    fromNote: '1985년 머시풀 페이트가 멈춘 뒤 킹 다이아몬드가 멤버 일부와 함께 결성한 밴드다.',
    toNote: '킹 다이아몬드와 초기 멤버들이 함께했던 밴드다.' },
  { from: 'van-halen', to: 'chickenfoot', linkType: 'moved', people: ['Sammy Hagar', 'Michael Anthony'],
    fromNote: '반 헤일런 출신 새미 헤이거와 마이클 앤서니가 2008년 결성한 슈퍼그룹이다.',
    toNote: '새미 헤이거(보컬)와 마이클 앤서니(베이스)가 몸담았던 밴드다.' },
  { from: 'racer-x', to: 'mr-big', linkType: 'moved', people: ['Paul Gilbert'],
    fromNote: '기타리스트 폴 길버트가 레이서 엑스를 떠나 결성에 참여한 밴드다.',
    toNote: '폴 길버트가 미스터 빅 이전에 활동한 밴드다.' },
  { from: 'racer-x', to: 'judas-priest', linkType: 'moved', people: ['Scott Travis'],
    fromNote: '드러머 스콧 트래비스가 1989년 합류한 밴드다.',
    toNote: '스콧 트래비스가 주다스 프리스트 합류 이전에 드러머로 활동한 밴드다.' },
  { from: 'ride', to: 'oasis', linkType: 'moved', people: ['Andy Bell'],
    fromNote: '라이드의 기타리스트 앤디 벨이 1999년 베이시스트로 합류한 밴드다.',
    toNote: '앤디 벨이 오아시스 합류 이전에 기타리스트로 활동한 밴드다.' },
  { from: 'anthrax', to: 'nuclear-assault', linkType: 'moved', people: ['Dan Lilker'],
    fromNote: '앤스랙스 창단 베이시스트 댄 릴커가 탈퇴 후 결성한 밴드다.',
    toNote: '댄 릴커가 창단 멤버로 참여했던 밴드다.' },
  { from: 'the-police', to: 'sting', linkType: 'moved', people: ['Sting'],
    fromNote: '보컬·베이시스트 스팅이 1985년부터 시작한 솔로 활동이다.',
    toNote: '스팅이 1977~1986년(2007~2008년 재결합) 보컬·베이스를 맡은 밴드다.' },
  { from: 'oasis', to: 'noel-gallagher-s-high-flying-birds', linkType: 'moved', people: ['Noel Gallagher'],
    fromNote: '오아시스의 주 작곡가 노엘 갤러거가 2009년 탈퇴 후 시작한 프로젝트다.',
    toNote: '노엘 갤러거가 리더이자 주 작곡가로 활동한 밴드다.' },
  { from: 'extreme', to: 'generation-axe', linkType: 'shared', people: ['Nuno Bettencourt'],
    fromNote: '기타리스트 누노 베텐코트가 익스트림 활동과 함께 참여하는 기타 슈퍼그룹이다.',
    toNote: '누노 베텐코트가 기타를 맡고 있는 밴드다.' },
  { from: 'wintersun', to: 'megadeth', linkType: 'shared', people: ['Teemu Mäntysaari'],
    fromNote: '기타리스트 테무 맨티사리가 2023년부터 함께 활동하는 밴드다.',
    toNote: '테무 맨티사리가 메가데스 합류 전부터 기타를 맡아 온 밴드다.' },
]

/** Genre-history readings (no person behind them), re-judged against sources. */
const rejudged: { pair: [string, string]; action: 'delete' } [] = [
  { pair: ['guns-n-roses', 'nirvana'], action: 'delete' }, // "세대교체 지점" — an era narrative, not a relation
  { pair: ['metallica', 'rammstein'], action: 'delete' }, // no source for a Metallica influence on Rammstein
  { pair: ['the-clash', 'the-cure'], action: 'delete' }, // Robert Smith: inspired by punk's attitude, not The Clash's music
]
const reclassified: { from: string; to: string; kind: 'influenced' | 'shared-scene'; fromNote: string; toNote: string; source: Json }[] = [
  { from: 'death', to: 'children-of-bodom', kind: 'influenced',
    fromNote: '알렉시 라이호가 2002년 척 슐디너 추모 공연에서 데스의 곡을 직접 부를 만큼 기교와 멜로디에 큰 영향을 받은 후배 밴드다.',
    toNote: '알렉시 라이호가 2002년 척 슐디너 추모 공연에서 곡을 직접 부를 만큼 기교와 멜로디에 큰 영향을 준 선배 밴드다.',
    source: { label: 'Loudwire — Alexi Laiho fronts Death tribute band at 2002 memorial', url: 'https://loudwire.com/alexi-laiho-death-tribute-band-2002-recordings/', publisher: 'Editorial', accessedAt: now.slice(0, 10) } },
  { from: 'yes', to: 'porcupine-tree', kind: 'influenced',
    fromNote: '프런트맨 스티븐 윌슨이 2013~2016년 이 밴드의 대표작을 직접 리믹스하고 Close to the Edge를 걸작으로 꼽을 만큼 영향을 받은 현대 프로그레시브 밴드다.',
    toNote: '스티븐 윌슨이 2013~2016년 Close to the Edge 등 대표작을 직접 리믹스할 만큼 깊이 영향을 받은 고전 프로그레시브 록의 원류다.',
    source: { label: 'Wikipedia — The Steven Wilson Remixes', url: 'https://en.wikipedia.org/wiki/The_Steven_Wilson_Remixes', publisher: 'Wikipedia', accessedAt: now.slice(0, 10) } },
  { from: 'nine-inch-nails', to: 'rammstein', kind: 'shared-scene',
    fromNote: '트렌트 레즈너가 프로듀싱한 영화 Lost Highway(1997) 사운드트랙에 나란히 실리며 1990년대 인더스트리얼 메탈의 주류화를 함께 대표했다.',
    toNote: '트렌트 레즈너가 프로듀싱한 영화 Lost Highway(1997) 사운드트랙에 나란히 실리며 1990년대 인더스트리얼 록의 주류화를 함께 대표했다.',
    source: { label: 'Wikipedia — Lost Highway (soundtrack)', url: 'https://en.wikipedia.org/wiki/Lost_Highway_(soundtrack)', publisher: 'Wikipedia', accessedAt: now.slice(0, 10) } },
]

const reviewed = { reviewStatus: 'reviewed', reviewedBy: 'ROCK ATLAS editorial', reviewedAt: now }
function relationOf(fromId: string, toId: string) {
  const band = byId.get(fromId)
  if (!band) throw new Error(`밴드 없음: ${fromId}`)
  return { band, relation: band.relations.find((relation: Json) => relation.targetBandId === toId) as Json | undefined }
}
function upsert(fromId: string, toId: string, value: Json) {
  const { band, relation } = relationOf(fromId, toId)
  const next = { targetBandId: toId, strength: relation?.strength ?? 3, ...value, ...reviewed }
  delete next.mirroredFrom
  if (relation) Object.keys(relation).forEach((key) => delete relation[key])
  if (relation) Object.assign(relation, next)
  else band.relations.push(next)
}
function remove(fromId: string, toId: string) {
  const band = byId.get(fromId)!
  band.relations = band.relations.filter((relation: Json) => relation.targetBandId !== toId)
}

for (const link of memberLinks) {
  upsert(link.from, link.to, { kind: 'member-link', linkType: link.linkType, people: link.people, note: link.fromNote })
  upsert(link.to, link.from, { kind: 'member-link', linkType: link.linkType, people: link.people, note: link.toNote })
}
for (const { pair: [a, b] } of rejudged) { remove(a, b); remove(b, a) }
for (const item of reclassified) {
  upsert(item.from, item.to, { kind: item.kind, note: item.fromNote, source: item.source })
  upsert(item.to, item.from, { kind: item.kind === 'influenced' ? 'influenced-by' : item.kind, note: item.toNote, source: item.source })
}

// Pending relations from intake that used 'evolution': they all name a member, so record who.
const pendingPeople: Record<string, [string[], LinkType]> = {
  'slash-feat-myles-kennedy-the-conspirators->velvet-revolver-0-1': [['Slash'], 'shared'],
  'generation-axe->animals-as-leaders-0-2': [['Tosin Abasi'], 'shared'],
  'alter-bridge->creed-0-0': [['Mark Tremonti', 'Scott Phillips', 'Brian Marshall'], 'successor'],
  'alter-bridge->tremonti-0-1': [['Mark Tremonti'], 'shared'],
}
for (const pending of catalog.pendingRelations as Json[]) {
  if (pending.kind !== 'evolution') continue
  const entry = pendingPeople[pending.id]
  if (!entry) throw new Error(`표에 없는 보류 evolution 관계: ${pending.id}`)
  pending.kind = 'member-link'
  pending.people = entry[0]
  pending.linkType = entry[1]
}

const leftovers = (catalog.bands as Json[]).flatMap((band) => band.relations.filter((relation: Json) => relation.kind === 'evolution').map((relation: Json) => `${band.id}→${relation.targetBandId}`))
if (leftovers.length) throw new Error(`표에 없는 evolution 관계가 남음: ${leftovers.join(', ')}`)

catalog.updatedAt = now
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`member-link ${memberLinks.length}쌍 · 재분류 ${reclassified.length}쌍 · 삭제 ${rejudged.length}쌍 · 보류 관계 ${Object.keys(pendingPeople).length}건 갱신`)
