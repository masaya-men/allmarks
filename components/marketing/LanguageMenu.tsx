'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SUPPORTED_LOCALES, LANGUAGE_ENDONYMS, type SupportedLocale } from '@/lib/i18n/config'
import { localePath } from '@/lib/i18n/locale-urls'
import { persistLocale } from '@/lib/i18n/locale-store'
import styles from './LanguageMenu.module.css'

/**
 * LP header language switcher. Each language is shown by its own endonym so a
 * speaker can find it (中文 / 한국어 …). Selecting navigates to that language's
 * LP URL (en → '/', others → '/<locale>') — each locale is a separate static
 * page, so we navigate rather than runtime-swap. The choice is persisted so the
 * locale-suggest banner won't nag afterward.
 */
export function LanguageMenu({ current }: { current: SupportedLocale }): React.ReactElement {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Outside dismiss — capture-phase pointerdown (matches board chrome pattern).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  const choose = (locale: SupportedLocale): void => {
    setOpen(false)
    if (locale !== current) {
      persistLocale(locale)
      router.push(localePath(locale))
    }
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        data-testid="lang-menu-toggle"
        className={styles.toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Language"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🌐</span> {current.toUpperCase()}
      </button>
      {open && (
        // data-lenis-prevent: let this scrollable list use native wheel scroll
        // instead of the page-wide Lenis smooth scroll (which otherwise swallows
        // the wheel and the dropdown won't scroll). 14+ langs overflow max-height.
        <ul className={styles.list} data-lenis-prevent>
          {SUPPORTED_LOCALES.map((locale) => (
            <li key={locale}>
              <button
                type="button"
                className={styles.item}
                data-current={locale === current}
                aria-current={locale === current ? true : undefined}
                onClick={() => choose(locale)}
              >
                {LANGUAGE_ENDONYMS[locale]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
