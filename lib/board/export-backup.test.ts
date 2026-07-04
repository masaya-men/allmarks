import { describe, it, expect, vi } from 'vitest'
import type { IDBPDatabase } from 'idb'
import { exportBackupFile } from './export-backup'
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
    const download = vi.fn<[Blob, string], void>()
    const count = await exportBackupFile(db, '2026-07-04T10:00:00.000Z', download)

    expect(count).toBe(2)
    expect(download).toHaveBeenCalledTimes(1)
    expect(download.mock.calls[0][1]).toBe('allmarks-backup-2026-07-04.json')
    expect(await loadLastBackupAt(db)).toBe('2026-07-04T10:00:00.000Z')
  })
})
