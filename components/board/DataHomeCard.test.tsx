import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataHomeCard } from './DataHomeCard'

describe('DataHomeCard', () => {
  it('renders the title + body and GOT IT dismisses', () => {
    const onDismiss = vi.fn()
    render(<DataHomeCard onDismiss={onDismiss} />)
    // English fallback text present:
    expect(screen.getByText(/this device only/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
  it('carries data-no-capture so it never bakes into the SHARE screenshot', () => {
    render(<DataHomeCard onDismiss={vi.fn()} />)
    expect(screen.getByRole('dialog').hasAttribute('data-no-capture')).toBe(true)
  })
})
