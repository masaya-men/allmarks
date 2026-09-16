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
  | { readonly kind: 'error'; readonly errorKind: SyncErrorKind }

export interface SyncStatus {
  readonly connected: boolean
  readonly folderId?: string
  readonly headRevisions: Readonly<Record<string, string>>
  readonly lastSyncAt?: number
  readonly connectedEmail?: string
  readonly lastIssue?: SyncIssue
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
