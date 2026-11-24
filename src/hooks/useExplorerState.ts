import { useCallback, useEffect, useState } from 'react'
import { decodeJourney, type JourneyStep, type JourneyVia } from '../lib/hitchhiking'

const FAVORITES_KEY = 'rock-atlas:favorites'
const HISTORY_KEY = 'rock-atlas:history'
const JOURNEY_KEY = 'rock-atlas:hitchhiking-journey'
/** 화면의 "최근 탐험" 칩은 6개만 보이지만, 취향 프로필(plan P3-5)을 위해 60개까지 쌓는다. */
const MAX_HISTORY = 60
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

  /** 시작 화면에서 고른 밴드를 한 번에 저장한다(이미 저장한 밴드는 그대로). */
  const addFavorites = useCallback((bandIds: string[]) => {
    setFavoriteIds((current) => [...current, ...bandIds.filter((id) => !current.includes(id))])
  }, [])

  /** 내보내기/가져오기(JSON 파일)로 다른 기기에서 이어 쓴다. 가져올 때는 형식이 맞는 값만 받는다. */
  const exportState = useCallback(() => ({ app: 'rock-atlas', version: 1, exportedAt: new Date().toISOString(), favorites: favoriteIds, history: historyIds, journey: journeySteps }), [favoriteIds, historyIds, journeySteps])
  const importState = useCallback((payload: unknown) => {
    const data = payload as { app?: unknown; favorites?: unknown; history?: unknown; journey?: unknown }
    if (!data || data.app !== 'rock-atlas') throw new Error('ROCK ATLAS에서 내보낸 파일이 아닙니다.')
    const ids = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^[a-z0-9][a-z0-9-]*$/i.test(item)) : []
    setFavoriteIds([...new Set(ids(data.favorites))])
    setHistoryIds(ids(data.history).slice(0, MAX_HISTORY))
    if (Array.isArray(data.journey)) setJourneySteps(decodeJourney(data.journey.map((step: { bandId?: unknown; via?: unknown }) => `${String(step?.bandId ?? '')}${typeof step?.via === 'string' ? `~${step.via}` : ''}`).join(',')).slice(-MAX_JOURNEY))
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
    addFavorites,
    exportState,
    importState,
  }
}
