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

  it('enabled only for paper-atelier: returns a fractional offset of viewportY', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', motionEnabled: true, viewportY: 1000 }))
    // 0.4x content pan → bg lags by 60% of scroll (positive lag offset).
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeCloseTo(1000 * 0.6, 5)
  })

  it('disabled for non-paper themes → 0 (no parallax)', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'dotted-notebook', motionEnabled: true, viewportY: 1000 }))
    expect(result.current).toBe(0)
  })

  it('disabled when motionEnabled=false → 0', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', motionEnabled: false, viewportY: 1000 }))
    expect(result.current).toBe(0)
  })

  it('disabled under prefers-reduced-motion → 0', () => {
    mockReducedMotion(true)
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', motionEnabled: true, viewportY: 1000 }))
    expect(result.current).toBe(0)
  })
})
