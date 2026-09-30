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
// BackgroundGrid / PageScrollMeter carry a data-mock marker (not data-testid, so the order test below
// is unaffected) — the scroll-meter placement test needs to see where they sit.
vi.mock('@/lib/scroll/use-smooth-scroll', () => ({ useSmoothScroll: () => ({ current: null }) }))
vi.mock('./BackgroundGrid', () => ({ BackgroundGrid: () => <div data-mock="BackgroundGrid" /> }))
vi.mock('./PageScrollMeter', () => ({ PageScrollMeter: () => <div data-mock="PageScrollMeter" /> }))
vi.mock('./SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('./SiteFooter', () => ({ SiteFooter: () => <div data-testid="SiteFooter" /> }))
vi.mock('./sections/Hero', () => ({ Hero: () => <div data-testid="Hero" /> }))
vi.mock('./sections/Problem', () => ({ Problem: () => <div data-testid="Problem" /> }))
vi.mock('./sections/Tape', () => ({ Tape: () => <div data-testid="Tape" /> }))
vi.mock('./sections/Features', () => ({ Features: () => <div data-testid="Features" /> }))
vi.mock('./sections/FinalCta', () => ({ FinalCta: () => <div data-testid="FinalCta" /> }))
vi.mock('./sections/SyncPlan', () => ({ SyncPlan: () => <div data-mock="SyncPlan" /> }))

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-lp-scrollbar')
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

describe('LandingPage scroll meter', () => {
  it('PageScrollMeter は BackgroundGrid の直後に置く(本文 .content の外)', () => {
    const { container } = render(<LandingPage />)
    const grid = container.querySelector('[data-mock="BackgroundGrid"]')
    const meter = container.querySelector('[data-mock="PageScrollMeter"]')
    expect(meter).not.toBeNull()
    expect(grid?.nextElementSibling).toBe(meter)
    const content = container.querySelector('[data-testid="Hero"]')?.parentElement
    expect(content).toBeTruthy()
    expect(content?.contains(meter)).toBe(false)
  })

  it('LP のマウント中だけ <html data-lp-scrollbar="custom"> が付き、アンマウントで外れる', () => {
    const html = document.documentElement
    expect(html.hasAttribute('data-lp-scrollbar')).toBe(false)
    const { unmount } = render(<LandingPage />)
    expect(html.getAttribute('data-lp-scrollbar')).toBe('custom')
    unmount()
    expect(html.hasAttribute('data-lp-scrollbar')).toBe(false)
  })

  it('標準のスクロールバーを隠す CSS は、その属性がある時だけ効く(ほかのページには影響しない)', async () => {
    const css = await import('node:fs').then((fs) => fs.readFileSync('components/marketing/landing-tokens.css', 'utf8'))
    expect(css).toMatch(/html\[data-lp-scrollbar='custom'\]\s*\{\s*scrollbar-width:\s*none;\s*\}/)
    expect(css).toMatch(/html\[data-lp-scrollbar='custom'\]::-webkit-scrollbar\s*\{\s*display:\s*none;\s*\}/)
  })
})
