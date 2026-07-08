// functions/og/[id].ts
// GET /og/<id>[.jpg] — 共有の OG 画像を bytes として **200 で直接** 返す。
//
// なぜ /api/share/<id>/og とは別にこのルートを置くか:
//   姉妹プロジェクト LoPo (lopoly.app) が「Discord は画像が出るが X だけ小さい summary
//   カードのまま」を実際に解決した記録から移植した recipe。効いた修正は
//   (a) OG 画像を /api/ 配下から外し「静的ファイル風の同一オリジン URL」にする
//   (b) リダイレクトせず 200 で画像バイトを直接返す
//   (c) 長期 immutable キャッシュにする
//   だった (LoPo の api/share/_sharePageHandler.ts コメント「X クローラーが /api/
//   プレフィックスを嫌う問題を回避」)。よって patch-share-html は og:image /
//   twitter:image をこのルート (/og/<id>.jpg) に向ける。
//
// 旧 /api/share/[id]/og.ts は後方互換で残置 (既存 crawl キャッシュ用)。
import { isValidShareId } from '../../lib/share/kv-id'

interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
}

interface AssetFetcher {
  fetch(input: Request | string | URL): Promise<Response>
}

interface Env {
  SHARE_OG: R2Bucket
  ASSETS: AssetFetcher
}

interface PagesContext {
  request: Request
  env: Env
  params: { id: string }
}

// 共有 id ごとの画像は生成後に変わらない → crawler に優しい長期 immutable。
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** `abc123.jpg` / `abc123.jpeg` / `abc123.png` → `abc123`。拡張子なしはそのまま。 */
function stripImageExt(raw: string): string {
  return raw.replace(/\.(jpe?g|png|webp)$/i, '')
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const id = stripImageExt(ctx.params.id)
  if (!isValidShareId(id)) {
    return new Response('not found', { status: 404 })
  }

  // 1) R2 に保管された共有画像 (= 手動スクショ) を優先。200 直接。
  const obj = await ctx.env.SHARE_OG.get(id)
  if (obj) {
    const buf = await obj.arrayBuffer()
    const contentType = obj.httpMetadata?.contentType ?? 'image/jpeg'
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
    })
  }

  // 2) 画像なし (画像を貼らずに作った COPY LINK 共有など) でも **リダイレクトしない**。
  //    既定カード /og.png のバイトを同一オリジンから取得して 200 で返す。
  //    LoPo recipe: 302 は X クローラーが嫌うため常に 200 直接。
  const origin = new URL(ctx.request.url).origin
  const fallback = await ctx.env.ASSETS.fetch(new Request(`${origin}/og.png`, { method: 'GET' }))
  if (fallback.ok) {
    const buf = await fallback.arrayBuffer()
    const contentType = fallback.headers.get('Content-Type') ?? 'image/png'
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
    })
  }

  // 3) 既定カードすら取れない異常時のみ 404 (通常起きない)。
  return new Response('not found', { status: 404 })
}
