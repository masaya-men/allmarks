import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExtensionEntry } from './ExtensionEntry'

beforeEach(() => {
  document.documentElement.dataset.booklageExtension = '1'
})

describe('ExtensionEntry settings drawer', () => {
  it('opens the drawer on hover and reflects the toggle state', () => {
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={() => {}} />)
    // TUNE-style hover open: the drawer expands when the wrapper is entered.
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    const toggle = screen.getByTestId('quick-tag-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })

  it('calls onQuickTagToggle when toggled', () => {
    const onToggle = vi.fn()
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={onToggle} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    fireEvent.click(screen.getByTestId('quick-tag-toggle'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('exposes SETTINGS + the quick-tag toggle even when the extension is absent', () => {
    // Bookmarklet-only users must still be able to turn quick-tag on/off,
    // because the /save window reads the same setting.
    delete document.documentElement.dataset.booklageExtension
    const onToggle = vi.fn()
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={onToggle} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    expect(screen.getByTestId('extension-settings')).toBeTruthy()
    fireEvent.click(screen.getByTestId('quick-tag-toggle'))
    expect(onToggle).toHaveBeenCalledWith(false)
    // The drawer folds the GET EXTENSION promo in (no OPEN EXTENSION SETTINGS).
    expect(screen.getByTestId('get-extension-block')).toBeTruthy()
    expect(screen.queryByTestId('open-extension-settings')).toBeNull()
  })
})
