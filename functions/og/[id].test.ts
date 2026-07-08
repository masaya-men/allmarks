import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './[id]'

type Ctx = Parameters<typeof onRequestGet>[0]

function makeCtx(
  paramId: string,
  r2Obj: { arrayBuffer: () => Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null,
  assetsBody: string | null = 'DEFAULTPNG',
): Ctx {
  const assets = {
    fetch: vi.fn().mockResolvedValue(
      assetsBody === null
        ? new Response('missing', { status: 404 })
        : new Response(assetsBody, { status: 200, headers: { 'Content-Type': 'image/png' } }),
    ),
  }
  return {
    request: new Request(`https://allmarks.app/og/${paramId}`),
    env: {
      SHARE_OG: { get: vi.fn().mockResolvedValue(r2Obj) },
      ASSETS: assets,
    },
    params: { id: paramId },
  } as unknown as Ctx
}

describe('GET /og/<id>', () => {
  it('serves R2 image bytes at 200 (never a redirect)', async () => {
    const bytes = new TextEncoder().encode('IMGBYTES').buffer
    const res = await onRequestGet(makeCtx('abc123', { arrayBuffer: async () => bytes, httpMetadata: { contentType: 'image/jpeg' } }))
    expect(res.status).toBe(200)
    expect([301, 302, 307, 308]).not.toContain(res.status)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toContain('immutable')
    expect(await res.text()).toBe('IMGBYTES')
  })

  it('strips a .jpg extension before validating the id and hitting R2', async () => {
    const bytes = new TextEncoder().encode('X').buffer
    const ctx = makeCtx('abc123.jpg', { arrayBuffer: async () => bytes })
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(200)
    // R2 must be queried with the bare id, not 'abc123.jpg'
    expect((ctx.env.SHARE_OG.get as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('abc123')
  })

  it('on R2 miss serves default og.png bytes at 200 — NEVER a redirect', async () => {
    const res = await onRequestGet(makeCtx('abc123', null, 'DEFAULTPNG'))
    expect(res.status).toBe(200)
    expect([301, 302, 307, 308]).not.toContain(res.status)
    expect(await res.text()).toBe('DEFAULTPNG')
  })

  it('404 for an invalid id', async () => {
    const res = await onRequestGet(makeCtx('!!', null))
    expect(res.status).toBe(404)
  })

  it('404 only if even the default card is unavailable (abnormal)', async () => {
    const res = await onRequestGet(makeCtx('abc123', null, null))
    expect(res.status).toBe(404)
  })
})
