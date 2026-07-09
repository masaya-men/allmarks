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
 *  A schemeless token is only treated as a domain (and gets the scheme
 *  prepended) when it contains a "." — a bare word like "hello" has no dot,
 *  so it is not a domain and normalizeToUrl returns null (falls through to
 *  the input sheet instead of saving a bogus single-label-host URL). A token
 *  that already has an explicit http(s):// scheme is trusted as-is, dot or
 *  not. Used by the mobile save entries (smart + button, input sheet,
 *  Android share receiver). The desktop global-paste path keeps
 *  extractSinglePastedUrl (no scheme prepend) unchanged. */
export function normalizeToUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return null
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (!hasScheme && !trimmed.includes('.')) return null
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`
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
