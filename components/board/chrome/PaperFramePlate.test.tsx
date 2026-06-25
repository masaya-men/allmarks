import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaperFramePlate } from './PaperFramePlate'

describe('PaperFramePlate', () => {
  it('renders with the disambiguated data-testid (not collidable with TUNE MK-1 label)', () => {
    render(<PaperFramePlate hidden={false} />)
    expect(screen.getByTestId('paper-frame-plate')).toBeTruthy()
  })

  it('applies the mk1-plate PNG as background when placed and keeps the text', () => {
    const { container, getByText } = render(<PaperFramePlate hidden={false} />)
    const plate = container.querySelector('[data-paper-plate]') as HTMLElement
    expect(plate.style.backgroundImage).toContain('/themes/paper-atelier/mk1-plate')
    expect(getByText('ALLMARKS MK-1')).toBeTruthy()  // text still typeset on top
  })

  it('shows the engraved MK-1 / ARCHIVE technical labels', () => {
    render(<PaperFramePlate hidden={false} />)
    const plate = screen.getByTestId('paper-frame-plate')
    expect(plate.textContent).toContain('ALLMARKS MK-1')
    expect(plate.textContent).toContain('ARCHIVE')
  })

  it('is aria-hidden and not interactive (no button/link role)', () => {
    render(<PaperFramePlate hidden={false} />)
    const plate = screen.getByTestId('paper-frame-plate')
    expect(plate.getAttribute('aria-hidden')).toBe('true')
    expect(plate.querySelector('button')).toBeNull()
    expect(plate.querySelector('a')).toBeNull()
    expect(plate.querySelector('[role="button"]')).toBeNull()
  })

  it('reflects the hidden flag via a data attribute (chrome fade mirror)', () => {
    const { rerender } = render(<PaperFramePlate hidden={false} />)
    expect(screen.getByTestId('paper-frame-plate').getAttribute('data-hidden')).toBe('false')
    rerender(<PaperFramePlate hidden />)
    expect(screen.getByTestId('paper-frame-plate').getAttribute('data-hidden')).toBe('true')
  })
})
