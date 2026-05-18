// extension/pinterest.js
// Auto-save to AllMarks when the user "Save"s a Pinterest pin. Scoped to
// the pin detail page (/pin/{pinId}/). The home feed exposes the same
// button on hover cards, but resolving each pin's permalink from the feed
// is fragile — out of MVP scope. Pinterest opens a board-picker popover
// after the Save click; we extract the URL at click time, before the
// popover swap, so dedupe + extraction stay stable.

const DEDUPE_WINDOW_MS = 5000
const recentlySent = new Map()

// Extension reloads invalidate this script's chrome.* handle; touching
// chrome.runtime.sendMessage afterwards throws synchronously, which the
// .catch() below can't trap. Probe chrome.runtime.id first — it's undefined
// in an invalidated context — and wrap the call in try/catch for races.
function isExtensionAlive() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id) } catch (_) { return false }
}

function pruneRecent(now) {
  for (const [k, t] of recentlySent) {
    if (now - t > DEDUPE_WINDOW_MS) recentlySent.delete(k)
  }
}

function readMeta(selector) {
  const e = document.querySelector(selector)
  return e ? e.getAttribute('content') || '' : ''
}

function extractPostUrl() {
  // Prefer canonical og:url when present; verify shape before trust.
  // Pinterest sets it on pin detail pages.
  const ogUrl = readMeta('meta[property="og:url"]')
  if (ogUrl && /^https?:\/\/(?:[a-z]+\.)?pinterest\.[a-z.]+\/pin\/[^/]+/.test(ogUrl)) {
    return ogUrl
  }
  // Fallback: pathname /pin/{pinId}/ on whichever locale host we're on.
  const m = location.pathname.match(/^\/pin\/([^/]+)/)
  if (!m) return null
  return 'https://www.pinterest.com/pin/' + m[1] + '/'
}

function extractPostOgp(url) {
  const title = readMeta('meta[property="og:title"]') || document.title || url
  const description = (
    readMeta('meta[property="og:description"]') || readMeta('meta[name="description"]') || ''
  ).slice(0, 200)
  const image = readMeta('meta[property="og:image"]') || ''
  return {
    url,
    title,
    description,
    image,
    favicon: 'https://www.pinterest.com/favicon.ico',
    siteName: 'Pinterest',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  const btn = target.closest('button, [role="button"]')
  if (!btn) return null
  // Pinterest exposes a stable data-test-id on the primary Save button on
  // pin detail pages. Prefer it over fragile aria-label matching when
  // available; fall back to aria-label for older / locale variants.
  const testId = btn.getAttribute('data-test-id') || ''
  if (/pin-action-save|pinSaveButton|save-button/.test(testId)) return 'save'
  const label = (btn.getAttribute('aria-label') || '').toLowerCase()
  if (!label) return null
  // Pinterest doesn't expose an OFF state on Save the way Like/Repost
  // sites do — the button stays "Saved" but doesn't re-fire. Still guard
  // against locale OFF stems just in case.
  if (/\bunsave\b/.test(label) || /取り消|取消|취소/.test(label)) return null
  // ON action — Save in en, 保存 in ja, 저장 in ko, 保存 in zh (= same as ja).
  if (/\bsave\b/.test(label) || /保存/.test(label) || /저장/.test(label)) return 'save'
  return null
}

document.addEventListener('click', (event) => {
  const kind = getButtonKind(event.target)
  if (!kind) return
  const url = extractPostUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractPostOgp(url)
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: 'pinterest-save',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
