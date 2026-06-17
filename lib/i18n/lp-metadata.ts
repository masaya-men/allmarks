import type { Metadata } from 'next'
import { type SupportedLocale } from './config'
import { STATIC_MESSAGES } from './static-messages'
import { translate } from './translate'
import { localePath, hreflangAlternates } from './locale-urls'

/** hreflang code → OpenGraph locale (og は xx_XX 形式を好む。最低限の対応)。 */
const OG_LOCALE: Partial<Record<SupportedLocale, string>> = {
  ja: 'ja_JP', en: 'en_US', zh: 'zh_CN', ko: 'ko_KR', es: 'es_ES',
  fr: 'fr_FR', de: 'de_DE', pt: 'pt_BR', it: 'it_IT', nl: 'nl_NL',
  tr: 'tr_TR', ru: 'ru_RU', ar: 'ar_AR', th: 'th_TH', vi: 'vi_VN',
}

/** Per-locale LP metadata: hreflang alternates, self canonical, localized description. */
export function lpMetadata(locale: SupportedLocale): Metadata {
  const description = translate(STATIC_MESSAGES[locale], 'landing.hero.description')
  return {
    description,
    alternates: {
      canonical: localePath(locale),
      languages: hreflangAlternates(),
    },
    openGraph: {
      description,
      locale: OG_LOCALE[locale] ?? 'en_US',
    },
  }
}
