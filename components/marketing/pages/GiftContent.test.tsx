import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import ja from '@/messages/ja.json'
import type { Messages } from '@/lib/i18n/config'
import { renderWithLocale } from '@/lib/i18n/test-utils'
import { GiftContent } from './GiftContent'

const { mockUseSearchParams } = vi.hoisted(() => ({ mockUseSearchParams: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: mockUseSearchParams }))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function withSecret(c = 'secret1'): void {
  mockUseSearchParams.mockReturnValue(new URLSearchParams(`c=${c}`))
}

function withoutSecret(): void {
  mockUseSearchParams.mockReturnValue(new URLSearchParams(''))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GiftContent', () => {
  it('before -> click -> success: shows the receive button, then the key after a successful claim', async () => {
    withSecret()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true, key: 'K3-GIFT', kid: 'kid-1' })) as unknown as typeof fetch

    renderWithLocale(<GiftContent />, 'ja', ja as Messages)
    expect(screen.getByTestId('gift-state-form')).toBeTruthy()
    expect(screen.queryByTestId('gift-key-value')).toBeNull()

    fireEvent.click(screen.getByTestId('gift-receive-button'))

    const box = await screen.findByTestId('gift-key-value')
    expect(box.textContent).toBe('K3-GIFT')
    expect(screen.getByTestId('gift-state-success')).toBeTruthy()
    expect(global.fetch).toHaveBeenCalledWith('/api/license/claim', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ c: 'secret1' }),
    }))
  })

  it('missing c: shows the invalid-link message immediately, with no API call', () => {
    withoutSecret()
    const fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    renderWithLocale(<GiftContent />, 'ja', ja as Messages)
    expect(screen.getByTestId('gift-state-invalid')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reason:invalid from the API: shows the invalid-link message', async () => {
    withSecret()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: false, reason: 'invalid' })) as unknown as typeof fetch

    renderWithLocale(<GiftContent />, 'ja', ja as Messages)
    fireEvent.click(screen.getByTestId('gift-receive-button'))

    await screen.findByTestId('gift-state-invalid')
  })

  it('network error: shows the retry message and lets the user try again successfully', async () => {
    withSecret()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ ok: true, key: 'K3-RETRIED' }))
    global.fetch = fetchMock as unknown as typeof fetch

    renderWithLocale(<GiftContent />, 'ja', ja as Messages)
    fireEvent.click(screen.getByTestId('gift-receive-button'))

    await screen.findByTestId('gift-error-message')
    const retryButton = screen.getByTestId('gift-receive-button')
    expect(retryButton).not.toBeDisabled()

    fireEvent.click(retryButton)
    const box = await screen.findByTestId('gift-key-value')
    expect(box.textContent).toBe('K3-RETRIED')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('not-configured/other server reason: treated as a retryable error, not a dead link', async () => {
    withSecret()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: false, reason: 'not-configured' })) as unknown as typeof fetch

    renderWithLocale(<GiftContent />, 'ja', ja as Messages)
    fireEvent.click(screen.getByTestId('gift-receive-button'))

    await screen.findByTestId('gift-error-message')
    expect(screen.queryByTestId('gift-state-invalid')).toBeNull()
  })

  it('over-length c: shows the invalid-link message immediately, with no API call', () => {
    withSecret('a'.repeat(129))
    const fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    renderWithLocale(<GiftContent />, 'ja', ja as Messages)
    expect(screen.getByTestId('gift-state-invalid')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
