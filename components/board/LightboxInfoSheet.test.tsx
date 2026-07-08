import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LightboxInfoSheet } from './LightboxInfoSheet'

describe('LightboxInfoSheet', () => {
  it('renders children and reflects open state', () => {
    render(
      <LightboxInfoSheet open onToggle={() => {}}>
        <p>caption</p>
      </LightboxInfoSheet>,
    )
    expect(screen.getByText('caption')).toBeInTheDocument()
    expect(screen.getByTestId('lightbox-info-sheet').getAttribute('data-open')).toBe('true')
  })

  it('reflects closed state', () => {
    render(
      <LightboxInfoSheet open={false} onToggle={() => {}}>
        <span>x</span>
      </LightboxInfoSheet>,
    )
    expect(screen.getByTestId('lightbox-info-sheet').getAttribute('data-open')).toBe('false')
  })

  it('fires onToggle when the grab handle is tapped', () => {
    const onToggle = vi.fn()
    render(
      <LightboxInfoSheet open={false} onToggle={onToggle}>
        <span>x</span>
      </LightboxInfoSheet>,
    )
    fireEvent.click(screen.getByLabelText('Details'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
