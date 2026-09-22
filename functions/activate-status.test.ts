// functions/activate-status.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './activate-status'

function makeCtx(kid: string | null, kvStore: Map<string, string>) {
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
  }
  const url = kid === null ? 'https://allmarks.app/activate-status' : `https://allmarks.app/activate-status?kid=${encodeURIComponent(kid)}`
  const ctx = {
    request: new Request(url),
    env: { K3_KV },
  }
  return { ctx, K3_KV, kvStore }
}

describe('GET /activate-status', () => {
  it('returns the current device count and the max', async () => {
    const kvStore = new Map<string, string>([['act:kid-1', JSON.stringify(['d1', 'd2'])]])
    const { ctx } = makeCtx('kid-1', kvStore)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, count: 2, max: 5 })
  })

  it('a kid with no activations yet returns count:0', async () => {
    const { ctx } = makeCtx('never-activated', new Map())
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, count: 0, max: 5 })
  })

  it('a full (5/5) key reports count:5', async () => {
    const kvStore = new Map<string, string>([['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4', 'd5'])]])
    const { ctx } = makeCtx('kid-1', kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, count: 5, max: 5 })
  })

  it('missing kid query param: 400 ok:false', async () => {
    const { ctx } = makeCtx(null, new Map())
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false })
  })

  it('kid longer than the max length: 400 ok:false, no KV read', async () => {
    const { ctx, K3_KV } = makeCtx('x'.repeat(65), new Map())
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(400)
    expect(K3_KV.get).not.toHaveBeenCalled()
  })

  it('corrupt (non-array) KV value is treated as count:0, not thrown', async () => {
    const kvStore = new Map<string, string>([['act:kid-1', 'not valid json{']])
    const { ctx } = makeCtx('kid-1', kvStore)
    const res = await onRequestGet(ctx as never)
    expect(await res.json()).toEqual({ ok: true, count: 0, max: 5 })
  })
})
