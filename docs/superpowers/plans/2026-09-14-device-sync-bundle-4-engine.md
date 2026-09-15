# 端末間同期 束4（engine.ts: pull/merge/push オーケストレーション）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/sync/sync-store.ts`（IndexedDB 側の同期状態）と `lib/sync/engine.ts`（pull/merge/push の司令塔）＋ `lib/sync/sync-controller.ts`（デバウンス push・visibilitychange/beforeunload flush）を実装し、束1〜3で作った純粋関数群（`merge.ts`）と Drive I/O（`drive-adapter.ts`）と認証（`auth.ts`）を実際に配線してひとつの同期サイクルとして動かす。

**Architecture:** 既存3モジュール（`merge.ts`＝純粋マージ関数、`drive-adapter.ts`＝Drive REST I/O、`auth.ts`＝トークン取得/更新）はどれも「呼び出し元ゼロ」で束3までに実装済み・レビュー済み・変更しない。この束では (1) IndexedDB へ同期状態を読み書きする `sync-store.ts`、(2) それらを組み合わせて実際に1サイクル（トークン確認→pull→ local 読み取り→ merge → 安全弁 → IDB 書き戻し → push）を回す `engine.ts`、(3) 20秒デバウンス push ＋ visibilitychange/beforeunload flush を行う `sync-controller.ts` を新規に作る。**この束もアプリ本体からの呼び出し元ゼロのまま**（`SyncPanel` UI は束6）＝ 既存挙動は1px も変わらない。

**Tech Stack:** TypeScript strict, `idb`（IndexedDB wrapper）, `zod`（ダウンロードした Drive ファイルの検証）, vitest + `fake-indexeddb/auto`。

**Spec:** `docs/private/2026-09-02-device-sync-design.md`（特に §4.1・§6.6・§7・§8・§9・§15「束4への必須申し送り」）。実行者は本計画書に加えてこの spec の該当節も読むこと。

## Global Constraints

- **`lib/sync/merge.ts` は凍結（変更禁止）**。束3で完成・レビュー済みの純粋関数群（IDB/fetch/Date.now/crypto 不使用）。この束はそれを**呼ぶ**だけ。
- **`lib/sync/drive-adapter.ts` も凍結（変更禁止）**。全関数が `accessToken: string` を第一引数で受け取る fetch のみのモジュール。リフレッシュ・リトライ・楽観ロック判断は engine 側の仕事。
- **この束も呼び出し元ゼロ**（`components/`・`app/` のどこからも import されない）。`SyncPanel` UI・初回接続フローの配線は束6。既存挙動は完全不変。
- **`applySnapshotToLocal` は `bookmarks`/`tags`/`cards` ストアに絶対に `.clear()` を呼ばない**（spec §12 の不変条件＝「`clear()` は"バックアップから復元"専用・同期の pull は絶対に呼ばない」）。マージ結果は常に local の superset（id の和集合）なので、各レコードを `put` するだけで正しく合体できる。
- **EMPTY TRASH の物理削除の"復活"問題は対応しない（2026-09-14 ユーザー決定・spec §6.6）**。base スナップショットを使った3-way整合判定のようなロジックをこの束で作らないこと（過剰実装＝スコープ外）。
- **`private-vault`（金庫）の食い違いを検知したら絶対に無言で解決しない**（`mergeVault` の JSDoc・spec §9）。両方に値がありかつ内容が違う場合は vault.json だけそのサイクルの同期から除外し、`vaultConflict: true` を結果に立てて呼び出し元（将来の束6 UI）に委ねる。
- **`updatedAt` は必ず数値ガードして読む**（束2/3の申し送り）。生の値を数値として扱わない。
- 各タスクの最後に `npx tsc --noEmit` が 0 件・そのタスクのテストファイルが green であることを確認してから commit する。フル回帰（`npx vitest run`）は最終タスク完了後にまとめて実行する。
- コマンド先頭に `rtk` を付ける（CLAUDE.md 既定）。`--no-verify` は禁止。vitest は素の `npx vitest`（`rtk npx` は既知の不具合・使わない）。

---

## File Structure

| ファイル | 責務 | 作成/変更 |
|---|---|---|
| `lib/sync/sync-store.ts` | IndexedDB 側の同期状態（トークン・接続状況・headRevisions・base スナップショット・ロールバック用バックアップ3世代）。`settings` ストアの新規キーを使うだけ＝**DB バージョンアップ不要**（device-id.ts / vault-store.ts / board-config.ts と同じパターン）。 | 新規（Task 1-2） |
| `lib/storage/board-config.ts` | `saveBoardConfig` に `updatedAt` 打刻を配線・`CONFIG_KEY` を export・生レコードを返す `loadBoardConfigRecord` を追加。既存 `loadBoardConfig`/`saveBoardConfig` の呼び出し元は無変更で動く。 | 変更（Task 3） |
| `lib/sync/snapshot-schema.ts` | Drive からダウンロードした5ファイルの zod 検証（spec §8「壊れていたら zod で検証・1つでも不正なら中止」）。 | 新規（Task 4） |
| `lib/sync/engine.ts` | ローカル⇄`SyncSnapshot` の読み書き・トークン確認・Drive pull/push・`runSyncCycle`/`connectSync` オーケストレーション・安全弁。 | 新規（Task 5-8、同一ファイルを段階的に育てる） |
| `lib/sync/sync-controller.ts` | 20秒デバウンス push ＋ visibilitychange/beforeunload flush。 | 新規（Task 9） |

---

### Task 1: `sync-store.ts` — トークン永続化

**Files:**
- Create: `lib/sync/sync-store.ts`
- Test: `lib/sync/sync-store.test.ts`

