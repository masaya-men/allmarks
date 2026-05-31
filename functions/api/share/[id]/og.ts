// functions/api/share/[id]/og.ts
// GET /api/share/<id>/og.webp — KV の thumb (base64 WebP dataURL) を bytes として返す薄いプロキシ
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

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const id = ctx.params.id
  if (!isValidShareId(id)) {
    return new Response('not found', { status: 404 })
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return new Response('not found', { status: 404 })
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return new Response('error', { status: 500 })
  }

  // thumb は data:image/<jpeg|webp>;base64,... 形式。 JPEG が現行 (= 全 SNS 互換)、
  // webp は本変更前に作られた共有の後方互換 (30 日 TTL で自然消滅するまで対応)。
  const thumb = decoded.data.thumb
  const match = thumb.match(/^data:image\/(jpeg|webp);base64,(.+)$/)
  if (!match || !match[2]) {
    return new Response('invalid thumb', { status: 500 })
  }
  const contentType = match[1] === 'webp' ? 'image/webp' : 'image/jpeg'

  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
