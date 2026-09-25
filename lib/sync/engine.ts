import type { IDBPDatabase } from 'idb'
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import { CONFIG_KEY, loadBoardConfigRecord } from '@/lib/storage/board-config'
import { loadVaultRecord } from '@/lib/private/vault-store'
import { mergeAll, type SyncSnapshot } from './merge'
import { refreshAccessToken, isAccessTokenExpired, DRIVE_FILE_SCOPE, type SyncTokens } from './auth'
import {
  loadSyncTokens, saveSyncTokens, loadSyncStatus, updateSyncStatus, saveBaseSnapshot, pushBackupGeneration,
} from './sync-store'
import { classifySyncError } from './error-kind'
import { decodeIdTokenEmail } from './id-token'
import { getDeviceId } from './device-id'
import { checkLicenseForSync, type LicenseInactiveReason } from '@/lib/board/license-check'
import { DB_VERSION } from '@/lib/constants'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'
import { saveVaultConflict, isLocalVaultTarget } from '@/lib/private/vault-conflict'

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

// Soft check by design (see DRIVE_FILE_SCOPE doc comment in auth.ts): Google
// sometimes omits `scope` entirely (empty string here trusts the connection
// rather than reject it), and only drive.file is checked since it's the one
// scope sync actually depends on — openid/email/profile are requested but
// decorative, and Google returns them in forms (aliased or normalized to full
// userinfo.* URLs) that don't round-trip through an exact string match.
export function hasRequiredScopes(grantedScope: string): boolean {
  if (!grantedScope) return true
  return grantedScope.split(' ').filter(Boolean).includes(DRIVE_FILE_SCOPE)
}

import {
  findSyncFolder, createSyncFolder, listFolderFiles,
  downloadFileText, getHeadRevisionId, createTextFile, updateTextFile, DriveError,
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
): Promise<{ snapshot: SyncSnapshot; headRevisions: Record<string, string>; remoteTexts: Record<string, string> }> {
  const files = await listFolderFiles(accessToken, folderId)
  const byName = new Map(files.map(f => [f.name, f]))
  const headRevisions: Record<string, string> = {}
  // Raw text as downloaded, keyed by file name — kept alongside the parsed snapshot so
  // pushSnapshot can compare against it later in the SAME cycle and skip re-uploading a file
  // whose content hasn't changed (perf: item 1), without any extra download round-trip.
  const remoteTexts: Record<string, string> = {}

  async function readJsonFile(name: string): Promise<unknown | null> {
    const meta = byName.get(name)
    if (!meta) return null
    try {
      const [text, headRevisionId] = await Promise.all([
        downloadFileText(accessToken, meta.id),
        getHeadRevisionId(accessToken, meta.id),
      ])
      headRevisions[name] = headRevisionId
      remoteTexts[name] = text
      return JSON.parse(text)
    } catch (err) {
      // Attach which file this was to the error's diagnostic-only `context` (sync-status's
      // lastIssue.detail, item 5) — never changes `.status`/`.name`, so classifySyncError's
      // behavior is unaffected.
      if (err instanceof DriveError && !err.context) throw new DriveError(err.status, err.message, `download ${name}`)
      throw err
    }
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
    remoteTexts,
  }
}

