import type { IDBPDatabase } from 'idb'
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import { CONFIG_KEY, loadBoardConfigRecord } from '@/lib/storage/board-config'
import { loadVaultRecord } from '@/lib/private/vault-store'
import { mergeAll, type SyncSnapshot } from './merge'
import { refreshAccessToken, isAccessTokenExpired, SYNC_OAUTH_SCOPE, type SyncTokens } from './auth'
import {
  loadSyncTokens, saveSyncTokens, loadSyncStatus, updateSyncStatus, saveBaseSnapshot, pushBackupGeneration,
} from './sync-store'
import { getDeviceId } from './device-id'
import { DB_VERSION } from '@/lib/constants'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export async function buildLocalSnapshot(db: DbLike): Promise<SyncSnapshot> {
  const [bookmarks, tags, cards, boardConfigRecord, vault] = await Promise.all([
    db.getAll('bookmarks') as Promise<BookmarkRecord[]>,
    db.getAll('tags') as Promise<TagRecord[]>,
    db.getAll('cards') as Promise<CardRecord[]>,
    loadBoardConfigRecord(db),
    loadVaultRecord(db),
  ])
  return {
    bookmarks,
    tags,
    cards,
    boardConfig: boardConfigRecord
      ? { config: boardConfigRecord.config, updatedAt: boardConfigRecord.updatedAt }
      : null,
    vault,
  }
}

// NOTE: never call .clear() here — see Global Constraints. `snapshot` is always
// a superset (by id) of what's already in `db`, so a plain put() per record is
// both sufficient and required to satisfy the "pull never replaces" invariant.
export async function applySnapshotToLocal(db: DbLike, snapshot: SyncSnapshot): Promise<void> {
  const tx = db.transaction(['bookmarks', 'tags', 'cards', 'settings'], 'readwrite')
  const bookmarksStore = tx.objectStore('bookmarks')
  const tagsStore = tx.objectStore('tags')
  const cardsStore = tx.objectStore('cards')
  const settingsStore = tx.objectStore('settings')

  for (const rec of snapshot.bookmarks) await bookmarksStore.put(rec)
  for (const rec of snapshot.tags) await tagsStore.put(rec)
  for (const rec of snapshot.cards) await cardsStore.put(rec)

  if (snapshot.boardConfig) {
    await settingsStore.put({ key: CONFIG_KEY, config: snapshot.boardConfig.config, updatedAt: snapshot.boardConfig.updatedAt })
  }
  if (snapshot.vault) {
    await settingsStore.put(snapshot.vault)
  }
  await tx.done
}

export class SyncNotConnectedError extends Error {
  constructor() {
    super('Sync is not connected (no refresh token stored)')
    this.name = 'SyncNotConnectedError'
  }
}

export async function ensureAccessToken(db: DbLike, now: number = Date.now()): Promise<string> {
  const tokens = await loadSyncTokens(db)
  if (!tokens) throw new SyncNotConnectedError()
  if (!isAccessTokenExpired(tokens.expiresAt, now)) return tokens.accessToken
  if (!tokens.refreshToken) throw new SyncNotConnectedError()
  const refreshed = await refreshAccessToken(tokens.refreshToken)
  const merged: SyncTokens = { ...refreshed, refreshToken: refreshed.refreshToken ?? tokens.refreshToken }
  await saveSyncTokens(db, merged)
  return merged.accessToken
}

export function hasRequiredScopes(grantedScope: string): boolean {
  const granted = new Set(grantedScope.split(' ').filter(Boolean))
  return SYNC_OAUTH_SCOPE.split(' ').every(required => granted.has(required))
}

import {
  findSyncFolder, createSyncFolder, listFolderFiles,
  downloadFileText, getHeadRevisionId, createTextFile, updateTextFile,
} from './drive-adapter'
import {
  parseBookmarksFile, parseTagsFile, parseCardsFile, parseBoardConfigFile, parseVaultFile,
} from './snapshot-schema'

