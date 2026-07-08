// lib/share/share-actions.ts
// 共有アクションの純ヘルパー。死蔵 SenderShareModal の intent / download パターンを
// 純化して移植。UI からはこれらを呼ぶだけにして副作用 (window.open / navigator.share)
// は呼び出し側に置く。

/** X (Twitter) 投稿 intent URL を組み立てる。X 側が og:image を unfurl する。 */
export function buildTweetIntentUrl(shareUrl: string, text?: string): string {
  const params = new URLSearchParams()
  params.set('url', shareUrl)
  if (text && text.trim().length > 0) params.set('text', text)
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

/** data:image/...;base64,... を File 化する (Web Share の files 用)。失敗時 null。 */
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/)
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  const isBase64 = match[2] === ';base64'
  const raw = match[3] ?? ''
  try {
    // ArrayBuffer を直接 BlobPart に渡す (Uint8Array<ArrayBufferLike> は BlobPart に
    // 割り当て不可な TS lib の厳格化を回避)。
    let buffer: ArrayBuffer
    if (isBase64) {
      if (typeof atob !== 'function') return null
      const binary = atob(raw)
      const view = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
      buffer = view.buffer
    } else {
      buffer = new TextEncoder().encode(decodeURIComponent(raw)).buffer as ArrayBuffer
    }
    if (typeof File !== 'function') return null
    return new File([buffer], filename, { type: mime })
  } catch {
    return null
  }
}

/** この環境が「ファイル付き」Web Share に対応しているか。 */
export function canWebShareFiles(
  nav: Pick<Navigator, 'canShare'> | undefined,
  file: File,
): boolean {
  if (!nav || typeof nav.canShare !== 'function') return false
  try {
    return nav.canShare({ files: [file] })
  } catch {
    return false
  }
}
