import type { SupportedLocale } from '@/lib/i18n/config'

/** アプリ locale → Translator API の BCP-47 言語タグ。
 *  zh のみ簡体字 (zh-Hans) を既定にする。他は primary subtag をそのまま使う。
 *  繁体字 (zh-Hant) のユーザー選択は将来課題 (本実装では簡体字固定)。 */
const TRANSLATOR_LANG_BY_LOCALE: Record<SupportedLocale, string> = {
  ja: 'ja', en: 'en', zh: 'zh-Hans', ko: 'ko',
  es: 'es', fr: 'fr', de: 'de', pt: 'pt', it: 'it',
  nl: 'nl', tr: 'tr', ru: 'ru', ar: 'ar', th: 'th', vi: 'vi',
}

export function localeToTranslatorLang(locale: SupportedLocale): string {
  return TRANSLATOR_LANG_BY_LOCALE[locale]
}
