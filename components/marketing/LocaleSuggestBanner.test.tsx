import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocaleSuggestBanner } from './LocaleSuggestBanner'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('LocaleSuggestBanner', () => {
  it('日本語ブラウザ × 英語ページ × 未選択 → バー表示(日本語で見る)', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP', 'ja'])
    render(<LocaleSuggestBanner current="en" />)
    expect(screen.getByTestId('locale-suggest').textContent).toContain('日本語')
    expect(screen.getByRole('link')).toHaveProperty('href', expect.stringContaining('/ja'))
  })
  it('既に言語選択済み(localStorage)なら出さない', () => {
    window.localStorage.setItem('allmarks-locale', 'ja')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP'])
    render(<LocaleSuggestBanner current="en" />)
    expect(screen.queryByTestId('locale-suggest')).toBeNull()
  })
  it('ブラウザ言語=ページ言語なら出さない', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    render(<LocaleSuggestBanner current="en" />)
    expect(screen.queryByTestId('locale-suggest')).toBeNull()
  })
  it('× で消えて localStorage に記録', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP'])
    render(<LocaleSuggestBanner current="en" />)
    fireEvent.click(screen.getByTestId('locale-suggest-dismiss'))
    expect(screen.queryByTestId('locale-suggest')).toBeNull()
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ja')
  })
})
