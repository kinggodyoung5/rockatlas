import { describe, expect, it } from 'vitest'
import { extractJson, resolveMoodId, slugify } from './bandIntake'

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
