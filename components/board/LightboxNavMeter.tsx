'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement,
} from 'react'
import styles from './Lightbox.module.css'

type Props = {
  readonly current: number
  readonly total: number
  /** Stable per-card identity, currently used only as a render key. */
  readonly cardKey: string
  /** Snap-jump to a specific card index when the user releases a scrub. */
  readonly onJump?: (index: number) => void
  /** When true, render the meter even with total ≤ 1 (single-card decks).
   *  Default false: the Lightbox itself hides the meter when there's
   *  nothing to navigate. PiP overrides this so the meter stays visible
   *  as part of the always-on bottom chrome regardless of card count. */
  readonly alwaysShow?: boolean
  /** Counter render style. Default `'index-decimal'` keeps the historical
   *  PiP look (`[ NNNN.MMMM / TTTT.0000 ]` with a slot-machine decimal).
   *  `'range'` switches to the ScrollMeter look (`N1 — N2 / TOTAL`) so the
   *  board-level Lightbox meter visually matches the always-on ScrollMeter
   *  in the same canvas slot — opening/closing the Lightbox becomes a
   *  pure crossfade with no counter-format jump.
   *
   *  When `'range'`, `n1` / `n2` props are read instead of `current`. For
   *  the Lightbox-on-board case we wire `n1 === n2 === currentIndex+1` so
   *  the meter reads "you're zoomed into card #X of TOTAL". */
  readonly counterFormat?: 'index-decimal' | 'range'
  /** Range-format left number (= first visible card index, 1-based). Only
   *  read when `counterFormat === 'range'`. */
  readonly n1?: number
  /** Range-format middle number (= last visible card index, 1-based). Only
   *  read when `counterFormat === 'range'`. */
  readonly n2?: number
}

function pad4(n: number): string {
  return Math.max(0, Math.min(9999, Math.floor(n))).toString().padStart(4, '0')
}

/** Number of tick marks rendered on the ruler. Decoupled from `total` —
 *  the meter is a pure visual waveform, with current-card position shown
 *  as a localized amplitude swell on top of the global flow. */
const TICK_COUNT = 150

/** Counter slot-machine animation duration on card change. */
const COUNTER_ANIM_MS = 600

/** Range-format scramble windows. Kept in lockstep with `ScrollMeter.tsx`'s
 *  identical constants — the two meters share the same canvas slot via
 *  crossfade (session 39, B-#20), so their counter cadences MUST stay
 *  identical or the eye reads the swap as a "jitter" instead of a fade.
 *  Range numerals (n1, n2) scramble 600ms; total scrambles 1500ms so the
 *  headline number gets the longest read time. */
const SCRAMBLE_MS_RANGE = 600
const SCRAMBLE_MS_TOTAL = 1500

/** Per-frame ±1 jitter probability on settled values — keeps the counter
 *  "alive" even when nothing is changing. Total jitters slightly more than
 *  the range pair (matches ScrollMeter). */
const JITTER_PROB_RANGE = 0.06
const JITTER_PROB_TOTAL = 0.10

/** Periodic full-scramble: every 5-15s, pick one of the three digit groups
 *  and re-arm its scramble deadline for 600-1500ms. Same parameters as
 *  ScrollMeter so the two meters feel like one continuous device. */
const PERIODIC_INTERVAL_MIN_MS = 5000
const PERIODIC_INTERVAL_MAX_MS = 15000
const PERIODIC_SCRAMBLE_MIN_MS = 600
const PERIODIC_SCRAMBLE_MAX_MS = 1500

function nextPeriodicDelay(): number {
  return PERIODIC_INTERVAL_MIN_MS
    + Math.random() * (PERIODIC_INTERVAL_MAX_MS - PERIODIC_INTERVAL_MIN_MS)
}

function nextScrambleDuration(): number {
  return PERIODIC_SCRAMBLE_MIN_MS
    + Math.random() * (PERIODIC_SCRAMBLE_MAX_MS - PERIODIC_SCRAMBLE_MIN_MS)
}

/** Spring stiffness driving the swell-position chase between cards. With
 *  critical damping (DAMPING = 2√k) settle time ≈ 4/√k ≈ 225 ms — snappy
 *  enough to feel direct on a single ±1 card move, slow enough to read as
 *  a deliberate slide rather than a discrete jump. */
const SWELL_STIFFNESS = 320
const SWELL_DAMPING = 2 * Math.sqrt(SWELL_STIFFNESS)

