import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TuneTrigger } from './TuneTrigger'

describe('TuneTrigger — skeleton', () => {
  it('renders TUNE as a button with proper data-testid in idle state', () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.textContent).toBe('TUNE')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})
