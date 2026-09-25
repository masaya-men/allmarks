import type { IDBPDatabase } from 'idb'
import type { SyncTokens } from './auth'
import type { SyncSnapshot } from './merge'
import type { SyncErrorKind } from './error-kind'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const TOKENS_KEY = 'sync-tokens'

interface SyncTokensRecord extends SyncTokens {
  readonly key: typeof TOKENS_KEY
}

export async function saveSyncTokens(db: DbLike, tokens: SyncTokens): Promise<void> {
  const record: SyncTokensRecord = { key: TOKENS_KEY, ...tokens }
  await db.put('settings', record)
}

export async function loadSyncTokens(db: DbLike): Promise<SyncTokens | null> {
  const record = (await db.get('settings', TOKENS_KEY)) as SyncTokensRecord | undefined
  if (!record) return null
  const { key: _key, ...tokens } = record
  return tokens
}

export async function clearSyncTokens(db: DbLike): Promise<void> {
  await db.delete('settings', TOKENS_KEY)
}

// ── sync-store status ────────────────────────────────────────────────────────

const STATUS_KEY = 'sync-status'
const BASE_SNAPSHOT_KEY = 'sync-base-snapshot'
const BACKUPS_KEY = 'sync-backups'
const MAX_BACKUP_GENERATIONS = 3

export type SyncIssue =
  | { readonly kind: 'needs-confirmation'; readonly deletedCount: number }
  // `detail` is a short (<=200 char) diagnostic string (engine.ts's buildIssueDetail) — which
  // operation + file name + status, e.g. "upload bookmarks.json: status 503". Never shown in the
  // UI (no new copy) and never contains tokens or Drive's raw error response body.
  | { readonly kind: 'error'; readonly errorKind: SyncErrorKind; readonly detail?: string }

/** One timed step of a sync cycle (engine.ts's traceStep), for the on-device diagnostics log
 *  (SyncPanel's "sync.diagnostics" toggle). `name` is a short operation label — e.g. "list",
 *  "download bookmarks.json", "upload bookmarks.json (1.31MB)" — names/sizes/status only, never
 *  tokens, file ids, URLs, or file content. `note` is set only on failure (e.g. "timeout",
 *  "status 503", "network"). */
export interface SyncCycleStepTrace {
  readonly name: string
  readonly ms: number
  readonly ok: boolean
  readonly note?: string
}

/** The most recent sync cycle's step-by-step timeline, replaced wholesale on every cycle
 *  (success or failure — see engine.ts's persistCycleTrace) so it always reflects the LAST
 *  attempt, not an accumulating history. */
export interface SyncCycleTrace {
  readonly startedAt: number
  readonly steps: readonly SyncCycleStepTrace[]
  readonly totalMs: number
}

export interface SyncStatus {
  readonly connected: boolean
  readonly folderId?: string
  readonly headRevisions: Readonly<Record<string, string>>
  readonly lastSyncAt?: number
  readonly connectedEmail?: string
  readonly lastIssue?: SyncIssue
  readonly lastCycleTrace?: SyncCycleTrace
  /** Set (to an increasing counter) whenever this device has a local change that may not be on
   *  Drive yet: every local user write (sync-controller.ts markDirty) and every failed push.
   *  Cleared only by a cycle that completed a full push and saw no newer mark meanwhile
   *  (clearPendingPushIf). While set, the poll's skip-if-unchanged fast path never skips. */
  readonly pendingPush?: number
}

const DEFAULT_SYNC_STATUS: SyncStatus = { connected: false, headRevisions: {} }

interface SyncStatusRecord extends SyncStatus {
  readonly key: typeof STATUS_KEY
}

function stripKey<T extends { key: unknown }>(record: T): Omit<T, 'key'> {
  const { key: _key, ...rest } = record
  return rest
}

export async function loadSyncStatus(db: DbLike): Promise<SyncStatus> {
  const record = (await db.get('settings', STATUS_KEY)) as SyncStatusRecord | undefined
  return record ? stripKey(record) : DEFAULT_SYNC_STATUS
}

export async function updateSyncStatus(db: DbLike, patch: Partial<SyncStatus>): Promise<SyncStatus> {
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const existingRecord = (await store.get(STATUS_KEY)) as SyncStatusRecord | undefined
  const current: SyncStatus = existingRecord ? stripKey(existingRecord) : DEFAULT_SYNC_STATUS
  const next: SyncStatus = {
    ...current,
    ...patch,
    headRevisions: patch.headRevisions ? { ...current.headRevisions, ...patch.headRevisions } : current.headRevisions,
  }
  await store.put({ key: STATUS_KEY, ...next })
  await tx.done
  return next
}

/** Marks "this device has an unpushed local change" (see SyncStatus.pendingPush). Returns the new
 *  marker value. Read-modify-write in one transaction so concurrent marks never collapse. */
