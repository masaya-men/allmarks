import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SyncMassDeleteConfirmDialog } from './SyncMassDeleteConfirmDialog'

describe('SyncMassDeleteConfirmDialog', () => {
  it('shows the count in the body text', () => {
    render(<SyncMassDeleteConfirmDialog count={42} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog').textContent).toContain('42')
  })

  it('CONTINUE fires onConfirm', () => {
    const onConfirm = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByTestId('sync-mass-delete-continue'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('sync-mass-delete-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onCancel', () => {
    const onCancel = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onCancel', () => {
    const onCancel = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
