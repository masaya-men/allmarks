// functions/s/_handler.ts
// /s/[id] および /s/[id]/triage が共通で使うハンドラロジック。
// KV から共有データを取り出し、 成功時は Next.js が出力した /s.html を借りてきて
// OG メタタグを per-id に書き換えて返す (= hydration を壊さないため自前 HTML 生成は不採用)。
// 失敗時は 404 + ランダムテーマの 404 HTML を返す。

import { renderShareNotFoundHTML } from './_template'
import { pickTheme } from './_themes'
import { patchShareHTML } from './patch-share-html'
import { isValidShareId } from '../../lib/share/kv-id'
import { decodeKVPayload } from '../../lib/share/decode-v2'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

interface AssetFetcher {
  fetch(input: Request | string | URL): Promise<Response>
}

export interface ShareHandlerEnv {
  readonly SHARE_KV: KVNamespace
  /** Cloudflare Pages の静的アセット binding。 /s.html を取り出すのに使う。 */
  readonly ASSETS: AssetFetcher
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

  // /s.html (= Next.js export 出力) を静的アセットから取り出す。
  // 同一プロジェクト内なので edge 内で完結 (= 外部ネットワーク往復なし)。
  const templateRequest = new Request(`${baseUrl}/s`, { method: 'GET' })
  const templateResponse = await ctx.env.ASSETS.fetch(templateRequest)
  if (!templateResponse.ok) {
    return notFoundResponse()
  }
  const template = await templateResponse.text()

  const cardCount = decoded.data.share.cards.length
  const patched = patchShareHTML(template, {
    id,
    cardCount,
    baseUrl,
    page,
  })

  return new Response(patched, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
