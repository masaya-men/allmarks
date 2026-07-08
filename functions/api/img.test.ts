import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequest } from './img'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function makeCtx(rawUrl: string | null) {
  const base = 'https://test.local/api/img'
  const href = rawUrl === null ? base : `${base}?u=${encodeURIComponent(rawUrl)}`
  return { request: new Request(href) }
}

/** Response stand-in with an injectable landing `url` (read-only on real
 *  Response), a real readable body, and arbitrary headers/status. */
function imgResponse(
  bytes: Uint8Array<ArrayBuffer>,
  init?: { url?: string; status?: number; redirected?: boolean; contentType?: string },
): Response {
  const headers = new Headers()
  if (init?.contentType !== undefined) headers.set('content-type', init.contentType)
  const base = new Response(bytes, { status: init?.status ?? 200 })
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    url: init?.url ?? '',
    redirected: init?.redirected ?? false,
    body: base.body,
    headers,
  } as unknown as Response
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

describe('img proxy — validation', () => {
  it('400 when u is missing', async () => {
    const res = await onRequest(makeCtx(null))
    expect(res.status).toBe(400)
  })

  it('400 for an unparseable URL', async () => {
    const res = await onRequest(makeCtx('not a url'))
    expect(res.status).toBe(400)
  })

  it('400 for a non-http(s) scheme', async () => {
    const res = await onRequest(makeCtx('file:///etc/passwd'))
    expect(res.status).toBe(400)
  })

  it('400 for a blocked internal host (SSRF guard)', async () => {
    for (const host of ['http://localhost/a.png', 'http://127.0.0.1/a.png', 'http://169.254.169.254/latest']) {
      const res = await onRequest(makeCtx(host))
      expect(res.status).toBe(400)
    }
  })
})

describe('img proxy — success', () => {
  it('returns the bytes with the upstream image content-type + immutable cache + nosniff', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => imgResponse(PNG, { contentType: 'image/png' })))
    const res = await onRequest(makeCtx('https://pbs.twimg.com/media/a.png'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(buf)).toEqual(Array.from(PNG))
  })

  it('normalizes a content-type with charset params', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => imgResponse(PNG, { contentType: 'image/jpeg; charset=binary' })))
    const res = await onRequest(makeCtx('https://cdn.example.com/a.jpg'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
  })
})

describe('img proxy — rejects non-images', () => {
  it('415 for text/html (soft 404)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => imgResponse(PNG, { contentType: 'text/html' })))
    const res = await onRequest(makeCtx('https://patterncraft.fun/x'))
    expect(res.status).toBe(415)
  })

  it('415 for image/svg+xml (XSS risk — not in allowlist)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => imgResponse(PNG, { contentType: 'image/svg+xml' })))
    const res = await onRequest(makeCtx('https://evil.example.com/x.svg'))
    expect(res.status).toBe(415)
  })

  it('415 for a missing content-type', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => imgResponse(PNG, {})))
    const res = await onRequest(makeCtx('https://cdn.example.com/a'))
    expect(res.status).toBe(415)
  })
})

describe('img proxy — upstream failures (404 so Cloudflare passes it through, not a rebranded 5xx)', () => {
  it('404 when upstream is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => imgResponse(PNG, { status: 404, contentType: 'image/png' })))
    const res = await onRequest(makeCtx('https://pbs.twimg.com/dead.png'))
    expect(res.status).toBe(404)
  })

  it('404 when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const res = await onRequest(makeCtx('https://cdn.example.com/a.png'))
    expect(res.status).toBe(404)
  })

  it('400 when a redirect lands on a blocked host', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      imgResponse(PNG, { contentType: 'image/png', url: 'http://169.254.169.254/x.png', redirected: true }),
    ))
    const res = await onRequest(makeCtx('https://cdn.example.com/a.png'))
    expect(res.status).toBe(400)
  })
})
