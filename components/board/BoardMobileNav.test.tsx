import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BoardMobileNav } from './BoardMobileNav'

const noop = (): void => {}
const baseProps = {
  onTag: noop, tagActive: false,
  onThemes: noop, themesActive: false,
  onShare: noop,
  cornersRounded: true, onToggleCorners: noop,
  onSettings: noop, settingsActive: false,
}

describe('BoardMobileNav', () => {
  it('shows five tabs in the order TAG / THEME / SHARE / CORNERS / MORE', () => {
    render(<BoardMobileNav {...baseProps} />)
    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual(['TAG', 'THEME', 'SHARE', 'CORNERS', 'MORE'])
  })

  it('no longer hosts MOTION (it moved into the MORE panel)', () => {
    render(<BoardMobileNav {...baseProps} />)
    expect(screen.queryByTestId('mobile-nav-motion')).toBeNull()
  })

  it('fires onShare when SHARE is tapped', () => {
    const onShare = vi.fn()
    render(<BoardMobileNav {...baseProps} onShare={onShare} />)
    fireEvent.click(screen.getByTestId('mobile-nav-share'))
    expect(onShare).toHaveBeenCalledOnce()
  })

  it('does not mark SHARE active (the nav hides during share mode)', () => {
    render(<BoardMobileNav {...baseProps} />)
    expect(screen.getByTestId('mobile-nav-share').getAttribute('data-active')).toBeNull()
  })
})
