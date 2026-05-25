/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IDBPDatabase } from 'idb'
import { DB_VERSION } from '@/lib/constants'

/** A snapshot of every IDB store relevant to user data.
 *  Versioned by DB_VERSION at export time so import can reject
 *  forward-incompat dumps if needed in the future. */
export interface BackupJson {
  readonly version: number
  readonly exportedAt: string
  readonly bookmarks: ReadonlyArray<unknown>
  readonly tags: ReadonlyArray<unknown>
  readonly cards: ReadonlyArray<unknown>
  readonly folders: ReadonlyArray<unknown>
  readonly settings: ReadonlyArray<unknown>
  readonly preferences: ReadonlyArray<unknown>
}

type DbLike = IDBPDatabase<any>

// Stores we want to back up if they exist. Some are legacy (`moods`, `folders`)
// — historic installs may still carry rows we should preserve. New installs
// won't have legacy stores; we read `db.objectStoreNames` per dump rather than
// assuming a fixed shape, so the backup remains stable across schema bumps.
const KNOWN_STORES = ['bookmarks', 'tags', 'cards', 'folders', 'settings', 'preferences', 'moods'] as const

function presentStores(db: DbLike): string[] {
  const names = Array.from(db.objectStoreNames)
  return KNOWN_STORES.filter((s) => names.includes(s))
}

export async function exportAllStores(db: DbLike): Promise<BackupJson> {
  const stores = presentStores(db)
  const entries = await Promise.all(
    stores.map(async (name) => [name, await db.getAll(name)] as const),
  )
  const byName: Record<string, ReadonlyArray<unknown>> = {}
  for (const [name, rows] of entries) byName[name] = rows
  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks: byName.bookmarks ?? [],
    tags: byName.tags ?? [],
    cards: byName.cards ?? [],
    folders: byName.folders ?? [],
    settings: byName.settings ?? [],
    preferences: byName.preferences ?? [],
  }
}

export async function importAllStores(db: DbLike, json: BackupJson): Promise<void> {
  // Full replace semantics: clear every present store first, then re-insert
  // the dump's rows. Per-store transaction (not one giant tx) because IDB's
  // atomicity rules forbid spanning a clear() + put() across mixed-mode
  // stores in a single tx for some browsers. Per-store tx is fine for our
  // single-user restore flow.
  const dump = json as unknown as Record<string, ReadonlyArray<unknown> | undefined>
  for (const name of presentStores(db)) {
    const tx = db.transaction(name, 'readwrite')
    await tx.store.clear()
    const rows = dump[name] ?? []
    for (const row of rows) {
      await tx.store.put(row)
    }
    await tx.done
  }
}
