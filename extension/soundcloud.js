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
  // Tag-agnostic match — SoundCloud uses <button> on most surfaces but the
  // bottom mini-player sometimes wraps actions in <a role="button">.
  const btn = target.closest('button, [role="button"], a[role="button"]')
  if (!btn) return null
  const cls = (btn.className && btn.className.toString && btn.className.toString()) || ''
  const label = (btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '')
  // Class `sc-button-like` is on every SoundCloud Like button — track
  // detail toolbar AND .playbackSoundBadge bottom mini-player. Stable
  // across all locales (= SoundCloud doesn't localise this class).
  const hasLikeClass = /\bsc-button-like\b/.test(cls)
  // OFF action — when the track is already Liked, SoundCloud adds
  // `sc-button-selected` and flips aria-label to "Unlike" / locale variant.
  // We skip OFF to avoid saving when the user is unliking.
  if (hasLikeClass && /\bsc-button-selected\b/.test(cls)) return null
  if (/\bunlike\b/i.test(label)) return null
  if (/取り消|좋아요\s*취소|取消喜欢|取消讚/i.test(label)) return null
  if (hasLikeClass) return 'like'
  // Fallback for users on logged-in localised SoundCloud where class hint
  // may be missing (rare). Covers ja / en / ko / zh / es / fr / de / pt / it.
  if (
    /\blike\b/i.test(label) ||           // en
    /いいね/.test(label) ||                // ja
    /좋아요|좋아/.test(label) ||            // ko
    /喜欢|喜歡|赞/.test(label) ||          // zh
    /me\s*gusta/i.test(label) ||         // es
    /j['']aime/i.test(label) ||          // fr
    /gefällt\s*mir|liken/i.test(label) || // de
    /gostei|curtir/i.test(label) ||      // pt
    /mi\s*piace/i.test(label)            // it
  ) return 'like'
  return null
}

document.addEventListener('click', (event) => {
  // Temporary debug (session 49 SoundCloud non-detection investigation) —
  // outputs the resolved button's class / aria-label at click time so we
  // can confirm whether our listener is reached and what the actual DOM
  // looks like. user's pasted outerHTML matched our regex; if no log
  // appears here, the listener isn't reached → root cause is elsewhere.
  const btnDbg = event.target && event.target.closest
    ? event.target.closest('button, [role="button"], a[role="button"]')
    : null
  if (btnDbg) {
    const clsDbg = (btnDbg.className && btnDbg.className.toString && btnDbg.className.toString()) || ''
    const labelDbg = (btnDbg.getAttribute('aria-label') || '') + ' / ' + (btnDbg.getAttribute('title') || '')
    if (/like|heart|いいね|좋아|喜欢|sc-button/i.test(clsDbg + ' ' + labelDbg)) {
      console.log('[allmarks-sc]', {
        cls: clsDbg.slice(0, 140),
        label: labelDbg.slice(0, 80),
      })
    }
  }
  const kind = getButtonKind(event.target)
  if (!kind) {
    if (btnDbg && /sc-button-like/.test((btnDbg.className && btnDbg.className.toString && btnDbg.className.toString()) || '')) {
      console.log('[allmarks-sc] sc-button-like MATCHED but getButtonKind returned null — selected state?')
    }
    return
  }
  console.log('[allmarks-sc] DETECTED kind=', kind)
  const url = extractTrackUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractTrackOgp(url)
  if (!isExtensionAlive()) {
    console.log('[allmarks-sc] sendMessage SKIPPED — extension context dead, reload tab')
    return
  }
  console.log('[allmarks-sc] sendMessage url=', url)
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: 'soundcloud-like',
      ogp,
    }).catch((err) => console.log('[allmarks-sc] sendMessage failed:', err && err.message))
  } catch (e) {
    console.log('[allmarks-sc] sendMessage threw:', e && e.message)
  }
}, true)
