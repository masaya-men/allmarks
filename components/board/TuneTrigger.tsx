'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import { pickRandomChar } from '@/lib/board/scramble'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import { PRESETS, findActivePreset } from '@/lib/board/tune-presets'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { FaderColumn } from './FaderColumn'
import { TunePresetColumn } from './TunePresetColumn'
import styles from './TuneTrigger.module.css'

/** Header label shown when current W/G doesn't match any of the 5 presets. */
const CUSTOM_LABEL = 'CUSTOM'

function getActiveLabel(widthPx: number, gapPx: number): string {
  const id = findActivePreset(widthPx, gapPx)
  if (!id) return CUSTOM_LABEL
  const preset = PRESETS.find((p) => p.id === id)
  return preset?.label ?? CUSTOM_LABEL
}

/** v4-inplace scramble timing. */
const STAGGER_MS = 11
const SCRAMBLE_MIN_MS = 125
const SCRAMBLE_MAX_MS = 190
const LEAVE_GRACE_MS = 700

type CellKind = 'label' | 'num' | 'dim'
type CellScope = 'w' | 'g' | 'reset' | null
type Cell = { ch: string; kind: CellKind; scope?: CellScope }
type AnimatedCell = Cell & { settleAt: number }

type Phase = 'idle-tune' | 'opening' | 'idle-readout' | 'closing'

function buildReadoutCells(widthPx: number, gapPx: number, activeLabel: string): Cell[] {
  const wStr = widthPx.toFixed(2)
  const gStr = gapPx.toFixed(2)
  // Amendment 1: dropped 'W ' and 'G ' labels — chip number alone communicates,
  // user discovers function by drag interaction.
  // Iteration 3 (session 60): the trailing label tracks the active preset
  // (DENSE / TIGHT / DEFAULT / OPEN / AMBIENT) instead of always reading
  // 'DEFAULT'. CUSTOM is shown when W/G don't match any preset.
  const parts: { text: string; kind: CellKind; scope?: CellScope }[] = [
    { text: wStr, kind: 'num', scope: 'w' },
    { text: ' · ', kind: 'dim' },
    { text: gStr, kind: 'num', scope: 'g' },
    { text: ' · ', kind: 'dim' },
    { text: activeLabel, kind: 'label', scope: 'reset' },
  ]
  const cells: Cell[] = []
  for (const p of parts) {
    for (const ch of [...p.text]) cells.push({ ch, kind: p.kind, scope: p.scope ?? null })
  }
  return cells
}

/** Emit HTML for the readout. When `wrapNumGroups` is true (= settled
 *  idle-readout phase), consecutive scope='w' or 'g' cells are wrapped in
 *  a `.numGroup` span carrying a `data-glitch-text` of the group's text.
 *  CSS attaches `::before/::after` RGB ghosts to that wrapper so the
 *  glitch ghost width matches each number block (~50px) instead of the
 *  full expanded button (~195px). During opening/closing animation we
 *  keep wrapNumGroups=false so the scramble re-renders are cheap flat
 *  spans without constantly recreating numGroup boundaries. */
function emitReadoutHtml(
  cells: ReadonlyArray<AnimatedCell | Cell>,
  getCh: (cell: AnimatedCell | Cell, idx: number) => string | null,
  widthPx: number,
  gapPx: number,
  wrapNumGroups: boolean = false,
): { html: string; anyContent: boolean } {
  // Treat any preset match (= not just DEFAULT) as "static status" so the
  // reset label renders without the active-clickable affordance when the
  // current W/G corresponds to an explicit preset row.
  const isStateDefault = findActivePreset(widthPx, gapPx) !== null

  let html = ''
  let anyContent = false
  let i = 0
  while (i < cells.length) {
    const cell = cells[i]

    if (wrapNumGroups && (cell.scope === 'w' || cell.scope === 'g')) {
      const scope = cell.scope
      let groupHtml = ''
      let groupText = ''
      while (i < cells.length && cells[i].scope === scope) {
        const ch = getCh(cells[i], i)
        if (ch !== null) {
          anyContent = true
          groupHtml += `<span class="${styles.cell} ${styles.num}">${ch}</span>`
          groupText += ch
        }
        i++
      }
      if (groupText.length > 0) {
        html += `<span class="${styles.numGroup}" data-glitch-text="${groupText}">${groupHtml}</span>`
      }
      continue
    }

    const ch = getCh(cell, i)
    if (ch === null) { i++; continue }
    anyContent = true
    if (cell.scope === 'w' || cell.scope === 'g') {
      html += `<span class="${styles.cell} ${styles.num}">${ch}</span>`
      i++
      continue
    }
    const dk = cell.scope === 'reset' ? 'reset' : cell.kind
    const kindClass = cell.scope === 'reset' ? styles.reset : styles[cell.kind]
    const cls =
      cell.scope === 'reset' && isStateDefault
        ? `${styles.cell} ${kindClass} ${styles.resetIdle}`
        : `${styles.cell} ${kindClass}`
    html += `<span class="${cls}" data-cell-kind="${dk}">${ch}</span>`
    i++
  }
  return { html, anyContent }
}

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onChangeWidth: (next: number) => void
  readonly onChangeGap: (next: number) => void
  readonly onReset: () => void
  readonly onApplyPreset: (id: import('@/lib/board/tune-presets').PresetId) => void
  readonly label?: string
}

