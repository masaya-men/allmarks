'use client'

import { type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './DataHomeCard.module.css'

export interface DataHomeCardProps {
  /** Records the acknowledgment (timestamp) and hides the card, for good. */
  readonly onDismiss: () => void
}

/** One-time, dry, tutorial-voice notice shown after onboarding: your data is
 *  local to this device; keep a copy with EXPORT. Not a warning, not poetic. */
export function DataHomeCard({ onDismiss }: DataHomeCardProps): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.backdrop} style={{ zIndex: BOARD_Z_INDEX.DATA_HOME }}
         role="dialog" aria-modal="true" aria-label="AllMarks data notice">
      <div className={styles.card}>
        <p className={styles.title}>{t('board.dataHome.title')}</p>
        <p className={styles.body}>{t('board.dataHome.body')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.gotIt} onClick={onDismiss} data-testid="data-home-gotit">
            GOT IT
          </button>
        </div>
      </div>
    </div>
  )
}
