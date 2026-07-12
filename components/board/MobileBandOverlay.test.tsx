import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MobileBandOverlay } from './MobileBandOverlay'

describe('MobileBandOverlay', () => {
  it('positions itself exactly on the band rect and stays out of the capture', () => {
    render(<MobileBandOverlay band={{ x: 0, y: 319.625, width: 390, height: 204.75 }} />)
    const el = screen.getByTestId('mobile-band-overlay')
    expect(el.style.left).toBe('0px')
    expect(el.style.top).toBe('319.625px')
    expect(el.style.width).toBe('390px')
    expect(el.style.height).toBe('204.75px')
    expect(el.getAttribute('data-no-capture')).not.toBeNull()
  })

  it('renders nothing for a degenerate band', () => {
    const { container } = render(<MobileBandOverlay band={{ x: 0, y: 0, width: 0, height: 0 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a NaN band (e.g. a divide-by-zero upstream)', () => {
    const { container } = render(<MobileBandOverlay band={{ x: 0, y: 0, width: NaN, height: 204.75 }} />)
    expect(container.firstChild).toBeNull()
  })
})
