import { describe, it, expect } from 'vitest'
import {
  parseTokenExchangeRequest,
  parseTokenRefreshRequest,
  parseGoogleTokenResponse,
} from './gauth-types'

describe('parseTokenExchangeRequest', () => {
  it('accepts a well-formed body', () => {
    const r = parseTokenExchangeRequest({ code: '4/abc', redirectUri: 'https://allmarks.app' })
    expect(r).toEqual({ ok: true, value: { code: '4/abc', redirectUri: 'https://allmarks.app' } })
  })
  it('rejects a missing code', () => {
    expect(parseTokenExchangeRequest({ redirectUri: 'https://allmarks.app' }).ok).toBe(false)
  })
  it('rejects an empty code', () => {
    expect(parseTokenExchangeRequest({ code: '', redirectUri: 'https://allmarks.app' }).ok).toBe(false)
  })
  it('rejects a non-URL redirectUri', () => {
    expect(parseTokenExchangeRequest({ code: '4/abc', redirectUri: 'not-a-url' }).ok).toBe(false)
  })
  it('rejects a non-object', () => {
    expect(parseTokenExchangeRequest('nope').ok).toBe(false)
    expect(parseTokenExchangeRequest(null).ok).toBe(false)
  })
  it('strips unknown fields (z.object default)', () => {
    const r = parseTokenExchangeRequest({ code: '4/abc', redirectUri: 'https://allmarks.app', evil: 1 })
    expect(r.ok).toBe(true)
    if (r.ok) expect('evil' in r.value).toBe(false)
  })
})

describe('parseTokenRefreshRequest', () => {
  it('accepts a well-formed body', () => {
    expect(parseTokenRefreshRequest({ refreshToken: '1//abc' })).toEqual({
      ok: true, value: { refreshToken: '1//abc' },
    })
  })
  it('rejects an empty refreshToken', () => {
    expect(parseTokenRefreshRequest({ refreshToken: '' }).ok).toBe(false)
  })
})

describe('parseGoogleTokenResponse', () => {
  it('accepts a full authorization_code response (with refresh_token)', () => {
    const g = {
      access_token: 'ya29.a', expires_in: 3599, token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive.file openid', refresh_token: '1//r',
    }
    const r = parseGoogleTokenResponse(g)
    expect(r).toEqual({ ok: true, value: g })
  })
  it('accepts a refresh response with no refresh_token', () => {
    const g = { access_token: 'ya29.b', expires_in: 3599, token_type: 'Bearer', scope: 'openid' }
    expect(parseGoogleTokenResponse(g).ok).toBe(true)
  })
  it('rejects a response missing access_token', () => {
    expect(parseGoogleTokenResponse({ expires_in: 3599, token_type: 'Bearer', scope: 'x' }).ok).toBe(false)
  })
  it('rejects a non-numeric expires_in', () => {
    expect(parseGoogleTokenResponse({
      access_token: 'a', expires_in: 'soon', token_type: 'Bearer', scope: 'x',
    }).ok).toBe(false)
  })
  it('rejects a Google error body', () => {
    expect(parseGoogleTokenResponse({ error: 'invalid_grant', error_description: 'Bad Request' }).ok).toBe(false)
  })
})
