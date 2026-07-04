'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { initDB } from '@/lib/storage/indexeddb'
import { loadLastBackupAt, daysSince } from '@/lib/storage/backup-reminder'
import styles from './BackupStatus.module.css'

export interface BackupStatusViewProps {
  readonly lastBackupAt: string | null
  readonly nowMs: number
}

/** Pure presentational line — testable without IDB. */
export function BackupStatusView({ lastBackupAt, nowMs }: BackupStatusViewProps): ReactElement {
  const { t } = useI18n()
  let text: string
  if (lastBackupAt === null) {
    text = t('board.backupStatus.never')
  } else {
    const d = daysSince(nowMs, lastBackupAt)
    text = d === 0 ? t('board.backupStatus.today') : t('board.backupStatus.daysAgo').replace('{days}', String(d))
  }
  return <p className={styles.status} data-testid="backup-status">{text}</p>
}

export interface BackupStatusProps {
  /** Any value that changes when the readout should re-query IDB (e.g. the
   *  drawer opening, or an EXPORT completing). Re-reads on every change so the
   *  "last backup" line updates live instead of only after a page reload. */
  readonly refreshKey?: unknown
}

/** Self-loading container mounted in the SETTINGS drawer. */
export function BackupStatus({ refreshKey }: BackupStatusProps = {}): ReactElement | null {
  const [at, setAt] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const db = await initDB()
        const v = await loadLastBackupAt(db)
        if (alive) setAt(v)
      } catch {
        if (alive) setAt(null)
      }
    })()
    return () => { alive = false }
    // Re-read whenever refreshKey changes; `at` keeps its prior value until the
    // new read resolves, so there is no blank flash on re-read.
  }, [refreshKey])
  if (at === undefined) return null // don't flash before the first read
  return <BackupStatusView lastBackupAt={at} nowMs={Date.now()} />
}
