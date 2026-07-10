/**
 * SharedBoard.mobile-scroll.test.tsx
 *
 * Guards the N-46 fix: on a phone the receiver must hand vertical scrolling to
 * the browser, exactly like the real board does.
 *
 * The mechanism is CardsLayer's per-card `data-lock-card-scroll="true"` flag,
 * which relaxes `.cardNode`'s `touch-action: none` to `pan-y`
 * (CardNode.module.css). Without it every finger press on the dense 3-column
 * grid cancels the native scroll — measured on the built receiver: 0/100 cards
 * carried the flag and `.cardNode` computed `touch-action: none`, while the
 * real board's cards computed `pan-y`.
 *
 * The receiver must reach that flag WITHOUT passing `isMobile`: CardsLayer
 * derives `hoverActive` from `!isMobile` (CardsLayer.tsx), so an `isMobile`
 * receiver would lose its per-card × delete button and the sender's tag pills,
 * and would swap its dedicated tap detector for the board's click path. Hence
 * the dedicated `lockCardScroll` prop — these tests pin both halves of that
 * contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { SHARE_SCHEMA_VERSION_V2, type GetShareResponse } from '@/lib/share/types-v2'

// ── Captured CardsLayer props (the subject under test) ──
const cardsLayerProps: Record<string, unknown>[] = []

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/board/CardsLayer', () => ({
  CardsLayer: (props: Record<string, unknown>): ReactElement => {
    cardsLayerProps.push(props)
    return <div data-testid="mock-cards-layer" />
  },
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
// ChromeButton is NOT mocked: it forwards data-testid, and the whole point of
// these tests is which IMPORT button exists.
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
vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(),
  addBookmarkBatch: vi.fn(),
  getAllBookmarks: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/share/extract-share-id', () => ({
  extractShareIdFromPathname: () => ({ ok: true, id: 'abc123' }),
}))
vi.mock('@/lib/share/api-client', () => ({
  fetchShare: vi.fn(),
}))

// The two knobs these tests turn.
vi.mock('@/lib/board/use-is-mobile', () => ({
  useIsMobile: vi.fn(),
}))
vi.mock('@/lib/board/use-is-touch-device', () => ({
  useIsTouchDevice: vi.fn(),
}))

import { SharedBoard } from './SharedBoard'
import { fetchShare } from '@/lib/share/api-client'
import { useIsMobile } from '@/lib/board/use-is-mobile'
import { useIsTouchDevice } from '@/lib/board/use-is-touch-device'

const mockedFetchShare = vi.mocked(fetchShare)
const mockedUseIsMobile = vi.mocked(useIsMobile)
const mockedUseIsTouchDevice = vi.mocked(useIsTouchDevice)

const SHARE_DATA = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [
    { u: 'https://example.com/a', t: 'A', ty: 'website' as const, cw: 320, a: 1.6 },
    { u: 'https://example.com/b', t: 'B', ty: 'website' as const, cw: 320, a: 1.6 },
  ],
  createdAt: Date.now(),
} satisfies import('@/lib/share/types-v2').ShareDataV2

async function renderReady(): Promise<void> {
  const response: GetShareResponse = { share: SHARE_DATA }
  mockedFetchShare.mockResolvedValue({ ok: true, data: response })
  render(<SharedBoard />)
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Props of the last CardsLayer render (state settles before we assert). */
function lastProps(): Record<string, unknown> {
  const p = cardsLayerProps.at(-1)
  if (!p) throw new Error('CardsLayer never rendered')
  return p
}

describe('SharedBoard → CardsLayer mobile scroll wiring (N-46)', () => {
  beforeEach(() => {
    cardsLayerProps.length = 0
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme-id')
    vi.clearAllMocks()
  })

  it('hands vertical scrolling to the browser on a phone by locking card scroll', async () => {
    mockedUseIsMobile.mockReturnValue(true)
    mockedUseIsTouchDevice.mockReturnValue(true)
    await renderReady()

    expect(lastProps().lockCardScroll).toBe(true)
  })

  // A tablet is wider than the 640px mobile breakpoint but still scrolls with a
  // finger, so the width gate alone leaves its cards at touch-action: none.
  it('locks card scroll on a wide touch device (tablet) despite the width gate', async () => {
    mockedUseIsMobile.mockReturnValue(false)
    mockedUseIsTouchDevice.mockReturnValue(true)
    await renderReady()

    expect(lastProps().lockCardScroll).toBe(true)
  })

  it('never passes isMobile, which would strip the receiver × and tag pills', async () => {
    mockedUseIsMobile.mockReturnValue(true)
    mockedUseIsTouchDevice.mockReturnValue(true)
    await renderReady()

    // Passing isMobile would force CardsLayer's hoverActive permanently false.
    expect(lastProps().isMobile).toBeUndefined()
  })

  it('leaves mouse desktops untouched so the reorder drag keeps touch-action: none', async () => {
    mockedUseIsMobile.mockReturnValue(false)
    mockedUseIsTouchDevice.mockReturnValue(false)
    await renderReady()

    expect(lastProps().lockCardScroll).toBe(false)
    expect(lastProps().isMobile).toBeUndefined()
  })
})

/** N-48: the desktop IMPORT is a 27px button in a band that `display:none`s
 *  under 640px — invisible on a phone, unusable with a finger on a tablet. */
describe('SharedBoard touch import bar (N-48)', () => {
  beforeEach(() => {
    cardsLayerProps.length = 0
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme-id')
    vi.clearAllMocks()
  })

  const importButtons = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="import-button"]'))
  const bar = (): HTMLElement | null => document.querySelector('[data-testid="receiver-import-bar"]')
  const meter = (): HTMLElement | null => document.querySelector('[data-testid="mock-scroll-meter"]')

  it('puts the only IMPORT button in the bottom bar on a phone', async () => {
    mockedUseIsMobile.mockReturnValue(true)
    mockedUseIsTouchDevice.mockReturnValue(true)
    await renderReady()

    expect(bar()).not.toBeNull()
    expect(importButtons()).toHaveLength(1)
    expect(bar()!.contains(importButtons()[0]!)).toBe(true)
    expect(importButtons()[0]!.textContent).toBe('IMPORT 2 TO YOUR BOARD')
  })

  it('does the same on a wide touch device (tablet), where the top button is only 27px tall', async () => {
    mockedUseIsMobile.mockReturnValue(false)
    mockedUseIsTouchDevice.mockReturnValue(true)
    await renderReady()

    expect(bar()).not.toBeNull()
    expect(importButtons()).toHaveLength(1)
    expect(bar()!.contains(importButtons()[0]!)).toBe(true)
  })

  it('keeps the top IMPORT and no bar on a mouse desktop', async () => {
    mockedUseIsMobile.mockReturnValue(false)
    mockedUseIsTouchDevice.mockReturnValue(false)
    await renderReady()

    expect(bar()).toBeNull()
    expect(importButtons()).toHaveLength(1)
  })

  // The scrub track is 18px tall — below the finger minimum — and would sit
  // under the bar's footprint.
  it('hides the scroll meter on a touch surface', async () => {
    mockedUseIsMobile.mockReturnValue(false)
    mockedUseIsTouchDevice.mockReturnValue(true)
    await renderReady()

    expect(meter()).toBeNull()
  })

  it('keeps the scroll meter for a mouse', async () => {
    mockedUseIsMobile.mockReturnValue(false)
    mockedUseIsTouchDevice.mockReturnValue(false)
    await renderReady()

    expect(meter()).not.toBeNull()
  })
})
