import { SUPPORTED_LOCALES, type SupportedLocale, detectLocale } from './config'

const STORAGE_KEY = 'allmarks-locale'

/** localStorage に保存された言語を読む（無効値・未保存・localStorage 不可は null）。 */
export function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && (SUPPORTED_LOCALES as readonly string[]).includes(v)) {
      return v as SupportedLocale
    }
  } catch {
    /* localStorage blocked (private mode 等) */
  }
  return null
}

/** 選択言語を localStorage に保存（不可なら黙って無視）。 */
export function persistLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

/** 初期言語: 保存値 → ブラウザ言語 → 英語。 */
export function resolveInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? detectLocale()
}
