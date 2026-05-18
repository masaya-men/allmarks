'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { pickRandomChar } from '@/lib/board/scramble'

type ChromeScrambleApi = {
  /** Text to render — managed by the hook. Either the unaltered label, or
   *  a scrambled variant during an active wobble / burst animation. */
  readonly display: string
  /** Trigger an all-character scramble burst (= used on hover). Cancels any
   *  in-flight idle wobble, scrambles every char for ~250-380ms with a small
   *  stagger, then settles back to the label and resumes idle scheduling. */
  readonly triggerBurst: () => void
}

/** ScrollMeter-style background micro-wobble (= every 3-6s, scramble one
 *  random non-space char for 100-160ms) plus an explicit hover burst hook
 *  for chrome text elements. Respects prefers-reduced-motion. */
export function useChromeScramble(label: string): ChromeScrambleApi {
  const [display, setDisplay] = useState(label)
  const labelRef = useRef(label)
  labelRef.current = label

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const modeRef = useRef<'idle' | 'wobble' | 'burst'>('idle')
  const reducedMotionRef = useRef(false)
  const scheduleWobbleRef = useRef<() => void>(() => {})

  // Keep `display` in sync when the label prop changes externally.
  useEffect(() => {
    setDisplay(label)
  }, [label])

  useEffect(() => {
    const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    if (mql?.matches) {
      reducedMotionRef.current = true
      return
    }
    reducedMotionRef.current = false

    let cancelled = false

    const scheduleWobble = (): void => {
      if (cancelled) return
      const delay = 3000 + Math.random() * 3000
      timerRef.current = setTimeout(runWobble, delay)
    }

    const runWobble = (): void => {
      if (cancelled || modeRef.current === 'burst') return
      modeRef.current = 'wobble'
      const chars = [...labelRef.current]
      const valid: number[] = []
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== ' ') valid.push(i)
      }
      if (valid.length === 0) {
        modeRef.current = 'idle'
        scheduleWobble()
        return
      }
      const idx = valid[Math.floor(Math.random() * valid.length)]
      const start = performance.now()
      const duration = 100 + Math.random() * 60
      const tick = (): void => {
        if (cancelled || modeRef.current !== 'wobble') return
        const elapsed = performance.now() - start
        if (elapsed < duration) {
          const out = chars.slice()
          out[idx] = pickRandomChar()
          setDisplay(out.join(''))
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setDisplay(labelRef.current)
          rafRef.current = null
          modeRef.current = 'idle'
          scheduleWobble()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    scheduleWobbleRef.current = scheduleWobble
    scheduleWobble()

    return (): void => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const triggerBurst = useCallback((): void => {
    if (reducedMotionRef.current) return

    // Cancel any in-flight wobble / pending idle timer.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    modeRef.current = 'burst'
    const chars = [...labelRef.current]
    const settleAt = chars.map((_, i) => i * 14 + 120 + Math.random() * 80)
    const start = performance.now()
    const burstTick = (): void => {
      if (modeRef.current !== 'burst') return
      const elapsed = performance.now() - start
      let allSettled = true
      const out = chars.map((c, i) => {
        if (elapsed < settleAt[i]) {
          allSettled = false
          return c === ' ' ? ' ' : pickRandomChar()
        }
        return c
      })
      setDisplay(out.join(''))
      if (!allSettled) {
        rafRef.current = requestAnimationFrame(burstTick)
      } else {
        setDisplay(labelRef.current)
        rafRef.current = null
        modeRef.current = 'idle'
        scheduleWobbleRef.current()
      }
    }
    rafRef.current = requestAnimationFrame(burstTick)
  }, [])

  return { display, triggerBurst }
}
