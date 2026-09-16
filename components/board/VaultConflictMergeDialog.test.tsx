import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VaultConflictMergeDialog } from './VaultConflictMergeDialog'

describe('VaultConflictMergeDialog', () => {
  it('NOT NOW fires onNotNow', () => {
    const onNotNow = vi.fn()
    render(<VaultConflictMergeDialog onNotNow={onNotNow} onConfirm={vi.fn().mockResolvedValue(true)} />)
    fireEvent.click(screen.getByTestId('vault-conflict-merge-not-now'))
    expect(onNotNow).toHaveBeenCalledTimes(1)
  })

  it('COMBINE calls onConfirm and disables the button while pending', async () => {
    let resolveConfirm: (v: boolean) => void = () => {}
    const onConfirm = vi.fn(() => new Promise<boolean>((r) => { resolveConfirm = r }))
    render(<VaultConflictMergeDialog onNotNow={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('vault-conflict-merge-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('vault-conflict-merge-confirm')).toBeDisabled()
    resolveConfirm(true)
    await waitFor(() => expect(screen.getByTestId('vault-conflict-merge-confirm')).not.toBeDisabled())
  })

  it('shows an error message when onConfirm resolves false', async () => {
    const onConfirm = vi.fn().mockResolvedValue(false)
    render(<VaultConflictMergeDialog onNotNow={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('vault-conflict-merge-confirm'))
    await waitFor(() => expect(screen.getByTestId('vault-conflict-merge-error')).toBeInTheDocument())
  })

  it('Escape key fires onNotNow', () => {
    const onNotNow = vi.fn()
    render(<VaultConflictMergeDialog onNotNow={onNotNow} onConfirm={vi.fn().mockResolvedValue(true)} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onNotNow).toHaveBeenCalledTimes(1)
  })
})
