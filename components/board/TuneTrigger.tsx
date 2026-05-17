'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactElement } from 'react'
import { SCRAMBLE_CHARS, pickRandomChar } from '@/lib/board/scramble'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import styles from './TuneTrigger.module.css'

/** v4-inplace timing (= spec §2-3). */
const STAGGER_MS = 11
const SCRAMBLE_MIN_MS = 125
const SCRAMBLE_MAX_MS = 190
const LEAVE_GRACE_MS = 180

/** Drag-scrub math mirrors PrecisionSlider.tsx exactly. */
const MOUSE_PX_FOR_FULL_RANGE = 10000
const SHIFT_SPEED_MULTIPLIER = 10

type CellKind = 'label' | 'num' | 'dim'
type CellScope = 'w' | 'g' | 'reset' | null
type Cell = { ch: string; kind: CellKind; scope?: CellScope }
type AnimatedCell = Cell & { settleAt: number }

type Phase = 'idle-tune' | 'opening' | 'idle-readout' | 'closing'

function buildReadoutCells(widthPx: number, gapPx: number): Cell[] {
  const wStr = widthPx.toFixed(2)
  const gStr = gapPx.toFixed(2)
  const parts: { text: string; kind: CellKind; scope?: CellScope }[] = [
    { text: 'W ', kind: 'label' },
    { text: wStr, kind: 'num', scope: 'w' },
    { text: ' · ', kind: 'dim' },
    { text: 'G ', kind: 'label' },
    { text: gStr, kind: 'num', scope: 'g' },
    { text: ' · ', kind: 'dim' },
    { text: '↺', kind: 'label', scope: 'reset' },
  ]
  const cells: Cell[] = []
  for (const p of parts) {
    for (const ch of [...p.text]) cells.push({ ch, kind: p.kind, scope: p.scope ?? null })
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
  onChangeWidth,
  onChangeGap,
  onReset,
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

  // Refs kept in sync with props each render (same pattern as PrecisionSlider.tsx
  // line 105-106). writeIdleReadout reads from these refs instead of closing over
  // prop values — fixes stale-closure bug when props change mid-animation.
  const widthRef = useRef(widthPx)
  const gapRef = useRef(gapPx)
  widthRef.current = widthPx
  gapRef.current = gapPx

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
    const cells = buildReadoutCells(widthRef.current, gapRef.current)
    el.innerHTML = cells
      .map((c, i) => {
        const dk = c.kind === 'num' ? `num-${c.scope}` : c.scope === 'reset' ? 'reset' : c.kind
        return `<span class="${styles.cell} ${styles[c.kind]}" data-cell-kind="${dk}" data-cell-idx="${i}">${c.ch}</span>`
      })
      .join('')
  }, [])

  const tick = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const now = performance.now()
    const elapsed = now - phaseStartRef.current
    const phase = phaseRef.current

    if (phase === 'opening') {
      let allSettled = true
      const html = cellsRef.current
        .map((cell, i) => {
          const ch = elapsed < cell.settleAt ? pickRandomChar() : cell.ch
          if (elapsed < cell.settleAt) allSettled = false
          const dk = cell.kind === 'num' ? `num-${cell.scope}` : cell.scope === 'reset' ? 'reset' : cell.kind
          return `<span class="${styles.cell} ${styles[cell.kind]}" data-cell-kind="${dk}" data-cell-idx="${i}">${ch}</span>`
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
    const target = buildReadoutCells(widthRef.current, gapRef.current)
    cellsRef.current = target.map((c, i) => ({
      ch: c.ch,
      kind: c.kind,
      scope: c.scope ?? null,
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
  }, [tick])

  const closingTick = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const now = performance.now()
    const elapsed = now - phaseStartRef.current
    let anyVisible = false
    const html = cellsRef.current
      .map((cell, i) => {
        if (elapsed < cell.settleAt) {
          anyVisible = true
          const ch = pickRandomChar()
          const dk = cell.kind === 'num' ? `num-${cell.scope}` : cell.scope === 'reset' ? 'reset' : cell.kind
          return `<span class="${styles.cell} ${styles[cell.kind]}" data-cell-kind="${dk}" data-cell-idx="${i}">${ch}</span>`
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
    const target = buildReadoutCells(widthRef.current, gapRef.current)
    const n = target.length
    cellsRef.current = target.map((c, i) => ({
      ch: c.ch,
      kind: c.kind,
      scope: c.scope ?? null,
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
  }, [closingTick])

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
    if (stickyOpenRef.current) return
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      startClose()
      leaveTimerRef.current = null
    }, LEAVE_GRACE_MS)
  }, [startClose])

  // ── Sticky open + reset ──────────────────────────────────────────────────
  const stickyOpenRef = useRef(false)

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLElement
    const kind = target.dataset.cellKind
    if (kind === 'reset') {
      e.preventDefault()
      e.stopPropagation()
      onReset()
      return
    }
    // Click on any other cell or TUNE label: toggle sticky
    stickyOpenRef.current = !stickyOpenRef.current
    if (!stickyOpenRef.current) {
      // Sticky turned off; close immediately
      startClose()
    }
  }, [onReset, startClose])

  // ESC handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && stickyOpenRef.current) {
        stickyOpenRef.current = false
        startClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return (): void => window.removeEventListener('keydown', onKeyDown)
  }, [startClose])

  // Outside-click handler
  useEffect(() => {
    const onDocClick = (e: globalThis.MouseEvent): void => {
      if (!stickyOpenRef.current) return
      if (!btnRef.current?.contains(e.target as Node)) {
        stickyOpenRef.current = false
        startClose()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return (): void => document.removeEventListener('mousedown', onDocClick)
  }, [startClose])

  // ── Drag-scrub ────────────────────────────────────────────────────────────
  const dragScopeRef = useRef<'w' | 'g' | null>(null)

  const handlePointerDown = useCallback((e: PointerEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLElement
    const kind = target.dataset.cellKind
    if (kind !== 'num-w' && kind !== 'num-g') return
    e.preventDefault()
    e.stopPropagation()
    dragScopeRef.current = kind === 'num-w' ? 'w' : 'g'
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLButtonElement>): void => {
    const scope = dragScopeRef.current
    if (scope === null) return
    if (scope === 'w') {
      const range = BOARD_SLIDERS.CARD_WIDTH_MAX_PX - BOARD_SLIDERS.CARD_WIDTH_MIN_PX
      const ratio = range / MOUSE_PX_FOR_FULL_RANGE
      const eff = e.shiftKey ? ratio * SHIFT_SPEED_MULTIPLIER : ratio
      const next = Math.max(
        BOARD_SLIDERS.CARD_WIDTH_MIN_PX,
        Math.min(BOARD_SLIDERS.CARD_WIDTH_MAX_PX, widthRef.current + e.movementX * eff),
      )
      if (next !== widthRef.current) onChangeWidth(next)
    } else {
      const range = BOARD_SLIDERS.CARD_GAP_MAX_PX - BOARD_SLIDERS.CARD_GAP_MIN_PX
      const ratio = range / MOUSE_PX_FOR_FULL_RANGE
      const eff = e.shiftKey ? ratio * SHIFT_SPEED_MULTIPLIER : ratio
      const next = Math.max(
        BOARD_SLIDERS.CARD_GAP_MIN_PX,
        Math.min(BOARD_SLIDERS.CARD_GAP_MAX_PX, gapRef.current + e.movementX * eff),
      )
      if (next !== gapRef.current) onChangeGap(next)
    }
  }, [onChangeWidth, onChangeGap])

  const handlePointerUp = useCallback((e: PointerEvent<HTMLButtonElement>): void => {
    if (dragScopeRef.current === null) return
    dragScopeRef.current = null
    if (
      typeof e.currentTarget.hasPointerCapture === 'function' &&
      e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
      {visibleLabel}
    </button>
  )
}
