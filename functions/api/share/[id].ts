// functions/api/share/[id].ts
// GET /api/share/<id> — KV から共有データを取り出して JSON で返す
import { isValidShareId } from '../../../lib/share/kv-id'
import { decodeKVPayload } from '../../../lib/share/decode-v2'
import type { ShareErrorResponse } from '../../../lib/share/types-v2'

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

function errResponse(status: number, error: ShareErrorResponse['error'], message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const id = ctx.params.id
  if (!isValidShareId(id)) {
    return errResponse(400, 'invalid', 'malformed share id')
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return errResponse(404, 'not_found', 'share expired or never existed')
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return errResponse(500, 'server', `decode failed: ${decoded.error}`)
  }

  return new Response(JSON.stringify(decoded.data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
