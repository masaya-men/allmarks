import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { renderWithLocale } from '@/lib/i18n/test-utils'
import { PurchaseContent } from './PurchaseContent'

const { mockUseSearchParams } = vi.hoisted(() => ({ mockUseSearchParams: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: mockUseSearchParams }))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function withTxn(txn = 'txn_abcdefghij'): void {
  mockUseSearchParams.mockReturnValue(new URLSearchParams(`txn=${txn}`))
}

function withoutTxn(): void {
  mockUseSearchParams.mockReturnValue(new URLSearchParams(''))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PurchaseContent', () => {
  it('ok: shows the key immediately', async () => {
    withTxn()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true, key: 'K3-IMMEDIATE', kid: 'kid-1' })) as unknown as typeof fetch

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)

    const box = await screen.findByTestId('purchase-key-value')
    expect(box.textContent).toBe('K3-IMMEDIATE')
    expect(screen.getByTestId('purchase-state-success')).toBeTruthy()
  })

  it('processing then ok: retries after 2s and shows the key', async () => {
    withTxn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'processing' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, key: 'K3-RETRY' }))
    global.fetch = fetchMock as unknown as typeof fetch
    vi.useFakeTimers()

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByTestId('purchase-state-loading')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('purchase-key-value').textContent).toBe('K3-RETRY')
  })

  it('stuck processing: shows the still-processing message after 30s of retries', async () => {
    withTxn()
    // mockResolvedValue would reuse the SAME Response across calls, and a
    // Response body can only be read once — .json() on the 2nd+ call would
    // throw. Each retry needs its own fresh Response.
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: false, reason: 'processing' }))) as unknown as typeof fetch
    vi.useFakeTimers()

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(screen.getByTestId('purchase-state-timeout')).toBeTruthy()
  })

  it('not-found: shows the could-not-confirm message', async () => {
    withTxn()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: false, reason: 'not-found' })) as unknown as typeof fetch

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)
    await screen.findByTestId('purchase-state-not-found')
  })

  it('upstream: shows the something-went-wrong message', async () => {
    withTxn()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: false, reason: 'upstream' })) as unknown as typeof fetch

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)
    await screen.findByTestId('purchase-state-error')
  })

  it('no txn: shows only the lost-key form, with no API call', () => {
    withoutTxn()
    const fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)
    expect(screen.getByTestId('purchase-state-form')).toBeTruthy()
    expect(screen.queryByTestId('purchase-key-value')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lost-key form: an invalid order number shows the could-not-confirm message without calling the API', () => {
    withoutTxn()
    const fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)
    fireEvent.change(screen.getByTestId('purchase-lost-input'), { target: { value: 'not-a-txn' } })
    fireEvent.click(screen.getByTestId('purchase-lost-submit'))

    expect(screen.getByTestId('purchase-state-not-found')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lost-key form: a valid order number runs the same flow and shows the key', async () => {
    withoutTxn()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true, key: 'K3-FROM-FORM' })) as unknown as typeof fetch

    renderWithLocale(<PurchaseContent />, 'en', en as Messages)
    fireEvent.change(screen.getByTestId('purchase-lost-input'), { target: { value: 'txn_abcdefghij' } })
    fireEvent.click(screen.getByTestId('purchase-lost-submit'))

    const box = await screen.findByTestId('purchase-key-value')
    expect(box.textContent).toBe('K3-FROM-FORM')
  })
})
