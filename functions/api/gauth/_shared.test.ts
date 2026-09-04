import { describe, it, expect, vi, afterEach } from 'vitest'
import { relayGoogleTokenResponse, postToGoogleToken } from './_shared'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('relayGoogleTokenResponse', () => {
  it('passes a 2xx body straight through as a 200 with Cache-Control: no-store', async () => {
    for (const status of [200, 204]) {
      const res = relayGoogleTokenResponse(status, '{"access_token":"ya29.x"}')
      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(await res.text()).toBe('{"access_token":"ya29.x"}')
    }
  })

  it("forwards Google's error code as google_error on a 400", async () => {
    const res = relayGoogleTokenResponse(400, '{"error":"invalid_grant","error_description":"Bad Request"}')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'google_rejected', google_error: 'invalid_grant' })
  })

  it('forwards the error code on a 401 (invalid_client)', async () => {
    const res = relayGoogleTokenResponse(401, '{"error":"invalid_client"}')
    expect(res.status).toBe(400)
    expect((await res.json() as { google_error?: string }).google_error).toBe('invalid_client')
  })

  it('omits google_error when the body is not JSON', async () => {
    const res = relayGoogleTokenResponse(400, 'oops')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'google_rejected' })
  })

  it('omits google_error when the JSON body carries no error field', async () => {
    const res = relayGoogleTokenResponse(400, '{"foo":1}')
    expect(res.status).toBe(400)
    const body = await res.json() as Record<string, unknown>
    expect(body).toEqual({ error: 'google_rejected' })
    expect('google_error' in body).toBe(false)
  })

  it('maps an unreachable upstream (status 0) to 502', async () => {
    const res = relayGoogleTokenResponse(0, '')
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'upstream_unreachable' })
  })

  it('maps retriable upstream errors (408, 429) to 502', async () => {
    for (const status of [408, 429]) {
      const res = relayGoogleTokenResponse(status, '{"error":"rate_limit_exceeded"}')
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: 'upstream_unreachable' })
    }
  })

  it('maps Google 5xx (500, 503) to 502', async () => {
    for (const status of [500, 503]) {
      const res = relayGoogleTokenResponse(status, 'upstream boom')
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: 'upstream_unreachable' })
    }
  })
})

describe('postToGoogleToken', () => {
  it('resolves { status: 0, text: "" } when the fetch to Google throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net') }))
    await expect(postToGoogleToken({ grant_type: 'refresh_token' })).resolves.toEqual({ status: 0, text: '' })
  })

  it('POSTs form-urlencoded params to the Google token endpoint and returns status + text', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await postToGoogleToken({ code: '4/abc', grant_type: 'authorization_code' })
    expect(result).toEqual({ status: 200, text: '{"ok":1}' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('code')).toBe('4/abc')
    expect(sent.get('grant_type')).toBe('authorization_code')
  })
})
