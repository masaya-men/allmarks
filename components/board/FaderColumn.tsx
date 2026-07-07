'use client'

import { useCallback, useRef, type PointerEvent, type ReactElement } from 'react'
import { fillCandidates, snapToFill } from '@/lib/board/fill-snap'
import styles from './FaderColumn.module.css'

/** Linear position mapping: value → fraction along the track, min → 0%,
 *  max → 100%. The earlier mapping forced the default value to the track
 *  center (50%), but that compressed the two halves at different value-scales
 *  whenever the default wasn't the geometric midpoint of [min, max] — so the
 *  same mouse travel moved the handle ~3× faster on the narrower (lower) half
 *  (user report 2026-05-21: 「下方向だけ速い」). Going linear makes the handle
 *  rest at its real value position (off-center is fine with the new ruler) and
 *  keeps drag perfectly symmetric in both directions, because the drag itself
 *  is already linear in value. The default value is still marked on the track
 *  (see defaultMark) so reset keeps a visual reference. */
function valueToFraction(value: number, min: number, max: number): number {
  return max > min ? (value - min) / (max - min) : 0
}

function fractionToValue(fraction: number, min: number, max: number): number {
  const f = Math.max(0, Math.min(1, fraction))
  return min + f * (max - min)
}

const TICK_POSITIONS = Array.from({ length: 42 }, (_, i) => (i / 41) * 100)
const MOUSE_PX_FOR_FULL_RANGE = 30000

// Iteration 8: drag speeds inverted at user request. Plain drag is now the
// fast mode (= ratio × FAST_SPEED_MULTIPLIER) so navigation is quick by
// default; holding Shift drops back to the slow base ratio for precise
// fine-tuning. This matches the convention from most pro audio software
// (= Shift = precision / fine, plain = coarse / fast).
const FAST_SPEED_MULTIPLIER = 40

// Long-press threshold for "jump to clicked position". A plain pointer-down
// no longer jumps — that was hostile to fine-tuning, since clicking on the
// rail to start a drag would snap the value before the user could move. Now
// the pointer must stay roughly still for LONG_PRESS_MS to trigger the jump.
// If the pointer moves more than MOVE_THRESHOLD_PX before the timer fires, we
// cancel the jump and treat it as a normal drag from the current value.
const LONG_PRESS_MS = 350
const MOVE_THRESHOLD_PX = 4

type Props = {
  readonly scope: 'w' | 'g'
  readonly value: number
  readonly min: number
  readonly max: number
  readonly def: number
  readonly onChange: (next: number) => void
  readonly label: string
  /** Board packing width (viewport − 2·side padding). When set together with
   *  `otherValue`, the fader shows fill marks (the values that make the board's
   *  left/right margins equal) and snaps onto the nearest one on release. */
  readonly containerWidth?: number
  /** The fixed other-axis value used to compute fill points: the gap when this
   *  fader is W (scope='w'), the width when this fader is G (scope='g'). */
  readonly otherValue?: number
}

