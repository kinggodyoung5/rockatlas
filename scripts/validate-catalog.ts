import { bands } from '../src/data/bands.ts'
import { genres } from '../src/data/genres.ts'

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
  for (const eraTag of band.eraTags) {
    if (eraIds.has(eraTag.era)) errors.push(`${band.id}: 중복 시대 태그 ${eraTag.era}`)
    eraIds.add(eraTag.era)
    if (eraTag.genreIds.length === 0 || eraTag.subgenres.length === 0) errors.push(`${band.id}/${eraTag.era}: 시대별 장르 정보 누락`)
    for (const genreId of eraTag.genreIds) {
      if (!genreIds.has(genreId)) errors.push(`${band.id}/${eraTag.era}: 존재하지 않는 시대별 장르 ${genreId}`)
    }
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
    errors.push(`${band.id}: 공식 YouTube 채널 링크 누락`)
  } else {
    officialChannels += 1
  }

  const image = band.image
  const credit = image.credit
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

  const trackIds = new Set<string>()
  for (const track of band.tracks) {
    if (trackIds.has(track.id)) errors.push(`${band.id}: 중복 트랙 ID ${track.id}`)
    trackIds.add(track.id)
    if (!/^[A-Za-z0-9_-]{11}$/.test(track.youtubeId)) errors.push(`${band.id}/${track.id}: 잘못된 YouTube ID`)
    if (track.source.url !== `https://www.youtube.com/watch?v=${track.youtubeId}`) errors.push(`${band.id}/${track.id}: YouTube ID와 출처 URL 불일치`)
    if (youtubeIds.has(track.youtubeId)) warnings.push(`${band.id}/${track.id}: 같은 YouTube 링크가 다른 대표곡에도 사용됨 (${track.youtubeId})`)
    youtubeIds.add(track.youtubeId)
  }

  const relationTargets = new Set<string>()
  for (const relation of band.relations) {
    if (relation.targetBandId === band.id) errors.push(`${band.id}: 자기 자신을 가리키는 관계`)
    if (relationTargets.has(relation.targetBandId)) errors.push(`${band.id}: 중복 관계 ${relation.targetBandId}`)
    relationTargets.add(relation.targetBandId)
    if (relation.reviewStatus !== 'draft') {
      if (!relation.source) errors.push(`${band.id} → ${relation.targetBandId}: 검수 관계 출처 누락`)
      if (!relation.reviewedBy || !relation.reviewedAt) errors.push(`${band.id} → ${relation.targetBandId}: 검수자·검수 시각 누락`)
      if (relation.source && !/^https:\/\//.test(relation.source.url)) errors.push(`${band.id} → ${relation.targetBandId}: 관계 출처 URL 형식 오류`)
    }
  }
}

for (const band of bands) {
  for (const relation of band.relations) {
    if (!bandIds.has(relation.targetBandId)) errors.push(`${band.id}: 존재하지 않는 관계 대상 ${relation.targetBandId}`)
  }
}

console.log('ROCK ATLAS 카탈로그 무결성 검사')
console.log(`밴드 ${bands.length} · 장르 ${genres.length} · 트랙 ${bands.flatMap((band) => band.tracks).length} · 관계 ${bands.flatMap((band) => band.relations).length}`)
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
