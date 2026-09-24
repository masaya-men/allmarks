// lib/board/paddle-api.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getTransaction, getSubscription } from './paddle-api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SANDBOX_ENV = { PADDLE_API_KEY: 'pdl_sdbx_apikey_x', PADDLE_ENV: 'sandbox' }
const LIVE_ENV = { PADDLE_API_KEY: 'pdl_live_apikey_x', PADDLE_ENV: 'live' }

describe('getTransaction', () => {
  it('uses the sandbox base URL and Bearer auth by default', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { status: 'paid', subscription_id: 'sub_1' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getTransaction('txn_abc', SANDBOX_ENV)
    expect(result).toEqual({ kind: 'found', data: { status: 'paid', subscriptionId: 'sub_1' } })

    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe('https://sandbox-api.paddle.com/transactions/txn_abc')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pdl_sdbx_apikey_x')
  })

  it('uses the live base URL when PADDLE_ENV is "live"', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { status: 'paid', subscription_id: null } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await getTransaction('txn_abc', LIVE_ENV)
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe('https://api.paddle.com/transactions/txn_abc')
  })

  it('returns subscriptionId: null when the transaction has no subscription yet (processing)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { status: 'paid', subscription_id: null } }), { status: 200 })))
    const result = await getTransaction('txn_abc', SANDBOX_ENV)
    expect(result).toEqual({ kind: 'found', data: { status: 'paid', subscriptionId: null } })
  })

  it('maps a 404 to kind:not-found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await getTransaction('txn_missing', SANDBOX_ENV)).toEqual({ kind: 'not-found' })
  })

  it('maps a 5xx to kind:upstream-error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })))
    expect(await getTransaction('txn_abc', SANDBOX_ENV)).toEqual({ kind: 'upstream-error' })
  })

  it('maps a network failure (fetch throws) to kind:upstream-error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    expect(await getTransaction('txn_abc', SANDBOX_ENV)).toEqual({ kind: 'upstream-error' })
  })

  it('maps a non-JSON body to kind:upstream-error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    expect(await getTransaction('txn_abc', SANDBOX_ENV)).toEqual({ kind: 'upstream-error' })
  })

  it('maps a body missing the expected fields to kind:upstream-error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { foo: 1 } }), { status: 200 })))
    expect(await getTransaction('txn_abc', SANDBOX_ENV)).toEqual({ kind: 'upstream-error' })
  })

  it('never surfaces extra fields (e.g. customer email) from the upstream body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: { status: 'paid', subscription_id: 'sub_1', customer_email: 'someone@example.com' },
    }), { status: 200 })))
    const result = await getTransaction('txn_abc', SANDBOX_ENV)
    expect(result).toEqual({ kind: 'found', data: { status: 'paid', subscriptionId: 'sub_1' } })
    expect(JSON.stringify(result)).not.toContain('example.com')
  })
})

describe('getSubscription', () => {
  it('reads only status from the subscription body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { status: 'active' } }), { status: 200 })))
    expect(await getSubscription('sub_1', SANDBOX_ENV)).toEqual({ kind: 'found', data: { status: 'active' } })
  })

  it('requests the correct URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { status: 'canceled' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await getSubscription('sub_42', SANDBOX_ENV)
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe('https://sandbox-api.paddle.com/subscriptions/sub_42')
  })

  it('maps a 404 to kind:not-found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await getSubscription('sub_missing', SANDBOX_ENV)).toEqual({ kind: 'not-found' })
  })

  it('maps a network failure to kind:upstream-error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    expect(await getSubscription('sub_1', SANDBOX_ENV)).toEqual({ kind: 'upstream-error' })
  })
})
