// lib/share/proxy-image.ts
// SHARE 自動撮影のためのクロスオリジン画像 proxy URL 補助。
//
// なぜ必要か: 盤面カードの画像は外部オリジン (pbs.twimg.com 等) を crossOrigin 無しで
// 読む。<img> 表示はできるが、dom-to-image が撮影時に内部 XHR で画像 bytes を読もうと
// すると CORS で失敗する (= s169 が手動スクショに倒した理由)。同一オリジンの画像 proxy
// (`/api/img?u=<url>`) を通せば、撮影時の XHR が同一オリジンになり CORS を回避できる。
// 撮影時だけ clone の <img src> を proxy に差し替える (常時 proxy 化は帯域増になるため)。

/** 同一オリジン画像 proxy の URL を組み立てる (pure)。`u` に元 URL を URL エンコードして
 *  載せる。返り値はサイト相対 (`/api/img?u=...`) なので、どのオリジンにデプロイされても
 *  同一オリジンとして解決される。 */
export function proxyImageUrl(originalSrc: string): string {
  return `/api/img?u=${encodeURIComponent(originalSrc)}`
}

/**
 * `src` が「別オリジンの絶対 http(s) URL」かどうか (pure)。
 * - data: / blob: / 相対 URL / 同一オリジンの絶対 URL → false (差し替え不要)。
 * - 別オリジンの http(s) 絶対 URL → true (proxy 差し替え対象)。
 * パースできない値は false (安全側 = 触らない)。
 */
export function isCrossOriginHttp(src: string, origin: string): boolean {
  if (!/^https?:\/\//i.test(src)) return false
  try {
    return new URL(src).origin !== origin
  } catch {
    return false
  }
}

/** 別オリジンの http(s) 画像 src だけを同一オリジン proxy へ書き換える。それ以外
 *  (同一オリジン / data: / blob: / 相対) はそのまま返す (pure)。 */
export function rewriteToProxy(src: string, origin: string): string {
  return isCrossOriginHttp(src, origin) ? proxyImageUrl(src) : src
}
