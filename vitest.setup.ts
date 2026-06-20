// Mock CSS modules
import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.stubGlobal('CSS', {
  supports: () => false,
})

// ResizeObserver is not available in jsdom — stub with a no-op
vi.stubGlobal('ResizeObserver', class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
})

// matchMedia is not implemented in jsdom — default to "no match" (e.g.
// prefers-reduced-motion: reduce -> false). Individual tests can override via
// vi.stubGlobal('matchMedia', ...) for reduced-motion-specific assertions.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: (): void => {},
    removeListener: (): void => {},
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    dispatchEvent: (): boolean => false,
  }))
}
