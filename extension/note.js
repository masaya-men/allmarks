// extension/note.js
// Auto-save to AllMarks when the user "スキ" (= note's like equivalent) a note article.
// Hooked: button whose aria-label or text contains "スキ".
// Like other site scripts, we don't try to distinguish ON vs OFF — the 5s dedupe
// + downstream skipIfDuplicate make a quick toggle harmless.

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
const SETTING_DEFAULTS = { autoSaveNoteLike: true }
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
function isNoteLikeEnabled() {
  return settingsCache.autoSaveNoteLike !== false
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

function extractArticleUrl() {
  // note article URLs are /{username}/n/{noteId} (= note short id).
  // Magazine / membership pages have other shapes; we skip them.
  const m = location.pathname.match(/^\/[^/]+\/n\/[a-zA-Z0-9]+/)
  if (!m) return null
  return location.origin + location.pathname
}

function extractArticleOgp(url) {
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
    favicon: 'https://note.com/favicon.ico',
    siteName: 'note',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Tag-agnostic match — note's React app is <button> today but newer
  // surfaces sometimes ship <div role="button"> / <a role="button">.
  // Hardened in session 58 alongside the YouTube selector audit.
  const btn = target.closest('button, [role="button"], a[role="button"]')
  if (!btn) return null
  // Skip the "スキ count" button (o-noteLikeV3__count) — that opens a list
  // of users who liked, not the like toggle itself. Its aria-label also
  // contains "スキ" so naive matching false-positives here.
  const clsList = btn.classList
  if (clsList && clsList.contains('o-noteLikeV3__count')) return null
  // note's actual スキ toggle exposes aria-pressed for ON/OFF state.
  // This is language-neutral — no need for localised OFF stems.
  // - aria-pressed="false" + aria-label="スキ"            → ON click
  // - aria-pressed="true"  + aria-label="スキを取り消す"  → OFF click
  const pressed = btn.getAttribute('aria-pressed')
  if (pressed === 'true') return null  // OFF action, skip
  // Identify the like toggle by either:
  //   - the stable class o-noteLikeV3__iconButton, or
  //   - "スキ" substring in aria-label (= covers older layouts without the class)
  if (clsList && clsList.contains('o-noteLikeV3__iconButton')) return 'like'
  const label = btn.getAttribute('aria-label') || ''
  if (label.includes('スキ')) return 'like'
  return null
}

document.addEventListener('click', (event) => {
  const kind = getButtonKind(event.target)
  if (!kind) return
  // Bail out before pill / DOM walks if the user toggled this source OFF.
  if (!isNoteLikeEnabled()) return
  const url = extractArticleUrl()
  if (!url) return
  // Mirror defense — see youtube.js for rationale.
  if (isUrlAlreadySaved(url)) {
    try { window.postMessage({ source: 'booklage-extension', type: 'pill-duplicate' }, '*') } catch (_) {}
    return
  }
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractArticleOgp(url)
  if (!isExtensionAlive()) return
  // Fire the pill immediately via same-window postMessage so content.js
  // can show "Saving" within ~10ms instead of waiting for the background
  // round-trip (~100-300ms). content.js falls back to a stuck-saving
  // timeout if no final state (saved/error) follows.
  try { window.postMessage({ source: 'booklage-extension', type: 'pill-saving' }, '*') } catch (_) {}
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: 'note-like',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
