import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequestPost } from './refresh'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ENV = { GOOGLE_OAUTH_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'secret-xyz' }

function makeCtx(body: unknown, env: Record<string, string> = ENV) {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    request: new Request('https://allmarks.app/api/gauth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env,
  }
}

const GOOGLE_REFRESH_OK = {
  access_token: 'ya29.new', expires_in: 3599, token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/drive.file openid',
}

describe('POST /api/gauth/refresh', () => {
  it('refreshes the access token and passes the JSON straight through', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(GOOGLE_REFRESH_OK), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await onRequestPost(makeCtx({ refreshToken: '1//rrr' }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(GOOGLE_REFRESH_OK)

    const calls = fetchMock.mock.calls as unknown[][]
    expect(calls.length).toBeGreaterThan(0)
    const [calledUrl, init] = calls[0] as [string, RequestInit]
    expect(calledUrl).toBe('https://oauth2.googleapis.com/token')
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('refresh_token')).toBe('1//rrr')
    expect(sent.get('client_id')).toBe(ENV.GOOGLE_OAUTH_CLIENT_ID)
    expect(sent.get('client_secret')).toBe(ENV.GOOGLE_OAUTH_CLIENT_SECRET)
    expect(sent.get('grant_type')).toBe('refresh_token')
    expect(sent.has('redirect_uri')).toBe(false)
  })

  it('400 on a missing refreshToken (never calls Google)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await onRequestPost(makeCtx({}) as never)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('500 when the OAuth env vars are not configured', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await onRequestPost(makeCtx({ refreshToken: '1//rrr' }, {}) as never)
    expect(res.status).toBe(500)
  })

  it('400 when Google rejects the refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })))
    const res = await onRequestPost(makeCtx({ refreshToken: '1//dead' }) as never)
    expect(res.status).toBe(400)
  })

  it('502 when the fetch to Google throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const res = await onRequestPost(makeCtx({ refreshToken: '1//rrr' }) as never)
    expect(res.status).toBe(502)
  })
})
