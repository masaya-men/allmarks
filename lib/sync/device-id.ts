import type { IDBPDatabase } from 'idb'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

/** settings store key holding this browser profile's stable device id. */
const KEY = 'sync-device-id'

type DeviceIdRecord = { key: string; id: string }

/**
 * Stable, opaque per-device id (= per browser profile). Generated once with
 * crypto.randomUUID() and persisted in the `settings` store; every later call
 * returns the same value. Carries no personal information. Used by the
 * device-sync engine to stamp `updatedBy` on the Drive manifest and to key
 * the K3 activation count. Never synced to Drive (device-local — see design §5).
 * Get-or-create happens within a single readwrite transaction to serialize
 * concurrent calls and ensure only one UUID is ever persisted.
 */
export async function getDeviceId(db: DbLike): Promise<string> {
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const existing = (await store.get(KEY)) as DeviceIdRecord | undefined
  if (existing?.id) {
    await tx.done
    return existing.id
  }
  const id = crypto.randomUUID()
  await store.put({ key: KEY, id } satisfies DeviceIdRecord)
  await tx.done
  return id
}
