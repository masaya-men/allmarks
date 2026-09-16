'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './VaultConflictMergeDialog.module.css'

type Props = {
  readonly onNotNow: () => void
  readonly onConfirm: () => Promise<boolean>
}

/** Shown to the LOSING side of a vault conflict (the one that is NOT the
 *  deterministic target) once it has already unlocked its own Private
 *  normally. onConfirm performs the actual merge (lib/private/
 *  vault-conflict.ts's mergeIntoOtherVault, wired by the caller) using the
 *  session that unlock already produced — no password field here at all,
 *  by design (see this plan's Global Constraints). */
export function VaultConflictMergeDialog({ onNotNow, onConfirm }: Props): ReactElement {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async (): Promise<void> => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const ok = await onConfirm()
    setSubmitting(false)
    if (!ok) {
      setError(t('private.vaultConflictMergeFailed'))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onNotNow() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onNotNow])

  return (
    <div
      className={styles.backdrop}
      onClick={onNotNow}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-conflict-merge-heading"
      data-testid="vault-conflict-merge-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="vault-conflict-merge-heading" className={styles.heading}>{t('private.vaultConflictMergeHeading')}</div>
        <div className={styles.body}>{t('private.vaultConflictMergeBody')}</div>
        {error && <div className={styles.error} data-testid="vault-conflict-merge-error">{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onNotNow} data-testid="vault-conflict-merge-not-now">
            {t('private.vaultConflictMergeNotNow')}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={(): void => { void confirm() }}
            disabled={submitting}
            data-testid="vault-conflict-merge-confirm"
          >
            {t('private.vaultConflictMergeConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
