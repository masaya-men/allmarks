import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './og'
import { encodeKVPayload } from '../../../../lib/share/encode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from '../../../../lib/share/types-v2'

interface MockR2Object {
  arrayBuffer: () => Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

interface MockEnv {
  SHARE_KV: { get: (key: string) => Promise<string | null> }
  SHARE_OG: { get: (key: string) => Promise<MockR2Object | null> }
}

/** ctx を組む。 r2 を渡すと R2 hit、 渡さなければ R2 miss (= KV フォールバック) を模す。 */
function makeCtx(id: string, kvValue: string | null, r2?: MockR2Object | null) {
  const env: MockEnv = {
    SHARE_KV: { get: vi.fn().mockResolvedValue(kvValue) },
    SHARE_OG: { get: vi.fn().mockResolvedValue(r2 ?? null) },
  }
  return {
    request: new Request(`https://test.local/api/share/${id}/og`),
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
  // 後方互換テスト用に thumb を持つ旧形式エントリ。
  thumb: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v68xnEAAAA=',
}

describe('GET /api/share/:id/og', () => {
  it('returns 404 for invalid id format', async () => {
    const ctx = makeCtx('TOOLONG', null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(404)
  })

  it('serves the image from R2 (= post-migration path) with stored content-type', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const r2obj: MockR2Object = {
      arrayBuffer: () => Promise.resolve(bytes.buffer),
      httpMetadata: { contentType: 'image/jpeg' },
    }
    const ctx = makeCtx('aB3xY9', null, r2obj)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toContain('public')
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBe(5)
  })

  it('falls back to JPEG content-type when R2 object lacks httpMetadata', async () => {
    const r2obj: MockR2Object = { arrayBuffer: () => Promise.resolve(new Uint8Array([9]).buffer) }
    const ctx = makeCtx('aB3xY9', null, r2obj)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
  })

  it('returns 404 when neither R2 nor KV has the share', async () => {
    const ctx = makeCtx('aB3xY9', null, null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(404)
  })

  it('falls back to KV thumb for pre-migration shares (= R2 miss, KV hit)', async () => {
    const encoded = await encodeKVPayload(sampleEntry)
    const ctx = makeCtx('aB3xY9', encoded, null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })

  it('falls back to the default OG card when a share carries no thumb (= COPY LINK share, R2 miss + no KV thumb)', async () => {
    const noThumb: KVShareEntry = { share: sampleEntry.share }
    const encoded = await encodeKVPayload(noThumb)
    const ctx = makeCtx('aB3xY9', encoded, null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://test.local/og.png')
  })

  it('still 404s a genuinely missing id (= KV entry does not exist)', async () => {
    const ctx = makeCtx('qQ7wZ2', null, null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(404)
  })

  it('returns 500 when KV thumb has wrong prefix', async () => {
    const bad: KVShareEntry = { ...sampleEntry, thumb: 'data:image/png;base64,AAAA' }
    const encoded = await encodeKVPayload(bad)
    const ctx = makeCtx('aB3xY9', encoded, null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(500)
  })
})
