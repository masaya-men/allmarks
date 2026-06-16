import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExtensionEntry } from './ExtensionEntry'

beforeEach(() => {
  document.documentElement.dataset.booklageExtension = '1'
})

describe('ExtensionEntry settings panel', () => {
  it('opens the panel and reflects the toggle state', () => {
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={() => {}} />)
    fireEvent.click(screen.getByTestId('extension-settings'))
    const toggle = screen.getByTestId('quick-tag-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })

  it('calls onQuickTagToggle when toggled', () => {
    const onToggle = vi.fn()
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={onToggle} />)
    fireEvent.click(screen.getByTestId('extension-settings'))
    fireEvent.click(screen.getByTestId('quick-tag-toggle'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})
