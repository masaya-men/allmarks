'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement,
} from 'react'
import styles from './ScrollMeter.module.css'
import { RulerTrack } from './scrollmeter/RulerTrack'

/** Number of tick marks rendered on the ruler. Decoupled from any external
 *  count — the meter is a pure visual waveform, with current scroll OR
 *  active-card position shown as a localized amplitude swell on top of
 *  the global flow. */
const TICK_COUNT = 150

/** D ハイブリッド scramble windows (spec §1-2): the visible-range numerals
 *  flicker for 600ms after a change, total flickers for 1500ms — long
 *  enough for the eye to read "total count is the most important number". */
const SCRAMBLE_MS_RANGE = 600
const SCRAMBLE_MS_TOTAL = 1500

/** Per-frame ±1 micro-jitter probability on the settled values. The total
 *  number jitters slightly more than the range numbers (spec §1-2). */
const JITTER_PROB_RANGE = 0.06
const JITTER_PROB_TOTAL = 0.10

/** Periodic full-scramble trigger (session 29 user feedback): even when the
 *  meter has settled, occasionally fire a full scramble on one of the three
 *  digit groups so the counter feels alive in long idle periods. The
 *  interval is a random 5-15s and the scramble window matches the existing
 *  range/total durations (600-1500ms picked randomly). */
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

/** Session 51: one-shot glitch burst duration. Triggered on (a) click /
 *  drag-start on the meter track and (b) Lightbox open/close mode change.
 *  Matches the 700ms `glitch-shift-a/b` keyframes in the CSS module so
 *  the class can be cleared right at animation end. We don't run glitch
 *  continuously — at-rest meter is intentionally calm — but firing it
 *  at interaction inflection points (and sustaining while the pointer
 *  hovers the meter) reinforces the sound-wave / mixer-rack theme. */
const GLITCH_BURST_MS = 720

/** Glide tween duration + easing for swell hand-off between modes AND for
 *  every swell change in lightbox mode (= card-to-card slide).
 *
 *  Session 39 design history:
 *    - phase 3: spring damping (stiffness 320) — felt "急に動いた" (peak
 *      velocity at t=0 when error is largest)
 *    - phase 4: switched to ease-in-out-cubic tween (1200ms) — symmetric
 *      "ぬったりぬるっと" soft start AND soft end
 *    - phase 6 (refactor): same tween, now drives ALL swell motion in
 *      lightbox mode AND the mode-change hand-off
 *
 *  Board mode swell still snaps directly to swellFraction (= scroll feels
 *  1:1 with the finger); the glide path is only used for mode changes
 *  and lightbox-mode-internal card swaps. */
const GLIDE_DURATION_MS = 1200

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

type Props = {
  /** Which "device" the meter is acting as right now:
   *   - 'board': bulge follows scroll fraction directly (1:1 with finger);
   *     drag-scrub maps to scroll position via `onScrub`.
   *   - 'lightbox': bulge glides to swellFraction (= active card position)
   *     with an ease-in-out tween for smooth card-to-card slides;
   *     drag-scrub maps to card jumps via `onScrub`.
   *   On mode change either direction, the bulge eases from its current
   *   displayed position to the new swellFraction (= "swell travels home"
   *   on Lightbox close, "swell zooms onto the card you opened" on open). */
  readonly mode: 'board' | 'lightbox'
  /** Counter left number (= visible range start in board mode, current card
   *  index +1 in lightbox mode). */
  readonly n1: number
  /** Counter middle number (= visible range end in board mode, also current
   *  card index +1 in lightbox mode — for `N — N / TOTAL` "you're zoomed
   *  in to card N" readout). */
  readonly n2: number
  /** Counter right number (= total card count, same in both modes). */
  readonly total: number
  /** Swell center as a 0..1 fraction of the meter. Parent computes from
   *  mode-specific logic:
   *   - board: cy / (contentHeight - viewportHeight)
   *   - lightbox: currentIndex / (total - 1) */
  readonly swellFraction: number
  /** Called when the user clicks or drags on the meter track. Receives a
   *  0..1 fraction; parent translates to:
   *   - board: scroll to (fraction * scrollableHeight)
   *   - lightbox: jump to round(fraction * (total - 1))
   *  rAF-throttled (= max once per frame), so the parent can call expensive
   *  state setters without per-pointer-event flooding. */
  readonly onScrub: (fraction: number) => void
  /** Which meter face to render. 'waveform' = the default sound-wave ticks
   *  (dotted-notebook / grid-paper). 'ruler' = the paper-atelier tape-measure
   *  (RulerTrack). The 0..1 swellFraction-in / onScrub-out contract and the
   *  counter readout are identical across both faces. */
  readonly variant?: 'waveform' | 'ruler'
  /** True while the board is being grab-wiggled (default theme). Folds into the
   *  waveform's existing interaction churn so the meter resonates continuously
   *  while held. Ignored by the ruler variant. */
  readonly grabbing?: boolean
}

