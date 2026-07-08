'use client'

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react'
import { BOARD_Z_INDEX, INTERACTION } from '@/lib/board/constants'
import type { ScrollDirection } from '@/lib/board/types'
import { classifyBoardPointerDown } from '@/lib/board/grab-gesture'
import type { GrabWiggleController } from './use-grab-wiggle'

type InteractionLayerProps = {
  readonly direction: ScrollDirection
  readonly onScroll: (deltaX: number, deltaY: number) => void
  /**
   * Whether the Space key is currently held. Owned by BoardRoot so CardsLayer
   * can also observe it and bail card-pointerdown handlers — letting the
   * event bubble up to InteractionLayer for pan engagement.
   */
  readonly spaceHeld: boolean
  /** Empty-board grab-wiggle controller. When enabled, a plain left-drag on the
   *  bare layer nudges the world and springs back instead of scrolling. */
  readonly wiggle?: GrabWiggleController
  /** Mobile (touch): the board scrolls natively via a real overflow container
   *  (BoardRoot), so this overlay must NOT swallow touch. When true it drops
   *  touch-action to pan-y and disables its own pointer/wheel handlers, letting
   *  taps reach cards (onClick) and swipes reach the native scroller. */
  readonly isMobile?: boolean
  readonly children?: ReactNode
}

