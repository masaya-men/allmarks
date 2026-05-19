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

function pruneRecent(now) {
  for (const [k, t] of recentlySent) {
    if (now - t > DEDUPE_WINDOW_MS) recentlySent.delete(k)
  }
}

function extractVideoUrl() {
  // We only auto-save from /watch?v=... pages. Channel pages and the homepage
  // would require per-thumbnail URL extraction which is out of scope here.
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

function buttonTextLower(btn) {
  return (btn.innerText || btn.textContent || '').trim().toLowerCase()
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Like — sits inside a <like-button-view-model> custom element. The
  // selector is language-neutral by design (= YouTube's component name).
  // OFF state (= already liked, click would un-like) is signalled via
  // aria-pressed="true" on the inner button.
  const likeBtn = target.closest('like-button-view-model button')
  if (likeBtn) {
    if (likeBtn.getAttribute('aria-pressed') === 'true') return null
    return 'like'
  }
  // Watch later — popup option inside the Save dropdown. The dropdown
  // surfaces this as a paper-checkbox or button with localised label.
  // We support major locales for the "Watch later" string + exclude OFF
  // state via aria-checked / aria-pressed / locale OFF stems.
  const btn = target.closest('button, tp-yt-paper-checkbox, ytd-playlist-add-to-option-renderer')
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

// Temporary diagnostic — dumps the clicked button + 2 ancestors so we can
// find a language-neutral OFF-state signal for both Like and Watch Later.
// Stripped in the next commit once the signal is found.
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
    ? event.target.closest('button, [role="button"], a[role="button"], tp-yt-paper-checkbox, ytd-playlist-add-to-option-renderer, ytd-toggle-button-renderer')
    : null
  if (btnDbg) {
    const text = (btnDbg.innerText || btnDbg.textContent || '').toLowerCase()
    const labelDbg = (btnDbg.getAttribute('aria-label') || '').toLowerCase()
    // Filter expanded for session 49 round 2: YouTube Like button on
    // localised UIs writes domain-specific verbs (= 高評価 in ja, 좋아요 in
    // ko, 喜欢 in zh, etc.) which the previous "いいね" filter missed.
    // Watch later equivalents (= 後で見る in ja, 保存 in many locales) added
    // so the dropdown menu items get dumped too.
    if (/like|watch|後で見る|いいね|高評価|保存|좋아|좋아요|저장|喜欢|喜歡|稍后|稍後|保存|me\s*gusta|guardar|j['']aime|enregistrer|gefällt|speichern|piace|gostei|salvar/i.test(text + ' ' + labelDbg)) {
      // JSON.stringify so Chrome's deferred-eval doesn't elide the attrs
      // object when the user copies the console transcript out as text.
      console.log('[allmarks-yt] ' + JSON.stringify({
        tag: btnDbg.tagName,
        attrs: dumpAttrs(btnDbg),
        parentTag: btnDbg.parentElement && btnDbg.parentElement.tagName,
        parentAttrs: dumpAttrs(btnDbg.parentElement),
        grandparentTag: btnDbg.parentElement && btnDbg.parentElement.parentElement && btnDbg.parentElement.parentElement.tagName,
        grandparentAttrs: btnDbg.parentElement ? dumpAttrs(btnDbg.parentElement.parentElement) : null,
        text: (btnDbg.innerText || btnDbg.textContent || '').slice(0, 80),
      }))
    }
  }
  const kind = getButtonKind(event.target)
  if (!kind) return
  const url = extractVideoUrl()
  if (!url) return
  const now = Date.now()
  pruneRecent(now)
  const dedupeKey = kind + ':' + url
  if (recentlySent.has(dedupeKey)) return
  recentlySent.set(dedupeKey, now)
  const ogp = extractVideoOgp(url)
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({
      type: 'booklage:auto-save',
      source: kind === 'like' ? 'yt-like' : 'yt-watch-later',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
