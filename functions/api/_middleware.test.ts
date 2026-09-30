import { describe, it, expect, beforeEach } from 'vitest'
import { onRequest, findRule } from './_middleware'
import { resetSoftLimits, type D1DatabaseLike, type D1PreparedStatement } from '../_lib/rate-limit'

const okNext = async (): Promise<Response> => new Response('ok')
const req = (path: string, method = 'POST', ip: string | null = '1.1.1.1'): Request =>
  new Request(`https://allmarks.app${path}`, { method, headers: ip ? { 'CF-Connecting-IP': ip } : {} })

/** 呼ぶたびに count を 1 増やす D1 モック (startCount から数える)。 */
function counterDb(startCount = 0): D1DatabaseLike {
  let n = startCount
  return {
    prepare: (): D1PreparedStatement => {
      const st: D1PreparedStatement = {
        bind: () => st,
        first: async <T>() => ({ count: ++n, window_start: 0 }) as unknown as T,
        all: async <T>() => ({ results: [] as T[] }),
      }
      return st
    },
  }
}
const throwingDb: D1DatabaseLike = { prepare: () => { throw new Error('down') } }

describe('findRule', () => {
  it('全 API パスにルールがある', () => {
    for (const p of [
      '/api/share/create', '/api/share/abc', '/api/share/abc/og', '/api/img', '/api/ogp', '/api/oembed',
      '/api/tweet-meta', '/api/tweet-video', '/api/tiktok-meta', '/api/tiktok-video',
      '/api/license/status', '/api/license/claim', '/api/license/purchase', '/api/license/release',
      '/api/gauth/token', '/api/gauth/refresh',
    ]) expect(findRule(p), p).toBeDefined()
  })
  it('モード割り当て', () => {
    expect(findRule('/api/share/create')?.mode).toBe('hard-closed')
    expect(findRule('/api/license/claim')?.mode).toBe('hard-open')
    expect(findRule('/api/license/status')?.mode).toBe('soft')
  })
  it('share/create の上限は 60/時 と 300/日', () => {
    expect(findRule('/api/share/create')?.windows.map((w) => [w.name, w.limit])).toEqual([['h', 60], ['d', 300]])
  })
})

describe('onRequest', () => {
  beforeEach(resetSoftLimits)

  it('ルール外・OPTIONS は素通り', async () => {
    expect((await onRequest({ request: req('/api/unknown'), env: {}, next: okNext })).status).toBe(200)
    expect((await onRequest({ request: req('/api/share/create', 'OPTIONS'), env: {}, next: okNext })).status).toBe(200)
  })
  it('share/create: 上限内は通す / 超過で 429', async () => {
    expect((await onRequest({ request: req('/api/share/create'), env: { DB_RL: counterDb(0) }, next: okNext })).status).toBe(200)
    const r = await onRequest({ request: req('/api/share/create'), env: { DB_RL: counterDb(60) }, next: okNext })
    expect(r.status).toBe(429)
    expect(await r.json()).toMatchObject({ error: 'rate_limited' })
  })
  it('share/create は D1 障害・バインド無し・IP無しで 503 (fail closed)', async () => {
    expect((await onRequest({ request: req('/api/share/create'), env: { DB_RL: throwingDb }, next: okNext })).status).toBe(503)
    expect((await onRequest({ request: req('/api/share/create'), env: {}, next: okNext })).status).toBe(503)
    expect((await onRequest({ request: req('/api/share/create', 'POST', null), env: { DB_RL: counterDb() }, next: okNext })).status).toBe(503)
  })
  it('license/claim は D1 障害でも通す (fail open)、超過は 429', async () => {
    expect((await onRequest({ request: req('/api/license/claim'), env: { DB_RL: throwingDb }, next: okNext })).status).toBe(200)
    expect((await onRequest({ request: req('/api/license/claim'), env: {}, next: okNext })).status).toBe(200)
    expect((await onRequest({ request: req('/api/license/claim'), env: { DB_RL: counterDb(60) }, next: okNext })).status).toBe(429)
  })
  it('soft: license/status は 300 回目まで通り 301 回目で 429、別 IP は別枠', async () => {
    for (let i = 0; i < 300; i++) {
      expect((await onRequest({ request: req('/api/license/status', 'GET'), env: {}, next: okNext })).status).toBe(200)
    }
    expect((await onRequest({ request: req('/api/license/status', 'GET'), env: {}, next: okNext })).status).toBe(429)
    expect((await onRequest({ request: req('/api/license/status', 'GET', '2.2.2.2'), env: {}, next: okNext })).status).toBe(200)
  })
})