function pad4(n: number): string {
  return Math.max(0, Math.min(9999, Math.floor(n))).toString().padStart(4, '0')
}

/**
 * Unified live meter for the board canvas — single component covers both
 * "show scroll position" (board mode) and "show active card" (lightbox
 * mode) so opening / closing the Lightbox is a pure content swap with NO
 * crossfade between two physical meters. The bulge eases between modes
 * via an ease-in-out-cubic tween, so it visually "travels home" rather
 * than teleporting.
 *
 * Three superposed sinusoids per tick (low / mid / high frequency, each
 * phase-shifted per tick index) give an audio-waveform "音の波形" feel.
 * On top, a localized Gaussian amplitude swell centered on `displayed`
 * makes the meter "notice" itself at the active position.
 *
 * Counter readout stacks above the waveform with format `N1 — N2 / TOTAL`.
 * Range numbers (N1, N2) scramble for 600ms after a change; the total
 * scrambles for 1500ms (it's the headline number — gets the longest read
 * time). Both jitter slightly even when settled so the meter feels alive.
 * Critically, the waveform swell IGNORES the scrambled values entirely
 * (uses `displayed` tick index) — the spec calls for the "数字は うるさい
 * / 波形は 静か" split so motion stays legible.
 *
 * Drag-scrub uses an rAF-throttled fire of `onScrub(fraction)` so heavy
 * parent-side state updates (= per-card jump in lightbox mode) stay at
 * frame rate, no matter how fast the user flicks the pointer.
 */
