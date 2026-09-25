import type { IDBPDatabase } from 'idb'
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import { CONFIG_KEY, loadBoardConfigRecord } from '@/lib/storage/board-config'
import { loadVaultRecord } from '@/lib/private/vault-store'
import { mergeAll, type SyncSnapshot } from './merge'
import { refreshAccessToken, isAccessTokenExpired, DRIVE_FILE_SCOPE, type SyncTokens } from './auth'
import {
  loadSyncTokens, saveSyncTokens, loadSyncStatus, updateSyncStatus, saveBaseSnapshot, pushBackupGeneration,
  loadRemoteCache, saveRemoteCache, patchRemoteCache, markPendingPush, clearPendingPushIf,
  type RemoteFileCache, type RemoteFileCacheEntry,
} from './sync-store'
import { classifySyncError } from './error-kind'
import { decodeIdTokenEmail } from './id-token'
import { checkLicenseForSync, type LicenseInactiveReason } from '@/lib/board/license-check'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'
import { saveVaultConflict, isLocalVaultTarget } from '@/lib/private/vault-conflict'
import { withSyncLock } from './sync-lock'
import { withSyncWritesSuppressed } from './sync-signal'
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
  downloadFileText, downloadFileBytes, getHeadRevisionId,
  createTextFile, updateTextFile, createBinaryFile, updateBinaryFile,
  deleteFile, DriveError, SYNC_GZIP_MIME, type DriveFileMeta,
} from './drive-adapter'
import {
  parseBookmarksFile, parseTagsFile, parseCardsFile, parseBoardConfigFile, parseVaultFile,
} from './snapshot-schema'
import type { SyncCycleStepTrace, SyncCycleTrace } from './sync-store'
import { getGzipCodec, looksGzipped, type GzipCodec } from './gzip-codec'
import {
  MANIFEST_FILE_NAME, SYNC_FORMAT_VERSION, V1_KEYS,
  parseV2FileName, v1KeyForName, parseManifest, sameMigratedFromV1, inferShardCount, planShardCount,
  shardFileName, singleFileName, shardIndexFor,
  type ManifestV2, type MigratedFromV1, type V1Key,
} from './sync-layout'

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

/** バイト数を短く表示。ステップ名に埋め込む（note ではなく name 側 — 例
 *  "upload bookmarks-3.json.gz (4.2KB)"、1MB 以上は "upload x (1.31MB)"）。 */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
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

// ── 同期形式 v2（docs/superpowers/specs/2026-09-25-sync-format-v2-design.md）──────
//
// Drive 上は manifest.json + bookmarks-<k>/cards-<k> のシャード + tags/board-config/vault を
// gzip した小さなファイル群。1 サイクルでは「一覧 1 回 → 変わったファイルだけ取得 →
// マージ（従来どおり）→ 変わったファイルだけ送信」。取得済みファイルの本文は端末ローカルの
// sync-remote-cache に headRevisionId と一緒に保存し、同じリビジョンなら再ダウンロードしない。
// v1（bookmarks.json 等 5 ファイル）は移行元として読むだけで、決して書き換えも削除もしない。

const EMPTY_SNAPSHOT: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }

/** 同時に走らせる Drive リクエスト数（ダウンロード / アップロードそれぞれ）。 */
const READ_CONCURRENCY = 6
const WRITE_CONCURRENCY = 4

/** The browser can't gzip (no CompressionStream/DecompressionStream). Sync format v2 needs it, so
 *  the cycle fails before touching Drive; classified 'other' by error-kind.ts (generic retry copy). */
export class SyncUnsupportedError extends Error {
  constructor() {
    super('This browser cannot compress sync files (CompressionStream is unavailable)')
    this.name = 'SyncUnsupportedError'
  }
}

function requireCodec(codec: GzipCodec | null | undefined): GzipCodec {
  const resolved = codec === undefined ? getGzipCodec() : codec
  if (!resolved) throw new SyncUnsupportedError()
  return resolved
}

/** items を最大 limit 並列で処理する。どれかが失敗したら新しい処理は始めず、走っている
 *  ものが終わるのを待ってから最初のエラーを投げる。 */
