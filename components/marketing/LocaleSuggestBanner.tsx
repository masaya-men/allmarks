'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectLocale, LANGUAGE_ENDONYMS, type SupportedLocale } from '@/lib/i18n/config'
import { localePath } from '@/lib/i18n/locale-urls'
import { readStoredLocale, persistLocale } from '@/lib/i18n/locale-store'
import styles from './LocaleSuggestBanner.module.css'

/**
 * Friendly, non-forcing locale suggestion. When a visitor's browser language
 * differs from the page's language AND they have not yet chosen a language,
 * a slim bar offers their language ("🌐 日本語で見る →"). No content reflow,
 * no redirect — the page stays as-is. Dismiss or choosing records the choice
 * so it never nags again. LP only.
 */
export function LocaleSuggestBanner({ current }: { current: SupportedLocale }): React.ReactElement | null {
  // Server/first paint renders nothing; decide on client mount (no flicker of content).
  const [suggested, setSuggested] = useState<SupportedLocale | null>(null)

  useEffect(() => {
    if (readStoredLocale()) return // already chose a language before
    const browser = detectLocale()
    if (browser !== current) setSuggested(browser)
  }, [current])

  if (!suggested) return null

  const dismiss = (): void => {
    persistLocale(suggested) // recording a value suppresses future nags
    setSuggested(null)
  }

  return (
    <div className={styles.bar} data-testid="locale-suggest" role="region" aria-label="Language suggestion">
      <Link href={localePath(suggested)} className={styles.link} onClick={() => persistLocale(suggested)}>
        <span aria-hidden="true">🌐</span> {LANGUAGE_ENDONYMS[suggested]}
        <span aria-hidden="true"> →</span>
      </Link>
      <button
        type="button"
        data-testid="locale-suggest-dismiss"
        className={styles.close}
        aria-label="Dismiss"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  )
}
