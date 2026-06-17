import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LandingPage } from '@/components/marketing/LandingPage'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { lpMetadata } from '@/lib/i18n/lp-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

// output:'export' — 列挙した locale 以外は生成しない(オンデマンド生成なし)。
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
  return lpMetadata(locale)
}

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <LandingPage locale={locale} />
    </I18nProvider>
  )
}
