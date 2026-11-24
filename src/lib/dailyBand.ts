import type { Band } from '../types/music'

/** 오늘의 밴드 (plan P4-7): 날짜를 시드로 한 결정적 선택 — 같은 날에는 누구에게나 같은 밴드가 나온다.
 *  id 순으로 정렬한 뒤 고르므로 밴드 배열의 순서가 바뀌어도 결과는 같다. */
export function dailyBand(bands: readonly Band[], date = new Date()) {
  const pool = [...bands].sort((a, b) => a.id.localeCompare(b.id))
  if (!pool.length) return undefined
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let hash = 2166136261
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return pool[hash % pool.length]
}
