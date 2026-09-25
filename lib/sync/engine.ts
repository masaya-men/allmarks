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
import { withSyncLock } from './sync-lock'
import { notifySyncCycleStarted, notifySyncCycleFinished } from './sync-events'

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
  downloadFileText, getHeadRevisionId, createTextFile, updateTextFile, DriveError, byteLength,
} from './drive-adapter'
import {
  parseBookmarksFile, parseTagsFile, parseCardsFile, parseBoardConfigFile, parseVaultFile,
} from './snapshot-schema'
import type { SyncCycleStepTrace, SyncCycleTrace } from './sync-store'

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
  /** Diagnostic-only summary for sync-status lastIssue.detail: file name plus the pulled vs
   *  just-read head revision ids (short prefixes; revision ids carry no user content). */
  readonly diagnostic: string
  constructor(fileName: string, previous?: string, current?: string) {
    super(`${fileName} changed remotely since last pull (optimistic lock)`)
    this.name = 'SyncConflictError'
    const short = (r: string | undefined): string => (r ? r.slice(0, 10) : 'none')
    this.diagnostic = `${fileName} pulled=${short(previous)} now=${short(current)}`
  }
}

// ── サイクル記録（診断用・sync-status の lastCycleTrace）─────────────────────────
//
// SyncPanel の「同期の記録」トグルに出す、直近1サイクルのステップ別タイムライン。
// iPhone Safari で upload bookmarks.json (~1.3MB) が固まり、sync-lock.ts の排他
// ロックごと後続の同期を巻き添えにした実害の再発を、ユーザー自身の端末で
// 「どのステップで・何秒固まったか」を見えるようにする。ここに積むのは
// 名前・サイズ・成功/失敗・短い失敗理由だけ — トークン/ファイルID/URL/本文は
// 一切載せない。

/** 1ステップぶんの計測。`fn` が投げても記録してから同じ err を再 throw する
 *  （呼び出し側の既存のエラー処理は一切変えない）。 */
async function traceStep<T>(steps: SyncCycleStepTrace[], name: string, fn: () => T | Promise<T>): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    steps.push({ name, ms: Date.now() - start, ok: true })
    return result
  } catch (err) {
    const note = stepErrorNote(err)
    steps.push(note ? { name, ms: Date.now() - start, ok: false, note } : { name, ms: Date.now() - start, ok: false })
    throw err
  }
}

/** 失敗ステップに添える短い理由（診断用のみ）。DriveError.timedOut を最優先で見る —
 *  status は 0 のまま（リトライ可能扱い）だが、原因は「相手が固まった」であって
 *  「fetch 自体が例外を投げた」ではないことをここで区別する。 */
function stepErrorNote(err: unknown): string | undefined {
  if (err instanceof DriveError) {
    if (err.timedOut) return 'timeout'
    return err.status === 0 ? 'network' : `status ${err.status}`
  }
  if (err instanceof SyncConflictError) return 'conflict'
  if (err instanceof Error && err.name) return err.name
  return undefined
}

/** バイト数を "1.31MB" のように短く表示。ステップ名に埋め込む（note ではなく
 *  name 側 — 例 "upload bookmarks.json (1.31MB)"）。 */
function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

/** 1サイクル全体の上限。iPhone Safari の実害（upload が~10分固まり、排他ロック
 *  ごと後続の同期を巻き添えにした）を受けて、これを超えたら in-flight の Drive
 *  リクエストを中断してサイクルを 'network' エラーで失敗させ、ロックを解放する
 *  （sync-lock.ts はサイクルが例外なく終わりさえすれば次を必ず走らせる — 詳細は
 *  sync-lock.ts 冒頭のコメント）。 */
const CYCLE_CEILING_MS = 5 * 60 * 1000

/** サイクル終了時（成功でも失敗でも）に sync-status へ記録を保存する。診断専用の
 *  ベストエフォート — ここが失敗してもサイクル本体の結果（return値/例外）は
 *  絶対に上書きしない。 */
