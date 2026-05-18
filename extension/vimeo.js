// extension/vimeo.js
// Auto-save to AllMarks when the user "Like"s or adds a Vimeo video to
// "Watch Later". Hooked: buttons whose aria-label matches the corresponding
// English strings. Vimeo localises some surfaces but the player chrome
// stays English for aria-labels in practice.
//
// We canonicalise the URL via og:url (Vimeo always sets it) and fall back
// to a strict pathname match — bare /{id}, /channels/{ch}/{id},
// /groups/{g}/videos/{id}, /showcase/{s}/video/{id}. Creator dashboards
// (/manage/...) and review links (/{user}/review/...) are intentionally
// excluded.

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

function extractVideoUrl() {
  // Prefer canonical og:url when present — Vimeo sets it on every watch
  // page and it's stable across embedded surfaces.
  const ogUrl = readMeta('meta[property="og:url"]')
  if (ogUrl && /^https?:\/\/vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/[^/]+\/video\/)?\d+/.test(ogUrl)) {
    return ogUrl
  }
  // Fallback: derive from pathname. We only accept shapes that map to a
  // single watch page; manage / review pages are skipped.
  const p = location.pathname
  if (/^\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  if (/^\/channels\/[^/]+\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  if (/^\/groups\/[^/]+\/videos\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  if (/^\/showcase\/[^/]+\/video\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  return null
}

function extractVideoOgp(url) {
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
    favicon: 'https://vimeo.com/favicon.ico',
    siteName: 'Vimeo',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  const btn = target.closest('button')
  if (!btn) return null
  const label = (btn.getAttribute('aria-label') || '').toLowerCase()
  const title = (btn.getAttribute('title') || '').toLowerCase()
  const hay = label + ' ' + title
  // Watch Later first — "add to watch later" contains the substring
  // "later", which Like does not, avoiding a Like false positive.
  if (/watch\s*later/.test(hay)) return 'watch-later'
  if (/(^|\s)like(\s|$|\sthis|\sit)/.test(hay) || /\blike this video\b/.test(hay)) return 'like'
  return null
}

document.addEventListener('click', (event) => {
  const kind = getButtonKind(event.target)
  if (!kind) return
  const url = extractVideoUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractVideoOgp(url)
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: kind === 'watch-later' ? 'vimeo-watch-later' : 'vimeo-like',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