**Interfaces:**
- Consumes: `SyncTokens`（`lib/sync/auth.ts` — `{ accessToken: string; expiresAt: number; scope: string; idToken?: string; refreshToken?: string }`）
- Produces: `saveSyncTokens(db, tokens): Promise<void>` / `loadSyncTokens(db): Promise<SyncTokens | null>` / `clearSyncTokens(db): Promise<void>` — Task 6-8 で使う。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/sync-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { saveSyncTokens, loadSyncTokens, clearSyncTokens } from './sync-store'
import type { SyncTokens } from './auth'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('sync-store tokens', () => {
  it('returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadSyncTokens(d)).toBeNull()
  })

  it('round-trips saved tokens', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const tokens: SyncTokens = { accessToken: 'at', expiresAt: 12345, scope: 'drive.file', refreshToken: 'rt', idToken: 'idt' }
    await saveSyncTokens(d, tokens)
    expect(await loadSyncTokens(d)).toEqual(tokens)
  })

  it('a later save without refreshToken does not resurrect the old one (overwrite, not merge)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveSyncTokens(d, { accessToken: 'at1', expiresAt: 1, scope: 's', refreshToken: 'rt' })
    await saveSyncTokens(d, { accessToken: 'at2', expiresAt: 2, scope: 's' })
    const loaded = await loadSyncTokens(d)
    expect(loaded?.accessToken).toBe('at2')
    expect(loaded?.refreshToken).toBeUndefined()
  })

  it('clearSyncTokens removes stored tokens', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: 1, scope: 's' })
    await clearSyncTokens(d)
    expect(await loadSyncTokens(d)).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/sync-store.test.ts`
Expected: FAIL（`sync-store.ts` が存在しない）

- [ ] **Step 3: 最小実装を書く**

```ts
// lib/sync/sync-store.ts
import type { IDBPDatabase } from 'idb'
import type { SyncTokens } from './auth'

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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/sync-store.test.ts`
Expected: PASS（4/4）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/sync-store.ts lib/sync/sync-store.test.ts
git commit -m "feat(sync): sync-store token persistence"
```

---

### Task 2: `sync-store.ts` — 接続状況・base スナップショット・ロールバック用バックアップ

**Files:**
- Modify: `lib/sync/sync-store.ts`（Task 1 の続き、同ファイルに追記）
- Test: `lib/sync/sync-store.test.ts`（追記）

**Interfaces:**
- Consumes: `SyncSnapshot`（`lib/sync/merge.ts`）
- Produces: `SyncStatus` 型 / `loadSyncStatus(db): Promise<SyncStatus>`（未接続時はデフォルト値を返す・null ではない）/ `updateSyncStatus(db, patch): Promise<SyncStatus>`（`headRevisions` は既存とマージ、他フィールドは上書き）/ `saveBaseSnapshot`/`loadBaseSnapshot` / `pushBackupGeneration`/`loadBackupGenerations`（最新3世代・新しい順）。Task 8 で使う。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/sync-store.test.ts に追記
import { loadSyncStatus, updateSyncStatus, saveBaseSnapshot, loadBaseSnapshot, pushBackupGeneration, loadBackupGenerations } from './sync-store'
import type { SyncSnapshot } from './merge'

const EMPTY_SNAPSHOT: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }

describe('sync-store status', () => {
  it('returns a disconnected default when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadSyncStatus(d)).toEqual({ connected: false, headRevisions: {} })
  })

  it('updateSyncStatus merges headRevisions instead of replacing them', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { connected: true, folderId: 'f1', headRevisions: { 'bookmarks.json': 'r1' } })
    const status = await updateSyncStatus(d, { headRevisions: { 'tags.json': 'r2' } })
    expect(status.headRevisions).toEqual({ 'bookmarks.json': 'r1', 'tags.json': 'r2' })
    expect(status.connected).toBe(true)
    expect(status.folderId).toBe('f1')
  })

  it('updateSyncStatus overwrites a headRevisions key when the same file name is patched again', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { headRevisions: { 'bookmarks.json': 'r1' } })
    const status = await updateSyncStatus(d, { headRevisions: { 'bookmarks.json': 'r2' } })
    expect(status.headRevisions).toEqual({ 'bookmarks.json': 'r2' })
  })
})

