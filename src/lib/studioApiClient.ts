const unavailableMessage = '이 화면은 저장 가능한 ROCK ATLAS Studio가 아닙니다. 프로젝트 폴더의 ‘운영자페이지-열기.bat’을 실행한 뒤 열린 화면에서 작업하세요.'

export class StudioUnavailableError extends Error {
  constructor(message = unavailableMessage) {
    super(message)
    this.name = 'StudioUnavailableError'
  }
}

export async function readStudioJson<T>(response: Response): Promise<T> {
  const body = await response.text()
  if (!response.ok) throw new Error(body.trim() || `Studio 요청 실패 (${response.status})`)
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new StudioUnavailableError()
  }
  try {
    return JSON.parse(body) as T
  } catch {
    throw new Error('Studio 서버 응답을 읽지 못했습니다. 운영자 페이지를 다시 실행하세요.')
  }
}

export async function studioFetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  return readStudioJson<T>(await fetch(input, init))
}

export async function checkStudioAvailability() {
  if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) return false
  try {
    const result = await studioFetchJson<{ available?: boolean; canWrite?: boolean }>('/api/studio/capability', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    return result.available === true && result.canWrite === true
  } catch {
    return false
  }
}

export { unavailableMessage as studioUnavailableMessage }
