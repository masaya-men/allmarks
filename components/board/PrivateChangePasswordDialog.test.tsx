import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivateChangePasswordDialog } from './PrivateChangePasswordDialog'

describe('PrivateChangePasswordDialog', () => {
  it('shows an error and does not submit when the password is too short', async () => {
    const onSubmit = vi.fn()
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    const inputs = screen.getAllByDisplayValue('')
    fireEvent.change(inputs[0], { target: { value: 'abc' } })
    fireEvent.change(inputs[1], { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/at least 4 characters/i)).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows an error and does not submit when passwords do not match', async () => {
    const onSubmit = vi.fn()
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    const inputs = screen.getAllByDisplayValue('')
    fireEvent.change(inputs[0], { target: { value: 'password1' } })
    fireEvent.change(inputs[1], { target: { value: 'password2' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/do not match/i)).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the new password with the hint argument always undefined', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    const inputs = screen.getAllByDisplayValue('')
    fireEvent.change(inputs[0], { target: { value: 'password123' } })
    fireEvent.change(inputs[1], { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('password123', undefined))
  })

  it('shows an error when onSubmit resolves false', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    const inputs = screen.getAllByDisplayValue('')
    fireEvent.change(inputs[0], { target: { value: 'password123' } })
    fireEvent.change(inputs[1], { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/could not update/i)).toBeInTheDocument())
  })

  it('calls onCancel when CANCEL is clicked', () => {
    const onCancel = vi.fn()
    render(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows the vault-conflict-resolved heading/explanation when variant is set, and the ordinary ones by default', () => {
    const { rerender } = render(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('private-change-password-dialog').textContent).not.toMatch(/combined/i)

    rerender(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={vi.fn()} variant="vault-conflict-resolved" />)
    expect(screen.getByTestId('private-change-password-dialog').textContent).toMatch(/combined|new password/i)
  })

  it('shows the recovered heading/explanation when variant="recovered"', () => {
    render(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={vi.fn()} variant="recovered" />)
    expect(screen.getByTestId('private-change-password-dialog').textContent).toMatch(/unlocked with your recovery key/i)
  })
})
