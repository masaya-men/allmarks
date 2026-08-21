import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateShareConfirmDialog } from './PrivateShareConfirmDialog'

describe('PrivateShareConfirmDialog', () => {
  it('carries data-no-capture and shows the count', () => {
    render(<PrivateShareConfirmDialog count={2} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.hasAttribute('data-no-capture')).toBe(true)
    expect(dialog.textContent).toContain('2')
  })

  it('SHARE fires onConfirm', () => {
    const onConfirm = vi.fn()
    render(<PrivateShareConfirmDialog count={1} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateShareConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateShareConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateShareConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
