// functions/activate.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestPost } from './activate'

interface StoredDevice { readonly id: string; readonly label: string; readonly at: number }

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
  it('first activation for a device: adds it (new {id,label,at} shape) and returns ok:true', async () => {
    const kvStore = new Map<string, string>([['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })]])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const stored = JSON.parse(store.get('act:kid-1')!) as StoredDevice[]
    expect(stored).toEqual([{ id: 'device-a', label: '', at: expect.any(Number) }])
  })

  it('accepts an optional label and stores it on the new entry', async () => {
    const kvStore = new Map<string, string>([['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })]])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a', label: 'Chrome · Windows' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    const stored = JSON.parse(store.get('act:kid-1')!) as StoredDevice[]
    expect(stored).toEqual([{ id: 'device-a', label: 'Chrome · Windows', at: expect.any(Number) }])
  })

  it('rejects a label longer than 60 chars: 400 invalid', async () => {
    const kvStore = new Map<string, string>([['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })]])
    const { ctx, K3_KV } = makeCtx({ kid: 'kid-1', deviceId: 'device-a', label: 'x'.repeat(61) }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
    expect(K3_KV.put).not.toHaveBeenCalled()
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

  it('boundary: the 5th distinct device succeeds, upgrading legacy string[] entries in the write-back', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4'])], // legacy string[] format
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'd5' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    const stored = JSON.parse(store.get('act:kid-1')!) as StoredDevice[]
    expect(stored).toHaveLength(5)
    expect(stored.map((d) => d.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5'])
    expect(stored[0]).toEqual({ id: 'd1', label: '', at: 0 }) // legacy entries map to label:'',at:0
    expect(stored[4]).toEqual({ id: 'd5', label: '', at: expect.any(Number) })
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

  it('cap-exceeded does not touch rm:<kid>, even if the rejected device is itself tombstoned', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4', 'd5'])],
      ['rm:kid-1', JSON.stringify(['d6'])],
    ])
    const { ctx, K3_KV, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'd6' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: false, reason: 'cap-exceeded' })
    expect(K3_KV.put).not.toHaveBeenCalled()
    expect(JSON.parse(store.get('rm:kid-1')!)).toEqual(['d6']) // unchanged
  })

  it('re-registering a previously-removed device succeeds and clears it from rm:<kid>', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['device-b'])], // device-a was removed, only device-b remains
      ['rm:kid-1', JSON.stringify(['device-a'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    const stored = JSON.parse(store.get('act:kid-1')!) as StoredDevice[]
    expect(stored.map((d) => d.id)).toEqual(['device-b', 'device-a'])
    expect(JSON.parse(store.get('rm:kid-1')!)).toEqual([]) // tombstone cleared
  })

  it('re-registering when rm:<kid> lists other devices only clears the matching id', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['rm:kid-1', JSON.stringify(['device-a', 'device-x'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('rm:kid-1')!)).toEqual(['device-x'])
  })

  it('an already-registered device that is idempotently re-activated also gets cleared from rm:<kid>', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['device-a'])],
      ['rm:kid-1', JSON.stringify(['device-a'])], // stale tombstone somehow coexisting with registration
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('rm:kid-1')!)).toEqual([])
  })

  it('no rm:<kid> write when the device was never tombstoned', async () => {
    const kvStore = new Map<string, string>([['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })]])
    const { ctx, K3_KV } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    await onRequestPost(ctx as never)
    // exactly one put: the act: write. No rm: put since rm:<kid> never had this id.
    expect(K3_KV.put).toHaveBeenCalledTimes(1)
    expect(K3_KV.put).toHaveBeenCalledWith('act:kid-1', expect.any(String))
  })

  it('idempotent: re-activating a device already in a full (5/5) set still succeeds unchanged', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4', 'd5'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'd3' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']) // unchanged
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
