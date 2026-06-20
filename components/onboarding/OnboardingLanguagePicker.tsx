// components/onboarding/OnboardingLanguagePicker.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { SUPPORTED_LOCALES, LANGUAGE_ENDONYMS, type SupportedLocale } from '@/lib/i18n/config'
import styles from './OnboardingLanguagePicker.module.css'

/**
 * Language chooser shown on the START scene so a first-timer can read the whole
 * tutorial in their own language before committing (a confusing-language
 * tutorial is a drop-off risk). Picking a language calls setLocale, which
 * persists it and re-renders every onboarding caption immediately. Each language
 * is listed in its own script (endonym), so it's findable without reading English.
 */
export function OnboardingLanguagePicker(): ReactElement {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  const pick = (loc: SupportedLocale): void => {
    setLocale(loc)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={styles.root}>
      {open && (
        <ul className={styles.list} role="listbox" aria-label="Tutorial language">
          {SUPPORTED_LOCALES.map((loc) => (
            <li key={loc} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={loc === locale}
                className={styles.option}
                onClick={() => pick(loc)}
              >
                {loc === locale && <span aria-hidden className={styles.check}>✓</span>}
                <span className={styles.optionLabel}>{LANGUAGE_ENDONYMS[loc]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        data-testid="onboarding-language-toggle"
        className={styles.toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          aria-hidden className={styles.globe} width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18" />
        </svg>
        <span className={styles.current}>{LANGUAGE_ENDONYMS[locale]}</span>
        <span aria-hidden className={styles.caret}>▾</span>
      </button>
    </div>
  )
}
