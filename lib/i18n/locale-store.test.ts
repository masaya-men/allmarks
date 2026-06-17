import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readStoredLocale, persistLocale, resolveInitialLocale } from './locale-store'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('locale-store', () => {
  it('保存された有効な言語を読む', () => {
    window.localStorage.setItem('allmarks-locale', 'fr')
    expect(readStoredLocale()).toBe('fr')
  })
  it('未保存なら null', () => {
    expect(readStoredLocale()).toBeNull()
  })
  it('不正な値は無視して null', () => {
    window.localStorage.setItem('allmarks-locale', 'xx')
    expect(readStoredLocale()).toBeNull()
  })
  it('persistLocale で書き込める', () => {
    persistLocale('ko')
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ko')
  })
  it('resolveInitialLocale は保存値を最優先', () => {
    window.localStorage.setItem('allmarks-locale', 'de')
    expect(resolveInitialLocale()).toBe('de')
  })
  it('保存値なしならブラウザ言語(navigator)で判定', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-ES', 'es'])
    expect(resolveInitialLocale()).toBe('es')
  })
  it('対応外ブラウザ言語なら英語フォールバック', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['xx-YY'])
    expect(resolveInitialLocale()).toBe('en')
  })
})
