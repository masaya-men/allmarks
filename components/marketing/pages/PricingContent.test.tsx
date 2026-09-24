import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PricingContent } from './PricingContent'

// paddle-config / paddle-checkout をモックし、PricingContent が
// (a) config が null の間はボタンを disabled のままにする
// (b) config がある時、プラン/支払いサイクルごとに正しい priceId で
//     openPaddleCheckout を呼ぶ
// ことだけを検証する(Paddle.js 自体のロード/Checkout.open 呼び出し詳細は
// lib/billing/paddle-checkout.test.ts 側の責務)。
const getPaddleCheckoutConfig = vi.fn()
const openPaddleCheckout = vi.fn()

vi.mock('@/lib/billing/paddle-config', () => ({
  getPaddleCheckoutConfig: (planId: string, cycle: string) => getPaddleCheckoutConfig(planId, cycle),
}))
vi.mock('@/lib/billing/paddle-checkout', () => ({
  openPaddleCheckout: (config: unknown, locale: string) => openPaddleCheckout(config, locale),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PricingContent — Paddle checkout wiring', () => {
  it('getPaddleCheckoutConfig が null(未設定)を返す間は Sync/Supporter ボタンが disabled', () => {
    getPaddleCheckoutConfig.mockReturnValue(null)
    render(<PricingContent />)
    const buttons = screen.getAllByRole('button', { name: 'Subscribe' })
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button).toBeDisabled()
    }
  })

  it('config がある時は有効化され、プラン別に正しい priceId で checkout を開く(月払い既定)', () => {
    getPaddleCheckoutConfig.mockImplementation((planId: string, cycle: string) => ({
      environment: 'sandbox' as const,
      clientToken: 'test_token',
      priceId: `pri_${planId}_${cycle}`,
    }))
    render(<PricingContent />)
    const [syncButton, supporterButton] = screen.getAllByRole('button', { name: 'Subscribe' })
    expect(syncButton).not.toBeDisabled()
    expect(supporterButton).not.toBeDisabled()

    fireEvent.click(syncButton)
    expect(openPaddleCheckout).toHaveBeenCalledWith({ environment: 'sandbox', clientToken: 'test_token', priceId: 'pri_sync_monthly' }, 'en')

    fireEvent.click(supporterButton)
    expect(openPaddleCheckout).toHaveBeenCalledWith(
      { environment: 'sandbox', clientToken: 'test_token', priceId: 'pri_supporter_monthly' },
      'en',
    )
  })

  it('年払いトグルに切り替えると annual の priceId で checkout を開く', () => {
    getPaddleCheckoutConfig.mockImplementation((planId: string, cycle: string) => ({
      environment: 'sandbox' as const,
      clientToken: 'test_token',
      priceId: `pri_${planId}_${cycle}`,
    }))
    render(<PricingContent />)
    fireEvent.click(screen.getByRole('button', { name: /Annual/ }))

    const [syncButton] = screen.getAllByRole('button', { name: 'Subscribe' })
    fireEvent.click(syncButton)
    expect(openPaddleCheckout).toHaveBeenCalledWith({ environment: 'sandbox', clientToken: 'test_token', priceId: 'pri_sync_annual' }, 'en')
  })
})
