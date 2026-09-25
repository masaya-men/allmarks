import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MobileTrashSelectBar } from './MobileTrashSelectBar'

const noop = (): void => {}
const baseProps = { count: 0, inTrash: false, onPrimary: noop, onCancel: noop }

describe('MobileTrashSelectBar', () => {
  it('shows the selected count', () => {
    render(<MobileTrashSelectBar {...baseProps} count={3} />)
    expect(screen.getByTestId('mobile-trash-select-counter').textContent).toBe('3 SELECTED')
  })

  it('labels the primary action MOVE TO TRASH outside the trash view', () => {
    render(<MobileTrashSelectBar {...baseProps} count={2} inTrash={false} />)
    expect(screen.getByTestId('mobile-trash-select-primary').textContent).toBe('MOVE TO TRASH')
  })

  it('labels the primary action RESTORE inside the trash view', () => {
    render(<MobileTrashSelectBar {...baseProps} count={2} inTrash />)
    expect(screen.getByTestId('mobile-trash-select-primary').textContent).toBe('RESTORE')
  })

  it('disables the primary action at zero selected', () => {
    const { rerender } = render(<MobileTrashSelectBar {...baseProps} count={0} />)
    expect((screen.getByTestId('mobile-trash-select-primary') as HTMLButtonElement).disabled).toBe(true)
    rerender(<MobileTrashSelectBar {...baseProps} count={1} />)
    expect((screen.getByTestId('mobile-trash-select-primary') as HTMLButtonElement).disabled).toBe(false)
  })

  it('fires each callback', () => {
    const onPrimary = vi.fn()
    const onCancel = vi.fn()
    render(<MobileTrashSelectBar count={2} inTrash={false} onPrimary={onPrimary} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('mobile-trash-select-primary'))
    fireEvent.click(screen.getByTestId('mobile-trash-select-cancel'))
    expect(onPrimary).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('keeps itself out of the share capture', () => {
    render(<MobileTrashSelectBar {...baseProps} />)
    expect(screen.getByTestId('mobile-trash-select-bar').hasAttribute('data-no-capture')).toBe(true)
  })
})
