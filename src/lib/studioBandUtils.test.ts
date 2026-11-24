import { describe, expect, it } from 'vitest'
import { albumsToText, membersToText, milestonesToText, parseAlbums, parseMembers, parseMilestones } from './studioBandUtils'

describe('Studio 한 줄 입력 (P4)', () => {
  it('음반: 추천 표시·해설을 읽고, 같은 제목+연도의 출처는 지킨다', () => {
    const source = { label: 'MB', url: 'https://musicbrainz.org/release-group/x', publisher: 'MusicBrainz' as const }
    const parsed = parseAlbums('Ride the Lightning | 1984 | studio\nMaster of Puppets | 1986 | studio | * | 스래시 작곡 문법의 완성\n잘못된 줄', [{ title: 'Master of Puppets', year: 1986, type: 'studio', source }])
    expect(parsed).toEqual([
      { title: 'Ride the Lightning', year: 1984, type: 'studio' },
      { title: 'Master of Puppets', year: 1986, type: 'studio', essential: true, note: '스래시 작곡 문법의 완성', source },
    ])
    expect(parseAlbums(albumsToText(parsed), parsed)).toEqual(parsed)
  })

  it('연표: 모르는 종류는 event로, 연도순 정렬', () => {
    const parsed = parseMilestones('1986 | lineup | 클리프 버턴 사망\n1981 | ??? | 결성')
    expect(parsed.map((item) => [item.year, item.type])).toEqual([[1981, 'event'], [1986, 'lineup']])
    expect(parseMilestones(milestonesToText(parsed))).toEqual(parsed)
  })

  it('멤버: 다섯째 칸의 사망 연도를 읽는다', () => {
    const members = parseMembers('Cliff Burton | 베이스 | former | 1982–1986 | 1986\nJames Hetfield | 보컬, 기타 | current | 1981–현재')
    expect(members[0].deceased).toBe(1986)
    expect(members[1].deceased).toBeUndefined()
    expect(parseMembers(membersToText(members))).toEqual(members)
  })
})