async function runPool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  let failed = false
  let firstError: unknown
  async function worker(): Promise<void> {
    while (!failed && next < items.length) {
      const item = items[next++]
      try {
        await fn(item)
      } catch (err) {
        if (!failed) {
          failed = true
          firstError = err
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  if (failed) throw firstError
}

/**
 * Canonical JSON: object keys sorted recursively, `undefined`/function members dropped exactly
 * like JSON.stringify. Every sync file is written with this so the same data always produces the
 * same text on every device — rows created locally keep the app's key order while rows read back
 * from Drive come out of zod in schema order, and plain JSON.stringify would make two devices'
 * texts differ forever (endless re-uploads).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  const withToJson = value as { toJSON?: unknown }
  if (typeof withToJson.toJSON === 'function') return canonicalJson((withToJson.toJSON as () => unknown).call(value))
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined || typeof v === 'function' || typeof v === 'symbol' ? 'null' : canonicalJson(v))).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const parts: string[] = []
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key]
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue
    parts.push(`${JSON.stringify(key)}:${canonicalJson(v)}`)
  }
  return `{${parts.join(',')}}`
}

// ── Duplicate same-name files ────────────────────────────────────────────────
// Drive allows two files with the same name in a folder (e.g. two devices creating the same shard
// at the same moment). Every place picks the same "primary" copy: the smallest file id. Only the
// primary is written/cached under its plain name; every other copy is still read (cached under
// `name#id`) and folded into the merge so no row is lost, and v2 duplicates are deleted after a
// successful push. v1-named duplicates are never deleted (v1 files are never modified).

interface ListingIndex {
  /** name → primary copy (smallest id). */
  readonly primary: ReadonlyMap<string, DriveFileMeta>
  /** Every non-primary copy. */
  readonly duplicates: readonly DriveFileMeta[]
}

function indexListing(files: readonly DriveFileMeta[]): ListingIndex {
  const primary = new Map<string, DriveFileMeta>()
  const duplicates: DriveFileMeta[] = []
  const sorted = [...files].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  for (const f of sorted) {
    if (primary.has(f.name)) duplicates.push(f)
    else primary.set(f.name, f)
  }
  return { primary, duplicates }
}

/** Cache key: the plain name for the primary copy, `name#id` for a duplicate. */
function cacheKeyFor(meta: DriveFileMeta, index: ListingIndex): string {
  return index.primary.get(meta.name)?.id === meta.id ? meta.name : `${meta.name}#${meta.id}`
}

/** v1 の名前を持つ primary ファイルをこのサイクルで読む必要があるか。
 *  - manifest が v2 でない（未作成 / 古いタブが v1 で上書きした）→ 全部読む（移行）
 *  - v2 manifest の migratedFromV1 に記録したリビジョンと違う（古いタブが書いた）→ 読んで取り込む */
function shouldReadV1Named(meta: DriveFileMeta, key: V1Key, manifest: ManifestV2 | null, isV2: boolean): boolean {
  if (!isV2) return true
  if (!meta.headRevisionId) return true
  return meta.headRevisionId !== manifest?.migratedFromV1?.[key]
}

function isV2Manifest(manifest: ManifestV2 | null): boolean {
  return !!manifest && manifest.formatVersion >= SYNC_FORMAT_VERSION
}

/** 一覧のうち、このサイクルで読む（キャッシュ or ダウンロード）データファイル（manifest 以外）。
 *  Duplicate copies are always read (cheap: cached under `name#id`). */
function planReads(index: ListingIndex, manifest: ManifestV2 | null): DriveFileMeta[] {
  const isV2 = isV2Manifest(manifest)
  const out: DriveFileMeta[] = []
  for (const meta of index.primary.values()) {
    const v1Key = v1KeyForName(meta.name)
    if (v1Key) {
      if (shouldReadV1Named(meta, v1Key, manifest, isV2)) out.push(meta)
    } else if (parseV2FileName(meta.name)) {
      out.push(meta)
    }
  }
  for (const meta of index.duplicates) {
    if (v1KeyForName(meta.name) || parseV2FileName(meta.name)) out.push(meta)
  }
  return out
}

export interface PulledRemote {
  /** v2 のシャード群（+ 必要なら v1 ファイル）を組み立てたリモートのスナップショット。 */
  readonly snapshot: SyncSnapshot
  /** このサイクルで読んだ primary ファイル（manifest 含む）の名前 → headRevisionId。 */
  readonly headRevisions: Record<string, string>
  /** このサイクルで読んだ primary ファイルの（展開済み）本文。push の「内容が同じなら送らない」比較用。 */
  readonly remoteTexts: Record<string, string>
  /** 次の sync-remote-cache（このサイクルで読んだ = いま一覧にあるファイルだけ）。 */
  readonly cache: Record<string, RemoteFileCacheEntry>
  /** 解釈できた manifest（無い / 壊れていれば null）。 */
  readonly manifest: ManifestV2 | null
  /** manifest が formatVersion 2 以上か。false なら今回の push で v2 へ移行する。 */
  readonly isV2: boolean
  /** 書き込みに使うシャード数（manifest の値と、実在するシャード名から推定した値の大きい方）。 */
  readonly shardCount: number
  /** このサイクルで読んだ v1 ファイル（primary）のリビジョン（manifest の migratedFromV1 に記録する）。 */
  readonly v1RevisionsRead: MigratedFromV1
  /** Non-primary copies of v2 files / the manifest — deleted after a successful push. */
  readonly v2Duplicates: readonly DriveFileMeta[]
}

function parseJsonText(name: string, text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new SyncCorruptDataError(name, 'not valid JSON')
  }
}

/** 1 ファイル分の中身を部分スナップショットにする（zod 検証つき）。 */
function partialSnapshotFor(name: string, kind: 'bookmarks' | 'cards' | 'tags' | 'boardConfig' | 'vault', json: unknown): SyncSnapshot {
  switch (kind) {
    case 'bookmarks': {
      const r = parseBookmarksFile(json)
      if (!r.ok) throw new SyncCorruptDataError(name, r.error)
      return { ...EMPTY_SNAPSHOT, bookmarks: r.value }
    }
    case 'cards': {
      const r = parseCardsFile(json)
      if (!r.ok) throw new SyncCorruptDataError(name, r.error)
      return { ...EMPTY_SNAPSHOT, cards: r.value }
    }
    case 'tags': {
      const r = parseTagsFile(json)
      if (!r.ok) throw new SyncCorruptDataError(name, r.error)
      return { ...EMPTY_SNAPSHOT, tags: r.value }
    }
    case 'boardConfig': {
      const r = parseBoardConfigFile(json)
      if (!r.ok) throw new SyncCorruptDataError(name, r.error)
      return { ...EMPTY_SNAPSHOT, boardConfig: r.value }
    }
    case 'vault': {
      const r = parseVaultFile(json)
      if (!r.ok) throw new SyncCorruptDataError(name, r.error)
      return { ...EMPTY_SNAPSHOT, vault: r.value }
    }
  }
}

async function decodeGzipBytes(name: string, bytes: Uint8Array, codec: GzipCodec): Promise<string> {
  if (!looksGzipped(bytes)) return new TextDecoder().decode(bytes)
  try {
    return await codec.decompress(bytes)
  } catch {
    throw new SyncCorruptDataError(name, 'gzip data could not be decompressed')
  }
}

/**
 * Cycle step 1–2 (design §Cycle): one listing (paginated), then for every file this cycle needs
 * — the manifest, every v2 file, and v1 files only when migrating or when a stale v1 tab changed
 * one since it was migrated — use the device-local cached text when the listed headRevisionId
 * equals the cached one, otherwise download (+ gunzip). Every source is validated and folded
 * together with mergeAll (shards are disjoint, so for the normal single-copy folder this is just
 * their union — merge semantics against local are unchanged).
 */
export async function pullRemoteSnapshot(
  accessToken: string,
  folderId: string,
  // `signal`: this cycle's overall 5-minute ceiling (or a caller/test's own abort), threaded down
  // to every Drive call below. `trace`: this cycle's step timeline (sync-status's lastCycleTrace),
  // pushed into the SAME array the caller holds. `cache`: sync-remote-cache as loaded by the caller
  // (defaults to empty = download everything). `codec`: gzip codec (defaults to getGzipCodec();
  // none available → SyncUnsupportedError before any Drive call).
  opts: { signal?: AbortSignal; trace?: SyncCycleStepTrace[]; cache?: RemoteFileCache; codec?: GzipCodec | null } = {},
): Promise<PulledRemote> {
  const { signal, trace = [], cache = {} } = opts
  const codec = requireCodec(opts.codec)
  const files = await traceStep(trace, 'list', () => listFolderFiles(accessToken, folderId, signal))
  const index = indexListing(files)
  const headRevisions: Record<string, string> = {}
  const remoteTexts: Record<string, string> = {}
  const nextCache: Record<string, RemoteFileCacheEntry> = {}

  async function readText(meta: DriveFileMeta): Promise<string> {
    const name = meta.name
    const key = cacheKeyFor(meta, index)
    const listedRev = meta.headRevisionId
    const cached = listedRev ? cache[key] : undefined
    let text: string
    let rev: string
    try {
      if (cached && cached.rev === listedRev && typeof cached.text === 'string') {
        text = cached.text
        rev = cached.rev
      } else {
        const download = name.endsWith('.gz')
          ? traceStep(trace, `download ${name}`, () => downloadFileBytes(accessToken, meta.id, signal))
            .then((bytes) => decodeGzipBytes(name, bytes, codec))
          : traceStep(trace, `download ${name}`, () => downloadFileText(accessToken, meta.id, signal))
        const revision = listedRev
          ? Promise.resolve(listedRev)
          : traceStep(trace, `rev ${name}`, () => getHeadRevisionId(accessToken, meta.id, signal))
        ;[text, rev] = await Promise.all([download, revision])
      }
    } catch (err) {
      // Attach which file this was to the error's diagnostic-only `context` (sync-status's
      // lastIssue.detail) — never changes `.status`/`.name`, so classifySyncError is unaffected.
      if (err instanceof DriveError && !err.context) throw new DriveError(err.status, err.message, `download ${name}`, err.timedOut)
      throw err
    }
    nextCache[key] = { rev, text }
    if (key === name) {
      headRevisions[name] = rev
      remoteTexts[name] = text
    }
    return text
  }

  // Manifest first: it decides whether v1 files are read (migration / stale-tab writes).
  const manifestMeta = index.primary.get(MANIFEST_FILE_NAME)
  let manifest: ManifestV2 | null = null
  if (manifestMeta) {
    const text = await readText(manifestMeta)
    try {
      manifest = parseManifest(JSON.parse(text))
    } catch {
      manifest = null // unreadable manifest = treat as missing (the next push rewrites it)
    }
  }
  const isV2 = isV2Manifest(manifest)
  const toRead = planReads(index, manifest)

  const partials = new Map<string, SyncSnapshot>()
  const v1RevisionsRead: MigratedFromV1 = {}
  await runPool(toRead, READ_CONCURRENCY, async (meta) => {
    const text = await readText(meta)
    const v1Key = v1KeyForName(meta.name)
    const kind = v1Key ?? parseV2FileName(meta.name)?.kind
    if (!kind) return
    const key = cacheKeyFor(meta, index)
    partials.set(key, partialSnapshotFor(meta.name, kind, parseJsonText(meta.name, text)))
    if (v1Key && key === meta.name) v1RevisionsRead[v1Key] = headRevisions[meta.name]
  })

  // Deterministic fold order (by cache key). Each partial carries one store's rows; mergeAll
  // unions disjoint shards and resolves a row present in two sources exactly like a local/remote merge.
  let snapshot: SyncSnapshot = EMPTY_SNAPSHOT
  for (const key of [...partials.keys()].sort()) {
    snapshot = mergeAll(snapshot, partials.get(key) as SyncSnapshot)
  }

  const inferred = inferShardCount(files.map((f) => f.name))
  const shardCount = isV2 && manifest?.shardCount ? Math.max(manifest.shardCount, inferred) : inferred
  const v2Duplicates = index.duplicates.filter((f) => f.name === MANIFEST_FILE_NAME || parseV2FileName(f.name) !== null)

  return { snapshot, headRevisions, remoteTexts, cache: nextCache, manifest, isV2, shardCount, v1RevisionsRead, v2Duplicates }
}

/** One file the v2 layout wants on Drive: name + the exact (canonical) JSON text it should hold. */
interface DesiredFile {
  readonly name: string
  readonly text: string
  /** Write only when the file doesn't exist on Drive yet (board-config: per-device by design —
   *  mergeBoardConfig always keeps the local value — so the remote copy only seeds a new device
   *  and is never overwritten, or two devices would re-upload their own config every cycle). */
  readonly createOnly?: boolean
}

function rowsSortedById<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

function maxRowCount(snapshot: SyncSnapshot): number {
  return Math.max(snapshot.bookmarks.length, snapshot.cards.length)
}

/** Serializes a snapshot into the v2 file set (design §Drive layout): S shards per sharded store
 *  (row → fnv1a32(id) % S), plus the small single files. Canonical: same data → same text on
 *  every device. */
export function serializeSnapshotV2(snapshot: SyncSnapshot, shardCount: number): DesiredFile[] {
  const out: DesiredFile[] = []
  const bookmarkShards: BookmarkRecord[][] = Array.from({ length: shardCount }, () => [])
  for (const row of rowsSortedById(snapshot.bookmarks)) bookmarkShards[shardIndexFor(row.id, shardCount)].push(row)
  const cardShards: CardRecord[][] = Array.from({ length: shardCount }, () => [])
  for (const row of rowsSortedById(snapshot.cards)) cardShards[shardIndexFor(row.id, shardCount)].push(row)
  for (let k = 0; k < shardCount; k++) {
    out.push({ name: shardFileName('bookmarks', k), text: canonicalJson(bookmarkShards[k]) })
  }
  for (let k = 0; k < shardCount; k++) {
    out.push({ name: shardFileName('cards', k), text: canonicalJson(cardShards[k]) })
  }
  out.push({ name: singleFileName('tags'), text: canonicalJson(rowsSortedById(snapshot.tags)) })
  if (snapshot.boardConfig) out.push({ name: singleFileName('boardConfig'), text: canonicalJson(snapshot.boardConfig), createOnly: true })
  if (snapshot.vault) out.push({ name: singleFileName('vault'), text: canonicalJson(snapshot.vault) })
  return out
}

/** Uploads one sync file as gzip (binary multipart), creating it when `existing` is undefined.
 *  The trace step is `upload <name> (<size>)`, size = compressed bytes actually sent. */
async function uploadSyncFile(
  accessToken: string, folderId: string, name: string, text: string, existing: DriveFileMeta | undefined,
  codec: GzipCodec, trace: SyncCycleStepTrace[], signal?: AbortSignal,
): Promise<DriveFileMeta> {
  const bytes = await codec.compress(text)
  return traceStep(trace, `upload ${name} (${formatSize(bytes.byteLength)})`, () => existing
    ? updateBinaryFile(accessToken, existing.id, bytes, SYNC_GZIP_MIME, signal)
    : createBinaryFile(accessToken, folderId, name, bytes, SYNC_GZIP_MIME, signal))
}

/**
 * Cycle step 4 (design §Cycle): serialize the merged snapshot per file/shard and upload only the
 * files whose text differs from what this device pulled this cycle, each under the same
 * per-file optimistic lock as v1 (the file's headRevisionId must still equal the pulled one; a
 * file that exists remotely but was never pulled is a conflict too). `onFileWritten` runs after
 * every successful upload so the caller can persist sync-remote-cache + headRevisions right away.
 * Returns name → headRevisionId for every file of the layout that exists after the push.
 */
export async function pushSnapshot(
  accessToken: string,
  folderId: string,
  snapshot: SyncSnapshot,
  previousHeadRevisions: Readonly<Record<string, string>>,
  // Text this device pulled for each file EARLIER IN THE SAME CYCLE (PulledRemote.remoteTexts).
  // A file whose serialized content matches it exactly is not uploaded at all (no revision check
  // either) and keeps its known revision. Defaults to {} = always upload.
  previousRemoteTexts: Readonly<Record<string, string>> = {},
  opts: {
    signal?: AbortSignal
    trace?: SyncCycleStepTrace[]
    /** Shard count to write with (PulledRemote.shardCount); doubled here if rows outgrow it. */
    shardCount?: number
    codec?: GzipCodec | null
    onFileWritten?: (name: string, rev: string, text: string) => Promise<void>
  } = {},
): Promise<Record<string, string>> {
  const { signal, trace = [], onFileWritten } = opts
  const codec = requireCodec(opts.codec)
  const shardCount = planShardCount(opts.shardCount ?? 0, maxRowCount(snapshot))
  const desired = serializeSnapshotV2(snapshot, shardCount)
  const files = await traceStep(trace, 'list', () => listFolderFiles(accessToken, folderId, signal))
  const byName = indexListing(files).primary
  const newRevisions: Record<string, string> = {}

  await runPool(desired, WRITE_CONCURRENCY, async ({ name, text, createOnly }) => {
    const existing = byName.get(name)
    try {
      if (existing && createOnly) {
        const known = previousHeadRevisions[name] ?? existing.headRevisionId
        if (known) newRevisions[name] = known
        return
      }
      if (existing) {
        const previous = previousHeadRevisions[name]
        if (!previous) throw new SyncConflictError(name)
        if (previousRemoteTexts[name] === text) {
          newRevisions[name] = previous
          return
        }
        const current = await traceStep(trace, `rev ${name}`, () => getHeadRevisionId(accessToken, existing.id, signal))
        if (current !== previous) throw new SyncConflictError(name, previous, current)
      }
      const meta = await uploadSyncFile(accessToken, folderId, name, text, existing, codec, trace, signal)
      if (meta.headRevisionId) {
        newRevisions[name] = meta.headRevisionId
        if (onFileWritten) await onFileWritten(name, meta.headRevisionId, text)
      }
    } catch (err) {
      // Diagnostic-only context for sync-status's lastIssue.detail — never touches `.status`/`.name`.
      if (err instanceof DriveError && !err.context) throw new DriveError(err.status, err.message, `upload ${name}`, err.timedOut)
      throw err
    }
  })

  return newRevisions
}

/** Deletes non-primary copies of v2 files / the manifest after a successful push (their rows were
 *  already folded into what was just written). Best-effort: a copy another device already removed
 *  (404) or any other failure is ignored — it is simply retried by a later cycle. Returns the
 *  cache keys of the copies actually deleted. */
async function deleteV2Duplicates(
  accessToken: string, duplicates: readonly DriveFileMeta[], trace: SyncCycleStepTrace[], signal?: AbortSignal,
): Promise<string[]> {
  const deleted: string[] = []
  for (const dup of duplicates) {
    try {
      await traceStep(trace, `delete ${dup.name} (duplicate)`, () => deleteFile(accessToken, dup.id, signal))
      deleted.push(`${dup.name}#${dup.id}`)
    } catch (err) {
      if (err instanceof DriveError && err.status === 404) deleted.push(`${dup.name}#${dup.id}`)
    }
  }
  return deleted
}

/** The manifest this push should leave on Drive, or null when the existing one is already right
 *  (design §Cycle 4: "write manifest only when S or format changes" — plus §Migration: record the
 *  v1 revisions read, including a stale tab's newer write). */
function nextManifest(pulled: PulledRemote, shardCount: number): ManifestV2 | null {
  const migratedFromV1: MigratedFromV1 = {
    ...(pulled.isV2 ? pulled.manifest?.migratedFromV1 ?? {} : {}),
    ...pulled.v1RevisionsRead,
  }
  const hasMigrated = V1_KEYS.some((key) => migratedFromV1[key] !== undefined)
  const unchanged =
    pulled.isV2 &&
    pulled.manifest?.shardCount === shardCount &&
    sameMigratedFromV1(pulled.manifest?.migratedFromV1, hasMigrated ? migratedFromV1 : undefined)
  if (unchanged) return null
  return {
    formatVersion: SYNC_FORMAT_VERSION,
    shardCount,
    updatedAt: Date.now(),
    ...(hasMigrated ? { migratedFromV1 } : {}),
  }
}

async function writeManifest(
  accessToken: string, folderId: string, manifest: ManifestV2, signal?: AbortSignal,
): Promise<{ rev?: string; text: string }> {
  const text = canonicalJson(manifest)
  const files = await listFolderFiles(accessToken, folderId, signal)
  const existing = indexListing(files).primary.get(MANIFEST_FILE_NAME)
  const meta = existing
    ? await updateTextFile(accessToken, existing.id, text, signal)
    : await createTextFile(accessToken, folderId, MANIFEST_FILE_NAME, text, signal)
  return { rev: meta.headRevisionId, text }
}

/**
 * Filters a headRevisions-shaped record (PulledRemote.headRevisions — every PRIMARY file this
 * cycle's pull read, keyed by its plain name) down to the entries whose name is one of the 5 known
 * v1 file names (v1KeyForName != null). This is the only subset sync-status.headRevisions should
 * carry now: it's a device-local settings record but SHARED (same IndexedDB) with a stale, not-yet-
 * reloaded v1 tab in the same browser, whose own skip-check compares its 5-file listing against
 * this same field. v2 never writes a v1-named file (push only ever writes v2 shards/manifest — see
 * onFileWritten above), so any entry here can only be a revision this cycle's PULL actually saw on
 * Drive for a v1 file (during the initial migration, or a stale tab's own catch-up write) — exactly
 * what that v1 tab needs to keep matching. `manifest.json` is deliberately excluded (v1KeyForName
 * only recognizes the 5 data files, never the manifest): v2 rewrites manifest.json with its own
 * schema on every format/shard-count change, and letting that leak into this field caused the
 * original bug — a v1 tab's fast path never matched (it saw v2 names + a manifest revision it never
 * wrote), so it ran a full v1 cycle every poll, and that full cycle's own re-upload of ALL its files
 * (v1 has no "unchanged → skip" logic; see this file's design doc) included overwriting
 * manifest.json back to v1's OWN schema — which then made the NEXT v2 cycle treat the folder as
 * "not yet migrated" again and re-read every v1 file. Excluding v2/manifest revisions here breaks
 * that loop at its source: v2 simply stops touching the one shared field v1 still depends on.
 */
function v1OnlyHeadRevisions(headRevisions: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, rev] of Object.entries(headRevisions)) {
    if (v1KeyForName(name)) out[name] = rev
  }
  return out
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

