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

/**
 * `settings` store keys that identify or authenticate THIS SPECIFIC browser
 * profile rather than holding restorable user content. A full-store
 * export/import (backup/restore) must never carry these across devices or
 * across time — doing so is exactly what caused the SYNC device-list bug
 * this constant exists to fix: repeatedly importing an old backup replaced
 * the device's own `license`/`sync-device-id`/tokens with whatever that
 * backup happened to hold, so the device silently lost track of its own
 * identity and dropped off its own device list.
 *
 * Deliberately NOT included: board-config, theme, onboarding/notice flags,
 * quick-tag/tag-order settings, the migration guard flag, and the private
 * vault's own record (`private-vault`, lib/private/vault-store.ts). The
 * vault record is content-equivalent — it syncs across devices by design
 * (see lib/private/vault-conflict.ts) and must restore together with the
 * encrypted bookmarks it decrypts, so excluding it here would leave a
 * restored backup's Private bookmarks undecryptable.
 */
export const DEVICE_LOCAL_SETTINGS_KEYS = [
  // lib/board/license-store.ts — binds this browser to a K3 license
  // (kid + deviceId). An old value would re-point this device at a
  // stale/foreign deviceId, breaking its own activation and (per the
  // reported bug) making it invisible on its own SYNC device list.
  'license',
  // lib/sync/device-id.ts — this browser profile's own stable id. Its own
  // doc comment already calls it out as "device-local ... Never synced to
  // Drive" — it's the exact value the K3 activation and device list key off.
  'sync-device-id',
  // lib/sync/sync-store.ts — this browser's own Drive OAuth tokens. An old
  // backup's tokens are either stale (useless) or, worse, valid but bound
  // to a different Google account/session than the one in use now.
  'sync-tokens',
  // lib/sync/sync-store.ts — this browser's own sync connection state
  // (connected/folderId/connectedEmail/headRevisions). Tied to which Drive
  // account/folder THIS device is connected to right now; an old value
  // would silently reconnect it to a stale account.
  'sync-status',
  // lib/private/vault-conflict.ts — records of a vault conflict THIS
  // device detected/acknowledged. Device-local detection state (not
  // content): restoring a stale value can either re-surface an
  // already-resolved conflict screen (see that file's "third gap" doc
  // comment on why acknowledgement must be permanent-once-set) or hide a
  // real unresolved one.
  'private-vault-conflict',
  'private-vault-conflict-acknowledged',
  // lib/sync/sync-store.ts — this device's own 3-generation local backup of
  // snapshots it has pushed/applied (pushBackupGeneration/loadBackupGenerations).
  // Bookkeeping for THIS device's own sync history, not restorable user
  // content — and large (~6.6MB observed in a real backup), so carrying it
  // across devices/time is pure waste at best.
  'sync-backups',
  // lib/sync/sync-store.ts — this device's own last-pushed snapshot, used as
  // the 3-way merge base on its NEXT sync cycle (saveBaseSnapshot/
  // loadBaseSnapshot). An old or foreign value here doesn't just go stale —
  // importing another device's base snapshot corrupts this device's next
  // merge (the "base" it diffs against no longer matches what it actually
  // last agreed with Drive on).
  'sync-base-snapshot',
  // lib/sync/sync-store.ts — this device's cache of the Drive sync files it
  // last saw (name → revision + text, sync format v2). Pure download
  // avoidance for THIS device's connection; a restored stale/foreign copy
  // would only be wrong or wasted (and it can be several MB).
  'sync-remote-cache',
] as const

export type DeviceLocalSettingsKey = (typeof DEVICE_LOCAL_SETTINGS_KEYS)[number]

const DEVICE_LOCAL_SETTINGS_KEY_SET: ReadonlySet<string> = new Set(DEVICE_LOCAL_SETTINGS_KEYS)

function settingsRowKey(row: unknown): string | undefined {
  if (typeof row !== 'object' || row === null) return undefined
  const key = (row as { key?: unknown }).key
  return typeof key === 'string' ? key : undefined
}

function isDeviceLocalSettingsRow(row: unknown): boolean {
  const key = settingsRowKey(row)
  return key !== undefined && DEVICE_LOCAL_SETTINGS_KEY_SET.has(key)
}

export async function exportAllStores(db: DbLike): Promise<BackupJson> {
  const stores = presentStores(db)
  const entries = await Promise.all(
    stores.map(async (name) => [name, await db.getAll(name)] as const),
  )
  const byName: Record<string, ReadonlyArray<unknown>> = {}
  for (const [name, rows] of entries) byName[name] = rows
  const settings = (byName.settings ?? []).filter((row) => !isDeviceLocalSettingsRow(row))
  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks: byName.bookmarks ?? [],
    tags: byName.tags ?? [],
    cards: byName.cards ?? [],
    folders: byName.folders ?? [],
    settings,
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
      if (name === 'settings') {
        // Preserve THIS device's own identity/credential rows across the
        // restore (see DEVICE_LOCAL_SETTINGS_KEYS): capture them before
        // clear() wipes the store, skip any same-keyed row the backup itself
        // carries (an older/foreign value — older backups made before this
        // fix may still include one), then put the captured rows back.
        // Reads+writes all happen inside this same transaction, so a later
        // failure still rolls this back along with every other store.
        const preserved: unknown[] = []
        for (const key of DEVICE_LOCAL_SETTINGS_KEYS) {
          const existing = await store.get(key)
          if (existing !== undefined) preserved.push(existing)
        }
        await store.clear()
        let count = 0
        for (const row of rows) {
          if (isDeviceLocalSettingsRow(row)) continue
          await store.put(row)
          count++
        }
        for (const row of preserved) {
          await store.put(row)
        }
        imported[name] = count
      } else {
        await store.clear()
        for (const row of rows) {
          await store.put(row)
        }
        imported[name] = rows.length
      }
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
