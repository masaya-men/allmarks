import { useEffect, useRef, useState } from 'react'

export type SpotlightFade = {
  /** Ids whose player should be MOUNTED right now (live + still fading out). */
  readonly mounted: ReadonlySet<string>
  /** Subset of `mounted` that is fading OUT (left the live set, about to unmount). */
  readonly leaving: ReadonlySet<string>
}

/** Bridges the instant live/not-live switch from the spotlight into a gentle
 *  crossfade: a card that leaves the live set stays mounted for `fadeMs` with a
 *  fade-out so the handoff isn't an abrupt cut, then unmounts (freeing its
 *  decoder/compositor work). Entering cards fade in via CSS on mount. */
export function useSpotlightFade(live: ReadonlySet<string>, fadeMs = 600): SpotlightFade {
  const [state, setState] = useState<SpotlightFade>({ mounted: new Set(), leaving: new Set() })
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    setState((prev) => {
      const mounted = new Set(prev.mounted)
      const leaving = new Set(prev.leaving)
      // Entering / staying live: ensure mounted, cancel any pending fade-out.
      for (const id of live) {
        mounted.add(id)
        leaving.delete(id)
        const t = timersRef.current.get(id)
        if (t) { clearTimeout(t); timersRef.current.delete(id) }
      }
      // Left the live set: mark leaving + schedule unmount after the fade.
      for (const id of prev.mounted) {
        if (!live.has(id) && !timersRef.current.has(id)) {
          leaving.add(id)
          timersRef.current.set(id, setTimeout(() => {
            timersRef.current.delete(id)
            setState((s) => {
              const m = new Set(s.mounted); m.delete(id)
              const l = new Set(s.leaving); l.delete(id)
              return { mounted: m, leaving: l }
            })
          }, fadeMs))
        }
      }
      return { mounted, leaving }
    })
  }, [live, fadeMs])

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current.clear()
  }, [])

  return state
}
