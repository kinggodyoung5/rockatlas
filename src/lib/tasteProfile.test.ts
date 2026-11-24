import { describe, expect, it } from 'vitest'
import { publicBands } from '../data/publicBands'
import { buildTasteProfile, decodeProfileIds, encodeProfileIds, recommendForProfile, starterBands, stepOutside, tasteSentence } from './tasteProfile'

const metalFan = { favoriteIds: ['metallica', 'slayer', 'megadeth', 'anthrax', 'iron-maiden'] }

describe('내 취향 프로필', () => {
  it('저장 1.0 · 여정 0.5 · 방문 0.2 가중치를 쓰고, 한 밴드는 가장 큰 가중치 하나만 센다', () => {
    const profile = buildTasteProfile({ favoriteIds: ['metallica'], journeyIds: ['metallica', 'slayer'], historyIds: ['slayer', 'coldplay', 'not-a-band'] }, publicBands)
    expect(profile.inputs.map((item) => [item.band.id, item.weight])).toEqual([['metallica', 1], ['slayer', 0.5], ['coldplay', 0.2]])
    expect(profile.genres.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1, 1)
  })

  it('메탈 팬에게는 메탈 쪽 무드와 문장, 아직 안 본 추천 12팀을 장르당 최대 4팀으로 준다', () => {
    const profile = buildTasteProfile(metalFan, publicBands)
    expect(['aggressive-heavy', 'fast-driving', 'riff-solo-driven', 'massive-heavy']).toContain(profile.topMoods[0].moodId)
    expect(tasteSentence(profile)).toMatch(/소리에 끌리는, .+ 쪽 취향$/)
    const recommendations = recommendForProfile(profile, publicBands, [])
    expect(recommendations).toHaveLength(12)
    expect(recommendations.some((item) => metalFan.favoriteIds.includes(item.band.id))).toBe(false)
    const perGenre = new Map<string, number>()
    recommendations.forEach((item) => perGenre.set(item.band.taxonomyV2!.primaryGenreId, (perGenre.get(item.band.taxonomyV2!.primaryGenreId) ?? 0) + 1))
    expect(Math.max(...perGenre.values())).toBeLessThanOrEqual(4)
  })

  it('취향 밖으로 한 걸음은 프로필에 없는 장르에서, 공유 무드가 있는 밴드를 장르마다 한 팀씩 고른다', () => {
    const profile = buildTasteProfile(metalFan, publicBands)
    const outside = stepOutside(profile, publicBands, [])
    const ownGenres = new Set(profile.genres.map((item) => item.genreId))
    expect(outside).toHaveLength(3)
    expect(outside.every((item) => !ownGenres.has(item.band.taxonomyV2!.primaryGenreId) && item.sharedMoods.length > 0)).toBe(true)
    expect(new Set(outside.map((item) => item.band.taxonomyV2!.primaryGenreId)).size).toBe(3)
    const recommended = recommendForProfile(profile, publicBands, []).map((item) => item.band)
    const farther = stepOutside(profile, publicBands, [], 3, recommended)
    const recommendedGenres = new Set(recommended.map((band) => band.taxonomyV2!.primaryGenreId))
    expect(farther.every((item) => !recommendedGenres.has(item.band.taxonomyV2!.primaryGenreId))).toBe(true)
  })

  it('시작 화면 후보는 장르마다 고르게 24팀 이하', () => {
    const starters = starterBands(publicBands)
    expect(starters.length).toBeGreaterThanOrEqual(20)
    expect(starters.length).toBeLessThanOrEqual(24)
    expect(new Set(starters.map((band) => band.id)).size).toBe(starters.length)
    expect(new Set(starters.map((band) => band.taxonomyV2!.primaryGenreId)).size).toBe(13)
  })

  it('공유 주소용 id 목록을 안전하게 왕복한다', () => {
    expect(decodeProfileIds(encodeProfileIds(['metallica', '../x', 'slayer']))).toEqual(['metallica', 'slayer'])
    expect(decodeProfileIds('a.a.b')).toEqual(['a', 'b'])
  })
})