async function persistCycleTrace(db: DbLike, startedAt: number, steps: SyncCycleStepTrace[]): Promise<void> {
  const trace: SyncCycleTrace = { startedAt, steps, totalMs: Date.now() - startedAt }
  try {
    await updateSyncStatus(db, { lastCycleTrace: trace })
  } catch {
    // 診断ログの保存失敗はサイクルの成否に影響させない
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
  // `signal`: this cycle's overall 5-minute ceiling (or a caller/test's own abort), threaded down
  // to every Drive call below so an abort actually interrupts an in-flight request instead of
  // being ignored. `trace`: this cycle's step timeline (sync-status's lastCycleTrace) — steps are
  // pushed into the SAME array the caller holds, so it sees them even if this function throws
  // partway through. Both optional and unused by default so every pre-existing 2-arg call site
  // (tests included) keeps compiling and behaving exactly as before.
  opts: { signal?: AbortSignal; trace?: SyncCycleStepTrace[] } = {},
): Promise<{ snapshot: SyncSnapshot; headRevisions: Record<string, string>; remoteTexts: Record<string, string> }> {
  const { signal, trace = [] } = opts
  const files = await traceStep(trace, 'list', () => listFolderFiles(accessToken, folderId, signal))
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
        traceStep(trace, `download ${name}`, () => downloadFileText(accessToken, meta.id, signal)),
        traceStep(trace, `rev ${name}`, () => getHeadRevisionId(accessToken, meta.id, signal)),
      ])
      headRevisions[name] = headRevisionId
      remoteTexts[name] = text
      return JSON.parse(text)
    } catch (err) {
      // Attach which file this was to the error's diagnostic-only `context` (sync-status's
      // lastIssue.detail, item 5) — never changes `.status`/`.name`, so classifySyncError's
      // behavior is unaffected. `timedOut` is carried through unchanged for the same reason.
      if (err instanceof DriveError && !err.context) throw new DriveError(err.status, err.message, `download ${name}`, err.timedOut)
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
  // See pullRemoteSnapshot's matching `opts` param above for what `signal`/`trace` do and why
  // they're an optional trailing object (backward-compatible with every pre-existing call site).
  opts: { signal?: AbortSignal; trace?: SyncCycleStepTrace[] } = {},
): Promise<Record<string, string>> {
  const { signal, trace = [] } = opts
  const files = await traceStep(trace, 'list', () => listFolderFiles(accessToken, folderId, signal))
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
        const current = await traceStep(trace, `rev ${name}`, () => getHeadRevisionId(accessToken, existing.id, signal))
        if (current !== previous) throw new SyncConflictError(name, previous, current)
        const meta = await traceStep(
          trace, `upload ${name} (${formatSize(byteLength(serialized))})`,
          () => updateTextFile(accessToken, existing.id, serialized, signal),
        )
        if (meta.headRevisionId) newRevisions[name] = meta.headRevisionId
      } else {
        const serialized = JSON.stringify(content)
        const meta = await traceStep(
          trace, `upload ${name} (${formatSize(byteLength(serialized))})`,
          () => createTextFile(accessToken, folderId, name, serialized, signal),
        )
        if (meta.headRevisionId) newRevisions[name] = meta.headRevisionId
      }
    } catch (err) {
      // Diagnostic-only context for sync-status's lastIssue.detail (item 5) — never touches
      // `.status`/`.name`, so classifySyncError and the SyncConflictError branch above are unaffected.
      // `timedOut` is carried through unchanged for the same reason.
      if (err instanceof DriveError && !err.context) throw new DriveError(err.status, err.message, `upload ${name}`, err.timedOut)
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
    err instanceof SyncConflictError ? `${err.name} ${err.diagnostic}` :
    err instanceof Error ? err.name : 'unknown error'
  const detail = `${context}: ${cause}`
  return detail.length > ISSUE_DETAIL_MAX_LEN ? detail.slice(0, ISSUE_DETAIL_MAX_LEN) : detail
}

function activeCount(bookmarks: readonly { isDeleted?: boolean }[]): number {
  return bookmarks.filter(b => !b.isDeleted).length
}

/** Per-record JSON, keyed by id — used by localDataChanged below for an order-independent
 *  content comparison (mergeBookmarks/mergeTags/mergeCards sort their output by id ascending;
 *  IndexedDB's own getAll() on an `id`-keyPath store also returns ascending-by-id, so the two
 *  normally already line up, but comparing by id map is robust even if that ever stopped being
 *  true, at the same cost). */
function recordsById<T extends { id: string }>(rows: readonly T[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of rows) m.set(r.id, JSON.stringify(r))
  return m
}

function sameRecords<T extends { id: string }>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false
  const bJson = recordsById(b)
  for (const rec of a) {
    if (bJson.get(rec.id) !== JSON.stringify(rec)) return false
  }
  return true
}

/** True when `after`'s bookmarks/tags/cards differ from `before`'s — i.e. this cycle wrote data
 *  into local IndexedDB (a pull, a merge outcome) that wasn't there a moment ago, and the board
 *  should re-read IDB to show it. Deliberately scoped to just these 3 stores (per-device
 *  boardConfig and Private's own vault-conflict UI are out of scope for "should the board
 *  reload"). Cheap: one JSON.stringify per record, no deep-equal dependency. */
