// functions/s/_template.ts
// /s/<id> および /s/<id>/triage の HTML を組み立てる pure 関数。
// Pages Function (= [id].ts / [id]/triage.ts) からのみ呼ばれる。

export interface ShareTemplateInput {
  /** 6 文字 base62 のシェア ID。 呼び出し側で isValidShareId を通した前提。 */
  readonly id: string
  /** 共有された bookmark の数。 og:description に埋め込む。 */
  readonly cardCount: number
  /** <script> として render する JS bundle の絶対パス一覧 (例 /_next/static/chunks/webpack-XXX.js)。 */
  readonly scripts: ReadonlyArray<string>
  /** <link rel="stylesheet"> として render する CSS の絶対パス一覧。 */
  readonly stylesheets: ReadonlyArray<string>
  /** og:url / og:image の絶対 URL 組み立て用 base (例 https://booklage.pages.dev)。 末尾 / は付けない。 */
  readonly baseUrl: string
  /** landing = /s/<id>、 triage = /s/<id>/triage */
  readonly page: 'landing' | 'triage'
}

export function renderShareHTML(input: ShareTemplateInput): string {
  const { id, cardCount, scripts, stylesheets, baseUrl, page } = input
  const pagePath = page === 'triage' ? `/s/${id}/triage` : `/s/${id}`
  const ogUrl = `${baseUrl}${pagePath}`
  const ogImage = `${baseUrl}/api/share/${id}/og.webp`
  const description = `A curated set of ${cardCount} bookmarks`

  const styleLinks = stylesheets
    .map((href): string => `<link rel="stylesheet" href="${href}">`)
    .join('\n  ')

  const scriptTags = scripts
    .map((src): string => `<script src="${src}" defer></script>`)
    .join('\n  ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shared collection on AllMarks</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="Shared collection on AllMarks">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="627">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${ogUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="icon" href="/favicon.ico">
  ${styleLinks}
</head>
<body>
  <div id="__next"></div>
  <script>window.__SHARE_ID__ = "${id}"; window.__SHARE_CARD_COUNT__ = ${cardCount};</script>
  ${scriptTags}
</body>
</html>`
}

/**
 * 404 ページのテーマ別バリエーション。 _themes/ 配下から登録される。
 * AllMarks の表現の幅を 404 でも見せるための仕組み。
 */
export interface Theme404Variant {
  /** debug 用のテーマ識別子 (= "wave" / 将来の "grid" 等)。 body の data-theme に出る。 */
  readonly name: string
  /** <body> 直下に挿入される HTML 断片。 */
  readonly bodyHTML: string
  /** <style> に inline される CSS 断片。 */
  readonly inlineCSS: string
  /** <script> に inline される JS 断片 (= 自前で動く、 React 等は読み込まない)。 */
  readonly inlineScript: string
}

/**
 * 共有が見つからない時 (= KV miss、 期限切れ、 不正 ID) に返す HTML。
 * - status 404 は呼び出し側 (= Pages Function) で設定する
 * - search engine から見えないよう noindex
 * - 「自分で作ってシェアしよう」 と背中を押す OG description
 * - インタラクティブなテーマ要素 (= bodyHTML / inlineCSS / inlineScript) はテーマ側に丸投げ
 */
export function renderShareNotFoundHTML(input: { readonly theme: Theme404Variant }): string {
  const { theme } = input
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Expired share · AllMarks</title>
  <meta name="description" content="This AllMarks share link has expired or never existed.">
  <meta name="robots" content="noindex">
  <meta property="og:title" content="Expired share · AllMarks">
  <meta property="og:description" content="This AllMarks share link has expired or never existed. Make your own and share it.">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/favicon.ico">
  <style>${theme.inlineCSS}</style>
</head>
<body data-theme="${theme.name}">
  ${theme.bodyHTML}
  <script>${theme.inlineScript}</script>
</body>
</html>`
}
