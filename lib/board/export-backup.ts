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

/** Dump every IDB store to a downloaded JSON file, then record the backup time
 *  so the SETTINGS status line and the periodic reminder stay accurate.
 *  Returns the number of bookmarks exported. Throws on failure (caller alerts). */
export async function exportBackupFile(
  db: DbLike, nowIso: string, download: Downloader = domDownload,
): Promise<number> {
  const dump = await exportAllStores(db)
  const json = JSON.stringify(dump, null, 2)
  download(new Blob([json], { type: 'application/json' }), `allmarks-backup-${nowIso.slice(0, 10)}.json`)
  await recordBackup(db, nowIso)
  return dump.bookmarks.length
}
