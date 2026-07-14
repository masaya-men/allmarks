'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe, live detection of the paper-atelier board theme.
 *
 * Returns `false` on the server and the first client paint (so hydration is
 * identical), then reads `document.documentElement[data-theme-id]` after mount
 * and tracks runtime theme switches via a MutationObserver (BoardRoot flips the
 * attribute without a page reload). Used by content-level paper renders —
 * TagIndicatorStrip (washi-tape column placement) and Lightbox (paper sheet for
 * text-only cards instead of the dark generated-art placeholder) — and reverts
 * instantly when the user leaves the theme. Chrome (ChromeButton / FilterPill /
 * TuneTrigger) no longer branches on this: the sub1 chrome-skin-tokens work
 * neutralized those menus to be theme-agnostic.
 */
export function useIsPaperTheme(): boolean {
  const [paper, setPaper] = useState(false)
  useEffect(() => {
    const el = document.documentElement
    const read = (): void => {
      setPaper(el.getAttribute('data-theme-id') === 'paper-atelier')
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme-id'] })
    return (): void => obs.disconnect()
  }, [])
  return paper
}
