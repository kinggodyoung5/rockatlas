/**
 * One-off (improvement plan P2-3/P2-6): operator-style review of the 62 member-overlap candidates the
 * detector found on 2026-11-22. Each pair is either linked (successor / moved / shared) or recorded in
 * src/data/member-link-decisions.json as session / not-relevant so it stops coming back as a candidate.
 *   node --experimental-strip-types scripts/apply-member-links-2026-11.ts
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findMemberOverlaps, memberPairKey, type MemberLinkDecision } from '../src/lib/memberOverlap.ts'

type Json = Record<string, any>
const catalogPath = resolve('src/data/catalog.json')
const decisionsPath = resolve('src/data/member-link-decisions.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Json
const decisionsFile = JSON.parse(await readFile(decisionsPath, 'utf8')) as Json
const byId = new Map<string, Json>(catalog.bands.map((band: Json) => [band.id, band]))
const now = new Date().toISOString()

// Deep Purple's Mark III line-up was missing; David Coverdale is the link to Whitesnake.
const deepPurple = byId.get('deep-purple')!
for (const member of [
  { name: 'David Coverdale', role: '보컬', status: 'former', activeYears: '1973–1976' },
  { name: 'Glenn Hughes', role: '베이스·보컬', status: 'former', activeYears: '1973–1976' },
]) if (!deepPurple.members.some((item: Json) => item.name === member.name)) deepPurple.members.push(member)

type LinkType = 'successor' | 'moved' | 'shared'
const link: Record<string, LinkType> = {
  'pearl-jam|temple-of-the-dog': 'shared', 'deep-purple|rainbow': 'moved', 'beady-eye|noel-gallagher-s-high-flying-birds': 'moved',
  'death|testament': 'moved', 'deep-purple|whitesnake': 'moved', 'ensiferum|wintersun': 'moved', 'jane-s-addiction|red-hot-chili-peppers': 'shared',
  'mother-love-bone|temple-of-the-dog': 'moved', 'nightwish|wintersun': 'shared', 'ozzy-osbourne|whitesnake': 'moved',
  'queens-of-the-stone-age|screaming-trees': 'shared', 'soundgarden|temple-of-the-dog': 'shared', 'a-perfect-circle|queens-of-the-stone-age': 'moved',
  'a-perfect-circle|the-smashing-pumpkins': 'shared', 'a-perfect-circle|tool': 'shared', 'accept|flotsam-and-jetsam': 'moved',
  'alter-bridge|slash-feat-myles-kennedy-the-conspirators': 'shared', 'anthrax|pantera': 'shared', 'beady-eye|ride': 'shared',
  'chickenfoot|red-hot-chili-peppers': 'shared', 'dark-angel|death': 'moved', 'dark-angel|testament': 'moved', 'daughtry|static-x': 'moved',
  'def-leppard|dio': 'moved', 'def-leppard|whitesnake': 'moved', 'dio|whitesnake': 'moved', 'dragon-force|skid-row': 'moved',
  'dream-theater|extreme': 'moved', 'ensiferum|turisas': 'moved', 'evanescence|static-x': 'shared', 'exodus|metallica': 'moved',
  'generation-axe|ozzy-osbourne': 'shared', 'generation-axe|pantera': 'shared', 'generation-axe|whitesnake': 'moved',
  'guns-n-roses|slash-feat-myles-kennedy-the-conspirators': 'shared', 'ill-nino|machine-head': 'moved', 'in-flames|megadeth': 'moved',
  'jesus-and-mary-chain|primal-scream': 'moved', 'king-diamond|motorhead': 'moved', 'king-diamond|ozzy-osbourne': 'moved',
  'king-diamond|scorpions': 'moved', 'korn|steel-panther': 'moved', 'korpiklaani|turisas': 'moved', 'melvins|mudhoney': 'moved',
  'motorhead|scorpions': 'moved', 'mudhoney|screaming-trees': 'moved', 'my-bloody-valentine|primal-scream': 'shared',
  'ozzy-osbourne|pantera': 'shared', 'ozzy-osbourne|rainbow': 'moved', 'primal-scream|the-stone-roses': 'moved',
  'rainbow|stratovarius': 'moved', 'rainbow|whitesnake': 'moved', 'rancid|the-used': 'moved', 'sepultura|slipknot': 'moved',
}
const skip: Record<string, [MemberLinkDecision, string]> = {
  'avenged-sevenfold|dream-theater': ['session', 'Mike Portnoy는 2009~2010년 The Rev 사망 후 임시 드러머로 참여했다.'],
  'audioslave|temple-of-the-dog': ['not-relevant', 'Chris Cornell 연결은 Soundgarden↔Temple of the Dog·Audioslave로 이미 드러난다.'],
  'death-angel|machine-head': ['session', 'Chris Kontos의 Death Angel 참여는 1991년 짧은 기간이다.'],
  'def-leppard|tesla': ['session', 'Phil Collen은 Tesla의 2019년 앨범 Shock 프로듀서·공동 작곡자로 참여했다(정식 멤버 아님).'],
  'korn|tesla': ['session', 'Tesla 멤버 목록의 Ray Luzier 2016년 표기는 세션 참여로 보인다.'],
  'steel-panther|tesla': ['session', 'Tesla 멤버 목록의 Ray Luzier 2016년 표기는 세션 참여로 보인다.'],
  'mercyful-fate|volbeat': ['session', 'Hank Shermann은 Volbeat 2013년 앨범에 게스트로 참여했다.'],
  'ratt|whitesnake': ['session', 'Warren DeMartini는 1994년 Whitesnake 투어에만 참여했다.'],
}

const candidates = findMemberOverlaps(catalog.bands, decisionsFile.decisions)
const unhandled = candidates.filter((candidate) => !link[candidate.pairKey] && !skip[candidate.pairKey]).map((candidate) => candidate.pairKey)
if (unhandled.length) throw new Error(`판정하지 않은 후보: ${unhandled.join(', ')}`)

function note(from: Json, to: Json, linkType: LinkType, earlierIsFrom: boolean) {
  if (linkType === 'shared') return '두 밴드에서 같은 멤버가 함께 활동했다.'
  return earlierIsFrom ? `${from.name} 출신 멤버가 이후 활동한 밴드다.` : `${from.name} 멤버가 합류하기 전에 활동한 밴드다.`
}
let linked = 0
const keptExisting: string[] = []
for (const candidate of candidates) {
  const linkType = link[candidate.pairKey]
  if (!linkType) continue
  const [left, right] = candidate.bandIds.map((id) => byId.get(id)!)
  const [earlier, later] = left.formed <= right.formed ? [left, right] : [right, left]
  // A pair holds one relation. If the two bands already have a musical relation (influence, scene),
  // keep it — it also feeds recommendations — and only note the shared people for a later review.
  if (earlier.relations.some((relation: Json) => relation.targetBandId === later.id) || later.relations.some((relation: Json) => relation.targetBandId === earlier.id)) {
    keptExisting.push(`${candidate.pairKey} (${candidate.people.join(', ')})`)
    continue
  }
  for (const [from, to] of [[earlier, later], [later, earlier]] as const) {
    from.relations.push({
      targetBandId: to.id, kind: 'member-link', linkType, people: candidate.people, strength: 2,
      note: note(from, to, linkType, from === earlier),
      reviewStatus: 'reviewed', reviewedBy: 'ROCK ATLAS editorial (AI 보조)', reviewedAt: now,
    })
  }
  linked += 1
}
for (const [pairKey, [decision, why]] of Object.entries(skip)) {
  const candidate = candidates.find((item) => item.pairKey === pairKey)
  for (const person of candidate?.people ?? []) {
    if (!decisionsFile.decisions.some((record: Json) => record.pairKey === pairKey && record.person === person)) {
      decisionsFile.decisions.push({ pairKey: memberPairKey(...(pairKey.split('|') as [string, string])), person, decision, note: why, decidedAt: now })
    }
  }
}

catalog.updatedAt = now
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
await writeFile(decisionsPath, `${JSON.stringify(decisionsFile, null, 2)}\n`, 'utf8')
console.log(`멤버 연결 ${linked}쌍 추가 · 제외 판정 ${Object.keys(skip).length}쌍 기록 · 기존 음악 관계 유지 ${keptExisting.length}쌍`)
for (const item of keptExisting) console.log(`  기존 관계 유지: ${item}`)
