import { useEffect, useRef, useState } from 'react'

const MIN_STEP_MS = 2600
const MAX_STEP_MS = 4200

/** Drives a card's ambient crossfade: returns the index of the frame to show.
 *  Advances on a per-instance, randomly-timed interval so cards never swap in
 *  unison (the board ripples rather than blinking together) and the tiny paint
 *  cost is spread over time. Static (always 0) when there are <2 frames. */
export function useSlideshowCycle(frameCount: number): number {
  const [index, setIndex] = useState(0)
  const countRef = useRef(frameCount)
  countRef.current = frameCount
  useEffect(() => {
    if (frameCount < 2) {
      setIndex(0)
      return
    }
    let timer: number
    const step = (): number => MIN_STEP_MS + Math.random() * (MAX_STEP_MS - MIN_STEP_MS)
    const tick = (): void => {
      setIndex((i) => (i + 1) % countRef.current)
      timer = window.setTimeout(tick, step())
    }
    // Random initial offset so two cards mounted together desync immediately.
    timer = window.setTimeout(tick, MIN_STEP_MS + Math.random() * (MAX_STEP_MS - MIN_STEP_MS))
    return (): void => window.clearTimeout(timer)
  }, [frameCount])
  return frameCount < 2 ? 0 : index
}
