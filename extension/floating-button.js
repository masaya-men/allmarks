// AllMarks floating save button.
// Injects a small click-target on every page (= 5th save path alongside
// shortcut / context menu / extension icon / bookmarklet). Renders saved
// state visually so revisited URLs show a permanent green check.
//
// MV3 content_scripts don't allow ES module imports, so the pure
// state-machine and mirror logic are inlined below. Source of truth lives
// at extension/lib/floating-button-state.js + extension/lib/saved-urls-mirror.js.
//
// ⚠ When editing the inline state-machine below, ALSO update the source-of-
// truth file with the same event cases. Tests run against the source-of-
// truth; if the inline copy drifts, the button silently breaks at runtime
// while tests still pass green. (= session 58 bug — mirror-hit-live /
// mirror-hit-initial were added in source but not copied to inline,
// causing saves via auto-save to never light up the button.)

;(function () {
  // === Early exits ===
  if (location.hostname === 'allmarks.app' || location.hostname === 'booklage.pages.dev') return
  if (window.__allmarksFloatingButtonInjected) return
  window.__allmarksFloatingButtonInjected = true

  // === Inlined: floating-button-state.js ===
  const FLASH_MS = 1700
  const ERROR_MS = 2400
  function initialState() {
    return { savedFlag: false, pillState: 'idle' }
  }
  function nextState(state, event) {
    switch (event && event.type) {
      case 'mouseenter':
        if (state.pillState === 'idle') return { ...state, pillState: 'hover' }
        return state
      case 'mouseleave':
        if (state.pillState === 'hover') return { ...state, pillState: 'idle' }
        return state
      case 'click':
        if (state.pillState === 'saving' || state.pillState === 'flash') return state
        return { ...state, pillState: 'saving' }
      case 'save-success':
        if (state.pillState === 'saving') return { savedFlag: true, pillState: 'flash' }
        return state
      case 'save-error':
        if (state.pillState === 'saving') return { ...state, pillState: 'error' }
        return state
      case 'flash-elapsed':
        if (state.pillState === 'flash') return { ...state, pillState: 'idle' }
        return state
      case 'error-elapsed':
        if (state.pillState === 'error') return { ...state, pillState: 'idle' }
        return state
      case 'mirror-hit-initial':
        // Page load: URL was already in the mirror from a past visit.
        // Light up savedFlag silently (no flash) — nothing was just triggered.
        return { ...state, savedFlag: true }
      case 'mirror-hit-live':
        // Live update: URL appeared in the mirror via a non-click save path
        // (= site auto-save / shortcut / context menu / bookmarklet). Run
        // the flash animation so the user gets the same confirmation a
        // floating-button click would have given them.
        if (state.savedFlag) return state
        return { ...state, savedFlag: true, pillState: 'flash' }
      case 'mirror-miss':
        if (!state.savedFlag) return state
        return { ...state, savedFlag: false }
      default:
        return state
    }
  }
  function visualState(state) {
    if (state.pillState === 'saving') return 'saving'
    if (state.pillState === 'flash') return 'flash'
    if (state.pillState === 'error') return 'error'
    if (state.savedFlag && state.pillState === 'hover') return 'saved-hover'
    if (state.savedFlag) return 'saved-idle'
    if (state.pillState === 'hover') return 'idle-hover'
    return 'idle'
  }

  // === Inlined: normalize-url.js ===
  // Keep in sync with extension/lib/normalize-url.js (source of truth for tests).
  const GLOBAL_TRACKING_PREFIXES = ['utm_', 'mc_', '_ga', '_gl']
  const GLOBAL_TRACKING_EXACT = new Set([
    'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid',
    'igshid', 'vero_id', 'mkt_tok', 'oly_anon_id', 'oly_enc_id',
    'trk', 'trkCampaign', 'sc_campaign', 'sc_channel',
  ])
  const PER_HOST_DROP = {
    'youtube.com': new Set(['list', 'index', 't', 'pp', 'si', 'feature', 'ab_channel', 'start_radio', 'kid', 'themeRefresh', 'app']),
    'm.youtube.com': new Set(['list', 'index', 't', 'pp', 'si', 'feature', 'ab_channel', 'start_radio', 'kid', 'themeRefresh', 'app']),
    'x.com': new Set(['ref_src', 's', 't', 'cn']),
    'twitter.com': new Set(['ref_src', 's', 't', 'cn']),
    'mobile.x.com': new Set(['ref_src', 's', 't', 'cn']),
    'mobile.twitter.com': new Set(['ref_src', 's', 't', 'cn']),
  }
  function shouldDropParam(host, name) {
    if (GLOBAL_TRACKING_EXACT.has(name)) return true
    for (const prefix of GLOBAL_TRACKING_PREFIXES) {
      if (name.startsWith(prefix)) return true
    }
    const perHost = PER_HOST_DROP[host]
    if (perHost && perHost.has(name)) return true
    return false
  }
  function normalizeUrl(input) {
    if (!input || typeof input !== 'string') return input
    let url
    try { url = new URL(input) } catch (_) { return input }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return input
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = ''
    }
    const host = url.hostname.replace(/^www\./, '')
    const keep = []
    for (const [name, value] of url.searchParams) {
      if (!shouldDropParam(host, name)) keep.push([name, value])
    }
    url.search = ''
    for (const [name, value] of keep) url.searchParams.append(name, value)
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  }

  // === Inlined: saved-urls-mirror.js (read-only here) ===
  async function mirrorHas(url) {
    if (!url) return false
    try {
      const stored = await chrome.storage.local.get({ savedUrlsMirror: {} })
      return Object.prototype.hasOwnProperty.call(stored.savedUrlsMirror || {}, url)
    } catch (_) {
      return false
    }
  }

  // === Defensive: extension reload invalidates chrome.* handles ===
  function isExtensionAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id) } catch (_) { return false }
  }

  // === Settings ===
  const SETTINGS_DEFAULTS = {
    floatingButtonEnabled: true,
    floatingButtonIdleOpacity: 0.3,
    floatingButtonSnapSide: 'right',
    floatingButtonTopRatio: 0.5,
    floatingButtonDisabledDomains: [],
  }
  let settings = { ...SETTINGS_DEFAULTS }

  // === Mutable state ===
  let state = initialState()
  let container = null
  let flashTimer = null
  let errorTimer = null
  let dragLongPressTimer = null
  let dragging = false
  let dragStartY = 0
  let dragOriginTopRatio = 0.5

  // === SVG markup (= mirrors extension/icons/floating-button-mark.svg) ===
  // Session 82: filters removed. The innerShadow filter regions
  // (userSpaceOnUse + explicit bbox) were rendering as faint translucent
  // rectangles in Chromium, which read as "ugly transparent box" around
  // the mark on light backgrounds. The shadow was negligible visually,
  // so dropping the filters entirely cleans up the mark with no visible
  // loss. Mask + highlight stroke kept — that's the white outline.
  const SVG_STRING = `
<svg viewBox="0 0 112 111" fill="none" xmlns="http://www.w3.org/2000/svg" class="allmarks-fb-svg" aria-hidden="true">
  <mask id="allmarks-fb-mask-inside" fill="white">
    <path d="M52.6441 9.31894C67.4082 36.0874 86.0574 60.9154 103.159 86.5162C104.401 88.3758 105.635 90.2402 106.859 92.109C107.931 93.7454 109.002 95.3818 110.074 97.0183C113.558 102.339 109.741 109.401 103.381 109.401H59.7004C56.2986 109.401 53.2666 107.251 52.1635 104.033C44.5649 81.8666 37.6138 59.3761 28.9285 37.7528C27.7417 34.7981 24.8839 32.8661 21.6999 32.8382C17.7002 32.803 13.7004 32.7899 9.70074 32.7613C6.00914 32.7349 3.04449 29.728 3.04449 26.0363V7.34958C3.04449 3.65788 6.00914 0.651022 9.70074 0.6246C19.0949 0.557363 28.4892 0.575688 37.8834 0.19296L42.4549 0.00666439C45.4836 -0.116759 48.3219 1.48218 49.7858 4.13646L52.6441 9.31894Z"/>
  </mask>
  <path class="allmarks-fb-mark-fill" d="M52.6441 9.31894C67.4082 36.0874 86.0574 60.9154 103.159 86.5162C104.401 88.3758 105.635 90.2402 106.859 92.109C107.931 93.7454 109.002 95.3818 110.074 97.0183C113.558 102.339 109.741 109.401 103.381 109.401H59.7004C56.2986 109.401 53.2666 107.251 52.1635 104.033C44.5649 81.8666 37.6138 59.3761 28.9285 37.7528C27.7417 34.7981 24.8839 32.8661 21.6999 32.8382C17.7002 32.803 13.7004 32.7899 9.70074 32.7613C6.00914 32.7349 3.04449 29.728 3.04449 26.0363V7.34958C3.04449 3.65788 6.00914 0.651022 9.70074 0.6246C19.0949 0.557363 28.4892 0.575688 37.8834 0.19296L42.4549 0.00666439C45.4836 -0.116759 48.3219 1.48218 49.7858 4.13646L52.6441 9.31894Z"/>
  <path class="allmarks-fb-mark-highlight" d="M52.6441 9.31894L51.7685 9.80188L51.7685 9.8019L52.6441 9.31894ZM103.159 86.5162L103.99 85.9607L103.99 85.9607L103.159 86.5162ZM106.859 92.109L107.696 91.5611V91.5611L106.859 92.109ZM9.70074 32.7613L9.7079 31.7613V31.7613L9.70074 32.7613ZM9.70074 0.6246L9.7079 1.62457V1.62457L9.70074 0.6246ZM37.8834 0.19296L37.9241 1.19213L37.9241 1.19213L37.8834 0.19296ZM52.6441 9.31894L51.7685 9.8019C66.5595 36.6193 85.2678 61.5337 102.327 87.0717L103.159 86.5162L103.99 85.9607C86.847 60.2971 68.2568 35.5555 53.5197 8.83598L52.6441 9.31894ZM103.159 86.5162L102.327 87.0717C103.568 88.929 104.8 90.7908 106.022 92.6568L106.859 92.109L107.696 91.5611C106.47 89.6896 105.234 87.8226 103.99 85.9607L103.159 86.5162ZM106.859 92.109L106.022 92.6568C107.094 94.2933 108.166 95.9297 109.237 97.5662L110.074 97.0183L110.91 96.4704C109.839 94.834 108.767 93.1976 107.696 91.5611L106.859 92.109ZM103.381 109.401V108.401H59.7004V109.401V110.401H103.381V109.401ZM52.1635 104.033L53.1095 103.708C45.5242 81.5813 38.5546 59.0352 29.8565 37.3801L28.9285 37.7528L28.0006 38.1255C36.6731 59.7169 43.6056 82.1519 51.2175 104.357L52.1635 104.033ZM21.6999 32.8382L21.7087 31.8382C17.7098 31.8031 13.7004 31.7899 9.7079 31.7613L9.70074 32.7613L9.69359 33.7613C13.7004 33.79 17.6906 33.803 21.6911 33.8381L21.6999 32.8382ZM3.04449 26.0363H4.04449V7.34958H3.04449H2.04449V26.0363H3.04449ZM9.70074 0.6246L9.7079 1.62457C19.0893 1.55743 28.5082 1.57575 37.9241 1.19213L37.8834 0.19296L37.8427 -0.806211C28.4703 -0.42437 19.1004 -0.442702 9.69359 -0.375374L9.70074 0.6246ZM37.8834 0.19296L37.9241 1.19213L42.4956 1.00584L42.4549 0.00666439L42.4142 -0.992506L37.8426 -0.806211L37.8834 0.19296ZM49.7858 4.13646L48.9102 4.6194L51.7685 9.80188L52.6441 9.31894L53.5198 8.83599L50.6615 3.65351L49.7858 4.13646ZM42.4549 0.00666439L42.4956 1.00584C45.1457 0.897839 47.6292 2.29691 48.9102 4.6194L49.7858 4.13646L50.6615 3.65351C49.0146 0.667443 45.8214 -1.13136 42.4142 -0.992506L42.4549 0.00666439ZM9.70074 32.7613L9.7079 31.7613C6.56982 31.7389 4.04449 29.1826 4.04449 26.0363H3.04449H2.04449C2.04449 30.2735 5.44846 33.7309 9.69359 33.7613L9.70074 32.7613ZM28.9285 37.7528L29.8565 37.3801C28.5172 34.0458 25.2939 31.8697 21.7087 31.8382L21.6999 32.8382L21.6911 33.8381C24.4739 33.8626 26.9663 35.5505 28.0006 38.1255L28.9285 37.7528ZM59.7004 109.401V108.401C56.7227 108.401 54.073 106.519 53.1095 103.708L52.1635 104.033L51.2175 104.357C52.4602 107.982 55.8745 110.401 59.7004 110.401V109.401ZM3.04449 7.34958H4.04449C4.04449 4.20332 6.56982 1.64704 9.7079 1.62457L9.70074 0.6246L9.69359 -0.375374C5.44846 -0.34499 2.04449 3.11244 2.04449 7.34958H3.04449ZM110.074 97.0183L109.237 97.5662C112.286 102.222 108.946 108.401 103.381 108.401V109.401V110.401C110.536 110.401 114.83 102.456 110.91 96.4704L110.074 97.0183Z" fill="white" mask="url(#allmarks-fb-mask-inside)"/>
  <g class="allmarks-fb-group-check">
    <path class="allmarks-fb-check-fill" d="M14.4803 72.5461C13.2604 70.808 11.415 69.6569 9.31096 69.376C7.20916 69.0933 5.02096 69.7038 3.26682 71.0433C1.51269 72.3828 0.347562 74.333 0.0668612 76.4351C-0.21611 78.5389 0.40843 80.6223 1.76399 82.2567C1.76399 82.2567 1.76399 82.2567 1.76399 82.2567C3.10464 83.875 4.4453 85.4934 5.78595 87.1117C11.1511 93.588 16.5162 100.064 21.8814 106.541C25.0609 110.797 31.7446 111.469 35.6577 108.042C56.5326 89.6602 77.4075 71.2782 98.2824 52.8962C99.8596 51.5074 101.437 50.1186 103.014 48.7298C103.588 48.2237 103.941 47.495 104.006 46.7178C104.071 45.9397 103.842 45.1769 103.36 44.5832C102.878 43.9896 102.178 43.6099 101.403 43.5138C100.629 43.4185 99.8432 43.6148 99.2304 44.0731C99.2304 44.0731 99.2304 44.0731 99.2304 44.0731C97.5481 45.3326 95.8658 46.592 94.1836 47.8515C71.9176 64.5214 49.6517 81.1913 27.3857 97.8613C28.8201 96.5554 31.3437 96.7337 32.61 98.3478C27.7749 91.4667 22.9399 84.5856 18.1049 77.7045C16.8967 75.985 15.6885 74.2656 14.4803 72.5461Z"/>
  </g>
</svg>
`.trim()

  // === Lifecycle ===
  function dispatch(event) {
    const prev = state
    state = nextState(state, event)
    if (state === prev) return
    render()
    // Drive timers off of pillState entries.
    if (state.pillState === 'flash') {
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => dispatch({ type: 'flash-elapsed' }), FLASH_MS)
    }
    if (state.pillState === 'error') {
      clearTimeout(errorTimer)
      errorTimer = setTimeout(() => dispatch({ type: 'error-elapsed' }), ERROR_MS)
    }
  }

  function render() {
    if (!container) return
    container.dataset.state = visualState(state)
    container.style.setProperty('--floating-btn-idle-opacity', String(settings.floatingButtonIdleOpacity))
    applyPosition()
  }

  function applyPosition() {
    if (!container) return
    const side = settings.floatingButtonSnapSide === 'left' ? 'left' : 'right'
    container.style.right = side === 'right' ? '0px' : 'auto'
    container.style.left = side === 'left' ? '0px' : 'auto'
    const ratio = Math.max(0, Math.min(1, Number(settings.floatingButtonTopRatio) || 0.5))
    container.style.top = (ratio * 100).toFixed(2) + 'vh'
  }

  function isDomainDisabled() {
    const list = settings.floatingButtonDisabledDomains || []
    return list.some((d) => {
      if (!d) return false
      return location.hostname === d || location.hostname.endsWith('.' + d)
    })
  }

  function shouldShow() {
    return settings.floatingButtonEnabled && !isDomainDisabled()
  }

  // === Drag (long-press → reposition → snap) ===
  function onPointerDown(e) {
    if (e.button !== 0) return
    dragLongPressTimer = setTimeout(() => {
      dragging = true
      dragStartY = e.clientY
      dragOriginTopRatio = settings.floatingButtonTopRatio
      container.classList.add('is-dragging')
    }, 300)
  }
  function onPointerMove(e) {
    if (!dragging) return
    const dy = e.clientY - dragStartY
    const vh = window.innerHeight
    const newRatio = Math.max(0.05, Math.min(0.95, dragOriginTopRatio + dy / vh))
    settings.floatingButtonTopRatio = newRatio
    applyPosition()
  }
  function onPointerUp(e) {
    clearTimeout(dragLongPressTimer)
    if (!dragging) return
    dragging = false
    container.classList.remove('is-dragging')
    // Snap horizontally based on cursor's X.
    const newSide = e.clientX < window.innerWidth / 2 ? 'left' : 'right'
    settings.floatingButtonSnapSide = newSide
    applyPosition()
    // Snap pulse feedback.
    container.classList.add('is-snap-pulse')
    setTimeout(() => container && container.classList.remove('is-snap-pulse'), 200)
    // Persist.
    if (!isExtensionAlive()) return
    try {
      chrome.storage.sync.set({
        floatingButtonSnapSide: settings.floatingButtonSnapSide,
        floatingButtonTopRatio: settings.floatingButtonTopRatio,
      })
    } catch (_) {}
  }
  function cancelLongPress() {
    clearTimeout(dragLongPressTimer)
  }

  // === Save trigger ===
  function triggerSave() {
    if (!isExtensionAlive()) {
      dispatch({ type: 'save-error' })
      return
    }
    try {
      chrome.runtime.sendMessage({ type: 'booklage:floating-button-save' }).catch(() => {
        dispatch({ type: 'save-error' })
      })
    } catch (_) {
      dispatch({ type: 'save-error' })
    }
  }

  function onClick(e) {
    // Don't fire save if a long-press drag just ended.
    if (dragging) return
    e.preventDefault()
    e.stopPropagation()
    if (state.pillState === 'saving' || state.pillState === 'flash') return
    dispatch({ type: 'click' })
    triggerSave()
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      dispatch({ type: 'click' })
      triggerSave()
    }
  }

  // === Mount / unmount ===
  function mount() {
    if (container) return
    container = document.createElement('div')
    container.className = 'allmarks-floating-btn'
    container.dataset.state = visualState(state)
    container.setAttribute('role', 'button')
    container.setAttribute('aria-label', 'Save current page to AllMarks')
    container.tabIndex = 0
    container.innerHTML = SVG_STRING
    document.documentElement.appendChild(container)
    container.addEventListener('mouseenter', () => dispatch({ type: 'mouseenter' }))
    container.addEventListener('mouseleave', () => {
      cancelLongPress()
      dispatch({ type: 'mouseleave' })
    })
    container.addEventListener('mousedown', onPointerDown)
    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
    container.addEventListener('click', onClick, { capture: true })
    container.addEventListener('keydown', onKeyDown)
    render()
  }

  function unmount() {
    if (!container) return
    removeTagStrip()
    container.remove()
    container = null
  }

  // === Fullscreen handling ===
  function onFullscreenChange() {
    if (!container) return
    const isFullscreen = !!document.fullscreenElement
    if (isFullscreen) removeTagStrip()
    container.style.display = isFullscreen ? 'none' : ''
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
    try { chrome.runtime.sendMessage({ type: 'booklage:add-tag-request', bookmarkId, tagId }).catch(() => {}) } catch (_) {}
  }
  function applyStripTheme(el, t) {
    if (!t) return
    const set = (k, v) => { if (v) el.style.setProperty(k, v) }
    set('--am-strip-bg', t.bg); set('--am-strip-fg', t.fg); set('--am-strip-border', t.border)
    set('--am-strip-accent', t.accent); set('--am-strip-blur', t.blur)
  }
  function makeChip(bookmarkId, tag, alreadyOn) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'allmarks-tagstrip__chip'
    chip.textContent = tag.name
    if (alreadyOn) chip.dataset.on = 'true'
    chip.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      if (chip.dataset.on === 'true') return
      chip.dataset.on = 'true' // optimistic ✓ (rendered via CSS ::before)
      sendAddTag(bookmarkId, tag.id)
      // Re-arm the auto-dismiss only while collapsed; an expanded panel stays
      // open until the user closes it via ✕.
      if (!tagStripEl || tagStripEl.dataset.expanded !== 'true') {
        if (tagStripHideTimer) clearTimeout(tagStripHideTimer)
        tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
      }
    })
    return chip
  }
  function showTagStripForButton(bookmarkId, tags, currentTagIds, themeTokens) {
    removeTagStrip()
    if (!container) return
    const current = new Set(Array.isArray(currentTagIds) ? currentTagIds : [])
    const { visible, overflow } = tagstripSplit(tags, STRIP_MAX_CHIPS)
    const el = document.createElement('div')
    el.className = 'allmarks-tagstrip'
    applyStripTheme(el, themeTokens)
    // One non-wrapping row of curated chips; overflow folds behind MORE ▾.
    const rowEl = document.createElement('div')
    rowEl.className = 'allmarks-tagstrip__row'
    for (const t of visible) rowEl.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
    el.appendChild(rowEl)
    if (overflow.length > 0) {
      const more = document.createElement('button')
      more.type = 'button'; more.className = 'allmarks-tagstrip__more'; more.textContent = 'MORE ▾'
      more.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation()
        el.dataset.expanded = 'true'
        for (const t of overflow) rowEl.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
        more.remove()
        const close = document.createElement('button')
        close.type = 'button'; close.className = 'allmarks-tagstrip__close'; close.textContent = '✕'
        close.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); removeTagStrip() })
        el.appendChild(close)
        // An expanded panel stays open until closed — kill the auto-dismiss.
        if (tagStripHideTimer) { clearTimeout(tagStripHideTimer); tagStripHideTimer = null }
      })
      el.appendChild(more)
    }
    document.documentElement.appendChild(el)
    tagStripEl = el
    // Anchor to the button, expand inward from its snapped edge.
    const r = container.getBoundingClientRect()
    const side = settings.floatingButtonSnapSide === 'left' ? 'left' : 'right'
    const top = Math.max(8, Math.min(window.innerHeight - el.offsetHeight - 8, r.top + r.height / 2 - el.offsetHeight / 2))
    el.style.top = top + 'px'
    if (side === 'right') el.style.right = (window.innerWidth - r.left + 6) + 'px'
    else el.style.left = (r.right + 6) + 'px'
    requestAnimationFrame(() => el.classList.add('is-visible'))
    tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
  }

  // === Background messages ===
  if (isExtensionAlive()) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'booklage:floating-button-state') return
      if (msg.state === 'saved' || msg.state === 'duplicate') {
        dispatch({ type: 'save-success' })
        if (tagstripShouldShow(msg.state, msg.tags)) {
          setTimeout(() => showTagStripForButton(msg.bookmarkId, msg.tags, msg.currentTagIds, msg.themeTokens), 80)
        }
      } else if (msg.state === 'error') {
        dispatch({ type: 'save-error' })
        removeTagStrip()
      }
    })
  }

  // === Storage change listener (settings updates from options.html) ===
  if (isExtensionAlive()) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return
      let mustRerender = false
      for (const key of Object.keys(SETTINGS_DEFAULTS)) {
        if (changes[key]) {
          settings[key] = changes[key].newValue
          mustRerender = true
        }
      }
      if (mustRerender) {
        if (!shouldShow()) unmount()
        else { mount(); render() }
      }
      // Mirror live-update.
      // - URL appeared in mirror (= saved from elsewhere): flip to savedFlag=true
      // - URL gone from mirror (= deleted in AllMarks): flip back to savedFlag=false
      if (area === 'local' && changes.savedUrlsMirror) {
        const next = changes.savedUrlsMirror.newValue || {}
        const lookupKey = normalizeUrl(location.href)
        const inMirror = !!next[lookupKey]
        if (inMirror && !state.savedFlag) dispatch({ type: 'mirror-hit-live' })
        else if (!inMirror && state.savedFlag) dispatch({ type: 'mirror-miss' })
      }
    })
  }

  document.addEventListener('fullscreenchange', onFullscreenChange)

  // === SPA navigation tracking ===
  // YouTube / X / Vimeo / SoundCloud — and most modern sites — navigate via
  // history.pushState without a full page reload, so floating-button's
  // initial start() only runs once per real page load. Without this, when
  // the user clicks a video tile to open /watch?v=..., or scrolls a
  // SoundCloud track into focus, the button keeps the grey state from the
  // landing URL even when the new URL is in the mirror.
  //
  // Hook history.pushState / replaceState + popstate, debounce-fire a
  // re-check whenever location.href actually changes. The recheck uses
  // mirror-hit-initial (silent — no flash) since URL change is a passive
  // user action, not a save event the button is reacting to.
  let lastUrl = location.href
  let urlRecheckTimer = null
  async function recheckMirrorForCurrentUrl() {
    if (!isExtensionAlive()) return
    const key = normalizeUrl(location.href)
    let hit = false
    try { hit = await mirrorHas(key) } catch (_) {}
    if (hit && !state.savedFlag) dispatch({ type: 'mirror-hit-initial' })
    else if (!hit && state.savedFlag) dispatch({ type: 'mirror-miss' })
  }
  function onMaybeUrlChange() {
    if (location.href === lastUrl) return
    lastUrl = location.href
    // Debounce — pushState often fires back-to-back during SPA navigation
    // (= replaceState for query updates, then pushState for the route).
    if (urlRecheckTimer) clearTimeout(urlRecheckTimer)
    urlRecheckTimer = setTimeout(recheckMirrorForCurrentUrl, 50)
  }
  try {
    const origPushState = history.pushState
    const origReplaceState = history.replaceState
    history.pushState = function () {
      const ret = origPushState.apply(this, arguments)
      try { onMaybeUrlChange() } catch (_) {}
      return ret
    }
    history.replaceState = function () {
      const ret = origReplaceState.apply(this, arguments)
      try { onMaybeUrlChange() } catch (_) {}
      return ret
    }
  } catch (_) {}
  window.addEventListener('popstate', onMaybeUrlChange)
  // YouTube emits its own navigation lifecycle events — listen as a belt-
  // and-suspenders (= some YouTube layouts dispatch yt-navigate-finish
  // BEFORE history is updated in a tick the listener above can catch).
  window.addEventListener('yt-navigate-finish', onMaybeUrlChange)
  // Final safety net — 500ms polling. Some SPAs (= X / Twitter's React
  // Router in particular) navigate through code paths the pushState hooks
  // above don't catch (= they call history APIs in a microtask the wrap
  // boundary misses). String compare on location.href is sub-microsecond,
  // so the steady-state cost is invisible: 99% of ticks early-return at
  // the first line of onMaybeUrlChange. Industry-standard fallback —
  // Toby, Raindrop, mymind all use polling either alone or alongside
  // webNavigation API. We pick polling-only to avoid the "Read your
  // browsing history" install prompt that the webNavigation permission
  // adds (= deters non-technical users).
  setInterval(onMaybeUrlChange, 500)

  // === Startup ===
  async function start() {
    if (!isExtensionAlive()) return
    try {
      const stored = await chrome.storage.sync.get(SETTINGS_DEFAULTS)
      settings = { ...SETTINGS_DEFAULTS, ...stored }
    } catch (_) {
      settings = { ...SETTINGS_DEFAULTS }
    }
    if (!shouldShow()) return
    mount()
    const hit = await mirrorHas(normalizeUrl(location.href))
    if (hit) dispatch({ type: 'mirror-hit-initial' })
  }

  start()
})()
