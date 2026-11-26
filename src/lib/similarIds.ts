/** 없는 밴드 주소(#band=…)에 비슷한 id를 제안한다 (plan P5-4 #8). 편집 거리 + 포함 관계로 가까운 3개. */
export function similarBandIds(missing: string, ids: readonly string[], limit = 3) {
  const target = missing.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
  if (!target) return []
  const distance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index)
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0]
      row[0] = i
      for (let j = 1; j <= b.length; j += 1) {
        const current = row[j]
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
        previous = current
      }
    }
    return row[b.length]
  }
  return ids
    .map((id) => {
      const compact = id.replace(/[^a-z0-9]+/g, '')
      const contains = compact.includes(target) || target.includes(compact)
      return { id, score: distance(target, compact) - (contains ? 3 : 0) }
    })
    .filter((item) => item.score <= Math.max(3, Math.floor(target.length / 2)))
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((item) => item.id)
}
