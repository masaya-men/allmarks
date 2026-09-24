// functions/api/license/release.ts
// POST /api/license/release { kid, deviceId, target } — 端末を act:<kid> から外す
// （SETTINGS「この端末の同期を解除」）。本人確認＝呼び出し元 deviceId が既に
// act:<kid> に登録済みであること。回数制限は入れない（過剰防御・設計 §2.4）。
// 実際に外した時だけ rm:<kid> に target を追記する（tombstone。status.ts が
// 「外された」と判定する唯一の根拠＝設計 §2.1, §2.3）。
import { z } from 'zod'
import {
  parseDeviceList, serializeDeviceList, parseRemovedList, serializeRemovedList, addToRemovedList,
} from '../../../lib/board/license-devices'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env {
  K3_KV: KVNamespace
}

interface PagesContext {
  request: Request
  env: Env
}

const MAX_BODY_BYTES = 2 * 1024

const releaseRequestSchema = z.object({
  kid: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(64),
  target: z.string().min(1).max(64),
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

  const parsed = releaseRequestSchema.safeParse(body)
  if (!parsed.success) return jsonResponse(400, { ok: false, reason: 'invalid' })
  const { kid, deviceId, target } = parsed.data

  const actRaw = await ctx.env.K3_KV.get(`act:${kid}`)
  const devices = parseDeviceList(actRaw)

  // 本人確認: 呼び出し元の deviceId がその鍵で既に活性化済みであること。
  if (!devices.some((d) => d.id === deviceId)) {
    return jsonResponse(200, { ok: false, reason: 'not-authorized' })
  }

  if (!devices.some((d) => d.id === target)) {
    // 既に外れている（あるいは元々居ない） → 冪等に ok:true
    return jsonResponse(200, { ok: true })
  }

  const updated = devices.filter((d) => d.id !== target)
  await ctx.env.K3_KV.put(`act:${kid}`, serializeDeviceList(updated))

  const rmRaw = await ctx.env.K3_KV.get(`rm:${kid}`)
  const rmList = parseRemovedList(rmRaw)
  await ctx.env.K3_KV.put(`rm:${kid}`, serializeRemovedList(addToRemovedList(rmList, target)))

  return jsonResponse(200, { ok: true })
}
