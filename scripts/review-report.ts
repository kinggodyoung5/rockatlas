import { bands } from '../src/data/bands.ts'
import { reviewBand, summarizeCatalogReview } from '../src/data/review.ts'

const summary = summarizeCatalogReview(bands)
const strict = process.argv.includes('--strict')

console.log('ROCK ATLAS 데이터 검수 리포트')
console.log(`밴드: ${summary.totalBands}개 (초안 ${summary.draftBands} · 공개 ${summary.publishedBands})`)
console.log(`공개 준비 완료: ${summary.readyBands}/${summary.totalBands}`)
console.log(`미확인 이미지: ${summary.pendingImages}/${summary.totalBands}`)
console.log(`검수된 대표곡: ${summary.reviewedTracks}/${summary.totalTracks}`)
console.log(`유효한 외부 링크: ${summary.validTrackLinks}/${summary.totalTracks}`)
console.log(`미확인 대표곡: ${summary.pendingTracks}/${summary.totalTracks}`)
console.log(`미확인 관계: ${summary.pendingRelations}/${summary.totalRelations}`)

for (const band of bands) {
  const review = reviewBand(band)
  const pending = review.checks.filter((check) => !check.passed).map((check) => check.label).join(', ')
  console.log(`- ${band.name}: ${review.passedChecks}/${review.totalChecks}${pending ? ` · ${pending}` : ''}`)
}

if (strict && summary.readyBands !== summary.totalBands) {
  console.error('\n공개 기준을 충족하지 못한 데이터가 있어 strict 검사를 실패 처리합니다.')
  process.exitCode = 1
}
