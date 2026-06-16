// MV3 content_scripts don't support ES module imports — keep pillStateView inline.
// Source of truth for tests: extension/lib/pill-state-machine.js (must stay in sync).
function pillStateView(state) {
  if (state === 'saving')    return { label: 'Saving',        icon: 'ring',        autoHideMs: null }
  if (state === 'saved')     return { label: 'Saved',         icon: 'check',       autoHideMs: 1700 }
  if (state === 'duplicate') return { label: 'Already saved', icon: 'warn',        autoHideMs: 2000 }
  if (state === 'error')     return { label: 'Failed',        icon: 'bang',        autoHideMs: 2400 }
  return null
}

// === Quick-tag strip (inlined; source of truth: extension/lib/tag-strip-model.js) ===
const STRIP_MAX_CHIPS = 5
function tagstripSplit(tags, max) {
  const list = Array.isArray(tags) ? tags : []
  return { visible: list.slice(0, max || STRIP_MAX_CHIPS), overflow: list.slice(max || STRIP_MAX_CHIPS) }
}
function tagstripShouldShow(state, tags) {
  if (state !== 'saved' && state !== 'duplicate') return false
  return Array.isArray(tags) && tags.length > 0
}

let tagStripEl = null
let tagStripHideTimer = null
const TAGSTRIP_HIDE_MS = 4200

function removeTagStrip() {
  if (tagStripHideTimer) { clearTimeout(tagStripHideTimer); tagStripHideTimer = null }
  if (tagStripEl) { tagStripEl.remove(); tagStripEl = null }
}

function sendAddTag(bookmarkId, tagId) {
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({ type: 'booklage:add-tag-request', bookmarkId, tagId }).catch(() => {})
  } catch (_) { /* context invalidated */ }
}

// Push the active theme's tokens onto the strip's CSS vars so its tone matches
// the app's current theme (and follows future theme switches).
function applyStripTheme(el, t) {
  if (!t) return
  const set = (k, v) => { if (v) el.style.setProperty(k, v) }
  set('--am-strip-bg', t.bg)
  set('--am-strip-fg', t.fg)
  set('--am-strip-border', t.border)
  set('--am-strip-accent', t.accent)
  set('--am-strip-blur', t.blur)
}

function makeChip(bookmarkId, tag, alreadyOn) {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = 'allmarks-tagstrip__chip'
  chip.textContent = tag.name
  if (alreadyOn) chip.dataset.on = 'true'
  chip.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation()
    if (chip.dataset.on === 'true') return // already applied — no-op (no un-tag in phase 1)
    chip.dataset.on = 'true' // optimistic ✓
    sendAddTag(bookmarkId, tag.id)
    // keep the strip open a little longer after an interaction
    if (tagStripHideTimer) clearTimeout(tagStripHideTimer)
    tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
  })
  return chip
}

// Render the strip next to the cursor pill. The pill sits near the cursor
// (top-left of pointer); place the strip just below it.
function showTagStrip(bookmarkId, tags, currentTagIds, themeTokens) {
  removeTagStrip()
  const current = new Set(Array.isArray(currentTagIds) ? currentTagIds : [])
  const { visible, overflow } = tagstripSplit(tags, STRIP_MAX_CHIPS)
  const el = document.createElement('div')
  el.className = 'allmarks-tagstrip'
  applyStripTheme(el, themeTokens)
  for (const t of visible) el.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
  if (overflow.length > 0) {
    const all = document.createElement('button')
    all.type = 'button'
    all.className = 'allmarks-tagstrip__chip'
    all.dataset.role = 'all'
    all.textContent = 'ALL'
    all.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      all.remove()
      for (const t of overflow) el.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
    })
    el.appendChild(all)
  }
  document.documentElement.appendChild(el)
  tagStripEl = el
  // Position: under the pill (pill positions itself via positionPill()).
  const p = ensurePill()
  const r = p.getBoundingClientRect()
  el.style.left = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, r.left)) + 'px'
  el.style.top = Math.min(window.innerHeight - el.offsetHeight - 8, r.bottom + 6) + 'px'
  requestAnimationFrame(() => el.classList.add('is-visible'))
  tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
}

const MIN_SAVING_MS = 500

// Extension reloads invalidate this script's chrome.* handle; touching
// chrome.runtime.sendMessage afterwards throws synchronously, which the
// .catch() below can't trap. Probe chrome.runtime.id first — it's undefined
// in an invalidated context — and wrap each call site in try/catch for races.
function isExtensionAlive() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id) } catch (_) { return false }
}

// Marker for the bookmarklet IIFE: when present, the bookmarklet skips its
// popup/toast path and routes through the extension instead (silent save).
if (document.documentElement) {
  document.documentElement.dataset.booklageExtension = '1'
}