const FILE_NAMES = {
  bookmarks: 'bookmarks.json',
  tags: 'tags.json',
  cards: 'cards.json',
  boardConfig: 'board-config.json',
  vault: 'vault.json',
} as const

export class SyncCorruptDataError extends Error {
  constructor(fileName: string, detail: string) {
    super(`${fileName} failed validation: ${detail}`)
    this.name = 'SyncCorruptDataError'
  }
}

export class SyncConflictError extends Error {
  constructor(fileName: string) {
    super(`${fileName} changed remotely since last pull (optimistic lock)`)
    this.name = 'SyncConflictError'
  }
}

export async function ensureSyncFolder(accessToken: string): Promise<string> {
  const existing = await findSyncFolder(accessToken)
  if (existing) return existing
  return createSyncFolder(accessToken)
}

export async function pullRemoteSnapshot(
  accessToken: string,
  folderId: string,
): Promise<{ snapshot: SyncSnapshot; headRevisions: Record<string, string> }> {
  const files = await listFolderFiles(accessToken, folderId)
  const byName = new Map(files.map(f => [f.name, f]))
  const headRevisions: Record<string, string> = {}

  async function readJsonFile(name: string): Promise<unknown | null> {
    const meta = byName.get(name)
    if (!meta) return null
    const [text, headRevisionId] = await Promise.all([
      downloadFileText(accessToken, meta.id),
      getHeadRevisionId(accessToken, meta.id),
    ])
    headRevisions[name] = headRevisionId
    return JSON.parse(text)
  }

  const [bookmarksJson, tagsJson, cardsJson, boardConfigJson, vaultJson] = await Promise.all([
    readJsonFile(FILE_NAMES.bookmarks),
    readJsonFile(FILE_NAMES.tags),
    readJsonFile(FILE_NAMES.cards),
    readJsonFile(FILE_NAMES.boardConfig),
    readJsonFile(FILE_NAMES.vault),
  ])

  const bookmarksResult = parseBookmarksFile(bookmarksJson ?? [])
  if (!bookmarksResult.ok) throw new SyncCorruptDataError(FILE_NAMES.bookmarks, bookmarksResult.error)
  const tagsResult = parseTagsFile(tagsJson ?? [])
  if (!tagsResult.ok) throw new SyncCorruptDataError(FILE_NAMES.tags, tagsResult.error)
  const cardsResult = parseCardsFile(cardsJson ?? [])
  if (!cardsResult.ok) throw new SyncCorruptDataError(FILE_NAMES.cards, cardsResult.error)
  const boardConfigResult = boardConfigJson === null ? null : parseBoardConfigFile(boardConfigJson)
  if (boardConfigResult && !boardConfigResult.ok) throw new SyncCorruptDataError(FILE_NAMES.boardConfig, boardConfigResult.error)
  const vaultResult = vaultJson === null ? null : parseVaultFile(vaultJson)
  if (vaultResult && !vaultResult.ok) throw new SyncCorruptDataError(FILE_NAMES.vault, vaultResult.error)

  return {
    snapshot: {
      bookmarks: bookmarksResult.value,
      tags: tagsResult.value,
      cards: cardsResult.value,
      boardConfig: boardConfigResult && boardConfigResult.ok ? boardConfigResult.value : null,
      vault: vaultResult && vaultResult.ok ? vaultResult.value : null,
    },
    headRevisions,
  }
}

