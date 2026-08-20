import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivateUnlockDialog } from './PrivateUnlockDialog'

describe('PrivateUnlockDialog', () => {
  it('carries data-no-capture', () => {
    render(<PrivateUnlockDialog onSubmit={vi.fn().mockResolvedValue(true)} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog').hasAttribute('data-no-capture')).toBe(true)
  })

  it('shows the hint text when provided', () => {
    render(<PrivateUnlockDialog hint="my hint" onSubmit={vi.fn().mockResolvedValue(true)} onCancel={vi.fn()} />)
    expect(screen.getByText('my hint')).toBeInTheDocument()
  })

  it('calls onSubmit with the entered password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<PrivateUnlockDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('hunter2'))
  })

  it('shows an error and stays open when onSubmit resolves false', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    render(<PrivateUnlockDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    await waitFor(() => expect(screen.getByText(/wrong/i)).toBeInTheDocument())
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateUnlockDialog onSubmit={vi.fn().mockResolvedValue(true)} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