let lastMouse = { x: window.innerWidth - 220, y: window.innerHeight - 60 }
window.addEventListener('mousemove', (e) => {
  lastMouse = { x: e.clientX, y: e.clientY }
  if (pill && pill.classList.contains('is-visible')) positionPill()
}, { passive: true })

let pill = null
let hideTimer = null
let savingShownAt = 0
let pendingFinalize = null
let stuckSavingTimer = null
const STUCK_SAVING_TIMEOUT_MS = 8000

function ensurePill() {
  if (pill) return pill
  pill = document.createElement('div')
  pill.className = 'booklage-pill'
  pill.innerHTML =
    '<span class="booklage-pill__icon" data-role="icon"></span>' +
    '<span class="booklage-pill__brand">AllMarks</span>' +
    '<span class="booklage-pill__sep">' + String.fromCharCode(183) + '</span>' +
    '<span class="booklage-pill__state" data-role="state">Saving</span>'
  document.documentElement.appendChild(pill)
  return pill
}

function positionPill() {
  const p = ensurePill()
  const x = Math.min(window.innerWidth - 220, Math.max(8, lastMouse.x + 12))
  const y = Math.min(window.innerHeight - 56, Math.max(8, lastMouse.y - 52))
  p.style.transform = 'translate(' + x + 'px, ' + y + 'px)'
}

const ICONS = {
  ring: '<span class="ring"></span>',
  check: '<svg viewBox="0 0 24 24" class="check"><path d="M5 12 L10 17 L19 7"/></svg>',
  // Warning triangle for the "already saved" state. Industry-standard
  // "this isnt an error but pay attention" glyph. Triangle outline strokes
  // in first, then the bang line, then the dot fades in.
  warn: '<svg viewBox="0 0 24 24" class="check check-warn"><path class="warn-tri" d="M12 3 L22 20 L2 20 Z"/><path class="warn-bang" d="M12 9 L12 14"/><circle class="warn-dot" cx="12" cy="17.2" r="1.3"/></svg>',
  bang: '<span class="bang">!</span>',
}

// Label animation: per-char slide-in (= typewriter-wave reveal), then morph
// the span structure back into a single text node + trigger an RGB
// chromatic-aberration glitch matching the AllMarks SHARE / TUNE / POP-OUT
// chrome button hover effect (see components/board/ChromeButton.module.css).
// The ghosts live on ::before / ::after with position:absolute so the pill
// width stays rock-solid during the glitch.
let labelAnimToken = 0
let labelMorphTimer = null
let labelGlitchEndTimer = null
const GLITCH_MS = 700

function setLabelAnimated(stateEl, finalText) {
  const token = ++labelAnimToken
  if (labelMorphTimer)     { clearTimeout(labelMorphTimer);     labelMorphTimer = null }
  if (labelGlitchEndTimer) { clearTimeout(labelGlitchEndTimer); labelGlitchEndTimer = null }
  stateEl.classList.remove('is-glitching')
  stateEl.setAttribute('data-glitch-text', finalText)
  stateEl.innerHTML = ''
  for (let i = 0; i < finalText.length; i++) {
    const raw = finalText[i]
    const ch = raw === ' ' ? ' ' : raw
    const span = document.createElement('span')
    span.className = 'booklage-pill__char'
    span.textContent = ch
    span.style.animationDelay = (i * 22) + 'ms'
    stateEl.appendChild(span)
  }
  // Slide-in stagger: each char rises 320ms after a 22ms-stepped delay.
  // After the last char settles, swap the span structure for a single text
  // node so the RGB ghosts (= ::before / ::after fed by data-glitch-text)
  // line up with the rendered glyphs pixel-perfectly.
  const slideEnd = (finalText.length - 1) * 22 + 320
  labelMorphTimer = setTimeout(() => {
    if (token !== labelAnimToken) return
    stateEl.textContent = finalText
    stateEl.classList.add('is-glitching')
    labelGlitchEndTimer = setTimeout(() => {
      if (token !== labelAnimToken) return
      stateEl.classList.remove('is-glitching')
    }, GLITCH_MS)
  }, slideEnd + 40)
}

function applyState(state) {
  const view = pillStateView(state)
  if (!view) return
  const p = ensurePill()
  positionPill()
  const stateEl = p.querySelector('[data-role="state"]')
  const iconEl = p.querySelector('[data-role="icon"]')
  if (stateEl) setLabelAnimated(stateEl, view.label)
  if (iconEl) iconEl.innerHTML = ICONS[view.icon] || ''
  // Force CSS animation to restart even if same state re-applied.
  p.dataset.state = ''
  // eslint-disable-next-line no-unused-expressions
  p.offsetWidth
  p.dataset.state = state
  p.classList.add('is-visible')
  clearTimeout(hideTimer)
  if (view.autoHideMs !== null) {
    hideTimer = setTimeout(() => p.classList.remove('is-visible'), view.autoHideMs)
  }
}

