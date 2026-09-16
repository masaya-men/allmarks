'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './SyncMassDeleteConfirmDialog.module.css'

type Props = {
  readonly count: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function SyncMassDeleteConfirmDialog({ count, onConfirm, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-mass-delete-heading"
      data-testid="sync-mass-delete-dialog"
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="sync-mass-delete-heading" className={styles.heading}>{t('sync.massDeleteHeading')}</div>
        <div className={styles.body}>{t('sync.massDeleteBody').replace('{count}', String(count))}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="sync-mass-delete-cancel">
            {t('share.cancel')}
          </button>
          <button type="button" className={styles.continueBtn} onClick={onConfirm} data-testid="sync-mass-delete-continue">
            {t('sync.massDeleteContinue')}
          </button>
        </div>
      </div>
    </div>
  )
}
