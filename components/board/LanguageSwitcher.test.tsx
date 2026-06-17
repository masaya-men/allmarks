import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LanguageSwitcher } from './LanguageSwitcher'

function setup(): void {
  render(
    <I18nProvider>
      <LanguageSwitcher />
    </I18nProvider>,
  )
}

describe('LanguageSwitcher', () => {
  it('畳んだ状態で現在の言語コードを大文字で出す(既定 EN)', () => {
    setup()
    const toggle = screen.getByTestId('language-switcher-toggle')
    expect(toggle.textContent).toContain('EN')
  })
  it('開くと各言語が endonym で並ぶ', () => {
    setup()
    fireEvent.click(screen.getByTestId('language-switcher-toggle'))
    expect(screen.getByText('日本語')).not.toBeNull()
    expect(screen.getByText('English')).not.toBeNull()
    expect(screen.getByText('中文')).not.toBeNull()
    expect(screen.getByText('한국어')).not.toBeNull()
  })
  it('外側 pointerdown(capture)で閉じる', () => {
    setup()
    fireEvent.click(screen.getByTestId('language-switcher-toggle'))
    expect(screen.queryByText('日本語')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('日本語')).toBeNull()
  })
})
