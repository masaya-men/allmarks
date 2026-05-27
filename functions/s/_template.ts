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
