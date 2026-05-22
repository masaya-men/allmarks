import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStaggeredReveal } from './use-staggered-reveal'

describe('useStaggeredReveal', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reveals nothing immediately, then one id per step in iteration order', () => {
    const target = new Set(['a', 'b', 'c'])
    const { result } = renderHook(() => useStaggeredReveal(target, 100))
    expect(result.current.size).toBe(0)
    act(() => { vi.advanceTimersByTime(100) })
    expect([...result.current]).toEqual(['a'])
    act(() => { vi.advanceTimersByTime(100) })
    expect([...result.current]).toEqual(['a', 'b'])
    act(() => { vi.advanceTimersByTime(100) })
    expect([...result.current]).toEqual(['a', 'b', 'c'])
  })

  it('does not reveal two ids within a single step', () => {
    const { result } = renderHook(() => useStaggeredReveal(new Set(['a', 'b']), 100))
    act(() => { vi.advanceTimersByTime(99) })
    expect(result.current.size).toBe(0)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.size).toBe(1)
  })

  it('removes a revealed id immediately when it leaves the target', () => {
    const target = new Set(['a', 'b'])
    const { result, rerender } = renderHook(({ t }) => useStaggeredReveal(t, 100), {
      initialProps: { t: target as ReadonlySet<string> },
    })
    act(() => { vi.advanceTimersByTime(100) }) // reveal a
    act(() => { vi.advanceTimersByTime(100) }) // reveal b
    expect(result.current.has('a')).toBe(true)
    act(() => { rerender({ t: new Set(['b']) }) })
    expect(result.current.has('a')).toBe(false) // gone without waiting a step
    expect(result.current.has('b')).toBe(true)
  })

  it('drains to empty when the target empties (e.g. MOTION off)', () => {
    const { result, rerender } = renderHook(({ t }) => useStaggeredReveal(t, 100), {
      initialProps: { t: new Set(['a', 'b']) as ReadonlySet<string> },
    })
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current.size).toBe(2)
    act(() => { rerender({ t: new Set<string>() }) })
    expect(result.current.size).toBe(0)
  })
})
