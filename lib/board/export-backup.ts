import type { IDBPDatabase } from 'idb'
import { exportAllStores } from '@/lib/storage/backup'
import { recordBackup } from '@/lib/storage/backup-reminder'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export type Downloader = (blob: Blob, filename: string) => void

/** Default browser download via a temporary object URL (identical to the prior
 *  inline BackupButton logic: one createObjectURL + one revokeObjectURL). */
const domDownload: Downloader = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Human-friendly, filesystem-safe download name using the user's LOCAL wall
 *  clock — so "what time did I make this" matches what the user expects. No ':'
 *  (Windows forbids it in filenames), so the time is HHMM. The stored backup
 *  timestamp stays UTC ISO (via recordBackup) for correct date math; only this
 *  display name is localized. e.g. `AllMarks-backup-2026-07-04-1530.json`. */
export function backupFilename(nowIso: string): string {
  const d = new Date(nowIso)
  const p = (n: number): string => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  const time = `${p(d.getHours())}${p(d.getMinutes())}`
  return `AllMarks-backup-${date}-${time}.json`
}

/** Dump every IDB store to a downloaded JSON file, then record the backup time
 *  so the SETTINGS status line and the periodic reminder stay accurate.
 *  Returns the number of bookmarks exported. Throws on failure (caller alerts). */
export async function exportBackupFile(
  db: DbLike, nowIso: string, download: Downloader = domDownload,
): Promise<number> {
  const dump = await exportAllStores(db)
  const json = JSON.stringify(dump, null, 2)
  download(new Blob([json], { type: 'application/json' }), backupFilename(nowIso))
  await recordBackup(db, nowIso)
  return dump.bookmarks.length
}
