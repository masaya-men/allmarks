import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlaybackPool, LINGER_MS } from './use-playback-pool'

describe('usePlaybackPool', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('promote marks active immediately', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    expect(result.current.isActive('a')).toBe(true)
    expect(result.current.activeCount).toBe(1)
  })

  it('release keeps playing during the linger window, then stops', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    act(() => { result.current.release('a') })
    // still active mid-linger
    act(() => { vi.advanceTimersByTime(LINGER_MS - 50) })
    expect(result.current.isActive('a')).toBe(true)
    // stops after the linger window
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current.isActive('a')).toBe(false)
  })

  it('promote during the linger window cancels the pending stop', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    act(() => { result.current.release('a') })
    act(() => { vi.advanceTimersByTime(LINGER_MS - 50) })
    act(() => { result.current.promote('a') }) // re-enter
    act(() => { vi.advanceTimersByTime(LINGER_MS) })
    expect(result.current.isActive('a')).toBe(true)
  })

  it('caps at 3 active players (LRU eviction)', () => {
    const { result } = renderHook(() => usePlaybackPool())
    act(() => { result.current.promote('a') })
    act(() => { result.current.promote('b') })
    act(() => { result.current.promote('c') })
    act(() => { result.current.promote('d') })
    expect(result.current.activeCount).toBe(3)
    expect(result.current.isActive('a')).toBe(false)
    expect(result.current.isActive('d')).toBe(true)
  })
})
