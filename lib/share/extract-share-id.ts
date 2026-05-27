// lib/share/extract-share-id.ts
// 受信側コンポーネントは Pages Function 経由で HTML だけ受け取り、 props から ID を貰えない。
// 起動時に window.location.pathname を読んで自分で取り出すための pure 関数。

export type ShareIdExtraction =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly reason: 'no-match' }

/**
 * /s/<id> または /s/<id>/triage から 6 文字 base62 ID を抜き出す。
 * 不正な path・不正な ID 長・不正な文字が含まれていれば ok=false。
 */
export function extractShareIdFromPathname(pathname: string): ShareIdExtraction {
  const match = pathname.match(/^\/s\/([A-Za-z0-9]{6})(?:\/[A-Za-z]+)?\/?$/)
  if (!match) return { ok: false, reason: 'no-match' }
  return { ok: true, id: match[1] }
}
