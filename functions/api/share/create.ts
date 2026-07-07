// functions/api/share/create.ts
// POST /api/share/create — KV にデータ本体を、 R2 に OG 画像を書く。
// session 96 で画像を KV → R2 へ分離: KV は share データのみ (軽量)、 画像 (thumb) は
// R2 bucket SHARE_OG に key=id で put (= egress 無料 + ストレージ単価 1/33)。
import { generateShareId } from '../../../lib/share/kv-id'
import { parseShareDataV2 } from '../../../lib/share/validate-v2'
import { encodeKVPayload } from '../../../lib/share/encode-v2'
import { SHARE_LIMITS_V2, type KVShareEntry, type ShareErrorResponse, type CreateShareResponse } from '../../../lib/share/types-v2'

interface KVNamespace {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
}

interface Env {
  SHARE_KV: KVNamespace
  SHARE_OG: R2Bucket
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

/** base64 文字列を bytes に変換する (= R2 put 用)。 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Reads the request body as text but enforces a hard ceiling on the *actual*
 * bytes read, returning null when the body exceeds `maxBytes`.
 *
 * The Content-Length check in onRequestPost is only a cheap early-out — a client
 * can omit or understate that header, so it must never be the real limit. This
 * reader copies into a single pre-sized maxBytes buffer and rejects *before*
 * copying any chunk that would cross the ceiling, so retained memory stays
 * within maxBytes (plus the one transient chunk the runtime hands us), then
 * cancels the rest of the stream — closing the size-cap bypass (rank9, DoS).
 * A missing body stream fails closed (returns '' → JSON.parse → 400) rather
 * than doing an unbounded text() read. Mirrors readCappedText in
 * functions/api/ogp.ts (which truncates; here we reject instead).
 */
async function readBodyCapped(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader()
  // No readable-stream binding — fail closed. In workerd a POST with a body
  // always exposes request.body; treat its absence as an empty body so the
  // caller's JSON.parse('') yields a clean 400 (never an unbounded read).
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
  // Fast path: reject an obviously-oversized upload before reading any body.
  const declaredLength = parseInt(ctx.request.headers.get('content-length') ?? '0', 10)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errResponse(413, 'invalid', `body too large (${declaredLength} > ${MAX_BODY_BYTES})`)
  }

  // Real enforcement: cap the actual bytes read so a missing / understated
  // Content-Length cannot slip a huge body past the fast path (rank9, DoS).
  const raw = await readBodyCapped(ctx.request, MAX_BODY_BYTES)
  if (raw === null) {
    return errResponse(413, 'invalid', `body too large (> ${MAX_BODY_BYTES})`)
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return errResponse(400, 'invalid', 'malformed JSON body')
  }

  const bodyObj = body as Partial<KVShareEntry>
  if (!bodyObj.share) {
    return errResponse(400, 'invalid', 'missing share field')
  }

  // thumb は任意。 有る場合だけ検証して R2 用の bytes を用意する。 無ければ OG は
  // 既定カード (/og.png) に fall back する (= COPY LINK は画像を再構成しない)。
  let thumbBytes: Uint8Array | null = null
  let contentType: 'image/jpeg' | 'image/webp' = 'image/jpeg'
  if (typeof bodyObj.thumb === 'string' && bodyObj.thumb.length > 0) {
    if (bodyObj.thumb.length > SHARE_LIMITS_V2.MAX_THUMB_BYTES * 2) {
      return errResponse(413, 'invalid', 'thumbnail too large')
    }
    // thumb は data:image/<jpeg|webp>;base64,... 形式。 bytes に分解して R2 へ。
    const thumbMatch = bodyObj.thumb.match(/^data:image\/(jpeg|webp);base64,(.+)$/)
    if (!thumbMatch || !thumbMatch[2]) {
      return errResponse(400, 'invalid', 'thumb must be a jpeg/webp data URL')
    }
    contentType = thumbMatch[1] === 'webp' ? 'image/webp' : 'image/jpeg'
    try {
      thumbBytes = base64ToBytes(thumbMatch[2])
    } catch {
      return errResponse(400, 'invalid', 'thumb base64 decode failed')
    }
  }

  const parsed = parseShareDataV2(bodyObj.share)
  if (!parsed.ok) {
    return errResponse(400, 'invalid', parsed.error)
  }

  // KV にはデータ本体のみ (= 軽量、 thumb は R2 へ分離)。
  const entry: KVShareEntry = { share: parsed.data }
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

  // 画像がある時だけ R2 へ。 無ければ og.ts が /og.png に fall back する。
  // (画像がある場合は) 先に R2 へ。 失敗したら KV を書かずに終わる (= og が画像欠けにならないように)。
  if (thumbBytes) {
    try {
      await ctx.env.SHARE_OG.put(id, thumbBytes, { httpMetadata: { contentType } })
    } catch {
      return errResponse(500, 'server', 'image upload failed')
    }
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
