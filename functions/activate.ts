// functions/activate.ts
// POST /activate {kid, deviceId, label?} — 発動台数をカウントする（5台キャップ・冪等）。
// 署名検証はクライアント側で済んでいる前提（license-crypto.ts）。ここでは
// kidが発券済みかの整合確認と、台数カウントだけを行う。
// act:<kid> は {id,label,at}[] 形式（旧・文字列配列も読める）。
// (再)登録成功時、その端末が rm:<kid>（外された端末のtombstone）に載っていれば
// 消す＝鍵を入れ直すと同期が再開する仕組み（cap-exceeded で拒否した場合は触らない）。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.2 ／
// docs/private/2026-09-24-paddle-license-lifecycle-design.md §2.1, §2.4, §2.5。
import { z } from 'zod'
import {
  parseDeviceList, serializeDeviceList, parseRemovedList, serializeRemovedList, removeFromRemovedList,
  type DeviceEntry,
} from '../lib/board/license-devices'

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
const MAX_ACTIVATIONS = 5

const activateRequestSchema = z.object({
  kid: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(64),
  label: z.string().max(60).optional(),
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** functions/api/share/create.ts の readBodyCapped と同じ発想（DoS対策の
 *  ストリーム上限読み）。activate/claimはbody無しのGETも多いので独立実装
 *  （dedupはfunctions/_lib/集約の別チケットに委ねる＝既存の方針を踏襲）。 */
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

  const parsed = activateRequestSchema.safeParse(body)
  if (!parsed.success) return jsonResponse(400, { ok: false, reason: 'invalid' })
  const { kid, deviceId, label } = parsed.data

  const issued = await ctx.env.K3_KV.get(`issued:${kid}`)
  if (!issued) return jsonResponse(200, { ok: false, reason: 'unknown-key' })

  const actRaw = await ctx.env.K3_KV.get(`act:${kid}`)
  const devices = parseDeviceList(actRaw)
  const alreadyRegistered = devices.some((d) => d.id === deviceId)

  if (!alreadyRegistered) {
    if (devices.length >= MAX_ACTIVATIONS) return jsonResponse(200, { ok: false, reason: 'cap-exceeded' })

    const entry: DeviceEntry = { id: deviceId, label: label ?? '', at: Date.now() }
    devices.push(entry)
    await ctx.env.K3_KV.put(`act:${kid}`, serializeDeviceList(devices))
  }

  // (再)登録が成功した端末は tombstone から外す＝鍵を入れ直せば同期が再開する。
  const rmRaw = await ctx.env.K3_KV.get(`rm:${kid}`)
  const rmList = parseRemovedList(rmRaw)
  if (rmList.includes(deviceId)) {
    await ctx.env.K3_KV.put(`rm:${kid}`, serializeRemovedList(removeFromRemovedList(rmList, deviceId)))
  }

  return jsonResponse(200, { ok: true })
}
