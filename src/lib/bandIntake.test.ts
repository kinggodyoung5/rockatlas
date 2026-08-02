import { describe, expect, it } from 'vitest'
import { buildGeminiResearchPrompt, extractJson, inspectBandIntake, resolveMoodId, resolveSubgenreId, slugify } from './bandIntake'

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
    expect(prompt).toContain('GEM 지침 v7')
    expect(prompt).toContain('Wikidata·MusicBrainz ID')
    expect(prompt).toContain('[검증 자료]가 있으면 그 값을 최우선')
    expect(prompt).toContain('관계는 항상 빈 배열')
    expect(prompt).toContain('한 앨범의 일시적 실험')
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

describe('subgenre spelling and taxonomy coverage', () => {
  it('음역과 철자가 다른 사이키델릭 록 표기를 같은 ID로 연결한다', () => {
    expect(resolveSubgenreId('사이케델릭 락')).toBe('psychedelic-rock')
    expect(resolveSubgenreId('사이케딜릭 록')).toBe('psychedelic-rock')
    expect(resolveSubgenreId('psychdelic rock')).toBe('psychedelic-rock')
  })

  it('새로 보완한 주요 장르를 정식 ID와 일반 이름 모두로 받는다', () => {
    expect(resolveSubgenreId('Rap Rock')).toBe('rap-rock')
    expect(resolveSubgenreId('인디 포크')).toBe('indie-folk')
    expect(resolveSubgenreId('Post Metal')).toBe('post-metal')
    expect(resolveSubgenreId('Power-Pop')).toBe('power-pop')
    expect(resolveSubgenreId('블랙 게이즈')).toBe('blackgaze')
  })

  it('펑크 메탈처럼 두 의미가 가능한 표현은 억지로 자동 매칭하지 않는다', () => {
    expect(resolveSubgenreId('펑크 메탈')).toBeUndefined()
  })

  it('Gem 지침에 허용된 세부 장르 ID 목록을 직접 제공한다', () => {
    const prompt = buildGeminiResearchPrompt()
    expect(prompt).toContain('세부 장르 ID:')
    expect(prompt).toContain('psychedelic-rock')
    expect(prompt).toContain('rap-rock')
  })
})

