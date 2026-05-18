'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import { pickRandomChar } from '@/lib/board/scramble'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import { t } from '@/lib/i18n/t'
import { FaderColumn } from './FaderColumn'
import styles from './TuneTrigger.module.css'

/** v4-inplace scramble timing. */
const STAGGER_MS = 11
const SCRAMBLE_MIN_MS = 125
const SCRAMBLE_MAX_MS = 190
const LEAVE_GRACE_MS = 1000

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

/** Emit HTML for the readout. All cells render as flat spans. W/G number
 *  cells use .num color; the 'reset' (= DEFAULT) cells get .reset class +
 *  state-based grey when both values are at default. `getCh` returns the
 *  character to display, or null to omit (= used during close animation). */
function emitReadoutHtml(
  cells: ReadonlyArray<AnimatedCell | Cell>,
  getCh: (cell: AnimatedCell | Cell, idx: number) => string | null,
  widthPx: number,
  gapPx: number,
): { html: string; anyContent: boolean } {
  let html = ''
  let anyContent = false
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const ch = getCh(cell, i)
    if (ch === null) continue
    anyContent = true
    if (cell.scope === 'w' || cell.scope === 'g') {
      html += `<span class="${styles.cell} ${styles.num}">${ch}</span>`
      continue
    }
    const isStateDefault =
      Math.abs(widthPx - BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX) < 0.005 &&
      Math.abs(gapPx - BOARD_SLIDERS.CARD_GAP_DEFAULT_PX) < 0.005
    const dk = cell.scope === 'reset' ? 'reset' : cell.kind
    const kindClass = cell.scope === 'reset' ? styles.reset : styles[cell.kind]
    const cls =
      cell.scope === 'reset' && isStateDefault
        ? `${styles.cell} ${kindClass} ${styles.resetIdle}`
        : `${styles.cell} ${kindClass}`
    html += `<span class="${cls}" data-cell-kind="${dk}">${ch}</span>`
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

  // While the readout is rendered, value changes from drag (= FaderColumn
  // in the drawer) must reflow the readout text immediately. We re-render
  // idle-readout when props change and we're in idle-readout phase. During
  // opening/closing the tick loop re-emits HTML every frame so it picks up
  // ref changes naturally.
  useEffect(() => {
    if (phaseRef.current === 'idle-readout') {
      writeIdleReadout()
    }
  }, [widthPx, gapPx, writeIdleReadout])

  return (
    <span
      className={styles.wrap}
      data-testid="tune-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={btnRef}
        type="button"
        data-testid="tune-trigger"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={handleClick}
      >
        {visibleLabel}
      </button>
      <div
        className={styles.drawer}
        data-testid="tune-drawer"
        data-open={expanded ? 'true' : 'false'}
        aria-hidden={!expanded}
      >
        <div className={styles.faderGroup}>
          <FaderColumn
            scope="w"
            value={widthPx}
            min={BOARD_SLIDERS.CARD_WIDTH_MIN_PX}
            max={BOARD_SLIDERS.CARD_WIDTH_MAX_PX}
            def={BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX}
            onChange={onChangeWidth}
            label="W"
          />
          <FaderColumn
            scope="g"
            value={gapPx}
            min={BOARD_SLIDERS.CARD_GAP_MIN_PX}
            max={BOARD_SLIDERS.CARD_GAP_MAX_PX}
            def={BOARD_SLIDERS.CARD_GAP_DEFAULT_PX}
            onChange={onChangeGap}
            label="G"
          />
        </div>
      </div>
    </span>
  )
}
