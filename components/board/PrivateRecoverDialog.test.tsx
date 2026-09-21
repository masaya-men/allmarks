import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateRecoverDialog } from './PrivateRecoverDialog'

describe('PrivateRecoverDialog', () => {
  it('submits the entered recovery key', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<PrivateRecoverDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^recovery key$/i), { target: { value: 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK' } })
    fireEvent.click(screen.getByTestId('private-recover-submit'))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK'))
  })

  it('shows an error when onSubmit resolves false', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    render(<PrivateRecoverDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByTestId('private-recover-submit'))
    await vi.waitFor(() => expect(screen.getByTestId('private-recover-error')).toBeInTheDocument())
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateRecoverDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('private-recover-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateRecoverDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
