// Pure helper: derive the download filename for a saved share image.
// The image is whatever the share flow already produced (JPEG from
// dom-to-image, or WebP from the legacy canvas fallback), so the extension
// is taken from the data-URL MIME prefix rather than assumed.

/** Filename for the user-downloaded share image, e.g. `allmarks-aB3x9.jpg`.
 *  Extension follows the data-URL MIME (jpg/webp/png); id is sanitised to a
 *  filesystem-safe slug. */
export function shareImageFilename(id: string, dataUrl: string): string {
  const ext = extensionFromDataUrl(dataUrl)
  const slug = id.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'board'
  return `allmarks-${slug}.${ext}`
}

function extensionFromDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith('data:image/webp')) return 'webp'
  if (dataUrl.startsWith('data:image/png')) return 'png'
  return 'jpg'
}
