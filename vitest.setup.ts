// Mock CSS modules
import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.stubGlobal('CSS', {
  supports: () => false,
})
