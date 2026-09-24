// functions/api/license/release.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestPost } from './release'

function makeCtx(body: unknown, kvStore: Map<string, string>) {
  const json = JSON.stringify(body)
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
  }
  const ctx = {
    request: new Request('https://allmarks.app/api/license/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env: { K3_KV },
  }
  return { ctx, K3_KV, kvStore }
}

describe('POST /api/license/release', () => {
  it('removes the target device (a different device than the caller), writes act: back, and tombstones the target in rm:<kid>', async () => {
    const kvStore = new Map<string, string>([
      ['act:kid-1', JSON.stringify([{ id: 'dev-a', label: 'A', at: 1 }, { id: 'dev-b', label: 'B', at: 2 }])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-b' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual([{ id: 'dev-a', label: 'A', at: 1 }])
    expect(JSON.parse(store.get('rm:kid-1')!)).toEqual(['dev-b'])
  })

  it('appends to an existing rm:<kid> tombstone list (dedup, keep insertion order)', async () => {
    const kvStore = new Map<string, string>([
      ['act:kid-1', JSON.stringify([{ id: 'dev-a', label: 'A', at: 1 }, { id: 'dev-b', label: 'B', at: 2 }])],
      ['rm:kid-1', JSON.stringify(['dev-x'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-b' }, kvStore)
    await onRequestPost(ctx as never)
    expect(JSON.parse(store.get('rm:kid-1')!)).toEqual(['dev-x', 'dev-b'])
  })

  it('caps rm:<kid> at 50 entries, dropping the oldest', async () => {
    const existingRm = Array.from({ length: 50 }, (_, i) => `old-${i}`)
    const kvStore = new Map<string, string>([
      ['act:kid-1', JSON.stringify([{ id: 'dev-a', label: 'A', at: 1 }, { id: 'dev-b', label: 'B', at: 2 }])],
      ['rm:kid-1', JSON.stringify(existingRm)],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-b' }, kvStore)
    await onRequestPost(ctx as never)
    const updatedRm = JSON.parse(store.get('rm:kid-1')!) as string[]
    expect(updatedRm).toHaveLength(50)
    expect(updatedRm[0]).toBe('old-1') // old-0 dropped (oldest)
    expect(updatedRm[updatedRm.length - 1]).toBe('dev-b') // newest at the end
  })

  it('allows a device to remove itself (target === deviceId)', async () => {
    const kvStore = new Map<string, string>([
      ['act:kid-1', JSON.stringify([{ id: 'dev-a', label: 'A', at: 1 }, { id: 'dev-b', label: 'B', at: 2 }])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual([{ id: 'dev-b', label: 'B', at: 2 }])
  })

  it('upgrades legacy string[] entries in the write-back', async () => {
    const kvStore = new Map<string, string>([['act:kid-1', JSON.stringify(['dev-a', 'dev-b'])]])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-b' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual([{ id: 'dev-a', label: '', at: 0 }])
  })

  it('not-authorized: caller deviceId is not itself registered', async () => {
    const kvStore = new Map<string, string>([
      ['act:kid-1', JSON.stringify([{ id: 'dev-b', label: 'B', at: 2 }])],
    ])
    const { ctx, K3_KV } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-b' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'not-authorized' })
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('not-authorized when act:<kid> is missing entirely', async () => {
    const { ctx } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-a' }, new Map())
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: false, reason: 'not-authorized' })
  })

  it('idempotent: target already absent -> ok:true, no KV write', async () => {
    const kvStore = new Map<string, string>([
      ['act:kid-1', JSON.stringify([{ id: 'dev-a', label: 'A', at: 1 }])],
    ])
    const { ctx, K3_KV } = makeCtx({ kid: 'kid-1', deviceId: 'dev-a', target: 'dev-gone' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('malformed body: 400 ok:false reason:invalid', async () => {
    const { ctx } = makeCtx({ kid: 'kid-1', deviceId: 123, target: 'x' }, new Map())
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })
})