describe('sync-store base snapshot + backups', () => {
  it('loadBaseSnapshot returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadBaseSnapshot(d)).toBeNull()
  })

  it('round-trips a base snapshot', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveBaseSnapshot(d, EMPTY_SNAPSHOT)
    expect(await loadBaseSnapshot(d)).toEqual(EMPTY_SNAPSHOT)
  })

  it('pushBackupGeneration keeps only the newest 3, newest first', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    for (let i = 0; i < 4; i++) {
      await pushBackupGeneration(d, { ...EMPTY_SNAPSHOT, boardConfig: { config: {} as never, updatedAt: i } })
    }
    const generations = await loadBackupGenerations(d)
    expect(generations).toHaveLength(3)
    expect(generations[0].snapshot.boardConfig?.updatedAt).toBe(3)
    expect(generations[2].snapshot.boardConfig?.updatedAt).toBe(1)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/sync-store.test.ts`
Expected: FAIL（新規 export が存在しない）

- [ ] **Step 3: 実装を追記**

```ts
// lib/sync/sync-store.ts に追記
import type { SyncSnapshot } from './merge'

const STATUS_KEY = 'sync-status'
const BASE_SNAPSHOT_KEY = 'sync-base-snapshot'
const BACKUPS_KEY = 'sync-backups'
const MAX_BACKUP_GENERATIONS = 3

export interface SyncStatus {
  readonly connected: boolean
  readonly folderId?: string
  readonly headRevisions: Readonly<Record<string, string>>
  readonly lastSyncAt?: number
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/sync-store.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/sync-store.ts lib/sync/sync-store.test.ts
git commit -m "feat(sync): sync-store status, base snapshot, and rollback backups"
```

---

### Task 3: `board-config.ts` — `updatedAt` 打刻の配線

**Files:**
- Modify: `lib/storage/board-config.ts:32,47,57-60`
- Test: `lib/storage/board-config.test.ts`（追記。既存4テストは無変更のまま green を維持すること）

**Interfaces:**
- Produces: `CONFIG_KEY`（export化）/ `saveBoardConfig(db, config, updatedAt = Date.now())`（第3引数追加・既存呼び出し元は無変更で動く）/ `loadBoardConfigRecord(db): Promise<{config, updatedAt?} | null>`（新規・生レコード）。Task 5 の `buildLocalSnapshot`/`applySnapshotToLocal` が使う。
- `loadBoardConfig` の型・挙動は変更しない（既存の全呼び出し元に影響ゼロ）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/storage/board-config.test.ts に追記
import { loadBoardConfigRecord } from './board-config'

describe('board config updatedAt (sync bundle 4)', () => {
  it('loadBoardConfigRecord returns null when nothing saved', async () => {
    expect(await loadBoardConfigRecord(db)).toBeNull()
  })

  it('stamps updatedAt with Date.now() by default', async () => {
    const before = Date.now()
    await saveBoardConfig(db, DEFAULT_BOARD_CONFIG)
    const record = await loadBoardConfigRecord(db)
    expect(record?.updatedAt).toBeGreaterThanOrEqual(before)
    expect(record?.config).toEqual(DEFAULT_BOARD_CONFIG)
  })

  it('accepts an explicit updatedAt (used when applying a merged sync snapshot)', async () => {
    await saveBoardConfig(db, DEFAULT_BOARD_CONFIG, 999)
    const record = await loadBoardConfigRecord(db)
    expect(record?.updatedAt).toBe(999)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/storage/board-config.test.ts`
Expected: FAIL（`loadBoardConfigRecord` が存在しない）

- [ ] **Step 3: 実装を変更**

```ts
// lib/storage/board-config.ts の該当箇所を置き換え
export const CONFIG_KEY = 'board-config'   // 32行目: export を追加

type ConfigRecord = { key: string; config: BoardConfig; updatedAt?: number }   // 47行目: updatedAt を追加

export async function saveBoardConfig(
  db: DbLike,
  config: BoardConfig,
  updatedAt: number = Date.now(),
): Promise<void> {
  const record: ConfigRecord = { key: CONFIG_KEY, config, updatedAt }
  await db.put('settings', record)
}

export async function loadBoardConfigRecord(
  db: DbLike,
): Promise<{ config: BoardConfig; updatedAt?: number } | null> {
  const record = (await db.get('settings', CONFIG_KEY)) as ConfigRecord | undefined
  if (!record) return null
  return { config: record.config, updatedAt: record.updatedAt }
}
```

`loadBoardConfig` の本体（デフォルトマージ・retired テーマ migration）は変更しない。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/storage/board-config.test.ts tests/lib/board-config.test.ts`
Expected: PASS（既存分含め全件 green）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/storage/board-config.ts lib/storage/board-config.test.ts
git commit -m "feat(sync): stamp updatedAt on saveBoardConfig for sync LWW"
```

---

### Task 4: `snapshot-schema.ts` — Drive ファイルの zod 検証

**Files:**
- Create: `lib/sync/snapshot-schema.ts`
- Test: `lib/sync/snapshot-schema.test.ts`

**Interfaces:**
- Consumes: `BookmarkRecord`/`TagRecord`/`CardRecord`（`lib/storage/indexeddb.ts`）、`SyncBoardConfig`（`lib/sync/merge.ts`）、`PrivateVaultRecord`（`lib/private/vault-store.ts`）
- Produces: `ParseResult<T> = { ok:true; value:T } | { ok:false; error:string }` ＋ `parseBookmarksFile`/`parseTagsFile`/`parseCardsFile`/`parseBoardConfigFile`/`parseVaultFile`（すべて `(json: unknown) => ParseResult<...>`）。Task 7 の `pullRemoteSnapshot` が使う。
- **設計判断（意図的な緩さ）**: `UrlType`/`OgpStatus`/`MediaSlot`/`BoardConfig` の内部型は他ファイルで定義されているが、この束では正確な列挙値を確認せず `z.string()`/`z.unknown()`/`z.record()` で緩く受ける（＝壊れたファイルを弾く「破損検知」が目的であり、アプリの型システムを zod で再実装するのが目的ではない）。全スキーマは `.passthrough()` で未知フィールドを保持する（将来のアプリバージョンが追加した新フィールドを検証時に握りつぶさないため）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/snapshot-schema.test.ts
import { describe, it, expect } from 'vitest'
import { parseBookmarksFile, parseTagsFile, parseCardsFile, parseBoardConfigFile, parseVaultFile } from './snapshot-schema'

const VALID_BOOKMARK = {
  id: 'b1', url: 'https://example.com', title: 't', description: '', thumbnail: '', favicon: '',
  siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
}
const VALID_TAG = { id: 'tag1', name: 'n', color: '#fff', order: 0, createdAt: 1 }
const VALID_CARD = {
  id: 'c1', bookmarkId: 'b1', folderId: 'f1', x: 0, y: 0, rotation: 0, scale: 1,
  zIndex: 1, gridIndex: 0, isManuallyPlaced: false, width: 100, height: 100,
}
const VALID_VAULT = {
  key: 'private-vault', tagId: 'tag1', salt: 's', iterations: 600000,
  publicKey: 'pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
}

describe('snapshot-schema', () => {
  it('accepts a valid bookmarks array', () => {
    const result = parseBookmarksFile([VALID_BOOKMARK])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(1)
  })

  it('rejects a bookmarks payload that is not an array', () => {
    const result = parseBookmarksFile({ not: 'an array' })
    expect(result.ok).toBe(false)
  })

  it('rejects a bookmark missing a required field', () => {
    const { id: _id, ...broken } = VALID_BOOKMARK
    const result = parseBookmarksFile([broken])
    expect(result.ok).toBe(false)
  })

  it('keeps unknown extra fields on a bookmark (forward compatibility)', () => {
    const result = parseBookmarksFile([{ ...VALID_BOOKMARK, futureField: 'x' }])
    expect(result.ok).toBe(true)
    if (result.ok) expect((result.value[0] as unknown as Record<string, unknown>).futureField).toBe('x')
  })

  it('accepts a valid tags array', () => {
    expect(parseTagsFile([VALID_TAG]).ok).toBe(true)
  })

  it('accepts a valid cards array', () => {
    expect(parseCardsFile([VALID_CARD]).ok).toBe(true)
  })

  it('accepts a board-config file (loose inner config)', () => {
    const result = parseBoardConfigFile({ config: { themeId: 'dotted-notebook' }, updatedAt: 1 })
    expect(result.ok).toBe(true)
  })

  it('rejects a board-config file missing "config"', () => {
    expect(parseBoardConfigFile({ updatedAt: 1 }).ok).toBe(false)
  })

  it('accepts a valid vault file', () => {
    expect(parseVaultFile(VALID_VAULT).ok).toBe(true)
  })

  it('rejects a vault file with the wrong key literal', () => {
    expect(parseVaultFile({ ...VALID_VAULT, key: 'wrong' }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/snapshot-schema.test.ts`
Expected: FAIL（ファイルが存在しない）

- [ ] **Step 3: 実装を書く**

```ts
// lib/sync/snapshot-schema.ts
import { z } from 'zod'
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import type { SyncBoardConfig } from './merge'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

const bookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string(),
  thumbnail: z.string(),
  favicon: z.string(),
  siteName: z.string(),
  type: z.string(),
  savedAt: z.string(),
  folderId: z.string().optional(),
  ogpStatus: z.string(),
  isRead: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.string().optional(),
  orderIndex: z.number().optional(),
  sizePreset: z.enum(['S', 'M', 'L']).optional(),
  cardWidth: z.number().optional(),
  customCardWidth: z.boolean().optional(),
  tags: z.array(z.string()),
  displayMode: z.enum(['visual', 'editorial', 'native']).nullable().optional(),
  hasVideo: z.boolean().optional(),
  photos: z.array(z.string()).optional(),
  mediaSlots: z.array(z.unknown()).optional(),
  linkStatus: z.enum(['alive', 'gone', 'unknown']).optional(),
  lastCheckedAt: z.number().optional(),
  updatedAt: z.number().optional(),
  encryptedPayload: z.object({
    ephemeralPublicKey: z.string(),
    iv: z.string(),
    ciphertext: z.string(),
  }).optional(),
  dominantColor: z.string().nullable().optional(),
  onboardingDemo: z.boolean().optional(),
}).passthrough()

const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  createdAt: z.number(),
  theme: z.string().nullable().optional(),
  updatedAt: z.number().optional(),
  onboardingDemo: z.boolean().optional(),
  isPrivateVault: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.string().optional(),
}).passthrough()

const cardSchema = z.object({
  id: z.string(),
  bookmarkId: z.string(),
  folderId: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  scale: z.number(),
  zIndex: z.number(),
  gridIndex: z.number(),
  isManuallyPlaced: z.boolean(),
  width: z.number(),
  height: z.number(),
  locked: z.boolean().optional(),
  isUserResized: z.boolean().optional(),
  aspectRatio: z.number().optional(),
  updatedAt: z.number().optional(),
}).passthrough()

const boardConfigFileSchema = z.object({
  config: z.record(z.string(), z.unknown()),
  updatedAt: z.number().optional(),
}).passthrough()

const vaultFileSchema = z.object({
  key: z.literal('private-vault'),
  tagId: z.string(),
  salt: z.string(),
  iterations: z.number(),
  publicKey: z.string(),
  wrappedPrivateKey: z.object({ iv: z.string(), ciphertext: z.string() }),
  hint: z.string().optional(),
}).passthrough()

function toResult<T>(parsed: z.SafeParseReturnType<unknown, unknown>): ParseResult<T> {
  if (parsed.success) return { ok: true, value: parsed.data as T }
  return {
    ok: false,
    error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

export function parseBookmarksFile(json: unknown): ParseResult<BookmarkRecord[]> {
  return toResult(z.array(bookmarkSchema).safeParse(json))
}

export function parseTagsFile(json: unknown): ParseResult<TagRecord[]> {
  return toResult(z.array(tagSchema).safeParse(json))
}

export function parseCardsFile(json: unknown): ParseResult<CardRecord[]> {
  return toResult(z.array(cardSchema).safeParse(json))
}

export function parseBoardConfigFile(json: unknown): ParseResult<SyncBoardConfig> {
  return toResult(boardConfigFileSchema.safeParse(json))
}

export function parseVaultFile(json: unknown): ParseResult<PrivateVaultRecord> {
  return toResult(vaultFileSchema.safeParse(json))
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/snapshot-schema.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/snapshot-schema.ts lib/sync/snapshot-schema.test.ts
git commit -m "feat(sync): zod validation for downloaded Drive sync files"
```

---

### Task 5: `engine.ts` — ローカル snapshot の読み書き

**Files:**
- Create: `lib/sync/engine.ts`
- Test: `lib/sync/engine.test.ts`

**Interfaces:**
- Consumes: `SyncSnapshot`（`./merge`）、`loadBoardConfigRecord`+`CONFIG_KEY`（`@/lib/storage/board-config`、Task 3）、`loadVaultRecord`（`@/lib/private/vault-store`）
- Produces: `buildLocalSnapshot(db): Promise<SyncSnapshot>` / `applySnapshotToLocal(db, snapshot): Promise<void>`。Task 8 が使う。

**★重要な不変条件**: `applySnapshotToLocal` は `bookmarks`/`tags`/`cards` に `.clear()` を呼ばない（Global Constraints 参照）。`snapshot` は常に呼び出し元の local スナップショットに対する superset（id の和集合）なので、レコードごとの `put` だけで正しく合体する。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/engine.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB, type AllMarksDB } from '@/lib/storage/indexeddb'
import { saveBoardConfig } from '@/lib/storage/board-config'
import { createVault } from '@/lib/private/vault-store'
import { buildLocalSnapshot, applySnapshotToLocal } from './engine'
import type { SyncSnapshot } from './merge'

let db: IDBPDatabase<AllMarksDB> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('buildLocalSnapshot', () => {
  it('returns empty arrays and nulls on a fresh DB', async () => {
    const d = await initDB(); db = d
    const snapshot = await buildLocalSnapshot(d)
    expect(snapshot).toEqual({ bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null })
  })

  it('includes board config with updatedAt and vault when present', async () => {
    const d = await initDB(); db = d
    await saveBoardConfig(d, { themeId: 'dotted-notebook' } as never, 42)
    await createVault(d, 'tag1', 'password123', undefined)
    const snapshot = await buildLocalSnapshot(d)
    expect(snapshot.boardConfig?.updatedAt).toBe(42)
    expect(snapshot.vault?.tagId).toBe('tag1')
  })
})

describe('applySnapshotToLocal', () => {
  it('adds new bookmarks/tags/cards without touching unrelated existing rows', async () => {
    const d = await initDB(); db = d
    await d.put('bookmarks', {
      id: 'existing', url: 'https://a.com', title: 'a', description: '', thumbnail: '', favicon: '',
      siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
    } as never)

    const snapshot: SyncSnapshot = {
      bookmarks: [{
        id: 'new', url: 'https://b.com', title: 'b', description: '', thumbnail: '', favicon: '',
        siteName: '', type: 'website', savedAt: '2026-01-02T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
      } as never],
      tags: [], cards: [], boardConfig: null, vault: null,
    }
    await applySnapshotToLocal(d, snapshot)

    const all = await d.getAll('bookmarks')
    expect(all.map(b => b.id).sort()).toEqual(['existing', 'new'])
  })

  it('leaves settings untouched when boardConfig/vault are null in the snapshot', async () => {
    const d = await initDB(); db = d
    await saveBoardConfig(d, { themeId: 'flat' } as never, 1)
    const snapshot: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }
    await applySnapshotToLocal(d, snapshot)
    const record = await d.get('settings', 'board-config')
    expect((record as { updatedAt?: number } | undefined)?.updatedAt).toBe(1)
  })

  it('writes boardConfig and vault when present in the snapshot', async () => {
    const d = await initDB(); db = d
    const snapshot: SyncSnapshot = {
      bookmarks: [], tags: [], cards: [],
      boardConfig: { config: { themeId: 'flat' } as never, updatedAt: 7 },
      vault: {
        key: 'private-vault', tagId: 'tag1', salt: 's', iterations: 600000,
        publicKey: 'pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
      },
    }
    await applySnapshotToLocal(d, snapshot)
    const config = await d.get('settings', 'board-config')
    expect((config as { updatedAt?: number } | undefined)?.updatedAt).toBe(7)
    const vault = await d.get('settings', 'private-vault')
    expect((vault as { tagId?: string } | undefined)?.tagId).toBe('tag1')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: FAIL（`engine.ts` が存在しない）

- [ ] **Step 3: 最小実装を書く**

```ts
// lib/sync/engine.ts
import type { IDBPDatabase } from 'idb'
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import { CONFIG_KEY, loadBoardConfigRecord } from '@/lib/storage/board-config'
import { loadVaultRecord } from '@/lib/private/vault-store'
import type { SyncSnapshot } from './merge'

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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/engine.ts lib/sync/engine.test.ts
git commit -m "feat(sync): engine local snapshot read/write"
```

---

### Task 6: `engine.ts` — アクセストークン確認・スコープ確認

**Files:**
- Modify: `lib/sync/engine.ts`（Task 5 の続き）
- Test: `lib/sync/engine.test.ts`（追記）

**Interfaces:**
- Consumes: `refreshAccessToken`/`isAccessTokenExpired`/`SYNC_OAUTH_SCOPE`/`SyncTokens`（`./auth`）、`loadSyncTokens`/`saveSyncTokens`（`./sync-store`、Task 1）
- Produces: `SyncNotConnectedError` / `ensureAccessToken(db, now?): Promise<string>` / `hasRequiredScopes(grantedScope): boolean`。Task 8 が使う。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/engine.test.ts に追記
import { vi } from 'vitest'
import { saveSyncTokens, loadSyncTokens } from './sync-store'
import { ensureAccessToken, hasRequiredScopes, SyncNotConnectedError } from './engine'

vi.mock('./auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth')>()
  return { ...actual, refreshAccessToken: vi.fn() }
})
import { refreshAccessToken } from './auth'

describe('ensureAccessToken', () => {
  it('throws SyncNotConnectedError when no tokens are stored', async () => {
    const d = await initDB(); db = d
    await expect(ensureAccessToken(d)).rejects.toThrow(SyncNotConnectedError)
  })

  it('returns the stored access token when not expired', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100_000, scope: 's', refreshToken: 'rt' })
    expect(await ensureAccessToken(d, Date.now())).toBe('at')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('refreshes and persists a new token when expired', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'old', expiresAt: 1, scope: 's', refreshToken: 'rt' })
    vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'new', expiresAt: 999999999999, scope: 's' })
    const token = await ensureAccessToken(d, Date.now())
    expect(token).toBe('new')
    expect(refreshAccessToken).toHaveBeenCalledWith('rt')
    const persisted = await loadSyncTokens(d)
    expect(persisted?.accessToken).toBe('new')
    expect(persisted?.refreshToken).toBe('rt') // refresh doesn't return a new refresh token — keep the old one
  })
})

describe('hasRequiredScopes', () => {
  it('true when all required scopes are present regardless of order', () => {
    expect(hasRequiredScopes('email https://www.googleapis.com/auth/drive.file profile openid')).toBe(true)
  })

  it('false when drive.file is missing (partial consent)', () => {
    expect(hasRequiredScopes('openid email profile')).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: FAIL（新規 export が存在しない）

- [ ] **Step 3: 実装を追記**

```ts
// lib/sync/engine.ts に追記
import { refreshAccessToken, isAccessTokenExpired, SYNC_OAUTH_SCOPE, type SyncTokens } from './auth'
import { loadSyncTokens, saveSyncTokens } from './sync-store'

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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/engine.ts lib/sync/engine.test.ts
git commit -m "feat(sync): engine access-token refresh and scope check"
```

---

### Task 7: `engine.ts` — Drive の pull/push（zod 検証・楽観ロック）

**Files:**
- Modify: `lib/sync/engine.ts`（Task 6 の続き）
- Test: `lib/sync/engine.test.ts`（追記）

**Interfaces:**
- Consumes: `findSyncFolder`/`createSyncFolder`/`listFolderFiles`/`downloadFileText`/`getHeadRevisionId`/`createTextFile`/`updateTextFile`（`./drive-adapter`）、`parseBookmarksFile`/`parseTagsFile`/`parseCardsFile`/`parseBoardConfigFile`/`parseVaultFile`（`./snapshot-schema`、Task 4）
- Produces: `SyncCorruptDataError` / `SyncConflictError` / `ensureSyncFolder(accessToken): Promise<string>` / `pullRemoteSnapshot(accessToken, folderId): Promise<{snapshot: SyncSnapshot; headRevisions: Record<string,string>}>` / `pushSnapshot(accessToken, folderId, snapshot, previousHeadRevisions): Promise<Record<string,string>>`。Task 8 が使う。

**★注意**: `listFolderFiles` の返り値の `headRevisionId` フィールドが実際に埋まっているかは未確認（drive-adapter.ts のコメントは `getHeadRevisionId` を「楽観ロック用の専用取得」と明記している＝ `listFolderFiles` は埋めていない可能性がある）。**推測せず、pull 時・push 時とも必ず `getHeadRevisionId` を明示的に呼んで revisionId を記録する**（`listFolderFiles` が既に埋めていても二重取得になるだけで安全・埋めていなければこれが唯一の正しい取得経路）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/engine.test.ts に追記
vi.mock('./drive-adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./drive-adapter')>()
  return {
    ...actual,
    findSyncFolder: vi.fn(),
    createSyncFolder: vi.fn(),
    listFolderFiles: vi.fn(),
    downloadFileText: vi.fn(),
    getHeadRevisionId: vi.fn(),
    createTextFile: vi.fn(),
    updateTextFile: vi.fn(),
  }
})
import {
  findSyncFolder, createSyncFolder, listFolderFiles, downloadFileText,
  getHeadRevisionId, createTextFile, updateTextFile,
} from './drive-adapter'
import { ensureSyncFolder, pullRemoteSnapshot, pushSnapshot, SyncCorruptDataError, SyncConflictError } from './engine'

describe('ensureSyncFolder', () => {
  it('returns the existing folder id without creating one', async () => {
    vi.mocked(findSyncFolder).mockResolvedValue('folder1')
    const id = await ensureSyncFolder('token')
    expect(id).toBe('folder1')
    expect(createSyncFolder).not.toHaveBeenCalled()
  })

  it('creates a folder when none exists', async () => {
    vi.mocked(findSyncFolder).mockResolvedValue(null)
    vi.mocked(createSyncFolder).mockResolvedValue('new-folder')
    expect(await ensureSyncFolder('token')).toBe('new-folder')
  })
})

describe('pullRemoteSnapshot', () => {
  it('treats a missing file as empty/null and records headRevisionId for present files', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bookmarks', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockResolvedValue('[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    const { snapshot, headRevisions } = await pullRemoteSnapshot('token', 'folder1')
    expect(snapshot).toEqual({ bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null })
    expect(headRevisions).toEqual({ 'bookmarks.json': 'rev-1' })
  })

  it('throws SyncCorruptDataError when a downloaded file fails zod validation', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bookmarks', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockResolvedValue('{"not":"an array"}')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    await expect(pullRemoteSnapshot('token', 'folder1')).rejects.toThrow(SyncCorruptDataError)
  })
})

describe('pushSnapshot', () => {
  const snapshot: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }

  it('creates files that do not exist yet', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockResolvedValue({ id: 'new-id', name: 'bookmarks.json', headRevisionId: 'rev-new' })
    const revisions = await pushSnapshot('token', 'folder1', snapshot, {})
    expect(revisions['bookmarks.json']).toBe('rev-new')
    expect(updateTextFile).not.toHaveBeenCalled()
  })

  it('updates an existing file when the recorded revision still matches', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f1', name: 'bookmarks.json' }])
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(updateTextFile).mockResolvedValue({ id: 'f1', name: 'bookmarks.json', headRevisionId: 'rev-2' })
    const revisions = await pushSnapshot('token', 'folder1', snapshot, { 'bookmarks.json': 'rev-1' })
    expect(revisions['bookmarks.json']).toBe('rev-2')
  })

  it('throws SyncConflictError when the remote revision changed since the recorded pull', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f1', name: 'bookmarks.json' }])
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-DIFFERENT')
    await expect(
      pushSnapshot('token', 'folder1', snapshot, { 'bookmarks.json': 'rev-1' }),
    ).rejects.toThrow(SyncConflictError)
    expect(updateTextFile).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: FAIL（新規 export が存在しない）

- [ ] **Step 3: 実装を追記**

```ts
// lib/sync/engine.ts に追記
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/engine.ts lib/sync/engine.test.ts
git commit -m "feat(sync): engine Drive pull/push with validation and optimistic lock"
```

---

### Task 8: `engine.ts` — `runSyncCycle` / `connectSync`（安全弁・vault 食い違い検知）

**Files:**
- Modify: `lib/sync/engine.ts`（Task 5-7 の続き）
- Test: `lib/sync/engine.test.ts`（追記）

**Interfaces:**
- Consumes: `mergeAll`（`./merge`）、`loadSyncStatus`/`updateSyncStatus`/`saveBaseSnapshot`/`pushBackupGeneration`/`saveSyncTokens`（`./sync-store`）、`getDeviceId`（`./device-id`）、`DB_VERSION`（`@/lib/constants`）、同ファイル内の `ensureAccessToken`/`ensureSyncFolder`/`pullRemoteSnapshot`/`pushSnapshot`/`buildLocalSnapshot`/`applySnapshotToLocal`/`SyncConflictError`
- Produces: `SyncCycleResult` 型 / `runSyncCycle(db, opts?: {bypassMassDeleteGuard?: boolean}): Promise<SyncCycleResult>` / `connectSync(db, tokens: SyncTokens): Promise<SyncCycleResult>`。束6の `SyncPanel` が最終的に呼ぶ。

**安全弁の仕様（spec §8・このタスクで実装）**:
1. 未接続（`status.connected===false` または `folderId` 無し）→ 何もせず `{status:'not-connected'}`。
2. `pullRemoteSnapshot` が `SyncCorruptDataError` を投げる → そのサイクル中止・ローカル無変更・`{status:'error'}`。
3. `local.vault` と `remote.vault` が両方あり中身が違う → vault.json だけそのサイクルの同期から除外（local の vault をそのまま残す）・`vaultConflict:true` を結果に立てる・bookmarks/tags/cards/boardConfig は通常どおりマージを続行。
4. マージ後の active（`isDeleted!==true`）ブクマ数が、local の active 数から 25% 超減り、かつ local の active 数が 10 件以上 → 何も書き込まずに一時停止 `{status:'needs-confirmation', deletionRatio}`。`opts.bypassMassDeleteGuard:true` で1回だけ強制続行できる（束6の「続けますか？」ボタン用）。
5. push 時に `SyncConflictError` → 1回だけ再 pull・再マージ・再 push する（自己修復・spec §7.4）。

**意図的に先送りする点（推測で実装しない）**: spec §8 は「ネット不通→静かにスキップ」と「その他のエラー→明示エラー」を区別しているが、この束では両方とも一律 `status:'error'` として返す。`auth.ts`/`drive-adapter.ts` が素の fetch 例外（オフライン）と HTTP エラー（401/404/5xx 等）をどう区別して投げているか本束では未確認のため、誤った判定ロジックを今ここで作らない。区別が要るのは束6（UI がどちらを静かに・どちらを目立たせるか決める段）になってから、実際の例外の中身を確認した上で `errorKind` のような分類を足す。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/engine.test.ts に追記
import { runSyncCycle, connectSync } from './engine'
import { updateSyncStatus, loadSyncStatus } from './sync-store'
import { mergeAll } from './merge'

function bookmark(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id, url: `https://x.com/${id}`, title: id, description: '', thumbnail: '', favicon: '',
    siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched',
    tags: [], updatedAt: 1, ...overrides,
  }
}

describe('runSyncCycle', () => {
  it('returns not-connected when sync-status has no folderId', async () => {
    const d = await initDB(); db = d
    const result = await runSyncCycle(d)
    expect(result).toEqual({ status: 'not-connected', vaultConflict: false })
  })

  it('pulls, merges, writes locally, and pushes on a clean cycle', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await d.put('bookmarks', bookmark('local-only') as never)

    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d)
    expect(result.status).toBe('synced')
    expect(result.mergedCounts?.bookmarks).toBe(1)
    expect(createTextFile).toHaveBeenCalled() // manifest.json + bookmarks.json etc all created
    const status = await loadSyncStatus(d)
    expect(status.lastSyncAt).toBeGreaterThan(0)
  })

  it('pauses with needs-confirmation when the merge would remove more than 25% of >=10 active bookmarks, and writes nothing', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    for (let i = 0; i < 10; i++) await d.put('bookmarks', bookmark(`local-${i}`) as never)

    // Remote has none of them and tombstones are absent → naive read would look like mass deletion.
    // Simulate by pulling an empty remote AND asserting the guard triggers off of the *merged* result,
    // so seed remote with tombstones for 8 of the 10 ids (deletions newer than local's updatedAt).
    const remoteBookmarks = Array.from({ length: 8 }, (_, i) =>
      bookmark(`local-${i}`, { isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: 999999 }))
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bm', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-bm' ? JSON.stringify(remoteBookmarks) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    const result = await runSyncCycle(d)
    expect(result.status).toBe('needs-confirmation')
    expect(result.deletionRatio).toBeGreaterThan(0.25)
    expect(createTextFile).not.toHaveBeenCalled()
    expect(updateTextFile).not.toHaveBeenCalled()
    const stillLocal = await d.getAll('bookmarks')
    expect(stillLocal).toHaveLength(10) // untouched — guard paused before any write
  })

  it('bypasses the mass-deletion guard when opts.bypassMassDeleteGuard is true', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    for (let i = 0; i < 10; i++) await d.put('bookmarks', bookmark(`local-${i}`) as never)
    const remoteBookmarks = Array.from({ length: 8 }, (_, i) =>
      bookmark(`local-${i}`, { isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: 999999 }))
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bm', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-bm' ? JSON.stringify(remoteBookmarks) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(updateTextFile).mockImplementation(async (_t, id, _c) => ({ id, name: 'bookmarks.json', headRevisionId: 'rev-2' }))
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d, { bypassMassDeleteGuard: true })
    expect(result.status).toBe('synced')
  })

  it('flags vaultConflict and keeps the local vault untouched when local and remote vaults differ', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await createVault(d, 'tag1', 'local-password')

    const remoteVault = {
      key: 'private-vault', tagId: 'tag1', salt: 'different-salt', iterations: 600000,
      publicKey: 'different-pk', wrappedPrivateKey: { iv: 'iv2', ciphertext: 'ct2' },
    }
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-vault', name: 'vault.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-vault' ? JSON.stringify(remoteVault) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(updateTextFile).mockImplementation(async (_t, id) => ({ id, name: 'x', headRevisionId: 'rev-2' }))
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d)
    expect(result.vaultConflict).toBe(true)
    const localVaultAfter = await d.get('settings', 'private-vault')
    expect((localVaultAfter as { salt?: string } | undefined)?.salt).not.toBe('different-salt')
  })
})

