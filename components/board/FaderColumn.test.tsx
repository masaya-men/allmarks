import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { FaderColumn } from './FaderColumn'

describe('FaderColumn — render', () => {
  it('renders track, handle, default mark, ruler, and label', () => {
    const { container, getByText } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    expect(container.querySelector('[data-testid="fader-track"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="fader-handle"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="fader-default-mark"]')).not.toBeNull()
    const ruler = container.querySelector('[data-testid="radio-ruler"]')
    expect(ruler).not.toBeNull()
    expect(ruler!.querySelectorAll('[data-tick]').length).toBe(22)
    expect(getByText('W')).toBeTruthy()
  })

  it('handle is at top 50% when value equals default', () => {
    const { container } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    expect(handle.style.top).toBe('50%')
  })

  it('handle is at top 25% when value is halfway above default', () => {
    const { container } = render(
      <FaderColumn
        scope="w"
        value={383.92}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    expect(handle.style.top).toBe('25%')
  })
})
