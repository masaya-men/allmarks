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

/** Why an import was refused before touching any data. */
export type BackupImportFailure =
  /** The backup was written by a newer app version than the one running, so
   *  its row shapes may be forward-incompatible — we can't safely restore it. */
  | 'version-too-new'
  /** The backup contains zero bookmarks. A real export always has at least one;
   *  zero means a corrupt/wrong file, and restoring it would only wipe data. */
  | 'no-bookmarks'
  /** A store carries a row that lacks its primary key (or isn't an object), so
   *  a put() would fail mid-restore. We refuse before clearing anything rather
   *  than half-wipe the store. */
  | 'corrupt-rows'

/** Thrown by {@link importAllStores} when a backup is rejected up front, before
 *  any store is cleared. Catching this lets the UI show a specific reason and
 *  promise the user their current data is untouched. */
export class BackupImportError extends Error {
  readonly reason: BackupImportFailure
  constructor(reason: BackupImportFailure, message: string) {
    super(message)
    this.name = 'BackupImportError'
    this.reason = reason
  }
}

/** Outcome of a successful restore: how many rows landed in each store, and
 *  which stores were left untouched (absent/empty in the dump) BUT still hold
 *  existing rows — i.e. stores where old data survived the restore and the user
 *  should be told it wasn't replaced. Stores that were skipped while already
 *  empty are not listed (nothing changed, nothing stale). */
export interface ImportResult {
  readonly imported: Readonly<Record<string, number>>
  readonly skipped: readonly string[]
}

/** True if `row` can be safely `put()` into a store keyed on `keyPath` — i.e.
 *  it's a non-null object that actually carries the key. Stops a malformed row
 *  from failing a put() *after* the store has already been cleared. */
function rowHasKey(row: unknown, keyPath: string | string[] | null): boolean {
  if (typeof row !== 'object' || row === null) return false
  if (typeof keyPath !== 'string') return true // compound/out-of-line key — accept the object
  const v = (row as Record<string, unknown>)[keyPath]
  return typeof v === 'string' || typeof v === 'number'
}

export async function importAllStores(db: DbLike, json: BackupJson): Promise<ImportResult> {
  // ── Up-front guards (run BEFORE any clear()) so a bad file never destroys
  //    the user's current data. rank3: restore must not break placement. ──
  if (typeof json.version === 'number' && json.version > DB_VERSION) {
    throw new BackupImportError(
      'version-too-new',
      `backup version ${json.version} is newer than app DB version ${DB_VERSION}`,
    )
  }
  const dump = json as unknown as Record<string, ReadonlyArray<unknown> | undefined>
  const bookmarks = dump.bookmarks
  if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
    throw new BackupImportError(
      'no-bookmarks',
      'backup has no bookmarks; refusing to restore (would only wipe data)',
    )
  }

  // Only stores the dump actually carries data for are touched. A store that is
  // absent or an empty array is LEFT UNTOUCHED, so a partial/truncated file can
  // never silently empty an existing store (the rank3 data-loss bug: an empty
  // `cards`/`bookmarks` blob wiping placement).
  const present = presentStores(db)
  const targets = present.filter((name) => {
    const rows = dump[name]
    return Array.isArray(rows) && rows.length > 0
  })
  // Of the untouched stores, only surface the ones that still hold rows: those
  // are where old data survived a restore the user may think was a full replace.
  const skipped: string[] = []
  for (const name of present) {
    if (targets.includes(name)) continue
    if ((await db.count(name)) > 0) skipped.push(name)
  }

  // VALIDATE EVERY ROW FIRST, before any clear(). If any row can't be put back
  // (missing primary key / not an object), refuse the whole restore. Otherwise
  // a put() failing mid-loop would leave a store cleared-but-not-refilled — the
  // exact "restore wiped my data" failure rank3 guards against.
  for (const name of targets) {
    const keyPath = db.transaction(name).store.keyPath
    for (const row of dump[name] as ReadonlyArray<unknown>) {
      if (!rowHasKey(row, keyPath)) {
        throw new BackupImportError(
          'corrupt-rows',
          `backup store "${name}" has a row without its key; refusing to restore`,
        )
      }
    }
  }

  // Replace every target store inside ONE readwrite transaction so the restore
  // is all-or-nothing: if any clear()/put() fails at runtime (e.g. the origin
  // hits its storage quota partway through), we abort the whole transaction and
  // every store rolls back to its pre-restore state. A per-store tx would let an
  // earlier store commit and a later one fail = partial restore that loses
  // placement — the rank3 failure, just reached via a runtime error. We abort
  // explicitly in the catch so a synchronous put() throw (which does NOT auto-
  // abort the tx) also rolls everything back.
  const imported: Record<string, number> = {}
  const tx = db.transaction(targets, 'readwrite')
  try {
    for (const name of targets) {
      const rows = dump[name] as ReadonlyArray<unknown>
      const store = tx.objectStore(name)
      await store.clear()
      for (const row of rows) {
        await store.put(row)
      }
      imported[name] = rows.length
    }
    await tx.done
  } catch (err) {
    try {
      tx.abort()
    } catch {
      // already aborting/aborted — the original error below is what matters
    }
    // Aborting makes tx.done reject (AbortError); swallow it so it doesn't
    // surface as an unhandled rejection. The original `err` is what we report.
    await tx.done.catch(() => {})
    throw err
  }
  return { imported, skipped }
}