/** Cheap pre-check for a cycle triggered by a timer/visibility poll rather than a real local
 *  write or a manual "Sync now" (opts.skipIfUnchanged, set only by those triggers — see
 *  SyncEngineRunner.tsx): lists the Drive folder once (no downloads) and compares it against the
 *  device-local sync-remote-cache (design §Cycle 5). "Unchanged" means: the manifest and every
 *  file a full pull would read (duplicates included, under their `name#id` key) are cached at
 *  exactly their listed revision, and no cached file has disappeared. The caller additionally
 *  refuses to skip while this device has an unpushed local change (sync-status pendingPush). */
export function isRemoteListingUnchanged(files: readonly DriveFileMeta[], cache: RemoteFileCache): boolean {
  const index = indexListing(files)
  const listedKeys = new Set(files.map((f) => cacheKeyFor(f, index)))
  for (const key of Object.keys(cache)) {
    if (!listedKeys.has(key)) return false
  }
  const manifestMeta = index.primary.get(MANIFEST_FILE_NAME)
  if (!manifestMeta?.headRevisionId) return false
  const cachedManifest = cache[MANIFEST_FILE_NAME]
  if (!cachedManifest || cachedManifest.rev !== manifestMeta.headRevisionId) return false
  let manifest: ManifestV2 | null
  try {
    manifest = parseManifest(JSON.parse(cachedManifest.text))
  } catch {
    return false
  }
  if (!isV2Manifest(manifest)) return false
  for (const meta of planReads(index, manifest)) {
    if (!meta.headRevisionId) return false
    if (cache[cacheKeyFor(meta, index)]?.rev !== meta.headRevisionId) return false
  }
  return true
}

