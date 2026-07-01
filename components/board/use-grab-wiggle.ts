'use client'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { computeGrabOffset, MAX_GRAB_PX, GRAB_SPRING } from '@/lib/board/rubber-band'

/** Imperative controller for the empty-board grab-wiggle. */
export type GrabWiggleController = {
  /** false under prefers-reduced-motion — callers fall back to scroll. */
  readonly enabled: boolean
  /** true between begin() and end() (drives the grabbing cursor). */
  readonly grabbing: boolean
  begin(clientX: number, clientY: number): void
  move(clientX: number, clientY: number): void
  end(): void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Owns the `--grab-x`/`--grab-y` CSS vars on `containerRef` and springs them
 *  back to 0 on release. Vars inherit to the board's layer wrappers, whose
 *  transforms scale them per depth weight. Disabled under reduced-motion.
 *
 *  @param opts.containerRef element carrying the CSS vars (board camera wrap)
 *  @param opts.resetKey     when this changes (e.g. theme switch), reset to 0
 */
export function useGrabWiggle(opts: {
  containerRef: RefObject<HTMLElement>
  resetKey?: unknown
}): GrabWiggleController {
  const { containerRef, resetKey } = opts

  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])

  const enabled = !reduced && !prefersReducedMotion()

  const originRef = useRef<{ x: number; y: number } | null>(null)
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  const writeVars = useCallback((x: number, y: number): void => {
    const el = containerRef.current
    if (!el) return
    el.style.setProperty('--grab-x', `${x}px`)
    el.style.setProperty('--grab-y', `${y}px`)
  }, [containerRef])

  const killTween = useCallback((): void => {
    if (tweenRef.current) {
      tweenRef.current.kill()
      tweenRef.current = null
    }
  }, [])

  const begin = useCallback((clientX: number, clientY: number): void => {
    if (!enabled) return
    killTween()
    offsetRef.current = { x: 0, y: 0 }
    writeVars(0, 0)
    originRef.current = { x: clientX, y: clientY }
    setGrabbing(true)
  }, [enabled, killTween, writeVars])

  const move = useCallback((clientX: number, clientY: number): void => {
    if (!enabled) return
    const origin = originRef.current
    if (!origin) return
    const offset = computeGrabOffset(origin.x, origin.y, clientX, clientY, MAX_GRAB_PX)
    offsetRef.current = offset
    writeVars(offset.x, offset.y)
  }, [enabled, writeVars])

  const end = useCallback((): void => {
    if (!enabled) return
    originRef.current = null
    setGrabbing(false)
    killTween()
    tweenRef.current = gsap.to(offsetRef.current, {
      x: 0,
      y: 0,
      duration: GRAB_SPRING.duration,
      ease: GRAB_SPRING.ease,
      onUpdate: () => writeVars(offsetRef.current.x, offsetRef.current.y),
      onComplete: () => { writeVars(0, 0); tweenRef.current = null },
    })
  }, [enabled, killTween, writeVars])

  // Reset on theme (or other keyed) change to avoid a stuck offset.
  useEffect(() => {
    killTween()
    originRef.current = null
    offsetRef.current = { x: 0, y: 0 }
    writeVars(0, 0)
    setGrabbing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Kill any in-flight tween on unmount.
  useEffect(() => (): void => { killTween() }, [killTween])

  return { enabled, grabbing, begin, move, end }
}
