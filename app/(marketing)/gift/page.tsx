import type { Metadata } from 'next'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { GiftContent } from '@/components/marketing/pages/GiftContent'

/**
 * 同期キー無料プレゼントページ。functions/claim.ts の GET /claim?c=... が
 * ここへ 302 redirect する(旧・直接発券だったURL)。会員固有リンクのため
 * 検索非公開(noindex/nofollow・サイトマップ非掲載)。日本語のみで多言語化
 * しない(app/[locale]/gift は作らない)。lib/i18n/locale-redirect.ts の
 * 自動リダイレクトも対象外(functions/gift.ts を作らないため
 * functions/_lib/locale-redirect-handler.ts の対象パスに含まれない)。
 */
export const metadata: Metadata = {
  title: 'AllMarks 同期キーのプレゼント',
  description: 'AllMarks の端末間同期を無料で使えるキーを受け取れます。',
  robots: { index: false, follow: false },
}

export default function GiftPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="ja" initialMessages={STATIC_MESSAGES.ja}>
      <MarketingShell locale="ja">
        <GiftContent />
      </MarketingShell>
    </I18nProvider>
  )
}
