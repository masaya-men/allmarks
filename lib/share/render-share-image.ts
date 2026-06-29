// Renders a DOM node to a JPEG data URL under a byte budget via dom-to-image-more.
// dom-to-image is loaded lazily (it ships a wasm-free but sizeable bundle; only
// the share flow needs it). Returns null on any failure so the caller can fall
// back to the legacy canvas draw — sharing must never break.

export type RenderShareImageOpts = {
  readonly width: number
  readonly height: number
  readonly targetBytes: number
  readonly startQuality: number
  readonly minQuality: number
}

/** Pure: pick the first quality whose encoded size fits, else the smallest.
 *  `encode(q)` returns the dataURL at quality q (async). Exported for testing. */
export async function jpegUnderTarget(
  encode: (quality: number) => Promise<string | null>,
  targetBytes: number,
  startQuality: number,
  minQuality: number,
): Promise<string | null> {
  const STEP = 0.1
  let q = startQuality
  let last: string | null = null
  while (q >= minQuality - 1e-9) {
    const url = await encode(q)
    if (!url) return last
    last = url
    if (dataUrlBytes(url) <= targetBytes) return url
    q -= STEP
  }
  return last
}

function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - pad
}

export async function renderShareImage(node: HTMLElement, opts: RenderShareImageOpts): Promise<string | null> {
  try {
    const mod = await import('dom-to-image-more')
    const domtoimage = (mod as { default?: unknown }).default ?? mod
    const toJpeg = (domtoimage as { toJpeg: (n: HTMLElement, o: Record<string, unknown>) => Promise<string> }).toJpeg
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready
    return await jpegUnderTarget(
      (quality) => toJpeg(node, { width: opts.width, height: opts.height, quality, cacheBust: true }).catch(() => null),
      opts.targetBytes, opts.startQuality, opts.minQuality,
    )
  } catch {
    return null
  }
}
