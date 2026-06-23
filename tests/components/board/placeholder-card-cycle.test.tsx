import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { PlaceholderCard } from '@/components/board/cards/PlaceholderCard'
import type { BoardItem } from '@/lib/storage/use-board-data'

function makeItem(url: string): BoardItem {
  return {
    bookmarkId: 'b1',
    cardId: 'c1',
    title: 'Test Title',
    url,
    aspectRatio: 1.25,
    gridIndex: 0,
    orderIndex: 0,
    cardWidth: 280,
    customCardWidth: false,
    isRead: false,
    isDeleted: false,
    tags: [],
    displayMode: null,
  }
}

// IntersectionObserver stub that immediately reports the element as on-screen,
// so the "in view" gate is satisfied synchronously in tests.
class ImmediateIO {
  private readonly cb: IntersectionObserverCallback
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
  }
  observe(el: Element): void {
    this.cb(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

// PlaceholderCard's title-overflow effect uses ResizeObserver (absent in jsdom).
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function bgLayers(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div')).filter((d) =>
    d.style.backgroundImage.includes('/placeholders/art/'),
  )
}

describe('PlaceholderCard generated-art cycling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Deterministic: index 0, 0ms initial offset, minimum step.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.stubGlobal('IntersectionObserver', ImmediateIO)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders a single static frame[0] when ambientOn is false (= Lightbox / motion off)', () => {
    const { container } = render(
      <PlaceholderCard item={makeItem('https://a.test/x')} ambientOn={false} />,
    )
    const layers = bgLayers(container)
    expect(layers).toHaveLength(1)
    expect(layers[0]!.style.opacity).toBe('1')
  })

  it('stacks all frames and crossfades to another frame over time when ambientOn + on-screen', () => {
    const { container } = render(
      <PlaceholderCard item={makeItem('https://a.test/x')} ambientOn />,
    )
    // All frames stacked; frame[0] is the one shown first (= matches static).
    expect(bgLayers(container)).toHaveLength(3)
    expect(bgLayers(container)[0]!.style.opacity).toBe('1')

    // Fire the cycle timer → the visible frame advances off frame[0].
    act(() => {
      vi.advanceTimersByTime(0)
    })
    const layers = bgLayers(container)
    expect(layers[0]!.style.opacity).toBe('0')
    expect(layers.filter((l) => l.style.opacity === '1')).toHaveLength(1)
  })
})
