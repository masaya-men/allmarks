import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useModKey } from './use-mod-key'

/** jsdom's navigator.platform is configurable but not an own property by
 *  default (it's a Navigator.prototype getter) — deleting the stubbed own
 *  property after each test restores the original jsdom value, same pattern
 *  as components/board/MobileShareResult.test.tsx. */
function stubPlatform(platform: string): void {
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'platform')
})

describe('useModKey', () => {
  it('is "⌘" on a Mac platform', () => {
    stubPlatform('MacIntel')
    const { result } = renderHook(() => useModKey())
    expect(result.current).toBe('⌘')
  })

  it('is "Ctrl" on a Windows platform', () => {
    stubPlatform('Win32')
    const { result } = renderHook(() => useModKey())
    expect(result.current).toBe('Ctrl')
  })
})
