import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExtensionEntry } from './ExtensionEntry'

beforeEach(() => {
  document.documentElement.dataset.booklageExtension = '1'
})

describe('ExtensionEntry settings drawer', () => {
  it('opens the drawer on hover and reflects the toggle state', () => {
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={() => {}} onOpenBookmarkletModal={() => {}} themeId="dotted-notebook" onOpenThemeModal={() => {}} customWidthCount={0} onResetCardSizes={() => {}} onSortNewestFirst={() => {}} />)
    // TUNE-style hover open: the drawer expands when the wrapper is entered.
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    const toggle = screen.getByTestId('quick-tag-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })

  it('calls onQuickTagToggle when toggled', () => {
    const onToggle = vi.fn()
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={onToggle} onOpenBookmarkletModal={() => {}} themeId="dotted-notebook" onOpenThemeModal={() => {}} customWidthCount={0} onResetCardSizes={() => {}} onSortNewestFirst={() => {}} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    fireEvent.click(screen.getByTestId('quick-tag-toggle'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('exposes SETTINGS + the quick-tag toggle even when the extension is absent', () => {
    // Bookmarklet-only users must still be able to turn quick-tag on/off,
    // because the /save window reads the same setting.
    delete document.documentElement.dataset.booklageExtension
    const onToggle = vi.fn()
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={onToggle} onOpenBookmarkletModal={() => {}} themeId="dotted-notebook" onOpenThemeModal={() => {}} customWidthCount={0} onResetCardSizes={() => {}} onSortNewestFirst={() => {}} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    expect(screen.getByTestId('extension-settings')).toBeTruthy()
    fireEvent.click(screen.getByTestId('quick-tag-toggle'))
    expect(onToggle).toHaveBeenCalledWith(false)
    // The drawer folds the GET EXTENSION promo in (no OPEN EXTENSION SETTINGS).
    expect(screen.getByTestId('get-extension-block')).toBeTruthy()
    expect(screen.queryByTestId('open-extension-settings')).toBeNull()
  })

  it('opens the bookmarklet install modal from SAVE WITHOUT EXTENSION', () => {
    const onOpen = vi.fn()
    render(
      <ExtensionEntry
        quickTagEnabled={true}
        onQuickTagToggle={() => {}}
        onOpenBookmarkletModal={onOpen}
        themeId="dotted-notebook"
        onOpenThemeModal={() => {}}
        customWidthCount={0}
        onResetCardSizes={() => {}}
        onSortNewestFirst={() => {}}
      />,
    )
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    fireEvent.click(screen.getByTestId('open-bookmarklet-install'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('REPLAY INTRO calls onReplayIntro', () => {
    const onReplay = vi.fn()
    render(
      <ExtensionEntry
        quickTagEnabled={true}
        onQuickTagToggle={() => {}}
        onOpenBookmarkletModal={() => {}}
        onReplayIntro={onReplay}
        themeId="dotted-notebook"
        onOpenThemeModal={() => {}}
        customWidthCount={0}
        onResetCardSizes={() => {}}
        onSortNewestFirst={() => {}}
      />,
    )
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    fireEvent.click(screen.getByTestId('replay-intro'))
    expect(onReplay).toHaveBeenCalledOnce()
  })
})

describe('LAYOUT group (N-19)', () => {
  const baseProps = {
    quickTagEnabled: true,
    onQuickTagToggle: () => {},
    onOpenBookmarkletModal: () => {},
    themeId: 'dotted-notebook' as const,
    onOpenThemeModal: () => {},
  }

  it('disables RESET CARD SIZES when no card is resized', () => {
    render(<ExtensionEntry {...baseProps} customWidthCount={0} onResetCardSizes={() => {}} onSortNewestFirst={() => {}} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    const btn = screen.getByTestId('layout-reset-sizes') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('shows the resized count and enables the button when > 0', () => {
    render(<ExtensionEntry {...baseProps} customWidthCount={3} onResetCardSizes={() => {}} onSortNewestFirst={() => {}} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    const btn = screen.getByTestId('layout-reset-sizes') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('3')
  })

  it('requires two taps to reset sizes (first tap shows confirm, second fires)', () => {
    const onReset = vi.fn()
    render(<ExtensionEntry {...baseProps} customWidthCount={3} onResetCardSizes={onReset} onSortNewestFirst={() => {}} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    const btn = screen.getByTestId('layout-reset-sizes')
    fireEvent.click(btn)
    expect(onReset).not.toHaveBeenCalled()
    expect(btn.getAttribute('data-confirming')).toBe('true')
    fireEvent.click(btn)
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(btn.getAttribute('data-confirming')).toBe('false')
  })

  it('requires two taps to sort newest first', () => {
    const onSort = vi.fn()
    render(<ExtensionEntry {...baseProps} customWidthCount={0} onResetCardSizes={() => {}} onSortNewestFirst={onSort} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    const btn = screen.getByTestId('layout-sort-newest')
    fireEvent.click(btn)
    expect(onSort).not.toHaveBeenCalled()
    fireEvent.click(btn)
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('confirming one button cancels the other', () => {
    const onReset = vi.fn()
    const onSort = vi.fn()
    render(<ExtensionEntry {...baseProps} customWidthCount={3} onResetCardSizes={onReset} onSortNewestFirst={onSort} />)
    fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
    fireEvent.click(screen.getByTestId('layout-reset-sizes')) // arm A
    fireEvent.click(screen.getByTestId('layout-sort-newest'))  // arms B, cancels A
    expect(screen.getByTestId('layout-reset-sizes').getAttribute('data-confirming')).toBe('false')
    expect(screen.getByTestId('layout-sort-newest').getAttribute('data-confirming')).toBe('true')
    expect(onReset).not.toHaveBeenCalled()
    expect(onSort).not.toHaveBeenCalled()
  })
})
