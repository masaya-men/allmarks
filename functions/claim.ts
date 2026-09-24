// functions/claim.ts
// GET /claim?c=<claimSecret> — 会員限定リンクを踏んだ支援者にK3ライセンス
// キーを発券して画面表示する。署名するのはここだけ（秘密鍵はWorker Secret）。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.1。
import { z } from 'zod'
import { type LicensePayload } from '../lib/board/license-types'
import { signPayload } from '../lib/board/license-sign'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env {
  K3_KV: KVNamespace
  /** base64url pkcs8 Ed25519 private key。scripts/generate-k3-keypair.mjs で生成
   *  して `wrangler pages secret put K3_PRIVATE_KEY` で設定する（未設定なら空）。 */
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

const MAX_SECRET_LEN = 128
const K3_SCOPE: readonly string[] = ['sync']

function htmlPage(body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AllMarks — Sync Key</title>
<style>
body{background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:48px 24px;line-height:1.6}
h1{font-size:20px;font-weight:600;margin:0 0 8px}
code{display:block;word-break:break-all;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;font-family:ui-monospace,monospace;font-size:13px;margin:16px 0}
button{background:#fff;color:#0a0a0a;border:none;border-radius:6px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer}
p{color:#999;font-size:14px}
</style></head><body>${body}</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )
}

function errorPage(message: string): Response {
  return htmlPage(`<h1>Link not available</h1><p>${message}</p>`)
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const url = new URL(ctx.request.url)
  const secret = url.searchParams.get('c')
  if (!secret || secret.length > MAX_SECRET_LEN) {
    return errorPage('This link is missing or malformed.')
  }
  // KV読み取り前に確認する: 未設定のままだと、有効な secret を持つ人だけ
  // "Key signing is not configured yet" という別メッセージを見てしまい、
  // 「サーバー未設定」と「secretが無効」を判別できてしまう（enumeration
  // oracle）。KV読み取りより前に置くことでこの区別を完全に消す。
  if (!ctx.env.K3_PRIVATE_KEY) return errorPage('Key signing is not configured yet. Please try again later.')

  // Claim-secret rejection (unknown / malformed record / inactive / exhausted)
  // must all return the exact same message. Otherwise anyone holding a real
  // claimSecret (even an old/leaked one) could distinguish "never existed"
  // from "deactivated" from "exhausted" by the message text alone.
  const claimRejected = (): Response => errorPage('This link is invalid or no longer available.')

  const raw = await ctx.env.K3_KV.get(`claim:${secret}`)
  if (!raw) return claimRejected()

  let recordJson: unknown
  try {
    recordJson = JSON.parse(raw)
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
    return errorPage('Key signing failed. Please try again later.')
  }

  await ctx.env.K3_KV.put(`issued:${kid}`, JSON.stringify({ claimSecret: secret, iat: payload.iat }))
  await ctx.env.K3_KV.put(`claim:${secret}`, JSON.stringify({ ...record, issuedCount: record.issuedCount + 1 }))

  return htmlPage(`
<h1>Your AllMarks sync key</h1>
<p>Paste this into AllMarks — SETTINGS — Enter your key.</p>
<code id="key">${key}</code>
<button onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy key</button>
<p>Key ID: ${kid}</p>
<p>This key works on up to 5 devices. Save it somewhere — this page won't show it again.</p>
`)
}
