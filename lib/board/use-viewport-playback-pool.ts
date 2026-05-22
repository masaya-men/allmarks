import { useCallback, useEffect, useRef, useState } from 'react'
import { selectActivePlayers } from './viewport-playback-pool'

type Pool = {
  /** A card reports its current visibility ratio (0 = off-screen). */
  readonly report: (id: string, ratio: number) => void
  /** Ids that should currently play, capped at N, most-visible first. */
  readonly active: ReadonlySet<string>
}

/** Owns the per-card visibility ratio map and recomputes the active set on a
 *  trailing debounce (so fast scroll doesn't boot/kill players every frame).
 *  `minRatio` excludes barely-visible cards (e.g. a sliver at the screen edge). */
export function useViewportPlaybackPool(cap: number, debounceMs = 150, minRatio = 0): Pool {
  const ratiosRef = useRef<Map<string, number>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [active, setActive] = useState<ReadonlySet<string>>(new Set())

  const recompute = useCallback((): void => {
    setActive((prev) => {
      const next = selectActivePlayers(ratiosRef.current, cap, minRatio)
      if (next.length === prev.size && next.every((id) => prev.has(id))) return prev
      return new Set(next)
    })
  }, [cap, minRatio])

  const report = useCallback((id: string, ratio: number): void => {
    if (ratio <= 0) ratiosRef.current.delete(id)
    else ratiosRef.current.set(id, ratio)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(recompute, debounceMs)
  }, [recompute, debounceMs])

  // Recompute immediately if the cap changes (e.g. perf tuning / motion toggle).
  useEffect(() => { recompute() }, [recompute])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { report, active }
}
