import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isTranslatorSupported, detectLanguage, getTranslatorAvailability, translateText,
} from './translator-api'

const g = globalThis as unknown as Record<string, unknown>

afterEach(() => {
  delete g.Translator
  delete g.LanguageDetector
  vi.restoreAllMocks()
})

describe('translator-api', () => {
  it('isTranslatorSupported is false when globals are absent', () => {
    expect(isTranslatorSupported()).toBe(false)
  })

  it('isTranslatorSupported is true when both globals exist', () => {
    g.Translator = {}
    g.LanguageDetector = {}
    expect(isTranslatorSupported()).toBe(true)
  })

  it('detectLanguage returns the top language above the confidence floor', async () => {
    g.LanguageDetector = {
      create: vi.fn(async () => ({
        detect: vi.fn(async () => [
          { detectedLanguage: 'es', confidence: 0.92 },
          { detectedLanguage: 'pt', confidence: 0.05 },
        ]),
      })),
    }
    expect(await detectLanguage('Hola mundo')).toBe('es')
  })

  it('detectLanguage returns null below the confidence floor', async () => {
    g.LanguageDetector = {
      create: vi.fn(async () => ({
        detect: vi.fn(async () => [{ detectedLanguage: 'es', confidence: 0.2 }]),
      })),
    }
    expect(await detectLanguage('???')).toBeNull()
  })

  it('getTranslatorAvailability forwards the API verdict', async () => {
    g.Translator = { availability: vi.fn(async () => 'downloadable') }
    expect(await getTranslatorAvailability('es', 'en')).toBe('downloadable')
  })

  it('translateText creates a translator and returns the translation', async () => {
    const translate = vi.fn(async (t: string) => `EN(${t})`)
    g.Translator = { create: vi.fn(async () => ({ translate })) }
    expect(await translateText({ source: 'es', target: 'en', text: 'Hola' })).toBe('EN(Hola)')
    expect(translate).toHaveBeenCalledWith('Hola')
  })

  it('translateText reports download progress via monitor', async () => {
    const translate = vi.fn(async () => 'ok')
    g.Translator = {
      create: vi.fn(async (opts: { monitor?: (m: { addEventListener: (e: string, cb: (ev: { loaded: number }) => void) => void }) => void }) => {
        opts.monitor?.({ addEventListener: (_e, cb) => cb({ loaded: 0.5 }) })
        return { translate }
      }),
    }
    const seen: number[] = []
    await translateText({ source: 'es', target: 'en', text: 'x', onProgress: (l) => seen.push(l) })
    expect(seen).toContain(0.5)
  })
})