export async function pushSnapshot(
  accessToken: string,
  folderId: string,
  snapshot: SyncSnapshot,
  previousHeadRevisions: Readonly<Record<string, string>>,
): Promise<Record<string, string>> {
  const files = await listFolderFiles(accessToken, folderId)
  const byName = new Map(files.map(f => [f.name, f]))
  const newRevisions: Record<string, string> = {}

  async function writeJsonFile(name: string, content: unknown): Promise<void> {
    const existing = byName.get(name)
    if (existing) {
      const previous = previousHeadRevisions[name]
      if (previous) {
        const current = await getHeadRevisionId(accessToken, existing.id)
        if (current !== previous) throw new SyncConflictError(name)
      }
      const meta = await updateTextFile(accessToken, existing.id, JSON.stringify(content))
      if (meta.headRevisionId) newRevisions[name] = meta.headRevisionId
    } else {
      const meta = await createTextFile(accessToken, folderId, name, JSON.stringify(content))
      if (meta.headRevisionId) newRevisions[name] = meta.headRevisionId
    }
  }

  await writeJsonFile(FILE_NAMES.bookmarks, snapshot.bookmarks)
  await writeJsonFile(FILE_NAMES.tags, snapshot.tags)
  await writeJsonFile(FILE_NAMES.cards, snapshot.cards)
  if (snapshot.boardConfig) await writeJsonFile(FILE_NAMES.boardConfig, snapshot.boardConfig)
  if (snapshot.vault) await writeJsonFile(FILE_NAMES.vault, snapshot.vault)

  return newRevisions
}

// ── runSyncCycle / connectSync（安全弁付きオーケストレーション・spec §8）───────

const MASS_DELETE_THRESHOLD = 0.25
const MASS_DELETE_MIN_COUNT = 10

function activeCount(bookmarks: readonly { isDeleted?: boolean }[]): number {
  return bookmarks.filter(b => !b.isDeleted).length
}

function vaultRecordsDiffer(a: PrivateVaultRecord, b: PrivateVaultRecord): boolean {
  return (
    a.tagId !== b.tagId ||
    a.salt !== b.salt ||
    a.iterations !== b.iterations ||
    a.publicKey !== b.publicKey ||
    a.wrappedPrivateKey.iv !== b.wrappedPrivateKey.iv ||
    a.wrappedPrivateKey.ciphertext !== b.wrappedPrivateKey.ciphertext
  )
}

export interface SyncCycleResult {
  readonly status: 'not-connected' | 'synced' | 'needs-confirmation' | 'error'
  readonly vaultConflict: boolean
  readonly deletionRatio?: number
  readonly mergedCounts?: { readonly bookmarks: number; readonly tags: number; readonly cards: number }
  readonly errorMessage?: string
}

async function writeManifest(accessToken: string, folderId: string, db: DbLike, snapshot: SyncSnapshot): Promise<void> {
  const deviceId = await getDeviceId(db)
  const manifest = {
    formatVersion: 1,
    appDbVersion: DB_VERSION,
    updatedBy: { deviceId, at: Date.now() },
    counts: { bookmarks: snapshot.bookmarks.length, tags: snapshot.tags.length, cards: snapshot.cards.length },
  }
  const files = await listFolderFiles(accessToken, folderId)
  const existing = files.find(f => f.name === 'manifest.json')
  if (existing) {
    await updateTextFile(accessToken, existing.id, JSON.stringify(manifest))
  } else {
    await createTextFile(accessToken, folderId, 'manifest.json', JSON.stringify(manifest))
  }
}

