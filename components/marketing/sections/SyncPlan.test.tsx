import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// gsap/ScrollTrigger rely on browser APIs jsdom lacks — stub them.
vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: () => undefined,
    context: (fn: () => void) => {
      fn()
      return { revert: () => undefined }
    },
    to: () => undefined,
    fromTo: () => undefined,
  },
}))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }))
vi.mock('@/lib/marketing/lp/art', () => ({ makeCard: () => document.createElement('div') }))

import { SyncPlan } from './SyncPlan'

function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string): MediaQueryList =>
      ({ matches: q.includes('reduce'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList,
  })
}

afterEach(() => cleanup())

describe('SyncPlan', () => {
  it('renders the Japanese copy and a pricing link', () => {
    stubMatchMedia()
    render(<SyncPlan locale="ja" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('どの端末でも、同じボード。')
    expect(screen.getByTestId('lp-sync-pricing').getAttribute('href')).toContain('pricing')
  })
  it('renders the English copy and a pricing link', () => {
    stubMatchMedia()
    render(<SyncPlan locale="en" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Same board,on every device.')
    expect(screen.getByTestId('lp-sync-pricing').getAttribute('href')).toContain('pricing')
  })
})
