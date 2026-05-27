// lib/share/api-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createShare, fetchShare } from './api-client'
import { SHARE_SCHEMA_VERSION_V2 } from './types-v2'

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch
})
afterEach(() => { vi.restoreAllMocks() })

describe('createShare', () => {
  it('POSTs to /api/share/create and returns the share ID', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'k3p9xv', expiresAt: 1738000000000 }),
    } as Response)
    const result = await createShare({
      share: { v: SHARE_SCHEMA_VERSION_V2, cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1 }], createdAt: 1735000000000 },
      thumb: 'data:image/webp;base64,AA',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.id).toBe('k3p9xv')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/share/create',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns error result on non-2xx', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 429,
      json: async () => ({ error: 'rate_limit', message: 'slow down' }),
    } as Response)
    const result = await createShare({
      share: { v: SHARE_SCHEMA_VERSION_V2, cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1 }], createdAt: 1735000000000 },
      thumb: '',
    })
    expect(result.ok).toBe(false)
  })
})

describe('fetchShare', () => {
  it('GETs /api/share/<id> and returns the entry', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        share: { v: SHARE_SCHEMA_VERSION_V2, cards: [], createdAt: 1735000000000 },
        thumb: '',
      }),
    } as Response)
    const result = await fetchShare('k3p9xv')
    expect(result.ok).toBe(true)
  })

  it('returns not_found on 404', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 404,
      json: async () => ({ error: 'not_found', message: 'expired' }),
    } as Response)
    const result = await fetchShare('k3p9xv')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('not_found')
  })
})
