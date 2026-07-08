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
  /** Solid fill for the clone root + any transparent area (JPEG has no alpha,
   *  so gaps between cards would otherwise flatten to black). Pass the board's
   *  bg color so the captured collage sits on the same backdrop the user sees. */
  readonly bgColor?: string
  /** Rewrite each cloned <img> src before dom-to-image inlines it (called with
   *  the clone's current src; return the src to fetch). Used to route
   *  cross-origin thumbnails through the same-origin /api/img proxy so their
   *  bytes read without CORS taint. When set, cacheBust is disabled (the proxy
   *  is same-origin, so the CORS-cache workaround cacheBust exists for is moot,
   *  and a stable URL lets the CF edge cache hit). */
  readonly rewriteImageSrc?: (src: string) => string
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

/** Renders a DOM node to a JPEG data URL <= targetBytes via dom-to-image-more, or null on any failure (caller falls back to the legacy canvas). */
export async function renderShareImage(node: HTMLElement, opts: RenderShareImageOpts): Promise<string | null> {
  try {
    const mod = await import('dom-to-image-more')
    const domtoimage = (mod as { default?: unknown }).default ?? mod
    const toJpeg = (domtoimage as { toJpeg: (n: HTMLElement, o: Record<string, unknown>) => Promise<string> }).toJpeg
    if (typeof toJpeg !== 'function') return null
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready

    // dom-to-image-more clones the node, then for each cloned <img> reads its
    // src attribute and XHR-fetches it to inline as a data URL. We hook
    // adjustClonedNode (called per node, before children) to rewrite the CLONE's
    // img src to the same-origin proxy — the live DOM is never touched (no flash,
    // no React reconciliation fight), and the subsequent inline XHR is same-origin
    // so it can't taint the canvas.
    const rewrite = opts.rewriteImageSrc
    const baseOpts: Record<string, unknown> = {
      width: opts.width,
      height: opts.height,
      cacheBust: rewrite == null,
    }
    if (opts.bgColor) baseOpts.bgcolor = opts.bgColor
    if (rewrite) {
      baseOpts.adjustClonedNode = (
        _original: Node,
        clone: Node,
        after: boolean,
      ): void => {
        if (after) return
        if (clone instanceof HTMLImageElement) {
          const src = clone.getAttribute('src')
          if (src) clone.setAttribute('src', rewrite(src))
        }
      }
    }

    return await jpegUnderTarget(
      (quality) => toJpeg(node, { ...baseOpts, quality }).catch(() => null),
      opts.targetBytes, opts.startQuality, opts.minQuality,
    )
  } catch {
    return null
  }
}
