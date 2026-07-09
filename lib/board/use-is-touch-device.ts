import { useEffect, useState } from 'react'

/** True when the primary pointer is coarse (finger) — phones AND tablets.
 *  Gates the mobile save "+" button so it appears on any touch device
 *  regardless of the board's width-based mobile layout, while a mouse desktop
 *  (pointer: fine) never sees it. SSR-safe: starts false so the static-export
 *  prerender and first client render agree, then updates after mount. */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouch(mq.matches)
    const onChange = (): void => setIsTouch(mq.matches)
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])
  return isTouch
}
