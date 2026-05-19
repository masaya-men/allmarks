// extension/twitter.js
// Auto-save to AllMarks when the user likes or bookmarks a tweet.
// Hooked: data-testid="like" / data-testid="bookmark" (= turning ON).
// Not hooked: data-testid="unlike" / "removeBookmark" (= undoing).

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

function findTweetArticle(el) {
  return el && el.closest ? el.closest('article[data-testid="tweet"]') : null
}

function extractTweetUrl(article) {
  // The timestamp <time> sits inside an <a href="/{handle}/status/{id}"> that
  // uniquely identifies the tweet. There are other status links (quoted, replies),
  // so we pin to the one wrapping <time>.
  const timeEl = article.querySelector('a[href*="/status/"] time')
  const link = timeEl ? timeEl.closest('a') : null
  if (!link) return null
  const href = link.getAttribute('href')
  if (!href) return null
  return new URL(href, location.origin).href
}

function extractTweetOgp(article, url) {
  const textEl = article.querySelector('[data-testid="tweetText"]')
  const text = (textEl && textEl.innerText ? textEl.innerText : '').trim()
  const userNameEl = article.querySelector('[data-testid="User-Name"]')
  const userNameRaw = userNameEl && userNameEl.innerText ? userNameEl.innerText : ''
  const userName = userNameRaw.split('\n')[0].trim()
  // Image priority for aspect-correct card layout:
  //   1) media image (静止画 tweet)
  //   2) video[poster] (= 縦動画ふくむ動画 tweet。 ここを抜くと横デフォになる)
  //   3) amplify_video / ext_tw_video_thumb の img (たまに ある)
  let image = ''
  const mediaImg = article.querySelector('img[src*="pbs.twimg.com/media"]')
  if (mediaImg) image = mediaImg.getAttribute('src') || ''
  if (!image) {
    const videoEl = article.querySelector('video[poster]')
    if (videoEl) image = videoEl.getAttribute('poster') || ''
  }
  if (!image) {
    const ampImg = article.querySelector('img[src*="amplify_video_thumb"], img[src*="ext_tw_video_thumb"]')
    if (ampImg) image = ampImg.getAttribute('src') || ''
  }
  // Session 52 (B-#22 follow-up): save the full tweet body in title so the
  // board card scroll surfaces the entire content. The "userName: " prefix
  // is stripped at render time by `cleanTitle` (lib/embed/clean-title.ts)
  // for X URLs, so the user-visible title is the raw body. For existing
  // bookmarks saved before this change, the syndication backfill
  // (lib/board/tweet-backfill.ts → persistTitle) upgrades the truncated
  // title to the full text after the first meta fetch.
  const title = userName && text ? userName + ': ' + text : (text || userName || url)
  return {
    url,
    title,
    description: text.slice(0, 200),
    image,
    favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
    siteName: 'X',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Tag-agnostic match — X's like button is a <button> today but the
  // surrounding A/B layouts and userscripts in the wild use plain
  // [data-testid="like"] for resilience against div role=button rewrites.
  // OFF actions ("unlike" / "removeBookmark") have different testids and
  // are intentionally not captured here.
  if (target.closest('[data-testid="like"]')) return 'like'
  if (target.closest('[data-testid="bookmark"]')) return 'bookmark'
  return null
}

document.addEventListener('click', (event) => {
  const kind = getButtonKind(event.target)
  if (!kind) return
  const article = findTweetArticle(event.target)
  if (!article) return
  const url = extractTweetUrl(article)
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractTweetOgp(article, url)
  if (!isExtensionAlive()) return
  // Fire the pill immediately via same-window postMessage so content.js
  // can show "Saving" within ~10ms instead of waiting for the background
  // round-trip (~100-300ms). content.js falls back to a stuck-saving
  // timeout if no final state (saved/error) follows.
  try { window.postMessage({ source: 'booklage-extension', type: 'pill-saving' }, '*') } catch (_) {}
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: kind === 'like' ? 'x-like' : 'x-bookmark',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
