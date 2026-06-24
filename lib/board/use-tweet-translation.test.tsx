import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/translate/translator-api', () => ({
  isTranslatorSupported: vi.fn(() => true),
  detectLanguage: vi.fn(async () => 'es'),
  getTranslatorAvailability: vi.fn(async () => 'available'),
  translateText: vi.fn(async (a: { text: string }) => `EN(${a.text})`),
}))
// テキスト遷移は決定論化: toText を即 onFrame、settle も即 onFrame。
vi.mock('@/lib/animation/text-transition', () => ({
  getTextTransition: () => ({
    run: (args: { toText: string | null; onFrame: (t: string) => void }) => {
      if (args.toText !== null) args.onFrame(args.toText)
      return { settle: (f: string) => args.onFrame(f), cancel: () => {} }
    },
  }),
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

  it('toggle translates, then toggles back to original without re-translating', async () => {
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
})
