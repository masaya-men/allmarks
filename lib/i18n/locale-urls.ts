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

/** Intro subpaths that have localized (/<locale>/<sub>) versions generated.
 *  Phase B/C extends this as more pages ship. Anything NOT here links flat
 *  (English) to avoid 404s on not-yet-localized pages. */
// 多言語化済みページのみ。404 回避のため、[locale] 経路が全14言語生成済みの
// subpath だけを登録する(navHref が未登録 subpath はフラットに落とす)。
export const LOCALIZED_INTRO_SUBPATHS: ReadonlySet<string> = new Set([
  'about',
  'features',
  'guide',
  'faq',
  'extension',
  'extension/privacy',
  'contact',
  'privacy',
  'terms',
])

/** Header/footer nav href for a subpath: localized when that page exists in
 *  all locales, else flat English. `board` (app route) is never localized. */
export function navHref(locale: SupportedLocale, subpath: string): string {
  return LOCALIZED_INTRO_SUBPATHS.has(subpath) ? localePath(locale, subpath) : `/${subpath}`
}

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
