import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VaultConflictNoticeDialog } from './VaultConflictNoticeDialog'

describe('VaultConflictNoticeDialog', () => {
  it('renders the heading and body', () => {
    render(<VaultConflictNoticeDialog onDismiss={vi.fn()} />)
    expect(screen.getByRole('dialog').textContent).toMatch(/private/i)
  })

  it('GOT IT fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<VaultConflictNoticeDialog onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('vault-conflict-notice-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<VaultConflictNoticeDialog onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<VaultConflictNoticeDialog onDismiss={onDismiss} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