export function TuneTrigger({
  widthPx,
  gapPx,
  onChangeWidth,
  onChangeGap,
  onReset,
  onApplyPreset,
  label,
}: Props): ReactElement {
  const { t } = useI18n()
  const visibleLabel = label ?? t('board.chrome.tune')
  const btnRef = useRef<HTMLButtonElement>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const phaseRef = useRef<Phase>('idle-tune')
  const cellsRef = useRef<AnimatedCell[]>([])
  const phaseStartRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Refs kept in sync with props each render (PrecisionSlider pattern).
  // Used by both drag math and the HTML emitters so an in-flight rAF chain
  // always reads the latest value, not a stale closure capture.
  const widthRef = useRef(widthPx)
  const gapRef = useRef(gapPx)
  widthRef.current = widthPx
  gapRef.current = gapPx

  // Active preset label tracks the current W/G against the 5-preset
  // catalogue. Updates on every render so emitters always pick up the
  // latest label even mid-scramble.
  const activeLabel = getActiveLabel(widthPx, gapPx)
  const activeLabelRef = useRef(activeLabel)
  activeLabelRef.current = activeLabel

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
    const cells = buildReadoutCells(widthRef.current, gapRef.current, activeLabelRef.current)
    const { html } = emitReadoutHtml(cells, (c) => c.ch, widthRef.current, gapRef.current, true)
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
    const target = buildReadoutCells(widthRef.current, gapRef.current, activeLabelRef.current)
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
    const target = buildReadoutCells(widthRef.current, gapRef.current, activeLabelRef.current)
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

  // Idle micro-scramble (= ScrollMeter-style single-char wobble) while
  // collapsed. Picks a random non-space index every 3-6s, scrambles that
  // char for 100-160ms, then resets. Suspended when expanded (= hover/
  // sticky open: the reveal scramble owns the button content). Respects
  // prefers-reduced-motion.
  useEffect(() => {
    if (expanded) return
    const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    if (mql?.matches) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null

    const writeChars = (chars: string[]): void => {
      const el = btnRef.current
      if (!el) return
      el.innerHTML = chars
        .map((c) => `<span class="${styles.cell} ${styles.label}">${c}</span>`)
        .join('')
    }

    const schedule = (): void => {
      if (cancelled) return
      const delay = 3000 + Math.random() * 3000
      timer = setTimeout(run, delay)
    }

    const run = (): void => {
      if (cancelled) return
      const chars = [...visibleLabel]
      const validIndices: number[] = []
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== ' ') validIndices.push(i)
      }
      if (validIndices.length === 0) {
        schedule()
        return
      }
      const idx = validIndices[Math.floor(Math.random() * validIndices.length)]
      const start = performance.now()
      const duration = 100 + Math.random() * 60
      const tick = (): void => {
        if (cancelled) return
        const elapsed = performance.now() - start
        if (elapsed < duration) {
          const out = chars.slice()
          out[idx] = pickRandomChar()
          writeChars(out)
          rafId = requestAnimationFrame(tick)
        } else {
          writeChars(chars)
          rafId = null
          schedule()
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    schedule()

    return (): void => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [expanded, visibleLabel])

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

  // Click only handles the reset cell (↺). The drawer is hover-controlled;
  // there is no click-to-pin (removed at user request — hover open/close only).
  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLElement
    if (target.dataset.cellKind === 'reset') {
      e.preventDefault()
      e.stopPropagation()
      onReset()
    }
  }, [onReset])

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

  // When the active preset label changes (= user pressed a preset, or
  // dragged into/out of a preset's ±0.5 px window), re-trigger the scramble
  // cycle on the open readout so the label change reads as a glitch
  // animation rather than an instantaneous text swap. Only fires while
  // the drawer is in the settled idle-readout phase — opening/closing
  // phases own their own scramble and shouldn't be interrupted.
  const prevActiveLabelRef = useRef(activeLabel)
  useEffect(() => {
    if (prevActiveLabelRef.current === activeLabel) return
    prevActiveLabelRef.current = activeLabel
    if (phaseRef.current !== 'idle-readout') return
    const target = buildReadoutCells(widthRef.current, gapRef.current, activeLabel)
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
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    tick()
  }, [activeLabel, tick])

  return (
    <span
      ref={wrapRef}
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
        data-glitch-text={visibleLabel}
      >
        {visibleLabel}
      </button>
      <div
        className={styles.drawer}
        data-testid="tune-drawer"
        data-open={expanded ? 'true' : 'false'}
        aria-hidden={!expanded}
      >
        <TunePresetColumn
          widthPx={widthPx}
          gapPx={gapPx}
          onApply={onApplyPreset}
        />
        <span className={styles.drawerDivider} aria-hidden="true" />
        <div className={styles.drawerRight}>
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
          <div className={styles.opsLegend} aria-hidden="true">
            <div className={styles.opsRow}>
              <span className={styles.led} data-color="orange" />
              <span className={styles.opsText}>DRAG TO TUNE</span>
            </div>
            <div className={styles.opsRow}>
              <span className={styles.led} data-color="orange" />
              <span className={styles.opsText}>SHIFT TO SLOW</span>
            </div>
            <div className={styles.opsRow}>
              <span className={styles.led} data-color="green" />
              <span className={styles.opsText}>HOLD TO JUMP</span>
            </div>
            <div className={styles.opsRow}>
              <span className={styles.led} data-color="red" />
              <span className={styles.opsText}>CTRL+Z UNDO</span>
            </div>
            <div className={styles.opsRow}>
              <span className={styles.led} data-color="red" />
              <span className={styles.opsText}>CTRL+SHIFT+Z REDO</span>
            </div>
          </div>
        </div>
      </div>
    </span>
  )
}
