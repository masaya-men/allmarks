import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ImageCard } from './ImageCard'

const item = {
  cardId: 'x',
  bookmarkId: 'x',
  url: 'https://example.com',
  title: 't',
  aspectRatio: 1,
  mediaSlots: [
    { type: 'photo', url: 'a.jpg' },
    { type: 'photo', url: 'b.jpg' },
    { type: 'photo', url: 'c.jpg' },
  ],
} as unknown as Parameters<typeof ImageCard>[0]['item']

describe('ImageCard auto-cycle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const activeIndex = (els: HTMLElement[]): number =>
    els.findIndex((d) => d.getAttribute('data-active') === 'true')

  it('advances the active image on an interval when autoCycle is on', () => {
    const { getAllByTestId } = render(
      <ImageCard item={item} displayMode="visual" autoCycle cycleMs={1000} />,
    )
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(1)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(2)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(0) // wraps
  })

  it('does not cycle when autoCycle is off', () => {
    const { getAllByTestId } = render(
      <ImageCard item={item} displayMode="visual" autoCycle={false} cycleMs={1000} />,
    )
    act(() => { vi.advanceTimersByTime(3000) })
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(0)
  })
})
