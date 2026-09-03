import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./google-identity', () => ({
  loadGoogleIdentityServices: vi.fn(),
}))

import {
  computeExpiresAt, isAccessTokenExpired, requestAuthCode, exchangeCode,
  refreshAccessToken, GauthError, SYNC_OAUTH_SCOPE,
} from './auth'
import { loadGoogleIdentityServices } from './google-identity'
import type { GoogleCodeClientConfig, GoogleCodeClient } from './google-identity'

const mockLoad = vi.mocked(loadGoogleIdentityServices)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('computeExpiresAt / isAccessTokenExpired (pure)', () => {
  it('applies a 60s safety margin', () => {
    expect(computeExpiresAt(3600, 1_000_000)).toBe(1_000_000 + (3600 - 60) * 1000)
  })
  it('never returns a time before now (tiny expires_in)', () => {
    expect(computeExpiresAt(10, 1_000_000)).toBe(1_000_000)
  })
  it('isAccessTokenExpired is true at/after expiry', () => {
    expect(isAccessTokenExpired(1000, 999)).toBe(false)
    expect(isAccessTokenExpired(1000, 1000)).toBe(true)
    expect(isAccessTokenExpired(1000, 1001)).toBe(true)
  })
})

function stubGis(initCodeClient: (config: GoogleCodeClientConfig) => GoogleCodeClient): void {
  mockLoad.mockResolvedValue({ accounts: { oauth2: { initCodeClient } } })
}

describe('requestAuthCode', () => {
  it('resolves the code from the GIS popup callback', async () => {
    let captured: GoogleCodeClientConfig | null = null
    stubGis((config) => {
      captured = config
      return { requestCode: () => config.callback({ code: '4/xyz' }) }
    })
    await expect(requestAuthCode()).resolves.toBe('4/xyz')
    expect(captured!.scope).toBe(SYNC_OAUTH_SCOPE)
    expect(captured!.ux_mode).toBe('popup')
  })

  it('rejects with GauthError when the callback carries an error', async () => {
    stubGis((config) => ({ requestCode: () => config.callback({ error: 'access_denied', error_description: 'user said no' }) }))
    await expect(requestAuthCode()).rejects.toBeInstanceOf(GauthError)
  })

  it('rejects with GauthError when error_callback fires (popup closed)', async () => {
    stubGis((config) => ({
      requestCode: () => config.error_callback?.({ type: 'popup_closed' }),
    }))
    await expect(requestAuthCode()).rejects.toBeInstanceOf(GauthError)
  })
})

const GOOGLE_OK = {
  access_token: 'ya29.a', expires_in: 3599, token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/drive.file openid', refresh_token: '1//r',
}

describe('exchangeCode', () => {
  it('POSTs {code, redirectUri} to /api/gauth/token and maps to SyncTokens', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(GOOGLE_OK), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const tokens = await exchangeCode('4/xyz', 'https://allmarks.app')
    expect(tokens.accessToken).toBe('ya29.a')
    expect(tokens.refreshToken).toBe('1//r')
    expect(tokens.scope).toBe(GOOGLE_OK.scope)
    expect(tokens.expiresAt).toBe(1_000_000 + (3599 - 60) * 1000)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/gauth/token')
    expect(JSON.parse(init.body as string)).toEqual({ code: '4/xyz', redirectUri: 'https://allmarks.app' })
  })

  it('throws GauthError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"google_rejected"}', { status: 400 })))
    await expect(exchangeCode('4/bad', 'https://allmarks.app')).rejects.toBeInstanceOf(GauthError)
  })

  it('throws GauthError when the response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>CF error</html>', { status: 200 })))
    await expect(exchangeCode('4/x', 'https://allmarks.app')).rejects.toBeInstanceOf(GauthError)
  })

  it('throws GauthError when the JSON fails schema validation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"access_token":""}', { status: 200 })))
    await expect(exchangeCode('4/x', 'https://allmarks.app')).rejects.toBeInstanceOf(GauthError)
  })
})

describe('refreshAccessToken', () => {
  it('POSTs {refreshToken} to /api/gauth/refresh and maps to SyncTokens (no refreshToken back)', async () => {
    const body = { access_token: 'ya29.new', expires_in: 3599, token_type: 'Bearer', scope: 'openid' }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000)

    const tokens = await refreshAccessToken('1//r')
    expect(tokens.accessToken).toBe('ya29.new')
    expect(tokens.refreshToken).toBeUndefined()
    expect(tokens.expiresAt).toBe(2_000_000 + (3599 - 60) * 1000)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/gauth/refresh')
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: '1//r' })
  })

  it('throws GauthError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"google_rejected"}', { status: 400 })))
    await expect(refreshAccessToken('1//dead')).rejects.toBeInstanceOf(GauthError)
  })
})
