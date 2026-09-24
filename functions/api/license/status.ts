// functions/api/license/status.ts
// GET /api/license/status?kid=&device= — アプリが1日1回呼ぶ生存確認。
// 無償鍵（claimSecret由来）は常に active。Paddle鍵は毎回 Paddle API に問い合わせて
// 判定する（webhookなし方式＝設計 §2.6）。KVには一切書き込まない。
//
// 「外された」判定は rm:<kid>（tombstone）に載っているかどうかだけで行う。
// act:<kid> に居ないこと自体は根拠にしない — /activate はネットワーク失敗時
// fail-open（署名が本物なら端末はローカルで解錠される）なので、一度も登録に
// 成功していない端末を「外された」と誤判定すると、単に登録に失敗しただけの
// 端末が初回の日次チェックで誤って停止してしまう（設計 §2.1, §2.3, §2.4）。
import { z } from 'zod'
import { parseRemovedList } from '../../../lib/board/license-devices'
import { getSubscription, type PaddleEnv } from '../../../lib/board/paddle-api'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
}

interface Env extends PaddleEnv {
  K3_KV: KVNamespace
}

interface PagesContext {
  request: Request
  env: Env
}

const MAX_PARAM_LEN = 64

// 既存の無償鍵（claimSecret由来）と、Paddle発行分（source:'paddle'）の両方を読める形。
const issuedRecordSchema = z.union([
  z.object({
    source: z.literal('paddle'),
    subscriptionId: z.string().min(1),
    txn: z.string(),
    iat: z.number(),
  }),
  z.object({
    claimSecret: z.string(),
    iat: z.number(),
  }),
])

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const url = new URL(ctx.request.url)
  const kid = url.searchParams.get('kid')
  const device = url.searchParams.get('device')
  if (!kid || kid.length > MAX_PARAM_LEN || !device || device.length > MAX_PARAM_LEN) {
    return jsonResponse(400, { ok: false })
  }

  // 1) issued:<kid> が無い＝署名は本物だが発券記録が見当たらない → 止めない
  //    （既存の claim/activate と同じフェイルオープン方針）。
  const issuedRaw = await ctx.env.K3_KV.get(`issued:${kid}`)
  if (!issuedRaw) return jsonResponse(200, { ok: true, active: true, reason: 'unknown' })

  let issuedJson: unknown
  try {
    issuedJson = JSON.parse(issuedRaw)
  } catch {
    return jsonResponse(200, { ok: true, active: true, reason: 'unknown' })
  }
  const issuedParsed = issuedRecordSchema.safeParse(issuedJson)
  if (!issuedParsed.success) return jsonResponse(200, { ok: true, active: true, reason: 'unknown' })
  const issued = issuedParsed.data

  // 2) tombstone チェックは Paddle 問い合わせより先に行う（無駄な外部呼び出しを避ける）。
  //    rm:<kid> に載っている＝release.ts で明示的に外された端末のみ device-removed。
  //    act:<kid> に単に居ないだけ（未登録）は device-removed にしない。
  const rmRaw = await ctx.env.K3_KV.get(`rm:${kid}`)
  const removedIds = parseRemovedList(rmRaw)
  if (removedIds.includes(device)) {
    return jsonResponse(200, { ok: true, active: false, reason: 'device-removed' })
  }

  // 3) 無償鍵（claimSecret由来）は常に active。
  if (!('source' in issued) || issued.source !== 'paddle') {
    return jsonResponse(200, { ok: true, active: true })
  }

  // 4) Paddle鍵はそのつど Paddle API へ問い合わせる（KVには書かない）。
  if (!ctx.env.PADDLE_API_KEY) return jsonResponse(502, { ok: false, reason: 'upstream' })

  const subResult = await getSubscription(issued.subscriptionId, ctx.env)
  if (subResult.kind === 'upstream-error') return jsonResponse(502, { ok: false, reason: 'upstream' })
  if (subResult.kind === 'not-found') return jsonResponse(200, { ok: true, active: false, reason: 'ended' })

  const { status } = subResult.data
  if (status === 'active' || status === 'trialing' || status === 'past_due') {
    return jsonResponse(200, { ok: true, active: true })
  }
  return jsonResponse(200, { ok: true, active: false, reason: 'ended' })
}
