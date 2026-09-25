// functions/claim.ts
// GET /claim?c=<claimSecret> — 旧・会員限定リンクの入口。以前はここで直接
// キーを発券していたが、リンクを開く/再読込/リンクプレビューbot(LINE/Slack等)
// が踏むたびに1枠ずつ消費してしまう問題があった。今はここでは何も発券せず、
// 静的ページ /gift に secret をそのまま引き継いで302 redirectするだけ
// (発券は POST /api/license/claim、ユーザーが「キーを受け取る」ボタンを押した
// 時だけ)。既存に配布済みのリンクがそのまま動き続けるよう、このパスと `c`
// パラメータ名は変えない。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.1。

interface PagesContext {
  request: Request
}

const MAX_SECRET_LEN = 128

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const url = new URL(ctx.request.url)
  const secret = url.searchParams.get('c')

  const target = new URL('/gift', url.origin)
  // 異常に長い値は転送しない(secretとして意味を持たず、Locationヘッダを
  // 不必要に肥大化させるだけ)。/gift 側は c 無し/不正どちらも同じ
  // 「無効なリンク」表示になるので情報は失われない。
  if (secret && secret.length <= MAX_SECRET_LEN) {
    target.searchParams.set('c', secret) // URLSearchParams が値をURLエンコードする
  }

  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
  })
}