function setState(state) {
  if (state === 'saving') {
    savingShownAt = performance.now()
    if (pendingFinalize) {
      clearTimeout(pendingFinalize)
      pendingFinalize = null
    }
    // Stuck-saving safety net: if no final state (saved/error) lands within
    // 8s — e.g., site .js fired the immediate pill but background dropped
    // the auto-save because the source is toggled off — hide the pill
    // silently so it doesn't look frozen.
    if (stuckSavingTimer) clearTimeout(stuckSavingTimer)
    stuckSavingTimer = setTimeout(() => {
      stuckSavingTimer = null
      if (pill) pill.classList.remove('is-visible')
    }, STUCK_SAVING_TIMEOUT_MS)
    applyState(state)
    return
  }
  // saved / error: ensure ring (saving) was visible long enough to be perceived.
  if (stuckSavingTimer) {
    clearTimeout(stuckSavingTimer)
    stuckSavingTimer = null
  }
  const elapsed = performance.now() - savingShownAt
  const remaining = MIN_SAVING_MS - elapsed
  if (savingShownAt > 0 && remaining > 0) {
    if (pendingFinalize) clearTimeout(pendingFinalize)
    pendingFinalize = setTimeout(() => {
      pendingFinalize = null
      applyState(state)
    }, remaining)
  } else {
    applyState(state)
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'booklage:cursor-pill') return
  setState(msg.state)
  if (tagstripShouldShow(msg.state, msg.tags)) {
    // Defer so the pill has positioned itself first.
    setTimeout(() => showTagStrip(msg.bookmarkId, msg.tags, msg.currentTagIds, msg.themeTokens), 80)
  } else if (msg.state === 'error') {
    removeTagStrip()
  }
})

// === Bookmarklet hand-off + immediate pill trigger ===
// The bookmarklet IIFE detects the marker (data-booklage-extension) and
// posts here instead of opening its popup. We forward to background which
// runs the regular dispatchSave flow against this tab. Same nonce arriving
// twice within a short window is ignored (defensive against duplicates).
//
// Site .js scripts (twitter / youtube / note / vimeo / soundcloud) also
// post a {source:'booklage-extension', type:'pill-saving'} message right
// before their chrome.runtime.sendMessage call so the pill appears within
// ~10ms instead of the ~100-300ms it took when waiting for the background
// round-trip. The background flow still fires 'saved' / 'error' as usual.
const seenBookmarkletNonces = new Map()
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const msg = event.data
  if (!msg) return
  if (msg.source === 'booklage-extension' && msg.type === 'pill-saving') {
    setState('saving')
    return
  }
  // Site-script mirror defense fires this when the URL is already in the
  // user's AllMarks (= no save dispatch happens, but the user still gets
  // gentle "Already saved" feedback instead of silent suppression).
  if (msg.source === 'booklage-extension' && msg.type === 'pill-duplicate') {
    setState('duplicate')
    return
  }
  if (msg.type !== 'booklage:save-via-extension') return
  const nonce = typeof msg.nonce === 'string' ? msg.nonce : null
  if (nonce) {
    const now = Date.now()
    // GC entries older than 5s before the dedupe check.
    for (const [k, t] of seenBookmarkletNonces) {
      if (now - t > 5000) seenBookmarkletNonces.delete(k)
    }
    if (seenBookmarkletNonces.has(nonce)) return
    seenBookmarkletNonces.set(nonce, now)
  }
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:dispatch-bookmarklet',
      ogp: msg.ogp || null,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
})

// === URL-deleted forwarder (booklage tab only) ===
// Listen for "URL deleted" notifications from the AllMarks React app and
// forward them to the background SW so it can drop the URL from the
// saved-urls mirror (= keeps the floating button's "already saved" state
// in sync with what's actually in the user's AllMarks).
if (location.hostname === 'allmarks.app' || location.hostname === 'booklage.pages.dev') {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    const msg = event.data
    if (!msg) return
    if (msg.type === 'allmarks:url-deleted') {
      if (typeof msg.url !== 'string' || !msg.url) return
      if (!isExtensionAlive()) return
      try {
        chrome.runtime.sendMessage({ type: 'booklage:url-deleted', url: msg.url }).catch(() => {})
      } catch (_) {
        // Context invalidated; drop silently.
      }
      return
    }
    // SETTINGS chrome entry on the board → open the extension options page.
    if (msg.type === 'allmarks:open-settings') {
      if (!isExtensionAlive()) return
      try {
        chrome.runtime.sendMessage({ type: 'booklage:open-options' }).catch(() => {})
      } catch (_) {
        // Context invalidated; drop silently.
      }
      return
    }
  })
}
