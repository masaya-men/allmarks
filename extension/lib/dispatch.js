import { addUrl as mirrorAddUrl } from './saved-urls-mirror.js'
import { normalizeUrl } from './normalize-url.js'

const OFFSCREEN_PATH = 'offscreen.html'

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
  if (existing.length > 0) return
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['IFRAME_SCRIPTING'],
    justification: 'Bridge to booklage origin for IDB write',
  })
}

function makeNonce(prefix) {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 7)
}

async function extractOgpFromTab(tabId, overrideUrl, ogpFromBookmarklet) {
  // Bookmarklet path: the IIFE already extracted OGP from the live document
  // (with cookies, post-render). Trust it and skip executeScript entirely —
  // this avoids a redundant DOM walk and works on pages where the extension
  // host_permission was somehow not granted.
  if (ogpFromBookmarklet && ogpFromBookmarklet.url) return ogpFromBookmarklet
  // Save-link path: we have the URL but no DOM context — synthesize a minimal payload.
  if (overrideUrl) {
    let host = overrideUrl
    try { host = new URL(overrideUrl).hostname } catch { /* keep raw */ }
    return { url: overrideUrl, title: overrideUrl, image: '', description: '', siteName: host, favicon: '' }
  }
  // Inline copy of extractOgp() — chrome.scripting.executeScript({func}) serializes the
  // function source, so the function body must be self-contained (no imports). We keep
  // a parallel ./ogp.js for unit testability via Group E.1.
  // NOTE: keep this body in sync with extension/lib/ogp.js (source of truth for tests).
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const m = (s) => { const e = document.querySelector(s); return e ? e.getAttribute('content') || '' : '' }
      const k = (s) => { const e = document.querySelector(s); return e ? e.getAttribute('href') || '' : '' }
      const r = (h, b) => {
        if (!h) return ''
        if (/^https?:\/\//i.test(h)) return h
        if (h.startsWith('//')) return `https:${h}`
        try { return new URL(h, b).href } catch { return '' }
      }
      const url = location.href
      const title = m('meta[property="og:title"]') || document.title || url
      const image = r(m('meta[property="og:image"]') || m('meta[name="twitter:image"]') || '', url)
      const description = (m('meta[property="og:description"]') || m('meta[name="description"]') || '').slice(0, 200)
      const siteName = m('meta[property="og:site_name"]') || location.hostname
      const favicon = r(k('link[rel="icon"]') || k('link[rel="shortcut icon"]') || '/favicon.ico', url)
      return { url, title, image, description, siteName, favicon }
    },
  })
  return result
}

async function postToOffscreen(envelope, nonce) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { target: 'offscreen', type: 'forward-to-iframe', envelope, nonce },
      (response) => resolve(response),
    )
  })
}

