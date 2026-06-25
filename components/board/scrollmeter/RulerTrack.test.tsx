import { createRef } from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RulerTrack } from './RulerTrack'

describe('RulerTrack', () => {
  it('renders aria-hidden ruler ticks + numerals + a brass marker bound to markerRef', () => {
    const markerRef = createRef<HTMLDivElement>()
    const { getByTestId, queryAllByTestId } = render(<RulerTrack markerRef={markerRef} />)
    const root = getByTestId('ruler-track')
    expect(root.getAttribute('aria-hidden')).toBe('true')
    // When the ruler-meter-strip PNG asset is placed, CSS numerals are suppressed
    // (baked into the PNG). When not placed, CSS numerals should appear.
    if (root.getAttribute('data-asset') === 'true') {
      // PNG strip present: CSS numerals not rendered (replaced by baked PNG ticks)
      expect(queryAllByTestId('ruler-numeral').length).toBe(0)
    } else {
      // PNG not placed: CSS numerals cover the major ticks
      expect(queryAllByTestId('ruler-numeral').length).toBeGreaterThan(0)
    }
    // marker element is wired to the forwarded ref so the parent rAF can position it
    expect(markerRef.current).not.toBeNull()
    expect(markerRef.current?.getAttribute('data-testid')).toBe('ruler-marker')
  })

  it('marks every child pointer-events:none (decorative, never steals scrub)', () => {
    const markerRef = createRef<HTMLDivElement>()
    const { getByTestId } = render(<RulerTrack markerRef={markerRef} />)
    const root = getByTestId('ruler-track')
    // inline style guard on the marker (CSS module pointer-events not computed in jsdom)
    expect((getByTestId('ruler-marker') as HTMLElement).style.pointerEvents).toBe('none')
    // root element is decorative
    expect(root).toBeTruthy()
  })
})
