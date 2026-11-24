/**
 * 빠진 무드 점수 찾기. 점수가 0~1인데 근거가 있는 무드를 뽑는다.
 *   npm run audit:mood-evidence            (상위 목록)
 *   npm run audit:mood-evidence -- --all   (전체)
 *
 * 근거 세 가지 — 어느 하나만으로는 확정하지 않고 합산해서 순위만 매긴다. 최종 판단은 사람이 한다.
 *   1. 글: 소개·소리 설명·대표곡 가이드·태그에 그 무드를 가리키는 말이 있다 (예: "리프", "떼창").
 *   2. 세부장르: 그 세부장르라면 보통 갖는 무드다 (예: 스래시 → 빠르고 질주하는).
 *   3. 동료: 같은 대표 장르+세부장르를 공유하는 밴드들의 평균이 3점 이상이다.
 */
import { readFile } from 'node:fs/promises'
import { taxonomyPeers, type ReviewableBand } from '../src/lib/taxonomyReview.ts'

interface CatalogBand extends ReviewableBand {
  summary: string
  style: string
  tags: string[]
  tracks: Array<{ guide?: string }>
}
const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as { bands: CatalogBand[] }
const taxonomy = JSON.parse(await readFile(new URL('../src/data/taxonomy.v2.json', import.meta.url), 'utf8')) as { moods: Array<{ id: string; name: string }> }
const moodName = new Map(taxonomy.moods.map((mood) => [mood.id, mood.name]))

const keywords: Record<string, string[]> = {
  'riff-solo-driven': ['리프', '솔로', '기타 연주', '기타 레이어', '트윈 기타', '기타 톤', '기타 사운드', '기타리스트'],
  'anthemic-live': ['떼창', '스타디움', '아레나', '앤섬', '찬가', '합창하', '따라 부르', '공연장', '라이브 에너지'],
  'electronic-synth': ['신스', '신시사이저', '전자음', '일렉트로닉', '드럼 머신', '프로그래밍', '샘플링', '키보드 사운드'],
  'acoustic-organic': ['어쿠스틱', '통기타', '만돌린', '밴조', '포크'],
  'epic-cinematic': ['웅장', '오케스트라', '심포닉', '영화적', '서사', '합창단', '오페라'],
  'dreamy-ethereal': ['몽환', '잔향', '리버브', '꿈결', '꿈같', '아련'],
  'noisy-wall': ['노이즈', '피드백', '굉음', '사운드의 벽', '퍼즈', '소음'],
  'fast-driving': ['빠른', '질주', '속도감', '스피드', '빠르게', '폭주'],
  'aggressive-heavy': ['공격적', '분노', '격렬', '그로울', '스크림', '폭발적인 에너지', '맹렬'],
  'massive-heavy': ['묵직', '육중', '다운튜닝', '무거운', '헤비한', '두꺼운 사운드'],
  'slow-calm': ['잔잔', '느린 템포', '차분', '고요', '나른'],
  'melancholic-lonely': ['우울', '쓸쓸', '고독', '상실', '슬픔', '멜랑콜리', '애수', '비애'],
  'dark-gloomy': ['어두운', '음울', '음산', '고딕', '불길', '오컬트', '공포', '호러'],
  'warm-comforting': ['따뜻', '포근', '편안'],
  'romantic-emotional': ['서정', '감성적', '사랑 노래', '발라드', '낭만'],
  'youth-rebellious': ['반항', '청춘', '저항', '십대', '젊은 세대', '반체제'],
  'hopeful-uplifting': ['희망', '벅찬', '고양감', '긍정적'],
  'cold-urban': ['차가운', '도시적', '냉소', '미니멀', '건조한'],
  'cosmic-psychedelic': ['사이키델릭', '환각', '우주', '스페이스'],
  'groovy-danceable': ['그루브', '그루비', '댄스', '춤', '펑키', '디스코', '댄서블', '베이스 라인'],
  'technical-complex': ['변박', '테크니컬', '복잡한', '기교', '정교한 연주', '연주력', '비르투오소'],
  'experimental-weird': ['실험', '기묘', '아방가르드', '파격', '기괴'],
  'long-form-immersive': ['대곡', '긴 곡', '장편', '조곡', '10분', '20분', '긴 러닝타임'],
  'bright-upbeat': ['경쾌', '밝은', '신나는', '발랄', '캐치', '흥겨'],
}

