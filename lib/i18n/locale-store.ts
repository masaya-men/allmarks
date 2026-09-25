import { SUPPORTED_LOCALES, type SupportedLocale, detectLocale } from './config'
import { LOCALE_COOKIE_NAME } from './locale-redirect'

const STORAGE_KEY = 'allmarks-locale'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // 1年

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

/** 選択言語を localStorage + cookie に保存（不可なら黙って無視）。
 *  cookie（allmarks_locale）は Cloudflare Pages Function（functions/index.ts 等）が
 *  Accept-Language より優先して読む「明示選択」の記録。英語を選んだ場合も
 *  allmarks_locale=en を書き、日本語ブラウザの訪問者でも英語のまま留まるようにする。 */
export function persistLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure`
  } catch {
    /* ignore */
  }
}

/** 初期言語: 保存値 → ブラウザ言語 → 英語。 */
export function resolveInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? detectLocale()
}
