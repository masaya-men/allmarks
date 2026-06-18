import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { TermsContent } from '@/components/marketing/pages/TermsContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'terms', 'terms')
}

export default function TermsPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="terms">
        <TermsContent />
      </MarketingShell>
    </I18nProvider>
  )
}