describe('era tags on intake', () => {
  it('장르 변화를 모르는 새 밴드는 결성 연도 기준 시대 하나만 만든다 (장르 변화가 확인되면 Studio에서 운영자가 직접 시대를 나눠 적는다)', async () => {
    const raw = JSON.stringify({
      bands: [{
        name: 'Long Runner',
        formed: 1968,
        origin: 'Test City, United States',
        countryCode: 'US',
        activeYears: '1968–2018',
        summary: '오랫동안 활동해 온 테스트 밴드다.',
        style: '기타와 드럼을 중심으로 한 곡 전개를 들려준다.',
        tags: ['테스트'],
        genre: 'alternative-grunge',
        subgenres: ['alternative-rock'],
        moods: {},
        members: [],
        representativeTracks: [],
        relations: [],
        wikidataId: '', musicBrainzId: '', wikipediaUrl: '', youtubeChannelUrl: '', image: { commonsFile: '' },
      }],
    })
    const result = await inspectBandIntake(raw, [])
    expect(result.candidates[0].band.eraTags).toHaveLength(1)
    expect(result.candidates[0].band.eraTags[0].era).toBe('1960s')
  })

  it('Gemini가 실제 장르 변화를 보고하면 시대별로 나눠 담는다', async () => {
    const raw = JSON.stringify({
      bands: [{
        name: 'Shape Shifter',
        formed: 1995,
        origin: 'Test City, United Kingdom',
        countryCode: 'GB',
        activeYears: '1995–현재',
        summary: '데뷔 이후 사운드가 여러 차례 바뀌어 온 테스트 밴드다.',
        style: '시대마다 다른 프로덕션과 편곡을 시도해 왔다.',
        tags: ['테스트'],
        genre: 'alternative-indie',
        subgenres: ['alternative-rock'],
        eraGenreShifts: [
          { era: '1990s', subgenres: ['alternative-rock'], note: 'First Record(1998)의 기타 중심 얼터너티브 록.' },
          { era: '2000s', subgenres: ['pop-rock'], note: 'Second Record(2004)부터 팝 록으로 장기 전환.' },
        ],
        moods: {},
        members: [],
        representativeTracks: [],
        relations: [],
        wikidataId: '', musicBrainzId: '', wikipediaUrl: '', youtubeChannelUrl: '', image: { commonsFile: '' },
      }],
    })
    const result = await inspectBandIntake(raw, [])
    const eras = result.candidates[0].band.eraTags
    expect(eras.map((tag) => tag.era)).toEqual(['1990s', '2000s'])
    expect(eras[0].subgenres).not.toEqual(eras[1].subgenres)
    expect(eras[1].note).toContain('Second Record(2004)')
  })

  it('시대별 변화가 한 개뿐이거나 해석할 수 없으면 기본값으로 되돌아간다', async () => {
    const raw = JSON.stringify({
      bands: [{
        name: 'Single Shift Only',
        formed: 2001,
        origin: 'Test City, United States',
        countryCode: 'US',
        activeYears: '2001–현재',
        summary: '테스트용 밴드 소개 문장이다.',
        style: '테스트용 밴드 음악 설명 문장이다.',
        tags: ['테스트'],
        genre: 'alternative-indie',
        subgenres: ['alternative-rock'],
        eraGenreShifts: [{ era: '2000s', subgenres: ['alternative-rock'] }],
        moods: {},
        members: [],
        representativeTracks: [],
        relations: [],
        wikidataId: '', musicBrainzId: '', wikipediaUrl: '', youtubeChannelUrl: '', image: { commonsFile: '' },
      }],
    })
    const result = await inspectBandIntake(raw, [])
    expect(result.candidates[0].band.eraTags).toHaveLength(1)
    expect(result.candidates[0].band.eraTags[0].era).toBe('2000s')
  })

  it('시대만 다르고 장르 조합이 같으면 실제 변화로 인정하지 않는다', async () => {
    const raw = JSON.stringify({
      bands: [{
        name: 'Unchanged Band', formed: 1995, origin: 'Test City, United Kingdom', countryCode: 'GB', activeYears: '1995–현재',
        summary: '같은 음악 노선을 유지하는 테스트 밴드다.', style: '기타 중심의 같은 사운드를 이어간다.', tags: ['테스트'],
        genre: 'alternative-indie', subgenres: ['alternative-rock'],
        eraGenreShifts: [
          { era: '1990s', subgenres: ['alternative-rock'], note: 'First(1995)' },
          { era: '2000s', subgenres: ['alternative-rock'], note: 'Second(2005)' },
        ],
        moods: {}, members: [], representativeTracks: [], relations: [],
        wikidataId: '', musicBrainzId: '', wikipediaUrl: '', youtubeChannelUrl: '', image: { commonsFile: '' },
      }],
    })
    const result = await inspectBandIntake(raw, [])
    expect(result.candidates[0].band.eraTags).toHaveLength(1)
    expect(result.candidates[0].band.eraTags[0].era).toBe('1990s')
    expect(result.candidates[0].issues.some((issue) => issue.code === 'invalid-era-shifts')).toBe(true)
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

  it('소개글의 빈 앨범 연도 나열을 대표곡 앨범 정보로 자동 보완한다', async () => {
    const raw = JSON.stringify({ bands: [{
      name: 'Album Repair Test', formed: 1984, origin: 'Test City, Brazil', countryCode: 'BR', activeYears: '1984–현재',
      summary: '1984년 결성된 밴드다. (1989), (1993), (1996) 등의 앨범을 발표했다.',
      style: '빠르고 강렬한 리프와 타악기를 결합한 음악을 연주한다.', tags: ['테스트'], genre: 'traditional-power-thrash-metal',
      subgenres: ['thrash-metal'], moods: {}, members: [{ name: 'Current Singer', role: '보컬', status: 'former', activeYears: '1997–현재' }],
      representativeTracks: [
        { title: 'First', year: 1991, album: 'Arise', guide: '첫 곡이다.' },
        { title: 'Second', year: 1993, album: 'Chaos A.D.', guide: '둘째 곡이다.' },
        { title: 'Third', year: 1996, album: 'Roots', guide: '셋째 곡이다.' },
      ], relations: [], eraGenreShifts: [],
    }] })
    const result = await inspectBandIntake(raw, [])
    const candidate = result.candidates[0]
    expect(candidate.band.summary).toContain('Arise(1991), Chaos A.D.(1993), Roots(1996) 등의 앨범')
    expect(candidate.issues.some((issue) => issue.code === 'summary-albums-repaired')).toBe(true)
    expect(candidate.band.members[0].status).toBe('current')
    expect(candidate.issues.some((issue) => issue.code === 'member-status-repaired')).toBe(true)
  })

  it('앨범명 보완 근거가 없으면 공개 승인을 막는다', async () => {
    const raw = JSON.stringify({ bands: [{
      name: 'Missing Album Test', formed: 2000, origin: 'Test City, United States', countryCode: 'US', activeYears: '2000–현재',
      summary: '2000년 결성된 밴드다. (2001), (2004) 등의 앨범을 발표했다.',
      style: '기타와 드럼을 중심으로 음악을 연주하는 테스트 밴드다.', tags: ['테스트'], genre: 'alternative-indie',
      subgenres: ['alternative-rock'], moods: {}, members: [], representativeTracks: [], relations: [], eraGenreShifts: [],
    }] })
    const result = await inspectBandIntake(raw, [])
    const candidate = result.candidates[0]
    expect(candidate.issues.some((issue) => issue.code === 'missing-summary-album-names')).toBe(true)
    expect(candidate.canApprove).toBe(false)
  })
})
