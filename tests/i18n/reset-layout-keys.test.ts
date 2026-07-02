import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

const KEYS = [
  'layoutGroup',
  'resetCardSizes',
  'sortNewestFirst',
  'tapAgainToConfirm',
  'sortNewestNote',
  'resetSizesDone',
  'sortNewestDone',
] as const

describe('board reset-layout i18n keys', () => {
  it('every locale defines board.settings.<key> non-empty', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const msgs = (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>
      const board = msgs.board as Record<string, unknown>
      const settings = board?.settings as Record<string, string>
      for (const k of KEYS) {
        expect(typeof settings?.[k], `${locale}.board.settings.${k}`).toBe('string')
        expect((settings?.[k] ?? '').length, `${locale}.board.settings.${k}`).toBeGreaterThan(0)
      }
    }
  })

  it('resetSizesDone keeps the {n} placeholder in every locale', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const msgs = (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>
      const settings = (msgs.board as Record<string, unknown>).settings as Record<string, string>
      expect(settings.resetSizesDone, `${locale}.resetSizesDone`).toContain('{n}')
    }
  })
})
