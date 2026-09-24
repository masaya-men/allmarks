// functions/api/license/status.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequestGet } from './status'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function makeCtx(query: Record<string, string>, kvStore: Map<string, string>, env: Record<string, string> = {}) {
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async () => { throw new Error('status.ts must never write to KV') }),
  }
  const url = new URL('https://allmarks.app/api/license/status')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const ctx = {
    request: new Request(url.toString()),
    env: { K3_KV, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox', ...env },
  }
  return { ctx, K3_KV, kvStore }
}

function stubPaddleSubscription(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))
}

describe('GET /api/license/status', () => {
  it('unknown: issued:<kid> missing -> active:true reason:unknown (fail-open), no Paddle call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { ctx, K3_KV } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, new Map())
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, active: true, reason: 'unknown' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('a device that never successfully registered (absent from rm:<kid> and never in act:<kid>) is NOT stopped', async () => {
    // Regression: /activate is fail-open on the client (a genuine signature unlocks
    // the app locally even if the network POST /activate never landed). Such a
    // device must not be punished at its first daily check just because it was
    // never recorded anywhere — only an explicit rm:<kid> tombstone stops it.
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      // no act:<kid>, no rm:<kid> at all for this device
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'never-registered-device' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, active: true })
  })

  it('device-removed: device id is present in the rm:<kid> tombstone (comes before the Paddle call)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ source: 'paddle', subscriptionId: 'sub_1', txn: 'txn_x', iat: 1 })],
      ['rm:kid-1', JSON.stringify(['dev-1'])],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, active: false, reason: 'device-removed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a device NOT in rm:<kid> is unaffected by other devices being tombstoned', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['rm:kid-1', JSON.stringify(['some-other-device'])],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, active: true })
  })

  it('legacy free key (claimSecret) is always active, no Paddle call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, active: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['active', 'trialing', 'past_due'])('paddle subscription status %s -> active:true', async (status) => {
    stubPaddleSubscription(200, { data: { status } })
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ source: 'paddle', subscriptionId: 'sub_1', txn: 'txn_x', iat: 1 })],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, active: true })
  })

  it.each(['canceled', 'paused'])('paddle subscription status %s -> active:false reason:ended', async (status) => {
    stubPaddleSubscription(200, { data: { status } })
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ source: 'paddle', subscriptionId: 'sub_1', txn: 'txn_x', iat: 1 })],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, active: false, reason: 'ended' })
  })

  it('subscription not-found on Paddle -> active:false reason:ended', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ source: 'paddle', subscriptionId: 'sub_1', txn: 'txn_x', iat: 1 })],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, active: false, reason: 'ended' })
  })

  it('upstream: 502 when Paddle is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ source: 'paddle', subscriptionId: 'sub_1', txn: 'txn_x', iat: 1 })],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, reason: 'upstream' })
  })

  it('upstream: 502 when PADDLE_API_KEY is missing (never calls fetch)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ source: 'paddle', subscriptionId: 'sub_1', txn: 'txn_x', iat: 1 })],
    ])
    const { ctx } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore, { PADDLE_API_KEY: '' })
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, reason: 'upstream' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('400 when kid is missing', async () => {
    const { ctx } = makeCtx({ device: 'dev-1' }, new Map())
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(400)
  })

  it('400 when device is missing', async () => {
    const { ctx } = makeCtx({ kid: 'kid-1' }, new Map())
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(400)
  })

  it('400 when kid exceeds the max length', async () => {
    const { ctx, K3_KV } = makeCtx({ kid: 'x'.repeat(65), device: 'dev-1' }, new Map())
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(400)
    expect(K3_KV.get).not.toHaveBeenCalled()
  })

  it('never calls K3_KV.put across any branch (read-only endpoint)', async () => {
    stubPaddleSubscription(200, { data: { status: 'active' } })
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ source: 'paddle', subscriptionId: 'sub_1', txn: 'txn_x', iat: 1 })],
    ])
    const { ctx, K3_KV } = makeCtx({ kid: 'kid-1', device: 'dev-1' }, kvStore)
    await onRequestGet(ctx as never)
    expect(K3_KV.put).not.toHaveBeenCalled()
  })
})
