import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateSetupDialog } from './PrivateSetupDialog'

describe('PrivateSetupDialog', () => {
  it('carries data-no-capture', () => {
    render(<PrivateSetupDialog onCreate={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog').hasAttribute('data-no-capture')).toBe(true)
  })

  it('does not call onCreate until password and confirm match and are non-empty', () => {
    const onCreate = vi.fn()
    render(<PrivateSetupDialog onCreate={onCreate} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('calls onCreate with the password and optional hint once confirmed', () => {
    const onCreate = vi.fn()
    render(<PrivateSetupDialog onCreate={onCreate} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2' } })
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: 'hunter2' } })
    fireEvent.change(screen.getByLabelText(/hint/i), { target: { value: 'my hint' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    expect(onCreate).toHaveBeenCalledWith('hunter2', 'my hint')
  })

  it('shows a mismatch error and does not call onCreate when passwords differ', () => {
    const onCreate = vi.fn()
    render(<PrivateSetupDialog onCreate={onCreate} onCancel={vi.fn()} />)
    // Both ≥4 chars so the length check passes and the mismatch branch is
    // the one that actually fires.
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'aaaa' } })
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: 'bbbb' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByText(/match/i)).toBeInTheDocument()
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateSetupDialog onCreate={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateSetupDialog onCreate={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('explains what setting up Private does, before any input', () => {
    render(<PrivateSetupDialog onCreate={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('private-setup-explanation')).toBeInTheDocument()
  })
})
