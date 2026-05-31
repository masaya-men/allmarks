// functions/s/_handler.test.ts
import { describe, it, expect } from 'vitest'
import { handleShareRequest, type ShareHandlerContext } from './_handler'
import { encodeKVPayload } from '../../lib/share/encode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from '../../lib/share/types-v2'

const minimalTemplate =
  `<!DOCTYPE html><html lang="ja"><head>` +
  `<title>Booklage</title>` +
  `<meta property="og:title" content="Booklage"/>` +
  `<meta property="og:description" content="board app"/>` +
  `<meta property="og:type" content="website"/>` +
  `<script src="/_next/static/chunks/abc.js" async=""></script>` +
  `</head><body>` +
  `<script>self.__next_f.push([0])</script>` +
  `</body></html>`

function makeKV(store: Record<string, string | null>) {
  return {
    get: async (key: string): Promise<string | null> => store[key] ?? null,
  }
}

function makeAssets(template: string, opts: { templateOk?: boolean } = {}) {
  return {
    fetch: async (): Promise<Response> => {
      if (opts.templateOk === false) {
        return new Response('not found', { status: 404 })
      }
      return new Response(template, { status: 200, headers: { 'Content-Type': 'text/html' } })
    },
  }
}

function makeCtx(
  id: string,
  store: Record<string, string | null>,
  templateOpts: { templateOk?: boolean } = {},
): ShareHandlerContext {
  return {
    request: new Request(`https://preview.booklage.pages.dev/s/${id}`),
    env: { SHARE_KV: makeKV(store), ASSETS: makeAssets(minimalTemplate, templateOpts) },
    params: { id },
  }
}

const sampleEntry: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [
      { u: 'https://example.com/a', t: 'card a', ty: 'website', cw: 240, a: 1.6 },
      { u: 'https://example.com/b', t: 'card b', ty: 'website', cw: 240, a: 1.6 },
      { u: 'https://example.com/c', t: 'card c', ty: 'website', cw: 240, a: 1.6 },
    ],
    createdAt: Date.now(),
  },
  thumb: 'data:image/webp;base64,UklGRg==',
}

describe('handleShareRequest', () => {
  it('returns 404 for an invalid share ID', async () => {
    const ctx = makeCtx('???', {})
    const res = await handleShareRequest(ctx, 'landing')
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/)
    const body = await res.text()
    expect(body).toContain('EXPIRED')
  })

  it('returns 404 when the KV lookup misses', async () => {
    const ctx = makeCtx('abc123', {})
    const res = await handleShareRequest(ctx, 'landing')
    expect(res.status).toBe(404)
    const body = await res.text()
    expect(body).toContain('EXPIRED')
  })

  it('returns 404 when the KV value cannot be decoded', async () => {
    const ctx = makeCtx('abc123', { abc123: 'not-a-valid-payload' })
    const res = await handleShareRequest(ctx, 'landing')
    expect(res.status).toBe(404)
  })

  it('returns 404 when the static template fetch fails', async () => {
    const encoded = await encodeKVPayload(sampleEntry)
    const ctx = makeCtx('abc123', { abc123: encoded }, { templateOk: false })
    const res = await handleShareRequest(ctx, 'landing')
    expect(res.status).toBe(404)
  })

  it('returns 200 with patched HTML when the KV value is a valid encoded payload (landing)', async () => {
    const encoded = await encodeKVPayload(sampleEntry)
    const ctx = makeCtx('abc123', { abc123: encoded })
    const res = await handleShareRequest(ctx, 'landing')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/)
    const body = await res.text()
    expect(body).toContain('<title>Shared collection on AllMarks</title>')
    expect(body).toContain('content="https://preview.booklage.pages.dev/api/share/abc123/og"')
    expect(body).toContain('content="https://preview.booklage.pages.dev/s/abc123"')
    expect(body).toMatch(/3 bookmarks/)
    expect(body).toContain('self.__next_f.push([0])') // RSC data preserved
    expect(body).toContain('<script src="/_next/static/chunks/abc.js"') // bundle preserved
  })

  it('returns 200 with triage og:url when page=triage', async () => {
    const encoded = await encodeKVPayload(sampleEntry)
    const ctx = makeCtx('abc123', { abc123: encoded })
    const res = await handleShareRequest(ctx, 'triage')
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('content="https://preview.booklage.pages.dev/s/abc123/triage"')
  })

  it('marks the 404 response as no-store (= re-shared ID must not stay cached as gone)', async () => {
    const ctx = makeCtx('abc123', {})
    const res = await handleShareRequest(ctx, 'landing')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
