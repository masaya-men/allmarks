// extension/threads.js
// Auto-save to AllMarks when the user "Like"s a Threads post. Scoped to
// the post detail page (/@{user}/post/{postId}). Meta runs Threads on both
// threads.com and threads.net, with and without www; the manifest matches
// all four hosts.

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
  // og:url is canonical when Meta serves it; verify shape before trust.
  const ogUrl = readMeta('meta[property="og:url"]')
  if (ogUrl && /^https?:\/\/(?:www\.)?threads\.(?:com|net)\/@[^/]+\/post\/[^/]+/.test(ogUrl)) {
    return ogUrl
  }
  // Fallback: pathname /@{user}/post/{postId} on whichever host we're on.
  const m = location.pathname.match(/^\/@([^/]+)\/post\/([^/]+)/)
  if (!m) return null
  return location.origin + '/@' + m[1] + '/post/' + m[2]
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
    favicon: 'https://www.threads.com/favicon.ico',
    siteName: 'Threads',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  const btn = target.closest('button, [role="button"]')
  if (!btn) return null
  const label = (btn.getAttribute('aria-label') || '').toLowerCase()
  if (!label) return null
  // Skip OFF actions — locale variants of "Unlike" / "いいねを取り消す".
  if (/\bunlike\b/.test(label)) return null
  if (/取り消|取消|취소/.test(label)) return null
  // Like (turn ON). Pixiv-style locale stems — Meta localises Threads
  // aria-labels just like Pixiv does.
  if (/\blike\b/.test(label) || /いいね/.test(label) || /좋아/.test(label) || /喜欢|赞/.test(label)) return 'like'
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
      source: 'threads-like',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
