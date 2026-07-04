'use client'

import { useCallback, useRef, useState, type ReactElement, type ChangeEvent } from 'react'
import { z } from 'zod'
import { DB_VERSION } from '@/lib/constants'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { initDB } from '@/lib/storage/indexeddb'
import {
  exportAllStores,
  importAllStores,
  BackupImportError,
  type BackupImportFailure,
  type BackupJson,
} from '@/lib/storage/backup'
import { exportBackupFile } from '@/lib/board/export-backup'

/** Shape check for a chosen backup file. Rows themselves stay opaque
 *  (`z.unknown()`) — we never re-validate every bookmark/tag, just that the
 *  file looks like an AllMarks dump (a number `version` + a `bookmarks` array).
 *  Non-bookmark stores default to `[]` so a slightly older dump still imports;
 *  importAllStores then leaves any empty store untouched (rank3). */
const StoreRows = z.array(z.unknown())
const BackupFileSchema = z.object({
  version: z.number(),
  exportedAt: z.string().optional(),
  bookmarks: StoreRows,
  tags: StoreRows.optional().default([]),
  cards: StoreRows.optional().default([]),
  folders: StoreRows.optional().default([]),
  settings: StoreRows.optional().default([]),
  preferences: StoreRows.optional().default([]),
})

/** Maps an importAllStores refusal reason to its message i18n key. */
const FAILURE_KEY: Record<BackupImportFailure, string> = {
  'version-too-new': 'board.backup.versionTooNew',
  'no-bookmarks': 'board.backup.noBookmarks',
  'corrupt-rows': 'board.backup.corruptRows',
}

export interface BackupButtonProps {
  /** Class applied to the EXPORT / IMPORT buttons so the host (the SETTINGS
   *  drawer) can match its own button vocabulary. */
  readonly buttonClassName?: string
}

export function BackupButton({ buttonClassName }: BackupButtonProps = {}): ReactElement {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  const onExport = useCallback(async (): Promise<void> => {
    setBusy('export')
    try {
      const db = await initDB()
      await exportBackupFile(db, new Date().toISOString())
    } catch {
      // Never fail silently — a failed export must tell the user.
      window.alert(t('board.backup.exportFailed'))
    } finally {
      setBusy(null)
    }
  }, [t])

  const onImportClick = useCallback((): void => {
    // Don't let a second import start while an export/import is still running
    // (would launch two concurrent restores over the same DB).
    if (busy !== null) return
    fileInputRef.current?.click()
  }, [busy])

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('import')
    try {
      const text = await file.text()

      // 1) Must be JSON.
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        window.alert(t('board.backup.fileUnreadable'))
        return
      }

      // 2) Must look like an AllMarks backup.
      const parsed = BackupFileSchema.safeParse(raw)
      if (!parsed.success) {
        window.alert(t('board.backup.formatUnrecognized'))
        return
      }
      const json = parsed.data

      // 3) Pre-confirm guards so we only ask "replace your data?" for a file we
      //    can actually restore (rank3 surfaced to the user before any change).
      if (json.bookmarks.length === 0) {
        window.alert(t('board.backup.noBookmarks'))
        return
      }
      if (json.version > DB_VERSION) {
        window.alert(t('board.backup.versionTooNew'))
        return
      }

      const proceed = window.confirm(
        t('board.backup.confirmRestore')
          .replace('{date}', json.exportedAt ?? '?')
          .replace('{version}', String(json.version)),
      )
      if (!proceed) return

      const db = await initDB()
      const result = await importAllStores(db, json as unknown as BackupJson)
      const count = result.imported.bookmarks ?? 0
      let message = t('board.backup.restoreDone').replace('{count}', String(count))
      if (result.skipped.length > 0) message += `\n${t('board.backup.restoreKeptSome')}`
      message += `\n${t('board.backup.reloading')}`
      window.alert(message)
      window.location.reload()
    } catch (err) {
      // Any unexpected failure surfaces, never a silent dead-end.
      if (err instanceof BackupImportError) {
        window.alert(t(FAILURE_KEY[err.reason]))
      } else {
        window.alert(t('board.backup.restoreFailed'))
      }
    } finally {
      setBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [t])

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => { void onExport() }}
        disabled={busy !== null}
        data-testid="backup-export"
      >
        {busy === 'export' ? '...' : 'EXPORT'}
      </button>
      <button
        type="button"
        className={buttonClassName}
        onClick={onImportClick}
        disabled={busy !== null}
        data-testid="backup-import"
      >
        {busy === 'import' ? '...' : 'IMPORT'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => { void onFileChange(e) }}
        data-testid="backup-import-input"
      />
    </>
  )
}
