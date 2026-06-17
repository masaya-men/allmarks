'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { SUPPORTED_LOCALES, LANGUAGE_ENDONYMS, type SupportedLocale } from '@/lib/i18n/config'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './LanguageSwitcher.module.css'

/** 右下に置く言語切替。畳=🌐+コード、開=各言語の endonym リスト。 */
export function LanguageSwitcher(): React.ReactElement {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 外側クリックで閉じる（board の InteractionLayer は bubble の mousedown を握り潰すため
  // capture フェーズ pointerdown で判定する。memory: reference_board_outside_click_capture_pointerdown）
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  const pick = useCallback(
    (next: SupportedLocale): void => {
      setLocale(next)
      setOpen(false)
    },
    [setLocale],
  )

  return (
    <div ref={rootRef} className={styles.root} style={{ zIndex: BOARD_Z_INDEX.LANGUAGE_SWITCHER }}>
      {open && (
        <ul className={styles.list} role="listbox" aria-label="Language">
          {SUPPORTED_LOCALES.map((loc) => (
            <li key={loc}>
              <button
                type="button"
                className={styles.option}
                aria-selected={loc === locale}
                onClick={() => pick(loc)}
              >
                {LANGUAGE_ENDONYMS[loc]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        data-testid="language-switcher-toggle"
        className={styles.toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden className={styles.globe}>🌐</span>
        <span className={styles.code}>{locale.toUpperCase()}</span>
      </button>
    </div>
  )
}
