// functions/s/_handler.ts
// /s/[id] および /s/[id]/triage が共通で使うハンドラロジック。
// KV から共有データを取り出し、 成功時は renderShareHTML、 失敗時は 404 (= ランダムテーマ) を返す。

import { renderShareHTML, renderShareNotFoundHTML } from './_template'
import { pickTheme } from './_themes'
import { isValidShareId } from '../../lib/share/kv-id'
import { decodeKVPayload } from '../../lib/share/decode-v2'
import bundleManifest from './_bundle-manifest.json'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

export interface ShareHandlerEnv {
  readonly SHARE_KV: KVNamespace
}

export interface ShareHandlerContext {
  readonly request: Request
  readonly env: ShareHandlerEnv
  readonly params: { readonly id: string }
}

function notFoundResponse(): Response {
  const html = renderShareNotFoundHTML({ theme: pickTheme() })
  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function handleShareRequest(
  ctx: ShareHandlerContext,
  page: 'landing' | 'triage',
): Promise<Response> {
  const url = new URL(ctx.request.url)
  const baseUrl = url.origin
  const id = ctx.params.id

  if (!isValidShareId(id)) {
    return notFoundResponse()
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return notFoundResponse()
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return notFoundResponse()
  }

  const cardCount = decoded.data.share.cards.length
  const html = renderShareHTML({
    id,
    cardCount,
    scripts: bundleManifest.scripts,
    stylesheets: bundleManifest.stylesheets,
    baseUrl,
    page,
  })

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
