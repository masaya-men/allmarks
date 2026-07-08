import { useEffect, useState } from 'react'
import { MOBILE_BP_PX } from './constants'

/** True when the viewport is at/below the mobile breakpoint (MOBILE_BP_PX).
 *  Drives the board's mobile presentation (thin frame, N-column masonry,
 *  pruned/stacked header chrome). SSR-safe: starts false so the static-export
 *  prerender and the first client render agree on the desktop layout, then it
 *  updates after mount (post-mount user-state gate — no hydration mismatch).
 *  Uses a window-based media query (not the canvas width, which itself depends
 *  on the mobile branch) so the signal is stable and matches the CSS
 *  `@media (max-width: 640px)` breakpoint exactly. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP_PX}px)`)
    setIsMobile(mq.matches)
    const onChange = (): void => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
