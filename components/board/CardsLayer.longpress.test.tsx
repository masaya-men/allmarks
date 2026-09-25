import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, cleanup } from '@testing-library/react'
import { CardsLayer } from './CardsLayer'
import type { BoardItem } from '@/lib/storage/use-board-data'

// jsdom doesn't implement the Pointer Events capture API. The desktop
// (isMobile=false) test below exercises the pre-existing drag-to-reorder
// pointerdown path (useCardReorderDrag), which calls setPointerCapture — stub
// it so that unrelated, already-existing code doesn't throw in this
// environment (mirrors how real browsers no-op it on elements that can't
// capture).
if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = (): void => {}
  Element.prototype.releasePointerCapture = (): void => {}
  Element.prototype.hasPointerCapture = (): boolean => false
}

// Mobile long-press → TRASH multi-select gesture. Mirrors FaderColumn.test.tsx's
// long-press coverage (pointerdown arms a timer, fireEvent + fake timers advance
// it, movement/early-lift cancel it) — the closest existing precedent in this
// repo for a timer-based pointer gesture.

const noop = (): void => {}
const asyncNoop = async (): Promise<void> => {}

function item(bookmarkId: string): BoardItem {
  return {
    bookmarkId,
    cardId: bookmarkId,
    title: 'Test card',
    thumbnail: '',
    url: 'https://example.com/' + bookmarkId,
    aspectRatio: 1,
    gridIndex: 0,
    orderIndex: 0,
    cardWidth: 240,
    customCardWidth: false,
    isRead: false,
    isDeleted: false,
    tags: [],
    displayMode: null,
  }
}

type BaseProps = Parameters<typeof CardsLayer>[0]

function baseProps(overrides: Partial<BaseProps> = {}): BaseProps {
  return {
    items: [item('a')],
    viewport: { x: 0, y: 0, w: 1000, h: 1000 },
    viewportWidth: 1000,
    cardGapPx: 12,
    hoveredBookmarkId: null,
    audioActiveId: null,
    onToggleAudio: noop,
    audioVolume: 1,
    audioPaused: false,
    onAudioVolumeChange: noop,
    onAudioTogglePause: noop,
    spaceHeld: false,
    onHoverChange: noop,
    onClick: noop,
    onDrop: noop,
    onDelete: noop,
    displayMode: 'visual',
    newlyAddedIds: new Set<string>(),
    defaultCardWidth: 240,
    customWidths: {},
    onCardResize: noop,
    onCardResizeEnd: noop,
    onCardResetSize: noop,
    motionEnabled: false,
    themeId: 'flat',
    onTagToggle: asyncNoop,
    onTagCreate: asyncNoop,
    ...overrides,
  } as BaseProps
}

function getCard(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-bookmark-id="a"]')
  if (!el) throw new Error('card not rendered')
  return el as HTMLElement
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CardsLayer long-press → TRASH multi-select', () => {
  it('fires onLongPressCard after the hold (mobile, no active mode)', () => {
    vi.useFakeTimers()
    const onLongPressCard = vi.fn()
    const { container } = render(
      <CardsLayer {...baseProps({ isMobile: true, onLongPressCard })} />,
    )
    const card = getCard(container)
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 })
    expect(onLongPressCard).not.toHaveBeenCalled()
    vi.advanceTimersByTime(510)
    expect(onLongPressCard).toHaveBeenCalledWith('a')
  })

  it('cancels the long-press when the pointer moves past the threshold', () => {
    vi.useFakeTimers()
    const onLongPressCard = vi.fn()
    const { container } = render(
      <CardsLayer {...baseProps({ isMobile: true, onLongPressCard })} />,
    )
    const card = getCard(container)
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 10, pointerId: 1 })
    vi.advanceTimersByTime(600)
    expect(onLongPressCard).not.toHaveBeenCalled()
  })

  it('cancels the long-press on an early release', () => {
    vi.useFakeTimers()
    const onLongPressCard = vi.fn()
    const { container } = render(
      <CardsLayer {...baseProps({ isMobile: true, onLongPressCard })} />,
    )
    const card = getCard(container)
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 10, clientY: 10, pointerId: 1 })
    vi.advanceTimersByTime(600)
    expect(onLongPressCard).not.toHaveBeenCalled()
  })

  it('is never armed while another selection mode (SHARE/TAG) is already active', () => {
    vi.useFakeTimers()
    const onLongPressCard = vi.fn()
    const onToggle = vi.fn()
    const { container } = render(
      <CardsLayer
        {...baseProps({
          isMobile: true,
          onLongPressCard,
          selectionMode: { selectedIds: new Set(), onToggle },
        })}
      />,
    )
    const card = getCard(container)
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 })
    vi.advanceTimersByTime(600)
    expect(onLongPressCard).not.toHaveBeenCalled()
  })

  it('is a no-op on desktop (isMobile false) even after a long hold', () => {
    vi.useFakeTimers()
    const onLongPressCard = vi.fn()
    const { container } = render(
      <CardsLayer {...baseProps({ isMobile: false, onLongPressCard })} />,
    )
    const card = getCard(container)
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 })
    vi.advanceTimersByTime(600)
    expect(onLongPressCard).not.toHaveBeenCalled()
  })

  it('a tap still toggles selection once selectionMode is active (reused machinery)', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <CardsLayer
        {...baseProps({
          isMobile: true,
          selectionMode: { selectedIds: new Set(), onToggle },
        })}
      />,
    )
    const card = getCard(container)
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(card, { clientX: 10, clientY: 10, pointerId: 1 })
    expect(onToggle).toHaveBeenCalledWith('a')
  })
})
