import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('pages.about 15言語キーパリティ', () => {
  const base = require('./en.json').pages.about
  const baseKeys = leafKeys(base).sort()

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale} は en と同一 leaf key を持つ`, () => {
      const msgs = require(`./${locale}.json`)
      expect(msgs.pages?.about, `${locale} に pages.about が無い`).toBeDefined()
      expect(leafKeys(msgs.pages.about).sort()).toEqual(baseKeys)
    })
    it(`${locale} の cta.button は "Open Board" verbatim`, () => {
      const msgs = require(`./${locale}.json`)
      expect(msgs.pages.about.cta.button).toBe('Open Board')
    })
  }
})
