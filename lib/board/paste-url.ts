import { isValidUrl } from '@/lib/utils/url'

/** Trimmed clipboard text that is EXACTLY one http(s) URL → that URL; else null.
 *  MVP scope: a single URL token only (no extraction from surrounding prose). */
export function extractSinglePastedUrl(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return null
  return isValidUrl(trimmed) ? trimmed : null
}

/** Normalizes clipboard/input/share text into a single http(s) URL, or null.
 *  Same single-token rule as extractSinglePastedUrl, but first prepends
 *  "https://" when no scheme is present so a bare "example.com" is accepted.
 *  Used by the mobile save entries (smart + button, input sheet, Android
 *  share receiver). The desktop global-paste path keeps extractSinglePastedUrl
 *  (no scheme prepend) unchanged. */
export function normalizeToUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return extractSinglePastedUrl(withScheme)
}

/** True when el (or an ancestor) is a text-editable element, so we must NOT
 *  hijack the paste. */
export function isEditableTarget(el: EventTarget | null): boolean {
  let node = el instanceof Node ? el : null
  while (node) {
    if (node instanceof HTMLElement) {
      const tag = node.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true
      const ceValue = node.getAttribute('contenteditable')
      if (ceValue === 'true' || node.isContentEditable) return true
    }
    node = node.parentNode
  }
  return false
}
