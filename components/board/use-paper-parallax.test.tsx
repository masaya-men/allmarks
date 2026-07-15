import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePaperParallax } from './use-paper-parallax'

function mockReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? reduced : false,
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
}

describe('usePaperParallax', () => {
  beforeEach(() => mockReducedMotion(false))
  afterEach(() => vi.unstubAllGlobals())

  it('enabled for paper-atelier: returns a fractional offset of viewportY', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', viewportY: 1000 }))
    // 0.15x content pan → bg lags by 85% of scroll (positive lag offset).
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeCloseTo(1000 * 0.85, 5)
  })

  it('enabled for Sound Wave too: its pattern (grid/dots) drifts behind the cards', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'dotted-notebook', viewportY: 1000 }))
    expect(result.current).toBeCloseTo(1000 * 0.85, 5)
  })

  it('independent of the MOTION toggle (parallax is depth, not a motion effect)', () => {
    // The hook no longer takes motionEnabled — parallax stays on regardless of
    // the MOTION (card autoplay/slideshow) toggle. This test documents that the
    // only gate left is theme + reduced-motion.
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', viewportY: 1000 }))
    expect(result.current).toBeCloseTo(1000 * 0.85, 5)
  })

  it('disabled for flat → 0 (its pattern stays static; drift is opt-in per theme)', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'flat', viewportY: 1000 }))
    expect(result.current).toBe(0)
  })

  it('disabled under prefers-reduced-motion → 0', () => {
    mockReducedMotion(true)
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', viewportY: 1000 }))
    expect(result.current).toBe(0)
  })
})
