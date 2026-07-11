// lib/share/uniform-image.ts
// iOS Safari は dom-to-image (SVG foreignObject) の描画に失敗しても「真っ白な
// 正常サイズの画像」を返すことがある。その場合パイプラインは全段成功に見えるので、
// 出力がほぼ一様色なら失敗として扱えるようにする検出器。
//
// 判定は保守的に: canvas が使えない・読めない環境では「一様ではない」(false) を
// 返し、撮影を殺さない。誤検出で本物の画像を捨てるより、見逃す方がまし。

/** RGBA 画素列が「ほぼ一様色」なら true。tolerance は先頭画素との各チャンネル許容差。 */
export function isUniformSample(data: Uint8ClampedArray, tolerance = 6): boolean {
  if (data.length < 8) return true
  const r0 = data[0]
  const g0 = data[1]
  const b0 = data[2]
  for (let i = 4; i < data.length; i += 4) {
    if (
      Math.abs(data[i] - r0) > tolerance ||
      Math.abs(data[i + 1] - g0) > tolerance ||
      Math.abs(data[i + 2] - b0) > tolerance
    ) {
      return false
    }
  }
  return true
}

/** 画像を 32×32 に縮小描画してサンプルし、ほぼ一様色かを判定する。 */
export function isUniformImage(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const ctx = c.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, 32, 32)
    return isUniformSample(ctx.getImageData(0, 0, 32, 32).data)
  } catch {
    return false
  }
}
