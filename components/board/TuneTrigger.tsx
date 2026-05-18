'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactElement } from 'react'
import { pickRandomChar } from '@/lib/board/scramble'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import { t } from '@/lib/i18n/t'
import styles from './TuneTrigger.module.css'

/** v4-inplace scramble timing. */
const STAGGER_MS = 11
const SCRAMBLE_MIN_MS = 125
const SCRAMBLE_MAX_MS = 190
const LEAVE_GRACE_MS = 180

/** Amendment 1: super-precision drag math. 30000 = 3× more precise than
 *  PrecisionSlider's 10000 — 1 mouse pixel ≈ 0.02 W unit / 0.01 G unit.
 *  Full-range drag requires 30000 px (≈ 16 user screens); Shift+drag is
 *  10× faster for jumps. */
const MOUSE_PX_FOR_FULL_RANGE = 30000
const SHIFT_SPEED_MULTIPLIER = 10

/** Pill track length + chip half-inset so the chip doesn't visually clip
 *  the track endpoints. Mirrors the Visual Companion demo. */
const TRACK_WIDTH_PX = 100
const CHIP_INSET_PX = 18

type CellKind = 'label' | 'num' | 'dim'
type CellScope = 'w' | 'g' | 'reset' | null
type Cell = { ch: string; kind: CellKind; scope?: CellScope }
type AnimatedCell = Cell & { settleAt: number }

type Phase = 'idle-tune' | 'opening' | 'idle-readout' | 'closing'

function buildReadoutCells(widthPx: number, gapPx: number): Cell[] {
  const wStr = widthPx.toFixed(2)
  const gStr = gapPx.toFixed(2)
  // Amendment 1: dropped 'W ' and 'G ' labels — chip number alone communicates,
  // user discovers function by drag interaction.
  const parts: { text: string; kind: CellKind; scope?: CellScope }[] = [
    { text: wStr, kind: 'num', scope: 'w' },
    { text: ' · ', kind: 'dim' },
    { text: gStr, kind: 'num', scope: 'g' },
    { text: ' · ', kind: 'dim' },
    // 'DEFAULT' (= 旧 WidthGapResetButton と同じ語彙) に戻して click target を拡張、
    // ↺ 1 文字は user 報告「押しづらい」 で却下。 7 文字 = 全部 data-cell-kind="reset"
    // で click 受ける。
    { text: 'DEFAULT', kind: 'label', scope: 'reset' },
  ]
  const cells: Cell[] = []
  for (const p of parts) {
    for (const ch of [...p.text]) cells.push({ ch, kind: p.kind, scope: p.scope ?? null })
  }
  return cells
}

function chipLeftPx(value: number, min: number, max: number): number {
  const range = max - min
  const fraction = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0
  const travel = TRACK_WIDTH_PX - CHIP_INSET_PX
  return CHIP_INSET_PX / 2 + fraction * travel
}

/** Emit HTML for the readout. Consecutive `scope='w' | 'g'` cells are
 *  wrapped in a pill-track + chip. Other cells render as flat spans. The
 *  `getCh` callback returns the character to display for each cell — for
 *  open animation it returns scrambled chars before settle, for close it
 *  returns null when a cell is consumed (causing it to be omitted). */
