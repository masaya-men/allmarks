import type { SupportedLocale } from '@/lib/i18n/config'

/**
 * LandingFonts — the one Google Fonts stylesheet a locale needs, or none.
 *
 * Geist (self-hosted via next/font/google, app/layout.tsx) is loaded with
 * the latin, latin-ext and cyrillic subsets, so every Latin-script locale
 * and `ru` render fully in Geist and need no extra link here. The six
 * locales below use a script Geist doesn't cover; each maps to exactly one
 * Google Fonts CSS2 stylesheet, matched to the `--sans` override for that
 * locale in landing-tokens.css. `th`/`ar` also pull in plain "Noto Sans" as
 * their own fallback for any Latin text mixed into the translation.
 *
 * React 19 hoists a `<link rel="stylesheet" precedence="…">` to <head> and
 * de-duplicates it by href no matter where in the tree it renders, so this
 * can mount straight inside LandingPage's client tree — no next/head, and
 * remounting (e.g. leaving and returning to the LP) never doubles the link.
 */

const NOTO_HREF: Partial<Record<SupportedLocale, string>> = {
  ja: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400..800&display=swap',
  zh: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400..800&display=swap',
  ko: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400..800&display=swap',
  th: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400..800&family=Noto+Sans:wght@400..800&display=swap',
  ar: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400..800&family=Noto+Sans:wght@400..800&display=swap',
  vi: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400..800&display=swap',
}

export function LandingFonts({ locale }: { locale: SupportedLocale }): React.ReactElement | null {
  const href = NOTO_HREF[locale]
  if (href === undefined) return null
  return <link rel="stylesheet" href={href} precedence="default" />
}
