/**
 * SharedBoard.test.tsx
 *
 * Tests that the receiver page applies the sender's theme to <html> and renders
 * the pattern layer when the share has a pattern theme (e.g. 'grid-paper').
 *
 * Strategy: component test with stubbed heavy children (CardsLayer, TopHeader,
 * ScrollMeter, Lightbox, SenderShareModal, ImportProgressIndicator, etc.) so
 * that jsdom can mount SharedBoard without IDB / canvas / ResizeObserver pain.
 * fetchShare + extractShareIdFromPathname are mocked to inject a ready state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { SHARE_SCHEMA_VERSION_V2, type GetShareResponse } from '@/lib/share/types-v2'

// ── Next.js router ──
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// ── Heavy board components → stubs ──
vi.mock('@/components/board/CardsLayer', () => ({
  CardsLayer: (): ReactElement => <div data-testid="mock-cards-layer" />,
}))
vi.mock('@/components/board/TopHeader', () => ({
  TopHeader: (): ReactElement => <div data-testid="mock-top-header" />,
}))
vi.mock('@/components/board/ScrollMeter', () => ({
  ScrollMeter: (): ReactElement => <div data-testid="mock-scroll-meter" />,
}))
vi.mock('@/components/board/Lightbox', () => ({
  Lightbox: (): ReactElement => <div data-testid="mock-lightbox" />,
}))
vi.mock('@/components/board/MotionToggle', () => ({
  MotionToggle: (): ReactElement => <div data-testid="mock-motion-toggle" />,
}))
vi.mock('@/components/board/ChromeLedToggle', () => ({
  ChromeLedToggle: (): ReactElement => <span data-testid="mock-chrome-led-toggle" />,
}))
vi.mock('@/components/board/ChromeButton', () => ({
  ChromeButton: (): ReactElement => <button data-testid="mock-chrome-button" />,
}))
vi.mock('@/components/board/TuneTrigger', () => ({
  TuneTrigger: (): ReactElement => <span data-testid="mock-tune-trigger" />,
}))
vi.mock('@/components/board/BlockedChrome', () => ({
  BlockedChrome: (): ReactElement => <span data-testid="mock-blocked-chrome" />,
}))
vi.mock('./ImportProgressIndicator', () => ({
  ImportProgressIndicator: (): ReactElement => <div data-testid="mock-import-progress" />,
}))
vi.mock('./SenderShareModal', () => ({
  SenderShareModal: (): ReactElement => <div data-testid="mock-sender-share-modal" />,
}))

// ── IDB (not used in the read path, but imported at module level) ──
vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(),
  addBookmarkBatch: vi.fn(),
  getAllBookmarks: vi.fn().mockResolvedValue([]),
}))

// ── share modules ──
vi.mock('@/lib/share/extract-share-id', () => ({
  extractShareIdFromPathname: () => ({ ok: true, id: 'abc123' }),
}))

// api-client is mocked per-test via mockResolvedValue
vi.mock('@/lib/share/api-client', () => ({
  fetchShare: vi.fn(),
}))

// ── import the component AFTER mocks are registered ──
import { SharedBoard } from './SharedBoard'
import { fetchShare } from '@/lib/share/api-client'

const mockedFetchShare = vi.mocked(fetchShare)

/** Minimal ShareDataV2 with a grid-paper theme + sender customization.
 *  Must have at least 1 card (sanitizeShareDataV2 → schema min(1)). */
const GRID_PAPER_SHARE_DATA = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [
    {
      u: 'https://example.com/article',
      t: 'Test Article',
      ty: 'website' as const,
      cw: 320,
      a: 1.6,
    },
  ],
  theme: 'grid-paper' as const,
  custom: {
    edgeColor: '#0a0a0a',
    boardColor: '#0e0e11',
    patternColor: 'rgba(255,255,255,0.18)',
    patternType: 'grid' as const,
    patternSize: 40,
    titleColor: '#fff',
  },
  createdAt: Date.now(),
} satisfies import('@/lib/share/types-v2').ShareDataV2

function renderReady(): void {
  const response: GetShareResponse = { share: GRID_PAPER_SHARE_DATA }
  mockedFetchShare.mockResolvedValue({ ok: true, data: response })
  render(<SharedBoard />)
}

describe('SharedBoard theme application', () => {
  beforeEach(() => {
    // Reset html attributes between tests
    document.documentElement.removeAttribute('data-theme-id')
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme-id')
    vi.clearAllMocks()
  })

  it('applies data-theme-id to <html> and renders the pattern layer for a pattern theme', async () => {
    renderReady()

    // Wait for fetchShare to resolve and state to transition to 'ready'
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve() // two microtask ticks: fetchShare + setState
    })

    expect(document.documentElement.getAttribute('data-theme-id')).toBe('grid-paper')
    const patternEl = document.querySelector('[data-pattern="grid"]') as HTMLElement | null
    expect(patternEl).not.toBeNull()
    // The layer must be positioned so it fills the canvas; height:0 means nothing paints.
    expect(patternEl!.style.position).toBe('absolute')
    expect(patternEl!.style.inset).toBe('0px')
  })

  it('removes data-theme-id from <html> on unmount', async () => {
    const response: GetShareResponse = { share: GRID_PAPER_SHARE_DATA }
    mockedFetchShare.mockResolvedValue({ ok: true, data: response })
    const { unmount } = render(<SharedBoard />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(document.documentElement.getAttribute('data-theme-id')).toBe('grid-paper')
    unmount()
    expect(document.documentElement.hasAttribute('data-theme-id')).toBe(false)
  })
})
