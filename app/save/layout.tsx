import type { ReactNode } from 'react'

/**
 * Route-segment layout for the bookmarklet save popup.
 *
 * Next.js App Router does not allow nested layouts to redeclare <html>/<body>,
 * so we inject a <style> tag that overrides the global background to pure black.
 * The browser parses this inline <style> while building the DOM and applies it
 * before first paint commit, eliminating the white flash that the popup window
 * shows when opened against the global #0a0a0a canvas (#000 reads as a clean
 * "stage" instead of the slightly-lit app theme).
 *
 * /save is its OWN route segment (not under (app)/), so it does not inherit the
 * board layout's pre-paint theme script. We replicate it here so the save popup
 * follows the user's chosen board theme (same-origin localStorage). On
 * paper-atelier the stage becomes parchment instead of the black default — the
 * theme-aware background rule below flips with the data-theme-id the script set.
 */
export default function SaveLayout({ children }: { children: ReactNode }): React.ReactElement {
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
          __html:
            `html, body { background: #000 !important; margin: 0; padding: 0; overflow: hidden; min-height: 0 !important; }` +
            `html[data-theme-id='paper-atelier'], html[data-theme-id='paper-atelier'] body { background: #efe6d2 !important; }`,
        }}
      />
      {children}
    </>
  )
}