describe('connectSync', () => {
  it('saves tokens, finds/creates the folder, and runs a sync cycle', async () => {
    const d = await initDB(); db = d
    vi.mocked(findSyncFolder).mockResolvedValue(null)
    vi.mocked(createSyncFolder).mockResolvedValue('new-folder')
    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await connectSync(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    expect(result.status).toBe('synced')
    const status = await loadSyncStatus(d)
    expect(status.connected).toBe(true)
    expect(status.folderId).toBe('new-folder')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: FAIL（`runSyncCycle`/`connectSync` が存在しない）

- [ ] **Step 3: 実装を追記**

```ts
// lib/sync/engine.ts に追記
import { mergeAll } from './merge'
import { loadSyncStatus, updateSyncStatus, saveBaseSnapshot, pushBackupGeneration } from './sync-store'
import { getDeviceId } from './device-id'
import { DB_VERSION } from '@/lib/constants'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'

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
  const vaultConflict = !!(local.vault && pulled.snapshot.vault && vaultRecordsDiffer(local.vault, pulled.snapshot.vault))
  const merged = mergeAll(local, pulled.snapshot)
  const finalSnapshot: SyncSnapshot = vaultConflict ? { ...merged, vault: local.vault } : merged

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
    // Someone else pushed since our pull — re-pull, re-merge once, retry (spec §7.4 self-heal).
    const rePulled = await pullRemoteSnapshot(accessToken, folderId)
    const reMerged = mergeAll(finalSnapshot, rePulled.snapshot)
    pushedSnapshot = vaultConflict ? { ...reMerged, vault: local.vault } : reMerged
    await applySnapshotToLocal(db, pushedSnapshot)
    newRevisions = await pushSnapshot(accessToken, folderId, pushedSnapshot, rePulled.headRevisions)
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/engine.ts lib/sync/engine.test.ts
git commit -m "feat(sync): engine runSyncCycle/connectSync orchestration with safety valves"
```

---

### Task 9: `sync-controller.ts` — 20秒デバウンス push ＋ visibilitychange/beforeunload flush

**Files:**
- Create: `lib/sync/sync-controller.ts`
- Test: `lib/sync/sync-controller.test.ts`

**Interfaces:**
- Consumes: `runSyncCycle`（`./engine`、Task 8）
- Produces: `SyncController { markDirty(): void; flushNow(): Promise<SyncCycleResult>; start(): void; stop(): void }` / `createSyncController(db, debounceMs?): SyncController`。束6の `SyncPanel`/board 保存経路が最終的に呼ぶ。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/sync/sync-controller.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./engine', () => ({ runSyncCycle: vi.fn().mockResolvedValue({ status: 'synced', vaultConflict: false }) }))
import { runSyncCycle } from './engine'
import { createSyncController } from './sync-controller'

const fakeDb = {} as never

beforeEach(() => { vi.useFakeTimers(); vi.mocked(runSyncCycle).mockClear() })
afterEach(() => { vi.useRealTimers() })

describe('createSyncController', () => {
  it('markDirty triggers a sync cycle after the debounce delay', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.markDirty()
    expect(runSyncCycle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20000)
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
  })

  it('repeated markDirty calls reset the timer (only one cycle fires)', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.markDirty()
    await vi.advanceTimersByTimeAsync(15000)
    controller.markDirty()
    await vi.advanceTimersByTimeAsync(15000)
    expect(runSyncCycle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
  })

  it('flushNow runs immediately and cancels a pending debounce timer', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.markDirty()
    await controller.flushNow()
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20000)
    expect(runSyncCycle).toHaveBeenCalledTimes(1) // the debounced timer did not also fire
  })

  it('start() flushes on visibilitychange -> hidden', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.start()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    controller.stop()
  })

  it('stop() removes listeners so a later visibilitychange does not flush', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.start()
    controller.stop()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(runSyncCycle).not.toHaveBeenCalled()
  })

  it('beforeunload triggers a best-effort flush while started', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.start()
    window.dispatchEvent(new Event('beforeunload'))
    await Promise.resolve()
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    controller.stop()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/sync/sync-controller.test.ts`
Expected: FAIL（ファイルが存在しない）

- [ ] **Step 3: 実装を書く**

```ts
// lib/sync/sync-controller.ts
import type { IDBPDatabase } from 'idb'
import { runSyncCycle, type SyncCycleResult } from './engine'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const DEFAULT_DEBOUNCE_MS = 20_000

export interface SyncController {
  markDirty(): void
  flushNow(): Promise<SyncCycleResult>
  start(): void
  stop(): void
}

export function createSyncController(db: DbLike, debounceMs: number = DEFAULT_DEBOUNCE_MS): SyncController {
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false

  function clearTimer(): void {
    if (timer !== null) { clearTimeout(timer); timer = null }
  }

  async function flushNow(): Promise<SyncCycleResult> {
    clearTimer()
    return runSyncCycle(db)
  }

  function markDirty(): void {
    clearTimer()
    timer = setTimeout(() => { void flushNow() }, debounceMs)
  }

  function handleVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void flushNow()
    }
  }

  function handleBeforeUnload(): void {
    void flushNow()
  }

  function start(): void {
    if (started) return
    started = true
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }
  }

  function stop(): void {
    if (!started) return
    started = false
    clearTimer()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }

  return { markDirty, flushNow, start, stop }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/sync-controller.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: tsc確認 + commit**

```bash
npx tsc --noEmit
git add lib/sync/sync-controller.ts lib/sync/sync-controller.test.ts
git commit -m "feat(sync): debounced push + visibilitychange/beforeunload sync controller"
```

---

## Definition of Done（束4）

- [ ] 9タスク全て commit 済み。
- [ ] `npx tsc --noEmit` — 0 件。
- [ ] `npx vitest run` — フルスイート green（既存分含め・回帰ゼロ）。
- [ ] `npx eslint .`（プロジェクトの既存 lint コマンド）— 0 件。
- [ ] `rtk pnpm build` — 成功。
- [ ] `git grep -n "from '@/lib/sync/engine'\|from '@/lib/sync/sync-store'\|from '@/lib/sync/sync-controller'" -- 'app/**' 'components/**'` — 0件（呼び出し元ゼロ・既存挙動不変を確認）。
- [ ] opus 全ブランチレビュー実施 → Critical/Important ゼロを確認してから master マージ。
- [ ] `docs/private/2026-09-02-device-sync-design.md` §15 に束4の申し送り（束5/束6 への引き継ぎ事項）を追記。
