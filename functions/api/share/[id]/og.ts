// functions/api/share/[id]/og.ts
// GET /api/share/<id>/og.webp — OG image endpoint
// SSR で <meta og:image> がこの URL を指す。 X / Discord / Slack のクローラが
// fetch して URL preview を作る。
import { isValidShareId } from '../../../../lib/share/kv-id'
import { decodeKVPayload } from '../../../../lib/share/decode-v2'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

interface Env {
  SHARE_KV: KVNamespace
}

interface PagesContext {
  request: Request
  env: Env
  params: { id: string }
}

// 1x1 black WebP — share が見つからない / 期限切れ / 失敗時の fallback。
// 完全に preview が壊れるよりは小さい画像でも返す方がマシ。
const PLACEHOLDER_WEBP_BASE64 = 'UklGRhwAAABXRUJQVlA4TBAAAAAvAAAAAAfQ//73v/+BiOh/AAA='

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function placeholderResponse(cacheMaxAge: number): Response {
  const bytes = base64ToBytes(PLACEHOLDER_WEBP_BASE64)
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
    },
  })
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const id = ctx.params.id

  if (!isValidShareId(id)) {
    return placeholderResponse(300)
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return placeholderResponse(60)
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return placeholderResponse(60)
  }

  const thumb = decoded.data.thumb
  const match = thumb.match(/^data:image\/\w+;base64,(.+)$/)
  if (!match) {
    return placeholderResponse(60)
  }

  const bytes = base64ToBytes(match[1])
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
