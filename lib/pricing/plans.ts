/**
 * 料金プランの確定値(円・税込)。s221 時点では全ロケール共通で日本円固定表示
 * (通貨のローカライズは将来対応)。マジックナンバーをコンポーネント側に
 * 散らばらせず、この1ファイルに集約する。Paddle 導入までは申し込み不可
 * (PricingContent 側で Sync/Supporter の CTA を disabled にする)。
 */

export type PlanId = 'free' | 'sync' | 'supporter'
export type PaidPlanId = Exclude<PlanId, 'free'>
export type BillingCycle = 'monthly' | 'annual'

export type PlanPricing = {
  /** 月払い時の月額(円)。 */
  monthly: number
  /** 年払い時の年額(円)。 */
  annual: number
}

export const PLAN_PRICE: Record<PaidPlanId, PlanPricing> = {
  sync: { monthly: 500, annual: 5000 },
  supporter: { monthly: 1500, annual: 15000 },
}

/** ¥ + 3桁区切り(JPY は小数なし)。 */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('en-US')}`
}

/** 年払い額を月あたりに換算(四捨五入)。 */
export function monthlyEquivalent(annual: number): number {
  return Math.round(annual / 12)
}
