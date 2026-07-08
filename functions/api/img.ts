// functions/api/img.ts
// 同一オリジン画像 proxy — SHARE 自動撮影 (dom-to-image) の CORS 汚染回避のためだけに使う。
//
//   GET /api/img?u=<画像URL>  →  サーバー側で fetch し、bytes をそのまま image/* で返す
//
// 盤面カードの画像は外部オリジン (pbs.twimg.com 等) を crossOrigin 無しで読むため、
// dom-to-image が撮影時に XHR で bytes を読もうとすると CORS で失敗する。この proxy を
// 通すと XHR が同一オリジンになり、上流サイトの CORS 設定に関係なく撮影できる。
//
// SSRF 対策は既存 functions/api/ogp.ts の isBlockedHost を再利用 (= 新たな危険面を増やさない)。
// 加えて: (1) content-type を raster 画像に allowlist (SVG は XSS リスクのため拒否)、
// (2) バイト上限、(3) リダイレクト着地ホストの再検証、(4) X-Content-Type-Options: nosniff。
import { isBlockedHost } from './ogp'

interface PagesContext {
  request: Request
}

/** 画像 1 枚の上限。OG 画像・サムネは通常 ~1MB 以下だが、高解像度 og:image も通せるよう
 *  余裕を持って 16MB。これを超えるものは撮影に不要なので拒否 (DoS 兼メモリ保護)。 */
const MAX_IMAGE_BYTES = 16 * 1024 * 1024

/** 返してよい画像 content-type (raster のみ)。SVG は <script> を仕込めるため、同一
 *  オリジンで返すと XSS になり得るので allowlist から除外する。 */
const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/apng',
])

/** `Content-Type: image/jpeg; charset=..` から `image/jpeg` だけを小文字で取り出す。 */
function normalizeContentType(raw: string | null): string {
  return (raw ?? '').split(';')[0].trim().toLowerCase()
}

function errResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/**
 * レスポンス body を最大 maxBytes まで読む。超過したら残りをキャンセルして null を返す
 * (画像は途中で切ると壊れるので、truncate ではなく reject)。ピークメモリは maxBytes +
 * 直近チャンク 1 個に収まる。ogp.ts の readCappedText と同じ発想 (あちらは truncate)。
 */
async function readCappedBytes(res: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = res.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.byteLength > 0) {
      if (total + value.byteLength > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
      total += value.byteLength
    }
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  return merged
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url).searchParams.get('u')
  if (!url) {
    return errResponse(400, 'u parameter required')
  }

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return errResponse(400, 'Invalid URL format')
  }

  // SSRF guard: public http(s) のみ。他スキーム (file:/data:/ftp: …) と内部/private/
  // metadata ターゲットを拒否 (ogp.ts と同じ isBlockedHost)。
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return errResponse(400, 'Only http(s) URLs are allowed')
  }
  if (isBlockedHost(target.hostname)) {
    return errResponse(400, 'Target host is not allowed')
  }

  let res: Response
  try {
    res = await fetch(target.toString(), {
      headers: {
        // 一部ホストは UA を見てブロックするので、通常ブラウザ相当を名乗る。
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return errResponse(502, 'Upstream fetch failed')
  }

  // 早期リターンする前に upstream の body を必ず捨てる。workerd は fetch 済み body を
  // 未消費のまま別レスポンスを返すと例外を投げ (= CF が 502 を返す)、これが「404/非画像/
  // リダイレクト拒否」で全滅していた原因。cancel してから errResponse を返す。
  const bail = (status: number, msg: string): Response => {
    try {
      void res.body?.cancel()
    } catch {
      /* already closed */
    }
    return errResponse(status, msg)
  }

  try {
    // リダイレクトで内部ホストに着地していないか、body を読む前に再検証する (ogp.ts と同じ)。
    if (res.url) {
      let landed: URL
      try {
        landed = new URL(res.url)
      } catch {
        return bail(400, 'Redirected to an unverifiable host')
      }
      if (
        (landed.protocol !== 'http:' && landed.protocol !== 'https:') ||
        isBlockedHost(landed.hostname)
      ) {
        return bail(400, 'Redirected to a disallowed host')
      }
    } else if (res.redirected) {
      return bail(400, 'Redirected to an unverifiable host')
    }

    if (!res.ok) {
      return bail(502, `Upstream returned ${res.status}`)
    }

    const contentType = normalizeContentType(res.headers.get('content-type'))
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      // 画像でない (HTML ソフト 404 / mp4 / svg 等) → 撮影に使えないので拒否。呼び出し側の
      // <img> は onError → PlaceholderCard にフォールバックする (= 新規劣化なし)。
      return bail(415, `Unsupported content-type: ${contentType || 'unknown'}`)
    }

    const bytes = await readCappedBytes(res, MAX_IMAGE_BYTES)
    if (!bytes) {
      return errResponse(502, 'Image too large or unreadable')
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // 撮影用の一時取得。画像 bytes は不変なので長期 immutable キャッシュで CF エッジに
        // 載せ、2 回目以降のエッジ fetch を省く。
        'Cache-Control': 'public, max-age=31536000, immutable',
        // 返す content-type を allowlist 済みなので、ブラウザに sniff させない。
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    // 想定外の例外 (body stream error 等) でも CF に 502 クラッシュを返させず、自前の
    // errResponse で綺麗に閉じる → 呼び出し側の <img> は placeholder にフォールバック。
    return bail(502, 'Image processing failed')
  }
}
