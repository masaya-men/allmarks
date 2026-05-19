// extension/vimeo.js
// Auto-save to AllMarks when the user "Like"s or adds a Vimeo video to
// "Watch Later". Hooked: buttons whose aria-label matches the corresponding
// English strings. Vimeo localises some surfaces but the player chrome
// stays English for aria-labels in practice.
//
// We canonicalise the URL via og:url (Vimeo always sets it) and fall back
// to a strict pathname match — bare /{id}, /channels/{ch}/{id},
// /groups/{g}/videos/{id}, /showcase/{s}/video/{id}. Creator dashboards
// (/manage/...) and review links (/{user}/review/...) are intentionally
// excluded.

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

function readMeta(selector) {
  const e = document.querySelector(selector)
  return e ? e.getAttribute('content') || '' : ''
}

function extractVideoUrl() {
  // Prefer canonical og:url when present — Vimeo sets it on every watch
  // page and it's stable across embedded surfaces.
  const ogUrl = readMeta('meta[property="og:url"]')
  if (ogUrl && /^https?:\/\/vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/[^/]+\/video\/)?\d+/.test(ogUrl)) {
    return ogUrl
  }
  // Fallback: derive from pathname. We only accept shapes that map to a
  // single watch page; manage / review pages are skipped.
  const p = location.pathname
  if (/^\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  if (/^\/channels\/[^/]+\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  if (/^\/groups\/[^/]+\/videos\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  if (/^\/showcase\/[^/]+\/video\/\d+(?:\/|$)/.test(p)) return location.origin + p.replace(/\/$/, '')
  return null
}

function extractVideoOgp(url) {
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
    favicon: 'https://vimeo.com/favicon.ico',
    siteName: 'Vimeo',
  }
}

function getButtonKind(target) {
  if (!target || !target.closest) return null
  // Tag-agnostic match — Vimeo's player chrome wraps actions in <button> on
  // most layouts but newer ones use <div role="button"> / <a role="button">.
  const btn = target.closest('button, [role="button"], a[role="button"]')
  if (!btn) return null
  const cls = (btn.className && btn.className.toString && btn.className.toString()) || ''
  const label = (btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '')
  const pressed = btn.getAttribute('aria-pressed') === 'true'
  // OFF action exclusion FIRST — Vimeo localises both ON and OFF aria-labels
  // and the OFF strings ("『後で見る』 から削除" / "Remove from Watch Later" /
  // "Unlike" / "Unfollow" / etc.) contain stems we'd otherwise match. We
  // intentionally do NOT save on OFF (= taking away a like / WL would
  // trigger unwanted saves).
  //
  // aria-pressed="true" — Vimeo's toggle buttons advertise their current
  // state via ARIA. If the button is currently pressed, clicking it would
  // OFF-toggle. Session 49 user-reported regression: Vimeo Like got saved
  // on un-like because the aria-label didn't contain any of the verb stems
  // below (Vimeo writes a noun-state label like "Liked"/"いいね済"). The
  // aria-pressed check is the locale-proof OFF guard.
  if (pressed) return null
  // English OFF verbs + state
  if (/\bunlike\b|\bremove\b|\bundo\b|\bliked\b|\bunfavorite\b/i.test(label)) return null
  // Japanese OFF verbs + state (= 解除 / 取り消 / 済 / しました)
  if (/解除|取り消|取消|いいね済|いいねしました|から削除|削除/.test(label)) return null
  // Korean OFF (= 취소 cancel / 제거 remove / 해제 release)
  if (/취소|제거|해제|에서\s*제거|좋아요됨/.test(label)) return null
  // Chinese OFF (zh-CN / zh-TW)
  if (/取消|删除|刪除|移除|从.*删除|已喜欢|已喜歡|已收藏/.test(label)) return null
  // Spanish OFF (= quitar / eliminar / desfavorecer + state "ya te gusta")
  if (/quitar|eliminar|desfavorecer|ya\s*te\s*gusta/i.test(label)) return null
  // French OFF (= retirer / supprimer / annuler / aimé state)
  if (/retirer|supprimer|annuler|déjà\s*aimé/i.test(label)) return null
  // German OFF (= entfernen / aufheben)
  if (/entfernen|aufheben|nicht\s*mehr\s*gefällt/i.test(label)) return null
  // Portuguese OFF (= remover / desfazer / curtido state)
  if (/remover|desfazer|descurtir|já\s*curtido/i.test(label)) return null
  // Italian OFF (= rimuovere / annullare / piaciuto state)
  if (/rimuovere|annullare|già\s*piaciuto/i.test(label)) return null
  // Tier 1: class hint (= locale-proof, survives translation). Vimeo's
  // React components keep human-readable prefixes in classNames even after
  // hashing (e.g. "LikeButton_likeButton__xxx", "WatchLater_button__xxx").
  if (/watch.?later/i.test(cls)) return 'watch-later'
  if (/(^|[^a-z])Like([^a-z]|$)/i.test(cls)) return 'like'
  // Tier 2: localised aria-label / title fallback. Vimeo ships in ~17
  // languages — cover the major ones. Watch Later FIRST because Vimeo's
  // "Add to Watch Later" / "後で見る に追加" strings do not contain stems
  // that overlap with Like.
  if (
    /watch\s*later/i.test(label) ||                       // en
    /後で見る/.test(label) ||                              // ja
    /나중에\s*보|나중에\s*볼/.test(label) ||                // ko
    /稍后观看|稍後觀看/.test(label) ||                       // zh-CN / zh-TW
    /ver\s*más\s*tarde|ver\s*mas\s*tarde/i.test(label) || // es
    /regarder\s*plus\s*tard|à\s*voir\s*plus\s*tard/i.test(label) || // fr
    /später\s*(an)?sehen/i.test(label) ||                 // de
    /assistir\s*mais\s*tarde/i.test(label) ||             // pt
    /guarda(re)?\s*più\s*tardi/i.test(label)              // it
  ) return 'watch-later'
  if (
    /\blike\b/i.test(label) ||                            // en
    /いいね/.test(label) ||                                // ja
    /좋아/.test(label) ||                                  // ko
    /喜欢|喜歡|赞/.test(label) ||                           // zh
    /me\s*gusta/i.test(label) ||                          // es
    /j['']aime/i.test(label) ||                           // fr
    /gefällt\s*mir|liken/i.test(label) ||                 // de
    /gostei|curtir/i.test(label) ||                       // pt
    /mi\s*piace/i.test(label)                             // it
  ) return 'like'
  return null
}

// Temporary diagnostic — dumps every attribute of the clicked button and
// its parent so we can find a language-neutral OFF-state signal (= an
// internal data-* / class / aria-* that flips between ON and OFF, present
// in every locale). Stripped in the next commit once the signal is found.
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
    const clsDbg = (btnDbg.className && btnDbg.className.toString && btnDbg.className.toString()) || ''
    const labelDbg = (btnDbg.getAttribute('aria-label') || '') + ' / ' + (btnDbg.getAttribute('title') || '')
    if (/like|watch|後で見る|いいね|좋아|喜欢|gefällt|piace|gostei|gusta/i.test(clsDbg + ' ' + labelDbg)) {
      // JSON.stringify so Chrome's deferred-eval doesn't elide the attrs
      // object when the user copies the console transcript out as text.
      console.log('[allmarks-vimeo] ' + JSON.stringify({
        tag: btnDbg.tagName,
        attrs: dumpAttrs(btnDbg),
        parentTag: btnDbg.parentElement && btnDbg.parentElement.tagName,
        parentAttrs: dumpAttrs(btnDbg.parentElement),
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
      source: kind === 'watch-later' ? 'vimeo-watch-later' : 'vimeo-like',
      ogp,
    }).catch(() => {})
  } catch (_) {
    // Extension context invalidated mid-send; drop silently.
  }
}, true)
