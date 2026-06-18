import { SUPPORTED_LOCALES, type SupportedLocale } from './config'

/**
 * locale + 任意 subpath のパス。
 * 英語は素のルート(subpath 無し='/'、有り='/<subpath>')。
 * 他言語は '/<locale>' 接頭辞付き。subpath は先頭スラッシュ無しで渡す。
 */
export function localePath(locale: SupportedLocale, subpath?: string): string {
  const base = locale === 'en' ? '' : `/${locale}`
  if (!subpath) return base === '' ? '/' : base
  return `${base}/${subpath}`
}

/** URL 接頭辞が付く locale(英語以外)。generateStaticParams 用。 */
export const PREFIXED_LOCALES: readonly SupportedLocale[] = SUPPORTED_LOCALES.filter(
  (l) => l !== 'en',
)

/**
 * Next Metadata `alternates.languages` 用 hreflang マップ。
 * 15言語(hreflang コード)+ 'x-default' → 英語版。相対パス(metadataBase で解決)。
 * subpath を渡すと各ページ版(例 'about')のマップを返す。
 */
export function hreflangAlternates(subpath?: string): Record<string, string> {
  const map: Record<string, string> = { 'x-default': localePath('en', subpath) }
  for (const l of SUPPORTED_LOCALES) map[l] = localePath(l, subpath)
  return map
}
