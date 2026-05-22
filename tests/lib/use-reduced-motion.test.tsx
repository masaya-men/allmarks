import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { type ReactElement } from 'react'
import { useReducedMotion } from '@/lib/board/use-reduced-motion'

function Probe(): ReactElement {
  return <span data-testid="v">{String(useReducedMotion())}</span>
}

function mockMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))
}

describe('useReducedMotion', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('reports true when the OS prefers reduced motion', () => {
    mockMatchMedia(true)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('v').textContent).toBe('true')
  })

  it('reports false when the OS does not prefer reduced motion', () => {
    mockMatchMedia(false)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('v').textContent).toBe('false')
  })
})
