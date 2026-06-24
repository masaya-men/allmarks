import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'
import { localeToTranslatorLang } from './locale-map'

describe('localeToTranslatorLang', () => {
  it('maps zh to simplified Chinese (zh-Hans)', () => {
    expect(localeToTranslatorLang('zh')).toBe('zh-Hans')
  })
  it('passes through primary subtags unchanged', () => {
    expect(localeToTranslatorLang('ja')).toBe('ja')
    expect(localeToTranslatorLang('en')).toBe('en')
    expect(localeToTranslatorLang('pt')).toBe('pt')
  })
  it('returns a non-empty BCP-47 tag for every supported locale', () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(localeToTranslatorLang(l).length).toBeGreaterThan(0)
    }
  })
})
