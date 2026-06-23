import type { Metadata } from 'next'
import { APP_NAME } from '@/lib/constants'
import { type SupportedLocale } from './config'
import { STATIC_MESSAGES } from './static-messages'
import { translate } from './translate'
import { localePath, hreflangAlternates } from './locale-urls'

/** hreflang コード → OpenGraph locale(xx_XX)。 */
const OG_LOCALE: Partial<Record<SupportedLocale, string>> = {
  ja: 'ja_JP', en: 'en_US', zh: 'zh_CN', ko: 'ko_KR', es: 'es_ES',
  fr: 'fr_FR', de: 'de_DE', pt: 'pt_BR', it: 'it_IT', nl: 'nl_NL',
  tr: 'tr_TR', ru: 'ru_RU', ar: 'ar_AR', th: 'th_TH', vi: 'vi_VN',
}

/**
 * 紹介ページ汎用メタデータ。pages.<pageKey>.meta.title/description を各言語で引き、
 * title=`AllMarks — <title>`、自己 canonical、hreflang(15言語+x-default)、OG を返す。
 */
export function pageMetadata(
  locale: SupportedLocale,
  pageKey: string,
  subpath: string,
): Metadata {
  const msgs = STATIC_MESSAGES[locale]
  const rawTitle = translate(msgs, `pages.${pageKey}.meta.title`)
  const rawDesc = translate(msgs, `pages.${pageKey}.meta.description`)
  // translate は欠損時にキー文字列を返す。その場合はブランド名のみ。
  const titleText = rawTitle.startsWith('pages.') ? APP_NAME : `${APP_NAME} — ${rawTitle}`
  const description = rawDesc.startsWith('pages.') ? '' : rawDesc
  return {
    title: { absolute: titleText },
    description,
    alternates: {
      canonical: localePath(locale, subpath),
      languages: hreflangAlternates(subpath),
    },
    openGraph: {
      title: titleText,
      description,
      locale: OG_LOCALE[locale] ?? 'en_US',
      // A page-level openGraph replaces the root layout's (no deep-merge), so
      // re-declare the social card here too — otherwise every intro page would
      // share with no preview image (rank4).
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
