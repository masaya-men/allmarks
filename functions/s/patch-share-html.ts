// functions/s/patch-share-html.ts
// Next.js 生成済 HTML (= out/s.html) を受け取り、 OG メタタグを per-id に書き換えて返す pure 関数。
// 自前で HTML を組み立てる方式だと RSC ストリーミングデータが欠けてしまうため、 こちらの方式を採用。

export interface PatchShareHTMLVars {
  /** 6 文字 base62 のシェア ID。 isValidShareId 通過前提。 */
  readonly id: string
  /** 共有された bookmark 件数。 og:description と window.__SHARE_CARD_COUNT__ に出る。 */
  readonly cardCount: number
  /** og:url / og:image の絶対 URL 組み立て用 base (末尾 / なし)。 */
  readonly baseUrl: string
  /** landing = /s/<id>、 triage = /s/<id>/triage */
  readonly page: 'landing' | 'triage'
}

const TITLE = 'Shared collection on AllMarks'

/**
 * テンプレート HTML に対して in-place な置換 + 注入を行う。
 *
 * 1. <title> を共有用に置換
 * 2. og:title / og:description content を置換
 * 3. og:type の直後に og:url / og:image / og:image:width / height / twitter:image を注入
 * 4. <head> 直後に window.__SHARE_ID__ / __SHARE_CARD_COUNT__ を注入 (= bundle 前に必ず実行されるよう先頭に)
 *
 * Next.js bundle <script> や RSC streaming <script> には**触らない**ことが重要。
 */
export function patchShareHTML(template: string, vars: PatchShareHTMLVars): string {
  const { id, cardCount, baseUrl, page } = vars
  const pagePath = page === 'triage' ? `/s/${id}/triage` : `/s/${id}`
  const ogUrl = `${baseUrl}${pagePath}`
  // 配信関数は functions/api/share/[id]/og.ts = ルート /api/share/<id>/og。
  // 以前は末尾に .webp を付けていたが、 そのパスにはどの関数も当たらず Next の 404
  // HTML が返り、 SNS クローラーが OG 画像を取得できていなかった (session 96 本番実測で確定)。
  // 関数側が Content-Type: image/webp を返すので拡張子は不要。
  const ogImage = `${baseUrl}/api/share/${id}/og`
  const description = `A curated set of ${cardCount} bookmarks shared via AllMarks`

  let html = template

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${TITLE}</title>`)

  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${TITLE}"/>`,
  )

  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${description}"/>`,
  )

  const injectAfterOgType = [
    `<meta property="og:url" content="${ogUrl}"/>`,
    `<meta property="og:image" content="${ogImage}"/>`,
    `<meta property="og:image:width" content="1200"/>`,
    `<meta property="og:image:height" content="628"/>`,
    `<meta name="twitter:image" content="${ogImage}"/>`,
  ].join('')
  html = html.replace(
    /(<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>)/,
    (_match, ogTypeTag): string => `${ogTypeTag}${injectAfterOgType}`,
  )

  const shareVarsScript =
    `<script>window.__SHARE_ID__="${id}";window.__SHARE_CARD_COUNT__=${cardCount};</script>`
  html = html.replace(/<head>/, `<head>${shareVarsScript}`)

  return html
}