export async function runSyncCycle(
  db: DbLike,
  opts: { bypassMassDeleteGuard?: boolean } = {},
): Promise<SyncCycleResult> {
  const status = await loadSyncStatus(db)
  if (!status.connected || !status.folderId) {
    return { status: 'not-connected', vaultConflict: false }
  }
  const folderId = status.folderId

  let accessToken: string
  try {
    accessToken = await ensureAccessToken(db)
  } catch (err) {
    return { status: 'error', vaultConflict: false, errorMessage: err instanceof Error ? err.message : 'auth failed' }
  }

  let pulled: Awaited<ReturnType<typeof pullRemoteSnapshot>>
  try {
    pulled = await pullRemoteSnapshot(accessToken, folderId)
  } catch (err) {
    return { status: 'error', vaultConflict: false, errorMessage: err instanceof Error ? err.message : 'pull failed' }
  }

  const local = await buildLocalSnapshot(db)
  let vaultConflict = !!(local.vault && pulled.snapshot.vault && vaultRecordsDiffer(local.vault, pulled.snapshot.vault))
  const merged = mergeAll(local, pulled.snapshot)
  // On conflict, push neither side's vault (null): applySnapshotToLocal/pushSnapshot both skip a
  // null vault entirely, so the local vault stays untouched AND the other device's vault.json on
  // Drive is never overwritten. Whoever's vault "wins" arbitrarily (pickDeterministic) is deferred
  // to a future UI that lets the user choose — not built in this bundle.
  const finalSnapshot: SyncSnapshot = vaultConflict ? { ...merged, vault: null } : merged

  const localActive = activeCount(local.bookmarks)
  const mergedActive = activeCount(finalSnapshot.bookmarks)
  if (!opts.bypassMassDeleteGuard && localActive >= MASS_DELETE_MIN_COUNT) {
    const deletionRatio = (localActive - mergedActive) / localActive
    if (deletionRatio > MASS_DELETE_THRESHOLD) {
      return { status: 'needs-confirmation', vaultConflict, deletionRatio }
    }
  }

  await pushBackupGeneration(db, local)
  await applySnapshotToLocal(db, finalSnapshot)

  let newRevisions: Record<string, string>
  let pushedSnapshot = finalSnapshot
  try {
    newRevisions = await pushSnapshot(accessToken, folderId, finalSnapshot, pulled.headRevisions)
  } catch (err) {
    if (!(err instanceof SyncConflictError)) {
      return { status: 'error', vaultConflict, errorMessage: err instanceof Error ? err.message : 'push failed' }
    }
    // Someone else pushed since our pull. Re-pull, re-merge once, then retry the push —
    // re-running the SAME safety checks as the first attempt (vault conflict, mass-deletion
    // guard), since the retry's re-pull can surface a conflict or deletions the first pull
    // never saw. Wrapped in its own try/catch so a second failure still returns a
    // SyncCycleResult instead of an unhandled rejection.
    let rePulled: Awaited<ReturnType<typeof pullRemoteSnapshot>>
    try {
      rePulled = await pullRemoteSnapshot(accessToken, folderId)
    } catch (err2) {
      return { status: 'error', vaultConflict, errorMessage: err2 instanceof Error ? err2.message : 'pull failed (retry)' }
    }

    const reConflict = vaultConflict || !!(local.vault && rePulled.snapshot.vault && vaultRecordsDiffer(local.vault, rePulled.snapshot.vault))
    const reMerged = mergeAll(finalSnapshot, rePulled.snapshot)
    pushedSnapshot = reConflict ? { ...reMerged, vault: null } : reMerged
    vaultConflict = reConflict

    const reMergedActive = activeCount(pushedSnapshot.bookmarks)
    if (!opts.bypassMassDeleteGuard && localActive >= MASS_DELETE_MIN_COUNT) {
      const reDeletionRatio = (localActive - reMergedActive) / localActive
      if (reDeletionRatio > MASS_DELETE_THRESHOLD) {
        return { status: 'needs-confirmation', vaultConflict, deletionRatio: reDeletionRatio }
      }
    }

    await applySnapshotToLocal(db, pushedSnapshot)
    try {
      newRevisions = await pushSnapshot(accessToken, folderId, pushedSnapshot, rePulled.headRevisions)
    } catch (err3) {
      return { status: 'error', vaultConflict, errorMessage: err3 instanceof Error ? err3.message : 'push failed (retry)' }
    }
  }

  await writeManifest(accessToken, folderId, db, pushedSnapshot)
  await saveBaseSnapshot(db, pushedSnapshot)
  await updateSyncStatus(db, { headRevisions: newRevisions, lastSyncAt: Date.now() })

  return {
    status: 'synced',
    vaultConflict,
    mergedCounts: {
      bookmarks: pushedSnapshot.bookmarks.length,
      tags: pushedSnapshot.tags.length,
      cards: pushedSnapshot.cards.length,
    },
  }
}

export async function connectSync(db: DbLike, tokens: SyncTokens): Promise<SyncCycleResult> {
  await saveSyncTokens(db, tokens)
  const folderId = await ensureSyncFolder(tokens.accessToken)
  await updateSyncStatus(db, { connected: true, folderId })
  return runSyncCycle(db)
}
