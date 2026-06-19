import { isValidUrl } from '@/lib/utils/url'

/** Trimmed clipboard text that is EXACTLY one http(s) URL → that URL; else null.
 *  MVP scope: a single URL token only (no extraction from surrounding prose). */
export function extractSinglePastedUrl(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return null
  return isValidUrl(trimmed) ? trimmed : null
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
