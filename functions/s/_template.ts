// functions/s/_template.ts
// 404 ページの HTML を組み立てる pure 関数 + テーマ型定義。
// 200 (= 成功時) の HTML はビルド出力 (= out/s.html) を patch-share-html で書き換える形に変更したため
// ここでは扱わない。

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
