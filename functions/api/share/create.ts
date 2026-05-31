// functions/api/share/create.ts
// POST /api/share/create — KV write + 6-char base62 ID 発行
import { generateShareId } from '../../../lib/share/kv-id'
import { parseShareDataV2 } from '../../../lib/share/validate-v2'
import { encodeKVPayload } from '../../../lib/share/encode-v2'
import { SHARE_LIMITS_V2, type KVShareEntry, type ShareErrorResponse, type CreateShareResponse } from '../../../lib/share/types-v2'

interface KVNamespace {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

interface Env {
  SHARE_KV: KVNamespace
}

interface PagesContext {
  request: Request
  env: Env
}

// thumb は最大 300KB の JPEG → base64 で約 400KB + share データ。 余裕を見て 800KB。
const MAX_BODY_BYTES = 800 * 1024
const MAX_ID_RETRIES = 5

function errResponse(status: number, error: ShareErrorResponse['error'], message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  const contentLength = parseInt(ctx.request.headers.get('content-length') ?? '0', 10)
  if (contentLength > MAX_BODY_BYTES) {
    return errResponse(413, 'invalid', `body too large (${contentLength} > ${MAX_BODY_BYTES})`)
  }

  let body: unknown
  try {
    body = await ctx.request.json()
  } catch {
    return errResponse(400, 'invalid', 'malformed JSON body')
  }

  const bodyObj = body as Partial<KVShareEntry>
  if (!bodyObj.share || typeof bodyObj.thumb !== 'string') {
    return errResponse(400, 'invalid', 'missing share or thumb field')
  }
  if (bodyObj.thumb.length > SHARE_LIMITS_V2.MAX_THUMB_BYTES * 2) {
    return errResponse(413, 'invalid', 'thumbnail too large')
  }

  const parsed = parseShareDataV2(bodyObj.share)
  if (!parsed.ok) {
    return errResponse(400, 'invalid', parsed.error)
  }

  const entry: KVShareEntry = { share: parsed.data, thumb: bodyObj.thumb }
  const encoded = await encodeKVPayload(entry)

  if (encoded.length > SHARE_LIMITS_V2.MAX_KV_ENTRY_BYTES) {
    return errResponse(413, 'invalid', `payload too large (${encoded.length})`)
  }

  let id: string | null = null
  for (let i = 0; i < MAX_ID_RETRIES; i++) {
    const candidate = generateShareId()
    const existing = await ctx.env.SHARE_KV.get(candidate)
    if (existing === null) { id = candidate; break }
  }
  if (id === null) {
    return errResponse(500, 'server', 'ID allocation failed')
  }

  await ctx.env.SHARE_KV.put(id, encoded, { expirationTtl: SHARE_LIMITS_V2.TTL_SECONDS })

  const response: CreateShareResponse = {
    id,
    expiresAt: Date.now() + SHARE_LIMITS_V2.TTL_SECONDS * 1000,
  }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
