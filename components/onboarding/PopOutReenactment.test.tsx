import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PopOutReenactment } from './PopOutReenactment'

describe('PopOutReenactment', () => {
  it('renders the caption and fires onAdvance on the NEXT button', () => {
    const onAdvance = vi.fn()
    render(<PopOutReenactment caption="pop it out" buttonLabel="NEXT" onAdvance={onAdvance} />)
    expect(screen.getByText('pop it out')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' }))
    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('renders the fake browser miniature: POP OUT control, companion window, two cards, tag affordance + chip, the paste-a-link beat, and the cursor', () => {
    const { container } = render(<PopOutReenactment caption="c" buttonLabel="NEXT" onAdvance={() => {}} />)
    expect(container.querySelector('[data-testid="stage-popout-demo"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="popoutBtn"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="pip"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-anim^="card"]').length).toBe(2)
    expect(container.querySelector('[data-anim="tagBtn"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="chip"]')).toBeTruthy()
    // the "+ add tag by paste" beat: a link chip that lands in the companion window
    expect(container.querySelector('[data-anim="pasteUrl"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="pasteFlash"]')).toBeTruthy()
    expect(container.querySelector('[data-anim="cursor"]')).toBeTruthy()
  })
})
