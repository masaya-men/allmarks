import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ShareToast } from './ShareToast'

const noop = (): void => {}
const baseProps = {
  count: 0,
  onReselect: noop,
  onDone: noop,
}

describe('ShareToast', () => {
  it('shows the SHARING counter', () => {
    render(<ShareToast {...baseProps} count={3} />)
    expect(screen.getByText('SHARING… 3')).toBeTruthy()
  })

  it('fires callbacks on RESELECT and DONE', () => {
    const onReselect = vi.fn()
    const onDone = vi.fn()
    render(<ShareToast {...baseProps} count={3} onReselect={onReselect} onDone={onDone} />)
    fireEvent.click(screen.getByTestId('share-toast-reselect'))
    fireEvent.click(screen.getByTestId('share-toast-done'))
    expect(onReselect).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
  })
})
