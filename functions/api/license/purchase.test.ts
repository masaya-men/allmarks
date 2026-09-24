// functions/api/license/purchase.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequestPost } from './purchase'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function makeTestPrivateKeyB64url(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
  return Buffer.from(pkcs8).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function makeCtx(body: unknown, kvStore: Map<string, string>, env: Record<string, string>) {
  const json = JSON.stringify(body)
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
  }
  const ctx = {
    request: new Request('https://allmarks.app/api/license/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env: { K3_KV, ...env },
  }
  return { ctx, K3_KV, kvStore }
}

function stubPaddleTransaction(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))
}

const VALID_TXN = 'txn_abcdefghij' // 10 chars after txn_, matches the length floor

describe('POST /api/license/purchase', () => {
  it('mints a new key on first purchase, writes issued: and sub:, returns ok:true', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    stubPaddleTransaction(200, { data: { status: 'paid', subscription_id: 'sub_1' } })
    const kvStore = new Map<string, string>()
    const { ctx, kvStore: store } = makeCtx({ txn: VALID_TXN }, kvStore, { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })

    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; key: string; kid: string }
    expect(json.ok).toBe(true)
    expect(typeof json.key).toBe('string')
    expect(typeof json.kid).toBe('string')

    const issued = JSON.parse(store.get(`issued:${json.kid}`)!)
    expect(issued).toEqual({ source: 'paddle', subscriptionId: 'sub_1', txn: VALID_TXN, iat: expect.any(Number) })
    const subRecord = JSON.parse(store.get('sub:sub_1')!)
    expect(subRecord).toEqual({ kid: json.kid, key: json.key })
  })

  it('accepts "completed" as a paid status too', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    stubPaddleTransaction(200, { data: { status: 'completed', subscription_id: 'sub_2' } })
    const { ctx } = makeCtx({ txn: VALID_TXN }, new Map(), { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect((await res.json() as { ok: boolean }).ok).toBe(true)
  })

  it('re-display: an existing sub:<subId> record returns the same key without re-signing', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    stubPaddleTransaction(200, { data: { status: 'paid', subscription_id: 'sub_1' } })
    const kvStore = new Map<string, string>([['sub:sub_1', JSON.stringify({ kid: 'kid-existing', key: 'existing.key' })]])
    const { ctx, K3_KV } = makeCtx({ txn: VALID_TXN }, kvStore, { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })

    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true, key: 'existing.key', kid: 'kid-existing' })
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('not-found: 200 ok:false reason:not-found when Paddle returns 404', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    stubPaddleTransaction(404, {})
    const { ctx } = makeCtx({ txn: VALID_TXN }, new Map(), { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'not-found' })
  })

  it('upstream: 502 ok:false reason:upstream on a Paddle 5xx', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    stubPaddleTransaction(500, {})
    const { ctx } = makeCtx({ txn: VALID_TXN }, new Map(), { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ ok: false, reason: 'upstream' })
  })

  it('not-paid: 200 ok:false reason:not-paid when status is neither paid nor completed', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    stubPaddleTransaction(200, { data: { status: 'draft', subscription_id: null } })
    const { ctx } = makeCtx({ txn: VALID_TXN }, new Map(), { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'not-paid' })
  })

  it('processing: 200 ok:false reason:processing when paid but subscription_id is still null', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    stubPaddleTransaction(200, { data: { status: 'paid', subscription_id: null } })
    const { ctx } = makeCtx({ txn: VALID_TXN }, new Map(), { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'processing' })
  })

  it('not-configured: 503 when K3_PRIVATE_KEY is missing (never calls Paddle)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { ctx } = makeCtx({ txn: VALID_TXN }, new Map(), { K3_PRIVATE_KEY: '', PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, reason: 'not-configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('not-configured: 503 when PADDLE_API_KEY is missing', async () => {
    const privateKeyB64url = await makeTestPrivateKeyB64url()
    const { ctx } = makeCtx({ txn: VALID_TXN }, new Map(), { K3_PRIVATE_KEY: privateKeyB64url, PADDLE_API_KEY: '', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, reason: 'not-configured' })
  })

  it('invalid: 400 when txn does not match the txn_ pattern', async () => {
    const { ctx } = makeCtx({ txn: 'not-a-txn-id' }, new Map(), { K3_PRIVATE_KEY: 'x', PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })

  it('invalid: 400 on malformed JSON body', async () => {
    const ctx = {
      request: new Request('https://allmarks.app/api/license/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'content-length': '5' },
        body: 'oops{',
      }),
      env: { K3_KV: { get: vi.fn(), put: vi.fn() }, K3_PRIVATE_KEY: 'x', PADDLE_API_KEY: 'k', PADDLE_ENV: 'sandbox' },
    }
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })
})
