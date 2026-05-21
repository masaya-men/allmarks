import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewportPlaybackPool } from './use-viewport-playback-pool'

describe('useViewportPlaybackPool', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('promotes top-N visible ids after the debounce window', () => {
    const { result } = renderHook(() => useViewportPlaybackPool(2, 150))
    act(() => {
      result.current.report('a', 0.9)
      result.current.report('b', 0.2)
      result.current.report('c', 0.8)
    })
    expect(result.current.active.size).toBe(0) // debounced, not yet
    act(() => { vi.advanceTimersByTime(150) })
    expect(result.current.active.has('a')).toBe(true)
    expect(result.current.active.has('c')).toBe(true)
    expect(result.current.active.has('b')).toBe(false)
  })

  it('drops a card when it leaves the viewport (ratio 0)', () => {
    const { result } = renderHook(() => useViewportPlaybackPool(3, 150))
    act(() => { result.current.report('a', 0.9); vi.advanceTimersByTime(150) })
    expect(result.current.active.has('a')).toBe(true)
    act(() => { result.current.report('a', 0); vi.advanceTimersByTime(150) })
    expect(result.current.active.has('a')).toBe(false)
  })

  it('keeps the same active Set reference when recompute yields identical ids (no churn)', () => {
    const { result } = renderHook(() => useViewportPlaybackPool(3, 150))
    act(() => { result.current.report('a', 0.9); vi.advanceTimersByTime(150) })
    const first = result.current.active
    act(() => { result.current.report('a', 0.95); vi.advanceTimersByTime(150) }) // ratio changed, same id set
    expect(result.current.active).toBe(first) // same reference → no re-render churn
  })
})
