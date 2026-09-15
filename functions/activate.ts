// functions/activate.ts
// POST /activate {kid, deviceId} — 発動台数をカウントする（5台キャップ・冪等）。
// 署名検証はクライアント側で済んでいる前提（license-crypto.ts）。ここでは
// kidが発券済みかの整合確認と、台数カウントだけを行う。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.2。
import { z } from 'zod'

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
  const { kid, deviceId } = parsed.data

  const issued = await ctx.env.K3_KV.get(`issued:${kid}`)
  if (!issued) return jsonResponse(200, { ok: false, reason: 'unknown-key' })

  const actRaw = await ctx.env.K3_KV.get(`act:${kid}`)
  let devices: string[] = []
  if (actRaw) {
    try {
      const parsedDevices: unknown = JSON.parse(actRaw)
      if (Array.isArray(parsedDevices)) devices = parsedDevices.filter((d): d is string => typeof d === 'string')
    } catch {
      devices = []
    }
  }

  if (devices.includes(deviceId)) return jsonResponse(200, { ok: true })
  if (devices.length >= MAX_ACTIVATIONS) return jsonResponse(200, { ok: false, reason: 'cap-exceeded' })

  devices.push(deviceId)
  await ctx.env.K3_KV.put(`act:${kid}`, JSON.stringify(devices))
  return jsonResponse(200, { ok: true })
}
