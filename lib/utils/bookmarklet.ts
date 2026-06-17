import { resolveMaybeRelative } from './url-resolve'

export interface OgpData {
  readonly title: string
  readonly image: string
  readonly description: string
  readonly siteName: string
  readonly favicon: string
  readonly url: string
}

export function extractOgpFromDocument(doc: Document): OgpData {
  const meta = (selector: string): string => {
    const el = doc.querySelector(selector)
    return el?.getAttribute('content') ?? ''
  }
  const link = (selector: string): string => {
    const el = doc.querySelector(selector)
    return el?.getAttribute('href') ?? ''
  }

  const url = doc.location.href
  const title = meta('meta[property="og:title"]') || doc.title || url
  const rawImage = meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]') || ''
  const image = resolveMaybeRelative(rawImage, url)
  const description = (meta('meta[property="og:description"]') || meta('meta[name="description"]') || '').slice(0, 200)
  const siteName = meta('meta[property="og:site_name"]') || doc.location.hostname
  const rawFavicon = link('link[rel="icon"]') || link('link[rel="shortcut icon"]') || '/favicon.ico'
  const favicon = resolveMaybeRelative(rawFavicon, url)

  return { title, image, description, siteName, favicon, url }
}

/**
 * Inline bookmarklet source. Mirrors extractOgpFromDocument semantics but
 * written as a compact ES5-safe IIFE.
 *
 * Two paths, decided at runtime:
 *
 * (A) Extension present (data-booklage-extension="1" on <html>):
 *     postMessage("booklage:save-via-extension") → extension content script
 *     forwards to the background SW which runs dispatchSave silently. No
 *     popup, no host-page toast — the extension's cursor pill (or PiP card
 *     slide-in) provides feedback. This is the preferred UX.
 *
 * (B) Extension not present (fallback for visitors without the extension):
 *     Open <APP>/save?... popup at the final window size (300×380).
 *     The popup is the primary feedback surface — it shows the Saved
 *     confirmation itself and stays open until the user dismisses it.
 *     No host-page toast is injected.
 *
 * Why a popup is still needed in path B: Chrome's storage partitioning
 * (Chrome 115+) isolates AllMarks-origin iframes embedded in 3rd-party
 * pages from the AllMarks main tab + PiP. The popup opens a top-level
 * AllMarks tab where IDB and BroadcastChannel work in the first-party
 * partition. Service workers and Storage Access API are also partitioned.
 * The Chrome extension is the only web-platform-clean way to bypass this
 * without a popup.
 *
 * NOTE: The programmatic identifiers inside BOOKMARKLET_SOURCE
 * (`data-booklageExtension`, `booklage:save-via-extension`, window name
 * `booklage-save`) intentionally retain the legacy `booklage` prefix —
 * they form a stable cross-process API between the bookmarklet, the
 * Chrome extension content script, and the `/save` route. Renaming would
 * break already-installed bookmarklets on user browsers.
 *
 * Keep this in sync with extractOgpFromDocument.
 */
const BOOKMARKLET_SOURCE = `(function(){var d=document,l=location,m=function(s){var e=d.querySelector(s);return e?e.getAttribute('content')||'':'';},k=function(s){var e=d.querySelector(s);return e?e.getAttribute('href')||'':'';},r=function(h,b){if(!h)return'';if(/^https?:\\/\\//i.test(h))return h;if(h.indexOf('//')===0)return'https:'+h;try{return new URL(h,b).href}catch(e){return''}},u=l.href,t=m('meta[property="og:title"]')||d.title||u,i=r(m('meta[property="og:image"]')||m('meta[name="twitter:image"]')||'',u),ds=(m('meta[property="og:description"]')||m('meta[name="description"]')||'').slice(0,200),sn=m('meta[property="og:site_name"]')||l.hostname,f=r(k('link[rel="icon"]')||k('link[rel="shortcut icon"]')||'/favicon.ico',u);if(d.documentElement&&d.documentElement.dataset&&d.documentElement.dataset.booklageExtension==='1'){var nc='b'+Date.now()+Math.random().toString(36).slice(2,7);window.postMessage({type:'booklage:save-via-extension',ogp:{url:u,title:t,image:i,description:ds,siteName:sn,favicon:f},nonce:nc},'*');return}var p=new URLSearchParams({url:u,title:t,image:i,desc:ds,site:sn,favicon:f});window.open('__APP_URL__/save?'+p.toString(),'booklage-save','width=320,height=320,left='+Math.max(0,screen.availWidth-320-20)+',top='+Math.max(0,screen.availHeight-320-20)+',toolbar=0,menubar=0,location=0,status=0,resizable=0,scrollbars=0')})();`

/**
 * Generate the `javascript:` URI for the AllMarks bookmarklet.
 * @param appUrl — AllMarks origin (e.g. https://booklage.pages.dev or http://localhost:3000)
 * @returns Full `javascript:...` URI ready to be placed in an `<a href>`
 */
export function generateBookmarkletUri(appUrl: string): string {
  // appUrl is embedded inside a JS single-quoted string literal in BOOKMARKLET_SOURCE.
  // Escape any single quote / backslash so the IIFE stays parseable for arbitrary origins.
  const escaped = appUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return 'javascript:' + BOOKMARKLET_SOURCE.replace('__APP_URL__', escaped)
}
