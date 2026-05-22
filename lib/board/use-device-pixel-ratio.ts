import { useEffect, useState } from 'react'

/** Tracks window.devicePixelRatio and updates when it changes — which happens
 *  when the user drags the window between monitors of different pixel densities
 *  (e.g. a 4K display at 258% scaling → ~2.58, an FHD sub-monitor → ~1). The
 *  canonical way to observe a DPR change is a matchMedia `(resolution: Ndppx)`
 *  query that fires once when the ratio crosses N; we re-subscribe to the new
 *  ratio after each change so it keeps firing on every move. A `resize` listener
 *  is a belt-and-suspenders fallback for browsers/cases the media query misses. */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState<number>(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio))

  useEffect(() => {
    if (typeof window === 'undefined') return
    let mq: MediaQueryList | null = null

    const onChange = (): void => {
      setDpr(window.devicePixelRatio)
      subscribe() // the threshold moved with the ratio — re-arm at the new value
    }
    const subscribe = (): void => {
      mq?.removeEventListener('change', onChange)
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      mq.addEventListener('change', onChange)
    }

    subscribe()
    window.addEventListener('resize', onChange)
    return (): void => {
      mq?.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [])

  return dpr
}
