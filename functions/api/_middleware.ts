// functions/api/_middleware.ts
// /api/** 全体のレート制限 (人間が普通に使って当たらない値)。
//  - hard (D1): share/create は fail closed (R2 課金経路)、 license/gauth の書き込み系は fail open
//  - soft (isolate メモリ): その他は fail open
import {
  getClientIp,
  hardLimit,
  limiterUnavailable,
  softLimit,
  tooMany,
  type D1DatabaseLike,
  type RateWindow,
} from '../_lib/rate-limit'

export interface RateRule {
  readonly scope: string
  readonly match: (path: string) => boolean
  readonly mode: 'hard-closed' | 'hard-open' | 'soft'
  readonly windows: readonly RateWindow[]
}

const H = 3600
const D = 86400

/** 上から順に最初に一致した 1 ルールだけを適用する。 */
export const RATE_RULES: readonly RateRule[] = [
  {
    scope: 'share-create',
    match: (p) => p === '/api/share/create',
    mode: 'hard-closed',
    windows: [{ name: 'h', seconds: H, limit: 60 }, { name: 'd', seconds: D, limit: 300 }],
  },
  {
    scope: 'auth',
    match: (p) =>
      p === '/api/license/claim' || p === '/api/license/purchase' || p === '/api/license/release' ||
      p === '/api/gauth/token' || p === '/api/gauth/refresh',
    mode: 'hard-open',
    windows: [{ name: 'h', seconds: H, limit: 60 }],
  },
  { scope: 'license-status', match: (p) => p === '/api/license/status', mode: 'soft', windows: [{ name: 'h', seconds: H, limit: 300 }] },
  { scope: 'share-read', match: (p) => p.startsWith('/api/share/'), mode: 'soft', windows: [{ name: 'h', seconds: H, limit: 600 }] },
  { scope: 'img', match: (p) => p === '/api/img', mode: 'soft', windows: [{ name: 'h', seconds: H, limit: 3000 }] },
  {
    scope: 'video',
    match: (p) => p === '/api/tweet-video' || p === '/api/tiktok-video',
    mode: 'soft',
    windows: [{ name: 'h', seconds: H, limit: 300 }],
  },
  {
    scope: 'meta',
    match: (p) => p === '/api/ogp' || p === '/api/oembed' || p === '/api/tweet-meta' || p === '/api/tiktok-meta',
    mode: 'soft',
    windows: [{ name: 'h', seconds: H, limit: 600 }],
  },
]

export function findRule(path: string): RateRule | undefined {
  return RATE_RULES.find((r) => r.match(path))
}

interface MiddlewareContext {
  request: Request
  env: { DB_RL?: D1DatabaseLike }
  next: () => Promise<Response>
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const { request, env } = context
  if (request.method === 'OPTIONS') return context.next()
  const rule = findRule(new URL(request.url).pathname)
  if (!rule) return context.next()

  const ip = getClientIp(request)

  if (rule.mode === 'soft') {
    // IP が取れない時は fail open (誰かを巻き込んで塞がない)
    if (ip) {
      for (const w of rule.windows) {
        const d = softLimit(`${rule.scope}:${ip}:${w.name}`, w.limit, w.seconds)
        if (!d.allowed) return tooMany(d.retryAfterSec)
      }
    }
    return context.next()
  }

  const closed = rule.mode === 'hard-closed'
  if (!ip || !env.DB_RL) return closed ? limiterUnavailable() : context.next()
  try {
    const d = await hardLimit(env.DB_RL, `${rule.scope}:${ip}`, rule.windows)
    if (!d.allowed) return tooMany(d.retryAfterSec)
  } catch {
    return closed ? limiterUnavailable() : context.next()
  }
  return context.next()
}