export function LightboxNavMeter({
  current,
  total,
  onJump,
  alwaysShow,
  counterFormat = 'index-decimal',
  n1 = 0,
  n2 = 0,
}: Props): ReactElement | null {
  const trackRef = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<HTMLDivElement[]>([])
  const counterRef = useRef<HTMLSpanElement>(null)
  // Range-format spans (counterFormat === 'range'). Mirror ScrollMeter's
  // N1 / N2 / TOTAL layout so the board-level Lightbox meter renders an
  // identical readout to the always-on ScrollMeter underneath. Named
  // `*SpanRef` to distinguish from the existing numeric refs below.
  const n1SpanRef = useRef<HTMLSpanElement>(null)
  const n2SpanRef = useRef<HTMLSpanElement>(null)
  const totalSpanRef = useRef<HTMLSpanElement>(null)
  // Settled values + scramble deadlines, ref-stored so the rAF loop reads
  // them per-frame without triggering React re-renders. Mirrors
  // ScrollMeter's approach exactly so the two meters share visual cadence.
  const n1SettledRef = useRef<number>(n1)
  const n2SettledRef = useRef<number>(n2)
  const totalSettledRef = useRef<number>(total)
  const n1ScrambleUntilRef = useRef<number>(0)
  const n2ScrambleUntilRef = useRef<number>(0)
  const totalScrambleUntilRef = useRef<number>(0)
  const nextPeriodicAtRef = useRef<number>(0)
  // Stable mode flag the rAF loop reads each frame.
  const counterFormatRef = useRef<'index-decimal' | 'range'>(counterFormat)
  useEffect(() => { counterFormatRef.current = counterFormat }, [counterFormat])

  // Re-arm scramble deadlines on prop changes (range format only).
  useEffect(() => {
    if (counterFormat !== 'range') return
    if (n1 !== n1SettledRef.current) {
      n1SettledRef.current = n1
      n1ScrambleUntilRef.current = performance.now() + SCRAMBLE_MS_RANGE
    }
  }, [n1, counterFormat])
  useEffect(() => {
    if (counterFormat !== 'range') return
    if (n2 !== n2SettledRef.current) {
      n2SettledRef.current = n2
      n2ScrambleUntilRef.current = performance.now() + SCRAMBLE_MS_RANGE
    }
  }, [n2, counterFormat])
  useEffect(() => {
    if (counterFormat !== 'range') return
    if (total !== totalSettledRef.current) {
      totalSettledRef.current = total
      totalScrambleUntilRef.current = performance.now() + SCRAMBLE_MS_TOTAL
    }
  }, [total, counterFormat])

  // Refs that the rAF loop reads each frame. Updates here never trigger
  // React re-renders, so layout stays perfectly stable.
  const currentRef = useRef<number>(current)
  const totalRef = useRef<number>(total)
  const animUntilRef = useRef<number>(0)

  // ---- Smooth swell position ----
  // `displayedTickIdx` is what the rAF actually renders. It springs
  // toward the current card's tick index so a card change reads as a
  // smooth slide instead of a hard jump.
  const displayedTickIdxRef = useRef<number>(0)
  const swellVelRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)

  // ---- Drag scrubbing ----
  // While dragging, the swell tracks the pointer 1:1 (no spring lag) AND
  // the lightbox content live-flips through cards as the scrub crosses
  // card-index boundaries — feels like rapidly leafing through pages.
  const scrubTickIdxRef = useRef<number | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const onJumpRef = useRef<typeof onJump>(onJump)
  useEffect(() => { onJumpRef.current = onJump }, [onJump])

  // Initialize displayed swell to match the first `current` so we don't
  // animate in from tick 0 on mount.
  useEffect(() => {
    const cur = currentRef.current
    const tot = totalRef.current
    displayedTickIdxRef.current = tot > 1
      ? (cur / (tot - 1)) * (TICK_COUNT - 1)
      : (TICK_COUNT - 1) / 2
  }, [])

  // On card change: kick off the counter scramble animation; the swell
  // will smoothly spring to its new target via the rAF loop.
  useEffect(() => {
    currentRef.current = current
    totalRef.current = total
    animUntilRef.current = performance.now() + COUNTER_ANIM_MS
  }, [current, total])

  // Single rAF loop drives both the waveform and the counter text.
  useEffect(() => {
    let raf = 0
    const loop = (): void => {
      const now = performance.now()
      const t = now / 1000
      const cur = currentRef.current
      const tot = totalRef.current

      // ---- Determine swell center this frame ----
      const scrubTick = scrubTickIdxRef.current
      let centerTickIdx: number
      if (scrubTick !== null) {
        // Drag mode: pointer is the source of truth, snap displayed
        // directly to it (no spring) for ばらばらばら 1:1 follow.
        displayedTickIdxRef.current = scrubTick
        swellVelRef.current = 0
        lastFrameTimeRef.current = 0
        centerTickIdx = scrubTick

        // Live page-flip: as the scrub crosses card-index boundaries we
        // immediately commit a jump so the lightbox content tracks the
        // pointer in real-time (a "rapid leafing through pages" feel).
        // Throttled to once-per-frame (rAF rate) so we don't fire hundreds
        // of React updates per second on a fast flick.
        if (onJumpRef.current && tot > 1) {
          const cardIdx = Math.max(
            0,
            Math.min(
              tot - 1,
              Math.round((scrubTick / (TICK_COUNT - 1)) * (tot - 1)),
            ),
          )
          if (cardIdx !== cur) {
            // Sync currentRef so the next frame's "should I fire?" check
            // sees the latest committed index, not the stale React prop.
            currentRef.current = cardIdx
            onJumpRef.current(cardIdx)
          }
        }
      } else {
        // Free flight: spring chases the current-card tick.
        const targetIdx = tot > 1
          ? (cur / (tot - 1)) * (TICK_COUNT - 1)
          : (TICK_COUNT - 1) / 2

        const dt = lastFrameTimeRef.current === 0
          ? 1 / 60
          : Math.min(0.05, (now - lastFrameTimeRef.current) / 1000)
        lastFrameTimeRef.current = now

        const displayed = displayedTickIdxRef.current
        const error = targetIdx - displayed
        const accel = SWELL_STIFFNESS * error - SWELL_DAMPING * swellVelRef.current
        swellVelRef.current += accel * dt
        const stepIdx = swellVelRef.current * dt

        const next = displayed + stepIdx
        if (Math.abs(error) < 0.02 && Math.abs(swellVelRef.current) < 0.5) {
          displayedTickIdxRef.current = targetIdx
          swellVelRef.current = 0
          lastFrameTimeRef.current = 0
          centerTickIdx = targetIdx
        } else {
          displayedTickIdxRef.current = next
          centerTickIdx = next
        }
      }

      // ---- Tick heights: flowing sinusoid waveform + amplitude swell ----
      const swellSigma = TICK_COUNT / 32
      const swellGain = 3.4

      for (let i = 0; i < TICK_COUNT; i++) {
        const el = tickRefs.current[i]
        if (!el) continue

        const w1 = Math.sin(t * 0.6 + i * 0.08) * 0.45
        const w2 = Math.sin(t * 1.7 + i * 0.31) * 0.30
        const w3 = Math.sin(t * 4.2 + i * 0.93) * 0.15
        const norm = (w1 + w2 + w3 + 0.9) / 1.8 // → 0..1-ish
        const baseH = 2 + norm * 8

        const dist = i - centerTickIdx
        const swell = 1 + swellGain * Math.exp(-(dist * dist) / (2 * swellSigma * swellSigma))

        const h = baseH * swell
        el.style.height = `${Math.max(1, h).toFixed(1)}px`
      }

      // ---- Counter text ----
      // Branch by counterFormat: legacy 'index-decimal' (PiP) keeps the
      // slot-machine `[ NNNN.MMMM / TTTT.0000 ]` look; new 'range' mode
      // (board-level Lightbox meter, session 39 B-#20) mirrors
      // ScrollMeter's `N1 — N2 / TOTAL` exactly — same scramble +
      // jitter + periodic cadence — so the canvas-slot crossfade
      // between ScrollMeter and this meter shows zero counter drift.
      if (counterFormatRef.current === 'index-decimal' && counterRef.current) {
        const isAnimating = now < animUntilRef.current
        // While scrubbing, show the card the user is about to land on.
        const showingIdx = scrubTick !== null
          ? Math.max(
              0,
              Math.min(
                tot - 1,
                Math.round((scrubTick / (TICK_COUNT - 1)) * (tot - 1)),
              ),
            )
          : cur
        const intPart = pad4(showingIdx + 1)
        const decPart = isAnimating && scrubTick === null
          ? Math.floor(Math.random() * 10000).toString().padStart(4, '0')
          : '0000'
        const totalStr = pad4(tot)
        counterRef.current.textContent = `${intPart}.${decPart} / ${totalStr}.0000`
      } else if (counterFormatRef.current === 'range') {
        // Periodic full-scramble trigger — random 5-15s interval picks
        // one of the three digit groups and re-arms its scramble window.
        // Identical to ScrollMeter so the two meters feel like one device.
        if (nextPeriodicAtRef.current === 0) {
          nextPeriodicAtRef.current = now + nextPeriodicDelay()
        } else if (now >= nextPeriodicAtRef.current) {
          const target = Math.floor(Math.random() * 3)
          const until = now + nextScrambleDuration()
          if (target === 0) {
            n1ScrambleUntilRef.current = Math.max(n1ScrambleUntilRef.current, until)
          } else if (target === 1) {
            n2ScrambleUntilRef.current = Math.max(n2ScrambleUntilRef.current, until)
          } else {
            totalScrambleUntilRef.current = Math.max(totalScrambleUntilRef.current, until)
          }
          nextPeriodicAtRef.current = now + nextPeriodicDelay()
        }

        const writeDigit = (
          node: HTMLSpanElement | null,
          settled: number,
          scrambleUntil: number,
          jitterProb: number,
        ): void => {
          if (!node) return
          let value: number
          if (now < scrambleUntil) {
            value = Math.floor(Math.random() * 10000)
          } else if (Math.random() < jitterProb) {
            const delta = Math.random() < 0.5 ? -1 : 1
            value = Math.max(0, settled + delta)
          } else {
            value = settled
          }
          node.textContent = pad4(value)
        }
        writeDigit(n1SpanRef.current, n1SettledRef.current, n1ScrambleUntilRef.current, JITTER_PROB_RANGE)
        writeDigit(n2SpanRef.current, n2SettledRef.current, n2ScrambleUntilRef.current, JITTER_PROB_RANGE)
        writeDigit(totalSpanRef.current, totalSettledRef.current, totalScrambleUntilRef.current, JITTER_PROB_TOTAL)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return (): void => cancelAnimationFrame(raf)
  }, [])

  // ---- Pointer handlers for drag scrubbing ----
  const tickIdxFromPointer = useCallback((clientX: number): number => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return frac * (TICK_COUNT - 1)
  }, [])

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (totalRef.current <= 1 || !onJump) return
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    if (typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
    const idx = tickIdxFromPointer(e.clientX)
    scrubTickIdxRef.current = idx
    setIsScrubbing(true)
  }, [onJump, tickIdxFromPointer])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (scrubTickIdxRef.current === null) return
    scrubTickIdxRef.current = tickIdxFromPointer(e.clientX)
  }, [tickIdxFromPointer])

  const finishScrub = useCallback((): void => {
    const scrub = scrubTickIdxRef.current
    if (scrub === null) return
    scrubTickIdxRef.current = null
    setIsScrubbing(false)
    const tot = totalRef.current
    if (tot <= 0 || !onJump) return
    const cardIdx = Math.max(
      0,
      Math.min(tot - 1, Math.round((scrub / (TICK_COUNT - 1)) * (tot - 1))),
    )
    if (cardIdx !== currentRef.current) {
      // Sync currentRef so the rAF loop's spring target matches the new
      // index immediately — prevents a one-frame snap-back to the old
      // index between this call and React's re-render.
      currentRef.current = cardIdx
      onJump(cardIdx)
    }
  }, [onJump])

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    const el = trackRef.current
    if (el && typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
    finishScrub()
  }, [finishScrub])

  if (total <= 1 && !alwaysShow) return null

  return (
    <div className={styles.meterWrap} aria-hidden="true">
      <div className={styles.meterStack}>
        {counterFormat === 'range' ? (
          <div className={styles.meterCounter} data-counter-format="range">
            <span ref={n1SpanRef}>{pad4(n1)}</span>
            {' '}
            <span className={styles.meterDim}>—</span>
            {' '}
            <span ref={n2SpanRef}>{pad4(n2)}</span>
            {' '}
            <span className={styles.meterDim}>/</span>
            {' '}
            <span ref={totalSpanRef}>{pad4(total)}</span>
          </div>
        ) : (
          <div className={styles.meterCounter}>
            <span className={styles.meterBracket}>[</span>
            {' '}
            <span ref={counterRef}>0001.0000 / 0001.0000</span>
            {' '}
            <span className={styles.meterBracket}>]</span>
          </div>
        )}
        <div
          className={styles.meterTrack}
          ref={trackRef}
          data-scrubbing={isScrubbing || undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className={styles.meterTrackLine} />
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <div
              key={i}
              ref={(el) => { if (el) tickRefs.current[i] = el }}
              className={styles.meterTick}
              style={{ left: `${(i / (TICK_COUNT - 1)) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
