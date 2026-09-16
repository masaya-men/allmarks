import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrashConfirmDialog } from './TrashConfirmDialog'

describe('TrashConfirmDialog', () => {
  it('shows the sync caveat note', () => {
    render(<TrashConfirmDialog count={1} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('trash-confirm-sync-note')).toHaveTextContent(/sync|safety/i)
  })
})
