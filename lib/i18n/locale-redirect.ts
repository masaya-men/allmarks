// lib/i18n/locale-redirect.ts
// Pure decision logic for automatically sending a visitor from an unprefixed
// (English) marketing route to their preferred localized URL. Kept free of
// any Request/Response/Workers types so it can be unit-tested directly and
// reused from both the Cloudflare Pages Function wrappers
// (functions/index.ts, functions/pricing.ts, …) and the client-side locale
// switcher (lib/i18n/locale-store.ts writes the same cookie name).
import { SUPPORTED_LOCALES, type SupportedLocale } from './config'
import { LOCALIZED_INTRO_SUBPATHS, localePath } from './locale-urls'

/** Cookie that remembers an explicit language choice. Set by the site's
 *  language switcher (lib/i18n/locale-store.ts persistLocale) and read here
 *  ahead of Accept-Language — an explicit "English" choice must stick even
 *  for a Japanese-browser visitor. */
export const LOCALE_COOKIE_NAME = 'allmarks_locale'

/** Unprefixed marketing HTML paths eligible for the auto-redirect, mapped to
 *  the subpath `localePath`/`navHref` use ('' = site root). Anything not in
 *  this map (board app, /s/, /api/, /og/, /claim, /activate*, static assets…)
 *  is left alone. Sourced from LOCALIZED_INTRO_SUBPATHS so this list can never
 *  drift from the set of pages that actually have localized versions. */
const REDIRECTABLE_PATHS: ReadonlyMap<string, string> = new Map<string, string>([
  ['/', ''],
  ...Array.from(LOCALIZED_INTRO_SUBPATHS, (sub): [string, string] => [`/${sub}`, sub]),
])

/** Crawlers/previewers must always see the canonical English page (SEO:
 *  English stays what's indexed; hreflang x-default points at it too). */
const BOT_USER_AGENT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|embedly|preview/i

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_USER_AGENT_RE.test(userAgent)
}

interface ParsedLanguageTag {
  readonly primary: string
  readonly q: number
}

/** Parses an `Accept-Language` header into primary-subtag/q-value pairs,
 *  sorted by q descending (ties keep header order — Array#sort is stable).
 *  `*` and malformed segments are ignored. Missing `q` defaults to 1. */
export function parseAcceptLanguage(header: string | null | undefined): readonly ParsedLanguageTag[] {
  if (!header) return []
  const entries: ParsedLanguageTag[] = []
  for (const rawSegment of header.split(',')) {
    const segment = rawSegment.trim()
    if (!segment) continue
    const [tag, ...params] = segment.split(';').map((s) => s.trim())
    if (!tag || tag === '*') continue
    const primary = tag.split('-')[0].toLowerCase()
    if (!primary) continue
    let q = 1
    for (const param of params) {
      const match = /^q=([\d.]+)$/.exec(param)
      if (match) {
        const parsed = Number(match[1])
        if (!Number.isNaN(parsed)) q = parsed
      }
    }
    entries.push({ primary, q })
  }
  return entries.slice().sort((a, b) => b.q - a.q)
}

/** First `Accept-Language` entry (in q-value order) that matches a supported
 *  locale, else null. */
export function pickLocaleFromAcceptLanguage(
  header: string | null | undefined,
): SupportedLocale | null {
  for (const { primary } of parseAcceptLanguage(header)) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
      return primary as SupportedLocale
    }
  }
  return null
}

/** Reads one cookie value out of a raw `Cookie` header, or null. */
function readCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

/** Cookie (explicit past choice) takes precedence over Accept-Language
 *  (browser default). Returns null when neither yields a supported locale. */
export function resolvePreferredLocale(input: {
  readonly cookieHeader: string | null | undefined
  readonly acceptLanguage: string | null | undefined
}): SupportedLocale | null {
  const cookieLocale = readCookieValue(input.cookieHeader, LOCALE_COOKIE_NAME)
  if (cookieLocale && (SUPPORTED_LOCALES as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as SupportedLocale
  }
  return pickLocaleFromAcceptLanguage(input.acceptLanguage)
}

/** Localized target for a redirectable pathname (query string preserved
 *  verbatim), or null when `pathname` isn't one of the auto-redirect
 *  marketing routes. */
export function localizedTarget(
  pathname: string,
  search: string,
  locale: SupportedLocale,
): string | null {
  const subpath = REDIRECTABLE_PATHS.get(pathname)
  if (subpath === undefined) return null
  const target = localePath(locale, subpath || undefined)
  return search ? `${target}${search}` : target
}

export interface RedirectDecisionInput {
  readonly method: string
  readonly pathname: string
  readonly search: string
  readonly cookieHeader: string | null | undefined
  readonly acceptLanguage: string | null | undefined
  readonly userAgent: string | null | undefined
}

/** The full decision: a path to 302 the visitor to, or null to serve the
 *  requested page unchanged. Pure (no fetch/env access) so it is exercised
 *  directly in tests without a Workers runtime. */
export function decideLocaleRedirect(input: RedirectDecisionInput): string | null {
  if (input.method !== 'GET' && input.method !== 'HEAD') return null
  if (isBotUserAgent(input.userAgent)) return null
  // No Accept-Language at all → never redirect (covers curl/bots/odd clients
  // that also fail the UA check above, kept as its own explicit guard).
  if (!input.acceptLanguage) return null

  const locale = resolvePreferredLocale(input)
  if (!locale || locale === 'en') return null

  return localizedTarget(input.pathname, input.search, locale)
}
