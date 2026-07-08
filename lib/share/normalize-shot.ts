// lib/share/normalize-shot.ts
// ユーザーが撮った手動スクショ (File/Blob/画像要素) を、共有 OG 用の 1200×630 JPEG
// data-URL に正規化する。
//
// なぜユーザー自身のスクショなら成立するか:
//   盤面カードの画像は外部オリジン (pbs.twimg.com 等) で crossOrigin 無し → dom-to-image
//   / canvas 撮影はクロスオリジン汚染で真っ白になる (これが s169 が手動スクショに倒した
//   理由)。だが「ユーザーが OS 機能で撮った画像」は同一オリジン扱いの生バイトなので
//   canvas に描いて toDataURL('image/jpeg') しても汚染しない。外部カード画像には一切
//   触れないのが安全性の肝。
//
// 出力は data:image/jpeg;base64,... = create.ts の thumb 正規表現に適合。

/** cover 描画のための「src からの切り出し矩形」。整数入力なら整数を保つよう
 *  cross-multiply で算出する (浮動小数誤差を避ける)。 */
export interface CoverRect {
  readonly sx: number
  readonly sy: number
  readonly sw: number
  readonly sh: number
}

/**
 * dst の縦横比で src を cover 切り出しする矩形を返す。
 * src が dst より横長 → 左右を削る / 縦長 → 上下を削る。中央寄せ。
 */
export function computeCoverRect(srcW: number, srcH: number, dstW: number, dstH: number): CoverRect {
  // srcW/srcH > dstW/dstH ⇔ srcW*dstH > srcH*dstW (cross-multiply で誤差回避)
  const srcIsWider = srcW * dstH > srcH * dstW
  if (srcIsWider) {
    // 横長すぎ → 高さ全部使い、幅を削る
    const sw = (srcH * dstW) / dstH
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH }
  }
  // 縦長すぎ (または一致) → 幅全部使い、高さを削る
  const sh = (srcW * dstH) / dstW
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh }
}

export interface NormalizeShotOptions {
  readonly width?: number
  readonly height?: number
  readonly targetBytes?: number
  readonly startQuality?: number
  readonly minQuality?: number
}

type ShotSource = Blob | HTMLImageElement | ImageBitmap

interface Drawable {
  readonly img: CanvasImageSource
  readonly w: number
  readonly h: number
}

function isHtmlImageElement(v: unknown): v is HTMLImageElement {
  return typeof HTMLImageElement !== 'undefined' && v instanceof HTMLImageElement
}

async function toDrawable(source: ShotSource): Promise<Drawable | null> {
  if (isHtmlImageElement(source)) {
    if (!source.complete || source.naturalWidth === 0) {
      try { await source.decode() } catch { return null }
    }
    if (source.naturalWidth === 0) return null
    return { img: source, w: source.naturalWidth, h: source.naturalHeight }
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { img: source, w: source.width, h: source.height }
  }
  // Blob (HTMLImageElement / ImageBitmap は上で return 済みなので実質 Blob)
  const blob = source as Blob
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob)
      return { img: bmp, w: bmp.width, h: bmp.height }
    } catch { /* fall through to <img> path */ }
  }
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Image !== 'undefined') {
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      if (img.naturalWidth === 0) return null
      return { img, w: img.naturalWidth, h: img.naturalHeight }
    } catch {
      return null
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return null
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<string | null> {
  return new Promise((resolve): void => {
    if (typeof canvas.toBlob !== 'function') { resolve(null); return }
    canvas.toBlob(
      (blob): void => {
        if (!blob) { resolve(null); return }
        const reader = new FileReader()
        reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = (): void => resolve(null)
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

/** dataURL (base64) の実バイト数を概算する。 */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

async function canvasToJpegUnderTarget(
  canvas: HTMLCanvasElement,
  targetBytes: number,
  startQuality: number,
  minQuality: number,
): Promise<string | null> {
  const STEP = 0.1
  let quality = startQuality
  let last: string | null = null
  while (quality >= minQuality - 1e-9) {
    const dataUrl = await canvasToJpeg(canvas, quality)
    if (!dataUrl) return last
    last = dataUrl
    if (dataUrlByteLength(dataUrl) <= targetBytes) return dataUrl
    quality -= STEP
  }
  return last
}

/**
 * ユーザー画像を 1200×630 の JPEG data-URL に cover 正規化する。
 * canvas 非対応環境 (jsdom 等) や読み込み失敗時は null を返す (呼び出し側でトースト)。
 */
export async function normalizeShotToJpegDataUrl(
  source: ShotSource,
  opts?: NormalizeShotOptions,
): Promise<string | null> {
  const width = opts?.width ?? 1200
  const height = opts?.height ?? 630
  const targetBytes = opts?.targetBytes ?? 180 * 1024
  const startQuality = opts?.startQuality ?? 0.85
  const minQuality = opts?.minQuality ?? 0.4

  const drawable = await toDrawable(source)
  if (!drawable) return null

  let canvas: HTMLCanvasElement
  try {
    canvas = document.createElement('canvas')
  } catch {
    return null
  }
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const { sx, sy, sw, sh } = computeCoverRect(drawable.w, drawable.h, width, height)
  try {
    ctx.drawImage(drawable.img, sx, sy, sw, sh, 0, 0, width, height)
  } catch {
    // クロスオリジン汚染など (ユーザー自身の画像では通常起きない)
    return null
  }

  return canvasToJpegUnderTarget(canvas, targetBytes, startQuality, minQuality)
}
