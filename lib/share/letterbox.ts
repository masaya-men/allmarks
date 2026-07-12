/** N-58 モバイル縦コラージュ: 縦4:5の完成画像を、リンクカード用 1.91:1 の中央へ
 *  レターボックス（ボード色の余白付き）で併産するための幾何と canvas 合成。 */

/** 縦横比を維持して dst 矩形の中に収める中央配置矩形（contain-fit）。 */
export function containFitRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return { x: 0, y: 0, w: 0, h: 0 }
  const scale = Math.min(dstW / srcW, dstH / srcH)
  const w = srcW * scale
  const h = srcH * scale
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = (): void => resolve(img)
      img.onerror = (): void => resolve(null)
      img.src = src
    } catch {
      resolve(null)
    }
  })
}

/** `srcDataUrl` の画像を `bgColor` で塗った `outW×outH` の canvas の中央に contain-fit で
 *  描き、JPEG data URL を返す（縦画像を 1.91:1 リンクカードに併産）。失敗・SSR は null。 */
export async function letterboxImageToAspect(
  srcDataUrl: string,
  outW: number,
  outH: number,
  bgColor: string,
  quality = 0.82,
): Promise<string | null> {
  if (typeof document === 'undefined' || outW <= 0 || outH <= 0) return null
  try {
    const img = await loadImage(srcDataUrl)
    if (!img) return null
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, outW, outH)
    const r = containFitRect(img.naturalWidth || img.width, img.naturalHeight || img.height, outW, outH)
    ctx.drawImage(img, r.x, r.y, r.w, r.h)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null
  }
}
