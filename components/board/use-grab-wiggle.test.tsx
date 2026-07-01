import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useGrabWiggle } from './use-grab-wiggle'
import { MAX_GRAB_PX, rubberBand } from '@/lib/board/rubber-band'

function mockReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? reduced : false,
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
}

/** Render the hook with a real detached <div> as the CSS-var container. */
function renderWithContainer(reduced: boolean) {
  mockReducedMotion(reduced)
  const el = document.createElement('div')
  const rendered = renderHook(() => {
    const ref = useRef<HTMLDivElement>(el)
    return useGrabWiggle({ containerRef: ref })
  })
  return { el, ...rendered }
}

describe('useGrabWiggle', () => {
  beforeEach(() => mockReducedMotion(false))
  afterEach(() => vi.unstubAllGlobals())

  it('is disabled under prefers-reduced-motion and applies no offset', () => {
    const { el, result } = renderWithContainer(true)
    expect(result.current.enabled).toBe(false)
    act(() => { result.current.begin(100, 100); result.current.move(200, 100) })
    // The gesture is a no-op; the only write is the harmless mount reset to 0.
    expect(parseFloat(el.style.getPropertyValue('--grab-x') || '0')).toBe(0)
  })

  it('writes rubber-banded vars on begin+move when enabled', () => {
    const { el, result } = renderWithContainer(false)
    expect(result.current.enabled).toBe(true)
    act(() => { result.current.begin(100, 100) })
    act(() => { result.current.move(140, 100) })
    const expectedX = rubberBand(40, MAX_GRAB_PX)
    expect(parseFloat(el.style.getPropertyValue('--grab-x'))).toBeCloseTo(expectedX, 2)
    expect(parseFloat(el.style.getPropertyValue('--grab-y'))).toBeCloseTo(0, 2)
  })

  it('sets grabbing true on begin and false on end', () => {
    const { result } = renderWithContainer(false)
    act(() => { result.current.begin(0, 0) })
    expect(result.current.grabbing).toBe(true)
    act(() => { result.current.end() })
    expect(result.current.grabbing).toBe(false)
  })

  it('move before begin is a no-op', () => {
    const { el, result } = renderWithContainer(false)
    act(() => { result.current.move(50, 50) })
    expect(parseFloat(el.style.getPropertyValue('--grab-x') || '0')).toBe(0)
  })
})
