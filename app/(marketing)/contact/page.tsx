import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ContactContent } from '@/components/marketing/pages/ContactContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'contact', 'contact')
}

export default function ContactPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="contact">
        <ContactContent />
      </MarketingShell>
    </I18nProvider>
  )
}
