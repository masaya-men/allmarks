import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BulkImportToast } from './BulkImportToast'

describe('BulkImportToast', () => {
  it('renders saved count', () => {
    render(<BulkImportToast saved={23} skipped={0} onDismiss={() => {}} />)
    expect(screen.getByText(/23 CARDS SAVED/i)).toBeInTheDocument()
  })

  it('shows skipped count when > 0', () => {
    render(<BulkImportToast saved={18} skipped={5} onDismiss={() => {}} />)
    expect(screen.getByText(/5 ALREADY SAVED/i)).toBeInTheDocument()
  })

  it('hides skipped row when zero', () => {
    render(<BulkImportToast saved={23} skipped={0} onDismiss={() => {}} />)
    expect(screen.queryByText(/ALREADY SAVED/i)).toBeNull()
  })
})
