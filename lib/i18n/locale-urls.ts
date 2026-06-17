import { SUPPORTED_LOCALES, type SupportedLocale } from './config'

/** LP path for a locale. English is the bare root '/', others get a '/<locale>' prefix. */
export function localePath(locale: SupportedLocale): string {
  return locale === 'en' ? '/' : `/${locale}`
}

/** Locales that get a URL prefix — everything except English. Used by generateStaticParams. */
export const PREFIXED_LOCALES: readonly SupportedLocale[] = SUPPORTED_LOCALES.filter(
  (l) => l !== 'en',
)

/**
 * hreflang alternates map for Next Metadata `alternates.languages`.
 * All 15 languages keyed by hreflang code, plus 'x-default' → '/' (English).
 * Relative paths; Next resolves them against metadataBase (lib/constants SITE_URL).
 */
export function hreflangAlternates(): Record<string, string> {
  const map: Record<string, string> = { 'x-default': '/' }
  for (const l of SUPPORTED_LOCALES) map[l] = localePath(l)
  return map
}
