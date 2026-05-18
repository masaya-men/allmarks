// extension/reddit.js
// Auto-save to AllMarks when the user upvotes or saves a Reddit post.
// Scoped to the post detail page (/r/{sub}/comments/{id}/{slug}/). Feed
// pages expose the same buttons but resolving each card's permalink from
// the timeline is fragile — out of MVP scope. Comments on the same page
// also have Upvote / Save buttons; we explicitly exclude them by checking
// that the click target is inside <shreddit-post> but not inside
// <shreddit-comment>.

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
  // Reddit sets og:url to the full permalink on post detail pages.
  const ogUrl = readMeta('meta[property="og:url"]')
  if (ogUrl && /^https?:\/\/(?:www\.|new\.)?reddit\.com\/r\/[^/]+\/comments\/[^/]+/.test(ogUrl)) {
    return ogUrl
  }
  // Fallback: pathname /r/{sub}/comments/{id}/{slug}/. Slug is optional in
  // shorter share URLs, so we only require sub + id and rebuild canonical.
  const m = location.pathname.match(/^\/r\/([^/]+)\/comments\/([^/]+)(?:\/([^/]+))?/)
  if (!m) return null
  const base = 'https://www.reddit.com/r/' + m[1] + '/comments/' + m[2]
  return m[3] ? base + '/' + m[3] + '/' : base + '/'
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
    favicon: 'https://www.reddit.com/favicon.ico',
    siteName: 'Reddit',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Reddit Save lives in a kebab menu as role="menuitem"; allow both.
  const btn = target.closest('button, [role="button"], [role="menuitem"]')
  if (!btn) return null
  // Scope: must be inside <shreddit-post> AND NOT inside <shreddit-comment>.
  // The post-detail page renders 1 shreddit-post (the parent) plus many
  // shreddit-comment nodes; without this guard, comment upvotes would also
  // trigger a save against the post's URL.
  if (btn.closest('shreddit-comment')) return null
  if (!btn.closest('shreddit-post')) return null
  const label = (btn.getAttribute('aria-label') || '').toLowerCase()
  if (!label) return null
  // Hard exclude: any downvote (separate from upvote toggle).
  if (/\bdownvote\b/.test(label)) return null
  // Skip OFF actions — "Remove upvote" / "Unsave". The "remove" stem also
  // covers "remove the upvote" phrasings; \b prevents matching mid-word.
  if (/\bremove\b/.test(label)) return null
  if (/\bunsave\b/.test(label)) return null
  // Turn-ON actions.
  if (/\bupvote\b/.test(label)) return 'upvote'
  if (/\bsave\b/.test(label)) return 'save'
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
      source: kind === 'upvote' ? 'reddit-upvote' : 'reddit-save',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