export function InteractionLayer({
  direction,
  onScroll,
  spaceHeld,
  wiggle,
  isMobile = false,
  children,
}: InteractionLayerProps) {
  const dragRef = useRef<{ lastX: number; lastY: number } | null>(null)
  // Which gesture the current pointer sequence engaged: 'pan' uses dragRef +
  // onScroll (existing), 'wiggle' delegates to the grab-wiggle controller.
  const modeRef = useRef<'pan' | 'wiggle' | null>(null)
  const wiggleRef = useRef<GrabWiggleController | undefined>(wiggle)
  wiggleRef.current = wiggle
  // Mirror prop in a ref so the pointerdown handler reads the latest value
  // without forcing useCallback to re-bind every time spaceHeld toggles.
  const spaceHeldRef = useRef<boolean>(spaceHeld)
  spaceHeldRef.current = spaceHeld

  const isHorizontal = direction === 'horizontal'

  // ---- Smooth-scroll wheel integration ----
  //
  // Three-layer model designed to feel as smooth as a system-level
  // touchpad-style scroll on any refresh rate:
  //
  // 1. deltaMode normalization
  //    Firefox occasionally sends DOM_DELTA_LINE (deltaY ≈ 3 per notch)
  //    instead of pixels — translate to pixels so the multiplier behaves
  //    the same across browsers.
  //
  // 2. Wheel events accumulate into a "remaining distance" target rather
  //    than firing the scroll synchronously. New events stack additively.
  //
  // 3. Spring physics with critical damping
  //    Each frame integrates F = k·target − c·v − dt-scaled — a damped
  //    spring chasing the target. With c = 2√k (critical damping) the
  //    motion never overshoots while feeling physically natural. dt is
  //    measured per-frame so the spring behaves identically at 60, 90,
  //    120, 144, 240 Hz monitors (frame-rate independent).
  //
  // STIFFNESS controls the chase speed; DAMPING is locked to critical so
  // a tweak to STIFFNESS automatically rebalances. Settling time ≈
  // 4/√k seconds — at k=200 that's ≈283 ms, the sweet spot between
  // "snappy" and "drifty" for board scrolling.
  const WHEEL_STIFFNESS = 200
  const WHEEL_DAMPING = 2 * Math.sqrt(WHEEL_STIFFNESS) // critical
  // Cap dt so a tab-switch or main-thread stall (huge dt) doesn't fling
  // the spring across the whole canvas in one frame.
  const MAX_DT_S = 0.05

  const wheelStateRef = useRef<{
    targetDx: number
    targetDy: number
    velX: number
    velY: number
    lastTime: number
  }>({
    targetDx: 0,
    targetDy: 0,
    velX: 0,
    velY: 0,
    lastTime: 0,
  })
  const wheelRafRef = useRef<number | null>(null)

  const stepWheel = useCallback((now: number): void => {
    const s = wheelStateRef.current
    const dt = s.lastTime === 0
      ? 1 / 60
      : Math.min(MAX_DT_S, (now - s.lastTime) / 1000)
    s.lastTime = now

    // Spring force: F = k·(remaining distance) − c·velocity. target is the
    // signed remaining distance, so F has the same sign as target and
    // drives velocity toward depleting it.
    const ax = WHEEL_STIFFNESS * s.targetDx - WHEEL_DAMPING * s.velX
    const ay = WHEEL_STIFFNESS * s.targetDy - WHEEL_DAMPING * s.velY
    s.velX += ax * dt
    s.velY += ay * dt

    const stepX = s.velX * dt
    const stepY = s.velY * dt
    s.targetDx -= stepX
    s.targetDy -= stepY

    const stillEnough = (
      Math.abs(s.targetDx) < 0.05 &&
      Math.abs(s.targetDy) < 0.05 &&
      Math.abs(s.velX) < 0.5 &&
      Math.abs(s.velY) < 0.5
    )
    if (stillEnough) {
      s.targetDx = 0
      s.targetDy = 0
      s.velX = 0
      s.velY = 0
      s.lastTime = 0
      wheelRafRef.current = null
      return
    }

    if (stepX !== 0 || stepY !== 0) onScroll(stepX, stepY)
    wheelRafRef.current = requestAnimationFrame(stepWheel)
  }, [onScroll])

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>): void => {
      const m = INTERACTION.WHEEL_SCROLL_MULTIPLIER
      // Normalize deltaMode so all browsers contribute pixel-equivalent
      // deltas. Most send DOM_DELTA_PIXEL (=0); Firefox may send
      // DOM_DELTA_LINE (=1) at ≈3 lines per notch.
      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      else if (e.deltaMode === 2) dy *= window.innerHeight
      const delta = dy * m

      const s = wheelStateRef.current
      if (isHorizontal) {
        s.targetDx += delta
      } else {
        s.targetDy += delta
      }
      if (wheelRafRef.current === null) {
        wheelRafRef.current = requestAnimationFrame(stepWheel)
      }
    },
    [isHorizontal, stepWheel],
  )

  // Cancel any in-flight wheel animation when the layer unmounts so we don't
  // leak rAFs after navigating away from /board.
  useEffect(() => (): void => {
    if (wheelRafRef.current !== null) {
      cancelAnimationFrame(wheelRafRef.current)
      wheelRafRef.current = null
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      // Classify the gesture: pan (middle / Space+left / bare-layer when wiggle
      // off) keeps the original scroll behavior; 'wiggle' is a plain left-drag
      // on the bare layer when the grab-wiggle interaction is enabled; 'ignore'
      // is a non-modifier pointer over a card.
      const w = wiggleRef.current
      const intent = classifyBoardPointerDown({
        button: e.button,
        spaceHeld: spaceHeldRef.current,
        isSelfTarget: e.target === e.currentTarget,
        wiggleEnabled: !!w?.enabled,
      })
      if (intent === 'ignore') return
      // Suppress the browser's native dragstart + text/element selection + the
      // middle-button autoscroll, keeping our drag logic in sole control.
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      if (intent === 'wiggle' && w) {
        modeRef.current = 'wiggle'
        w.begin(e.clientX, e.clientY)
      } else {
        modeRef.current = 'pan'
        dragRef.current = { lastX: e.clientX, lastY: e.clientY }
      }
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (modeRef.current === 'wiggle') {
        wiggleRef.current?.move(e.clientX, e.clientY)
        return
      }
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.lastX
      const dy = e.clientY - d.lastY
      if (
        Math.abs(dx) < INTERACTION.DRAG_THRESHOLD_PX &&
        Math.abs(dy) < INTERACTION.DRAG_THRESHOLD_PX
      ) {
        return
      }
      const m = INTERACTION.EMPTY_DRAG_SCROLL_MULTIPLIER
      if (isHorizontal) {
        onScroll(-dx * m, 0)
      } else {
        onScroll(0, -dy * m)
      }
      d.lastX = e.clientX
      d.lastY = e.clientY
    },
    [isHorizontal, onScroll],
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (modeRef.current === 'wiggle') {
        wiggleRef.current?.end()
      }
      modeRef.current = null
      dragRef.current = null
    },
    [],
  )

  return (
    <div
      data-interaction-layer
      onWheel={isMobile ? undefined : handleWheel}
      onPointerDown={isMobile ? undefined : handlePointerDown}
      onPointerMove={isMobile ? undefined : handlePointerMove}
      onPointerUp={isMobile ? undefined : handlePointerUp}
      onPointerCancel={isMobile ? undefined : handlePointerUp}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: BOARD_Z_INDEX.INTERACTION_OVERLAY,
        // Mobile: let the native scroll container inside own vertical touch;
        // desktop keeps 'none' so its custom wheel / drag owns the gesture.
        touchAction: isMobile ? 'pan-y' : 'none',
        overflow: 'hidden',
        cursor: wiggle?.enabled ? (wiggle.grabbing ? 'grabbing' : 'grab') : undefined,
      }}
    >
      {children}
    </div>
  )
}
