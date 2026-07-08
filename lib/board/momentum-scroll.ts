/**
 * Momentum-scroll physics for the mobile board pan (session 179).
 *
 * The mobile board pans by JS transform (not native overflow), so it has no
 * OS-provided inertia. These pure helpers reproduce an industry-standard feel
 * from sourced constants:
 *
 *  - Deceleration: continuous exponential decay `pos(t) = target − amplitude·e^(−t/τ)`
 *    (Framer Motion `inertia`, ariya.io). Frame-rate independent, so the feel is
 *    identical on any refresh rate. `amplitude = POWER · v0`, `τ = 325 ms` —
 *    Framer Motion defaults, and `τ = 325` equals Apple's measured 0.95-per-16.7ms
 *    frame decay (`−16.7 / ln(0.95) ≈ 325`).
 *  - Landing prediction: `X_final = current + POWER · v0` (the Framer target;
 *    WWDC 2018 "Designing Fluid Interfaces" uses the equivalent `v·d/(1−d)`).
 *  - Rubber-band at the edges: `dist·dim·c/(dim + c·dist)`, `c = 0.15`
 *    (@use-gesture `rubberband`, aholachek — independently identical, Apple-derived).
 *  - Edge settle after release: a critically-ish damped spring, `stiffness = 500`,
 *    `damping = 10` (Framer Motion `createSpring`).
 *  - Stop when within `REST_DELTA_PX = 0.5` of target (Framer `restDelta`), with a
 *    `6·τ` time cap as a safety valve (ariya.io).
 *
 * Velocity is carried in **px/s** (positive = content moving down / finger down),
 * matching Framer Motion's units so `POWER` transfers directly.
 *
 * All functions are pure so they unit-test without a DOM. Every constant is
 * exported so the feel can be tuned on-device without touching logic.
 */

/** A pointer position sample: viewport Y in px at timestamp `t` (ms). */
export type VelocitySample = { readonly y: number; readonly t: number }

/** Sourced, tunable momentum constants. See file header for provenance. */
export const MOMENTUM = {
  /** Framer Motion inertia `power`. amplitude = POWER · v0. */
  POWER: 0.8,
  /** Time constant τ in ms. Framer default; equals Apple's 0.95/frame decay. */
  TAU_MS: 325,
  /** Rubber-band resistance constant (@use-gesture default). */
  RUBBERBAND_C: 0.15,
  /** Edge-settle spring stiffness (Framer createSpring). */
  SPRING_STIFFNESS: 500,
  /** Edge-settle spring damping (Framer createSpring). */
  SPRING_DAMPING: 10,
  /** Stop when |pos − target| ≤ this (Framer restDelta), px. */
  REST_DELTA_PX: 0.5,
  /** Safety time cap for the decay ≈ 6·τ (ariya.io), ms. */
  MAX_MS: 1950,
  /** Below this |velocity| (px/s) a release is treated as a tap-stop, not a fling.
   *  No firm primary source; tuned on-device. */
  MIN_FLING_VELOCITY_PX_S: 50,
  /** Trailing window used to estimate release velocity, ms. */
  VELOCITY_WINDOW_MS: 100,
} as const

/**
 * Release velocity in px/s from recent pointer samples. Uses only the samples
 * inside the trailing `windowMs` ending at the last sample, then takes the
 * straight `Δy/Δt` between the oldest windowed sample and the last one. Positive
 * means y increased (finger moved down). Returns 0 for <2 samples or zero dt.
 *
 * A short window (not the whole gesture) keeps the value responsive without the
 * single-sample noise of using only the final two points.
 */
export function estimateVelocity(
  samples: readonly VelocitySample[],
  windowMs: number = MOMENTUM.VELOCITY_WINDOW_MS,
): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]!
  const cutoff = last.t - windowMs
  let first = last
  for (const s of samples) {
    if (s.t >= cutoff) {
      first = s
      break
    }
  }
  const dt = last.t - first.t
  if (dt <= 0) return 0
  return ((last.y - first.y) / dt) * 1000
}

/**
 * Projected resting position of a fling: `current + power · velocity`. This is
 * the Framer Motion inertia target (the exponential decay asymptotes here).
 */
export function projectEndPosition(
  current: number,
  velocity: number,
  power: number = MOMENTUM.POWER,
): number {
  return current + power * velocity
}

/**
 * Signed offset from the target at `elapsedMs` into the decay:
 * `−amplitude · e^(−elapsedMs/τ)`. At t=0 it is `−amplitude` (start), decaying
 * toward 0 as t grows. Add to `target` to get the current position.
 */
export function momentumOffset(elapsedMs: number, amplitude: number, tau: number): number {
  return -amplitude * Math.exp(-elapsedMs / tau)
}

/**
 * Rubber-band give for a pull of `distance` px past an edge, against a container
 * of `dimension` px, using resistance constant `c` (default 0.15). Grows
 * sublinearly so the edge feels progressively stiffer. Returns 0 at the edge.
 */
export function rubberband(
  distance: number,
  dimension: number,
  c: number = MOMENTUM.RUBBERBAND_C,
): number {
  if (dimension <= 0) return distance
  return (distance * dimension * c) / (dimension + c * distance)
}

/** One position/velocity of the edge-settle spring (mass = 1), integrated over
 *  `dtMs`. Velocity is px/s. Used to settle back to a boundary after an
 *  over-scrolled release. */
export function springStep(
  pos: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dtMs: number,
): { pos: number; vel: number } {
  const dtSec = dtMs / 1000
  const accel = -stiffness * (pos - target) - damping * vel
  const nextVel = vel + accel * dtSec
  const nextPos = pos + nextVel * dtSec
  return { pos: nextPos, vel: nextVel }
}

/** Whether `pos` is within `restDelta` px of `target` (decay stop condition). */
export function hasSettled(
  pos: number,
  target: number,
  restDelta: number = MOMENTUM.REST_DELTA_PX,
): boolean {
  return Math.abs(pos - target) <= restDelta
}
