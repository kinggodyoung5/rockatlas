import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { searchEntries, type SearchEntry } from './searchIndex'

const index = JSON.parse(readFileSync('public/data/search-index.json', 'utf8')) as SearchEntry[]
const top = (query: string, kind: SearchEntry['t']) => searchEntries(index, query).find((group) => group.kind === kind)?.items ?? []

describe('통합 검색 (P5-3 완료 조건)', () => {
  it('"너바나" → Nirvana', () => expect(top('너바나', 'band')[0]?.bandId).toBe('nirvana'))
  it('"Smells Like" → 대표곡', () => expect(top('Smells Like', 'track')[0]).toMatchObject({ bandId: 'nirvana' }))
  it('"슈게이즈" → 세부장르', () => expect(top('슈게이즈', 'subgenre')[0]?.subgenreId).toBe('shoegaze'))
  it('"Dave Grohl" → 멤버(Nirvana, Foo Fighters)', () => expect(top('Dave Grohl', 'member').map((item) => item.bandId)).toEqual(expect.arrayContaining(['nirvana', 'foo-fighters'])))
  it('발음 기호·대소문자를 무시하고, 종류별 최대 5개', () => {
    expect(top('motley', 'band')[0]?.bandId).toBe('mo-tley-cru-e')
    expect(searchEntries(index, 'the').every((group) => group.items.length <= 5)).toBe(true)
    expect(searchEntries(index, '   ')).toEqual([])
  })
})
