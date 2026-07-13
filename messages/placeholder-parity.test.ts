import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

// The all-keys parity test guarantees every locale has the same keys with non-
// empty strings, but it does NOT look inside the values. Interpolated strings
// carry `{n}` / `{current}` / `{total}` placeholders that translate.ts fills at
// runtime; if a translation drops, renames, or duplicates one of these tokens
// the UI silently renders a literal `{n}` or a blank. This test asserts that the
// MULTISET of `{…}` tokens in each locale's value is byte-identical to en, for
// every leaf key — the one guard the existing 6 parity tests were missing (C0).
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

/** Sorted list of every `{…}` token occurrence (multiset, so counts must match too). */
function placeholders(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return (value.match(/\{[^}]+\}/g) ?? []).sort()
}

describe('プレースホルダのパリティ ({n} 等の補間トークンが en と一致)', () => {
  const enKeys = leafKeys(en)

  // Keys that actually carry a placeholder in en — surfaced so a future en edit
  // that removes the last placeholder makes this list shrink visibly.
  it('en に補間トークンを持つキーが存在する (下限チェック)', () => {
    const withTokens = enKeys.filter((k) => placeholders(valueAt(en, k)).length > 0)
    expect(withTokens.length).toBeGreaterThan(0)
  })

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === 'en') continue
    it(`${locale}: 全キーの {…} トークン集合が en と完全一致`, () => {
      const mismatches: { key: string; en: string[]; got: string[] }[] = []
      for (const path of enKeys) {
        const want = placeholders(valueAt(en, path))
        const got = placeholders(valueAt(FILES[locale], path))
        if (JSON.stringify(want) !== JSON.stringify(got)) {
          mismatches.push({ key: path, en: want, got })
        }
      }
      expect(mismatches).toEqual([])
    })
  }
})
