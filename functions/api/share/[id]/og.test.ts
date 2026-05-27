import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './og'
import { encodeKVPayload } from '../../../../lib/share/encode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from '../../../../lib/share/types-v2'

interface MockEnv {
  SHARE_KV: { get: (key: string) => Promise<string | null> }
}

function makeCtx(id: string, kvValue: string | null) {
  const env: MockEnv = { SHARE_KV: { get: vi.fn().mockResolvedValue(kvValue) } }
  return {
    request: new Request(`https://test.local/api/share/${id}/og.webp`),
    env,
    params: { id },
  }
}

const sampleEntry: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [{ u: 'https://example.com/a', t: 'a', ty: 'website', cw: 240, a: 1.6 }],
    createdAt: Date.now(),
  },
  thumb: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v68xnEAAAA=',
}

describe('GET /api/share/:id/og', () => {
  it('returns 404 for invalid id format', async () => {
    const ctx = makeCtx('TOOLONG', null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(404)
  })

  it('returns 404 when KV miss', async () => {
    const ctx = makeCtx('aB3xY9', null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(404)
  })

  it('returns 200 + image/webp + bytes for valid id', async () => {
    const encoded = await encodeKVPayload(sampleEntry)
    const ctx = makeCtx('aB3xY9', encoded)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(res.headers.get('Cache-Control')).toContain('public')
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })

  it('returns 500 when thumb has wrong prefix', async () => {
    const bad: KVShareEntry = { ...sampleEntry, thumb: 'data:image/png;base64,AAAA' }
    const encoded = await encodeKVPayload(bad)
    const ctx = makeCtx('aB3xY9', encoded)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(500)
  })
})
