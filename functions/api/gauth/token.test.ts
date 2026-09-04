import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequestPost } from './token'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ENV = { GOOGLE_OAUTH_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'secret-xyz' }

function makeCtx(body: unknown, env: Record<string, string> = ENV) {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    request: new Request('https://allmarks.app/api/gauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env,
  }
}

const GOOGLE_OK = {
  access_token: 'ya29.aaa', expires_in: 3599, token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/drive.file openid', refresh_token: '1//rrr',
}

describe('POST /api/gauth/token', () => {
  it('exchanges the code with Google and passes the token JSON straight through', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(GOOGLE_OK), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(GOOGLE_OK)

    // Verify the outgoing request to Google
    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe('https://oauth2.googleapis.com/token')
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('code')).toBe('4/abc')
    expect(sent.get('client_id')).toBe(ENV.GOOGLE_OAUTH_CLIENT_ID)
    expect(sent.get('client_secret')).toBe(ENV.GOOGLE_OAUTH_CLIENT_SECRET)
    expect(sent.get('redirect_uri')).toBe('https://allmarks.app')
    expect(sent.get('grant_type')).toBe('authorization_code')
  })

  it('sets Cache-Control: no-store on the success response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(GOOGLE_OK), { status: 200 })))
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('400 on a missing code (never calls Google)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await onRequestPost(makeCtx({ redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('400 on malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await onRequestPost(makeCtx('{not json') as never)
    expect(res.status).toBe(400)
  })

  it('500 when the OAuth env vars are not configured', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }, {}) as never)
    expect(res.status).toBe(500)
  })

  it('400 when Google rejects the code (invalid_grant)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })))
    const res = await onRequestPost(makeCtx({ code: '4/bad', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string; google_error?: string }
    expect(body.error).toBeTruthy()
    expect(body.google_error).toBe('invalid_grant')
  })

  it('502 when Google returns a 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream boom', { status: 503 })))
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(502)
  })

  it('502 when the fetch to Google throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(502)
  })

  it('413 when the body exceeds the cap (no Content-Length header)', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const huge = JSON.stringify({ code: 'x'.repeat(20_000), redirectUri: 'https://allmarks.app' })
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode(huge)); c.close() },
    })
    const ctx = {
      request: new Request('https://allmarks.app/api/gauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: stream, duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
      env: ENV,
    }
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(413)
  })
})
