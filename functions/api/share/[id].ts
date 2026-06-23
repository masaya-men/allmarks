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
    // Match the HTML handler (functions/s/_handler.ts), which renders the 404
    // not-found page for a malformed id. Aligning EVERY failure branch (invalid
    // id / missing / decode-fail) to 404 'not_found' keeps the receiver UX
    // consistent and future-proofs against extract-share-id.ts and kv-id.ts
    // regexes drifting apart (rank25).
    return errResponse(404, 'not_found', 'share expired or never existed')
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return errResponse(404, 'not_found', 'share expired or never existed')
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    // A KV entry that won't decode (corrupt / schema drift) is unusable. Surface
    // it as "gone" (404) — the SAME response the HTML handler gives on decode
    // failure (functions/s/_handler.ts → notFoundResponse). Without this, the
    // JSON API said 500 ("Could not load share") while the page said 404
    // ("expired"), so the receiver UX contradicted itself (rank25). A broken
    // share now reads as "expired" everywhere, never a scary server error.
    return errResponse(404, 'not_found', 'share expired or never existed')
  }

  return new Response(JSON.stringify(decoded.data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
