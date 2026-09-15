'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { initDB } from '@/lib/storage/indexeddb'
import { loadLicense } from '@/lib/board/license-store'
import { isSyncUnlocked } from '@/lib/board/theme-entitlement'
import { activateLicenseKey } from '@/lib/board/license-activate'
import styles from './SyncPanel.module.css'

/** Inner content of SETTINGS' "SYNC" section. The section/heading chrome
 *  itself lives in ExtensionEntry.tsx (see that file's comment on why —
 *  CSS Modules scoping + the .group+.group divider rule). This piece only
 *  builds the unlock-key entry point; the actual device-connection flow
 *  (Google sign-in, first sync) is a later task — once unlocked this just
 *  shows a confirmation and a "coming soon" note. */
export function SyncPanel(): ReactElement | null {
  const { t } = useI18n()
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [capExceeded, setCapExceeded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const db = await initDB()
        const state = await loadLicense(db)
        if (!cancelled) setUnlocked(isSyncUnlocked(state))
      } catch (e) {
        console.error('[AllMarks] failed to load sync license state', e)
        if (!cancelled) setUnlocked(false)
      }
    })()
    return (): void => { cancelled = true }
  }, [])

  const submit = async (): Promise<void> => {
    if (submitting) return
    const cleaned = keyInput.replace(/\s+/g, '')
    if (cleaned.length === 0) return
    setSubmitting(true)
    setError(null)
    setCapExceeded(false)
    try {
      const db = await initDB()
      const result = await activateLicenseKey(db, cleaned)
      setSubmitting(false)
      if (result.status === 'unlocked') {
        setUnlocked(true)
        return
      }
      if (result.status === 'invalid-key') setError(t('sync.errorInvalidKey'))
      else if (result.status === 'unsupported') setError(t('sync.errorUnsupported'))
      else if (result.status === 'cap-exceeded') {
        setError(t('sync.errorCapExceeded'))
        setCapExceeded(true)
      }
    } catch (e) {
      console.error('[AllMarks] failed to activate sync license key', e)
      setSubmitting(false)
      setError(t('sync.errorActivateFailed'))
    }
  }

  if (unlocked === null) return null

  if (unlocked) {
    return (
      <div data-testid="sync-unlocked">
        <div className={styles.status}>
          <span className={styles.statusDot} />
          {t('sync.unlockedHeading')}
        </div>
        <p className={styles.note}>{t('sync.connectComingSoon')}</p>
      </div>
    )
  }

  return (
    <div data-testid="sync-locked">
      <p className={styles.body}>{t('sync.lockedExplanation')}</p>
      <span className={styles.soon} aria-disabled="true" data-testid="sync-become-supporter">
        {`${t('sync.becomeSupporter')} (${t('board.settings.comingSoon')})`}
      </span>
      <label className={styles.label} htmlFor="sync-key-input">{t('sync.haveKeyLabel')}</label>
      <div className={styles.keyRow}>
        <input
          id="sync-key-input"
          type="text"
          className={styles.keyInput}
          value={keyInput}
          onChange={(e): void => setKeyInput(e.target.value)}
          placeholder={t('sync.keyPlaceholder')}
          data-testid="sync-key-input"
        />
        <button
          type="button"
          className={styles.unlockBtn}
          onClick={(): void => { void submit() }}
          disabled={submitting || keyInput.trim().length === 0}
          data-testid="sync-key-submit"
        >
          {t('sync.unlockButton')}
        </button>
      </div>
      {error && (
        <div className={styles.error} data-testid="sync-key-error">
          {error}
          {capExceeded && (
            <>
              {' '}
              <a
                className={styles.contactLink}
                href="/contact"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="sync-cap-exceeded-contact"
              >
                {t('sync.errorCapExceededContact')}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  )
}
