// lib/share/extract-share-id.test.ts
import { describe, it, expect } from 'vitest'
import { extractShareIdFromPathname } from './extract-share-id'

describe('extractShareIdFromPathname', () => {
  it('extracts the ID from /s/<id>', () => {
    expect(extractShareIdFromPathname('/s/abc123')).toEqual({ ok: true, id: 'abc123' })
  })

  it('extracts the ID from /s/<id>/triage', () => {
    expect(extractShareIdFromPathname('/s/k3p9xv/triage')).toEqual({ ok: true, id: 'k3p9xv' })
  })

  it('tolerates a trailing slash', () => {
    expect(extractShareIdFromPathname('/s/abc123/')).toEqual({ ok: true, id: 'abc123' })
  })

  it('handles mixed-case IDs (= base62)', () => {
    expect(extractShareIdFromPathname('/s/AbCd12')).toEqual({ ok: true, id: 'AbCd12' })
  })

  it('returns not-ok for paths outside /s/', () => {
    expect(extractShareIdFromPathname('/board')).toEqual({ ok: false, reason: 'no-match' })
  })

  it('returns not-ok when the ID is the wrong length', () => {
    expect(extractShareIdFromPathname('/s/abc12')).toEqual({ ok: false, reason: 'no-match' })
    expect(extractShareIdFromPathname('/s/abc1234')).toEqual({ ok: false, reason: 'no-match' })
  })

  it('returns not-ok when the ID contains invalid characters', () => {
    expect(extractShareIdFromPathname('/s/abc-12')).toEqual({ ok: false, reason: 'no-match' })
    expect(extractShareIdFromPathname('/s/abc 12')).toEqual({ ok: false, reason: 'no-match' })
  })

  it('returns not-ok for an empty pathname', () => {
    expect(extractShareIdFromPathname('')).toEqual({ ok: false, reason: 'no-match' })
  })
})
