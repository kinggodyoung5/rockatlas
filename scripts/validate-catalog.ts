import { bands, catalogFile } from '../src/data/bands.ts'
import { genres } from '../src/data/genres.ts'
import { tracksMissingFromAlbums } from '../src/lib/bandTimeline.ts'

const errors: string[] = []
const warnings: string[] = []
const genreIds = new Set(genres.map((genre) => genre.id))
const bandIds = new Set<string>()
const wikidataIds = new Set<string>()
const musicBrainzIds = new Set<string>()
const imageFiles = new Set<string>()
const youtubeIds = new Set<string>()
let officialChannels = 0

for (const band of bands) {
  if (bandIds.has(band.id)) errors.push(`중복 밴드 ID: ${band.id}`)
  bandIds.add(band.id)

  if (!genreIds.has(band.primaryGenre)) errors.push(`${band.id}: 존재하지 않는 주 장르 ${band.primaryGenre}`)
  for (const genreId of band.genreIds) {
    if (!genreIds.has(genreId)) errors.push(`${band.id}: 존재하지 않는 보조 장르 ${genreId}`)
  }
  if (!band.genreIds.includes(band.primaryGenre)) errors.push(`${band.id}: genreIds에 primaryGenre가 없음`)
  if (band.subgenres.length === 0 || band.subgenres.some((subgenre) => !subgenre.trim())) errors.push(`${band.id}: 세부 장르 누락`)
  if (new Set(band.subgenres).size !== band.subgenres.length) errors.push(`${band.id}: 중복 세부 장르`)
  if (band.eraTags.length === 0) errors.push(`${band.id}: 시대별 장르 태그 누락`)
  const eraIds = new Set<string>()
  const eraGenreSets = new Set<string>()
  for (const eraTag of band.eraTags) {
    if (eraIds.has(eraTag.era)) errors.push(`${band.id}: 중복 시대 태그 ${eraTag.era}`)
    eraIds.add(eraTag.era)
    eraGenreSets.add([...eraTag.subgenres].sort().join('|'))
    if (eraTag.genreIds.length === 0 || eraTag.subgenres.length === 0) errors.push(`${band.id}/${eraTag.era}: 시대별 장르 정보 누락`)
    for (const genreId of eraTag.genreIds) {
      if (!genreIds.has(genreId)) errors.push(`${band.id}/${eraTag.era}: 존재하지 않는 시대별 장르 ${genreId}`)
    }
  }
  if (band.eraTags.length > 1 && eraGenreSets.size < 2) errors.push(`${band.id}: 장르 조합이 같은 시대를 변화로 중복 기록함`)
  if (band.reviewStatus === 'published' && band.eraTags.length > 1 && band.eraTags.some((tag) => !tag.note?.trim())) {
    warnings.push(`${band.id}: 장르 변화의 기준 앨범·설명 보완 권장`)
  }
  if (band.reviewStatus !== 'draft') {
    if (!band.reviewedBy || !band.reviewedAt) errors.push(`${band.id}: 검수 밴드의 검수자·검수 시각 누락`)
    if (band.summary.trim().length < 20 || band.style.trim().length < 20) errors.push(`${band.id}: 검수 밴드의 본문이 지나치게 짧음`)
    if (band.members.length === 0) errors.push(`${band.id}: 검수 밴드의 주요 멤버 누락`)
    for (const publisher of ['Wikipedia', 'Wikidata', 'MusicBrainz'] as const) {
      if (!band.sources.some((source) => source.publisher === publisher)) errors.push(`${band.id}: 검수 밴드의 ${publisher} 출처 누락`)
    }
  }

  const wikidataId = band.sources.find((source) => source.publisher === 'Wikidata')?.externalId
  const musicBrainzId = band.sources.find((source) => source.publisher === 'MusicBrainz')?.externalId
  const youtubeChannel = band.sources.find((source) => source.publisher === 'YouTube' && source.official)
  if (!wikidataId) warnings.push(`${band.id}: Wikidata 식별자 없음`)
  else if (wikidataIds.has(wikidataId)) errors.push(`중복 Wikidata 식별자: ${wikidataId}`)
  else wikidataIds.add(wikidataId)

  if (!musicBrainzId) warnings.push(`${band.id}: MusicBrainz 식별자 없음`)
  else if (musicBrainzIds.has(musicBrainzId)) errors.push(`중복 MusicBrainz 식별자: ${musicBrainzId}`)
  else musicBrainzIds.add(musicBrainzId)

  if (!youtubeChannel || !/^https:\/\/(www\.)?youtube\.com\//.test(youtubeChannel.url)) {
    const message = `${band.id}: 공식 YouTube 채널 링크 누락`
    if (band.reviewStatus === 'draft') warnings.push(message)
    else errors.push(message)
  } else {
    officialChannels += 1
  }

  const image = band.image
  const credit = image.credit
  if (band.reviewStatus === 'published' && credit.reviewStatus !== 'verified') {
    errors.push(`${band.id}: 이미지 권리 검수가 끝나지 않았는데 공개 상태입니다.`)
  }
  if (credit.reviewStatus === 'verified') {
    if (!image.fileName || !image.displayUrl || !image.originalUrl) errors.push(`${band.id}: 검수 이미지 파일 URL 누락`)
    if (!credit.creator || !credit.license) errors.push(`${band.id}: 검수 이미지 저작자·라이선스 누락`)
    if (!credit.reviewedAt) errors.push(`${band.id}: 검수 이미지 검수 시각 누락`)
    if (credit.license !== 'Public domain' && !credit.licenseUrl) errors.push(`${band.id}: 검수 이미지 라이선스 URL 누락`)
    if (!credit.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:')) errors.push(`${band.id}: Commons 원본 파일 페이지가 아님`)
    if (!band.sources.some((source) => source.publisher === 'Wikimedia Commons' && source.url === credit.sourceUrl)) errors.push(`${band.id}: 이미지 출처 목록 불일치`)
    if (image.fileName && imageFiles.has(image.fileName)) errors.push(`${band.id}: 중복 이미지 파일 ${image.fileName}`)
    if (image.fileName) imageFiles.add(image.fileName)
  } else if (image.displayUrl || image.originalUrl || image.fileName) {
    warnings.push(`${band.id}: 미검수 이미지에 정적 파일 정보가 있음`)
  }

  // 음반·연표·트리비아 (plan P4-1, P4-7). 필드가 없어도 화면은 그대로 나오므로 있는 경우만 검사한다.
  const currentYear = new Date().getFullYear()
  const validYear = (year: unknown) => Number.isInteger(year) && (year as number) >= 1940 && (year as number) <= currentYear + 1
  const albumKeys = new Set<string>()
  for (const album of band.albums ?? []) {
    if (!album.title?.trim() || !validYear(album.year)) errors.push(`${band.id}: 음반 제목·연도 형식 오류 (${album.title ?? '?'})`)
    if (!['studio', 'ep', 'live', 'compilation'].includes(album.type)) errors.push(`${band.id}: 음반 종류 오류 (${album.title})`)
    const key = `${album.title}|${album.year}`
    if (albumKeys.has(key)) errors.push(`${band.id}: 중복 음반 ${album.title} (${album.year})`)
    albumKeys.add(key)
    if (album.year < band.formed - 1) warnings.push(`${band.id}: 결성(${band.formed}) 전 음반 ${album.title} (${album.year})`)
  }
  for (const milestone of band.milestones ?? []) {
    if (!validYear(milestone.year) || !milestone.text?.trim()) errors.push(`${band.id}: 연표 항목 형식 오류 (${milestone.text ?? '?'})`)
    if (!['formed', 'lineup', 'hiatus', 'reunion', 'event', 'award'].includes(milestone.type)) errors.push(`${band.id}: 연표 종류 오류 (${milestone.type})`)
  }
  for (const item of band.trivia ?? []) if (!item.text?.trim() || !item.source?.url?.startsWith('https://')) errors.push(`${band.id}: 트리비아는 출처 URL이 필요함`)
  for (const member of band.members) if (member.deceased !== undefined && !validYear(member.deceased)) errors.push(`${band.id}: ${member.name} 사망 연도 형식 오류`)
  for (const track of tracksMissingFromAlbums(band)) warnings.push(`${band.id}/${track.id}: 대표곡 앨범 "${track.album}"이 음반 목록에 없음 (오타·편집 음반 확인)`)

  const trackIds = new Set<string>()
  for (const track of band.tracks) {
    if (trackIds.has(track.id)) errors.push(`${band.id}: 중복 트랙 ID ${track.id}`)
    trackIds.add(track.id)
    if (!track.youtubeId) {
      if (!track.source.url.startsWith('https://www.youtube.com/results?search_query=')) errors.push(`${band.id}/${track.id}: 직접 영상이 없으면 YouTube 검색 링크가 필요함`)
      warnings.push(`${band.id}/${track.id}: 검증된 직접 영상 대신 YouTube 검색 링크 사용`)
    } else {
      if (!/^[A-Za-z0-9_-]{11}$/.test(track.youtubeId)) errors.push(`${band.id}/${track.id}: 잘못된 YouTube ID`)
      if (track.source.url !== `https://www.youtube.com/watch?v=${track.youtubeId}`) errors.push(`${band.id}/${track.id}: YouTube ID와 출처 URL 불일치`)
      if (youtubeIds.has(track.youtubeId)) warnings.push(`${band.id}/${track.id}: 같은 YouTube 링크가 다른 대표곡에도 사용됨 (${track.youtubeId})`)
      youtubeIds.add(track.youtubeId)
    }
  }

  const relationTargets = new Set<string>()
  for (const relation of band.relations) {
    if (relation.targetBandId === band.id) errors.push(`${band.id}: 자기 자신을 가리키는 관계`)
    if (relationTargets.has(relation.targetBandId)) errors.push(`${band.id}: 중복 관계 ${relation.targetBandId}`)
    relationTargets.add(relation.targetBandId)
    if (relation.reviewStatus !== 'draft') {
      if (!relation.reviewedBy || !relation.reviewedAt) errors.push(`${band.id} → ${relation.targetBandId}: 검수자·검수 시각 누락`)
      if (relation.source && !/^https:\/\//.test(relation.source.url)) errors.push(`${band.id} → ${relation.targetBandId}: 관계 출처 URL 형식 오류`)
    }
    if (relation.kind === 'member-link') {
      if (!relation.people?.length) errors.push(`${band.id} → ${relation.targetBandId}: 멤버 연결에 이어 주는 사람(people)이 없음`)
      if (!relation.linkType) errors.push(`${band.id} → ${relation.targetBandId}: 멤버 연결의 종류(linkType)가 없음`)
    }
    if (relation.note.trim().length < 15) warnings.push(`${band.id} → ${relation.targetBandId}: 관계 설명이 15자 미만 — 근거가 드러나는 한 문장으로 보완 권장`)
    if (/(습|입|합)니다\.$/.test(relation.note.trim())) errors.push(`${band.id} → ${relation.targetBandId}: 관계 설명은 "~다"체로 씀 (npm run normalize:write)`)
  }

  // Notation rules (improvement plan P1-3). Fixable ones are errors because normalize:write fixes them.
  if (/present/i.test(band.activeYears) || band.members.some((member) => /present/i.test(member.activeYears ?? ''))) {
    errors.push(`${band.id}: 활동 기간에 "present" 대신 "현재"를 씀 (npm run normalize:write)`)
  }
  if (/^[A-Za-z]/.test(band.origin)) errors.push(`${band.id}: 출신지는 "도시, 국가" 한글 표기로 씀 — "${band.origin}" (npm run normalize:write)`)
  if (band.reviewStatus === 'published' && /^[a-z]/.test(band.name) && band.id !== 'blink-182') warnings.push(`${band.id}: 밴드명이 소문자로 시작함 — 공식 표기인지 확인`)
  if (band.reviewStatus === 'published' && band.tracks.length < 3) warnings.push(`${band.id}: 대표곡 ${band.tracks.length}곡 — 3곡 이상 권장`)
  if (band.tracks.some((track) => /^single$/i.test(track.album ?? ''))) errors.push(`${band.id}: 앨범명 "Single" 대신 releaseType: "single"을 씀`)
}

for (const band of bands) {
  for (const relation of band.relations) {
    if (!bandIds.has(relation.targetBandId)) errors.push(`${band.id}: 존재하지 않는 관계 대상 ${relation.targetBandId}`)
    if (relation.kind === 'member-link') {
      const reverse = bands.find((item) => item.id === relation.targetBandId)?.relations.find((item) => item.targetBandId === band.id)
      if (reverse?.kind === 'member-link' && (reverse.linkType !== relation.linkType || [...(reverse.people ?? [])].sort().join('|') !== [...(relation.people ?? [])].sort().join('|'))) {
        errors.push(`${band.id} ↔ ${relation.targetBandId}: 멤버 연결 양쪽의 사람·종류가 다름`)
      }
    }
  }
}

const pendingIds = new Set<string>()
for (const pending of catalogFile.pendingRelations ?? []) {
  if (!pending.id || pendingIds.has(pending.id)) errors.push(`보류 관계 ID가 비어 있거나 중복됨: ${pending.id || '(빈 ID)'}`)
  pendingIds.add(pending.id)
  if (!bandIds.has(pending.sourceBandId)) errors.push(`${pending.id}: 보류 관계의 출발 밴드 ${pending.sourceBandId}가 없음`)
  if (bandIds.has(pending.targetBandId)) errors.push(`${pending.id}: 대상 밴드 ${pending.targetBandId}가 이미 있으므로 즉시 관계로 변환해야 함`)
  if (pending.sourceBandId === pending.targetBandId) errors.push(`${pending.id}: 자기 자신을 가리키는 보류 관계`)
  if (!pending.sourceBandName.trim() || !pending.targetBandId.trim() || !pending.note.trim()) errors.push(`${pending.id}: 보류 관계 필수 설명 누락`)
  if (!Number.isInteger(pending.strength) || pending.strength < 1 || pending.strength > 3) errors.push(`${pending.id}: 보류 관계 강도 범위 오류`)
}

console.log('ROCK ATLAS 카탈로그 무결성 검사')
console.log(`밴드 ${bands.length} · 장르 ${genres.length} · 트랙 ${bands.flatMap((band) => band.tracks).length} · 관계 ${bands.flatMap((band) => band.relations).length} · 보류 관계 ${catalogFile.pendingRelations?.length ?? 0}`)
console.log(`Wikidata ${wikidataIds.size}/${bands.length} · MusicBrainz ${musicBrainzIds.size}/${bands.length}`)
console.log(`Commons 검수 이미지 ${imageFiles.size}/${bands.length}`)
console.log(`대표곡 외부 링크 ${youtubeIds.size}/${bands.flatMap((band) => band.tracks).length}`)
console.log(`밴드 공식 YouTube 링크 ${officialChannels}/${bands.length}`)

for (const warning of warnings) console.warn(`경고: ${warning}`)
for (const error of errors) console.error(`오류: ${error}`)

if (errors.length > 0) {
  console.error(`\n${errors.length}개의 무결성 오류를 발견했습니다.`)
  process.exitCode = 1
} else {
  console.log(`\n무결성 오류 없음${warnings.length > 0 ? ` · 경고 ${warnings.length}개` : ''}`)
}