function emitReadoutHtml(
  cells: ReadonlyArray<AnimatedCell | Cell>,
  getCh: (cell: AnimatedCell | Cell, idx: number) => string | null,
  widthPx: number,
  gapPx: number,
): { html: string; anyContent: boolean } {
  let html = ''
  let anyContent = false
  let i = 0
  while (i < cells.length) {
    const cell = cells[i]
    if (cell.scope === 'w' || cell.scope === 'g') {
      const scope = cell.scope
      let groupHtml = ''
      let hasContent = false
      while (i < cells.length && cells[i].scope === scope) {
        const ch = getCh(cells[i], i)
        if (ch !== null) {
          hasContent = true
          anyContent = true
          groupHtml += `<span class="${styles.cell} ${styles.num}">${ch}</span>`
        }
        i++
      }
      if (!hasContent) continue
      const value = scope === 'w' ? widthPx : gapPx
      const min = scope === 'w' ? BOARD_SLIDERS.CARD_WIDTH_MIN_PX : BOARD_SLIDERS.CARD_GAP_MIN_PX
      const max = scope === 'w' ? BOARD_SLIDERS.CARD_WIDTH_MAX_PX : BOARD_SLIDERS.CARD_GAP_MAX_PX
      const left = chipLeftPx(value, min, max)
      html += `<span class="${styles.sliderWrap}">`
      html += `<span class="${styles.track}"></span>`
      html += `<span class="${styles.chip}" data-cell-kind="num-${scope}" data-scope="${scope}" style="left:${left}px">${groupHtml}</span>`
      html += `</span>`
    } else {
      const ch = getCh(cell, i)
      if (ch !== null) {
        anyContent = true
        const dk = cell.scope === 'reset' ? 'reset' : cell.kind
        html += `<span class="${styles.cell} ${styles[cell.kind]}" data-cell-kind="${dk}">${ch}</span>`
      }
      i++
    }
  }
  return { html, anyContent }
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
  const visibleLabel = label ?? t('board.chrome.tune')
  const btnRef = useRef<HTMLButtonElement>(null)
  const phaseRef = useRef<Phase>('idle-tune')
  const cellsRef = useRef<AnimatedCell[]>([])
  const phaseStartRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stickyOpenRef = useRef(false)
  const dragScopeRef = useRef<'w' | 'g' | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Refs kept in sync with props each render (PrecisionSlider pattern).
  // Used by both drag math and the HTML emitters so an in-flight rAF chain
  // always reads the latest value, not a stale closure capture.
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
    const { html } = emitReadoutHtml(cells, (c) => c.ch, widthRef.current, gapRef.current)
    el.innerHTML = html
  }, [])

  const tick = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const now = performance.now()
    const elapsed = now - phaseStartRef.current
    if (phaseRef.current !== 'opening') return
    let allSettled = true
    const { html } = emitReadoutHtml(
      cellsRef.current,
      (c) => {
        const cell = c as AnimatedCell
        if (elapsed < cell.settleAt) {
          allSettled = false
          return pickRandomChar()
        }
        return cell.ch
      },
      widthRef.current,
      gapRef.current,
    )
    el.innerHTML = html
    if (!allSettled) {
      rafIdRef.current = requestAnimationFrame(tick)
    } else {
      phaseRef.current = 'idle-readout'
      writeIdleReadout()
      rafIdRef.current = null
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
    const { html, anyContent } = emitReadoutHtml(
      cellsRef.current,
      (c) => {
        const cell = c as AnimatedCell
        if (elapsed < cell.settleAt) return pickRandomChar()
        return null
      },
      widthRef.current,
      gapRef.current,
    )
    el.innerHTML = html
    if (anyContent) {
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

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLElement
    const kind = target.dataset.cellKind
    if (kind === 'reset') {
      e.preventDefault()
      e.stopPropagation()
      onReset()
      return
    }
    // Don't toggle sticky when click lands inside a chip (= part of drag UX).
    if (target.closest(`.${styles.chip}`)) return
    stickyOpenRef.current = !stickyOpenRef.current
    if (!stickyOpenRef.current) startClose()
  }, [onReset, startClose])

  // ESC closes sticky-open readout.
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

  // Outside-click closes sticky-open readout.
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

  // Drag-scrub. pointerdown anywhere inside a chip (= digit cell or chip
  // wrapper) starts a drag. The scope is read from the chip's data-scope.
  const handlePointerDown = useCallback((e: PointerEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLElement
    const chip = target.closest<HTMLElement>(`.${styles.chip}`)
    if (!chip) return
    const scope = chip.dataset.scope
    if (scope !== 'w' && scope !== 'g') return
    e.preventDefault()
    e.stopPropagation()
    dragScopeRef.current = scope
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

  // While the readout is rendered, value changes from drag-scrub must reflow
  // chip positions immediately. We re-render idle-readout when props change
  // and we're in idle-readout phase (= the chip is sitting still). During
  // opening/closing the tick loop re-emits HTML every frame so it picks up
  // ref changes naturally.
  useEffect(() => {
    if (phaseRef.current === 'idle-readout') {
      writeIdleReadout()
    }
  }, [widthPx, gapPx, writeIdleReadout])

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
