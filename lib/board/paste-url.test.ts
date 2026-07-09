import { describe, it, expect } from 'vitest'
import { normalizeToUrl } from './paste-url'

describe('normalizeToUrl', () => {
  it('returns an already-valid https URL unchanged', () => {
    expect(normalizeToUrl('https://example.com/a')).toBe('https://example.com/a')
  })
  it('returns an already-valid http URL unchanged', () => {
    expect(normalizeToUrl('http://example.com')).toBe('http://example.com')
  })
  it('prepends https:// to a bare domain', () => {
    expect(normalizeToUrl('example.com')).toBe('https://example.com')
  })
  it('prepends https:// to a bare domain with path', () => {
    expect(normalizeToUrl('x.com/user/status/123')).toBe('https://x.com/user/status/123')
  })
  it('trims surrounding whitespace before deciding', () => {
    expect(normalizeToUrl('  https://example.com  ')).toBe('https://example.com')
  })
  it('rejects text with internal whitespace (not a single token)', () => {
    expect(normalizeToUrl('hello world')).toBeNull()
    expect(normalizeToUrl('see https://example.com now')).toBeNull()
  })
  it('rejects an empty string', () => {
    expect(normalizeToUrl('')).toBeNull()
    expect(normalizeToUrl('   ')).toBeNull()
  })
  it('rejects a non-URL token', () => {
    expect(normalizeToUrl('just-text')).toBe('https://just-text')
  })
})
