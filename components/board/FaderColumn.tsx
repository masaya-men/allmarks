'use client'

import { useCallback, useRef, type PointerEvent, type ReactElement } from 'react'
import styles from './FaderColumn.module.css'

/** Default-centered piecewise-linear position mapping: default value → 50%
 *  (track center), min → 0%, max → 100%. Same as legacy TuneTrigger chip
 *  mapping (Amendment 1) but applied to vertical axis. */
function valueToFraction(value: number, min: number, max: number, def: number): number {
  if (value <= def) {
    const below = def - min
    return below > 0 ? ((value - min) / below) * 0.5 : 0
  }
  const above = max - def
  return above > 0 ? 0.5 + ((value - def) / above) * 0.5 : 1
}

function fractionToValue(fraction: number, min: number, max: number, def: number): number {
  const f = Math.max(0, Math.min(1, fraction))
  if (f <= 0.5) return min + (f / 0.5) * (def - min)
  return def + ((f - 0.5) / 0.5) * (max - def)
}

const TICK_POSITIONS = Array.from({ length: 42 }, (_, i) => (i / 41) * 100)
const MOUSE_PX_FOR_FULL_RANGE = 30000
const SHIFT_SPEED_MULTIPLIER = 40

type Props = {
  readonly scope: 'w' | 'g'
  readonly value: number
  readonly min: number
  readonly max: number
  readonly def: number
  readonly onChange: (next: number) => void
  readonly label: string
}

export function FaderColumn({
  scope,
  value,
  min,
  max,
  def,
  onChange,
  label,
}: Props): ReactElement {
  const valueRef = useRef(value)
  valueRef.current = value
  const draggingRef = useRef(false)

  const fraction = valueToFraction(value, min, max, def)
  const handleTopPct = (1 - fraction) * 100

  const isHi = (tickPct: number): boolean => {
    const tickFraction = 1 - tickPct / 100
    return Math.abs(tickFraction - fraction) <= 0.10
  }

  const isMajor = (i: number): boolean => i % 5 === 0 || i === 41
  const isCenterMajor = (i: number): boolean => i === 20 || i === 21

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    if (rect.height > 0) {
      const clickY = e.clientY - rect.top
      const fr = Math.max(0, Math.min(1, 1 - clickY / rect.height))
      onChange(fractionToValue(fr, min, max, def))
    }
    draggingRef.current = true
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(e.pointerId)
    }
  }, [onChange, min, max, def])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    const range = max - min
    const ratio = range / MOUSE_PX_FOR_FULL_RANGE
    const eff = e.shiftKey ? ratio * SHIFT_SPEED_MULTIPLIER : ratio
    const delta = -e.movementY * eff
    const next = Math.max(min, Math.min(max, valueRef.current + delta))
    if (next !== valueRef.current) onChange(next)
  }, [onChange, min, max])

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const target = e.currentTarget
    if (
      typeof target.hasPointerCapture === 'function' &&
      target.hasPointerCapture(e.pointerId)
    ) {
      target.releasePointerCapture(e.pointerId)
    }
  }, [])

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
            style={{ top: `50%` }}
          />
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
