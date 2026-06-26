import type { ReactNode } from 'react'

/**
 * Route-segment layout for the extension's hidden save iframe.
 *
 * The iframe itself is invisible (transparent, 0-size) — its job is to run the
 * IndexedDB write in the allmarks.app origin and post the quick-tag payload back
 * to the content script, which renders the floating tag strip ON the host page.
 *
 * That strip is skinned from `readThemeTokens()` (SaveIframeClient), which reads
 * *computed* CSS custom properties off this document's <html>. Without the board
 * theme applied here, those tokens resolve to the dark default, so the strip
 * showed up dark even when the user's board is on paper-atelier. We replicate the
 * /save pre-paint theme script (same-origin localStorage) so `data-theme-id` is
 * set before readThemeTokens runs — the strip then follows the board theme
 * (parchment cream + ink on paper). No background change: the iframe stays
 * transparent; only the attribute matters for token resolution.
 */
export default function SaveIframeLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var t=localStorage.getItem('allmarks-theme-id');if(t)document.documentElement.setAttribute('data-theme-id',t)}catch(e){}",
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background: transparent; margin: 0; padding: 0; overflow: hidden; min-height: 0 !important; }`,
        }}
      />
      {children}
    </>
  )
}
