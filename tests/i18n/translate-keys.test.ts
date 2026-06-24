import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

const KEYS = ['translate', 'showOriginal', 'translationFailed'] as const

describe('tweet translate i18n keys', () => {
  it('every locale defines board.lightbox.{translate,showOriginal,translationFailed} non-empty', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const msgs = (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>
      const board = msgs.board as Record<string, unknown>
      const lightbox = board?.lightbox as Record<string, string>
      for (const k of KEYS) {
        expect(typeof lightbox?.[k], `${locale}.board.lightbox.${k}`).toBe('string')
        expect((lightbox?.[k] ?? '').length, `${locale}.board.lightbox.${k}`).toBeGreaterThan(0)
      }
    }
  })
})
