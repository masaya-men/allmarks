// functions/activate.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestPost } from './activate'

function makeCtx(body: unknown, kvStore: Map<string, string>) {
  const json = JSON.stringify(body)
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
  }
  const ctx = {
    request: new Request('https://allmarks.app/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env: { K3_KV },
  }
  return { ctx, K3_KV, kvStore }
}

describe('POST /activate', () => {
  it('first activation for a device: adds it and returns ok:true', async () => {
    const kvStore = new Map<string, string>([['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })]])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual(['device-a'])
  })

  it('idempotent: re-activating the same device does not grow the set or reject', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['device-a', 'device-b'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual(['device-a', 'device-b'])
  })

  it('boundary: the 5th distinct device succeeds', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'd5' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toHaveLength(5)
  })

  it('boundary: the 6th distinct device is rejected with cap-exceeded', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4', 'd5'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'd6' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'cap-exceeded' })
    expect(JSON.parse(store.get('act:kid-1')!)).toHaveLength(5) // unchanged
  })

  it('unknown kid (never issued): ok:false reason:unknown-key, no KV write', async () => {
    const { ctx, K3_KV } = makeCtx({ kid: 'never-issued', deviceId: 'd1' }, new Map())
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: false, reason: 'unknown-key' })
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('malformed body: 400 ok:false reason:invalid', async () => {
    const kvStore = new Map<string, string>()
    const { ctx } = makeCtx({ kid: 123, deviceId: 'd1' }, kvStore) // kid wrong type
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })
})
