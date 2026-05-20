// extension/youtube.js
// Auto-save to AllMarks when the user likes a video or adds it to "Watch later".
// Two configurable triggers:
//   - Like button: like-button-view-model button
//   - Watch later: any button whose text matches "後で見る" / "Watch later"
// We do NOT hook dislike, share, or the parent "Save" button itself.
//
// Duplicate URLs are filtered out by the save-iframe layer (skipIfDuplicate),
// so even if the user un-toggles "Watch later" and the click re-fires, no
// duplicate bookmark is created.

const DEDUPE_WINDOW_MS = 5000
const recentlySent = new Map()

// Extension reloads invalidate this script's chrome.* handle; touching
// chrome.runtime.sendMessage afterwards throws synchronously, which the
// .catch() below can't trap. Probe chrome.runtime.id first — it's undefined
// in an invalidated context — and wrap the call in try/catch for races.
function isExtensionAlive() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id) } catch (_) { return false }
}

// Auto-save settings cache. See twitter.js for the rationale (= pill is
// fired here BEFORE background round-trip, so we need a sync source-of-
// truth to suppress it when the user has toggled OFF).
const SETTING_DEFAULTS = { autoSaveYouTubeLike: true, autoSaveYouTubeWatchLater: true }
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
function isSourceEnabled(source) {
  if (source === 'yt-like')         return settingsCache.autoSaveYouTubeLike        !== false
  if (source === 'yt-watch-later')  return settingsCache.autoSaveYouTubeWatchLater !== false
  return false
}

function pruneRecent(now) {
  for (const [k, t] of recentlySent) {
    if (now - t > DEDUPE_WINDOW_MS) recentlySent.delete(k)
  }
}

// === Mirror snapshot — sync-readable cache of "URLs already in AllMarks".
// Source of truth: chrome.storage.local key `savedUrlsMirror` (written by
// lib/dispatch.js after every successful save). Mirror keys are normalized
// URLs; the URLs we extract on this page are already in canonical form
// (= `https://www.youtube.com/watch?v={id}` with no list/t/etc), so a raw
// Set lookup is sufficient.
//
// Purpose: suppress auto-save fires when the URL is already saved. Two
// failure modes this guards against:
//   1. OFF-toggle clicks that slip past per-site DOM guards (= YouTube
//      Watch Later text/aria fragility reported session 59).
//   2. Toggle churn after a save just landed (= user un-toggles then
//      re-toggles within the dedupe window).
// Side effect: the user won't get a cursor pill on already-saved pages.
// The floating button is already green there, so it's not blind feedback.
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

function extractVideoUrl() {
  // /watch?v=... — auto-save from the current video page directly.
  if (location.pathname !== '/watch') return null
  const params = new URLSearchParams(location.search)
  const v = params.get('v')
  if (!v) return null
  return 'https://www.youtube.com/watch?v=' + v
}

function extractVideoOgp(url) {
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
    favicon: 'https://www.youtube.com/s/desktop/favicon.ico',
    siteName: 'YouTube',
  }
}

// === Pending video capture — list / channel / home page ︙ menu path.
// On these pages location.pathname is not /watch, so extractVideoUrl() returns
// null. But the ︙ menu on a video tile exposes "[後で見る] に保存" — the same
// action as the watch-page Save dropdown. The popup is mounted in a global
// container, NOT inside the tile's DOM tree, so when the option is clicked we
// can't walk back from the option to the tile.
//
// Workaround: on every click, look up to see if the click originated inside a
// known YouTube video tile. If so, capture the tile's video URL + display
// metadata. When a watch-later option is then clicked from the global popup
// within PENDING_VIDEO_MAX_AGE_MS, the click handler falls back to this.
//
// The tile metadata (title, thumbnail, channel) becomes the bookmark's OGP
// because we have no way to fetch the video page's meta tags from here.
const PENDING_VIDEO_MAX_AGE_MS = 5000

const VIDEO_TILE_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-rich-grid-media',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-playlist-panel-video-renderer',
  'yt-lockup-view-model',
  'ytm-shelf-renderer ytm-media-item',
].join(', ')

let pendingVideo = null  // { url, ogp, at } | null

function canonicalizeWatchHref(href) {
  if (!href) return null
  try {
    const u = new URL(href, 'https://www.youtube.com/')
    if (u.pathname !== '/watch') return null
    const v = u.searchParams.get('v')
    if (!v) return null
    return 'https://www.youtube.com/watch?v=' + v
  } catch (_) {
    return null
  }
}

