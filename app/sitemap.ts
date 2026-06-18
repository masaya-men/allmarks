import type { MetadataRoute } from 'next'
import { SITE_URL as PRODUCTION_URL } from '@/lib/constants'
import { PREFIXED_LOCALES, localePath } from '@/lib/i18n/locale-urls'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const routes: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    // トップLPの言語別URL(検索集客の本丸)
    ...PREFIXED_LOCALES.map((locale) => ({
      path: localePath(locale),
      priority: 0.9,
      changeFrequency: 'weekly' as const,
    })),
    { path: '/board', priority: 0.9, changeFrequency: 'weekly' },
    // Features(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'features'),
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
    // Guide(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'guide'),
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
    // About(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'about'),
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
    // FAQ(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'faq'),
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
    // Extension 紹介(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'extension'),
      priority: 0.6,
      changeFrequency: 'monthly' as const,
    })),
    // Contact(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'contact'),
      priority: 0.6,
      changeFrequency: 'monthly' as const,
    })),
    // Privacy(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'privacy'),
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    })),
    // Terms(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'terms'),
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    })),
    // Extension Privacy(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'extension/privacy'),
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    })),
  ]

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${PRODUCTION_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
