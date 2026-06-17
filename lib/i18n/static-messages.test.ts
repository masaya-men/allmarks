import { describe, it, expect } from 'vitest'
import { STATIC_MESSAGES } from './static-messages'
import { SUPPORTED_LOCALES } from './config'
import { translate } from './translate'

describe('static-messages', () => {
  it('15言語すべて存在する', () => {
    expect(Object.keys(STATIC_MESSAGES).sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })
  it('各言語で landing.hero.headline が引ける(キー文字列が返らない)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const headline = translate(STATIC_MESSAGES[locale], 'landing.hero.headline')
      expect(headline).not.toBe('landing.hero.headline')
      expect(headline.length).toBeGreaterThan(0)
    }
  })
})
