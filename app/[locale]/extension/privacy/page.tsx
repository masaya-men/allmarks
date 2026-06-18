import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ExtensionPrivacyContent } from '@/components/marketing/pages/ExtensionPrivacyContent'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { pageMetadata } from '@/lib/i18n/page-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string }> {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

function isPrefixedLocale(value: string): value is SupportedLocale {
  return value !== 'en' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) return {}
  return pageMetadata(locale, 'extensionPrivacy', 'extension/privacy')
}

export default async function LocaleExtensionPrivacy({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="extension/privacy">
        <ExtensionPrivacyContent />
      </MarketingShell>
    </I18nProvider>
  )
}