function localDataChanged(before: SyncSnapshot, after: SyncSnapshot): boolean {
  return (
    !sameRecords(before.bookmarks, after.bookmarks) ||
    !sameRecords(before.tags, after.tags) ||
    !sameRecords(before.cards, after.cards)
  )
}

const TRACKED_FILE_NAMES: readonly string[] = Object.values(FILE_NAMES)

/** Cheap pre-check for a cycle triggered by a timer/visibility poll rather than a real local
 *  write or a manual "Sync now" (opts.skipIfUnchanged, set only by those triggers — see
 *  SyncEngineRunner.tsx): lists the Drive folder (no downloads, no per-file revision calls beyond
 *  what listFolderFiles already returns) and compares each tracked file's headRevisionId against
 *  what the last successful cycle recorded in sync-status. When every one matches, nothing
 *  changed on the other end since we last synced, so the caller can skip pullRemoteSnapshot/
 *  pushSnapshot entirely for this cycle. Callers should treat a thrown error here as "assume
 *  changed" (fall through to the normal full pull, which has its own error handling) rather than
 *  surfacing it directly. */
async function isRemoteUnchanged(
  accessToken: string,
  folderId: string,
  previousHeadRevisions: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<boolean> {
  const files = await listFolderFiles(accessToken, folderId, signal)
  const current: Record<string, string> = {}
  for (const f of files) {
    if (f.headRevisionId && TRACKED_FILE_NAMES.includes(f.name)) current[f.name] = f.headRevisionId
  }
  const keys = new Set([...Object.keys(previousHeadRevisions), ...Object.keys(current)])
  for (const key of keys) {
    if (previousHeadRevisions[key] !== current[key]) return false
  }
  return true
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
  /** True iff this cycle wrote pulled/merged bookmarks/tags/cards data into local IndexedDB that
   *  differs from what was there before the cycle started (see localDataChanged above) — the
   *  signal BoardRoot's useReloadOnSyncChange hook uses to decide whether to re-read IDB. Always
   *  false for a cycle that never reached a successful write (not-connected/license-inactive/
   *  error/needs-confirmation) and for the skipIfUnchanged fast path (nothing was pulled). */
  readonly localChanged: boolean
  readonly deletionRatio?: number
  readonly deletedCount?: number
  readonly mergedCounts?: { readonly bookmarks: number; readonly tags: number; readonly cards: number }
  readonly errorMessage?: string
  readonly errorKind?: import('./error-kind').SyncErrorKind
  readonly licenseReason?: LicenseInactiveReason
}

async function writeManifest(
  accessToken: string, folderId: string, db: DbLike, snapshot: SyncSnapshot, signal?: AbortSignal,
): Promise<void> {
  const deviceId = await getDeviceId(db)
  const manifest = {
    formatVersion: 1,
    appDbVersion: DB_VERSION,
    updatedBy: { deviceId, at: Date.now() },
    counts: { bookmarks: snapshot.bookmarks.length, tags: snapshot.tags.length, cards: snapshot.cards.length },
  }
  const files = await listFolderFiles(accessToken, folderId, signal)
  const existing = files.find(f => f.name === 'manifest.json')
  if (existing) {
    await updateTextFile(accessToken, existing.id, JSON.stringify(manifest), signal)
  } else {
    await createTextFile(accessToken, folderId, 'manifest.json', JSON.stringify(manifest), signal)
  }
}

/**
 * Exported entry point every caller uses (sync-controller.ts's background triggers, connectSync
 * below, and SyncPanel.tsx's manual "Sync now" / mass-delete "continue anyway" buttons). Takes
 * the exclusive sync lock exactly once per call and delegates to `runSyncCycleUnlocked` for the
 * actual cycle — see sync-lock.ts for why this exists (concurrent cycles racing Drive's
 * optimistic lock). `connectSync` below calls this function (never `runSyncCycleUnlocked`
 * directly), so the lock is still taken exactly once for its own first cycle too.
 *
 * This is also the single place that emits sync-events.ts's started/finished signals: started
 * fires the instant the lock is ACQUIRED (before the unlocked body runs), and finished fires in a
 * `finally` right after, so every trigger (background or manual) emits exactly one pair per
 * completed cycle, even one that throws. sync-controller.ts used to call notifySyncCycleFinished()
 * itself after its own flushNow() — that was moved here so a manual "Sync now" cycle (which never
 * went through the controller) emits too, not just background cycles.
 */
export async function runSyncCycle(
  db: DbLike,
  opts: { bypassMassDeleteGuard?: boolean; skipIfUnchanged?: boolean } = {},
): Promise<SyncCycleResult> {
  return withSyncLock(async () => {
    notifySyncCycleStarted()
    let result: SyncCycleResult | undefined
    try {
      result = await runSyncCycleUnlocked(db, opts)
      return result
    } finally {
      // `result` stays undefined only when runSyncCycleUnlocked itself threw (never a documented
      // return path) — notifySyncCycleFinished()'s own default (`{ localChanged: false }`) covers
      // that case, same as the pre-existing bare call did.
      notifySyncCycleFinished(result ? { localChanged: result.localChanged } : undefined)
    }
  })
}

async function runSyncCycleUnlocked(
  db: DbLike,
  opts: { bypassMassDeleteGuard?: boolean; skipIfUnchanged?: boolean } = {},
): Promise<SyncCycleResult> {
  const status = await loadSyncStatus(db)
  if (!status.connected || !status.folderId) {
    return { status: 'not-connected', vaultConflict: false, localChanged: false }
  }
  const folderId = status.folderId

  // Step timeline (sync-status's lastCycleTrace, item 2) + the cycle's overall 5-minute ceiling
  // (item 1): `signal` is threaded down through every Drive call below (pull/push/manifest/vault
  // publish) so the ceiling firing actually aborts an in-flight request instead of being ignored.
  // `persistCycleTrace` runs in the `finally` below so the trace is written on every exit from
  // this point on — success, a normal 'error'/'needs-confirmation' return, or (in principle) an
  // uncaught throw — never just on the happy path. See sync-lock.ts: as long as this function
  // settles (it always does — every branch below returns, never rethrows), the exclusive lock is
  // released for the next queued cycle regardless of how this one ended.
  const trace: SyncCycleStepTrace[] = []
  const cycleStartedAt = Date.now()
  const cycleController = new AbortController()
  const ceilingTimer = setTimeout(() => cycleController.abort(), CYCLE_CEILING_MS)
  const signal = cycleController.signal
  try {
    // License gate (design §3.2): the one entry point every trigger (auto
    // debounce, tab-hide, manual "Sync now") passes through, so this is the
    // only place that needs to enforce it. No Drive calls and no status writes
    // happen below this point when the license isn't allowed to sync.
    const licenseCheck = await traceStep(trace, 'license-check', () => checkLicenseForSync(db))
    if (!licenseCheck.allowed) {
      return { status: 'license-inactive', vaultConflict: false, licenseReason: licenseCheck.reason, localChanged: false }
    }

    let accessToken: string
    try {
      accessToken = await ensureAccessToken(db)
    } catch (err) {
      const errorKind = classifySyncError(err)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('auth', err) } })
      return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'auth failed', localChanged: false }
    }

    // Fast path for a timer/visibility poll (opts.skipIfUnchanged, set only by those triggers —
    // never by a dirty write or manual "Sync now"): if nothing changed on Drive since our last
    // successful cycle, skip the full pull/merge/push below entirely. Any failure here just falls
    // through to the normal full pull, which has its own error handling.
    if (opts.skipIfUnchanged) {
      const unchanged = await traceStep(
        trace, 'skip-check', () => isRemoteUnchanged(accessToken, folderId, status.headRevisions, signal),
      ).catch(() => false)
      if (unchanged) {
        await updateSyncStatus(db, { lastSyncAt: Date.now() })
        return { status: 'synced', vaultConflict: false, localChanged: false }
      }
    }

    let pulled: Awaited<ReturnType<typeof pullRemoteSnapshot>>
    try {
      pulled = await pullRemoteSnapshot(accessToken, folderId, { signal, trace })
    } catch (err) {
      const errorKind = classifySyncError(err)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('pull', err) } })
      return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'pull failed', localChanged: false }
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
        const files = await traceStep(trace, 'list', () => listFolderFiles(accessToken, folderId, signal))
        const existing = files.find((f) => f.name === 'vault.json')
        if (existing) {
          await traceStep(trace, 'vault-publish', () => updateTextFile(accessToken, existing.id, JSON.stringify(local.vault), signal))
        } else {
          await traceStep(trace, 'vault-publish', () => createTextFile(accessToken, folderId, 'vault.json', JSON.stringify(local.vault), signal))
        }
      }
    }
    const merged = await traceStep(trace, 'merge', () => mergeAll(local, pulled.snapshot))
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
        return { status: 'needs-confirmation', vaultConflict, deletionRatio, deletedCount, localChanged: false }
      }
    }

    await pushBackupGeneration(db, local)
    await traceStep(trace, 'apply-local', () => applySnapshotToLocal(db, finalSnapshot))

    let newRevisions: Record<string, string>
    let pushedSnapshot = finalSnapshot
    try {
      newRevisions = await pushSnapshot(accessToken, folderId, finalSnapshot, pulled.headRevisions, pulled.remoteTexts, { signal, trace })
    } catch (err) {
      if (!(err instanceof SyncConflictError)) {
        const errorKind = classifySyncError(err)
        await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('push', err) } })
        return { status: 'error', vaultConflict, errorKind, errorMessage: err instanceof Error ? err.message : 'push failed', localChanged: false }
      }
      // Someone else pushed since our pull. Re-pull, re-merge once, then retry the push —
      // re-running the SAME safety checks as the first attempt (vault conflict, mass-deletion
      // guard), since the retry's re-pull can surface a conflict or deletions the first pull
      // never saw. Wrapped in its own try/catch so a second failure still returns a
      // SyncCycleResult instead of an unhandled rejection.
      let rePulled: Awaited<ReturnType<typeof pullRemoteSnapshot>>
      try {
        rePulled = await pullRemoteSnapshot(accessToken, folderId, { signal, trace })
      } catch (err2) {
        const errorKind = classifySyncError(err2)
        await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('pull (retry)', err2) } })
        return { status: 'error', vaultConflict, errorKind, errorMessage: err2 instanceof Error ? err2.message : 'pull failed (retry)', localChanged: false }
      }

      // Fix I-1: re-read IndexedDB instead of reusing the pre-cycle `local` snapshot. By now
      // applySnapshotToLocal(db, finalSnapshot) already ran once this cycle, and/or the user may
      // have edited something locally during the failed push's round-trip — `local` is stale on
      // both counts. `localNow` already subsumes `finalSnapshot` (it was written to IDB already),
      // so re-deriving from `localNow` alone (not finalSnapshot) is correct and simpler.
      const localNow = await buildLocalSnapshot(db)
      const reConflict = vaultConflict || !!(localNow.vault && rePulled.snapshot.vault && vaultRecordsDiffer(localNow.vault, rePulled.snapshot.vault))
      const reMerged = await traceStep(trace, 'merge', () => mergeAll(localNow, rePulled.snapshot))
      pushedSnapshot = reConflict ? { ...reMerged, vault: null } : reMerged
      vaultConflict = reConflict

      const reMergedActive = activeCount(pushedSnapshot.bookmarks)
      if (!opts.bypassMassDeleteGuard && localActive >= MASS_DELETE_MIN_COUNT) {
        const reDeletionRatio = (localActive - reMergedActive) / localActive
        if (reDeletionRatio > MASS_DELETE_THRESHOLD) {
          const deletedCount = localActive - reMergedActive
          await updateSyncStatus(db, { lastIssue: { kind: 'needs-confirmation', deletedCount } })
          return { status: 'needs-confirmation', vaultConflict, deletionRatio: reDeletionRatio, deletedCount, localChanged: false }
        }
      }

      await traceStep(trace, 'apply-local', () => applySnapshotToLocal(db, pushedSnapshot))
      try {
        newRevisions = await pushSnapshot(accessToken, folderId, pushedSnapshot, rePulled.headRevisions, rePulled.remoteTexts, { signal, trace })
      } catch (err3) {
        const errorKind = classifySyncError(err3)
        await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('push (retry)', err3) } })
        return { status: 'error', vaultConflict, errorKind, errorMessage: err3 instanceof Error ? err3.message : 'push failed (retry)', localChanged: false }
      }
    }

    await traceStep(trace, 'manifest', () => writeManifest(accessToken, folderId, db, pushedSnapshot, signal))
    await saveBaseSnapshot(db, pushedSnapshot)
    await updateSyncStatus(db, { headRevisions: newRevisions, lastSyncAt: Date.now(), lastIssue: undefined })

    return {
      status: 'synced',
      vaultConflict,
      // Compare against the ORIGINAL pre-cycle `local` snapshot (not finalSnapshot, which the retry
      // branch above may have moved on from) — this is "did IDB end this cycle holding data it
      // didn't have at the start", regardless of which attempt produced it.
      localChanged: localDataChanged(local, pushedSnapshot),
      mergedCounts: {
        bookmarks: pushedSnapshot.bookmarks.length,
        tags: pushedSnapshot.tags.length,
        cards: pushedSnapshot.cards.length,
      },
    }
  } finally {
    clearTimeout(ceilingTimer)
    await persistCycleTrace(db, cycleStartedAt, trace)
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
      localChanged: false,
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
    return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'connect failed', localChanged: false }
  }
  return runSyncCycle(db)
}
