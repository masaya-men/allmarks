// lib/share/snapshot.ts

export type SnapshotOptions = {
  readonly width: number   // target output width (px)
  readonly quality: number // 0.0-1.0
}

const DEFAULT_OPTS: SnapshotOptions = { width: 600, quality: 0.75 }

/**
 * Capture an HTMLElement's current viewport intersection as a WebP data URL.
 *
 * The element must be visible in the page (= scroll position matters). The
 * snapshot reproduces what the user sees, including any scrolled-out
 * children clipped to the visible bbox.
 *
 * Returns base64 data URL ("data:image/webp;base64,...") or null on error /
 * no element. The caller is responsible for sizing — caller passes the
 * desired width and the routine maintains the source aspect ratio.
 */
export async function captureViewportWebP(
  element: HTMLElement | null,
  options: Partial<SnapshotOptions> = {},
): Promise<string | null> {
  if (!element) return null
  const opts = { ...DEFAULT_OPTS, ...options }
  try {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const scale = opts.width / rect.width
    const { default: domtoimage } = await import('dom-to-image-more')
    const dataUrl = await domtoimage.toJpeg(element, {
      quality: opts.quality,
      width: opts.width,
      height: rect.height * scale,
      style: { transform: `scale(${scale})`, transformOrigin: 'top left' },
    })
    return await jpegToWebP(dataUrl, opts.quality)
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/snapshot] capture failed', e)
    return null
  }
}

async function jpegToWebP(jpegDataUrl: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = (): void => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no 2d context')); return }
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/webp', quality))
    }
    img.onerror = (): void => reject(new Error('image load failed'))
    img.src = jpegDataUrl
  })
}
