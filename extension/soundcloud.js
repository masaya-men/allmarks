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

// Extension reloads invalidate this script's chrome.* handle; touching
// chrome.runtime.sendMessage afterwards throws synchronously, which the
// .catch() below can't trap. Probe chrome.runtime.id first — it's undefined
// in an invalidated context — and wrap the call in try/catch for races.
function isExtensionAlive() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id) } catch (_) { return false }
}

// Auto-save settings cache. See twitter.js for the rationale.
const SETTING_DEFAULTS = { autoSaveSoundCloudLike: true }
const settingsCache = { ...SETTING_DEFAULTS }
if (isExtensionAlive()) {
  try {
    chrome.storage.sync.get(SETTING_DEFAULTS).then((stored) => {
      Object.assign(settingsCache, stored)
    }).catch(() => {})
  } catch (_) {}
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return
      for (const k of Object.keys(SETTING_DEFAULTS)) {
        if (changes[k]) settingsCache[k] = changes[k].newValue
      }
    })
  } catch (_) {}
}
function isSoundCloudLikeEnabled() {
  return settingsCache.autoSaveSoundCloudLike !== false
}

function pruneRecent(now) {
  for (const [k, t] of recentlySent) {
    if (now - t > DEDUPE_WINDOW_MS) recentlySent.delete(k)
  }
}

// === Mirror snapshot — sync-readable cache of "URLs already in AllMarks".
// Source of truth: chrome.storage.local key `savedUrlsMirror`. Suppress
// auto-save when URL is already saved. See youtube.js for the rationale.
const savedUrlMirror = new Set()
function refreshMirrorSnapshot(mirror) {
  savedUrlMirror.clear()
  if (!mirror) return
  for (const k of Object.keys(mirror)) savedUrlMirror.add(k)
}
if (isExtensionAlive()) {
  try {
    chrome.storage.local.get({ savedUrlsMirror: {} }).then((stored) => {
      refreshMirrorSnapshot(stored.savedUrlsMirror)
    }).catch(() => {})
  } catch (_) {}
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.savedUrlsMirror) return
      refreshMirrorSnapshot(changes.savedUrlsMirror.newValue)
    })
  } catch (_) {}
}
function isUrlAlreadySaved(url) {
  return savedUrlMirror.has(url)
}

function readMeta(selector) {
  const e = document.querySelector(selector)
  return e ? e.getAttribute('content') || '' : ''
}

// Resolve a saveable URL from a SoundCloud Like click. The user's intent
// is "this song is good, save it" — but only if it can be played back
// later. Personalised discover URLs can't be reproduced, so we exclude
// them (= user reconfirmed this in session 49 round 2).
//
// Surfaces supported:
//   - mini-player          → resolve via .playbackSoundBadge__titleLink
//   - track detail         /{user}/{slug}
//   - regular playlist     /{user}/sets/{slug}
//   - artist profile       /{user}
//
// Excluded:
//   - /discover/*  (= personalised, URL won't reproduce same content later)
//   - /feed /upload /charts /pages /settings /imprint /jobs /mobile (= system)
//   - /you/*       (= user's own library)
function extractTrackUrl(btn) {
  // Case A: mini-player Like (= bottom persistent badge). Always resolve
  // via the badge's title link, independent of page URL.
  if (btn && btn.closest && btn.closest('.playbackSoundBadge')) {
    const titleLink = document.querySelector('.playbackSoundBadge__titleLink')
    const href = titleLink && titleLink.getAttribute('href')
    if (!href) return null
    return 'https://soundcloud.com' + href.split('?')[0].split('#')[0].replace(/\/$/, '')
  }
  // Case B: page-level Like — save the current location unless it's a
  // bookmark-meaningless or non-reproducible page.
  const p = location.pathname.replace(/\/$/, '')
  const parts = p.split('/').filter(Boolean)
  const first = parts[0] || ''
  if (!first) return null
  // System pages with no meaningful saveable content.
  if (first === 'feed' || first === 'upload' || first === 'charts' || first === 'pages' || first === 'settings' || first === 'imprint' || first === 'jobs' || first === 'mobile') return null
  // /you/* — the user's own library; treat as personal collection.
  if (first.startsWith('you')) return null
  // /discover/* — personalised feeds whose URLs won't replay later.
  if (first === 'discover') return null
  return 'https://soundcloud.com' + p
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
  const btn = event.target && event.target.closest
    ? event.target.closest('button, [role="button"], a[role="button"]')
    : null
  const kind = getButtonKind(event.target)
  if (!kind) return
  // Bail out before pill / DOM walks if the user toggled this source OFF.
  if (!isSoundCloudLikeEnabled()) return
  const url = extractTrackUrl(btn)
  if (!url) return
  // Mirror defense — see youtube.js for rationale.
  if (isUrlAlreadySaved(url)) {
    try {
      console.log('[AllMarks] SoundCloud auto-save suppressed — URL already in mirror', { url, kind })
    } catch (_) {}
    try { window.postMessage({ source: 'booklage-extension', type: 'pill-duplicate' }, '*') } catch (_) {}
    return
  }
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractTrackOgp(url)
  if (!isExtensionAlive()) return
  // Fire the pill immediately via same-window postMessage so content.js
  // can show "Saving" within ~10ms instead of waiting for the background
  // round-trip (~100-300ms). content.js falls back to a stuck-saving
  // timeout if no final state (saved/error) follows.
  try { window.postMessage({ source: 'booklage-extension', type: 'pill-saving' }, '*') } catch (_) {}
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
