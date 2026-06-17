import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

// 各 locale の JSON を読み込む(vite は JSON import 可)
import ar from './ar.json'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import itMessages from './it.json'
import ja from './ja.json'
import ko from './ko.json'
import nl from './nl.json'
import pt from './pt.json'
import ru from './ru.json'
import th from './th.json'
import tr from './tr.json'
import vi from './vi.json'
import zh from './zh.json'

const FILES: Record<string, unknown> = { ar, de, en, es, fr, it: itMessages, ja, ko, nl, pt, ru, th, tr, vi, zh }

/** landing ブロックの leaf キーパスを集める(値の型は string 前提)。 */
function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return []
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) out.push(...leafKeys(v, path))
    else out.push(path)
  }
  return out.sort()
}

function landingOf(file: unknown): Record<string, unknown> {
  const landing = (file as Record<string, unknown>).landing
  return (landing as Record<string, unknown>) ?? {}
}

describe('landing translation parity', () => {
  const enKeys = leafKeys(landingOf(en))

  it('15言語すべてが揃っている', () => {
    expect(Object.keys(FILES).sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })

  it('en は29個の landing leaf キーを持つ', () => {
    expect(enKeys.length).toBe(29)
  })

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale}: landing leaf キーが en と完全一致`, () => {
      expect(leafKeys(landingOf(FILES[locale]))).toEqual(enKeys)
    })
    it(`${locale}: 全 landing 値が非空文字列`, () => {
      const landing = landingOf(FILES[locale])
      for (const path of enKeys) {
        const v = path.split('.').reduce<unknown>((acc, p) => (acc as Record<string, unknown>)?.[p], landing)
        expect(typeof v).toBe('string')
        expect((v as string).length).toBeGreaterThan(0)
      }
    })
    it(`${locale}: footer ナビは英語固定`, () => {
      const landing = landingOf(FILES[locale]) as { footer?: Record<string, string> }
      expect(landing.footer?.features).toBe('Features')
      expect(landing.footer?.faq).toBe('FAQ')
      expect(landing.footer?.privacy).toBe('Privacy')
    })
  }
})
