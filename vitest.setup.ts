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
