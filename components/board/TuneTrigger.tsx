'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { SCRAMBLE_CHARS, pickRandomChar } from '@/lib/board/scramble'
import styles from './TuneTrigger.module.css'

/** v4-inplace timing (= spec §2-3). */
const STAGGER_MS = 11
const SCRAMBLE_MIN_MS = 125
const SCRAMBLE_MAX_MS = 190
const LEAVE_GRACE_MS = 180

type CellKind = 'label' | 'num' | 'dim'
type Cell = { ch: string; kind: CellKind }
type AnimatedCell = Cell & { settleAt: number }

type Phase = 'idle-tune' | 'opening' | 'idle-readout' | 'closing'

function buildReadoutCells(widthPx: number, gapPx: number): Cell[] {
  const wStr = widthPx.toFixed(2)
  const gStr = gapPx.toFixed(2)
  const parts: { text: string; kind: CellKind }[] = [
    { text: 'W ', kind: 'label' },
    { text: wStr, kind: 'num' },
    { text: ' · ', kind: 'dim' },
    { text: 'G ', kind: 'label' },
    { text: gStr, kind: 'num' },
    { text: ' · ', kind: 'dim' },
    { text: '↺', kind: 'label' },
  ]
  const cells: Cell[] = []
  for (const p of parts) {
    for (const ch of [...p.text]) cells.push({ ch, kind: p.kind })
  }
  return cells
}

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onChangeWidth: (next: number) => void
  readonly onChangeGap: (next: number) => void
  readonly onReset: () => void
  readonly label?: string
}

export function TuneTrigger({
  widthPx,
  gapPx,
  onChangeWidth: _onChangeWidth,
  onChangeGap: _onChangeGap,
  onReset: _onReset,
  label,
}: Props): ReactElement {
  const visibleLabel = label ?? 'TUNE'
  const btnRef = useRef<HTMLButtonElement>(null)
  const phaseRef = useRef<Phase>('idle-tune')
  const cellsRef = useRef<AnimatedCell[]>([])
  const phaseStartRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Suppress unused import warning — SCRAMBLE_CHARS is used by Tasks 4-6
  void SCRAMBLE_CHARS

  const writeIdleTune = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    el.innerHTML = [...visibleLabel]
      .map((c) => `<span class="${styles.cell} ${styles.label}">${c}</span>`)
      .join('')
  }, [visibleLabel])

  const writeIdleReadout = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const cells = buildReadoutCells(widthPx, gapPx)
    el.innerHTML = cells
      .map((c) => `<span class="${styles.cell} ${styles[c.kind]}">${c.ch}</span>`)
      .join('')
  }, [widthPx, gapPx])

  const tick = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const now = performance.now()
    const elapsed = now - phaseStartRef.current
    const phase = phaseRef.current

    if (phase === 'opening') {
      let allSettled = true
      const html = cellsRef.current
        .map((cell) => {
          const ch = elapsed < cell.settleAt ? pickRandomChar() : cell.ch
          if (elapsed < cell.settleAt) allSettled = false
          return `<span class="${styles.cell} ${styles[cell.kind]}">${ch}</span>`
        })
        .join('')
      el.innerHTML = html
      if (!allSettled) {
        rafIdRef.current = requestAnimationFrame(tick)
      } else {
        phaseRef.current = 'idle-readout'
        writeIdleReadout()
        rafIdRef.current = null
      }
    }
  }, [writeIdleReadout])

  const startOpen = useCallback((): void => {
    if (phaseRef.current === 'opening' || phaseRef.current === 'idle-readout') return
    const target = buildReadoutCells(widthPx, gapPx)
    cellsRef.current = target.map((c, i) => ({
      ch: c.ch,
      kind: c.kind,
      settleAt:
        i * STAGGER_MS +
        SCRAMBLE_MIN_MS +
        Math.random() * (SCRAMBLE_MAX_MS - SCRAMBLE_MIN_MS),
    }))
    phaseRef.current = 'opening'
    phaseStartRef.current = performance.now()
    setExpanded(true)
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    tick()
  }, [widthPx, gapPx, tick])

  const closingTick = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const now = performance.now()
    const elapsed = now - phaseStartRef.current
    let anyVisible = false
    const html = cellsRef.current
      .map((cell) => {
        if (elapsed < cell.settleAt) {
          anyVisible = true
          const ch = pickRandomChar()
          return `<span class="${styles.cell} ${styles[cell.kind]}">${ch}</span>`
        }
        return '' // cell consumed → empty
      })
      .join('')
    el.innerHTML = html
    if (anyVisible) {
      rafIdRef.current = requestAnimationFrame(closingTick)
    } else {
      phaseRef.current = 'idle-tune'
      setExpanded(false)
      writeIdleTune()
      rafIdRef.current = null
    }
  }, [writeIdleTune])

  const startClose = useCallback((): void => {
    if (phaseRef.current === 'closing' || phaseRef.current === 'idle-tune') return
    const target = buildReadoutCells(widthPx, gapPx)
    const n = target.length
    cellsRef.current = target.map((c, i) => ({
      ch: c.ch,
      kind: c.kind,
      // Reverse stagger: rightmost cell finishes scrambling (empties) first.
      settleAt:
        (n - 1 - i) * STAGGER_MS +
        SCRAMBLE_MIN_MS +
        Math.random() * (SCRAMBLE_MAX_MS - SCRAMBLE_MIN_MS),
    }))
    phaseRef.current = 'closing'
    phaseStartRef.current = performance.now()
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    closingTick()
  }, [widthPx, gapPx, closingTick])

  // Initial idle render on mount.
  useEffect(() => {
    writeIdleTune()
    return (): void => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [writeIdleTune])

  const handleMouseEnter = useCallback((): void => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    startOpen()
  }, [startOpen])

  const handleMouseLeave = useCallback((): void => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      startClose()
      leaveTimerRef.current = null
    }, LEAVE_GRACE_MS)
  }, [startClose])

  return (
    <button
      ref={btnRef}
      type="button"
      data-testid="tune-trigger"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {visibleLabel}
    </button>
  )
}
