import { describe, expect, it } from 'vitest'
import type { Album, Band, Track } from '../types/music'
import { buildBandTimeline, normalizeAlbumTitle, tracksMissingFromAlbums } from './bandTimeline'

const track = (id: string, title: string, year: number, album?: string, releaseType?: 'single'): Track => ({
  id, title, year, album, releaseType, youtubeId: '', reviewStatus: 'reviewed', source: { label: '', url: '', publisher: 'YouTube' },
})
const album = (title: string, year: number, essential = false): Album => ({ title, year, type: 'studio', essential })

const band: Pick<Band, 'formed' | 'tracks' | 'albums' | 'milestones'> = {
  formed: 1981,
  tracks: [track('t1', 'Master of Puppets', 1986, 'Master of Puppets'), track('t2', 'Enter Sandman', 1991, 'Metallica'), track('t3', 'Stand-alone', 2000, undefined, 'single')],
  albums: [album('Kill ’Em All', 1983), album('Master of Puppets', 1986, true), album('Metallica', 1991, true)],
  milestones: [{ year: 1986, type: 'lineup', text: '클리프 버턴 사망' }],
}

describe('연표', () => {
  it('결성·사건·음반·대표곡을 연도순으로 합치고, 대표곡은 수록 음반 아래로 넣는다', () => {
    const entries = buildBandTimeline(band)
    expect(entries.map((entry) => `${entry.year}:${entry.kind}`)).toEqual(['1981:formed', '1983:album', '1986:milestone', '1986:album', '1991:album', '2000:track'])
    const puppets = entries.find((entry) => entry.kind === 'album' && entry.album.title === 'Master of Puppets')
    expect(puppets && puppets.kind === 'album' ? puppets.tracks.map((item) => item.id) : []).toEqual(['t1'])
  })

  it('입문 추천만 보기를 고르면 추천 음반만, 추천이 없으면 전체를 보인다', () => {
    expect(buildBandTimeline(band, { essentialOnly: true }).filter((entry) => entry.kind === 'album')).toHaveLength(2)
    const noEssentials = { ...band, albums: band.albums!.map((item) => ({ ...item, essential: false })) }
    expect(buildBandTimeline(noEssentials, { essentialOnly: true }).filter((entry) => entry.kind === 'album')).toHaveLength(3)
  })

  it('음반이 없으면 예전처럼 결성 + 대표곡 연표가 된다', () => {
    expect(buildBandTimeline({ ...band, albums: undefined, milestones: undefined }).map((entry) => entry.kind)).toEqual(['formed', 'track', 'track', 'track'])
  })

  it('앨범 제목 비교는 따옴표·대소문자·판본 표기를 무시하고, 목록에 없는 앨범명을 찾는다', () => {
    expect(normalizeAlbumTitle("Kill 'Em All")).toBe(normalizeAlbumTitle('Kill ’Em All'))
    expect(normalizeAlbumTitle('OK Computer (Collector’s Edition)')).toBe(normalizeAlbumTitle('OK Computer'))
    expect(tracksMissingFromAlbums({ ...band, tracks: [...band.tracks, track('t4', 'X', 1990, 'Ride the Lightnin')] }).map((item) => item.id)).toEqual(['t4'])
  })
})
