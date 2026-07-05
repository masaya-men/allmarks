import { describe, it, expect } from 'vitest'
import { getFullscreenSaveCopy } from './save-fullscreen-copy'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

describe('getFullscreenSaveCopy', () => {
  it('every supported locale has complete, non-empty copy with 3 bullets', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const c = getFullscreenSaveCopy(locale)
      expect(c.heading.trim(), locale).not.toBe('')
      expect(c.intro.trim(), locale).not.toBe('')
      expect(c.tagNote.trim(), locale).not.toBe('')
      expect(c.bullets.length, locale).toBe(3)
      for (const b of c.bullets) {
        expect(b.lead.trim(), locale).not.toBe('')
        expect(b.rest.trim(), locale).not.toBe('')
      }
    }
  })

  it('returns the Japanese copy for ja', () => {
    expect(getFullscreenSaveCopy('ja').heading).toContain('フルスクリーン')
  })

  it('falls back to English for an unknown locale', () => {
    expect(getFullscreenSaveCopy('xx' as SupportedLocale)).toBe(getFullscreenSaveCopy('en'))
  })
})
