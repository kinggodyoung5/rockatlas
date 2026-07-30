import { useCallback, useEffect, useState } from 'react'
import { decodeJourney, type JourneyStep, type JourneyVia } from '../lib/hitchhiking'

const FAVORITES_KEY = 'rock-atlas:favorites'
const HISTORY_KEY = 'rock-atlas:history'
const JOURNEY_KEY = 'rock-atlas:hitchhiking-journey'
const MAX_HISTORY = 12
const MAX_JOURNEY = 12

function readList(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function readJourney(): JourneyStep[] {
  const sharedJourney = decodeJourney(new URLSearchParams(window.location.search).get('journey'))
  if (sharedJourney.length) return sharedJourney
  const directBandId = window.location.hash.match(/^#band=([a-z0-9-]+)$/i)?.[1]
  if (directBandId) return [{ bandId: directBandId }]
  try {
    const value = JSON.parse(window.localStorage.getItem(JOURNEY_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    const serialized = value
      .filter((item) => Boolean(item) && typeof item.bandId === 'string')
      .map((item) => `${item.bandId}${typeof item.via === 'string' ? `~${item.via}` : ''}`)
      .join(',')
    return decodeJourney(serialized).slice(-MAX_JOURNEY)
  } catch {
    return []
  }
}

export function useExplorerState() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readList(FAVORITES_KEY))
  const [historyIds, setHistoryIds] = useState<string[]>(() => readList(HISTORY_KEY))
  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>(readJourney)

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds))
  }, [favoriteIds])

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(historyIds))
  }, [historyIds])

  useEffect(() => {
    window.localStorage.setItem(JOURNEY_KEY, JSON.stringify(journeySteps))
  }, [journeySteps])

  const toggleFavorite = useCallback((bandId: string) => {
    setFavoriteIds((current) => current.includes(bandId)
      ? current.filter((id) => id !== bandId)
      : [...current, bandId])
  }, [])

  const recordVisit = useCallback((bandId: string) => {
    setHistoryIds((current) => [bandId, ...current.filter((id) => id !== bandId)].slice(0, MAX_HISTORY))
  }, [])

  const clearHistory = useCallback(() => setHistoryIds([]), [])

  const startJourney = useCallback((bandId: string) => {
    setJourneySteps([{ bandId }])
  }, [])

  const travelJourney = useCallback((bandId: string, via: JourneyVia) => {
    setJourneySteps((current) => {
      if (!current.length) return [{ bandId }]
      if (current.at(-1)?.bandId === bandId) return current
      return [...current, { bandId, via }].slice(-MAX_JOURNEY)
    })
  }, [])

  const clearJourney = useCallback(() => setJourneySteps([]), [])
  const restoreJourney = useCallback((steps: JourneyStep[]) => setJourneySteps(steps.slice(-MAX_JOURNEY)), [])

  return {
    favoriteIds,
    historyIds,
    journeySteps,
    toggleFavorite,
    recordVisit,
    clearHistory,
    startJourney,
    travelJourney,
    clearJourney,
    restoreJourney,
  }
}
