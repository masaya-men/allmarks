// lib/board/paddle-api.ts
// Paddle REST API への最小限の問い合わせ（transaction.read / subscription.read）。
// 読むのは status と subscription_id（nullable）のみ — 購入者のメールアドレス等の
// 個人情報は一切読まない・保存しない（設計 §0, §4 の絶対条件）。
// 設計: docs/private/2026-09-24-paddle-license-lifecycle-design.md §0, §2.2, §2.3。
import { z } from 'zod'

export interface PaddleEnv {
  readonly PADDLE_API_KEY: string
  readonly PADDLE_ENV: string
}

const UPSTREAM_TIMEOUT_MS = 10_000

export type PaddleResult<T> =
  | { readonly kind: 'found'; readonly data: T }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'upstream-error' }

export interface PaddleTransaction {
  readonly status: string
  readonly subscriptionId: string | null
}

export interface PaddleSubscription {
  readonly status: string
}

// 未知のフィールド（メールアドレス等）は zod object のデフォルト挙動（strip）で
// パース結果に一切残らない＝そもそも読み出せない。
const transactionResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    subscription_id: z.string().nullable(),
  }),
})

const subscriptionResponseSchema = z.object({
  data: z.object({
    status: z.string(),
  }),
})

function baseUrl(env: PaddleEnv): string {
  return env.PADDLE_ENV === 'live' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
}

/** fetch自体が失敗（ネットワーク/タイムアウト）したら status:0 を返す（到達不可）。 */
async function getJson(url: string, env: PaddleEnv): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    return { status: res.status, text: await res.text() }
  } catch {
    return { status: 0, text: '' }
  }
}

export async function getTransaction(txnId: string, env: PaddleEnv): Promise<PaddleResult<PaddleTransaction>> {
  const { status, text } = await getJson(`${baseUrl(env)}/transactions/${encodeURIComponent(txnId)}`, env)
  if (status === 404) return { kind: 'not-found' }
  if (status < 200 || status >= 300) return { kind: 'upstream-error' }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { kind: 'upstream-error' }
  }
  const parsed = transactionResponseSchema.safeParse(json)
  if (!parsed.success) return { kind: 'upstream-error' }
  return { kind: 'found', data: { status: parsed.data.data.status, subscriptionId: parsed.data.data.subscription_id } }
}

export async function getSubscription(subId: string, env: PaddleEnv): Promise<PaddleResult<PaddleSubscription>> {
  const { status, text } = await getJson(`${baseUrl(env)}/subscriptions/${encodeURIComponent(subId)}`, env)
  if (status === 404) return { kind: 'not-found' }
  if (status < 200 || status >= 300) return { kind: 'upstream-error' }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { kind: 'upstream-error' }
  }
  const parsed = subscriptionResponseSchema.safeParse(json)
  if (!parsed.success) return { kind: 'upstream-error' }
  return { kind: 'found', data: { status: parsed.data.data.status } }
}
