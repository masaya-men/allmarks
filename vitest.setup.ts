// Mock CSS modules
import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// When fake timers are active, waitFor's internal polling relies on setInterval
// which gets stubbed. Configure RTL to advance fake timers on each waitFor tick
// so async effects settle even with vi.useFakeTimers().
configure({
  asyncWrapper: async (fn) => {
    let result!: Awaited<ReturnType<typeof fn>>
    await vi.runAllTimersAsync().catch(() => {})
    result = await fn()
    return result
  },
})

vi.stubGlobal('CSS', {
  supports: () => false,
})

// ResizeObserver is not available in jsdom — stub with a no-op
vi.stubGlobal('ResizeObserver', class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
})
