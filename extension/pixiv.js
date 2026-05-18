// extension/pixiv.js
// Auto-save to AllMarks when the user likes or bookmarks a Pixiv artwork.
// Hooked: buttons whose aria-label matches the locale strings for "like" /
// "bookmark". Pixiv is a React SPA and exposes few stable test attributes, so
// aria-label is the most durable hook across UI revisions and locales.
//
// We scope to /artworks/{id} (the artwork detail page). Listing thumbnails
// have their own bookmark hearts but the URL extraction would have to walk up
// to the card, which is brittle — out of scope for now.

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

function extractArtworkUrl() {
  // Detail URL: /artworks/{id} or /{lang}/artworks/{id} (e.g. /en/artworks/123).
  const m = location.pathname.match(/^\/(?:[a-z]{2}\/)?artworks\/(\d+)/)
  if (!m) return null
  return 'https://www.pixiv.net/artworks/' + m[1]
}

function extractArtworkOgp(url) {
  const m = (s) => {
    const e = document.querySelector(s)
    return e ? e.getAttribute('content') || '' : ''
  }
  const title = m('meta[property="og:title"]') || document.title || url
  const description = (
    m('meta[property="og:description"]') || m('meta[name="description"]') || ''
  ).slice(0, 200)
  const image = m('meta[property="og:image"]') || ''
  return {
    url,
    title,
    description,
    image,
    favicon: 'https://www.pixiv.net/favicon.ico',
    siteName: 'Pixiv',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  const btn = target.closest('button')
  if (!btn) return null
  const label = btn.getAttribute('aria-label') || ''
  // Pixiv switches aria-label by locale (ja / en / zh / ko / ...) so we match
  // common stems rather than full strings.
  if (/ブックマーク|bookmark|북마크|收藏/i.test(label)) return 'bookmark'
  if (/いいね|like\b|좋아|^赞|喜欢/i.test(label)) return 'like'
  return null
}

document.addEventListener('click', (event) => {
  const kind = getButtonKind(event.target)
  if (!kind) return
  const url = extractArtworkUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractArtworkOgp(url)
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: kind === 'bookmark' ? 'pixiv-bookmark' : 'pixiv-like',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
