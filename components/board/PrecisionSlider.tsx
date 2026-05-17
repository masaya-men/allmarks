'use client'

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from 'react'
import { t } from '@/lib/i18n/t'
import styles from './PrecisionSlider.module.css'

/** マウス N px で min→max を移動する基準値。 大きいほど slider が「遅く動く」
 *  = 細かく狙える。
 *
 *  Session 39 (= NNNN.NN 表示化と同時にチューニング):
 *  - 1000 だった (spec §1-2 では 800-1500 の範囲想定) のを 10000 に増量。
 *  - 理由: NNNN.NN 表示にしたら、 元の 1000 では 1 px drag = 0.3 (Gap) /
 *    0.6 (Width) の値変化 = 表示の 2nd decimal が 「30 / 60 ずつ」 jump して
 *    user 報告「2-3 刻みでうまく動かせない」 に。 1 px = 0.03 (Gap) / 0.06
 *    (Width) に落として 2 decimal が smooth に動くようにした。
 *  - 副作用: MIN→MAX 全範囲を一気に drag するには 10000 px (= 大画面 7 つ
 *    分) 必要。 Gap / Width は一度設定したら基本動かさない値なので許容範囲、
 *    急ぎ大ジャンプしたい場合は (a) track click で フラクション ジャンプ、
 *    (b) Shift+drag で SHIFT_SPEED_MULTIPLIER 倍速、 (c) Home (= MIN) /
 *    End (= MAX) / Arrow (= ±1) の キーボードショートカットが使える。 */
const MOUSE_PX_FOR_FULL_RANGE = 10000

/** Shift キー押下中の drag 速度倍率。 業界一般慣習 (= Shift = 精密) の逆で
 *  「Shift = 速い」 を採用 (user 提案 2026-05-17 session 39)。 normal drag
 *  が既に slow precise (= 1 px で 0.03-0.06 単位の細かい変化) なので、
 *  Shift 押下中だけ「昔の速い感覚」 (= 1 px で 0.3-0.6 単位) に戻して
 *  大ジャンプを許す。 10 = MOUSE_PX_FOR_FULL_RANGE が 10× 増えた分を
 *  ちょうど打ち消す係数。 */
const SHIFT_SPEED_MULTIPLIER = 10

/** Format the slider's internal float value into a `NNNN` integer string
 *  + `NN` two-digit decimal string. PrecisionSlider's value model is float
 *  (mouse pixel movements are scaled by a sub-1 ratio), so users want to
 *  see the actual sub-integer value rather than a rounded display that
 *  hides the live drag motion (user feedback 2026-05-17, session 39).
 *
 *  Returns: { intStr: '0098', decStr: '34' } for input 98.345 → "0098.34". */
function formatPrecisionValue(n: number): { intStr: string; decStr: string } {
  const safe = Number.isFinite(n) ? n : 0
  const clamped = Math.max(0, Math.min(9999.99, safe))
  const fixed = clamped.toFixed(2)
  const [intRaw, decRaw] = fixed.split('.')
  return {
    intStr: (intRaw ?? '0').padStart(4, '0'),
    decStr: decRaw ?? '00',
  }
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min
  if (n > max) return max
  return n
}

type Props = {
  readonly label: string
  readonly min: number
  readonly max: number
  readonly value: number
  readonly onChange: (next: number) => void
  readonly testId?: string
  readonly ariaLabel?: string
}

/**
 * Custom pointer-based slider — replaces native `<input type=range>` so the
 * value moves much slower than the mouse, letting the user land exact
 * integer (or sub-integer) values. Used for the board's W (card width) and
 * G (card gap) controls.
 *
 * Interaction model (spec §3):
 * - pointerdown anywhere on track → `setPointerCapture`, drag starts
 * - pointermove during drag: `value += movementX × ratio`, where
 *   `ratio = (max - min) / 1000` so 1000px of mouse travel covers the
 *   entire range regardless of which slider — W and G feel identical
 * - pointerup releases capture, drag ends
 * - clicking without movement does NOT jump the value (= no native-style
 *   click-to-position; the entire affordance is drag)
 * - keyboard: arrow keys ±1, Home/End to min/max
 *
 * Value model: float — `onChange` fires with raw float values. Display
 * rounds to integer (4-digit zero-pad) but the internal value retains
 * precision for smooth sub-integer drag movement.
 */
