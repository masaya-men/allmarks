import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ShareSelectBar } from './ShareSelectBar'

const noop = (): void => {}
const baseProps = {
  count: 0,
  onSelectAll: noop,
  onShare: noop,
  onCancel: noop,
}

describe('ShareSelectBar', () => {
  it('shows the counter with the shared cap', () => {
    render(<ShareSelectBar {...baseProps} count={7} />)
    expect(screen.getByText('7 / 100 SELECTED')).toBeTruthy()
  })

  it('disables ARRANGE at 0 and enables it with a count', () => {
    const { rerender } = render(<ShareSelectBar {...baseProps} count={0} />)
    expect((screen.getByTestId('select-share-button') as HTMLButtonElement).disabled).toBe(true)
    rerender(<ShareSelectBar {...baseProps} count={3} />)
    const btn = screen.getByTestId('select-share-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('ARRANGE (3)')
  })

  it('fires callbacks', () => {
    const onSelectAll = vi.fn()
    const onShare = vi.fn()
    const onCancel = vi.fn()
    render(<ShareSelectBar {...baseProps} count={1} onSelectAll={onSelectAll} onShare={onShare} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('select-all-button'))
    fireEvent.click(screen.getByTestId('select-share-button'))
    fireEvent.click(screen.getByTestId('select-cancel-button'))
    expect(onSelectAll).toHaveBeenCalledOnce()
    expect(onShare).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
