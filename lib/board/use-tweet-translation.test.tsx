import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { getTextTransition as realGetTextTransition } from '@/lib/animation/text-transition'

vi.mock('@/lib/translate/translator-api', () => ({
  isTranslatorSupported: vi.fn(() => true),
  detectLanguage: vi.fn(async () => 'es'),
  getTranslatorAvailability: vi.fn(async () => 'available'),
  translateText: vi.fn(async (a: { text: string }) => `EN(${a.text})`),
}))
// 遷移を決定論化: exit は短い setTimeout、playEntry は finalText を即 setText。
vi.mock('@/lib/animation/text-transition', () => ({
  getTextTransition: vi.fn((_theme?: string) => ({
    loadingClass: 'loading-cls',
    exitClass: 'exit-cls',
    exitMs: 5,
    playEntry: ({ finalText, setText }: { finalText: string; setText: (t: string) => void }) => {
      setText(finalText)
      return () => {}
    },
  })),
}))

import { useTweetTranslation } from './use-tweet-translation'
import * as api from '@/lib/translate/translator-api'

beforeEach(() => vi.clearAllMocks())

describe('useTweetTranslation', () => {
  it('shows the button when supported, source≠target, availability ok', async () => {
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola mundo' }))
    await waitFor(() => expect(result.current.showButton).toBe(true))
    expect(result.current.displayText).toBe('Hola mundo')
  })

  it('hides the button when the Translator API is unsupported', async () => {
    vi.mocked(api.isTranslatorSupported).mockReturnValueOnce(false)
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(api.isTranslatorSupported).toHaveBeenCalled())
    expect(result.current.showButton).toBe(false)
  })

  it('hides the button when detected source equals target locale', async () => {
    vi.mocked(api.detectLanguage).mockResolvedValueOnce('en') // FALLBACK locale = en
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hello' }))
    await waitFor(() => expect(api.detectLanguage).toHaveBeenCalled())
    expect(result.current.showButton).toBe(false)
  })

  it('hides the button when availability is unavailable', async () => {
    vi.mocked(api.getTranslatorAvailability).mockResolvedValueOnce('unavailable')
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(api.getTranslatorAvailability).toHaveBeenCalled())
    expect(result.current.showButton).toBe(false)
  })

  it('toggle translates, swaps, then toggles back to original without re-translating', async () => {
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(result.current.showButton).toBe(true))

    await act(async () => { result.current.toggle() })
    await waitFor(() => expect(result.current.displayText).toBe('EN(Hola)'))
    expect(api.translateText).toHaveBeenCalledTimes(1)

    await act(async () => { result.current.toggle() }) // back to original
    await waitFor(() => expect(result.current.displayText).toBe('Hola'))

    await act(async () => { result.current.toggle() }) // forward again (cached)
    await waitFor(() => expect(result.current.displayText).toBe('EN(Hola)'))
    expect(api.translateText).toHaveBeenCalledTimes(1) // not re-translated
  })

  it('sets failed when translate rejects, keeps original text', async () => {
    vi.mocked(api.translateText).mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(result.current.showButton).toBe(true))
    await act(async () => { result.current.toggle() })
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.displayText).toBe('Hola')
  })

  it('exposes a bodyRef and a phase-derived bodyClassName', async () => {
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(result.current.showButton).toBe(true))
    expect(result.current.bodyRef).toBeDefined()
    expect(typeof result.current.bodyClassName).toBe('string')
  })
})

describe('useTweetTranslation — themeId forwarding', () => {
  it('passes themeId straight through to getTextTransition (memoized by themeId)', async () => {
    // The module-level vi.mock above replaces getTextTransition with a spy-able fn.
    const spy = vi.mocked(realGetTextTransition as unknown as (k: string) => unknown)
    const { rerender } = renderHook(
      ({ k }: { k: string }) => useTweetTranslation({ originalText: 'Hola', themeId: k }),
      { initialProps: { k: 'ink-underline' } },
    )
    await waitFor(() => expect(spy).toHaveBeenCalledWith('ink-underline'))
    rerender({ k: 'glitch-crt' })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('glitch-crt'))
  })
})
