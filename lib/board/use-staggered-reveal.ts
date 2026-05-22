import { useEffect, useRef, useState } from 'react'

/** Spreads the heavy cost of mounting many players over time. Given a `target`
 *  set of ids that *should* be playing (from the visibility pool), this reveals
 *  them ONE AT A TIME every `stepMs`, in the target's iteration order (the pool
 *  yields most-visible first, so the most visible cards light up first). Ids that
 *  leave `target` are removed IMMEDIATELY — there is no reason to stagger a stop,
 *  and stopping fast frees decoders for the cards still on screen.
 *
 *  Why: when a scroll brings a band of video cards into view, mounting every
 *  iframe / <video> in the same frame produces a CPU + network spike that freezes
 *  the page. Staggering the mounts turns that one big jolt into a smooth ramp. */
export function useStaggeredReveal(target: ReadonlySet<string>, stepMs = 150): ReadonlySet<string> {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drop anything no longer targeted, immediately (instant stop on leave).
  useEffect(() => {
    setRevealed((prev) => {
      const next = new Set([...prev].filter((id) => target.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [target])

  // Reveal the next not-yet-shown target id after one step. Re-runs whenever
  // `revealed` changes, so each addition schedules the following one → a ramp.
  useEffect(() => {
    let pending: string | undefined
    for (const id of target) { if (!revealed.has(id)) { pending = id; break } }
    if (pending === undefined) return
    const id = pending
    timerRef.current = setTimeout(() => {
      setRevealed((prev) => (prev.has(id) || !target.has(id) ? prev : new Set(prev).add(id)))
    }, stepMs)
    return (): void => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [target, revealed, stepMs])

  return revealed
}
