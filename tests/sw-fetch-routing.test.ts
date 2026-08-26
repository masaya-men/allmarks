// Regression test for N-77 (YouTube thumbnails turning gray/broken during
// scroll). Root cause: public/sw.js's catch-all "network-first" fetch
// handler intercepts EVERY GET request including third-party/cross-origin
// resources (i.ytimg.com thumbnails, TikTok CDN, etc). Those responses are
// opaque (no-cors) so `response.ok` is always false and they are never
// cached — meaning SW interception buys them nothing. But if the SW's own
// internal fetch() rejects (which real-world evidence shows happens for
// browser-cancelled requests — e.g. an <img> unmounted mid-load when a
// scroll-triggered viewport-culling removes its card — see CardsLayer.tsx's
// `visibleItems` culling), the handler falls back to `caches.match(request)`,
// which resolves to `undefined` for a never-cached cross-origin URL.
// `event.respondWith(undefined)` is a defined Service Worker failure mode:
// the browser reports the resource load as a network error, which for an
// <img> renders as the broken/gray image icon — exactly the bug reported.
//
// Fix: cross-origin requests should bypass the Service Worker entirely
// (mirrors the existing /api/ skip) since it was never providing any benefit
// for them. This test loads the real public/sw.js source and exercises its
// registered 'fetch' listener directly against a minimal mock
// ServiceWorkerGlobalScope, asserting cross-origin requests are NOT
// intercepted (no respondWith call) while same-origin routing is unchanged.
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SW_SOURCE = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf-8')

type Listener = (event: FetchEventMock) => void

class FetchEventMock {
  respondWithCalled = false
  constructor(public request: { method: string; url: string }) {}
  respondWith(_p: unknown): void {
    this.respondWithCalled = true
  }
  waitUntil(_p: unknown): void {}
}

function registerServiceWorker(origin: string): { fetchListener: Listener } {
  const listeners: Record<string, Listener[]> = {}
  const selfMock = {
    location: new URL(origin),
    addEventListener(type: string, handler: Listener): void {
      listeners[type] = listeners[type] ?? []
      listeners[type].push(handler)
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  }
  // sw.js references caches/fetch unconditionally inside handler bodies even
  // on paths this suite doesn't exercise (e.g. the cache-first branch's
  // `.then` chain) — harmless stand-ins so evaluating the source doesn't throw.
  const cachesMock = {
    open: vi.fn(async () => ({ addAll: vi.fn(async () => {}), put: vi.fn() })),
    keys: vi.fn(async () => []),
    match: vi.fn(async () => undefined),
  }
  const fetchMock = vi.fn(async () => ({ ok: true, clone: () => ({}) }))

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function('self', 'caches', 'fetch', SW_SOURCE)
  run(selfMock, cachesMock, fetchMock)

  const fetchListeners = listeners.fetch ?? []
  if (fetchListeners.length !== 1) {
    throw new Error(`expected exactly one 'fetch' listener, got ${fetchListeners.length}`)
  }
  return { fetchListener: fetchListeners[0] }
}

describe('public/sw.js fetch routing', () => {
  it('does NOT intercept cross-origin GET requests (third-party CDN thumbnails)', () => {
    const { fetchListener } = registerServiceWorker('https://allmarks.app/')
    const event = new FetchEventMock({
      method: 'GET',
      url: 'https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg',
    })
    fetchListener(event)
    expect(event.respondWithCalled).toBe(false)
  })

  it('still intercepts same-origin static assets (cache-first)', () => {
    const { fetchListener } = registerServiceWorker('https://allmarks.app/')
    const event = new FetchEventMock({
      method: 'GET',
      url: 'https://allmarks.app/_next/static/chunks/abc.js',
    })
    fetchListener(event)
    expect(event.respondWithCalled).toBe(true)
  })

  it('still skips /api/ requests', () => {
    const { fetchListener } = registerServiceWorker('https://allmarks.app/')
    const event = new FetchEventMock({
      method: 'GET',
      url: 'https://allmarks.app/api/ogp?url=x',
    })
    fetchListener(event)
    expect(event.respondWithCalled).toBe(false)
  })

  it('still handles same-origin page navigations (network-first)', () => {
    const { fetchListener } = registerServiceWorker('https://allmarks.app/')
    const event = new FetchEventMock({ method: 'GET', url: 'https://allmarks.app/board' })
    fetchListener(event)
    expect(event.respondWithCalled).toBe(true)
  })

  it('ignores non-GET requests regardless of origin', () => {
    const { fetchListener } = registerServiceWorker('https://allmarks.app/')
    const event = new FetchEventMock({ method: 'POST', url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' })
    fetchListener(event)
    expect(event.respondWithCalled).toBe(false)
  })
})
