import { useEffect, useRef, useState } from 'react'

/** Ease-out cubic: fast start, gentle settle — matches the app's other
 *  hold/press micro-interactions (TrashConfirmDialog's fill, etc). */
export function easeOutCubic(x: number): number {
  const clamped = Math.min(1, Math.max(0, x))
  return 1 - Math.pow(1 - clamped, 3)
}

/** The interpolated integer count to display `elapsedMs` into a
 *  `durationMs` roll from `from` to `to`. Snaps to `to` once elapsed
 *  reaches (or exceeds) the duration, or immediately when durationMs<=0. */
export function rollingCountValue(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return to
  const t = elapsedMs / durationMs
  if (t >= 1) return to
  return Math.round(from + (to - from) * easeOutCubic(t))
}

/** Animates a displayed integer toward `value` whenever it changes (e.g. a
 *  tag's bookmark count after a bulk-assign click) — an odometer-style
 *  roll-up rather than an instant digit swap. Restarts smoothly from
 *  wherever the current animation is if `value` changes again mid-roll. */
export function useRollingCount(value: number, durationMs = 350): number {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    const to = value
    if (from === to) return undefined
    const start = performance.now()
    let rafId: number
    const tick = (now: number): void => {
      const elapsed = now - start
      const v = rollingCountValue(from, to, elapsed, durationMs)
      displayRef.current = v
      setDisplay(v)
      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(tick)
      }
    }
    rafId = requestAnimationFrame(tick)
    return (): void => cancelAnimationFrame(rafId)
  }, [value, durationMs])

  return display
}
