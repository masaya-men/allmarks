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
  beforeEach(() => {
    vi.useFakeTimers()
    // Deterministic: random()=0 → initial idx 0, initial offset 0ms, step = minMs = cycleMs * 0.6.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const activeIndex = (els: HTMLElement[]): number =>
    els.findIndex((d) => d.getAttribute('data-active') === 'true')

  it('advances the active image on a randomized interval when autoCycle is on', () => {
    // cycleMs=1000 → minMs=600. random()=0 → initial offset 0ms, then 600ms per step.
    const { getAllByTestId } = render(
      <ImageCard item={item} displayMode="visual" autoCycle cycleMs={1000} />,
    )
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(0)
    act(() => { vi.advanceTimersByTime(0) }) // fire initial offset (0ms)
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(1)
    act(() => { vi.advanceTimersByTime(600) })
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(2)
    act(() => { vi.advanceTimersByTime(600) })
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(0) // wraps
  })

  it('picks a random starting slot so cards mounted together do not all start at 0', () => {
    // random()=0.7 → Math.floor(0.7 * 3) = 2 as the initial slot index.
    vi.mocked(Math.random).mockReturnValue(0.7)
    const { getAllByTestId } = render(
      <ImageCard item={item} displayMode="visual" autoCycle cycleMs={1000} />,
    )
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(2)
  })

  it('does not cycle when autoCycle is off', () => {
    const { getAllByTestId } = render(
      <ImageCard item={item} displayMode="visual" autoCycle={false} cycleMs={1000} />,
    )
    act(() => { vi.advanceTimersByTime(3000) })
    expect(activeIndex(getAllByTestId('multi-image-dot'))).toBe(0)
  })

  it('resets to the lead image when autoCycle turns off', () => {
    const { getAllByTestId, rerender } = render(<ImageCard item={item} displayMode="visual" autoCycle cycleMs={1000} />)
    // random()=0: initial offset 0ms → idx 1, then 600ms → idx 2.
    act(() => { vi.advanceTimersByTime(0) })
    act(() => { vi.advanceTimersByTime(600) })
    const activeIndex = (): number => getAllByTestId('multi-image-dot').findIndex((d) => d.getAttribute('data-active') === 'true')
    expect(activeIndex()).toBe(2)
    rerender(<ImageCard item={item} displayMode="visual" autoCycle={false} cycleMs={1000} />)
    expect(activeIndex()).toBe(0)
  })
})
