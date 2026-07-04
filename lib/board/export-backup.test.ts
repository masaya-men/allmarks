import { describe, it, expect, vi } from 'vitest'
import type { IDBPDatabase } from 'idb'
import { exportBackupFile, backupFilename, type Downloader } from './export-backup'
import { loadLastBackupAt } from '@/lib/storage/backup-reminder'

/** Fake db: bookmarks getAll + settings put/get (in-line key). */
function fakeDb(bookmarks: unknown[]): IDBPDatabase<unknown> {
  const settings = new Map<string, unknown>()
  const names = ['bookmarks', 'settings']
  return {
    objectStoreNames: names as unknown as DOMStringList,
    getAll: async (s: string) => (s === 'bookmarks' ? bookmarks : []),
    get: async (_s: string, key: string) => settings.get(key),
    put: async (_s: string, val: { key: string }) => { settings.set(val.key, val) },
  } as unknown as IDBPDatabase<unknown>
}

describe('exportBackupFile', () => {
  it('downloads a json file and records the backup timestamp', async () => {
    const db = fakeDb([{ id: 'b1' }, { id: 'b2' }])
    const download = vi.fn<Downloader>()
    const count = await exportBackupFile(db, '2026-07-04T10:00:00.000Z', download)

    expect(count).toBe(2)
    expect(download).toHaveBeenCalledTimes(1)
    // Branded + dated + HHMM time; exact time is local (TZ-dependent) so match the shape.
    expect(download.mock.calls[0][1]).toMatch(/^AllMarks-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
    // The STORED timestamp stays UTC ISO for correct date math (unchanged).
    expect(await loadLastBackupAt(db)).toBe('2026-07-04T10:00:00.000Z')
  })
})

describe('backupFilename', () => {
  it('is branded, dated, filesystem-safe (no colon), with HHMM time and .json', () => {
    const name = backupFilename('2026-07-04T10:00:00.000Z')
    expect(name).toMatch(/^AllMarks-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
    expect(name).not.toContain(':')
    expect(name.startsWith('AllMarks-backup-')).toBe(true)
    expect(name.endsWith('.json')).toBe(true)
  })
})
