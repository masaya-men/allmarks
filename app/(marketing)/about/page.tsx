import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { AboutContent } from '@/components/marketing/pages/AboutContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'about', 'about')
}

export default function AboutPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="about">
        <AboutContent />
      </MarketingShell>
    </I18nProvider>
  )
}
