'use client'

import { useEffect, useState } from 'react'
import { pickRandomChar } from '@/lib/board/scramble'

/** ScrollMeter-style single-character idle wobble. Every 3-6 seconds picks
 *  one random non-space index in the label and scrambles that character for
 *  100-160ms, then settles back. Subtle "alive" feel across chrome text.
 *
 *  Respects prefers-reduced-motion: returns the bare label unchanged. */
export function useIdleMicroScramble(label: string): string {
  const [display, setDisplay] = useState(label)

  useEffect(() => {
    setDisplay(label)
  }, [label])

  useEffect(() => {
    const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    if (mql?.matches) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null

    const schedule = (): void => {
      if (cancelled) return
      const delay = 3000 + Math.random() * 3000
      timer = setTimeout(run, delay)
    }

    const run = (): void => {
      if (cancelled) return
      const chars = [...label]
      const validIndices: number[] = []
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== ' ') validIndices.push(i)
      }
      if (validIndices.length === 0) {
        schedule()
        return
      }
      const idx = validIndices[Math.floor(Math.random() * validIndices.length)]
      const start = performance.now()
      const duration = 100 + Math.random() * 60
      const tick = (): void => {
        if (cancelled) return
        const elapsed = performance.now() - start
        if (elapsed < duration) {
          const out = chars.slice()
          out[idx] = pickRandomChar()
          setDisplay(out.join(''))
          rafId = requestAnimationFrame(tick)
        } else {
          setDisplay(label)
          rafId = null
          schedule()
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    schedule()

    return (): void => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [label])

  return display
}
