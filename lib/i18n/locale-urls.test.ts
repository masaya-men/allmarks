import { describe, it, expect } from 'vitest'
import { localePath, hreflangAlternates, PREFIXED_LOCALES, navHref } from './locale-urls'

describe('localePath', () => {
  it('英語は subpath 無しで /', () => {
    expect(localePath('en')).toBe('/')
  })
  it('日本語は subpath 無しで /ja', () => {
    expect(localePath('ja')).toBe('/ja')
  })
  it('英語 + subpath はフラット /features', () => {
    expect(localePath('en', 'features')).toBe('/features')
  })
  it('日本語 + subpath は /ja/features', () => {
    expect(localePath('ja', 'features')).toBe('/ja/features')
  })
  it('2階層 subpath を保つ(en)', () => {
    expect(localePath('en', 'extension/privacy')).toBe('/extension/privacy')
  })
  it('2階層 subpath を保つ(zh)', () => {
    expect(localePath('zh', 'extension/privacy')).toBe('/zh/extension/privacy')
  })
})

describe('hreflangAlternates', () => {
  it('subpath 無しは LP マップ(x-default=/)', () => {
    const m = hreflangAlternates()
    expect(m['x-default']).toBe('/')
    expect(m.ja).toBe('/ja')
    expect(m.en).toBe('/')
  })
  it('subpath 有りは各ページのマップ(x-default=/about)', () => {
    const m = hreflangAlternates('about')
    expect(m['x-default']).toBe('/about')
    expect(m.en).toBe('/about')
    expect(m.ja).toBe('/ja/about')
  })
  it('15言語 + x-default の16エントリ', () => {
    expect(Object.keys(hreflangAlternates('about'))).toHaveLength(16)
  })
})

describe('PREFIXED_LOCALES', () => {
  it('en を含まない14言語', () => {
    expect(PREFIXED_LOCALES).toHaveLength(14)
    expect(PREFIXED_LOCALES).not.toContain('en')
  })
})

describe('navHref', () => {
  it('ja + about → /ja/about', () => {
    expect(navHref('ja', 'about')).toBe('/ja/about')
  })
  it('ja + features → /features (flat, not localized yet)', () => {
    expect(navHref('ja', 'features')).toBe('/features')
  })
  it('en + about → /about (flat for en)', () => {
    expect(navHref('en', 'about')).toBe('/about')
  })
  it('en + features → /features', () => {
    expect(navHref('en', 'features')).toBe('/features')
  })
  it('ja + board → /board (app route, never localized)', () => {
    expect(navHref('ja', 'board')).toBe('/board')
  })
})