export function FaderColumn({
  scope,
  value,
  min,
  max,
  def,
  onChange,
  label,
  containerWidth,
  otherValue,
}: Props): ReactElement {
  const valueRef = useRef(value)
  valueRef.current = value
  const draggingRef = useRef(false)

  const fraction = valueToFraction(value, min, max)
  const handleTopPct = (1 - fraction) * 100
  // Default value's position on the track (top%), so the reset reference mark
  // sits at the real default rather than a forced 50% center.
  const defaultTopPct = (1 - valueToFraction(def, min, max)) * 100

  // Fill snapping: enabled once the board width and the other-axis value are
  // known. `axis` picks which side of N·width + (N−1)·gap = containerWidth this
  // fader drives. `fillMarks` are the values that make the board's left/right
  // margins equal (rendered as green notches on the track).
  const axis = scope === 'w' ? 'width' : 'gap'
  const snapEnabled =
    typeof containerWidth === 'number' && containerWidth > 0 && typeof otherValue === 'number'
  const fillMarks = snapEnabled
    ? fillCandidates(otherValue as number, containerWidth as number, axis, min, max)
    : []

  const isHi = (tickPct: number): boolean => {
    const tickFraction = 1 - tickPct / 100
    return Math.abs(tickFraction - fraction) <= 0.10
  }

  const isMajor = (i: number): boolean => i % 5 === 0 || i === 41
  const isCenterMajor = (i: number): boolean => i === 20 || i === 21

  // Long-press jump state. The timer is armed on pointerdown and fired
  // after LONG_PRESS_MS unless the pointer has moved MOVE_THRESHOLD_PX or
  // already been released. pointerStartRef holds the data the jump needs
  // (= the click Y position relative to the unit rect).
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerStartRef = useRef<{
    x: number
    y: number
    rectTop: number
    rectHeight: number
    clickY: number
  } | null>(null)

  const cancelJumpTimer = useCallback((): void => {
    if (jumpTimerRef.current) {
      clearTimeout(jumpTimerRef.current)
      jumpTimerRef.current = null
    }
  }, [])

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const clickY = e.clientY - rect.top

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rectTop: rect.top,
      rectHeight: rect.height,
      clickY,
    }

    cancelJumpTimer()
    jumpTimerRef.current = setTimeout(() => {
      const start = pointerStartRef.current
      if (start && start.rectHeight > 0) {
        const fr = Math.max(0, Math.min(1, 1 - start.clickY / start.rectHeight))
        onChange(fractionToValue(fr, min, max))
      }
      jumpTimerRef.current = null
    }, LONG_PRESS_MS)

    draggingRef.current = true
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(e.pointerId)
    }
  }, [onChange, min, max, cancelJumpTimer])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return

    // A meaningful pointer move cancels the long-press jump — the user is
    // dragging, so we shouldn't snap the value out from under them.
    const start = pointerStartRef.current
    if (start && jumpTimerRef.current) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.abs(dx) > MOVE_THRESHOLD_PX || Math.abs(dy) > MOVE_THRESHOLD_PX) {
        cancelJumpTimer()
      }
    }

    const range = max - min
    const ratio = range / MOUSE_PX_FOR_FULL_RANGE
    const eff = e.shiftKey ? ratio : ratio * FAST_SPEED_MULTIPLIER
    const delta = -e.movementY * eff
    const next = Math.max(min, Math.min(max, valueRef.current + delta))
    if (next !== valueRef.current) onChange(next)
  }, [onChange, min, max, cancelJumpTimer])

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    draggingRef.current = false
    cancelJumpTimer()
    pointerStartRef.current = null
    const target = e.currentTarget
    if (
      typeof target.hasPointerCapture === 'function' &&
      target.hasPointerCapture(e.pointerId)
    ) {
      target.releasePointerCapture(e.pointerId)
    }
    // Fill snap on release: if the dropped value lands near an even-margin
    // configuration, click onto it. Skipped while Shift is held (precision
    // mode — the user is fine-tuning and doesn't want a magnet) and when the
    // board container / other-axis value aren't known (snap disabled).
    if (
      !e.shiftKey &&
      typeof containerWidth === 'number' &&
      containerWidth > 0 &&
      typeof otherValue === 'number'
    ) {
      const snapped = snapToFill({
        value: valueRef.current,
        other: otherValue,
        containerWidth,
        axis,
        min,
        max,
      })
      if (snapped !== valueRef.current) onChange(snapped)
    }
  }, [cancelJumpTimer, onChange, containerWidth, otherValue, axis, min, max])

  return (
    <div className={styles.column} data-scope={scope}>
      <div
        className={styles.unit}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={styles.fader}>
          <div className={styles.track} data-testid="fader-track" />
          <div
            className={styles.defaultMark}
            data-testid="fader-default-mark"
            style={{ top: `${defaultTopPct}%` }}
          />
          {fillMarks.map((m) => (
            <div
              key={m}
              className={styles.fillMark}
              data-testid="fader-fill-mark"
              data-fill-value={m.toFixed(2)}
              style={{ top: `${(1 - valueToFraction(m, min, max)) * 100}%` }}
            />
          ))}
          <div
            className={styles.handle}
            data-testid="fader-handle"
            style={{ top: `${handleTopPct}%` }}
          />
        </div>
        <div className={styles.ruler} data-testid="radio-ruler">
          {TICK_POSITIONS.map((pct, i) => {
            const classes: string[] = [styles.tick]
            classes.push(isMajor(i) ? styles.major : styles.minor)
            if (isCenterMajor(i)) classes.push(styles.centerMajor)
            if (isHi(pct)) classes.push(styles.hi)
            return (
              <div
                key={i}
                data-tick=""
                data-tick-index={i}
                className={classes.join(' ')}
                style={{ top: `${pct}%` }}
              />
            )
          })}
        </div>
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
