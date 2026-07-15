import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChromeScramble } from './use-idle-scramble'

describe('useChromeScramble — gated to signature themes', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.removeAttribute('data-theme-id')
  })

  it('quiet theme (flat): no idle wobble is scheduled, display stays the raw label, triggerBurst is a no-op', () => {
    document.documentElement.setAttribute('data-theme-id', 'flat')
    const { result } = renderHook(() => useChromeScramble('TITLE'))

    expect(result.current.display).toBe('TITLE')
    // The core assertion: quiet themes must not even arm the idle-wobble
    // timer (not just "never visibly changes").
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.display).toBe('TITLE')
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      result.current.triggerBurst()
      vi.advanceTimersByTime(2_000)
    })
    expect(result.current.display).toBe('TITLE')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('signature theme (dotted-notebook): idle wobble is scheduled and triggerBurst can change display', () => {
    document.documentElement.setAttribute('data-theme-id', 'dotted-notebook')
    const { result } = renderHook(() => useChromeScramble('TITLE'))

    expect(result.current.display).toBe('TITLE')
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    act(() => {
      result.current.triggerBurst()
      vi.advanceTimersByTime(1)
    })
    // triggerBurst kicks off a rAF-driven scramble — at minimum it must not
    // throw and must remain a string of the same length as the label.
    expect(result.current.display.length).toBe('TITLE'.length)
  })
})