export async function dispatchSave({ trigger, tabId, linkUrl, ogpFromBookmarklet }) {
  await ensureOffscreen()
  const ogp = await extractOgpFromTab(tabId, linkUrl, ogpFromBookmarklet)
  const nonce = makeNonce('e')
  // Every trigger uses skipIfDuplicate now — duplicates aren't an error,
  // they're a recognised "already saved" outcome surfaced gently to the user.
  // The offscreen iframe replies with { ok: true, skipped: true } when the URL
  // exists; we translate that into a `duplicate` pill state below.
  const envelope = {
    type: 'booklage:save',
    payload: { ...ogp, nonce, skipIfDuplicate: true },
  }
  // Cursor pill on the source tab. The pill always fires for every trigger
  // except floating-button — that button has its own visual state machine
  // (green check + glow) and a parallel cursor pill would be dual feedback.
  // We previously also suppressed the pill when PiP was open (= PiP slide-
  // in shows the save), but site .js (twitter / youtube / note / vimeo /
  // soundcloud) fires its own immediate `pill-saving` postMessage before
  // the background round-trip starts — it doesn't know about PiP state.
  // So when PiP was open + auto-save fired, the saving pill would spin
  // forever (no final state arrived). Pill always-on resolves that.
  const isFloatingButton = trigger === 'floating-button'
  if (!isFloatingButton) {
    chrome.tabs.sendMessage(tabId, { type: 'booklage:cursor-pill', state: 'saving' }).catch(() => {})
  }

  let result = await postToOffscreen(envelope, nonce)
  console.debug('[allmarks] save iframe result:', { trigger, result })

  // Self-heal: a timeout almost always means the offscreen iframe is in a
  // stuck state (= stale load after deploy, lost message listener, paused
  // service worker that woke up mid-flight, etc). Close the stale offscreen,
  // recreate it, and retry once with a fresh nonce. The user sees no error
  // if the retry succeeds. Only if the retry also times out do we surface
  // the red pill. The cost is up to ~8s extra latency on the rare stuck
  // case; everyday saves are untouched.
  if (!result?.ok && result?.error === 'timeout') {
    console.debug('[allmarks] timeout; recreating offscreen and retrying once')
    try { await chrome.offscreen.closeDocument() } catch (_) { /* no doc to close */ }
    await ensureOffscreen()
    const retryNonce = makeNonce('e-retry')
    const retryEnvelope = { ...envelope, payload: { ...envelope.payload, nonce: retryNonce } }
    result = await postToOffscreen(retryEnvelope, retryNonce)
    console.debug('[allmarks] save iframe retry result:', { trigger, result })
  }

  let finalState
  if (!result?.ok) finalState = 'error'
  else if (result.skipped) finalState = 'duplicate'
  else finalState = 'saved'

  // Mirror successful saves into chrome.storage.local so the floating button
  // can render "already saved" on revisit. Both `saved` and `duplicate` mean
  // the URL is in AllMarks now, so both populate the mirror.
  //
  // We store the *normalized* URL so the same content saved from different
  // surfaces (= youtube.js builds `?v=abc`, keyboard shortcut sends
  // `?v=abc&list=...`) maps to one mirror entry. The lookup side
  // (floating-button.js) normalizes location.href the same way.
  if ((finalState === 'saved' || finalState === 'duplicate') && ogp && ogp.url) {
    try { await mirrorAddUrl(normalizeUrl(ogp.url), chrome.storage.local) } catch (_) {}
  }

  if (!isFloatingButton) {
    chrome.tabs.sendMessage(tabId, { type: 'booklage:cursor-pill', state: finalState }).catch(() => {})
  }
  if (isFloatingButton) {
    chrome.tabs.sendMessage(tabId, { type: 'booklage:floating-button-state', state: finalState }).catch(() => {})
  }
  // Quick-tag strip is always rendered by floating-button.js (anchored to the
  // button, or its default slot when the button is off), regardless of which
  // confirmation surface showed. Send the tag payload on every successful save.
  if (finalState === 'saved' || finalState === 'duplicate') {
    chrome.tabs.sendMessage(tabId, {
      type: 'booklage:quick-tag',
      bookmarkId: result.bookmarkId,
      tags: Array.isArray(result.tags) ? result.tags : [],
      currentTagIds: Array.isArray(result.currentTagIds) ? result.currentTagIds : [],
      themeTokens: result.themeTokens || null,
    }).catch(() => {})
  }
}

// Add-tag round-trip for the quick-tag strip. Same offscreen bridge as save:
// post a booklage:add-tag envelope, let the /save-iframe page call
// addTagToBookmark, resolve on booklage:add-tag:result. Fire-and-forget from
// the UI's perspective (the strip shows ✓ optimistically); we still await the
// result here to drive the one-shot offscreen self-heal on timeout.
export async function dispatchAddTag({ bookmarkId, tagId }) {
  await ensureOffscreen()
  const nonce = makeNonce('t')
  const envelope = { type: 'booklage:add-tag', payload: { bookmarkId, tagId, nonce } }
  let result = await postToOffscreen(envelope, nonce)
  if (!result?.ok && result?.error === 'timeout') {
    try { await chrome.offscreen.closeDocument() } catch (_) { /* no doc */ }
    await ensureOffscreen()
    const retryNonce = makeNonce('t-retry')
    result = await postToOffscreen({ ...envelope, payload: { ...envelope.payload, nonce: retryNonce } }, retryNonce)
  }
  return result
}