export function PrecisionSlider({
  label,
  min,
  max,
  value,
  onChange,
  testId,
  ariaLabel,
}: Props): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const [dragging, setDragging] = useState(false)

  // Mouse-following tooltip: position is written directly to the tooltip's
  // inline style via ref each frame (= no React re-render per pointermove,
  // smooth follow). The CSS `:hover` selector handles opacity (= zero
  // logic on visibility, the browser handles it instantly).
  const updateTooltipPosition = useCallback((clientX: number, clientY: number): void => {
    const tooltip = tooltipRef.current
    const track = trackRef.current
    if (!tooltip || !track) return
    const rect = track.getBoundingClientRect()
    // Position relative to .track (= tooltip's positioned ancestor).
    // +18px y offset puts the pill below the cursor so it never sits
    // under the pointer (= hover target stays visible / hit-testable).
    tooltip.style.left = `${clientX - rect.left}px`
    tooltip.style.top = `${clientY - rect.top + 18}px`
  }, [])

  const ratio = (max - min) / MOUSE_PX_FOR_FULL_RANGE

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    if (typeof el.setPointerCapture === 'function') {
      el.setPointerCapture(e.pointerId)
    }

    // Click-to-jump (session 39 user request): if the pointer-down lands
    // on the bare track (= NOT the thumb), jump the value to that
    // fraction so user can land roughly where they want with one click,
    // then continue dragging for fine adjustment. Clicking ON the thumb
    // skips the jump — the thumb is the "precision drag" affordance,
    // the rest of the track is the "fast travel" affordance.
    //
    // jsdom guards: skip when rect width is 0 (= no layout, test env)
    // so existing drag tests don't accidentally trigger jumps.
    const isThumbClick = e.target === thumbRef.current
    if (!isThumbClick) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0) {
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const next = clamp(min + frac * (max - min), min, max)
        if (next !== valueRef.current) {
          valueRef.current = next
          onChange(next)
        }
      }
    }

    draggingRef.current = true
    setDragging(true)
  }, [min, max, onChange])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    // Always update tooltip position so the pill smoothly follows the
    // cursor across the track (= mouse-follow tooltip, user request).
    updateTooltipPosition(e.clientX, e.clientY)
    // Value movement only fires while actually dragging.
    if (!draggingRef.current) return
    // Shift = 速い (= 業界慣習の逆)。 normal drag が slow precise なので、
    // shift 押下中だけ 10× 速くして大ジャンプを許す。 user 提案 session 39。
    const effectiveRatio = e.shiftKey ? ratio * SHIFT_SPEED_MULTIPLIER : ratio
    const next = clamp(valueRef.current + e.movementX * effectiveRatio, min, max)
    if (next !== valueRef.current) {
      onChange(next)
    }
  }, [min, max, ratio, onChange, updateTooltipPosition])

  const handlePointerEnter = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    // Seed tooltip position on first frame of hover so it appears at the
    // cursor (not a stale position from the previous hover).
    updateTooltipPosition(e.clientX, e.clientY)
  }, [updateTooltipPosition])

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    const el = trackRef.current
    if (el && typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
    draggingRef.current = false
    setDragging(false)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    let next: number | null = null
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = valueRef.current - 1
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = valueRef.current + 1
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
    }
    if (next === null) return
    e.preventDefault()
    onChange(clamp(next, min, max))
  }, [min, max, onChange])

  const safeValue = Number.isFinite(value) ? value : min
  const pct = max > min ? ((safeValue - min) / (max - min)) * 100 : 0
  const clampedPct = Math.max(0, Math.min(100, pct))

  return (
    <label className={styles.row} aria-label={ariaLabel ?? label}>
      <span className={styles.label}>{label}</span>
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(safeValue)}
        aria-label={ariaLabel ?? label}
        data-testid={testId}
        data-dragging={dragging || undefined}
        onPointerEnter={handlePointerEnter}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.trackLine} aria-hidden="true" />
        <div
          ref={thumbRef}
          className={styles.thumb}
          aria-hidden="true"
          style={{ left: `${clampedPct}%` }}
        />
        {/* Session 39: custom hover tooltip — visual vocabulary copied from
            the extension's `booklage-pill` (= dark glass, backdrop blur,
            rounded pill, subtle border, soft drop shadow).
            - Position: mouse-follow via inline style set per pointermove
              (user request: cursor-anchored pill, not centered on track)
            - Visibility: CSS `:hover` (= zero JS, instant browser-native
              show/hide, fastest possible response)
            - Content: only the non-obvious bindings (= click-to-jump and
              shift-to-fast). Plain drag is intentionally not listed —
              "drag a slider" is universal.
            - i18n: text via `t()` keys so the 15-language launch handles
              this surface automatically. */}
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          role="tooltip"
          aria-hidden="true"
        >
          <span className={styles.tooltipText}>{t('board.slider.tooltipClick')}</span>
          <span className={styles.tooltipDot}>·</span>
          <span className={styles.tooltipText}>{t('board.slider.tooltipShift')}</span>
        </div>
      </div>
      <span className={styles.value}>
        {(() => {
          const { intStr, decStr } = formatPrecisionValue(safeValue)
          return (
            <>
              {intStr}
              <span className={styles.valueDim}>.{decStr}</span>
            </>
          )
        })()}
      </span>
    </label>
  )
}
