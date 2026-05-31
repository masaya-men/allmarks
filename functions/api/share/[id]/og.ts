// functions/api/share/[id]/og.ts
// GET /api/share/<id>/og — OG 画像 (共有のSNSプレビュー JPEG) を bytes として返す。
// session 96 の R2 移行後: まず R2 bucket SHARE_OG から get、 無ければ移行前に作られた
// 共有の後方互換として KV の thumb を読む (= 30日 TTL で旧データが消えるまでの橋渡し)。
import { isValidShareId } from '../../../../lib/share/kv-id'
import { decodeKVPayload } from '../../../../lib/share/decode-v2'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
}

interface Env {
  SHARE_KV: KVNamespace
  SHARE_OG: R2Bucket
}

interface PagesContext {
  request: Request
  env: Env
  params: { id: string }
}

const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400'

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const id = ctx.params.id
  if (!isValidShareId(id)) {
    return new Response('not found', { status: 404 })
  }

  // 1) R2 を優先 (= 移行後の新規共有)。
  const obj = await ctx.env.SHARE_OG.get(id)
  if (obj) {
    const buf = await obj.arrayBuffer()
    const contentType = obj.httpMetadata?.contentType ?? 'image/jpeg'
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
    })
  }

  // 2) 後方互換: 移行前の共有は KV に thumb (data URL) を持つ。
  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return new Response('not found', { status: 404 })
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return new Response('error', { status: 500 })
  }

  const thumb = decoded.data.thumb
  if (!thumb) {
    // R2 にも KV thumb にも無い (= R2 put 後に何か起きた稀ケース)。
    return new Response('not found', { status: 404 })
  }
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
    headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
  })
}
