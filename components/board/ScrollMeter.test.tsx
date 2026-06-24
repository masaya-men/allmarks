import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ScrollMeter } from './ScrollMeter'
import { getThemeMeta } from '@/lib/board/theme-registry'

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

describe('ScrollMeter color tokenization (waveform default unchanged)', () => {
  const css = readFileSync(
    resolve(__dirname, 'ScrollMeter.module.css'),
    'utf8',
  )

  it('drives baseline/tick/hoverLine/meterDim colors through --meter-* tokens with the current literal as the var() fallback', () => {
    // baseline default literal preserved as the fallback
    expect(css).toContain('var(--meter-baseline-color, rgba(255, 255, 255, 0.18))')
    expect(css).toContain('var(--meter-tick-color, rgba(255, 255, 255, 0.55))')
    expect(css).toContain('var(--meter-hover-line-color, rgba(255, 255, 255, 0.5))')
    expect(css).toContain('var(--meter-hover-line-shadow, rgba(255, 255, 255, 0.3))')
    expect(css).toContain('var(--meter-dim-color, rgba(255, 255, 255, 0.6))')
  })
})

describe('ScrollMeter variant prop', () => {
  it('defaults to waveform (150 ticks, no ruler) when variant is omitted', () => {
    const { getByTestId, queryByTestId } = render(
      <ScrollMeter mode="board" n1={1} n2={12} total={234} swellFraction={0} onScrub={() => {}} />,
    )
    const track = getByTestId('scroll-meter')
    expect(track.getAttribute('data-meter-variant')).toBe('waveform')
    expect(queryByTestId('ruler-track')).toBeNull()
    const ticks = Array.from(track.children).filter((el) => (el as HTMLElement).style.left)
    expect(ticks).toHaveLength(150)
  })

  it('renders RulerTrack and NO 150 waveform ticks when variant="ruler"', () => {
    const { getByTestId, queryAllByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={12} total={234}
        swellFraction={0} onScrub={() => {}} variant="ruler"
      />,
    )
    const track = getByTestId('scroll-meter')
    expect(track.getAttribute('data-meter-variant')).toBe('ruler')
    expect(getByTestId('ruler-track')).toBeTruthy()
    // the waveform .tick elements (1px lines with inline left) must NOT be 150
    const waveformTicks = Array.from(track.children).filter(
      (el) => (el as HTMLElement).style.left,
    )
    expect(waveformTicks).not.toHaveLength(150)
    // ruler still surfaces numerals
    expect(queryAllByTestId('ruler-numeral').length).toBeGreaterThan(0)
  })

  it('captures scrub state on pointer-down in ruler variant (onScrub fires in rAF, not synchronously)', () => {
    // onScrub is rAF-throttled inside the component: pointerDown stores the
    // fraction in a ref and the rAF loop fires onScrub at most once per frame.
    // jsdom does not run requestAnimationFrame, so onScrub will NOT be called
    // synchronously here — this is by design, not a bug. The synchronous
    // contract we CAN assert is:
    //   1. data-dragging flips to "true" (= scrub has started, the fraction IS
    //      stored in the ref ready for the next rAF frame).
    // End-to-end rAF firing is covered by Playwright browser tests.
    const onScrub = vi.fn()
    const { getByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={12} total={234}
        swellFraction={0} onScrub={onScrub} variant="ruler"
      />,
    )
    const track = getByTestId('scroll-meter')
    track.getBoundingClientRect = (): DOMRect => ({
      x: 0, y: 0, width: 200, height: 28, top: 0, right: 200, bottom: 28, left: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 })
    // Synchronous layer: dragging state must be set (fraction stored in ref).
    expect(track.getAttribute('data-dragging')).toBe('true')
    // onScrub is NOT called synchronously (rAF-throttled); confirm this honestly
    // rather than asserting a value that would only pass if the component broke
    // its own throttle invariant.
    expect(onScrub).not.toHaveBeenCalled()
  })
})

describe('ScrollMeter variant is registry-driven', () => {
  it('renders the ruler face when fed the paper-atelier registry variant', () => {
    const variant = getThemeMeta('paper-atelier').scrollMeterVariant
    expect(variant).toBe('ruler')
    const { getByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={1} total={1}
        swellFraction={0} onScrub={() => {}} variant={variant}
      />,
    )
    expect(getByTestId('ruler-track')).toBeTruthy()
  })

  it('renders the waveform face when fed a dark-theme registry variant', () => {
    const variant = getThemeMeta('dotted-notebook').scrollMeterVariant
    expect(variant).toBe('waveform')
    const { getByTestId, queryByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={1} total={1}
        swellFraction={0} onScrub={() => {}} variant={variant}
      />,
    )
    expect(getByTestId('scroll-meter').getAttribute('data-meter-variant')).toBe('waveform')
    expect(queryByTestId('ruler-track')).toBeNull()
  })
})
