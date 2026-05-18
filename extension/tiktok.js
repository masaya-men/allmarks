// extension/tiktok.js
// Auto-save to AllMarks when the user likes or favorites a TikTok video.
// Hooked: data-e2e="*like-icon" (= turning ON) / data-e2e="*favorite-icon".
// TikTok exposes stable data-e2e attributes for QA tests, which we piggyback
// on rather than depending on volatile CSS class names.

const DEDUPE_WINDOW_MS = 5000
const recentlySent = new Map()

function pruneRecent(now) {
  for (const [k, t] of recentlySent) {
    if (now - t > DEDUPE_WINDOW_MS) recentlySent.delete(k)
  }
}

function findVideoUrl() {
  // Detail page: /@handle/video/{id}
  const m = location.pathname.match(/^\/(@[^/]+)\/video\/(\d+)/)
  if (m) {
    return 'https://www.tiktok.com' + location.pathname
  }
  // Feed pages (/, /foryou, /following) — TikTok keeps the currently-focused
  // video card around with a stable wrapper. We pick the one whose
  // <a href="/@handle/video/{id}"> link is closest to the viewport center.
  const links = Array.from(
    document.querySelectorAll('a[href*="/video/"]'),
  )
  if (links.length === 0) return null
  const viewportCenter = window.innerHeight / 2
  let best = null
  let bestDist = Infinity
  for (const a of links) {
    const rect = a.getBoundingClientRect()
    if (rect.height === 0) continue
    const cardCenter = (rect.top + rect.bottom) / 2
    const dist = Math.abs(cardCenter - viewportCenter)
    if (dist < bestDist) {
      bestDist = dist
      best = a
    }
  }
  if (!best) return null
  const href = best.getAttribute('href')
  if (!href) return null
  const abs = new URL(href, location.origin).href
  if (!/\/video\/\d+/.test(abs)) return null
  return abs
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Like — TikTok uses several data-e2e variants depending on surface:
  //   browse-like-icon (= detail page), like-icon (= card overlay),
  //   feed-like-icon (= feed view), browser-mode-like-icon.
  if (
    target.closest('[data-e2e="browse-like-icon"]') ||
    target.closest('[data-e2e="like-icon"]') ||
    target.closest('[data-e2e="feed-like-icon"]') ||
    target.closest('[data-e2e="browser-mode-like-icon"]')
  ) {
    return 'like'
  }
  // Favorite (= TikTok's bookmark equivalent): browse-favorite-icon /
  // favorite-icon / feed-favorite-icon / browser-mode-favorite-icon.
  if (
    target.closest('[data-e2e="browse-favorite-icon"]') ||
    target.closest('[data-e2e="favorite-icon"]') ||
    target.closest('[data-e2e="feed-favorite-icon"]') ||
    target.closest('[data-e2e="browser-mode-favorite-icon"]')
  ) {
    return 'favorite'
  }
  return null
}

function extractOgp(url) {
  const m = (s) => {
    const e = document.querySelector(s)
    return e ? e.getAttribute('content') || '' : ''
  }
  const title = m('meta[property="og:title"]') || document.title || url
  const description = (
    m('meta[property="og:description"]') || m('meta[name="description"]') || ''
  ).slice(0, 200)
  // TikTok normally has og:image on detail pages; on feed pages we may be on
  // a generic listing page so og:image points to the channel/site image.
  // The dispatch layer will refetch and prefer the URL-specific OGP if this
  // turns out to be generic.
  const image = m('meta[property="og:image"]') || ''
  return {
    url,
    title,
    description,
    image,
    favicon: 'https://www.tiktok.com/favicon.ico',
    siteName: 'TikTok',
  }
}

document.addEventListener('click', (event) => {
  const kind = getButtonKind(event.target)
  if (!kind) return
  const url = findVideoUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractOgp(url)
  chrome.runtime.sendMessage({
    type: 'booklage:auto-save',
    source: kind === 'like' ? 'tiktok-like' : 'tiktok-favorite',
    ogp,
  }).catch(() => {})
}, true)