export async function pushSnapshot(
  accessToken: string,
  folderId: string,
  snapshot: SyncSnapshot,
  previousHeadRevisions: Readonly<Record<string, string>>,
  // Raw text this device downloaded for each file EARLIER IN THE SAME CYCLE (pullRemoteSnapshot's
  // `remoteTexts`). Optional/defaults to {} so every existing caller (and every pre-existing test)
  // that doesn't pass it keeps behaving exactly as before (always uploads). When a file's
  // serialized content matches this exactly, the content hasn't changed since we downloaded it —
  // skip the upload entirely (no getHeadRevisionId check either, since there's nothing to write)
  // and keep its already-known headRevisionId in newRevisions. Item 1.
  previousRemoteTexts: Readonly<Record<string, string>> = {},
): Promise<Record<string, string>> {
  const files = await listFolderFiles(accessToken, folderId)
  const byName = new Map(files.map(f => [f.name, f]))
  const newRevisions: Record<string, string> = {}

  async function writeJsonFile(name: string, content: unknown): Promise<void> {
    const existing = byName.get(name)
    try {
      if (existing) {
        // Fix I-6: a file that exists on Drive but has no recorded `previous` revision means THIS
        // device never saw it at its own pull time (e.g. another device created it in the gap
        // between this device's pull and this device's push) — treat that as a conflict too,
        // uniformly across all 5 files, instead of silently blind-overwriting it.
        const previous = previousHeadRevisions[name]
        if (!previous) throw new SyncConflictError(name)
        const serialized = JSON.stringify(content)
        if (previousRemoteTexts[name] === serialized) {
          newRevisions[name] = previous
          return
        }
        const current = await getHeadRevisionId(accessToken, existing.id)
        if (current !== previous) throw new SyncConflictError(name)
        const meta = await updateTextFile(accessToken, existing.id, serialized)
        if (meta.headRevisionId) newRevisions[name] = meta.headRevisionId
      } else {
        const meta = await createTextFile(accessToken, folderId, name, JSON.stringify(content))
        if (meta.headRevisionId) newRevisions[name] = meta.headRevisionId
      }
    } catch (err) {
      // Diagnostic-only context for sync-status's lastIssue.detail (item 5) — never touches
      // `.status`/`.name`, so classifySyncError and the SyncConflictError branch above are unaffected.
      if (err instanceof DriveError && !err.context) throw new DriveError(err.status, err.message, `upload ${name}`)
      throw err
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
const ISSUE_DETAIL_MAX_LEN = 200

/** Short diagnostic string for sync-status's lastIssue.detail (item 5) — operation + file name
 *  (when known, from DriveError.context set by pullRemoteSnapshot/pushSnapshot above) + a bare
 *  status code or error name. Deliberately never includes the error's own `.message` — Drive's
 *  error response bodies can echo back file ids/names in free text, and this string is meant to
 *  be safe to keep around indefinitely. Not shown anywhere in the UI (no new copy). Truncated to
 *  200 chars as a hard guarantee even if `fallbackOperation` were ever something longer. */
function buildIssueDetail(fallbackOperation: string, err: unknown): string {
  const context = err instanceof DriveError && err.context ? err.context : fallbackOperation
  const cause =
    err instanceof DriveError ? (err.status === 0 ? 'drive fetch failed' : `status ${err.status}`) :
    err instanceof Error ? err.name : 'unknown error'
  const detail = `${context}: ${cause}`
  return detail.length > ISSUE_DETAIL_MAX_LEN ? detail.slice(0, ISSUE_DETAIL_MAX_LEN) : detail
}

function activeCount(bookmarks: readonly { isDeleted?: boolean }[]): number {
  return bookmarks.filter(b => !b.isDeleted).length
}

/** 「本当に別々の金庫」かどうかだけを見る。publicKey(ECDH鍵ペアの識別子)と
 *  tagIdが両方一致していれば、salt/wrappedPrivateKey等が違っていても
 *  それは同じ金庫のパスワード変更に過ぎない — conflictではなく
 *  mergeVault(merge.ts)のupdatedAt LWWに解決を委ねる。publicKeyが違う場合
 *  だけ、本当に別々に作られた金庫として引き続きconflict扱いする。 */
function vaultRecordsDiffer(a: PrivateVaultRecord, b: PrivateVaultRecord): boolean {
  return a.publicKey !== b.publicKey || a.tagId !== b.tagId
}

export interface SyncCycleResult {
  readonly status: 'not-connected' | 'synced' | 'needs-confirmation' | 'error' | 'license-inactive'
  readonly vaultConflict: boolean
  readonly deletionRatio?: number
  readonly deletedCount?: number
  readonly mergedCounts?: { readonly bookmarks: number; readonly tags: number; readonly cards: number }
  readonly errorMessage?: string
  readonly errorKind?: import('./error-kind').SyncErrorKind
  readonly licenseReason?: LicenseInactiveReason
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

  // License gate (design §3.2): the one entry point every trigger (auto
  // debounce, tab-hide, manual "Sync now") passes through, so this is the
  // only place that needs to enforce it. No Drive calls and no status writes
  // happen below this point when the license isn't allowed to sync.
  const licenseCheck = await checkLicenseForSync(db)
  if (!licenseCheck.allowed) {
    return { status: 'license-inactive', vaultConflict: false, licenseReason: licenseCheck.reason }
  }

  const folderId = status.folderId

  let accessToken: string
  try {
    accessToken = await ensureAccessToken(db)
  } catch (err) {
    const errorKind = classifySyncError(err)
    await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('auth', err) } })
    return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'auth failed' }
  }

  let pulled: Awaited<ReturnType<typeof pullRemoteSnapshot>>
  try {
    pulled = await pullRemoteSnapshot(accessToken, folderId)
  } catch (err) {
    const errorKind = classifySyncError(err)
    await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('pull', err) } })
    return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'pull failed' }
  }

  const local = await buildLocalSnapshot(db)
  let vaultConflict = !!(local.vault && pulled.snapshot.vault && vaultRecordsDiffer(local.vault, pulled.snapshot.vault))
  if (vaultConflict && local.vault && pulled.snapshot.vault) {
    // Persist the other side's full record (not just its public data) so the
    // resolution UI (SETTINGS -> PRIVATE) can act on it later, and so the
    // deterministic tie-break below and mergeIntoOtherVault (lib/private/
    // vault-conflict.ts, called from the UI layer, not here) have what they need.
    await saveVaultConflict(db, pulled.snapshot.vault)
    // If the LOCAL vault is the deterministic winner, publish it to Drive right
    // now, unconditionally — bypassing the "skip vault.json during a conflict"
    // rule below. This never needs a password (publishing only ever needs the
    // vault's public data, which is always available unlocked-or-not), and it
    // must not wait for the user to do anything: the losing device's merge
    // action (Task 5's mergeIntoOtherVault, wired in Task 8) needs vault.json
    // to already reflect the winner BEFORE it retires its own vault, or a
    // later sync could resurrect stale content. Uses the same
    // create-or-update pattern as writeManifest below, not the normal
    // pushSnapshot/optimistic-lock path (deliberately: this write must happen
    // even though vaultConflict is about to force finalSnapshot.vault to null).
    if (isLocalVaultTarget(local.vault, pulled.snapshot.vault)) {
      const files = await listFolderFiles(accessToken, folderId)
      const existing = files.find((f) => f.name === 'vault.json')
      if (existing) {
        await updateTextFile(accessToken, existing.id, JSON.stringify(local.vault))
      } else {
        await createTextFile(accessToken, folderId, 'vault.json', JSON.stringify(local.vault))
      }
    }
  }
  const merged = mergeAll(local, pulled.snapshot)
  // On conflict, push neither side's vault via the NORMAL path (null): applySnapshotToLocal/
  // pushSnapshot both skip a null vault entirely, so the local vault stays untouched here. The
  // winning side's vault.json is instead published directly above, unconditionally, the moment
  // the conflict is first detected — see the block above for why.
  const finalSnapshot: SyncSnapshot = vaultConflict ? { ...merged, vault: null } : merged

  const localActive = activeCount(local.bookmarks)
  const mergedActive = activeCount(finalSnapshot.bookmarks)
  if (!opts.bypassMassDeleteGuard && localActive >= MASS_DELETE_MIN_COUNT) {
    const deletionRatio = (localActive - mergedActive) / localActive
    if (deletionRatio > MASS_DELETE_THRESHOLD) {
      const deletedCount = localActive - mergedActive
      await updateSyncStatus(db, { lastIssue: { kind: 'needs-confirmation', deletedCount } })
      return { status: 'needs-confirmation', vaultConflict, deletionRatio, deletedCount }
    }
  }

  await pushBackupGeneration(db, local)
  await applySnapshotToLocal(db, finalSnapshot)

  let newRevisions: Record<string, string>
  let pushedSnapshot = finalSnapshot
  try {
    newRevisions = await pushSnapshot(accessToken, folderId, finalSnapshot, pulled.headRevisions, pulled.remoteTexts)
  } catch (err) {
    if (!(err instanceof SyncConflictError)) {
      const errorKind = classifySyncError(err)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('push', err) } })
      return { status: 'error', vaultConflict, errorKind, errorMessage: err instanceof Error ? err.message : 'push failed' }
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
      const errorKind = classifySyncError(err2)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('pull (retry)', err2) } })
      return { status: 'error', vaultConflict, errorKind, errorMessage: err2 instanceof Error ? err2.message : 'pull failed (retry)' }
    }

    // Fix I-1: re-read IndexedDB instead of reusing the pre-cycle `local` snapshot. By now
    // applySnapshotToLocal(db, finalSnapshot) already ran once this cycle, and/or the user may
    // have edited something locally during the failed push's round-trip — `local` is stale on
    // both counts. `localNow` already subsumes `finalSnapshot` (it was written to IDB already),
    // so re-deriving from `localNow` alone (not finalSnapshot) is correct and simpler.
    const localNow = await buildLocalSnapshot(db)
    const reConflict = vaultConflict || !!(localNow.vault && rePulled.snapshot.vault && vaultRecordsDiffer(localNow.vault, rePulled.snapshot.vault))
    const reMerged = mergeAll(localNow, rePulled.snapshot)
    pushedSnapshot = reConflict ? { ...reMerged, vault: null } : reMerged
    vaultConflict = reConflict

    const reMergedActive = activeCount(pushedSnapshot.bookmarks)
    if (!opts.bypassMassDeleteGuard && localActive >= MASS_DELETE_MIN_COUNT) {
      const reDeletionRatio = (localActive - reMergedActive) / localActive
      if (reDeletionRatio > MASS_DELETE_THRESHOLD) {
        const deletedCount = localActive - reMergedActive
        await updateSyncStatus(db, { lastIssue: { kind: 'needs-confirmation', deletedCount } })
        return { status: 'needs-confirmation', vaultConflict, deletionRatio: reDeletionRatio, deletedCount }
      }
    }

    await applySnapshotToLocal(db, pushedSnapshot)
    try {
      newRevisions = await pushSnapshot(accessToken, folderId, pushedSnapshot, rePulled.headRevisions, rePulled.remoteTexts)
    } catch (err3) {
      const errorKind = classifySyncError(err3)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('push (retry)', err3) } })
      return { status: 'error', vaultConflict, errorKind, errorMessage: err3 instanceof Error ? err3.message : 'push failed (retry)' }
    }
  }

  await writeManifest(accessToken, folderId, db, pushedSnapshot)
  await saveBaseSnapshot(db, pushedSnapshot)
  await updateSyncStatus(db, { headRevisions: newRevisions, lastSyncAt: Date.now(), lastIssue: undefined })

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
  // Fix I-2: reject a partial-consent connection (missing scope) up front, before touching
  // tokens/Drive at all. hasRequiredScopes was built in an earlier task but never called anywhere
  // — this is the one place holding tokens.scope, and the natural place to enforce it.
  if (!hasRequiredScopes(tokens.scope)) {
    return {
      status: 'error',
      vaultConflict: false,
      errorKind: 'auth',
      errorMessage: 'Missing required Google Drive permission. Please reconnect and grant all requested permissions.',
    }
  }
  // Fix I-2: every other path in this module returns Promise<SyncCycleResult> and never rejects.
  // connectSync used to be the one exception (no try/catch around ensureSyncFolder/updateSyncStatus),
  // so a Drive error (403, network failure, partial OAuth consent) propagated as an unhandled
  // rejection instead of the documented contract.
  try {
    await saveSyncTokens(db, tokens)
    const folderId = await ensureSyncFolder(tokens.accessToken)
    const connectedEmail = tokens.idToken ? decodeIdTokenEmail(tokens.idToken) ?? undefined : undefined
    await updateSyncStatus(db, { connected: true, folderId, connectedEmail })
  } catch (err) {
    const errorKind = classifySyncError(err)
    return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'connect failed' }
  }
  return runSyncCycle(db)
}
