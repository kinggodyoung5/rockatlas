import { describe, expect, it } from 'vitest'
import { buildGeminiResearchPrompt, extractJson, inspectBandIntake, resolveMoodId, slugify } from './bandIntake'

describe('extractJson', () => {
  it('reads JSON from a markdown fence', () => {
    expect(extractJson('```json\n{"bands":[{"name":"Test"}]}\n```')).toEqual({ bands: [{ name: 'Test' }] })
  })

  it('repairs an unescaped nickname inside a JSON string', () => {
    const parsed = extractJson('{"name":"Korn","member":"James "Munky" Shaffer"}') as { member: string }
    expect(parsed.member).toBe('James "Munky" Shaffer')
  })

  it('repairs a quoted phrase followed by a comma in prose', () => {
    const parsed = extractJson('{"name":"Test","summary":"They shouted "Hello, world", then left.","formed":2000}') as { summary: string }
    expect(parsed.summary).toBe('They shouted "Hello, world", then left.')
  })

  it('recovers JSON surrounded by prose', () => {
    expect(extractJson('결과입니다.\n{"name":"Test","formed":2000}\n확인하세요.')).toEqual({ name: 'Test', formed: 2000 })
  })

  it('ignores a markdown link and explanation after the completed JSON', () => {
    const input = '{"bands":[{"name":"Kings of Convenience","url":"[[https://www.youtube.com/watch?v=OczRpuGKTfY](https://www.youtube.com/watch?v=OczRpuGKTfY)](https://www.youtube.com/watch?v=OczRpuGKTfY)"}]}\n\n[[Kings Of Convenience](https://www.youtube.com/watch?v=OczRpuGKTfY)](https://www.youtube.com/watch?v=OczRpuGKTfY)\n추가 설명입니다.'
    expect(extractJson(input)).toEqual({
      bands: [{
        name: 'Kings of Convenience',
        url: '[[https://www.youtube.com/watch?v=OczRpuGKTfY](https://www.youtube.com/watch?v=OczRpuGKTfY)](https://www.youtube.com/watch?v=OczRpuGKTfY)',
      }],
    })
  })
})

describe('intake aliases and IDs', () => {
  it('maps a common Gemini mood synonym to the canonical mood ID', () => {
    expect(resolveMoodId('groovy-funky')).toBe('groovy-danceable')
    expect(resolveMoodId('춤추기 좋고 그루비한')).toBe('groovy-danceable')
  })

  it('removes accents before creating future band IDs', () => {
    expect(slugify('Mötley Crüe')).toBe('motley-crue')
    expect(slugify('Måneskin')).toBe('maneskin')
  })

  it('keeps brittle external identifiers out of the Gemini role', () => {
    const prompt = buildGeminiResearchPrompt()
    expect(prompt).toContain('GEM 지침 v4')
    expect(prompt).toContain('정확한 Wikidata·MusicBrainz ID')
    expect(prompt).not.toContain('"wikidataId"')
    expect(prompt).not.toContain('"youtubeChannelUrl"')
  })
})

describe('fuzzy mood resolution', () => {
  it('matches a mood phrase with its words reordered', () => {
    expect(resolveMoodId('음울하고 어두운')).toBe('dark-gloomy')
    expect(resolveMoodId('신나고 밝은')).toBeUndefined() // two 2-character words with different endings: below the confidence bar on purpose
    expect(resolveMoodId('편안하고 따뜻한')).toBe('warm-comforting')
    expect(resolveMoodId('감성적이고 낭만적인')).toBe('romantic-emotional')
  })

  it('matches a close synonym that is not in the curated alias list', () => {
    expect(resolveMoodId('어둡고 음침한')).toBe('dark-gloomy')
    expect(resolveMoodId('잔잔하고 차분한')).toBe('slow-calm')
    expect(resolveMoodId('웅장하고 서사적인')).toBe('epic-cinematic')
  })

  it('does not force a match for genuinely unrelated text', () => {
    expect(resolveMoodId('완전히 무관한 임의의 텍스트입니다')).toBeUndefined()
  })

  it('does not confuse two distinctly different moods for each other', () => {
    expect(resolveMoodId('우주적이고 환각적인')).toBe('cosmic-psychedelic')
    expect(resolveMoodId('우주적이고 환각적인')).not.toBe('dark-gloomy')
    expect(resolveMoodId('빠르고 질주하는')).toBe('fast-driving')
    expect(resolveMoodId('빠르고 질주하는')).not.toBe('dreamy-ethereal')
  })
})

describe('intake pipeline', () => {
  it('표현이 다른 분위기를 정식 ID로 바꾸고 미등록 관계를 보류함에 보존한다', async () => {
    const raw = JSON.stringify({
      bands: [{
        name: 'Pipeline Test',
        formed: 2000,
        origin: 'Test City, United States',
        countryCode: 'US',
        activeYears: '2000–present',
        summary: '2000년 결성되어 독립 록 장면에서 꾸준히 활동해 온 테스트 밴드다.',
        style: '기타와 드럼을 중심으로 선명하고 활기찬 합주와 기억하기 쉬운 후렴을 들려준다.',
        tags: ['테스트'],
        genre: 'alternative-grunge',
        subgenres: ['alternative-rock'],
        moods: { '음울하고 어두운': 4 },
        members: [{ name: 'Test Member', role: '기타', status: 'current', activeYears: '2000–present' }],
        representativeTracks: [],
        relations: [{ targetBandName: 'Future Band', kind: 'shared-scene', strength: 2, note: '같은 지역 장면' }],
        wikidataId: '',
        musicBrainzId: '',
        wikipediaUrl: '',
        youtubeChannelUrl: '',
        image: { commonsFile: '' },
      }],
    })
    const result = await inspectBandIntake(raw, [])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].band.taxonomyV2?.moodScores).toMatchObject({ 'dark-gloomy': 4 })
    expect(result.candidates[0].pendingRelations).toHaveLength(1)
    expect(result.candidates[0].pendingRelations[0]).toMatchObject({ sourceBandId: 'pipeline-test', targetBandId: 'future-band', kind: 'shared-scene' })
    expect(result.candidates[0].band.relations).toEqual([])
  })
})
