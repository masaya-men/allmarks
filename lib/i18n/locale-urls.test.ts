import { describe, it, expect } from 'vitest'
import { localePath, PREFIXED_LOCALES, hreflangAlternates } from './locale-urls'
import { SUPPORTED_LOCALES } from './config'

describe('locale-urls', () => {
  it('英語は / になる', () => {
    expect(localePath('en')).toBe('/')
  })
  it('日本語/中国語は接頭辞付き', () => {
    expect(localePath('ja')).toBe('/ja')
    expect(localePath('zh')).toBe('/zh')
  })
  it('PREFIXED_LOCALES は英語を含まず14言語', () => {
    expect(PREFIXED_LOCALES).not.toContain('en')
    expect(PREFIXED_LOCALES.length).toBe(SUPPORTED_LOCALES.length - 1)
  })
  it('hreflangAlternates は15言語 + x-default', () => {
    const map = hreflangAlternates()
    expect(map['x-default']).toBe('/')
    expect(map.en).toBe('/')
    expect(map.ja).toBe('/ja')
    expect(Object.keys(map).length).toBe(SUPPORTED_LOCALES.length + 1)
  })
})
