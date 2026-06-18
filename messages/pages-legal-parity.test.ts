import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

const PAGE_KEYS = ['privacy', 'terms', 'contact', 'extensionPrivacy'] as const

describe('pages 法務4ページ 15言語キーパリティ', () => {
  const en = require('./en.json').pages
  for (const page of PAGE_KEYS) {
    const baseKeys = leafKeys(en[page]).sort()
    for (const locale of SUPPORTED_LOCALES) {
      it(`${locale} の pages.${page} は en と同一 leaf key を持つ`, () => {
        const msgs = require(`./${locale}.json`)
        expect(msgs.pages?.[page], `${locale} に pages.${page} が無い`).toBeDefined()
        expect(leafKeys(msgs.pages[page]).sort()).toEqual(baseKeys)
      })
    }
  }
})
