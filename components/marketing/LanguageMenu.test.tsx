import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LanguageMenu } from './LanguageMenu'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => {
  push.mockClear()
  window.localStorage.clear()
})

describe('LanguageMenu', () => {
  it('畳んだ状態で現在言語コードを大文字で出す', () => {
    render(<LanguageMenu current="en" />)
    expect(screen.getByTestId('lang-menu-toggle').textContent).toContain('EN')
  })
  it('開くと endonym で並ぶ', () => {
    render(<LanguageMenu current="en" />)
    fireEvent.click(screen.getByTestId('lang-menu-toggle'))
    expect(screen.getByText('日本語')).not.toBeNull()
    expect(screen.getByText('中文')).not.toBeNull()
  })
  it('言語を選ぶとその URL へ push + localStorage 保存', () => {
    render(<LanguageMenu current="en" />)
    fireEvent.click(screen.getByTestId('lang-menu-toggle'))
    fireEvent.click(screen.getByText('日本語'))
    expect(push).toHaveBeenCalledWith('/ja')
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ja')
  })
  it('外側 pointerdown(capture)で閉じる', () => {
    render(<LanguageMenu current="en" />)
    fireEvent.click(screen.getByTestId('lang-menu-toggle'))
    expect(screen.queryByText('日本語')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('日本語')).toBeNull()
  })
})
