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

/** leaf キーパスを集める(値の型は string 前提)。 */
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

function onboardingOf(file: unknown): Record<string, unknown> {
  const board = (file as Record<string, unknown>).board as Record<string, unknown> | undefined
  return (board?.onboarding as Record<string, unknown>) ?? {}
}

// translate() now falls back to English on a miss (rank16), so a missing
// onboarding key renders the English string rather than the literal key path —
// but English text in a non-English locale is still a defect. This structural
// guard keeps every locale complete so the fallback never has to fire, the same
// way landing-parity guards the landing block. (all-keys-parity.test.ts covers
// the whole tree; this stays as the focused onboarding guard.)
describe('board.onboarding translation parity', () => {
  const enKeys = leafKeys(onboardingOf(en))

  it('15言語すべてが揃っている', () => {
    expect(Object.keys(FILES).sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })

  it('en は board.onboarding の leaf キーを持つ', () => {
    expect(enKeys.length).toBeGreaterThan(0)
    expect(enKeys).toContain('install.demoCaption')
    expect(enKeys).toContain('install.body')
  })

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale}: board.onboarding leaf キーが en と完全一致`, () => {
      expect(leafKeys(onboardingOf(FILES[locale]))).toEqual(enKeys)
    })
    it(`${locale}: 全 board.onboarding 値が非空文字列`, () => {
      const onboarding = onboardingOf(FILES[locale])
      for (const path of enKeys) {
        const v = path.split('.').reduce<unknown>((acc, p) => (acc as Record<string, unknown>)?.[p], onboarding)
        expect(typeof v).toBe('string')
        expect((v as string).length).toBeGreaterThan(0)
      }
    })
  }
})
