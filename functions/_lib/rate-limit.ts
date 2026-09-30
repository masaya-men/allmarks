// functions/_lib/rate-limit.ts
// 公開 API のレート制限。 人間が普通に使って当たらない値だけを置く。
//  - softLimit: isolate 内メモリの固定窓 (best-effort・fail open 用)
//  - hardLimit: D1 の固定窓カウンタ (1 呼び出し = 窓ごとに 1 write)

export interface D1Result<T> { results?: T[] }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
}
export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement
}

export interface RateWindow {
  /** 窓の名前 (キーに含まれる)。 例: 'h' / 'd' */
  readonly name: string
  readonly seconds: number
  readonly limit: number
}

export interface RateDecision {
  readonly allowed: boolean
  readonly retryAfterSec: number
}

/** CF-Connecting-IP のみを信用する (X-Forwarded-For は使わない)。 無ければ null。 */
export function getClientIp(request: Request): string | null {
  const ip = request.headers.get('CF-Connecting-IP')
  return ip && ip.trim() !== '' ? ip.trim() : null
}

/** 429 (JSON)。 UI 側は message を「少し待って」として出せる。 */
export function tooMany(retryAfterSec: number): Response {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSec))
  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      message: 'Please wait a little and try again.',
      retryAfter,
    }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
    },
  )
}

/** D1 が使えない時 (fail closed の経路)。 */
export function limiterUnavailable(): Response {
  return new Response(
    JSON.stringify({ error: 'rate_limited', message: 'Please try again later.' }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
  )
}

// ---- soft (in-memory, per isolate) ----

const SOFT_MAX_KEYS = 5000
interface SoftEntry { count: number; start: number }
const softStore = new Map<string, SoftEntry>()

/** テスト用: メモリカウンタを空にする。 */
export function resetSoftLimits(): void {
  softStore.clear()
}

/** isolate ローカルの固定窓。 Map が上限に達したら期限切れ→古い順に捨てる。 */
export function softLimit(
  key: string,
  limit: number,
  seconds: number,
  now: number = Date.now(),
): RateDecision {
  const windowMs = seconds * 1000
  const e = softStore.get(key)
  if (!e || now - e.start >= windowMs) {
    if (softStore.size >= SOFT_MAX_KEYS) {
      for (const [k, v] of softStore) {
        if (now - v.start >= windowMs) softStore.delete(k)
      }
      while (softStore.size >= SOFT_MAX_KEYS) {
        const oldest = softStore.keys().next().value
        if (oldest === undefined) break
        softStore.delete(oldest)
      }
    }
    softStore.set(key, { count: 1, start: now })
    return { allowed: true, retryAfterSec: 0 }
  }
  e.count += 1
  if (e.count > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((e.start + windowMs - now) / 1000) }
  }
  return { allowed: true, retryAfterSec: 0 }
}

// ---- hard (D1) ----

const UPSERT_SQL =
  'INSERT INTO rate_limits (k, count, window_start) VALUES (?1, 1, ?2) ' +
  'ON CONFLICT(k) DO UPDATE SET ' +
  'count = CASE WHEN window_start < ?3 THEN 1 ELSE count + 1 END, ' +
  'window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END ' +
  'RETURNING count, window_start'

interface UpsertRow { count: number; window_start: number }

/**
 * 各窓ごとに 1 statement で「加算 + 現在値の読み戻し」を行う。
 * 窓が切れていれば count を 1 に戻す。 D1 のエラーは throw する (呼び出し側が
 * fail open / closed を決める)。 いずれかの窓が超過なら allowed=false。
 */
export async function hardLimit(
  db: D1DatabaseLike,
  key: string,
  windows: readonly RateWindow[],
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<RateDecision> {
  let retryAfterSec = 0
  let allowed = true
  for (const w of windows) {
    const windowStart = Math.floor(nowSec / w.seconds) * w.seconds
    const row = await db
      .prepare(UPSERT_SQL)
      .bind(`${key}:${w.name}`, windowStart, windowStart)
      .first<UpsertRow>()
    if (!row) throw new Error('rate_limits upsert returned no row')
    if (row.count > w.limit) {
      allowed = false
      retryAfterSec = Math.max(retryAfterSec, windowStart + w.seconds - nowSec)
    }
  }
  return { allowed, retryAfterSec }
}
