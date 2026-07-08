import { describe, it, expect } from 'vitest'
import {
  estimateVelocity,
  projectEndPosition,
  momentumOffset,
  rubberband,
  springStep,
  hasSettled,
  MOMENTUM,
  type VelocitySample,
} from './momentum-scroll'

describe('estimateVelocity', () => {
  it('returns constant-motion velocity in px/s (down = positive)', () => {
    // y advances 10px every 16ms → 0.625 px/ms → 625 px/s.
    const samples: VelocitySample[] = [
      { y: 0, t: 0 },
      { y: 10, t: 16 },
      { y: 20, t: 32 },
      { y: 30, t: 48 },
    ]
    expect(estimateVelocity(samples)).toBeCloseTo(625, 3)
  })

  it('ignores samples older than the window', () => {
    // The 0..48 stretch is stale (window is 100ms ending at t=400); only the
    // last two samples (t=384,400) count → (12−0)/(400−384)·1000 = 750 px/s.
    const samples: VelocitySample[] = [
      { y: 0, t: 0 },
      { y: 999, t: 48 },
      { y: 0, t: 384 },
      { y: 12, t: 400 },
    ]
    expect(estimateVelocity(samples)).toBeCloseTo(750, 3)
  })

  it('is negative when scrolling up (y decreasing)', () => {
    const samples: VelocitySample[] = [
      { y: 100, t: 0 },
      { y: 80, t: 20 },
    ]
    // (80−100)/20·1000 = −1000 px/s.
    expect(estimateVelocity(samples)).toBeCloseTo(-1000, 3)
  })

  it('returns 0 for fewer than two samples', () => {
    expect(estimateVelocity([])).toBe(0)
    expect(estimateVelocity([{ y: 5, t: 10 }])).toBe(0)
  })

  it('returns 0 when the windowed samples share a timestamp (no dt)', () => {
    const samples: VelocitySample[] = [
      { y: 0, t: 100 },
      { y: 10, t: 100 },
    ]
    expect(estimateVelocity(samples)).toBe(0)
  })
})

describe('projectEndPosition', () => {
  it('lands at current + power·velocity (Framer Motion inertia target)', () => {
    // v = 625 px/s, POWER = 0.8 → offset 500 → 100 + 500 = 600.
    expect(projectEndPosition(100, 625)).toBeCloseTo(600, 6)
  })

  it('projects backward for upward flings', () => {
    expect(projectEndPosition(1000, -1000)).toBeCloseTo(1000 + MOMENTUM.POWER * -1000, 6)
  })

  it('does not move when velocity is 0', () => {
    expect(projectEndPosition(240, 0)).toBe(240)
  })
})

describe('momentumOffset', () => {
  it('is −amplitude at t=0', () => {
    expect(momentumOffset(0, 800, MOMENTUM.TAU_MS)).toBeCloseTo(-800, 6)
  })

  it('decays to −amplitude·e⁻¹ after one time constant', () => {
    // −800·e⁻¹ ≈ −294.30.
    expect(momentumOffset(MOMENTUM.TAU_MS, 800, MOMENTUM.TAU_MS)).toBeCloseTo(-294.303, 2)
  })

  it('approaches 0 as elapsed time grows large', () => {
    // ariya.io: after 6·τ the residual settles within ~0.25% of amplitude.
    expect(Math.abs(momentumOffset(6 * MOMENTUM.TAU_MS, 800, MOMENTUM.TAU_MS))).toBeLessThan(800 * 0.005)
  })
})

describe('rubberband', () => {
  it('is 0 at the boundary (no overshoot)', () => {
    expect(rubberband(0, 1000)).toBe(0)
  })

  it('applies the use-gesture resistance curve (c=0.15)', () => {
    // (100·1000·0.15)/(1000+0.15·100) = 15000/1015 ≈ 14.778.
    expect(rubberband(100, 1000)).toBeCloseTo(14.778, 2)
  })

  it('grows sublinearly — doubling the pull less than doubles the give', () => {
    const a = rubberband(100, 1000)
    const b = rubberband(200, 1000)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(2 * a)
  })

  it('honors a custom constant', () => {
    expect(rubberband(100, 1000, 0.5)).toBeCloseTo((100 * 1000 * 0.5) / (1000 + 0.5 * 100), 4)
  })
})

describe('springStep', () => {
  it('stays put at rest on the target', () => {
    const next = springStep(100, 0, 100, MOMENTUM.SPRING_STIFFNESS, MOMENTUM.SPRING_DAMPING, 16)
    expect(next.pos).toBeCloseTo(100, 6)
    expect(next.vel).toBeCloseTo(0, 6)
  })

  it('accelerates back toward the target when displaced', () => {
    // pos 110, target 100, at rest → pulled back (vel negative, pos decreases).
    const next = springStep(110, 0, 100, MOMENTUM.SPRING_STIFFNESS, MOMENTUM.SPRING_DAMPING, 16)
    expect(next.vel).toBeLessThan(0)
    expect(next.pos).toBeLessThan(110)
  })

  it('is damped — an outward velocity is opposed', () => {
    // Moving further out (vel +) with damping: the damping term removes energy.
    const undamped = springStep(100, 200, 100, MOMENTUM.SPRING_STIFFNESS, 0, 16)
    const damped = springStep(100, 200, 100, MOMENTUM.SPRING_STIFFNESS, MOMENTUM.SPRING_DAMPING, 16)
    expect(damped.vel).toBeLessThan(undamped.vel)
  })
})

describe('hasSettled', () => {
  it('is true within the rest delta', () => {
    expect(hasSettled(100.3, 100)).toBe(true)
    expect(hasSettled(100, 100)).toBe(true)
  })

  it('is false outside the rest delta', () => {
    expect(hasSettled(101, 100)).toBe(false)
  })

  it('honors a custom rest delta', () => {
    expect(hasSettled(100.3, 100, 0.1)).toBe(false)
  })
})

describe('MOMENTUM constants', () => {
  it('exposes the sourced industry-standard values', () => {
    expect(MOMENTUM.POWER).toBe(0.8)
    expect(MOMENTUM.TAU_MS).toBe(325)
    expect(MOMENTUM.RUBBERBAND_C).toBe(0.15)
    expect(MOMENTUM.SPRING_STIFFNESS).toBe(500)
    expect(MOMENTUM.SPRING_DAMPING).toBe(10)
    expect(MOMENTUM.REST_DELTA_PX).toBe(0.5)
  })
})