const subgenreMoods: Record<string, string[]> = {
  'thrash-metal': ['fast-driving', 'aggressive-heavy', 'riff-solo-driven'], 'speed-metal': ['fast-driving', 'riff-solo-driven'],
  'power-metal': ['fast-driving', 'epic-cinematic'], 'symphonic-metal': ['epic-cinematic'], 'symphonic-black-metal': ['epic-cinematic', 'dark-gloomy'], 'symphonic-prog': ['epic-cinematic', 'technical-complex'],
  'death-metal': ['aggressive-heavy'], 'black-metal': ['aggressive-heavy', 'dark-gloomy'], grindcore: ['aggressive-heavy', 'fast-driving'], deathcore: ['aggressive-heavy', 'massive-heavy'], 'technical-death-metal': ['technical-complex', 'aggressive-heavy'],
  'doom-metal': ['massive-heavy', 'dark-gloomy'], 'sludge-metal': ['massive-heavy'], 'stoner-rock': ['massive-heavy'], 'stoner-metal': ['massive-heavy'], 'drone-metal': ['massive-heavy', 'long-form-immersive'], 'post-metal': ['massive-heavy', 'long-form-immersive'],
  shoegaze: ['noisy-wall', 'dreamy-ethereal'], blackgaze: ['noisy-wall', 'dreamy-ethereal'], 'dream-pop': ['dreamy-ethereal'], 'ethereal-wave': ['dreamy-ethereal'], slowcore: ['slow-calm'], 'post-rock': ['long-form-immersive'],
  synthpop: ['electronic-synth'], electropop: ['electronic-synth'], darkwave: ['electronic-synth', 'dark-gloomy'], 'industrial-metal': ['electronic-synth', 'aggressive-heavy'], 'industrial-rock': ['electronic-synth'], electronicore: ['electronic-synth'], 'synth-rock': ['electronic-synth'], 'electronic-rock': ['electronic-synth'],
  'progressive-rock': ['technical-complex'], 'progressive-metal': ['technical-complex'], 'math-rock': ['technical-complex'], djent: ['technical-complex', 'massive-heavy'], 'progressive-death-metal': ['technical-complex'],
  'psychedelic-rock': ['cosmic-psychedelic'], 'space-rock': ['cosmic-psychedelic'], 'neo-psychedelia': ['cosmic-psychedelic'], 'acid-rock': ['cosmic-psychedelic'], 'psychedelic-pop': ['cosmic-psychedelic'],
  'folk-rock': ['acoustic-organic'], 'indie-folk': ['acoustic-organic'], 'folk-pop': ['acoustic-organic'],
  'gothic-rock': ['dark-gloomy'], 'gothic-metal': ['dark-gloomy'],
  'punk-rock': ['fast-driving', 'youth-rebellious'], 'hardcore-punk': ['fast-driving', 'aggressive-heavy', 'youth-rebellious'], 'pop-punk': ['youth-rebellious', 'bright-upbeat'], 'skate-punk': ['fast-driving', 'youth-rebellious'],
  'arena-rock': ['anthemic-live'], 'dance-punk': ['groovy-danceable'], 'dance-rock': ['groovy-danceable'], 'funk-rock': ['groovy-danceable'], 'funk-metal': ['groovy-danceable'], madchester: ['groovy-danceable'],
  'noise-rock': ['noisy-wall'], 'noise-pop': ['noisy-wall'],
  'hard-rock': ['riff-solo-driven'], 'blues-rock': ['riff-solo-driven'], nwobhm: ['riff-solo-driven'], 'traditional-heavy-metal': ['riff-solo-driven'], 'glam-metal': ['riff-solo-driven', 'anthemic-live'], 'groove-metal': ['massive-heavy', 'aggressive-heavy'],
  'experimental-rock': ['experimental-weird'], 'avant-garde-metal': ['experimental-weird'], 'no-wave': ['experimental-weird'], krautrock: ['experimental-weird'],
}

const showAll = process.argv.includes('--all')
const rows: Array<{ band: string; status: string; mood: string; score: number; total: number; evidence: string[] }> = []
for (const band of catalog.bands) {
  const taxonomy = band.taxonomyV2
  if (!taxonomy) continue
  const text = [band.summary, band.style, ...band.tags, ...band.tracks.map((track) => track.guide ?? '')].join(' ')
  const peers = taxonomyPeers(band, catalog.bands)
  for (const moodId of Object.keys(keywords)) {
    const score = taxonomy.moodScores[moodId as never] ?? 0
    if (score > 1) continue
    const evidence: string[] = []
    let total = 0
    const hits = keywords[moodId].filter((word) => text.includes(word))
    if (hits.length) { total += Math.min(hits.length, 2); evidence.push(`글: ${hits.slice(0, 3).join(', ')}`) }
    const fromSubgenres = taxonomy.subgenreIds.filter((id) => subgenreMoods[id]?.includes(moodId))
    if (fromSubgenres.length) { total += 1.5; evidence.push(`세부장르: ${fromSubgenres.join(', ')}`) }
    if (peers.length >= 3) {
      const mean = peers.reduce((sum, peer) => sum + (peer.taxonomyV2!.moodScores[moodId as never] ?? 0), 0) / peers.length
      if (mean >= 3) { total += mean >= 3.5 ? 1.5 : 1; evidence.push(`동료 평균 ${mean.toFixed(1)} (${peers.length}팀)`) }
    }
    // 서로 다른 종류의 근거가 2개 이상이거나, 글에 두 단어 이상 나온 경우만 올린다.
    if (evidence.length >= 2 || hits.length >= 2) rows.push({ band: band.name, status: taxonomy.reviewStatus, mood: moodId, score, total, evidence })
  }
}
rows.sort((a, b) => b.total - a.total || a.band.localeCompare(b.band))
console.log(`빠진 무드 후보 ${rows.length}건 (점수 0~1인데 근거가 있는 무드) · 밴드 ${new Set(rows.map((row) => row.band)).size}팀`)
for (const row of showAll ? rows : rows.slice(0, 80)) {
  console.log(`${row.total.toFixed(1).padStart(4)}  ${row.status === 'reviewed' ? '✓' : '·'} ${row.band} — ${moodName.get(row.mood)} ${row.score}점 · ${row.evidence.join(' / ')}`)
}
if (!showAll && rows.length > 80) console.log(`… 전체: npm run audit:mood-evidence -- --all`)