function extractTileOgp(tile, url) {
  if (!tile) return null
  const titleEl = tile.querySelector(
    '#video-title, [id="video-title"], .yt-lockup-metadata-view-model-wiz__title, ' +
    'h3 .yt-core-attributed-string, h3 a, h3'
  )
  const title = ((titleEl ? (titleEl.innerText || titleEl.textContent || '') : '') || '').trim() || url
  const imgEl = tile.querySelector('img')
  const image = imgEl ? (imgEl.src || imgEl.getAttribute('src') || '') : ''
  const channelEl = tile.querySelector(
    'ytd-channel-name a, ytd-video-meta-block ytd-channel-name a, ' +
    '.yt-lockup-metadata-view-model-wiz__metadata-row a, ' +
    '.yt-content-metadata-view-model-wiz__metadata-row a'
  )
  const channelName = channelEl ? ((channelEl.innerText || channelEl.textContent || '').trim()) : ''
  return {
    url,
    title,
    description: channelName ? channelName + ' • YouTube' : '',
    image,
    favicon: 'https://www.youtube.com/s/desktop/favicon.ico',
    siteName: 'YouTube',
  }
}

function captureVideoFromTile(target) {
  if (!target || !target.closest) return
  const tile = target.closest(VIDEO_TILE_SELECTOR)
  if (!tile) return
  // Tile may host multiple anchors (overlay, title, channel). Prefer the
  // canonical thumbnail link (a#thumbnail) and fall back to any /watch anchor.
  const link = tile.querySelector(
    'a#thumbnail[href*="/watch"], a.yt-simple-endpoint[href*="/watch"], a[href*="/watch"]'
  )
  const href = link ? link.getAttribute('href') : null
  const url = canonicalizeWatchHref(href)
  if (!url) return
  pendingVideo = { url, ogp: extractTileOgp(tile, url), at: Date.now() }
}

function resolvePendingVideo() {
  if (!pendingVideo) return null
  if (Date.now() - pendingVideo.at > PENDING_VIDEO_MAX_AGE_MS) {
    pendingVideo = null
    return null
  }
  return pendingVideo
}

