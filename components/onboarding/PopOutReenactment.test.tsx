import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PopOutReenactment } from './PopOutReenactment'

describe('PopOutReenactment', () => {
  it('renders the caption and fires onAdvance on the button', () => {
    const onAdvance = vi.fn()
    render(<PopOutReenactment caption="pop it out" buttonLabel="NEXT" onAdvance={onAdvance} />)
    expect(screen.getByText('pop it out')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' }))
    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('renders the popout demo stage with two demo cards', () => {
    const { container } = render(<PopOutReenactment caption="c" buttonLabel="NEXT" onAdvance={() => {}} />)
    expect(container.querySelector('[data-testid="stage-popout-demo"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-anim^="card"]').length).toBe(2)
  })
})
