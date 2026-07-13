import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileArrangeTopBar } from './MobileArrangeTopBar'

const baseProps = {
  canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn(),
  hasSelection: false, onBringToFront: vi.fn(), onSendToBack: vi.fn(), onDelete: vi.fn(),
}

describe('MobileArrangeTopBar', () => {
  it('shows UNDO/REDO always and hides selection tools with no selection', () => {
    render(<MobileArrangeTopBar {...baseProps} />)
    expect(screen.getByTestId('mobile-arrange-undo')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-arrange-redo')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-arrange-selection-tools')).not.toBeInTheDocument()
  })
  it('disables UNDO/REDO per canUndo/canRedo', () => {
    render(<MobileArrangeTopBar {...baseProps} canUndo canRedo={false} />)
    expect(screen.getByTestId('mobile-arrange-undo')).toBeEnabled()
    expect(screen.getByTestId('mobile-arrange-redo')).toBeDisabled()
  })
  it('shows TO FRONT / TO BACK / DELETE when a card is selected and fires DELETE', () => {
    const onDelete = vi.fn()
    render(<MobileArrangeTopBar {...baseProps} hasSelection onDelete={onDelete} />)
    expect(screen.getByTestId('mobile-arrange-to-front')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-arrange-to-back')).toBeInTheDocument()
    screen.getByTestId('mobile-arrange-delete').click()
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