function buttonTextLower(btn) {
  return (btn.innerText || btn.textContent || '').trim().toLowerCase()
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Like — sits inside a <like-button-view-model> custom element. The
  // selector is language-neutral by design (= YouTube's component name).
  // OFF state (= already liked, click would un-like) is signalled via
  // aria-pressed="true" on the inner button.
  //
  // ⚠ Session 59 (v0.1.12) bug: YouTube reuses <like-button-view-model>
  // as a toggle-button wrapper for the Save dropdown's Watch later option
  // on certain videos. That mis-matched here — clicks on Watch later got
  // captured by the Like branch and returned null (= aria-pressed semantics
  // diverged from a real Like button). Text-content guard below filters
  // that out: if the matched button's text says "Watch later" / "後で見る"
  // / etc, it's NOT the player's Like button — fall through to the
  // watch-later branch.
  const likeBtn = target.closest('like-button-view-model button')
  if (likeBtn) {
    const likeText = ((likeBtn.innerText || likeBtn.textContent || '') + '').toLowerCase()
    const likeLabel = (likeBtn.getAttribute('aria-label') || '').toLowerCase()
    const likeHay = likeText + ' ' + likeLabel
    const isMisWrappedWatchLater = (
      /watch\s*later/i.test(likeHay) ||                              // en
      /後で見る/.test(likeText + likeLabel) ||                         // ja
      /나중에\s*보|나중에\s*볼/.test(likeHay) ||                        // ko
      /稍后观看|稍後觀看/.test(likeText + likeLabel) ||                  // zh
      /ver\s*más\s*tarde|ver\s*mas\s*tarde/i.test(likeHay) ||         // es
      /regarder\s*plus\s*tard|à\s*voir\s*plus\s*tard/i.test(likeHay) || // fr
      /später\s*(an)?sehen/i.test(likeHay) ||                         // de
      /assistir\s*mais\s*tarde/i.test(likeHay) ||                     // pt
      /guarda(re)?\s*più\s*tardi/i.test(likeHay)                      // it
    )
    if (!isMisWrappedWatchLater) {
      if (likeBtn.getAttribute('aria-pressed') === 'true') return null
      return 'like'
    }
    // Fall through to watch-later detection below.
  }
  // Watch later — popup option inside the Save dropdown. YouTube ships at
  // least three layouts in rotation:
  //   - legacy:  <button> / <tp-yt-paper-checkbox> / <ytd-playlist-add-to-option-renderer>
  //   - new MV:  <yt-list-item-view-model> with class `ytListItemViewModel*`
  //              (= session 58 user report — role="option" on row)
  //   - context menu (thumbnail ︙ + watch-page Save dropdown 3rd variant):
  //              <ytd-menu-service-item-renderer> + role="menuitem"
  //              (= session 59 round-3 user report — specific videos fail)
  // OFF state still excluded via aria-checked / aria-pressed below.
  const btn = target.closest(
    'button, tp-yt-paper-checkbox, ytd-playlist-add-to-option-renderer, ' +
    'ytd-menu-service-item-renderer, ' +
    'yt-list-item-view-model, [class*="ytListItemViewModel"], ' +
    '[role="option"], [role="menuitem"]'
  )
  if (btn) {
    const text = buttonTextLower(btn)
    const label = (btn.getAttribute('aria-label') || '').toLowerCase()
    const hay = text + ' ' + label
    const isWatchLater = (
      /watch\s*later/i.test(hay) ||              // en
      /後で見る/.test(hay) ||                     // ja
      /나중에\s*보|나중에\s*볼/.test(hay) ||       // ko
      /稍后观看|稍後觀看/.test(hay) ||             // zh-CN / zh-TW
      /ver\s*más\s*tarde|ver\s*mas\s*tarde/i.test(hay) || // es
      /regarder\s*plus\s*tard/i.test(hay) ||     // fr
      /später\s*ansehen/i.test(hay) ||           // de
      /assistir\s*mais\s*tarde/i.test(hay) ||    // pt
      /guarda(re)?\s*più\s*tardi/i.test(hay)     // it
    )
    if (!isWatchLater) return null
    // OFF state — already in Watch Later list. The dropdown row uses
    // aria-checked (checkbox semantics); a plain button might use aria-pressed.
    if (btn.getAttribute('aria-checked') === 'true') return null
    if (btn.getAttribute('aria-pressed') === 'true') return null
    // Locale OFF stems — "Remove from Watch later" / "後で見るから削除" etc.
    if (/\bremove\b|\bundo\b/i.test(hay)) return null
    if (/から削除|削除|取り消|取消/.test(hay)) return null
    if (/취소|제거|해제|에서\s*제거/.test(hay)) return null
    if (/删除|刪除|移除/.test(hay)) return null
    if (/quitar|eliminar/i.test(hay)) return null
    if (/retirer|supprimer|annuler/i.test(hay)) return null
    if (/entfernen|aufheben/i.test(hay)) return null
    if (/remover|desfazer/i.test(hay)) return null
    if (/rimuovere|annullare/i.test(hay)) return null
    return 'watch-later'
  }
  return null
}

