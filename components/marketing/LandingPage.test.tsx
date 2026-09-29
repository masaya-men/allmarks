import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { LandingPage } from './LandingPage'

// Stub scroll hooks (GSAP) — they rely on browser APIs unavailable in jsdom
vi.mock('@/lib/scroll/use-scroll-trigger', () => ({
  useScrollTrigger: () => undefined,
}))

// Stub all section/child components so GSAP never imports into jsdom.
// The section + footer mocks render a data-testid so the composition-order
// test below can assert on document order without depending on each
// section's real (GSAP-heavy) internals.
vi.mock('./BackgroundGrid', () => ({ BackgroundGrid: () => null }))
vi.mock('./SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('./SiteFooter', () => ({ SiteFooter: () => <div data-testid="SiteFooter" /> }))
vi.mock('./sections/Hero', () => ({ Hero: () => <div data-testid="Hero" /> }))
vi.mock('./sections/Problem', () => ({ Problem: () => <div data-testid="Problem" /> }))
vi.mock('./sections/Tape', () => ({ Tape: () => <div data-testid="Tape" /> }))
vi.mock('./sections/Features', () => ({ Features: () => <div data-testid="Features" /> }))
vi.mock('./sections/FinalCta', () => ({ FinalCta: () => <div data-testid="FinalCta" /> }))

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('data-theme')
})

describe('LandingPage locale', () => {
  it('locale=ja で <html lang> が ja になる', () => {
    render(<LandingPage locale="ja" />)
    expect(document.documentElement.getAttribute('lang')).toBe('ja')
  })
  it('locale 未指定なら en', () => {
    render(<LandingPage />)
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })
})

describe('LandingPage composition', () => {
  it('renders Hero, Problem, Tape, Features, FinalCta, SiteFooter in that order', () => {
    const { container } = render(<LandingPage />)
    const order = Array.from(container.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(order).toEqual(['Hero', 'Problem', 'Tape', 'Features', 'FinalCta', 'SiteFooter'])
  })

  it('does not render ShareIt', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('components/marketing/LandingPage.tsx', 'utf8'))
    expect(src).not.toMatch(/ShareIt/)
  })
})

it('LP は Lenis(useSmoothScroll)を使わない', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync('components/marketing/LandingPage.tsx', 'utf8'))
  expect(src).not.toMatch(/useSmoothScroll/)
})
