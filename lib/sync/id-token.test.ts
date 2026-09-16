import { describe, it, expect } from 'vitest'
import { decodeIdTokenEmail } from './id-token'

function fakeIdToken(payload: unknown): string {
  const base64url = (s: string): string =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

describe('decodeIdTokenEmail', () => {
  it('extracts the email claim from a well-formed token', () => {
    const token = fakeIdToken({ email: 'user@example.com', sub: '123' })
    expect(decodeIdTokenEmail(token)).toBe('user@example.com')
  })
  it('returns null when the payload has no email claim', () => {
    const token = fakeIdToken({ sub: '123' })
    expect(decodeIdTokenEmail(token)).toBeNull()
  })
  it('returns null for a token that is not 3 dot-separated segments', () => {
    expect(decodeIdTokenEmail('not-a-jwt')).toBeNull()
  })
  it('returns null when the payload segment is not valid base64/JSON', () => {
    expect(decodeIdTokenEmail('aaa.not-base64!!!.bbb')).toBeNull()
  })
})