export async function markPendingPush(db: DbLike): Promise<number> {
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const existingRecord = (await store.get(STATUS_KEY)) as SyncStatusRecord | undefined
  const current: SyncStatus = existingRecord ? stripKey(existingRecord) : DEFAULT_SYNC_STATUS
  const marker = (current.pendingPush ?? 0) + 1
  await store.put({ key: STATUS_KEY, ...current, pendingPush: marker })
  await tx.done
  return marker
}

/** Clears the pending-push marker only if it still equals `expected` (the value the cycle saw when
 *  it started) — a local write that re-marked it mid-cycle keeps it set for the next cycle. */
export async function clearPendingPushIf(db: DbLike, expected: number | undefined): Promise<void> {
  if (expected === undefined) return
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const existingRecord = (await store.get(STATUS_KEY)) as SyncStatusRecord | undefined
  if (existingRecord && existingRecord.pendingPush === expected) {
    const { pendingPush: _pending, ...rest } = existingRecord
    await store.put(rest)
  }
  await tx.done
}

// ── sync-store base snapshot + backups ────────────────────────────────────────

interface SyncBaseSnapshotRecord {
  readonly key: typeof BASE_SNAPSHOT_KEY
  readonly snapshot: SyncSnapshot
}

export async function saveBaseSnapshot(db: DbLike, snapshot: SyncSnapshot): Promise<void> {
  const record: SyncBaseSnapshotRecord = { key: BASE_SNAPSHOT_KEY, snapshot }
  await db.put('settings', record)
}

export async function loadBaseSnapshot(db: DbLike): Promise<SyncSnapshot | null> {
  const record = (await db.get('settings', BASE_SNAPSHOT_KEY)) as SyncBaseSnapshotRecord | undefined
  return record?.snapshot ?? null
}

export interface BackupGeneration {
  readonly at: number
  readonly snapshot: SyncSnapshot
}

interface SyncBackupsRecord {
  readonly key: typeof BACKUPS_KEY
  readonly generations: readonly BackupGeneration[]
}

export async function pushBackupGeneration(db: DbLike, snapshot: SyncSnapshot): Promise<void> {
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const existing = (await store.get(BACKUPS_KEY)) as SyncBackupsRecord | undefined
  const generations = existing?.generations ?? []
  const next = [{ at: Date.now(), snapshot }, ...generations].slice(0, MAX_BACKUP_GENERATIONS)
  await store.put({ key: BACKUPS_KEY, generations: next })
  await tx.done
}

export async function loadBackupGenerations(db: DbLike): Promise<readonly BackupGeneration[]> {
  const record = (await db.get('settings', BACKUPS_KEY)) as SyncBackupsRecord | undefined
  return record?.generations ?? []
}

// ── sync-store remote file cache (sync format v2) ──────────────────────────────
//
// Device-local copy of the (decompressed) text of every Drive sync file this device last saw, keyed
// by file name, together with the headRevisionId it had. A file whose listed revision still equals
// the cached one is read from here instead of being downloaded again (design §Cycle 2), and the
// poll's skip-check compares the listing against it (§Cycle 5). Never synced and never part of a
// backup (lib/storage/backup.ts DEVICE_LOCAL_SETTINGS_KEYS). `folderId` scopes the cache to the
// Drive folder it came from, so reconnecting to a different account/folder never reuses it.

const REMOTE_CACHE_KEY = 'sync-remote-cache'

export interface RemoteFileCacheEntry {
  readonly rev: string
  readonly text: string
}

export type RemoteFileCache = Readonly<Record<string, RemoteFileCacheEntry>>

interface RemoteCacheRecord {
  readonly key: typeof REMOTE_CACHE_KEY
  readonly folderId: string
  readonly files: RemoteFileCache
}

/** The cache for `folderId`, or {} when there is none (or it belongs to a different folder). */
export async function loadRemoteCache(db: DbLike, folderId: string): Promise<RemoteFileCache> {
  const record = (await db.get('settings', REMOTE_CACHE_KEY)) as RemoteCacheRecord | undefined
  if (!record || record.folderId !== folderId || typeof record.files !== 'object' || record.files === null) return {}
  return record.files
}

/** Replaces the whole cache for `folderId`. */
export async function saveRemoteCache(db: DbLike, folderId: string, files: RemoteFileCache): Promise<void> {
  const record: RemoteCacheRecord = { key: REMOTE_CACHE_KEY, folderId, files }
  await db.put('settings', record)
}

/** Adds/replaces some entries (e.g. right after each successful upload) without touching the rest.
 *  A cache for a different folder is discarded first. */
export async function patchRemoteCache(
  db: DbLike, folderId: string, patch: Readonly<Record<string, RemoteFileCacheEntry | null>>,
): Promise<void> {
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const existing = (await store.get(REMOTE_CACHE_KEY)) as RemoteCacheRecord | undefined
  const base: Record<string, RemoteFileCacheEntry> =
    existing && existing.folderId === folderId && existing.files ? { ...existing.files } : {}
  for (const [name, entry] of Object.entries(patch)) {
    if (entry === null) delete base[name]
    else base[name] = entry
  }
  const record: RemoteCacheRecord = { key: REMOTE_CACHE_KEY, folderId, files: base }
  await store.put(record)
  await tx.done
}