export function ScrollMeter({
  mode,
  n1,
  n2,
  total,
  swellFraction,
  onScrub,
  variant = 'waveform',
  grabbing = false,
}: Props): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<HTMLDivElement[]>([])
  const n1Ref = useRef<HTMLSpanElement>(null)
  const n2Ref = useRef<HTMLSpanElement>(null)
  const totalSpanRef = useRef<HTMLSpanElement>(null)
  const counterWrapRef = useRef<HTMLDivElement>(null)

  // Mirror props into refs so the rAF loop reads the latest values each
  // frame without restarting the loop / triggering re-renders.
  const modeRef = useRef<'board' | 'lightbox'>(mode)
  const swellFractionRef = useRef<number>(swellFraction)
  const onScrubRef = useRef<typeof onScrub>(onScrub)
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { swellFractionRef.current = swellFraction }, [swellFraction])
  useEffect(() => { onScrubRef.current = onScrub }, [onScrub])

  // Mirror variant into a ref so the single []-deps rAF loop can branch on
  // it each frame without restarting. Same idiom as modeRef/swellFractionRef.
  const variantRef = useRef<'waveform' | 'ruler'>(variant)
  useEffect(() => { variantRef.current = variant }, [variant])

  // Mirror grabbing into a ref so the single []-deps rAF loop reads it each
  // frame. Same idiom as variantRef/modeRef.
  const grabbingRef = useRef<boolean>(grabbing)
  useEffect(() => { grabbingRef.current = grabbing }, [grabbing])

  // Brass marker for the ruler variant — positioned by the rAF loop via
  // left %, mirroring how the waveform's swell rides centerTickIdx.
  const rulerMarkerRef = useRef<HTMLDivElement>(null)

  // ---- Swell state ----
  // `displayedTickIdxRef` is what the rAF actually paints each frame. It's
  // updated by one of three paths each frame:
  //   1. Drag scrub: pointer-driven, snap to scrub fraction
  //   2. Active glide: ease-in-out tween from start tick to target tick
  //   3. Direct follow (board mode, no scrub, no glide): snap to swell target
  const displayedTickIdxRef = useRef<number>(swellFraction * (TICK_COUNT - 1))
  const glideActiveRef = useRef<boolean>(false)
  const glideStartTimeRef = useRef<number>(0)
  const glideStartTickRef = useRef<number>(0)
  const glideTargetTickRef = useRef<number>(0)

  // ---- Drag scrub state ----
  // Pointer-down captures into scrubFractionRef; pointermove updates it.
  // The rAF loop reads it once per frame, fires onScrub at most once per
  // frame, and renders displayed = scrubFraction (not glide, not direct).
  const scrubFractionRef = useRef<number | null>(null)
  const lastFiredScrubRef = useRef<number>(NaN)
  const [isDragging, setIsDragging] = useState(false)

  // ---- Glide arm logic ----
  // Glide fires (= arms a new tween from current displayed to target) when:
  //   - mode changes (board ↔ lightbox)
  //   - in lightbox mode, swellFraction changes (= card-to-card swap)
  // Skip if currently scrubbing (= pointer is the source of truth).
  // Board mode swellFraction changes (= scroll) do NOT arm glide — board
  // scroll is direct follow.
  const prevModeRef = useRef<'board' | 'lightbox'>(mode)
  useEffect(() => {
    if (scrubFractionRef.current !== null) {
      // Pointer-driven; don't arm glide. prevMode tracking still updates
      // so a mode change during scrub arms once the user releases.
      prevModeRef.current = mode
      return
    }
    const isModeChange = prevModeRef.current !== mode
    const isLightboxSwellChange = mode === 'lightbox'
    if (isModeChange || isLightboxSwellChange) {
      const start = displayedTickIdxRef.current
      const target = Math.max(0, Math.min(1, swellFraction)) * (TICK_COUNT - 1)
      // No-op if already at target — avoids a 1.2s "glide to where I am" tween.
      if (Math.abs(target - start) > 0.5) {
        glideStartTickRef.current = start
        glideTargetTickRef.current = target
        glideStartTimeRef.current = performance.now()
        glideActiveRef.current = true
      }
    }
    prevModeRef.current = mode
  }, [mode, swellFraction])

  // ---- Counter scramble bookkeeping ----
  // Settled values + scramble deadlines for the counter rAF loop. The loop
  // reads these refs every frame — React state would cause re-renders,
  // which is exactly what we don't want for a 60Hz number display.
  const n1SettledRef = useRef<number>(n1)
  const n2SettledRef = useRef<number>(n2)
  const totalSettledRef = useRef<number>(total)
  const n1ScrambleUntilRef = useRef<number>(0)
  const n2ScrambleUntilRef = useRef<number>(0)
  const totalScrambleUntilRef = useRef<number>(0)
  // Periodic full-scramble timer — initialised on first frame so the first
  // trigger fires 5-15s after mount, not immediately.
  const nextPeriodicAtRef = useRef<number>(0)

  useEffect(() => {
    if (n1 !== n1SettledRef.current) {
      n1SettledRef.current = n1
      n1ScrambleUntilRef.current = performance.now() + SCRAMBLE_MS_RANGE
    }
  }, [n1])
  useEffect(() => {
    if (n2 !== n2SettledRef.current) {
      n2SettledRef.current = n2
      n2ScrambleUntilRef.current = performance.now() + SCRAMBLE_MS_RANGE
    }
  }, [n2])
  useEffect(() => {
    if (total !== totalSettledRef.current) {
      totalSettledRef.current = total
      totalScrambleUntilRef.current = performance.now() + SCRAMBLE_MS_TOTAL
    }
  }, [total])

  const [hoverFrac, setHoverFrac] = useState<number | null>(null)

  // ---- One-shot glitch burst (session 51) ----
  // Add the .glitchBurst class to counterWrap, force a synchronous reflow so
  // the animation truly restarts from frame 0 (without the reflow, adding the
  // same class twice in quick succession is a no-op — the prior animation
  // would just keep its in-progress timeline), then schedule a class removal
  // after the keyframe duration. Single ref-driven timer ensures rapid bursts
  // (= user clicks the meter twice in 200ms) restart cleanly rather than
  // queueing up. Use raw DOM manipulation rather than React state because
  // we don't want a render cycle in the middle of a 60Hz rAF loop.
  //
  // The waveform also gets a synchronous "audio static" effect for the same
  // 720ms — each tick's per-frame height is multiplied by a fresh random
  // factor, so the calm sinusoid flow degenerates into noise then snaps
  // back. This is what makes the Lightbox open/close trigger actually
  // *perceptible*: the counter alone is too small to register peripherally
  // when the user's gaze is on the opening card, but the 360px-wide
  // waveform shimmering across the screen-bottom catches the eye.
  const glitchBurstTimerRef = useRef<number | null>(null)
  const glitchBurstActiveRef = useRef<boolean>(false)
  const fireGlitchBurst = useCallback((): void => {
    const el = counterWrapRef.current
    if (!el) return
    el.classList.remove(styles.glitchBurst)
    // Force reflow — read a layout property to flush the class removal.
    void el.offsetWidth
    el.classList.add(styles.glitchBurst)
    glitchBurstActiveRef.current = true
    if (glitchBurstTimerRef.current !== null) {
      window.clearTimeout(glitchBurstTimerRef.current)
    }
    glitchBurstTimerRef.current = window.setTimeout(() => {
      counterWrapRef.current?.classList.remove(styles.glitchBurst)
      glitchBurstActiveRef.current = false
      glitchBurstTimerRef.current = null
    }, GLITCH_BURST_MS)
  }, [])
  // Cleanup the burst timer if the meter unmounts mid-pulse.
  useEffect(() => {
    return (): void => {
      if (glitchBurstTimerRef.current !== null) {
        window.clearTimeout(glitchBurstTimerRef.current)
      }
    }
  }, [])

  // Respect prefers-reduced-motion for the waveform jitter the same way the
  // CSS module does for the counter's RGB ghost animation. The match is read
  // once on mount because reduced-motion preference changes are extremely
  // rare during a session and the cost of a per-frame matchMedia check would
  // add up over a 60Hz rAF.
  const reducedMotionRef = useRef<boolean>(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }, [])

  // Mode transitions (= Lightbox open / close) fire one burst. Skip the
  // first effect run so opening the page itself isn't visually noisy —
  // the prevModeRef-style sentinel ensures we only react to genuine
  // changes after initial mount.
  const prevModeForGlitchRef = useRef<'board' | 'lightbox' | null>(null)
  useEffect(() => {
    if (prevModeForGlitchRef.current === null) {
      prevModeForGlitchRef.current = mode
      return
    }
    if (prevModeForGlitchRef.current !== mode) {
      prevModeForGlitchRef.current = mode
      fireGlitchBurst()
    }
  }, [mode, fireGlitchBurst])

  // ---- The rAF loop: swell render + counter render + scrub fire ----
  useEffect(() => {
    let raf = 0
    const loop = (): void => {
      const now = performance.now()
      const t = now / 1000

      // ---- Resolve displayed swell center for this frame ----
      const scrub = scrubFractionRef.current
      const liveSwellFraction = Math.max(0, Math.min(1, swellFractionRef.current))
      const liveTargetTick = liveSwellFraction * (TICK_COUNT - 1)
      let centerTickIdx: number

      if (scrub !== null) {
        // Drag: pointer is truth. Snap displayed, kill any in-flight glide.
        const scrubTick = scrub * (TICK_COUNT - 1)
        displayedTickIdxRef.current = scrubTick
        centerTickIdx = scrubTick
        glideActiveRef.current = false
        // rAF-throttled onScrub fire: parent only sees changes at frame rate.
        if (scrub !== lastFiredScrubRef.current) {
          onScrubRef.current(scrub)
          lastFiredScrubRef.current = scrub
        }
      } else if (glideActiveRef.current) {
        // Active ease-in-out tween from glideStartTick to glideTargetTick.
        const elapsed = now - glideStartTimeRef.current
        const progress = Math.min(1, Math.max(0, elapsed / GLIDE_DURATION_MS))
        const eased = easeInOutCubic(progress)
        const start = glideStartTickRef.current
        const target = glideTargetTickRef.current
        const displayed = start + (target - start) * eased
        if (progress >= 1) {
          // Glide complete — snap to the LIVE target (= picks up any
          // swellFraction shift that happened mid-tween, e.g. user scroll
          // during the 1.2s glide back to board mode).
          displayedTickIdxRef.current = liveTargetTick
          glideActiveRef.current = false
          centerTickIdx = liveTargetTick
        } else {
          displayedTickIdxRef.current = displayed
          centerTickIdx = displayed
        }
      } else if (modeRef.current === 'board') {
        // Board direct follow — keeps scroll 1:1 with the finger.
        displayedTickIdxRef.current = liveTargetTick
        centerTickIdx = liveTargetTick
      } else {
        // Lightbox mode at rest (= settled at the active card position).
        displayedTickIdxRef.current = liveTargetTick
        centerTickIdx = liveTargetTick
      }

      // ---- Tick heights: flowing sinusoid waveform + amplitude swell ----
      // At-rest: pure sinusoid + swell — calm, wave-like, no noise. This
      // is the "落ち着いた波" the user asked for.
      // During a burst (720ms one-shot fired on click, Lightbox open/close,
      // OR pointer-enter on track / counter) or an active drag-scrub, every
      // tick gets noise: ~10% drop probability + a 0.4–1.65x random height
      // multiplier per frame. Hover behaves like the other triggers — a
      // brief audio-static pulse rather than a sustained chaos, matching
      // the counter's RGB ghost shift idiom. Intensity dialed back from
      // the earlier 18% / 0.2–2.1x range because that read as "too loud"
      // even as a one-shot. Skipped under prefers-reduced-motion.
      const reducedMotion = reducedMotionRef.current
      const isInteracting = !reducedMotion && (
        glitchBurstActiveRef.current
        || scrubFractionRef.current !== null
        || grabbingRef.current
      )
      const swellSigma = TICK_COUNT / 32
      const swellGain = 3.4
      const isRuler = variantRef.current === 'ruler'
      if (!isRuler) {
        for (let i = 0; i < TICK_COUNT; i++) {
          const el = tickRefs.current[i]
          if (!el) continue

          const w1 = Math.sin(t * 0.6 + i * 0.08) * 0.45
          const w2 = Math.sin(t * 1.7 + i * 0.31) * 0.30
          const w3 = Math.sin(t * 4.2 + i * 0.93) * 0.15
          const norm = (w1 + w2 + w3 + 0.9) / 1.8 // → 0..1-ish
          const baseH = 2 + norm * 8

          const dist = i - centerTickIdx
          const swell = 1
            + swellGain * Math.exp(-(dist * dist) / (2 * swellSigma * swellSigma))

          let h = baseH * swell
          if (isInteracting) {
            if (Math.random() < 0.10) {
              h = 1
            } else {
              h = h * (0.40 + Math.random() * 1.25)
            }
          }
          el.style.height = `${Math.max(1, h).toFixed(1)}px`
        }
      } else {
        // Ruler: no per-tick height writes; just slide the brass marker to the
        // centerTickIdx position (same 0..1 mapping, expressed as left %).
        const marker = rulerMarkerRef.current
        if (marker) {
          const pct = (centerTickIdx / (TICK_COUNT - 1)) * 100
          marker.style.left = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`
        }
      }

      // ---- Periodic full-scramble trigger (session 29 user feedback) ----
      // Pick a random digit group and re-arm its scramble deadline at a
      // random 5-15s interval so the counter stays alive even when idle.
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

      // ---- Counter scramble + micro-jitter ----
      const writeDigit = (
        node: HTMLSpanElement | null,
        settled: number,
        scrambleUntil: number,
        jitterProb: number,
      ): void => {
        if (!node) return
        // Paper "ruler" variant: the counter is a calm, STATIC ink readout
        // (目盛り / graduations) — no scramble, micro-jitter, or periodic
        // churn. Short-circuit to the settled value so a scroll-driven count
        // change just snaps to the new number instead of scrambling. This is
        // the single gate that stops ALL digit motion on paper (the periodic
        // and grab blocks below only *arm* scramble deadlines, which this
        // ignores). Default (waveform) theme path is untouched.
        if (isRuler) {
          node.textContent = pad4(settled)
          return
        }
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
      // Grab feedback: while the board is grabbed, keep all three counter digits
      // scrambling continuously (hold their scramble deadline ahead of `now`), so
      // the number reacts in lockstep with the chrome labels. Never under
      // reduced-motion, and the flag is only set on the default board grabbing.
      if (!reducedMotion && grabbingRef.current) {
        n1ScrambleUntilRef.current = now + 250
        n2ScrambleUntilRef.current = now + 250
        totalScrambleUntilRef.current = now + 250
      }
      writeDigit(n1Ref.current, n1SettledRef.current, n1ScrambleUntilRef.current, JITTER_PROB_RANGE)
      writeDigit(n2Ref.current, n2SettledRef.current, n2ScrambleUntilRef.current, JITTER_PROB_RANGE)
      writeDigit(totalSpanRef.current, totalSettledRef.current, totalScrambleUntilRef.current, JITTER_PROB_TOTAL)

      // Session 43: keep meterCounter's data-glitch-text in sync with the
      // currently-rendered digits so the ::before / ::after RGB ghosts
      // mirror what the user sees (= same glitch language as chrome buttons).
      const cw = counterWrapRef.current
      if (cw) {
        const a = n1Ref.current?.textContent ?? ''
        const b = n2Ref.current?.textContent ?? ''
        const c = totalSpanRef.current?.textContent ?? ''
        cw.setAttribute('data-glitch-text', `${a} — ${b} / ${c}`)
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return (): void => cancelAnimationFrame(raf)
  }, [])

  // ---- Pointer handlers ----
  // Pointer events update scrubFractionRef; the actual onScrub fire happens
  // in the rAF loop above so we throttle to one fire per frame max (= safe
  // for lightbox mode where each fire triggers a per-card React update).
  const fracFromPointer = useCallback((clientX: number): number => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    if (typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
    const frac = fracFromPointer(e.clientX)
    scrubFractionRef.current = frac
    lastFiredScrubRef.current = NaN
    setIsDragging(true)
    // session 51: fire a one-shot glitch on click — same trigger whether
    // the user just taps (= jump-to-position) or starts a drag-scrub.
    // Bursts during the drag itself are intentionally suppressed (= only
    // pointer-down fires) so a long drag doesn't strobe the counter.
    fireGlitchBurst()
  }, [fracFromPointer, fireGlitchBurst])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    const frac = fracFromPointer(e.clientX)
    setHoverFrac(frac)
    if (scrubFractionRef.current !== null) {
      scrubFractionRef.current = frac
    }
  }, [fracFromPointer])

  // Pointer-enter fires a one-shot burst — matches the brief pulse fired by
  // click and Lightbox open/close, rather than sustaining chaos for the
  // duration of the hover (which felt overwhelming in the prior iteration).
  const handlePointerEnter = useCallback((): void => {
    fireGlitchBurst()
  }, [fireGlitchBurst])

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    const el = trackRef.current
    if (el && typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
    scrubFractionRef.current = null
    lastFiredScrubRef.current = NaN
    setIsDragging(false)
  }, [])

  const handlePointerLeave = useCallback((): void => {
    setHoverFrac(null)
  }, [])

  // Counter hover entry also fires the one-shot burst so the waveform
  // pulses along with the counter's own RGB ghost shift (which the CSS
  // module triggers on :hover). Same brief duration, same idiom.
  const handleCounterEnter = useCallback((): void => {
    fireGlitchBurst()
  }, [fireGlitchBurst])

  useEffect(() => (): void => setHoverFrac(null), [])

  const hoverPct = hoverFrac !== null ? hoverFrac * 100 : null
  const ticks = useMemo(() => Array.from({ length: TICK_COUNT }, (_, i) => i), [])
  const swellPct = Math.round(
    Math.max(0, Math.min(1, swellFraction)) * 100,
  )

  return (
    <div className={styles.meterWrap}>
      <div className={styles.meterStack}>
        {/* Session 43: 操作ヒントは TUNE drawer の opsLegend に集約済 (= 機械の
            注意書き的に readout panel 内へ移動)。 ScrollMeter は数値 counter
            + track のみのミニマム表示に戻す。 */}
        <div
          ref={counterWrapRef}
          className={styles.meterCounter}
          aria-hidden="true"
          data-glitch-text=""
          onPointerEnter={handleCounterEnter}
        >
          <span ref={n1Ref}>{pad4(n1)}</span>
          {' '}
          <span className={styles.meterDim}>—</span>
          {' '}
          <span ref={n2Ref}>{pad4(n2)}</span>
          {' '}
          <span className={styles.meterDim}>/</span>
          {' '}
          <span ref={totalSpanRef}>{pad4(total)}</span>
        </div>
        <div
          ref={trackRef}
          className={styles.track}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          role="slider"
          aria-label={mode === 'lightbox' ? 'Card position' : 'Scroll position'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={swellPct}
          data-testid="scroll-meter"
          data-mode={mode}
          data-meter-variant={variant}
          data-dragging={isDragging || undefined}
        >
          {variant === 'ruler' ? (
            <RulerTrack markerRef={rulerMarkerRef} />
          ) : (
            <>
              <div className={styles.baseline} aria-hidden="true" />
              {ticks.map((i) => (
                <div
                  key={i}
                  ref={(el): void => { if (el) tickRefs.current[i] = el }}
                  className={styles.tick}
                  style={{ left: `${(i / (TICK_COUNT - 1)) * 100}%` }}
                />
              ))}
              {hoverPct !== null && !isDragging && (
                <div className={styles.hoverLine} aria-hidden="true" style={{ left: `${hoverPct}%` }} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
