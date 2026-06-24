import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'
import type { ThemeId } from '@/lib/board/types'

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

// Mock the registry with two free themes + one paid theme so BOTH the unlocked
// and the locked rendering paths are exercised. The real registry currently has
// only free themes (its contents are covered by theme-registry.test.ts); here we
// test the component's logic in isolation against controlled data.
vi.mock('@/lib/board/theme-registry', () => {
  const REG = {
    'free-a': { id: 'free-a', direction: 'vertical', backgroundClassName: 'a', labelKey: 'board.theme.freeA', colorScheme: 'dark', tier: 'free', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
    'free-b': { id: 'free-b', direction: 'vertical', backgroundClassName: 'b', labelKey: 'board.theme.freeB', colorScheme: 'dark', tier: 'free', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
    'paid-x': { id: 'paid-x', direction: 'vertical', backgroundClassName: 'x', labelKey: 'board.theme.paidX', colorScheme: 'light', tier: 'paid', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
  }
  return {
    THEME_REGISTRY: REG,
    DEFAULT_THEME_ID: 'free-a',
    getThemeMeta: (id: string) => REG[id as keyof typeof REG],
    listThemeIds: () => Object.keys(REG),
  }
})

describe('ThemePicker', () => {
  it('renders a button per theme and marks the active one', () => {
    render(<ThemePicker themeId={'free-a' as ThemeId} onThemeChange={() => {}} />)
    expect(screen.getByTestId('theme-button-free-a')).toBeTruthy()
    expect(screen.getByTestId('theme-button-free-b')).toBeTruthy()
    expect(screen.getByTestId('theme-button-paid-x')).toBeTruthy()
    expect(screen.getByTestId('theme-button-free-a').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('theme-button-free-b').getAttribute('aria-pressed')).toBe('false')
  })

  it('applies a free theme on click', () => {
    const onChange = vi.fn()
    render(<ThemePicker themeId={'free-a' as ThemeId} onThemeChange={onChange} />)
    fireEvent.click(screen.getByTestId('theme-button-free-b'))
    expect(onChange).toHaveBeenCalledWith('free-b')
  })

  it('locks a paid theme without a license: disabled, LOCKED badge, no callback', () => {
    const onChange = vi.fn()
    render(<ThemePicker themeId={'free-a' as ThemeId} onThemeChange={onChange} licenses={new Set()} />)
    const paid = screen.getByTestId('theme-button-paid-x')
    expect(paid.hasAttribute('disabled')).toBe(true)
    expect(paid.textContent).toContain('LOCKED')
    fireEvent.click(paid)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('unlocks a paid theme when licensed: enabled and selectable', () => {
    const onChange = vi.fn()
    render(
      <ThemePicker
        themeId={'free-a' as ThemeId}
        onThemeChange={onChange}
        licenses={new Set(['paid-x'] as unknown as ThemeId[])}
      />,
    )
    const paid = screen.getByTestId('theme-button-paid-x')
    expect(paid.hasAttribute('disabled')).toBe(false)
    expect(paid.textContent).toContain('FREE')
    fireEvent.click(paid)
    expect(onChange).toHaveBeenCalledWith('paid-x')
  })
})
