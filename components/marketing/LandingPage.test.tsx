import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { LandingPage } from './LandingPage'

// Stub scroll hooks (Lenis / GSAP) — they rely on browser APIs unavailable in jsdom
vi.mock('@/lib/scroll/use-smooth-scroll', () => ({
  useSmoothScroll: () => ({ current: null }),
}))
vi.mock('@/lib/scroll/use-scroll-trigger', () => ({
  useScrollTrigger: () => undefined,
}))

// Stub all section/child components so GSAP/Lenis never imports into jsdom
vi.mock('./SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('./SiteFooter', () => ({ SiteFooter: () => null }))
vi.mock('./sections/Hero', () => ({ Hero: () => null }))
vi.mock('./sections/Problem', () => ({ Problem: () => null }))
vi.mock('./sections/Features', () => ({ Features: () => null }))
vi.mock('./sections/ShareIt', () => ({ ShareIt: () => null }))
vi.mock('./sections/FinalCta', () => ({ FinalCta: () => null }))

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
