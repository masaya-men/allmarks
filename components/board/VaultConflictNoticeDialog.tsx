'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './VaultConflictNoticeDialog.module.css'

type Props = {
  readonly onDismiss: () => void
}

/** Purely informational — the local vault has already been determined (by
 *  lib/private/vault-conflict.ts's isLocalVaultTarget, called from
 *  BoardRoot) to be the deterministic winner of a vault conflict. No action
 *  is needed here; publishing already happened automatically in
 *  lib/sync/engine.ts. This dialog only tells the user what's next. */
export function VaultConflictNoticeDialog({ onDismiss }: Props): ReactElement {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      className={styles.backdrop}
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-conflict-notice-heading"
      data-testid="vault-conflict-notice-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="vault-conflict-notice-heading" className={styles.heading}>{t('private.vaultConflictNoticeHeading')}</div>
        <div className={styles.body}>{t('private.vaultConflictNoticeBody')}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.dismissBtn} onClick={onDismiss} data-testid="vault-conflict-notice-dismiss">
            {t('private.vaultConflictNoticeButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
