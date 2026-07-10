import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExtensionEntry } from './ExtensionEntry'

const noop = (): void => {}
const baseProps = {
  quickTagEnabled: false, onQuickTagToggle: noop,
  onOpenBookmarkletModal: noop,
  isOpen: true, onOpenChange: noop,
  themeId: 'grid-paper' as const, // ThemeId = 'dotted-notebook' | 'grid-paper' | 'paper-atelier'
  onOpenThemeModal: noop,
  customWidthCount: 0, onResetCardSizes: noop, onSortNewestFirst: noop,
}

describe('ExtensionEntry — MOTION row', () => {
  it('is absent when no motion prop is passed (desktop)', () => {
    render(<ExtensionEntry {...baseProps} />)
    expect(screen.queryByTestId('settings-motion-toggle')).toBeNull()
  })

  it('renders a MOTION toggle reflecting the current state when passed (mobile)', () => {
    render(<ExtensionEntry {...baseProps} motion={{ enabled: true, onToggle: noop }} />)
    const box = screen.getByTestId('settings-motion-toggle') as HTMLInputElement
    expect(box.checked).toBe(true)
  })

  it('fires onToggle when tapped', () => {
    const onToggle = vi.fn()
    render(<ExtensionEntry {...baseProps} motion={{ enabled: false, onToggle }} />)
    fireEvent.click(screen.getByTestId('settings-motion-toggle'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
