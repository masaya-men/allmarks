import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PurchaseContent } from '@/components/marketing/pages/PurchaseContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

/**
 * 購入完了ページ(英語版)。Paddle チェックアウト後のリダイレクト先
 * (?txn=txn_... で取引IDを受け取る、functions/api/license/purchase.ts)。
 * 検索非公開: サイトマップに載せず、noindex(会員固有ページのため)。
 */
export function generateMetadata(): Metadata {
  return { ...pageMetadata('en', 'purchase', 'purchase'), robots: { index: false, follow: false } }
}

export default function PurchasePage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="purchase">
        <PurchaseContent />
      </MarketingShell>
    </I18nProvider>
  )
}
