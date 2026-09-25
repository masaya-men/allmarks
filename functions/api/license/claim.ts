// functions/api/license/claim.ts
// POST /api/license/claim { c } — 会員限定リンク(claimSecret)からK3ライセンス
// キーを発券する。旧 GET /claim?c=... にあった検証/発券ロジックをそのまま
// 移設したもの(挙動不変)。GET /claim は静的ページ /gift への302 redirectだけを
// 行うようになり(functions/claim.ts)、リンクを開く/再読込/リンクプレビューbotが
// 誤って枠を消費する問題を解消する。署名は lib/board/license-sign.ts
// (functions/api/license/purchase.ts と共用)。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.1。
import { z } from 'zod'
import { type LicensePayload } from '../../../lib/board/license-types'
import { signPayload } from '../../../lib/board/license-sign'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env {
  K3_KV: KVNamespace
  /** base64url pkcs8 Ed25519 private key。functions/api/license/purchase.ts と同じ鍵を使う。 */
  K3_PRIVATE_KEY: string
}

interface PagesContext {
  request: Request
  env: Env
}

// KVに手動seedされるレコード（wrangler kv key put）。typoしたフィールド名等の
// 壊れた入力を実行時に弾く（さもないと record.issuedCount >= record.maxIssue が
// NaN >= undefined = false に化けてmaxIssueキャップが無効になり無制限発行され得る）。
const claimRecordSchema = z.object({
  label: z.string(),
  issuedCount: z.number().int().nonnegative(),
  maxIssue: z.number().int().nonnegative(),
  active: z.boolean(),
})
type ClaimRecord = z.infer<typeof claimRecordSchema>

const MAX_BODY_BYTES = 2 * 1024
const MAX_SECRET_LEN = 128
const K3_SCOPE: readonly string[] = ['sync']

const claimRequestSchema = z.object({
  c: z.string().min(1).max(MAX_SECRET_LEN),
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** functions/api/license/purchase.ts の readCappedText と同じ発想・同じ実装(DoS対策のストリーム上限読み)。 */
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

  const parsed = claimRequestSchema.safeParse(body)
  if (!parsed.success) return jsonResponse(400, { ok: false, reason: 'invalid' })
  const { c: secret } = parsed.data

  // KV読み取り前に確認する: 未設定のままだと、有効な secret を持つ人だけ
  // 「Key signing is not configured yet」という別のreasonを見てしまい、
  // 「サーバー未設定」と「secretが無効」を判別できてしまう（enumeration
  // oracle）。KV読み取りより前に置くことでこの区別を完全に消す。
  if (!ctx.env.K3_PRIVATE_KEY) return jsonResponse(503, { ok: false, reason: 'not-configured' })

  // Claim-secret rejection (unknown / malformed record / inactive / exhausted)
  // must all return the exact same {ok:false, reason:'invalid'} shape.
  // Otherwise anyone holding a real claimSecret (even an old/leaked one)
  // could distinguish "never existed" from "deactivated" from "exhausted" by
  // the response alone.
  const claimRejected = (): Response => jsonResponse(200, { ok: false, reason: 'invalid' })

  const kvRaw = await ctx.env.K3_KV.get(`claim:${secret}`)
  if (!kvRaw) return claimRejected()

  let recordJson: unknown
  try {
    recordJson = JSON.parse(kvRaw)
  } catch {
    return claimRejected()
  }
  const parsedRecord = claimRecordSchema.safeParse(recordJson)
  if (!parsedRecord.success) return claimRejected()
  const record: ClaimRecord = parsedRecord.data

  if (!record.active) return claimRejected()
  if (record.issuedCount >= record.maxIssue) return claimRejected()

  const kid = crypto.randomUUID()
  const payload: LicensePayload = { kid, scope: [...K3_SCOPE], v: 1, iat: Date.now() }

  let key: string
  try {
    key = await signPayload(payload, ctx.env.K3_PRIVATE_KEY)
  } catch {
    return jsonResponse(500, { ok: false, reason: 'sign-failed' })
  }

  await ctx.env.K3_KV.put(`issued:${kid}`, JSON.stringify({ claimSecret: secret, iat: payload.iat }))
  await ctx.env.K3_KV.put(`claim:${secret}`, JSON.stringify({ ...record, issuedCount: record.issuedCount + 1 }))

  return jsonResponse(200, { ok: true, key, kid })
}
