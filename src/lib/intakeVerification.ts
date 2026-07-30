import type { Band, SourceRef } from '../types/music'
import { studioFetchJson } from './studioApiClient'

export type IdentityProvider = 'wikidata' | 'musicbrainz'
export type VerificationTone = 'verified' | 'review' | 'missing' | 'failed'

export interface ExternalIdentityCandidate {
  id: string
  name: string
  description: string
  url: string
  aliases?: string[]
  score?: number
  entityType?: string
  country?: string
  origin?: string
  area?: string
  formed?: number
  begin?: string
  end?: string
  ended?: boolean
  musicBrainzId?: string
  youtubeChannelId?: string
  imageFile?: string
  wikipediaUrl?: string
}

export interface RankedIdentityCandidate extends ExternalIdentityCandidate {
  matchScore: number
  matchReasons: string[]
}

export interface ProviderResolution {
  provider: IdentityProvider
  status: VerificationTone
  candidates: RankedIdentityCandidate[]
  selected?: RankedIdentityCandidate
  selectedManually?: boolean
  message: string
}

export interface IntakeFactCheck {
  id: 'formed' | 'country' | 'origin'
  label: string
  entered: string
  external: string
  status: VerificationTone
  message: string
}

export interface IntakeIdentityVerification {
  status: VerificationTone
  linkedAcrossSources: boolean
  wikidata: ProviderResolution
  musicbrainz: ProviderResolution
  facts: IntakeFactCheck[]
  manualActionCount: number
  message: string
}

const normalize = (value: string) => value
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/\p{Mark}+/gu, '')
  .replace(/[^a-z0-9가-힣]+/g, '')

const words = (value: string) => value
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/\p{Mark}+/gu, '')
  .split(/[^a-z0-9가-힣]+/)
  .filter((word) => word.length > 1)

function nameMatchScore(bandName: string, candidate: ExternalIdentityCandidate) {
  const expected = normalize(bandName)
  const labels = [candidate.name, ...(candidate.aliases ?? [])].filter(Boolean)
  if (labels.some((label) => normalize(label) === expected)) return { score: 60, reason: '이름 일치' }
  if (labels.some((label) => normalize(label).includes(expected) || expected.includes(normalize(label)))) return { score: 42, reason: '이름 일부 일치' }
  const expectedWords = new Set(words(bandName))
  const candidateWords = new Set(labels.flatMap(words))
  const overlap = [...expectedWords].filter((word) => candidateWords.has(word)).length
  const ratio = expectedWords.size ? overlap / expectedWords.size : 0
  return { score: Math.round(ratio * 30), reason: ratio >= .5 ? '이름 단어 일치' : '' }
}

export function rankIdentityCandidates(band: Pick<Band, 'name' | 'formed' | 'origin' | 'countryCode'>, candidates: ExternalIdentityCandidate[]) {
  return candidates.map<RankedIdentityCandidate>((candidate) => {
    const reasons: string[] = []
    const nameMatch = nameMatchScore(band.name, candidate)
    let score = nameMatch.score
    if (nameMatch.reason) reasons.push(nameMatch.reason)

    const typeText = normalize(`${candidate.entityType ?? ''} ${candidate.description}`)
    if (/band|group|musicalensemble|rock|밴드|그룹|음악/.test(typeText)) {
      score += 15
      reasons.push('음악 그룹')
    } else if (typeText && /person|human|사람|인물/.test(typeText)) {
      score -= 20
      reasons.push('개인 아티스트 가능성')
    }

    if (candidate.country && candidate.country.toUpperCase() === band.countryCode.toUpperCase()) {
      score += 12
      reasons.push('국가 일치')
    }
    const location = normalize(`${candidate.origin ?? ''} ${candidate.area ?? ''}`)
    if (location && normalize(band.origin).includes(location)) {
      score += 10
      reasons.push('결성지 일치')
    }
    if (candidate.formed) {
      const difference = Math.abs(candidate.formed - band.formed)
      if (difference === 0) {
        score += 15
        reasons.push('결성 연도 일치')
      } else if (difference === 1) {
        score += 6
        reasons.push('결성 연도 1년 차이')
      } else {
        score -= 18
        reasons.push(`결성 연도 ${difference}년 차이`)
      }
    }
    if (typeof candidate.score === 'number') score += Math.round(Math.min(100, Math.max(0, candidate.score)) / 10)
    return { ...candidate, matchScore: score, matchReasons: reasons }
  }).sort((left, right) => right.matchScore - left.matchScore || left.name.localeCompare(right.name))
}