document.addEventListener('click', (event) => {
  // Capture pending video URL from the originating tile, if any. Runs
  // unconditionally so that ︙-button clicks (= which then open a global
  // popup detached from the tile) leave us with the URL to use when the
  // user selects "[後で見る] に保存" from that popup. Cheap — bails fast
  // when the click isn't inside a tile.
  captureVideoFromTile(event.target)

  const kind = getButtonKind(event.target)
  if (!kind) {
    // Diagnostic — clicks inside YouTube popups/menus that we failed to
    // detect, where the surrounding text looks like Watch Later. Captures
    // the DOM so we can spot novel layouts and update the selector.
    // (Session 59 round-3: specific videos misdetected even after the
    // session 58 selector expansion.)
    try {
      const inMenu = event.target && event.target.closest
        ? event.target.closest('ytd-menu-popup-renderer, ytd-popup-container, yt-list-view-model, ytd-popup-container-renderer, tp-yt-paper-dialog')
        : null
      if (inMenu) {
        const wrap = event.target.closest(
          '[role="menuitem"], [role="option"], button, ' +
          'yt-list-item-view-model, ytd-menu-service-item-renderer, ' +
          'ytd-playlist-add-to-option-renderer, tp-yt-paper-checkbox'
        ) || event.target
        const wrapText = ((wrap.innerText || wrap.textContent || '') + '').trim().slice(0, 160)
        const wrapLabel = wrap.getAttribute ? (wrap.getAttribute('aria-label') || '') : ''
        const hay = (wrapText + ' ' + wrapLabel).toLowerCase()
        const suspect = (
          /watch\s*later/.test(hay) ||
          /後で見る/.test(wrapText + wrapLabel) ||
          /나중에\s*보|나중에\s*볼/.test(hay) ||
          /稍后观看|稍後觀看/.test(wrapText + wrapLabel) ||
          /ver\s*más\s*tarde|ver\s*mas\s*tarde/.test(hay) ||
          /regarder\s*plus\s*tard/.test(hay) ||
          /später/.test(hay) ||
          /assistir\s*mais\s*tarde/.test(hay) ||
          /guarda(re)?\s*più\s*tardi/.test(hay)
        )
        if (suspect) {
          const insideLikeBVM = !!(wrap.closest && wrap.closest('like-button-view-model'))
          const p1 = wrap.parentElement
          const p2 = p1 ? p1.parentElement : null
          const p3 = p2 ? p2.parentElement : null
          const tagOf = (el) => {
            if (!el) return null
            const tag = el.tagName ? el.tagName.toLowerCase() : ''
            const cls = (el.className && el.className.toString && el.className.toString()) || ''
            return cls ? tag + '.' + cls.slice(0, 60) : tag
          }
          console.log('[AllMarks] YouTube Watch Later click NOT detected — please share this log', {
            url: location.href,
            wrapTag: wrap.tagName,
            wrapText,
            wrapLabel,
            wrapRole: wrap.getAttribute ? wrap.getAttribute('role') : null,
            wrapAriaChecked: wrap.getAttribute ? wrap.getAttribute('aria-checked') : null,
            wrapAriaPressed: wrap.getAttribute ? wrap.getAttribute('aria-pressed') : null,
            wrapClass: (wrap.className && wrap.className.toString && wrap.className.toString().slice(0, 200)) || null,
            insideLikeButtonViewModel: insideLikeBVM,
            parentChain: [tagOf(p1), tagOf(p2), tagOf(p3)],
          })
          console.log('[AllMarks] DOM outerHTML:', (wrap.outerHTML || '').slice(0, 1200))
        }
      }
    } catch (_) {}
    return
  }
  const source = kind === 'like' ? 'yt-like' : 'yt-watch-later'
  // Bail out before pill / DOM walks if the user toggled this source OFF.
  if (!isSourceEnabled(source)) return

  // URL resolution. /watch page → directly from location. Other pages
  // (= home / channel / search / playlist list view) → fall back to the
  // pending video URL captured from the most recent tile click.
  const directUrl = extractVideoUrl()
  let url
  let ogp
  if (directUrl) {
    url = directUrl
    ogp = extractVideoOgp(url)
  } else if (kind === 'watch-later') {
    const pending = resolvePendingVideo()
    if (!pending) return
    url = pending.url
    ogp = pending.ogp
    // Consume the pending capture — a second watch-later click on the same
    // popup would land on a different tile's option (popup closes between).
    pendingVideo = null
  } else {
    // Like outside /watch — no fallback (Like only exists on the watch page).
    return
  }

  // Mirror defense — URL is already in AllMarks. Skip the save dispatch (no
  // point hitting the offscreen iframe) but fire the duplicate pill so the
  // user still gets "Already saved" feedback. Covers both:
  //   (a) OFF-toggle clicks ("Remove from Watch later") that slipped past
  //       the text-stem OFF guard in getButtonKind,
  //   (b) deliberate re-clicks on already-saved videos.
  if (isUrlAlreadySaved(url)) {
    try {
      const btn = event.target && event.target.closest
        ? event.target.closest('button, yt-list-item-view-model, [class*="ytListItemViewModel"], [role="option"]')
        : null
      console.log('[AllMarks] YouTube auto-save suppressed — URL already in mirror', {
        url,
        kind,
        btnText: btn ? (btn.innerText || '').trim().slice(0, 80) : null,
        btnAriaLabel: btn ? btn.getAttribute('aria-label') : null,
        btnAriaChecked: btn ? btn.getAttribute('aria-checked') : null,
        btnAriaPressed: btn ? btn.getAttribute('aria-pressed') : null,
        btnRole: btn ? btn.getAttribute('role') : null,
        btnClass: btn ? (btn.className && btn.className.toString && btn.className.toString().slice(0, 120)) : null,
      })
    } catch (_) {}
    try { window.postMessage({ source: 'booklage-extension', type: 'pill-duplicate' }, '*') } catch (_) {}
    return
  }
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  if (!isExtensionAlive()) return
  try {
    console.log('[AllMarks] YouTube auto-save fired', { kind, source, url })
  } catch (_) {}
  // Fire the pill immediately via same-window postMessage so content.js
  // can show "Saving" within ~10ms instead of waiting for the background
  // round-trip (~100-300ms). content.js falls back to a stuck-saving
  // timeout if no final state (saved/error) follows.
  try { window.postMessage({ source: 'booklage-extension', type: 'pill-saving' }, '*') } catch (_) {}
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source,
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
