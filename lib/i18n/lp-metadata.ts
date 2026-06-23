import type { Metadata } from 'next'
import { APP_NAME } from '@/lib/constants'
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

/** Per-locale LP metadata: localized title + description, hreflang alternates, self canonical. */
export function lpMetadata(locale: SupportedLocale): Metadata {
  const description = translate(STATIC_MESSAGES[locale], 'landing.hero.description')
  // Title = brand + localized descriptor so search results & browser tabs read
  // in the visitor's language (F-1). The brand "AllMarks" stays English; English
  // keeps its established "Bookmark × Collage" tagline, every other locale uses
  // its own hero headline. `absolute` bypasses the root "%s | AllMarks" template.
  const title =
    locale === 'en'
      ? `${APP_NAME} — Bookmark × Collage`
      : `${APP_NAME} — ${translate(STATIC_MESSAGES[locale], 'landing.hero.headline')}`
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: localePath(locale),
      languages: hreflangAlternates(),
    },
    openGraph: {
      title,
      description,
      locale: OG_LOCALE[locale] ?? 'en_US',
      // Re-declare the social card here: a page-level openGraph replaces the root
      // layout's openGraph (Next doesn't deep-merge it), so without this the LP —
      // the most-shared URL — would lose its preview image (rank4).
      images: [
        {
          url: '/og.png',
          width: 1200,
          height: 630,
          alt: `${APP_NAME} — turn your bookmarks into a visual collage`,
        },
      ],
    },
  }
}
