import { describe, it, expect, beforeEach } from 'vitest'
import {
  getClientIp, tooMany, softLimit, hardLimit, resetSoftLimits,
  type D1DatabaseLike, type D1PreparedStatement,
} from './rate-limit'

/** rate_limits テーブルを Map で模した D1 モック (UPSERT の意味論を再現)。 */
function fakeDb(): D1DatabaseLike & { calls: number } {
  const rows = new Map<string, { count: number; window_start: number }>()
  const db = {
    calls: 0,
    prepare(): D1PreparedStatement {
      let args: unknown[] = []
      const st: D1PreparedStatement = {
        bind(...v: unknown[]) { args = v; return st },
        async first<T>() {
          db.calls++
          const [k, ws, cutoff] = args as [string, number, number]
          const cur = rows.get(k)
          const next = !cur
            ? { count: 1, window_start: ws }
            : cur.window_start < cutoff ? { count: 1, window_start: ws } : { count: cur.count + 1, window_start: cur.window_start }
          rows.set(k, next)
          return next as unknown as T
        },
        async all<T>() { return { results: [] as T[] } },
      }
      return st
    },
  }
  return db
}

describe('getClientIp', () => {
  it('CF-Connecting-IP のみ使う', () => {
    expect(getClientIp(new Request('https://x/', { headers: { 'CF-Connecting-IP': '1.2.3.4', 'X-Forwarded-For': '9.9.9.9' } }))).toBe('1.2.3.4')
    expect(getClientIp(new Request('https://x/', { headers: { 'X-Forwarded-For': '9.9.9.9' } }))).toBeNull()
  })
})

describe('tooMany', () => {
  it('429 + JSON + Retry-After', async () => {
    const r = tooMany(12.3)
    expect(r.status).toBe(429)
    expect(r.headers.get('Retry-After')).toBe('13')
    expect(await r.json()).toMatchObject({ error: 'rate_limited', retryAfter: 13 })
  })
})

describe('softLimit', () => {
  beforeEach(resetSoftLimits)
  it('上限までは許可、超えたら拒否、窓明けで復帰', () => {
    for (let i = 0; i < 3; i++) expect(softLimit('a', 3, 10, 1000).allowed).toBe(true)
    const d = softLimit('a', 3, 10, 2000)
    expect(d.allowed).toBe(false)
    expect(d.retryAfterSec).toBe(9)
    expect(softLimit('a', 3, 10, 11000).allowed).toBe(true)
  })
  it('キーごとに独立', () => {
    softLimit('a', 1, 10, 0)
    expect(softLimit('a', 1, 10, 1).allowed).toBe(false)
    expect(softLimit('b', 1, 10, 1).allowed).toBe(true)
  })
})

describe('hardLimit', () => {
  const W = [{ name: 'h', seconds: 3600, limit: 2 }, { name: 'd', seconds: 86400, limit: 3 }]
  it('時間窓と日窓の両方を数える', async () => {
    const db = fakeDb()
    expect((await hardLimit(db, 'ip', W, 100)).allowed).toBe(true)
    expect((await hardLimit(db, 'ip', W, 101)).allowed).toBe(true)
    const third = await hardLimit(db, 'ip', W, 102)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSec).toBe(3600 - 102)
  })
  it('窓が切れたらリセット (時間窓)、日窓は継続', async () => {
    const db = fakeDb()
    await hardLimit(db, 'ip', W, 100)
    await hardLimit(db, 'ip', W, 101)
    expect((await hardLimit(db, 'ip', W, 3700)).allowed).toBe(true) // 次の時間: h=1, d=3
    expect((await hardLimit(db, 'ip', W, 3701)).allowed).toBe(false) // d=4 > 3
  })
  it('窓ごとに 1 statement', async () => {
    const db = fakeDb()
    await hardLimit(db, 'ip', W, 100)
    expect(db.calls).toBe(2)
  })
  it('D1 エラーは throw', async () => {
    const bad: D1DatabaseLike = { prepare: () => { throw new Error('D1 down') } }
    await expect(hardLimit(bad, 'ip', W, 1)).rejects.toThrow('D1 down')
  })
})
