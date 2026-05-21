import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHoverIntent, HOVER_INTENT_MS } from './use-hover-intent'

describe('useHoverIntent', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fires onIntent after the delay', () => {
    const onIntent = vi.fn()
    const { result } = renderHook(() => useHoverIntent(onIntent))
    act(() => { result.current.start('a') })
    expect(onIntent).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS) })
    expect(onIntent).toHaveBeenCalledWith('a')
  })

  it('cancel before the delay prevents the fire', () => {
    const onIntent = vi.fn()
    const { result } = renderHook(() => useHoverIntent(onIntent))
    act(() => { result.current.start('a') })
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS - 50) })
    act(() => { result.current.cancel() })
    act(() => { vi.advanceTimersByTime(100) })
    expect(onIntent).not.toHaveBeenCalled()
  })

  it('a new start replaces the previous pending timer', () => {
    const onIntent = vi.fn()
    const { result } = renderHook(() => useHoverIntent(onIntent))
    act(() => { result.current.start('a') })
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS - 50) })
    act(() => { result.current.start('b') })
    act(() => { vi.advanceTimersByTime(HOVER_INTENT_MS) })
    expect(onIntent).toHaveBeenCalledTimes(1)
    expect(onIntent).toHaveBeenCalledWith('b')
  })
})
