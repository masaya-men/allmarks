import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Chrome i18n の _locales は盤面 messages/*.json とは別系統（フラット {key:{message,...}}）。
// このテストは 15 ロケールの messages.json が「en と同じキー集合・全 message 非空」で
// 揃っていることを保証する（欠損キーがあると options 画面がそのキーだけ英語 or 空に落ちる）。
const LOCALES = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'tr', 'ru', 'ar', 'th', 'vi'] as const

function load(locale: string): Record<string, { message: string }> {
  const p = resolve(__dirname, '../../extension/_locales', locale, 'messages.json')
  return JSON.parse(readFileSync(p, 'utf8'))
}

describe('拡張 _locales のパリティ', () => {
  const en = load('en')
  const enKeys = Object.keys(en).sort()

  it('15 ロケールすべての messages.json が存在する', () => {
    for (const l of LOCALES) {
      const p = resolve(__dirname, '../../extension/_locales', l, 'messages.json')
      expect(existsSync(p), `${l}/messages.json missing`).toBe(true)
    }
  })

  it('en は下限キー数を満たす (リグレッション検知)', () => {
    expect(enKeys.length).toBeGreaterThan(30)
  })

  for (const locale of LOCALES) {
    if (locale === 'en') continue
    it(`${locale}: キー集合が en と完全一致 (欠損・余剰ゼロ)`, () => {
      const keys = Object.keys(load(locale)).sort()
      const missing = enKeys.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !enKeys.includes(k))
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] })
    })
    it(`${locale}: 全 message が非空文字列`, () => {
      const m = load(locale)
      for (const k of enKeys) {
        expect(typeof m[k]?.message, `${locale}.${k}.message must be string`).toBe('string')
        expect((m[k]?.message ?? '').length, `${locale}.${k}.message must be non-empty`).toBeGreaterThan(0)
      }
    })
  }
})
