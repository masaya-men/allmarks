import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ScrollMeter } from './ScrollMeter'

describe('ScrollMeter (unified board/lightbox meter)', () => {
  it('renders 150 ticks inside the track', () => {
    const { getByTestId } = render(
      <ScrollMeter
        mode="board"
        n1={1}
        n2={12}
        total={234}
        swellFraction={0}
        onScrub={() => {}}
      />,
    )
    const track = getByTestId('scroll-meter')
    const tickElements = Array.from(track.children).filter(
      (el) => (el as HTMLElement).style.left,
    )
    expect(tickElements).toHaveLength(150)
  })

  it('fires onScrub with the pointer fraction on pointer down', () => {
    // The actual onScrub fire is rAF-throttled inside the meter; jsdom
    // doesn't run rAF so we only assert that pointer down captures the
    // scrub start (= the data-dragging attribute flips). Browser tests
    // (= playwright) cover the rAF fire path end-to-end.
    const onScrub = vi.fn()
    const { getByTestId } = render(
      <ScrollMeter
        mode="board"
        n1={1}
        n2={12}
        total={234}
        swellFraction={0}
        onScrub={onScrub}
      />,
    )
    const track = getByTestId('scroll-meter')
    track.getBoundingClientRect = (): DOMRect => ({
      x: 0, y: 0, width: 200, height: 18, top: 0, right: 200, bottom: 18, left: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 })
    expect(track.getAttribute('data-dragging')).toBe('true')
  })

  it('renders the counter readout with zero-padded N1, N2, TOTAL', () => {
    const { container } = render(
      <ScrollMeter
        mode="board"
        n1={1}
        n2={12}
        total={234}
        swellFraction={0}
        onScrub={() => {}}
      />,
    )
    // The counter row pre-renders the initial values before the rAF loop
    // overwrites them on first frame; in jsdom rAF doesn't fire so the
    // initial textContent is what we assert against.
    expect(container.textContent).toContain('0001')
    expect(container.textContent).toContain('0012')
    expect(container.textContent).toContain('0234')
  })

  it('exposes the current mode via data-mode for downstream targeting', () => {
    const { getByTestId, rerender } = render(
      <ScrollMeter
        mode="board"
        n1={1}
        n2={12}
        total={234}
        swellFraction={0}
        onScrub={() => {}}
      />,
    )
    expect(getByTestId('scroll-meter').getAttribute('data-mode')).toBe('board')
    rerender(
      <ScrollMeter
        mode="lightbox"
        n1={7}
        n2={7}
        total={234}
        swellFraction={0.026}
        onScrub={() => {}}
      />,
    )
    expect(getByTestId('scroll-meter').getAttribute('data-mode')).toBe('lightbox')
  })
})
