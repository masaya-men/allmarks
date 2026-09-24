import { describe, it, expect, afterEach, vi } from 'vitest'
import { getPaddleCheckoutConfig } from './paddle-config'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getPaddleCheckoutConfig', () => {
  it('client token が空なら null(env が何も無い既定状態)', () => {
    vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', '')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SYNC_MONTHLY', 'pri_sync_m')
    expect(getPaddleCheckoutConfig('sync', 'monthly')).toBeNull()
  })

  it('token はあってもそのプラン/サイクルの price id が空なら null', () => {
    vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'test_token')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SYNC_MONTHLY', '')
    expect(getPaddleCheckoutConfig('sync', 'monthly')).toBeNull()
  })

  it('token + price id が揃っていれば sandbox 既定(env 未指定)で値を返す', () => {
    vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'test_token')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_ENV', '')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SYNC_MONTHLY', 'pri_sync_monthly')
    expect(getPaddleCheckoutConfig('sync', 'monthly')).toEqual({
      environment: 'sandbox',
      clientToken: 'test_token',
      priceId: 'pri_sync_monthly',
    })
  })

  it("NEXT_PUBLIC_PADDLE_ENV='live' なら environment: 'live'", () => {
    vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'test_token')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_ENV', 'live')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SUPPORTER_YEARLY', 'pri_supporter_yearly')
    expect(getPaddleCheckoutConfig('supporter', 'annual')).toEqual({
      environment: 'live',
      clientToken: 'test_token',
      priceId: 'pri_supporter_yearly',
    })
  })

  it('プラン/サイクルごとに正しい price id 環境変数を引く', () => {
    vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'test_token')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SYNC_MONTHLY', 'pri_sync_m')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SYNC_YEARLY', 'pri_sync_y')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SUPPORTER_MONTHLY', 'pri_supporter_m')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_PRICE_SUPPORTER_YEARLY', 'pri_supporter_y')

    expect(getPaddleCheckoutConfig('sync', 'monthly')?.priceId).toBe('pri_sync_m')
    expect(getPaddleCheckoutConfig('sync', 'annual')?.priceId).toBe('pri_sync_y')
    expect(getPaddleCheckoutConfig('supporter', 'monthly')?.priceId).toBe('pri_supporter_m')
    expect(getPaddleCheckoutConfig('supporter', 'annual')?.priceId).toBe('pri_supporter_y')
  })
})
