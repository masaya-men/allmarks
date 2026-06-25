'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe, live detection of the paper-atelier board theme.
 *
 * Returns `false` on the server and the first client paint (so hydration is
 * identical), then reads `document.documentElement[data-theme-id]` after mount
 * and tracks runtime theme switches via a MutationObserver (BoardRoot flips the
 * attribute without a page reload). Used by chrome (ChromeButton / FilterPill /
 * TuneTrigger) to calm itself on paper — serif type, no character scramble, no
 * RGB glitch — and revert instantly when the user leaves the theme.
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
