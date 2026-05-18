// extension/bluesky.js
// Auto-save to AllMarks when the user "Like"s or "Repost"s a Bluesky post.
// Scoped to the post detail page (/profile/{handle}/post/{postId}). The feed
// exposes the same buttons, but resolving each card's permalink from a click
// inside the timeline is fragile — out of MVP scope.

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
  // Prefer canonical og:url when present; verify the shape before trusting.
  // Bluesky sets it on post detail pages.
  const ogUrl = readMeta('meta[property="og:url"]')
  if (ogUrl && /^https?:\/\/bsky\.app\/profile\/[^/]+\/post\/[^/]+/.test(ogUrl)) {
    return ogUrl
  }
  // Fallback: pathname /profile/{handle}/post/{postId}. Handle can be either
  // a domain-style handle (foo.bsky.social) or a DID (did:plc:xxx); both are
  // covered by [^/]+ since DIDs contain colons but no slashes.
  const m = location.pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)/)
  if (!m) return null
  return 'https://bsky.app/profile/' + m[1] + '/post/' + m[2]
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
    favicon: 'https://bsky.app/favicon.ico',
    siteName: 'Bluesky',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  const btn = target.closest('button, [role="button"]')
  if (!btn) return null
  const label = (btn.getAttribute('aria-label') || '').toLowerCase()
  if (!label) return null
  // Skip OFF actions across locales — "Unlike" / "Undo repost" /
  // "取り消" (ja) / "취소" (ko). \b prevents Like from matching inside Unlike.
  if (/\bunlike\b/.test(label) || /\bundo\b/.test(label)) return null
  if (/取り消|取消|취소/.test(label)) return null
  // Like (turn ON). Bluesky uses "Like (count)" in English and locale stems
  // in others; substring match on the stem is OK.
  if (/\blike\b/.test(label) || /いいね/.test(label) || /좋아/.test(label)) return 'like'
  // Repost (turn ON). English label is "Repost" or "Reposts (count)".
  if (/\brepost(s)?\b/.test(label) || /リポスト/.test(label)) return 'repost'
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
      source: kind === 'like' ? 'bluesky-like' : 'bluesky-repost',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