async function isRemoteUnchanged(
  accessToken: string,
  folderId: string,
  cache: RemoteFileCache,
  signal?: AbortSignal,
): Promise<boolean> {
  const files = await listFolderFiles(accessToken, folderId, signal)
  return isRemoteListingUnchanged(files, cache)
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
      // Only THIS cycle's own IndexedDB writes (through `db`) are kept from re-triggering a sync;
      // user writes made meanwhile through any other handle still notify (sync-signal.ts).
      result = await withSyncWritesSuppressed(() => runSyncCycleUnlocked(db, opts), db)
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

    // Sync format v2 needs gzip. Without CompressionStream the cycle fails here, before any Drive
    // call or data write (classified 'other' → the generic retry message; no new UI copy).
    const codec = getGzipCodec()
    if (!codec) {
      const err = new SyncUnsupportedError()
      const errorKind = classifySyncError(err)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('codec', err) } })
      return { status: 'error', vaultConflict: false, errorKind, errorMessage: err.message, localChanged: false }
    }

    let accessToken: string
    try {
      accessToken = await ensureAccessToken(db)
    } catch (err) {
      const errorKind = classifySyncError(err)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('auth', err) } })
      return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'auth failed', localChanged: false }
    }

    const remoteCache = await loadRemoteCache(db, folderId)
    // The unpushed-local-change marker as of this cycle's start. Cleared at the end only if no
    // newer local write re-marked it meanwhile (clearPendingPushIf compares the value).
    const pendingAtStart = status.pendingPush
    // Diagnostic-only first step for the on-device sync log: why this cycle ran (poll vs full
    // trigger) and whether an unpushed-change marker was set at its start.
    trace.push({
      name: `start ${opts.skipIfUnchanged ? 'poll' : 'full'} pending=${pendingAtStart ?? '-'}`,
      ms: 0,
      ok: true,
    })

    // Fast path for a timer/visibility poll (opts.skipIfUnchanged, set only by those triggers —
    // never by a dirty write or manual "Sync now"): if nothing changed on Drive since this device
    // last saw it (sync-remote-cache) AND this device has no unpushed local change (pendingPush,
    // set by every local write and by a failed push), skip the full pull/merge/push below
    // entirely. Any failure here just falls through to the normal full pull.
    if (opts.skipIfUnchanged && pendingAtStart === undefined) {
      const unchanged = await traceStep(
        trace, 'skip-check', () => isRemoteUnchanged(accessToken, folderId, remoteCache, signal),
      ).catch(() => false)
      if (unchanged) {
        await updateSyncStatus(db, { lastSyncAt: Date.now() })
        return { status: 'synced', vaultConflict: false, localChanged: false }
      }
    }

    // Persists what a pull learned (cache of every file it read) right away, so a failure later in
    // the cycle never forces the same downloads again next time.
    async function pullAndCache(): Promise<PulledRemote> {
      const current = await loadRemoteCache(db, folderId)
      const result = await pullRemoteSnapshot(accessToken, folderId, { signal, trace, cache: current, codec })
      await saveRemoteCache(db, folderId, result.cache)
      return result
    }

    // Design §Cycle 4: sync-remote-cache is updated after EACH successful upload. NOT
    // sync-status.headRevisions — that field is shared (same IndexedDB) with a stale v1 tab in the
    // same browser, whose own skip-check still reads it expecting only its 5 v1 file names. Every
    // file pushSnapshot writes here is v2-named, so recording it there would desync the v1 tab's
    // comparison forever (see v1OnlyHeadRevisions below for the full explanation).
    async function onFileWritten(name: string, rev: string, text: string): Promise<void> {
      await patchRemoteCache(db, folderId, { [name]: { rev, text } })
    }

    let pulled: PulledRemote
    try {
      pulled = await pullAndCache()
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
      // now, unconditionally — bypassing the "skip the vault file during a conflict"
      // rule below. This never needs a password (publishing only ever needs the
      // vault's public data, which is always available unlocked-or-not), and it
      // must not wait for the user to do anything: the losing device's merge
      // action (Task 5's mergeIntoOtherVault, wired in Task 8) needs the vault file
      // to already reflect the winner BEFORE it retires its own vault, or a
      // later sync could resurrect stale content. Uses a create-or-update write
      // of the v2 vault file (vault.json.gz, or vault.json on a no-gzip device),
      // not the normal pushSnapshot/optimistic-lock path (deliberately: this write
      // must happen even though vaultConflict is about to force finalSnapshot.vault to null).
      if (isLocalVaultTarget(local.vault, pulled.snapshot.vault)) {
        const vaultName = singleFileName('vault')
        const files = await traceStep(trace, 'list', () => listFolderFiles(accessToken, folderId, signal))
        const existing = indexListing(files).primary.get(vaultName)
        const bytes = await codec.compress(canonicalJson(local.vault))
        await traceStep(trace, 'vault-publish', () => existing
          ? updateBinaryFile(accessToken, existing.id, bytes, SYNC_GZIP_MIME, signal)
          : createBinaryFile(accessToken, folderId, vaultName, bytes, SYNC_GZIP_MIME, signal))
      }
    }
    const merged = await traceStep(trace, 'merge', () => mergeAll(local, pulled.snapshot))
    // On conflict, push neither side's vault via the NORMAL path (null): applySnapshotToLocal/
    // pushSnapshot both skip a null vault entirely, so the local vault stays untouched here. The
    // winning side's vault file is instead published directly above, unconditionally, the moment
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
    let pushedFrom = pulled
    let shardCount = planShardCount(pulled.shardCount, maxRowCount(finalSnapshot))
    try {
      newRevisions = await pushSnapshot(
        accessToken, folderId, finalSnapshot, pulled.headRevisions, pulled.remoteTexts,
        { signal, trace, shardCount, codec, onFileWritten },
      )
    } catch (err) {
      if (!(err instanceof SyncConflictError)) {
        const errorKind = classifySyncError(err)
        // Local data may now be ahead of Drive: keep polls from skipping until a push succeeds.
        await markPendingPush(db)
        await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('push', err) } })
        return { status: 'error', vaultConflict, errorKind, errorMessage: err instanceof Error ? err.message : 'push failed', localChanged: false }
      }
      // Someone else pushed since our pull. Re-pull, re-merge once, then retry the push —
      // re-running the SAME safety checks as the first attempt (vault conflict, mass-deletion
      // guard), since the retry's re-pull can surface a conflict or deletions the first pull
      // never saw. Wrapped in its own try/catch so a second failure still returns a
      // SyncCycleResult instead of an unhandled rejection.
      let rePulled: PulledRemote
      try {
        rePulled = await pullAndCache()
      } catch (err2) {
        await markPendingPush(db)
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
      pushedFrom = rePulled
      shardCount = planShardCount(rePulled.shardCount, maxRowCount(pushedSnapshot))
      try {
        newRevisions = await pushSnapshot(
          accessToken, folderId, pushedSnapshot, rePulled.headRevisions, rePulled.remoteTexts,
          { signal, trace, shardCount, codec, onFileWritten },
        )
      } catch (err3) {
        await markPendingPush(db)
        const errorKind = classifySyncError(err3)
        await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind, detail: buildIssueDetail('push (retry)', err3) } })
        return { status: 'error', vaultConflict, errorKind, errorMessage: err3 instanceof Error ? err3.message : 'push failed (retry)', localChanged: false }
      }
    }

    // Manifest last (design §Cycle 4 / §Migration): only when the format, the shard count or the
    // recorded v1 revisions change — and only after every data file above was written, so a
    // v1 revision is never recorded as "migrated" before its rows are safely in the v2 files.
    const manifest = nextManifest(pushedFrom, shardCount)
    if (manifest) {
      const written = await traceStep(trace, 'manifest', () => writeManifest(accessToken, folderId, manifest, signal))
      if (written.rev) {
        await patchRemoteCache(db, folderId, { [MANIFEST_FILE_NAME]: { rev: written.rev, text: written.text } })
        newRevisions = { ...newRevisions, [MANIFEST_FILE_NAME]: written.rev }
      }
    }
    // Every data file is written: non-primary copies of v2 files are now redundant (their rows were
    // folded into the merge above) — remove them so they stop costing a read every cycle.
    if (pushedFrom.v2Duplicates.length > 0) {
      const deletedKeys = await deleteV2Duplicates(accessToken, pushedFrom.v2Duplicates, trace, signal)
      if (deletedKeys.length > 0) await patchRemoteCache(db, folderId, Object.fromEntries(deletedKeys.map((k) => [k, null])))
    }
    await saveBaseSnapshot(db, pushedSnapshot)
    // Only the v1-named subset of what this cycle's pull saw (see v1OnlyHeadRevisions) — v2's own
    // file/manifest revisions live in sync-remote-cache instead, never in this shared field.
    await updateSyncStatus(db, {
      headRevisions: v1OnlyHeadRevisions(pushedFrom.headRevisions),
      lastSyncAt: Date.now(),
      lastIssue: undefined,
    })
    await clearPendingPushIf(db, pendingAtStart)

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
