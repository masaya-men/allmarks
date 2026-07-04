'use client'

import { type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './BackupReminder.module.css'

export interface BackupReminderProps {
  readonly newCount: number
  readonly everBackedUp: boolean
  readonly onExport: () => void
  readonly onLater: () => void
}

/** Gentle, dismissible periodic nudge. Shown only when the tested gate in
 *  backup-reminder.ts says there is genuinely unbacked value at risk. */
export function BackupReminder({ newCount, everBackedUp, onExport, onLater }: BackupReminderProps): ReactElement {
  const { t } = useI18n()
  const key = everBackedUp ? 'board.backupReminder.body' : 'board.backupReminder.bodyFirst'
  const text = t(key).replace('{n}', String(newCount))
  return (
    <div className={styles.toast} style={{ zIndex: BOARD_Z_INDEX.BACKUP_REMINDER }}
         role="status" data-testid="backup-reminder">
      <p className={styles.body}>{text}</p>
      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onExport}>EXPORT</button>
        <button type="button" className={styles.btn} onClick={onLater}>LATER</button>
      </div>
    </div>
  )
}
