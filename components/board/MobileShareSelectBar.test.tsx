import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MobileShareSelectBar } from './MobileShareSelectBar'

const noop = (): void => {}
const baseProps = { count: 0, onSelectAll: noop, onCreate: noop, onCancel: noop }

describe('MobileShareSelectBar', () => {
  it('shows the counter against the shared 100-card cap', () => {
    render(<MobileShareSelectBar {...baseProps} count={7} />)
    expect(screen.getByTestId('mobile-select-counter').textContent).toBe('7 / 100 SELECTED')
  })

  it('disables CREATE at zero and labels it with the count', () => {
    const { rerender } = render(<MobileShareSelectBar {...baseProps} count={0} />)
    expect((screen.getByTestId('mobile-select-create') as HTMLButtonElement).disabled).toBe(true)
    rerender(<MobileShareSelectBar {...baseProps} count={3} />)
    const btn = screen.getByTestId('mobile-select-create') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toBe('ARRANGE (3)')
  })

  it('fires each callback', () => {
    const onSelectAll = vi.fn(); const onCreate = vi.fn(); const onCancel = vi.fn()
    render(<MobileShareSelectBar count={2} onSelectAll={onSelectAll} onCreate={onCreate} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('mobile-select-all'))
    fireEvent.click(screen.getByTestId('mobile-select-create'))
    fireEvent.click(screen.getByTestId('mobile-select-cancel'))
    expect(onSelectAll).toHaveBeenCalledOnce()
    expect(onCreate).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('keeps itself out of the share capture', () => {
    render(<MobileShareSelectBar {...baseProps} />)
    expect(screen.getByTestId('mobile-share-select-bar').hasAttribute('data-no-capture')).toBe(true)
  })
})
