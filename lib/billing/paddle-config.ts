// lib/billing/paddle-config.ts
// Paddle Checkout 用の公開設定(NEXT_PUBLIC_* / ビルド時にクライアントへ埋め込まれる値)。
// 値が揃うまでは null を返す = 呼び出し側(料金ページ)はこれ一つで
// 「ボタンを disabled のままにする / 有効化する」を判定できる。
// 秘密鍵(PADDLE_API_KEY)はここでは扱わない — それは lib/board/paddle-api.ts
// (サーバー側の transaction/subscription 確認)専用。

import type { BillingCycle, PaidPlanId } from '@/lib/pricing/plans'

export type PaddleEnvironment = 'sandbox' | 'live'

export interface PaddleCheckoutConfig {
  /** 'sandbox' なら Paddle.Environment.set('sandbox') を Initialize 前に呼ぶ。 */
  readonly environment: PaddleEnvironment
  /** クライアントサイド(公開)トークン。Paddle.Initialize({ token }) に渡す。 */
  readonly clientToken: string
  /** 指定したプラン/支払いサイクルの Paddle price id。 */
  readonly priceId: string
}

function resolvePriceId(planId: PaidPlanId, cycle: BillingCycle): string {
  if (planId === 'sync') {
    return cycle === 'monthly'
      ? process.env.NEXT_PUBLIC_PADDLE_PRICE_SYNC_MONTHLY ?? ''
      : process.env.NEXT_PUBLIC_PADDLE_PRICE_SYNC_YEARLY ?? ''
  }
  return cycle === 'monthly'
    ? process.env.NEXT_PUBLIC_PADDLE_PRICE_SUPPORTER_MONTHLY ?? ''
    : process.env.NEXT_PUBLIC_PADDLE_PRICE_SUPPORTER_YEARLY ?? ''
}

/**
 * 指定したプラン/支払いサイクルの Paddle チェックアウト設定を返す。
 * クライアントトークン、またはそのプラン/サイクルに対応する price id が
 * 空(未設定)なら null — 料金ページはこれを「Paddle 未設定」として扱い、
 * ボタンを今まで通り disabled のままにする。
 */
export function getPaddleCheckoutConfig(planId: PaidPlanId, cycle: BillingCycle): PaddleCheckoutConfig | null {
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? ''
  if (!clientToken) return null

  const priceId = resolvePriceId(planId, cycle)
  if (!priceId) return null

  const environment: PaddleEnvironment = process.env.NEXT_PUBLIC_PADDLE_ENV === 'live' ? 'live' : 'sandbox'
  return { environment, clientToken, priceId }
}
