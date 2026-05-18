'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { pickRandomChar } from '@/lib/board/scramble'
import styles from './ChromeButton.module.css'

const SCRAMBLE_INTERVAL_MIN_MS = 10000
const SCRAMBLE_INTERVAL_MAX_MS = 20000
const SCRAMBLE_DURATION_MIN_MS = 125
const SCRAMBLE_DURATION_MAX_MS = 190
const STAGGER_MS = 11

type Props = {
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly className?: string
  readonly 'data-testid'?: string
}

export function ChromeButton({
  label,
  onClick,
  disabled,
  className,
  'data-testid': dataTestId,
}: Props): ReactElement {
  const [displayText, setDisplayText] = useState(label)
  const labelRef = useRef(label)
  labelRef.current = label
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    if (mql?.matches) return

    let cancelled = false

    const runScramble = (): void => {
      if (cancelled) return
      const target = labelRef.current
      const chars = [...target]
      const settleAt = chars.map((_, i) =>
        i * STAGGER_MS +
        SCRAMBLE_DURATION_MIN_MS +
        Math.random() * (SCRAMBLE_DURATION_MAX_MS - SCRAMBLE_DURATION_MIN_MS),
      )
      const start = performance.now()
      const tick = (): void => {
        if (cancelled) return
        const elapsed = performance.now() - start
        let allSettled = true
        const out = chars.map((c, i) => {
          if (elapsed < settleAt[i]) {
            allSettled = false
            return c === ' ' ? ' ' : pickRandomChar()
          }
          return c
        })
        setDisplayText(out.join(''))
        if (!allSettled) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          rafRef.current = null
          setDisplayText(target)
          scheduleNext()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const scheduleNext = (): void => {
      const delay =
        SCRAMBLE_INTERVAL_MIN_MS +
        Math.random() * (SCRAMBLE_INTERVAL_MAX_MS - SCRAMBLE_INTERVAL_MIN_MS)
      timerRef.current = setTimeout(() => {
        runScramble()
      }, delay)
    }

    scheduleNext()
    return (): void => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    setDisplayText(label)
  }, [label])

  const cls = className ? `${styles.btn} ${className}` : styles.btn

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
    >
      {displayText}
    </button>
  )
}
