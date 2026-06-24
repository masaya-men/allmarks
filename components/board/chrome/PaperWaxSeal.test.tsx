import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaperWaxSeal } from './PaperWaxSeal'

describe('PaperWaxSeal', () => {
  it('renders with the disambiguated data-testid', () => {
    render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-seal')).toBeTruthy()
  })

  it('presses an "A" letter into the wax (the AllMarks monogram)', () => {
    render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-seal').textContent).toContain('A')
  })

  it('renders the decorative "+" stamp', () => {
    render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-stamp')).toBeTruthy()
  })

  it('the "+" stamp is DECORATIVE — not a button, no role, no onClick handler', () => {
    render(<PaperWaxSeal hidden={false} />)
    const stamp = screen.getByTestId('paper-wax-stamp')
    expect(stamp.tagName.toLowerCase()).not.toBe('button')
    expect(stamp.getAttribute('role')).toBeNull()
    expect(stamp.closest('button')).toBeNull()
    expect(stamp.closest('a')).toBeNull()
  })

  it('is aria-hidden and fully non-interactive (no buttons/links anywhere)', () => {
    render(<PaperWaxSeal hidden={false} />)
    const seal = screen.getByTestId('paper-wax-seal')
    expect(seal.getAttribute('aria-hidden')).toBe('true')
    expect(seal.querySelector('button')).toBeNull()
    expect(seal.querySelector('a')).toBeNull()
    expect(seal.querySelector('[role="button"]')).toBeNull()
  })

  it('reflects the hidden flag via a data attribute (chrome fade mirror)', () => {
    const { rerender } = render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-seal').getAttribute('data-hidden')).toBe('false')
    rerender(<PaperWaxSeal hidden />)
    expect(screen.getByTestId('paper-wax-seal').getAttribute('data-hidden')).toBe('true')
  })
})
