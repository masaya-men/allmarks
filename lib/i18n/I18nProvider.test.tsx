import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// loadMessages を決定的にモック（動的 import を避ける）
vi.mock('./config', async (orig) => {
  const actual = await orig<typeof import('./config')>()
  return {
    ...actual,
    loadMessages: vi.fn(async (locale: string) =>
      locale === 'ja' ? { sample: { hi: 'こんにちは' } } : { sample: { hi: 'hello' } },
    ),
  }
})

import { I18nProvider, useI18n } from './I18nProvider'

function Probe(): React.ReactElement {
  const { locale, t, setLocale } = useI18n()
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="text">{t('sample.hi')}</span>
      <button onClick={() => setLocale('ja')}>switch-ja</button>
    </div>
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('I18nProvider / useI18n', () => {
  it('プロバイダ外でも throw せず英語フォールバックで t() が動く', () => {
    render(<Probe />)
    // en.json の実値（固定英語語彙）。'board.chrome.tune' は 'TUNE'。
    function EnProbe(): React.ReactElement {
      const { t } = useI18n()
      return <span data-testid="en">{t('board.chrome.tune')}</span>
    }
    render(<EnProbe />)
    expect(screen.getByTestId('en').textContent).toBe('TUNE')
  })

  it('initialLocale/initialMessages 指定で同期描画(テスト用)', () => {
    render(
      <I18nProvider initialLocale="ja" initialMessages={{ sample: { hi: 'やあ' } }}>
        <Probe />
      </I18nProvider>,
    )
    expect(screen.getByTestId('locale').textContent).toBe('ja')
    expect(screen.getByTestId('text').textContent).toBe('やあ')
  })

  it('setLocale で言語が切り替わり localStorage に保存される', async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )
    fireEvent.click(screen.getByText('switch-ja'))
    await waitFor(() => expect(screen.getByTestId('text').textContent).toBe('こんにちは'))
    expect(screen.getByTestId('locale').textContent).toBe('ja')
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ja')
  })
})
