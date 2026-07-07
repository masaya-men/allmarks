import { describe, it, expect, vi } from 'vitest'
import { onRequestPost } from './create'
import { decodeKVPayload } from '../../../lib/share/decode-v2'
import { SHARE_SCHEMA_VERSION_V2 } from '../../../lib/share/types-v2'

const validShare = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [{ u: 'https://example.com/a', t: 'a', ty: 'website', cw: 240, a: 1.6 }],
  createdAt: 1_780_000_000_000,
}
const jpegThumb = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

function makeCtx(body: unknown) {
  const kvStore = new Map<string, string>()
  const r2Store = new Map<string, { bytes: Uint8Array; contentType?: string }>()
  const env = {
    SHARE_KV: {
      get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
      put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
    },
    SHARE_OG: {
      put: vi.fn(async (k: string, v: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) => {
        r2Store.set(k, { bytes: v, contentType: opts?.httpMetadata?.contentType })
      }),
    },
  }
  const json = JSON.stringify(body)
  const ctx = {
    request: new Request('https://test.local/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env,
  }
  return { ctx, env, kvStore, r2Store }
}

describe('POST /api/share/create (R2 migration)', () => {
  it('puts the image to R2 and writes only share data (no thumb) to KV', async () => {
    const { ctx, env, kvStore, r2Store } = makeCtx({ share: validShare, thumb: jpegThumb })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    const out = await res.json() as { id: string }
    expect(out.id).toBeTruthy()

    // R2 に画像 + content-type が入る
    expect(env.SHARE_OG.put).toHaveBeenCalledOnce()
    const stored = r2Store.get(out.id)
    expect(stored).toBeTruthy()
    expect(stored?.contentType).toBe('image/jpeg')
    expect(stored?.bytes.byteLength).toBeGreaterThan(0)

    // KV にはデータ本体のみ (thumb 無し)
    const encoded = kvStore.get(out.id)
    expect(encoded).toBeTruthy()
    const decoded = await decodeKVPayload(encoded as string)
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.data.share.cards.length).toBe(1)
      expect(decoded.data.thumb).toBeUndefined()
    }
  })

  it('accepts a share with no thumb: writes KV, skips R2 (COPY LINK has no image)', async () => {
    const { ctx, env, kvStore } = makeCtx({ share: validShare })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    const out = await res.json() as { id: string }
    expect(out.id).toBeTruthy()

    // KV にはデータ本体が書かれる
    const encoded = kvStore.get(out.id)
    expect(encoded).toBeTruthy()
    const decoded = await decodeKVPayload(encoded as string)
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.data.share.cards.length).toBe(1)
      expect(decoded.data.thumb).toBeUndefined()
    }

    // R2 には書かない (thumb が無いので)
    expect(env.SHARE_OG.put).not.toHaveBeenCalled()
  })

  it('rejects a non-image data URL thumb', async () => {
    const { ctx } = makeCtx({ share: validShare, thumb: 'data:text/plain;base64,AAAA' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
  })

  it('accepts a webp thumb and stores image/webp content-type', async () => {
    const webp = 'data:image/webp;base64,UklGRg=='
    const { ctx, r2Store } = makeCtx({ share: validShare, thumb: webp })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    const out = await res.json() as { id: string }
    expect(r2Store.get(out.id)?.contentType).toBe('image/webp')
  })

  it('does not write KV if R2 put fails', async () => {
    const { ctx, env, kvStore } = makeCtx({ share: validShare, thumb: jpegThumb })
    env.SHARE_OG.put = vi.fn(async () => { throw new Error('r2 down') })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(500)
    expect(kvStore.size).toBe(0)
  })

  // rank9: the size cap must be enforced on the ACTUAL bytes read, not the
  // Content-Length header (which a client can omit). A streamed body has no
  // Content-Length, so the old header-only check let it slip through.
  it('rejects an oversized body that has NO Content-Length header (rank9 DoS)', async () => {
    const MAX = 800 * 1024
    const oversized = 'a'.repeat(MAX + 4096)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(oversized))
        controller.close()
      },
    })
    const env = {
      SHARE_KV: { get: vi.fn(), put: vi.fn() },
      SHARE_OG: { put: vi.fn() },
    }
    const ctx = {
      request: new Request('https://test.local/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // deliberately no content-length
        body: stream,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
      env,
    }
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(413)
    // Nothing should have been written when the body is rejected.
    expect(env.SHARE_KV.put).not.toHaveBeenCalled()
    expect(env.SHARE_OG.put).not.toHaveBeenCalled()
  })

  it('rejects via the Content-Length fast-path when the header is oversized', async () => {
    const env = {
      SHARE_KV: { get: vi.fn(), put: vi.fn() },
      SHARE_OG: { put: vi.fn() },
    }
    const ctx = {
      request: new Request('https://test.local/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'content-length': String(900 * 1024) },
        body: JSON.stringify({ share: validShare, thumb: jpegThumb }),
      }),
      env,
    }
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(413)
    expect(env.SHARE_OG.put).not.toHaveBeenCalled()
  })
})
