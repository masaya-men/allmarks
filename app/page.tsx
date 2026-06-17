// app/page.tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LandingPage } from '@/components/marketing/LandingPage'
import { lpMetadata } from '@/lib/i18n/lp-metadata'

export function generateMetadata(): Metadata {
  return lpMetadata('en')
}

export default function Home(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <LandingPage locale="en" />
    </I18nProvider>
  )
}
