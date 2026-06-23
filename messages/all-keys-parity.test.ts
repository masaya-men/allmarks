import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

// Every locale JSON. The per-section parity tests (landing / pages-* / board-
// onboarding) only cover their own subtree, leaving part of the tree unchecked.
// This test asserts the WHOLE message tree is structurally identical across all
// 15 locales, so any new key added to one file without the others fails loudly
// (rank16). The runtime English fallback in translate.ts is the safety net;
// this is the build-time guard that keeps the tree complete in the first place.
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

/** Every leaf key path (dot notation) in the whole tree, sorted. */
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

function valueAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, p) => (acc as Record<string, unknown>)?.[p], obj)
}

describe('全メッセージキーのパリティ (rank16)', () => {
  const enKeys = leafKeys(en)

  it('15言語すべての JSON が揃っている', () => {
    expect(Object.keys(FILES).sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })

  it('en は leaf キーを持つ (リグレッション検知用の下限)', () => {
    expect(enKeys.length).toBeGreaterThan(300)
  })

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === 'en') continue
    it(`${locale}: 全 leaf キーが en と完全一致 (欠損・余剰ゼロ)`, () => {
      const keys = leafKeys(FILES[locale])
      const missing = enKeys.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !enKeys.includes(k))
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] })
    })
    it(`${locale}: 全値が非空文字列`, () => {
      for (const path of enKeys) {
        const v = valueAt(FILES[locale], path)
        expect(typeof v, `${locale}.${path} should be a string`).toBe('string')
        expect((v as string).length, `${locale}.${path} should be non-empty`).toBeGreaterThan(0)
      }
    })
  }
})
