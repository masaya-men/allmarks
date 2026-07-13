import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileArrangeDock } from './MobileArrangeDock'

const base = {
  canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn(),
  onZoomOut: vi.fn(), onZoomIn: vi.fn(), onZoomFit: vi.fn(),
  hasSelection: false, onBringToFront: vi.fn(), onSendToBack: vi.fn(), onRemove: vi.fn(),
  onBack: vi.fn(), onCreate: vi.fn(), creating: false,
}

describe('MobileArrangeDock', () => {
  it('always shows undo/redo, zoom buttons, BACK and CREATE; hides selection tools with no selection', () => {
    render(<MobileArrangeDock {...base} />)
    for (const id of ['mobile-arrange-undo','mobile-arrange-redo','mobile-arrange-zoom-out','mobile-arrange-zoom-in','mobile-arrange-zoom-fit','mobile-arrange-back','mobile-arrange-create']) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('mobile-arrange-remove')).not.toBeInTheDocument()
  })
  it('shows TO FRONT / TO BACK / REMOVE when a card is selected and fires REMOVE', () => {
    const onRemove = vi.fn()
    render(<MobileArrangeDock {...base} hasSelection onRemove={onRemove} />)
    expect(screen.getByTestId('mobile-arrange-to-front')).toBeInTheDocument()
    screen.getByTestId('mobile-arrange-remove').click()
    expect(onRemove).toHaveBeenCalledOnce()
  })
  it('disables undo/redo per canUndo/canRedo and CREATE while creating', () => {
    render(<MobileArrangeDock {...base} canUndo creating />)
    expect(screen.getByTestId('mobile-arrange-undo')).toBeEnabled()
    expect(screen.getByTestId('mobile-arrange-redo')).toBeDisabled()
    expect(screen.getByTestId('mobile-arrange-create')).toBeDisabled()
  })
})