function resolveProvider(
  provider: IdentityProvider,
  candidates: RankedIdentityCandidate[],
  manualId?: string,
): ProviderResolution {
  const manual = manualId ? candidates.find((candidate) => candidate.id === manualId) : undefined
  if (manual) return {
    provider,
    status: 'verified',
    candidates,
    selected: manual,
    selectedManually: true,
    message: '운영자가 후보를 선택했습니다.',
  }
  const first = candidates[0]
  if (!first) return { provider, status: 'missing', candidates, message: '검색 결과가 없습니다.' }
  const gap = first.matchScore - (candidates[1]?.matchScore ?? 0)
  if (first.matchScore >= 75 && gap >= 12) return {
    provider,
    status: 'verified',
    candidates,
    selected: first,
    message: `${first.matchReasons.slice(0, 3).join(' · ')}로 자동 선택했습니다.`,
  }
  return {
    provider,
    status: 'review',
    candidates,
    message: candidates.length > 1 ? '비슷한 후보가 있어 한 번만 선택해주세요.' : '자동 확신이 부족해 운영자 확인이 필요합니다.',
  }
}

function factChecks(band: Pick<Band, 'formed' | 'origin' | 'countryCode'>, wikidata?: ExternalIdentityCandidate, musicbrainz?: ExternalIdentityCandidate): IntakeFactCheck[] {
  const externalYear = musicbrainz?.formed ?? wikidata?.formed
  const externalCountry = musicbrainz?.country ?? wikidata?.country ?? ''
  const externalOrigin = musicbrainz?.origin ?? musicbrainz?.area ?? wikidata?.origin ?? ''
  return [
    {
      id: 'formed',
      label: '결성 연도',
      entered: String(band.formed),
      external: externalYear ? String(externalYear) : '자료 없음',
      status: !externalYear ? 'missing' : Math.abs(externalYear - band.formed) <= 1 ? 'verified' : 'review',
      message: !externalYear ? '외부 구조화 자료에 연도가 없습니다.' : Math.abs(externalYear - band.formed) <= 1 ? '외부 자료와 일치합니다.' : '입력값과 외부 자료가 달라 확인이 필요합니다.',
    },
    {
      id: 'country',
      label: '국가',
      entered: band.countryCode,
      external: externalCountry || '자료 없음',
      status: !externalCountry ? 'missing' : externalCountry.length === 2 && externalCountry.toUpperCase() !== band.countryCode.toUpperCase() ? 'review' : 'verified',
      message: !externalCountry ? '외부 구조화 자료에 국가가 없습니다.' : externalCountry.length === 2 && externalCountry.toUpperCase() !== band.countryCode.toUpperCase() ? '국가 코드가 서로 다릅니다.' : '국가 정보가 모순되지 않습니다.',
    },
    {
      id: 'origin',
      label: '결성지',
      entered: band.origin,
      external: externalOrigin || '자료 없음',
      status: !externalOrigin ? 'missing' : normalize(band.origin).includes(normalize(externalOrigin)) ? 'verified' : 'review',
      message: !externalOrigin ? '외부 구조화 자료에 결성지가 없습니다.' : normalize(band.origin).includes(normalize(externalOrigin)) ? '결성지 표기가 일치합니다.' : '도시·지역 표기가 달라 내용을 확인해주세요.',
    },
  ]
}

