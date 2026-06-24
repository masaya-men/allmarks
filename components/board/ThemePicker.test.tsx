import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

describe('ThemePicker', () => {
  it('renders a button per theme and marks the active one', () => {
    render(<ThemePicker themeId="dotted-notebook" onThemeChange={() => {}} />)
    expect(screen.getByTestId('theme-button-paper-atelier')).toBeTruthy()
    expect(screen.getByTestId('theme-button-dotted-notebook').getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onThemeChange when a theme is clicked', () => {
    const onChange = vi.fn()
    render(<ThemePicker themeId="dotted-notebook" onThemeChange={onChange} />)
    fireEvent.click(screen.getByTestId('theme-button-paper-atelier'))
    expect(onChange).toHaveBeenCalledWith('paper-atelier')
  })
})
