'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './PrivateShareConfirmDialog.module.css'

type Props = {
  readonly count: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function PrivateShareConfirmDialog({ count, onConfirm, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  // Esc to cancel
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
      aria-labelledby="private-share-confirm-heading"
      data-testid="private-share-confirm-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-share-confirm-heading" className={styles.heading}>{t('private.shareIncludesPrivateHeading')}</div>
        <div className={styles.body}>
          {count === 1
            ? t('private.shareConfirmBodyOne')
            : t('private.shareConfirmBodyMany').replace('{count}', String(count))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-share-confirm-cancel">
            {t('share.cancel')}
          </button>
          <button type="button" className={styles.shareBtn} onClick={onConfirm} data-testid="private-share-confirm-share">
            {t('share.nativeShare')}
          </button>
        </div>
      </div>
    </div>
  )
}