export function buildIdentityVerification(
  band: Pick<Band, 'name' | 'formed' | 'origin' | 'countryCode'>,
  wikidataCandidates: ExternalIdentityCandidate[],
  musicBrainzCandidates: ExternalIdentityCandidate[],
  manual: Partial<Record<IdentityProvider, string>> = {},
): IntakeIdentityVerification {
  const wikidataRanked = rankIdentityCandidates(band, wikidataCandidates)
  const musicBrainzRanked = rankIdentityCandidates(band, musicBrainzCandidates)
  let wikidata = resolveProvider('wikidata', wikidataRanked, manual.wikidata)
  let musicbrainz = resolveProvider('musicbrainz', musicBrainzRanked, manual.musicbrainz)

  const linkedPair = wikidataRanked.flatMap((wiki) =>
    musicBrainzRanked.filter((music) => wiki.musicBrainzId && wiki.musicBrainzId === music.id).map((music) => ({ wiki, music })),
  ).find(({ wiki, music }) => nameMatchScore(band.name, wiki).score >= 42 && nameMatchScore(band.name, music).score >= 42)

  if (linkedPair && !manual.wikidata && !manual.musicbrainz) {
    wikidata = { provider: 'wikidata', status: 'verified', candidates: wikidataRanked, selected: linkedPair.wiki, message: 'MusicBrainz ID까지 서로 연결된 항목이라 자동 선택했습니다.' }
    musicbrainz = { provider: 'musicbrainz', status: 'verified', candidates: musicBrainzRanked, selected: linkedPair.music, message: 'Wikidata가 같은 MusicBrainz ID를 가리켜 자동 선택했습니다.' }
  }

  const linkedAcrossSources = Boolean(wikidata.selected?.musicBrainzId && wikidata.selected.musicBrainzId === musicbrainz.selected?.id)
  const facts = factChecks(band, wikidata.selected, musicbrainz.selected)
  const conflictingFacts = facts.filter((fact) => fact.status === 'review').length
  const unresolvedProviders = [wikidata, musicbrainz].filter((provider) => !provider.selected).length
  const manualActionCount = unresolvedProviders + conflictingFacts
  const operatorConfirmed = Boolean(wikidata.selectedManually || musicbrainz.selectedManually)
  const status: VerificationTone = unresolvedProviders
    ? 'review'
    : conflictingFacts
      ? 'review'
      : linkedAcrossSources || operatorConfirmed
        ? 'verified'
        : 'review'
  return {
    status,
    linkedAcrossSources,
    wikidata,
    musicbrainz,
    facts,
    manualActionCount,
    message: status === 'verified'
      ? '두 데이터베이스가 같은 밴드를 가리키고 핵심 정보도 모순되지 않습니다.'
      : manualActionCount
        ? `운영자 확인이 필요한 항목 ${manualActionCount}개만 남았습니다.`
        : '후보는 찾았지만 두 데이터베이스의 직접 연결 근거가 없어 한 번 확인해주세요.',
  }
}

export async function searchIdentityVerification(band: Pick<Band, 'name' | 'formed' | 'origin' | 'countryCode'>) {
  const search = async (provider: IdentityProvider) => {
    const result = await studioFetchJson<{ results: ExternalIdentityCandidate[] }>(
      `/api/studio/external-search?provider=${provider}&q=${encodeURIComponent(band.name)}`,
    )
    return result.results
  }
  const settled = await Promise.allSettled([search('wikidata'), search('musicbrainz')])
  const verification = buildIdentityVerification(
    band,
    settled[0].status === 'fulfilled' ? settled[0].value : [],
    settled[1].status === 'fulfilled' ? settled[1].value : [],
  )
  if (settled.some((item) => item.status === 'rejected')) {
    verification.message = '한 외부 서비스가 응답하지 않았습니다. 성공한 결과는 보존했으며 나중에 다시 검사할 수 있습니다.'
  }
  return verification
}

function upsertSource(sources: SourceRef[], next: SourceRef) {
  return [...sources.filter((source) => source.publisher !== next.publisher), next]
}

export function applyVerifiedIdentity(band: Band, verification: IntakeIdentityVerification): Band {
  let sources = [...band.sources]
  const wikidata = verification.wikidata.selected
  const musicbrainz = verification.musicbrainz.selected
  if (wikidata) {
    sources = upsertSource(sources, {
      label: `${band.name} — Wikidata`,
      url: wikidata.url,
      publisher: 'Wikidata',
      externalId: wikidata.id,
      note: verification.linkedAcrossSources ? 'Studio에서 MusicBrainz와 교차 확인함' : 'Studio 자동 검색 후보 · 운영자 확인 필요',
    })
    if (wikidata.wikipediaUrl) {
      sources = upsertSource(sources, {
        label: `${band.name} — Wikipedia`,
        url: wikidata.wikipediaUrl,
        publisher: 'Wikipedia',
        note: '검증된 Wikidata 항목에서 자동 연결함',
      })
    }
    if (wikidata.youtubeChannelId) {
      sources = upsertSource(sources, {
        label: `${band.name} — 공식 YouTube`,
        url: `https://www.youtube.com/channel/${wikidata.youtubeChannelId}`,
        publisher: 'YouTube',
        externalId: wikidata.youtubeChannelId,
        official: true,
        channelType: 'artist',
        note: '검증된 Wikidata 항목의 공식 채널 ID에서 자동 연결함',
      })
    }
  }
  if (musicbrainz) {
    sources = upsertSource(sources, {
      label: `${band.name} — MusicBrainz`,
      url: musicbrainz.url,
      publisher: 'MusicBrainz',
      externalId: musicbrainz.id,
      note: verification.linkedAcrossSources ? 'Studio에서 Wikidata와 교차 확인함' : 'Studio 자동 검색 후보 · 운영자 확인 필요',
    })
  }
  return {
    ...band,
    sources,
    image: wikidata?.imageFile && !band.image.credit.sourceUrl
      ? { ...band.image, fileName: wikidata.imageFile, credit: { ...band.image.credit, sourceUrl: `File:${wikidata.imageFile}` } }
      : band.image,
  }
}
