import { describe, expect, it } from 'vitest'
import { readStudioJson, StudioUnavailableError } from './studioApiClient'

describe('Studio API response safety', () => {
  it('reads a JSON response', async () => {
    const result = await readStudioJson<{ available: boolean }>(new Response('{"available":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }))
    expect(result.available).toBe(true)
  })

  it('rejects an HTML fallback instead of parsing it as JSON', async () => {
    await expect(readStudioJson(new Response('<!doctype html><title>ROCK ATLAS</title>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }))).rejects.toBeInstanceOf(StudioUnavailableError)
  })

  it('preserves a useful server error message', async () => {
    await expect(readStudioJson(new Response('YOUTUBE_API_KEY가 설정되지 않았습니다.', {
      status: 501,
      headers: { 'Content-Type': 'text/plain' },
    }))).rejects.toThrow('YOUTUBE_API_KEY')
  })
})
