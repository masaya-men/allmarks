import { useEffect, useMemo, useRef, useState } from 'react'
import { reconcileSpotlight, rotateSpotlight, EMPTY_SPOTLIGHT, type SpotlightState } from './spotlight-rotation'

function sameIds(a: ReadonlySet<string>, b: readonly string[]): boolean {
  if (a.size !== b.length) return false
  for (const id of b) if (!a.has(id)) return false
  return true
}

/** Drives the rotating-spotlight playback set: at most `cap` of the `candidates`
 *  play at once, and every `intervalMs` one live card hands off to the next in
 *  line so the whole board cycles through. Reconciles immediately when the
 *  candidate set changes (scroll / motion toggle); rotates on a timer. The
 *  returned Set keeps a stable reference when the live ids are unchanged. */
export function useSpotlightRotation(
  candidates: ReadonlySet<string>,
  cap: number,
  intervalMs = 6000,
): ReadonlySet<string> {
  const stateRef = useRef<SpotlightState>(EMPTY_SPOTLIGHT)
  const [live, setLive] = useState<ReadonlySet<string>>(new Set())

  // A content signature so the reconcile effect only fires on real membership /
  // cap changes, not on every parent re-render (candidates is a fresh Set each
  // render). Order doesn't matter for change detection, so sort.
  const sig = useMemo(() => `${cap}#${[...candidates].sort().join('|')}`, [candidates, cap])

  useEffect(() => {
    stateRef.current = reconcileSpotlight(stateRef.current, candidates, cap)
    setLive((prev) => (sameIds(prev, stateRef.current.live) ? prev : new Set(stateRef.current.live)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  useEffect(() => {
    if (cap <= 0 || intervalMs <= 0) return
    const t = setInterval(() => {
      // Random promotion so the next-to-play isn't a predictable cycle.
      const next = rotateSpotlight(stateRef.current, cap, (len) => Math.floor(Math.random() * len))
      if (next === stateRef.current) return
      stateRef.current = next
      setLive((prev) => (sameIds(prev, next.live) ? prev : new Set(next.live)))
    }, intervalMs)
    return (): void => clearInterval(t)
  }, [cap, intervalMs])

  return live
}
