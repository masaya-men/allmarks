import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsTouchDevice } from './use-is-touch-device'

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('useIsTouchDevice', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('is true when the primary pointer is coarse (touch)', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(true)
  })

  it('is false when the primary pointer is fine (mouse)', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(false)
  })
})
