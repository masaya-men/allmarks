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

function pruneRecent(now) {
  for (const [k, t] of recentlySent) {
    if (now - t > DEDUPE_WINDOW_MS) recentlySent.delete(k)
  }
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
  const btn = target.closest('button')
  if (!btn) return null
  // note's スキ button doesn't expose a stable data-testid; we match by either
  // aria-label or visible text. Both forms appear depending on locale and
  // surface (article footer vs. inline reaction widget).
  const label = btn.getAttribute('aria-label') || ''
  const text = (btn.innerText || btn.textContent || '').trim()
  if (label.includes('スキ') || /^スキ(\s|$)/.test(text)) return 'like'
  return null
}

// Temporary diagnostic — dumps the clicked button + 2 ancestors so we can
// find whether note's スキ button has a language-neutral ON/OFF state
// signal (the file's existing comment says "no distinction needed, dedupe
// covers it", but user wants OFF strictly skipped if possible).
function dumpAttrs(el) {
  if (!el || !el.attributes) return null
  const out = {}
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i]
    out[a.name] = a.value && a.value.length > 100 ? a.value.slice(0, 100) + '…' : a.value
  }
  return out
}

document.addEventListener('click', (event) => {
  const btnDbg = event.target && event.target.closest
    ? event.target.closest('button, [role="button"], a[role="button"]')
    : null
  if (btnDbg) {
    const text = (btnDbg.innerText || btnDbg.textContent || '')
    const labelDbg = btnDbg.getAttribute('aria-label') || ''
    if (text.includes('スキ') || labelDbg.includes('スキ') || /like/i.test(labelDbg + ' ' + text)) {
      // JSON.stringify so Chrome's deferred-eval doesn't elide the attrs
      // object when the user copies the console transcript out as text.
      console.log('[allmarks-note] ' + JSON.stringify({
        tag: btnDbg.tagName,
        attrs: dumpAttrs(btnDbg),
        parentTag: btnDbg.parentElement && btnDbg.parentElement.tagName,
        parentAttrs: dumpAttrs(btnDbg.parentElement),
        grandparentTag: btnDbg.parentElement && btnDbg.parentElement.parentElement && btnDbg.parentElement.parentElement.tagName,
        grandparentAttrs: btnDbg.parentElement ? dumpAttrs(btnDbg.parentElement.parentElement) : null,
        text: text.slice(0, 80),
      }))
    }
  }
  const kind = getButtonKind(event.target)
  if (!kind) return
  const url = extractArticleUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractArticleOgp(url)
  if (!isExtensionAlive()) return
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
