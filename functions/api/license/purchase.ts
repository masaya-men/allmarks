// functions/api/license/purchase.ts
// POST /api/license/purchase { txn } — Paddle の取引IDから支払い確認をして
// K3ライセンスキーを発行する（同じ subscription には常に同じ鍵を返す＝再表示）。
// 署名は lib/board/license-sign.ts（functions/claim.ts と共用）。
// 設計: docs/private/2026-09-24-paddle-license-lifecycle-design.md §2.2。
import { z } from 'zod'
import { type LicensePayload } from '../../../lib/board/license-types'
import { signPayload } from '../../../lib/board/license-sign'
import { getTransaction, type PaddleEnv } from '../../../lib/board/paddle-api'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env extends PaddleEnv {
  K3_KV: KVNamespace
  /** base64url pkcs8 Ed25519 private key。functions/claim.ts と同じ鍵を使う。 */
  K3_PRIVATE_KEY: string
}

interface PagesContext {
  request: Request
  env: Env
}

const MAX_BODY_BYTES = 2 * 1024
const K3_SCOPE: readonly string[] = ['sync']
// Paddle の transaction id 形式（txn_ + 英数字）。上限40は実運用の txn_ 長に十分な余裕。
const TXN_PATTERN = /^txn_[a-z0-9]{10,40}$/

const purchaseRequestSchema = z.object({
  txn: z.string().regex(TXN_PATTERN),
})

/** `sub:<subId>` に保存する再表示用レコード。 */
const subRecordSchema = z.object({
  kid: z.string().min(1),
  key: z.string().min(1),
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** functions/activate.ts の readCappedText と同じ発想・同じ実装（DoS対策のストリーム上限読み）。 */
async function readCappedText(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const buf = new Uint8Array(maxBytes)
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.byteLength > 0) {
      if (total + value.byteLength > maxBytes) {
        await reader.cancel()
        return null
      }
      buf.set(value, total)
      total += value.byteLength
    }
  }
  return new TextDecoder().decode(buf.subarray(0, total))
}

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  const raw = await readCappedText(ctx.request, MAX_BODY_BYTES)
  if (raw === null) return jsonResponse(413, { ok: false, reason: 'invalid' })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid' })
  }

  const parsed = purchaseRequestSchema.safeParse(body)
  if (!parsed.success) return jsonResponse(400, { ok: false, reason: 'invalid' })
  const { txn } = parsed.data

  if (!ctx.env.K3_PRIVATE_KEY || !ctx.env.PADDLE_API_KEY) {
    return jsonResponse(503, { ok: false, reason: 'not-configured' })
  }

  const txnResult = await getTransaction(txn, ctx.env)
  if (txnResult.kind === 'not-found') return jsonResponse(200, { ok: false, reason: 'not-found' })
  if (txnResult.kind === 'upstream-error') return jsonResponse(502, { ok: false, reason: 'upstream' })

  const { status, subscriptionId } = txnResult.data
  if (status !== 'paid' && status !== 'completed') return jsonResponse(200, { ok: false, reason: 'not-paid' })
  if (!subscriptionId) return jsonResponse(200, { ok: false, reason: 'processing' })

  // 同じ subscription には常に同じ鍵を返す（再表示。月次更新の新しい取引IDが来ても同じ鍵）。
  const existingRaw = await ctx.env.K3_KV.get(`sub:${subscriptionId}`)
  if (existingRaw) {
    let existingJson: unknown = null
    try {
      existingJson = JSON.parse(existingRaw)
    } catch {
      existingJson = null
    }
    const existing = subRecordSchema.safeParse(existingJson)
    if (existing.success) return jsonResponse(200, { ok: true, key: existing.data.key, kid: existing.data.kid })
    // 壊れたレコードなら下に落として新規発行する（発行不能で購入者を詰ませないため）。
  }

  const kid = crypto.randomUUID()
  const payload: LicensePayload = { kid, scope: [...K3_SCOPE], v: 1, iat: Date.now() }

  let key: string
  try {
    key = await signPayload(payload, ctx.env.K3_PRIVATE_KEY)
  } catch {
    return jsonResponse(500, { ok: false, reason: 'sign-failed' })
  }

  await ctx.env.K3_KV.put(`issued:${kid}`, JSON.stringify({ source: 'paddle', subscriptionId, txn, iat: payload.iat }))
  await ctx.env.K3_KV.put(`sub:${subscriptionId}`, JSON.stringify({ kid, key }))

  return jsonResponse(200, { ok: true, key, kid })
}
