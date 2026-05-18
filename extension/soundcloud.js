// extension/soundcloud.js
// Auto-save to AllMarks when the user "Like"s a SoundCloud track on its
// detail page. We don't try to catch Likes pressed via the persistent
// mini-player at the bottom of the page — that would require resolving
// which track is currently playing from DOM state, which is fragile.
//
// Scope: detail URL /{user}/{track-slug} only. Reserved second segments
// (sets, likes, followers, ...) and single-segment user pages are skipped.

const DEDUPE_WINDOW_MS = 5000
const recentlySent = new Map()

// Second-segment values that are SoundCloud surfaces, not track slugs.
const RESERVED_SECOND_SEGMENT = new Set([
  'sets', 'likes', 'followers', 'following', 'tracks', 'reposts',
  'comments', 'popular-tracks', 'albums', 'stations', 'info', 'network',
])

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

function extractTrackUrl() {
  const p = location.pathname.replace(/\/$/, '')
  const parts = p.split('/').filter(Boolean)
  if (parts.length !== 2) return null
  const [user, slug] = parts
  if (!user || !slug) return null
  if (user.startsWith('you') || user === 'discover' || user === 'feed' || user === 'upload' || user === 'charts' || user === 'pages') return null
  if (RESERVED_SECOND_SEGMENT.has(slug)) return null
  return 'https://soundcloud.com/' + user + '/' + slug
}

function extractTrackOgp(url) {
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
    favicon: 'https://soundcloud.com/favicon.ico',
    siteName: 'SoundCloud',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Tag-agnostic match — SoundCloud uses <button> on most surfaces but
  // some current chrome wraps the Like action in <div role="button">.
  // Limiting to <button> made session 49's user verification fail.
  // Same pattern as twitter.js / vimeo.js post-fix.
  const btn = target.closest('button, [role="button"]')
  if (!btn) return null
  const label = (btn.getAttribute('aria-label') || '').toLowerCase()
  const title = (btn.getAttribute('title') || '').toLowerCase()
  const cls = (btn.className || '').toString().toLowerCase()
  if (/\blike\b/.test(label) || /\blike\b/.test(title) || /sc-button-like/.test(cls)) {
    return 'like'
  }
  return null
}

document.addEventListener('click', (event) => {
  const kind = getButtonKind(event.target)
  if (!kind) return
  const url = extractTrackUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractTrackOgp(url)
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: 'soundcloud-like',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
