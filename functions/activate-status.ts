// functions/activate-status.ts
// GET /activate-status?kid=<kid> — read-only device-count lookup for the
// SETTINGS UI ("X/5 devices used" + per-device list). Never registers or
// consumes a device slot (only POST /activate does that) — this just reads
// act:<kid> from KV. Sibling of functions/activate.ts; MAX_ACTIVATIONS must
// stay in sync with that file's own constant.
// act:<kid> is {id,label,at}[] (also reads the legacy string[] form) — see
// docs/private/2026-09-24-paddle-license-lifecycle-design.md §2.1, §2.5.
import { parseDeviceList } from '../lib/board/license-devices'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
}

interface Env {
  K3_KV: KVNamespace
}

interface PagesContext {
  request: Request
  env: Env
}

const MAX_KID_LEN = 64
const MAX_ACTIVATIONS = 5

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const url = new URL(ctx.request.url)
  const kid = url.searchParams.get('kid')
  if (!kid || kid.length > MAX_KID_LEN) return jsonResponse(400, { ok: false })

  const actRaw = await ctx.env.K3_KV.get(`act:${kid}`)
  const devices = parseDeviceList(actRaw)
  return jsonResponse(200, { ok: true, count: devices.length, max: MAX_ACTIVATIONS, devices })
}
