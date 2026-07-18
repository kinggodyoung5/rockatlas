import { useCallback, useEffect, useState } from 'react'

const FAVORITES_KEY = 'rock-atlas:favorites'
const HISTORY_KEY = 'rock-atlas:history'
const MAX_HISTORY = 12

function readList(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function useExplorerState() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readList(FAVORITES_KEY))
  const [historyIds, setHistoryIds] = useState<string[]>(() => readList(HISTORY_KEY))

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds))
  }, [favoriteIds])

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(historyIds))
  }, [historyIds])

  const toggleFavorite = useCallback((bandId: string) => {
    setFavoriteIds((current) => current.includes(bandId)
      ? current.filter((id) => id !== bandId)
      : [...current, bandId])
  }, [])

  const recordVisit = useCallback((bandId: string) => {
    setHistoryIds((current) => [bandId, ...current.filter((id) => id !== bandId)].slice(0, MAX_HISTORY))
  }, [])

  const clearHistory = useCallback(() => setHistoryIds([]), [])

  return { favoriteIds, historyIds, toggleFavorite, recordVisit, clearHistory }
}
