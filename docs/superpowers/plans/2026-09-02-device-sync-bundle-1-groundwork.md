# 端末間同期 — 束1(下ごしらえ)実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同期エンジンが「どちらの版が新しいか」「削除されたか」を判定できるよう、`BookmarkRecord` / `CardRecord` に `updatedAt`(Unix epoch ms)を、`TagRecord` にソフト削除印を足し、全書き込み経路でそれを維持する。加えて端末を識別する `deviceId` を1個永続する。**同期機能そのものは含まない**(束2以降)。

**Architecture:** 純粋な下ごしらえ。(1) 型に optional フィールドを追加(`updatedAt?: number` — 既存の `orderIndex?` / `cardWidth?` と同じ導入方式:型では optional、新コードは常に書く、migration が既存を埋める)。(2) v16→v17 の cursor-sweep migration で全既存ブクマの `updatedAt` を `Date.parse(savedAt)` から埋める。(3) `touchBookmark(rec)` という純関数スタンプを1個 export し、ブクマを書く全箇所で `db.put` の引数を包む。(4) `updateCard` とカード生成2箇所で `updatedAt` をセット。(5) `deleteTag` / `deleteTagCascade` を物理削除からソフト削除に変え、`getAllTags` で `!isDeleted` を弾く。(6) `lib/sync/device-id.ts` に `getDeviceId(db)`。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / IndexedDB via `idb` / Vitest 4 + `fake-indexeddb` / pnpm

**Spec:** `docs/private/2026-09-02-device-sync-design.md`(非公開・§3 が本計画の下敷き。§12 不変条件を厳守)

## Global Constraints

- **`updatedAt` は常に `updatedAt?: number`(optional)**。`BookmarkRecord` / `CardRecord` で **絶対に必須にしない**(必須にすると ~40 のテスト fixture と生成箇所が全部コンパイルエラーになる)。読み取り側は `?? 0`。新しい書き込みコードは常にセットする。
- **同期未接続 = 現状と 1px も挙動が変わらない**。この束の変更は全て「新しい optional フィールドを足す/維持する」だけ。UI・レンダリング・既存の読み取りロジックには一切触れない。
- **`DB_NAME` は `'booklage-db'` のまま**(`lib/constants.ts:27` — 変更禁止)。
- **`default`(黒+音波)テーマ・`backup.ts` の export/import は byte-identical を維持**。`backup.ts` は store 単位で丸ごと `getAll`/`put` するので新フィールドは自動で乗る = **`backup.ts` は一切変更しない**。
- コマンドは全て先頭に `rtk`。**`--no-verify` 禁止**。**vitest / playwright は素の `npx`**(`rtk npx` は既知の不具合 — memory `reference_playwright_output_and_rtk_npx`)。
- `any` は避け `unknown` + 型ガード。**ただし** `lib/storage/*` / `lib/sync/*` の既存慣習に合わせ、DB ハンドルは `IDBPDatabase<AllMarksDB>` か、feature モジュールでは `IDBPDatabase<any>`(既存の `onboarding-state.ts` / `tag-order-mode.ts` と同じ)を許容する。
- commit メッセージ規約: `feat:` / `fix:` / `test:` / `refactor:` 接頭辞。本文末尾に:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- **deploy / merge はこの計画では行わない**。全タスク完了後にユーザー確認を取ってから(CLAUDE.md 安全ルール)。
- 作業ブランチ: `master` 直コミット禁止。`feat/device-sync` ブランチを切って全束をそこに積む(memory `feedback_no_worktrees` — worktree は使わず単一 feature ブランチ)。**Task 1 の Step 0 で作成**。

---

## File Structure

| ファイル | 変更種別 | 責務 |
|---|---|---|
| `lib/constants.ts` | 変更(1行) | `DB_VERSION` 16→17 |
| `lib/storage/indexeddb.ts` | 変更 | 型に `updatedAt?` / tag ソフト削除フィールド追加 / v17 migration ブロック / `touchBookmark` 純関数 export / ブクマ書き込み各所に `touchBookmark` 適用 / `updateCard` + カード生成2箇所に `updatedAt` / `updateBookmarkOgp` 等 |
| `lib/storage/use-board-data.ts` | 変更 | `persist*` の `db.put('bookmarks', ...)` を `touchBookmark(...)` で包む |
| `lib/storage/tags.ts` | 変更 | `deleteTag` / `deleteTagCascade` をソフト削除化 / `getAllTags` に `!isDeleted` フィルタ / bookmark scrub に `touchBookmark` |
| `lib/private/apply-tag-change.ts` | 変更 | `addPrivateTag` / `removePrivateTag` の `store.put` に `touchBookmark` |
| `lib/sync/device-id.ts` | 新規 | `getDeviceId(db)` — `settings` の `sync-device-id` キーに UUID を1回だけ生成・永続 |
| `tests/lib/idb-v16-to-v17-migration.test.ts` | 新規 | v17 migration の backfill 検証 |
| `tests/lib/storage/bookmark-updated-at.test.ts` | 新規 | `touchBookmark` + 全 bump 経路の代表ケース |
| `tests/lib/storage/card-updated-at.test.ts` | 新規 | `updateCard` + カード生成の `updatedAt` |
| `tests/lib/storage/tags-soft-delete.test.ts` | 新規 | ソフト削除の挙動(store に tombstone が残る / `getAllTags` が弾く / raw `getAll` には出る / bookmark は従来通り scrub) |
| `tests/lib/sync/device-id.test.ts` | 新規 | 生成→永続→2回目は同じ値 |
| `tests/lib/storage/tags.test.ts` | 変更 | 既存 `deleteTag removes the tag` テストをソフト削除仕様に書き換え |

### `updatedAt` bump 方針(この束の中心的な判断 — merge 束で再確認する)

**BUMP する(`touchBookmark` / `updatedAt: Date.now()` を適用)** — ユーザー起点の変更・実データの追加:

| 箇所 | ファイル:関数 |
|---|---|
| 生成 | `indexeddb.ts` `buildBookmarkAndCard`(ブクマ+カード両方)、`addBookmarkBatch`(inline literal・ブクマ+カード両方) |
| タグ配列 | `use-board-data.ts` `persistTags` / `tags.ts` `addTagToBookmark` `removeTagFromBookmark` `deleteTagCascade`(scrub 部分) / `apply-tag-change.ts` `addPrivateTag` `removePrivateTag` |
| ソフト削除・復元 | `use-board-data.ts` `persistSoftDelete` |
| 既読 | `use-board-data.ts` `persistReadFlag` |
| タイトル | `use-board-data.ts` `persistTitle` |
| サムネ / 動画フラグ / photos / mediaSlots(= メディア後追い取得。**no-op guard を通過して実際に書く分岐でのみ**) | `use-board-data.ts` `persistThumbnail` `persistVideoFlag` / `indexeddb.ts` `persistPhotos` `persistMediaSlots` |
| 表示モード | `use-board-data.ts` `persistDisplayMode` |
| OGP 再取得 | `indexeddb.ts` `updateBookmarkOgp`(現状 caller 無しだが将来のため) |
| 手動カード幅 | `indexeddb.ts` `persistCustomCardWidth` `clearCustomCardWidth` `clearAllCustomCardWidths` |
| 並び順(ユーザーのドラッグ / RESORT ボタン) | `indexeddb.ts` `updateBookmarkOrderIndex` `updateBookmarkOrderBatch` `resortByNewestFirst` |
| カード配置・リサイズ(`updateCard` 経由 = `persistFreePosition` / `persistMeasuredAspect` / `persistGridIndex`) | `indexeddb.ts` `updateCard` |

**BUMP しない** — 受動的・自動的なシステム書き込み(内容ではなく状態のみ):

| 箇所 | 理由 |
|---|---|
| `indexeddb.ts` `updateBookmarkHealth` | リンク健全性の再検証は viewport 入場で全カードに走るタイマー処理。`linkStatus` は「生きてるか」であって内容変更ではない。bump すると LWW の勝者が常時入れ替わる |
| `indexeddb.ts` `repairOrderIndexIfNeeded` | 一度きりの自動修復(migrationFlags でガード)。ユーザー操作ではない。ここで bump すると次回同期で全件 push になる。既存の `updatedAt` は保持し、無い場合のみ `Date.parse(savedAt)` で埋める |
| `lib/storage/backfill-relative-thumbnails.ts` | 起動時の URL 正規化ヒール。内容の実変更ではない。**このファイルは触らない** |
| v1〜v17 の migration cursor sweep | v17 が `Date.parse(savedAt)` で埋める。それ以外の sweep(v2〜v16)は `updatedAt` に無関係 |

> **merge 束への申し送り**: `updateBookmarkOrderBatch` / `resortByNewestFirst`(並び順のみの変更)を bump する設計は、他端末で同じブクマのタイトルを編集していた場合に LWW でそれを 30日退避に落としうる(§6.5)。稀・自己修復可能なので v1 は許容。merge 束で「並び順専用タイムスタンプ」を導入するか判断する。`updateBookmarkHealth` の非bumpも merge 束で確認。

---

## Task 1: `BookmarkRecord.updatedAt` + v16→v17 migration + backfill

**Files:**
- Modify: `lib/constants.ts:30`(`DB_VERSION`)
- Modify: `lib/storage/indexeddb.ts` — `BookmarkRecord`(型・`lastCheckedAt` の直後 ~L90)、`BookmarkInput` の `Omit`(~L223-226)、`upgrade` コールバック(v16 ブロックの直後 ~L729)
- Test: `tests/lib/idb-v16-to-v17-migration.test.ts`(新規)

**Interfaces:**
- Consumes: なし(先頭タスク)
- Produces:
  - `BookmarkRecord.updatedAt?: number` — Unix epoch ms。v17 以降、全ブクマで観測可能(migration が backfill)。
  - `DB_VERSION = 17`(`lib/constants.ts` から export、`indexeddb.ts` / `backup.ts` が import)

- [ ] **Step 0: 作業ブランチを作る**

```bash
rtk git checkout -b feat/device-sync
```

- [ ] **Step 1: 失敗するテストを書く** — `tests/lib/idb-v16-to-v17-migration.test.ts`

`tests/lib/idb-v14-to-v16-migration.test.ts` の harness を踏襲(`fake-indexeddb/auto` / `beforeEach` で全 DB 削除 / 旧バージョンを `openDB` で手で作る / `initDB()` で upgrade を走らせる)。

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { DB_NAME } from '@/lib/constants'

describe('IDB v16 → v17 migration (updatedAt backfill)', () => {
  beforeEach(async () => {
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
  })

  async function seedV16(): Promise<void> {
    const v16 = await openDB(DB_NAME, 16, {
      upgrade(db) {
        const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
        bs.createIndex('by-tag', 'tags', { multiEntry: true })
        db.createObjectStore('tags', { keyPath: 'id' })
        db.createObjectStore('cards', { keyPath: 'id' })
        db.createObjectStore('settings', { keyPath: 'key' })
        db.createObjectStore('preferences', { keyPath: 'key' })
      },
    })
    await v16.put('bookmarks', {
      id: 'b1', url: 'https://example.com', title: 't', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', savedAt: '2026-01-15T09:30:00.000Z',
      ogpStatus: 'fetched', tags: [],
    })
    await v16.put('bookmarks', {
      id: 'b2', url: 'https://example.org', title: 't2', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', savedAt: '2026-02-20T12:00:00.000Z',
      ogpStatus: 'fetched', tags: [], updatedAt: 1_800_000_000_000,
    })
    await v16.put('tags', { id: 'g1', name: 'Art', color: '#28F100', order: 0, createdAt: 1_700_000_000_000 })
    await v16.put('cards', {
      id: 'c1', bookmarkId: 'b1', folderId: '', x: 0, y: 0, rotation: 0, scale: 1,
      zIndex: 1, gridIndex: 0, isManuallyPlaced: false, width: 240, height: 300,
    })
    v16.close()
  }

  it('backfills updatedAt from savedAt for rows missing it', async () => {
    await seedV16()
    const db = await initDB()
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1?.updatedAt).toBe(Date.parse('2026-01-15T09:30:00.000Z'))
    db.close()
  })

  it('preserves an already-present updatedAt', async () => {
    await seedV16()
    const db = await initDB()
    const b2 = await db.get('bookmarks', 'b2')
    expect(b2?.updatedAt).toBe(1_800_000_000_000)
    db.close()
  })

  it('leaves tags and cards untouched (no updatedAt forced onto them)', async () => {
    await seedV16()
    const db = await initDB()
    const tag = await db.get('tags', 'g1')
    expect(tag?.updatedAt).toBeUndefined()
    const card = await db.get('cards', 'c1')
    expect((card as { updatedAt?: number }).updatedAt).toBeUndefined()
    db.close()
  })

  it('preserves bookmark payload across the upgrade', async () => {
    await seedV16()
    const db = await initDB()
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1?.url).toBe('https://example.com')
    expect(b1?.title).toBe('t')
    db.close()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/lib/idb-v16-to-v17-migration.test.ts`
Expected: FAIL(`updatedAt` が `undefined` のまま — migration 未実装)

- [ ] **Step 3: 型を足す** — `lib/storage/indexeddb.ts`

`BookmarkRecord` の `lastCheckedAt?: number`(~L90)の直後に:

```ts
  /** v17+: 最後にこのブクマ(スカラーフィールド・タグ配列・ソフト削除状態)を
   *  変更した Unix epoch ms。端末間同期の LWW 判定に使う。v17 migration が
   *  全既存レコードを Date.parse(savedAt) で埋める。読み取り側は `?? 0`。
   *  受動的なシステム書き込み(リンク健全性チェック等)では bump しない
   *  (計画書「updatedAt bump 方針」表を参照)。 */
  updatedAt?: number
```

`BookmarkInput` の `Omit` に `updatedAt` を追加(自動生成フィールドなので caller には出さない):

```ts
export type BookmarkInput = Omit<
  BookmarkRecord,
  'id' | 'savedAt' | 'ogpStatus' | 'tags' | 'displayMode' | 'folderId' | 'updatedAt'
> & {
```

- [ ] **Step 4: `DB_VERSION` を上げる** — `lib/constants.ts:30`

```ts
/** IndexedDB schema version */
export const DB_VERSION = 17
```

- [ ] **Step 5: v17 migration ブロックを足す** — `lib/storage/indexeddb.ts`、v16 の `if (oldVersion < 16) { ... }` ブロックを閉じた直後(~L729、`},` で `upgrade` 本体が終わる直前)

v3→v4 の `addOgpStatus` sweep(自己完結・promise チェーン不要)をテンプレートにする:

```ts
      // ── v16 → v17: seed BookmarkRecord.updatedAt (Unix epoch ms) on every
      //    existing bookmark from Date.parse(savedAt). New writes set it via
      //    touchBookmark(); this backfill makes it observable on legacy rows
      //    so the device-sync merge can do LWW without a null branch.
      //    tags/cards get updatedAt lazily (read as `?? 0`), so no sweep for them.
      if (oldVersion < 17) {
        if (db.objectStoreNames.contains('bookmarks')) {
          const bookmarkStore = transaction.objectStore('bookmarks')
          void bookmarkStore.openCursor().then(function seedUpdatedAt(cursor) {
            if (!cursor) return
            const rec = cursor.value as BookmarkRecord
            if (typeof rec.updatedAt !== 'number') {
              const parsed = Date.parse(rec.savedAt)
              const next: BookmarkRecord = {
                ...rec,
                updatedAt: Number.isNaN(parsed) ? Date.now() : parsed,
              }
              void cursor.update(next)
            }
            return cursor.continue().then(seedUpdatedAt)
          })
        }
      }
```

> **注意**: v15 ブロックが `moods` store 上に、v16 ブロックが `settings` 上に開きっぱなしの cursor/promise を残すが、v17 は `bookmarks` 上なので競合しない(Explore 済)。念のため `bookmarks` に他の cursor を開かないこと。

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run tests/lib/idb-v16-to-v17-migration.test.ts`
Expected: PASS(4 tests)

- [ ] **Step 7: 既存の migration / backup テストが壊れていないか確認**

Run: `npx vitest run tests/lib/idb-v14-to-v16-migration.test.ts tests/lib/backup.test.ts tests/lib/indexeddb.test.ts`
Expected: PASS(`backup.test.ts` が `version` を検証している場合、17 を期待する箇所への更新が要るかもしれない — 出たら最小修正)

- [ ] **Step 8: commit**

```bash
rtk git add lib/constants.ts lib/storage/indexeddb.ts tests/lib/idb-v16-to-v17-migration.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): add BookmarkRecord.updatedAt + v17 migration backfill

Groundwork bundle 1 for device sync. updatedAt (Unix epoch ms) is
optional on the type; the v16->v17 cursor sweep seeds every existing
bookmark from Date.parse(savedAt). No behavior change for non-sync users.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `touchBookmark` 純関数 + `indexeddb.ts` のブクマ書き込みに適用

**Files:**
- Modify: `lib/storage/indexeddb.ts` — `touchBookmark` を export(型定義の近く or Bookmark CRUD セクション先頭 ~L743)、および `buildBookmarkAndCard`(L921)、`addBookmarkBatch`(L1451 inline literal)、`updateBookmarkOgp`(L1193)、`persistCustomCardWidth`(L1219)、`persistPhotos`(L1258)、`persistMediaSlots`(L1299)、`clearCustomCardWidth`(L1316)、`clearAllCustomCardWidths`(L1335 `cursor.update`)、`updateBookmarkOrderIndex`(L1356)、`updateBookmarkOrderBatch`(L1379)、`resortByNewestFirst`(L899)
- Test: `tests/lib/storage/bookmark-updated-at.test.ts`(新規)

**Interfaces:**
- Consumes: `BookmarkRecord.updatedAt?`(Task 1)
- Produces:
  - `export function touchBookmark(rec: BookmarkRecord): BookmarkRecord` — **純関数**。`{ ...rec, updatedAt: Date.now() }` を返すだけ。DB 書き込みはしない。ブクマレコードを `put` する直前に引数を包むのに使う。

- [ ] **Step 1: 失敗するテストを書く** — `tests/lib/storage/bookmark-updated-at.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import {
  touchBookmark,
  addBookmark,
  addBookmarkBatch,
  updateBookmarkOgp,
  persistCustomCardWidth,
  persistPhotos,
  persistMediaSlots,
  updateBookmarkOrderBatch,
  resortByNewestFirst,
  updateBookmarkHealth,
} from '@/lib/storage/indexeddb'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-bookmark-updatedat'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) {
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
      const cs = db.createObjectStore('cards', { keyPath: 'id' })
      cs.createIndex('by-bookmark', 'bookmarkId')
      db.createObjectStore('settings', { keyPath: 'key' })
    },
  })
}

function seedBookmark(id: string, over: Partial<BookmarkRecord> = {}): BookmarkRecord {
  return {
    id, url: `https://example.com/${id}`, title: id, description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags: [], updatedAt: 1000, ...over,
  } as BookmarkRecord
}

describe('touchBookmark (pure)', () => {
  it('returns a copy with updatedAt = Date.now()', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567)
    const rec = seedBookmark('b1', { updatedAt: 1 })
    const out = touchBookmark(rec)
    expect(out.updatedAt).toBe(1_234_567)
    expect(out).not.toBe(rec)
    expect(out.id).toBe('b1')
    vi.restoreAllMocks()
  })
})

describe('bookmark write paths bump updatedAt', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('addBookmark sets updatedAt on the new record', async () => {
    const before = Date.now()
    const bm = await addBookmark(db as any, {
      url: 'https://x.com/a', title: 'a', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    expect(bm.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('addBookmarkBatch sets updatedAt on every record', async () => {
    const before = Date.now()
    const out = await addBookmarkBatch(db as any, [
      { url: 'https://x.com/1', title: '1', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' },
      { url: 'https://x.com/2', title: '2', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' },
    ])
    for (const b of out) expect(b.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('updateBookmarkOgp bumps updatedAt', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await updateBookmarkOgp(db as any, 'b1', { title: 'new', ogpStatus: 'fetched' })
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('persistCustomCardWidth bumps updatedAt', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await persistCustomCardWidth(db as any, 'b1', 300)
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('persistPhotos bumps updatedAt when it actually writes', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await persistPhotos(db as any, 'b1', ['https://img/1', 'https://img/2'])
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('persistPhotos does NOT bump on a deep-equal no-op', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, photos: ['https://img/1'] }))
    await persistPhotos(db as any, 'b1', ['https://img/1'])
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBe(1000)
  })

  it('persistMediaSlots does NOT bump on a deep-equal no-op', async () => {
    const slots = [{ type: 'photo' as const, url: 'https://img/1', videoUrl: undefined, aspect: 1 }]
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, mediaSlots: slots }))
    await persistMediaSlots(db as any, 'b1', slots)
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBe(1000)
  })

  it('updateBookmarkOrderBatch bumps updatedAt on reordered rows', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, orderIndex: 0 }))
    await db.put('bookmarks', seedBookmark('b2', { updatedAt: 1000, orderIndex: 1 }))
    await updateBookmarkOrderBatch(db as any, ['b1', 'b2'])
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1.updatedAt).toBeGreaterThan(1000)
  })

  it('resortByNewestFirst bumps updatedAt on rows whose order changes', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, savedAt: '2026-01-01T00:00:00.000Z', orderIndex: 5 }))
    await db.put('bookmarks', seedBookmark('b2', { updatedAt: 1000, savedAt: '2026-02-01T00:00:00.000Z', orderIndex: 5 }))
    await resortByNewestFirst(db as any)
    const b2 = await db.get('bookmarks', 'b2')
    expect(b2.updatedAt).toBeGreaterThan(1000)
  })

  it('updateBookmarkHealth does NOT bump updatedAt (passive revalidation)', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await updateBookmarkHealth(db as any, 'b1', { linkStatus: 'alive', lastCheckedAt: Date.now() })
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBe(1000)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/lib/storage/bookmark-updated-at.test.ts`
Expected: FAIL(`touchBookmark` が未 export / 各 bump アサーションが落ちる)

- [ ] **Step 3: `touchBookmark` を実装** — `lib/storage/indexeddb.ts`、`// Bookmark CRUD` セクションの先頭(~L743、`nextOrderIndexFrom` の直前)

```ts
/**
 * Pure stamp: return a copy of the bookmark with `updatedAt` set to now.
 * NOT a DB write — wrap the record you're about to `put` with this so the
 * device-sync merge can do last-write-wins. Apply only on user-initiated or
 * content-adding writes; passive system writes (link-health revalidation,
 * migrations, startup repairs) must NOT bump — see the plan's bump policy.
 */
export function touchBookmark(rec: BookmarkRecord): BookmarkRecord {
  return { ...rec, updatedAt: Date.now() }
}
```

- [ ] **Step 4: 生成2箇所に `updatedAt` を足す**

`buildBookmarkAndCard`(L921〜)の `bookmark` literal に `savedAt` の次の行あたりで:
```ts
    savedAt: new Date().toISOString(),
    updatedAt: Date.now(),
```

`addBookmarkBatch`(L1451〜)の inline `bookmark` literal に同様:
```ts
        savedAt: new Date().toISOString(),
        updatedAt: Date.now(),
```

- [ ] **Step 5: 更新系に `touchBookmark` を適用**

各所、`db.put('bookmarks', X)` / `store.put(X)` / `cursor.update(X)` の `X` を `touchBookmark(X)` で包む。**「BUMP しない」表の関数(`updateBookmarkHealth` / `repairOrderIndexIfNeeded`)は触らない。**

- `updateBookmarkOgp`(L1194): `await db.put('bookmarks', touchBookmark(updated))`
- `persistCustomCardWidth`(L1219): `await db.put('bookmarks', touchBookmark({ ...existing, cardWidth: safeWidth, customCardWidth: true }))`
- `persistPhotos`(L1258-1259): `const updated: BookmarkRecord = touchBookmark({ ...existing, photos: next }); await db.put('bookmarks', updated)` ← **deep-equal guard(L1248-1256)の後**なので、実際に書く分岐でのみ bump される(正しい)
- `persistMediaSlots`(L1299-1300): 同様に `touchBookmark({ ...existing, mediaSlots: next })` を guard 後で
- `clearCustomCardWidth`(L1316): `await db.put('bookmarks', touchBookmark({ ...existing, customCardWidth: false }))`
- `clearAllCustomCardWidths`(L1335): `await cursor.update(touchBookmark({ ...rec, customCardWidth: false }))`
- `updateBookmarkOrderIndex`(L1356): `await db.put('bookmarks', touchBookmark({ ...existing, orderIndex }))`
- `updateBookmarkOrderBatch`(L1379): `await store.put(touchBookmark({ ...existing, orderIndex: n - 1 - i }))`
- `resortByNewestFirst`(L899): `await store.put(touchBookmark({ ...rec, orderIndex }))`

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run tests/lib/storage/bookmark-updated-at.test.ts`
Expected: PASS

- [ ] **Step 7: `indexeddb.ts` 関連の既存テストを確認**

Run: `npx vitest run tests/lib/indexeddb.test.ts tests/lib/idb-resort-newest-first.test.ts tests/lib/idb-v11-custom-card-width.test.ts`
Expected: PASS(生成レコードに `updatedAt` が増えるだけ。`toEqual` で厳密比較しているテストがあれば `expect.objectContaining` へ緩めるか `updatedAt` を除外 — 最小修正)

- [ ] **Step 8: commit**

```bash
rtk git add lib/storage/indexeddb.ts tests/lib/storage/bookmark-updated-at.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): touchBookmark stamp + updatedAt bump in indexeddb.ts writers

Adds the pure touchBookmark(rec) stamp and applies it at every
user-initiated / content-adding bookmark write in indexeddb.ts (create,
OGP, custom width, photos/mediaSlots, order/resort). Passive writes
(updateBookmarkHealth, repairOrderIndexIfNeeded) intentionally do not bump.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `use-board-data.ts` / `tags.ts` / `apply-tag-change.ts` のブクマ書き込みに `touchBookmark` 適用

**Files:**
- Modify: `lib/storage/use-board-data.ts` — `persistReadFlag`(L440)、`persistThumbnail`(L484)、`persistSoftDelete`(L502-507)、`persistVideoFlag`(L580)、`persistTitle`(L599)、`persistTags`(L653)、`persistDisplayMode`(L665)
- Modify: `lib/storage/tags.ts` — `addTagToBookmark`(L144)、`removeTagFromBookmark`(L173)、`deleteTagCascade`(L92 の scrub `put`)
- Modify: `lib/private/apply-tag-change.ts` — `addPrivateTag`(L71)、`removePrivateTag`(L98)
- Test: `tests/lib/storage/bookmark-updated-at.test.ts`(Task 2 で作成したファイルにケース追加)

**Interfaces:**
- Consumes: `touchBookmark`(Task 2)、`BookmarkRecord.updatedAt?`(Task 1)
- Produces: なし(適用のみ)

- [ ] **Step 1: 失敗するテストを追加** — `tests/lib/storage/bookmark-updated-at.test.ts` の `describe('bookmark write paths bump updatedAt')` 内に

```ts
  it('addTagToBookmark bumps updatedAt', async () => {
    const { addTagToBookmark } = await import('@/lib/storage/tags')
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await addTagToBookmark(db as any, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('removeTagFromBookmark bumps updatedAt', async () => {
    const { removeTagFromBookmark } = await import('@/lib/storage/tags')
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, tags: ['tag-x'] }))
    await removeTagFromBookmark(db as any, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('deleteTagCascade bumps updatedAt on scrubbed bookmarks', async () => {
    const { deleteTagCascade } = await import('@/lib/storage/tags')
    await db.put('tags', { id: 'g1', name: 'x', color: '#000', order: 0, createdAt: 1 })
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, tags: ['g1'] }))
    await deleteTagCascade(db as any, 'g1')
    const b = await db.get('bookmarks', 'b1')
    expect(b.tags).toEqual([])
    expect(b.updatedAt).toBeGreaterThan(1000)
  })
```

`addPrivateTag` / `removePrivateTag` は vault 鍵生成が絡み重い。`lib/private/apply-tag-change.test.ts` に既存の round-trip テストがあるので、そこに `updatedAt` bump アサーションを1行足す(Step 5 で確認)。

`use-board-data.ts` の `persist*` は React hook 内なので単体テストは既存の hook テスト(`tests/lib/storage/use-board-data*.test.ts` があれば)に乗せる。無ければ **この Task では `persist*` の bump は「コード変更 + tsc + 既存 hook テスト緑」で担保**し、機械検証は Task 7 のフルスイート + 束7 の e2e に委ねる(hook の薄いラッパーで、内部で呼ぶ `db.put` を `touchBookmark` で包むだけなので誤りが入りにくい)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/lib/storage/bookmark-updated-at.test.ts`
Expected: FAIL(tags.ts の3ケース)

- [ ] **Step 3: `tags.ts` に適用**

先頭の import に `touchBookmark` を追加:
```ts
import { touchBookmark } from './indexeddb'
```
- `addTagToBookmark`(L144): `await store.put(touchBookmark({ ...bookmark, tags: [...bookmark.tags, tagId] }))`
- `removeTagFromBookmark`(L173-177): `await store.put(touchBookmark({ ...bookmark, tags: bookmark.tags.filter((t: string) => t !== tagId) }))`
- `deleteTagCascade`(L92): `await bookmarkStore.put(touchBookmark({ ...b, tags: b.tags.filter((t: string) => t !== tagId) }))`

- [ ] **Step 4: `apply-tag-change.ts` に適用**

import 追加(既に `getBookmark` を `@/lib/storage/indexeddb` から import 済):
```ts
import { getBookmark, touchBookmark } from '@/lib/storage/indexeddb'
```
- `addPrivateTag`(L71): `await store.put(touchBookmark({ ...current, ...BLANK_FIELDS, encryptedPayload, tags }))`
- `removePrivateTag`(L98): `await store.put(touchBookmark(fields ? { ...rest, ...fields, tags } : { ...rest, tags }))`
  - 注: `rest` は `encryptedPayload` を分割代入で除いた残り。`touchBookmark` の引数型は `BookmarkRecord` なので `{ ...rest, tags }` が `BookmarkRecord` を満たすことを確認(`current` は `BookmarkRecord`、`encryptedPayload` を抜いても他必須フィールドは残る)。型が合わなければ `as BookmarkRecord` は使わず、`current` を明示的に型注釈する。

- [ ] **Step 5: `use-board-data.ts` に適用**

各 `persist*` の `await db.put('bookmarks', X)` を `touchBookmark` で包む。`db` は `IDBPDatabase<any>` 相当なので import は型の都合上不要だが関数は要る:
```ts
import {
  // ...既存 import...
  touchBookmark,
} from './indexeddb'
```
- `persistReadFlag`(L440): `await db.put('bookmarks', touchBookmark({ ...existing, isRead }))`
- `persistThumbnail`(L484): `await db.put('bookmarks', touchBookmark({ ...existing, thumbnail }))` ← 各種 no-op guard(L468/476/483)の後なので実書き込み時のみ bump
- `persistSoftDelete`(L502-507): `const updated: BookmarkRecord = touchBookmark({ ...existing, isDeleted, deletedAt: isDeleted ? new Date().toISOString() : undefined }); await db.put('bookmarks', updated)` ← 直後の `toItem(updated, card)` もこの `updated` を使う(stamp 済みで一貫)
- `persistVideoFlag`(L580): `await db.put('bookmarks', touchBookmark({ ...existing, hasVideo }))` ← L579 の no-op guard 後
- `persistTitle`(L599): `await db.put('bookmarks', touchBookmark({ ...existing, title }))` ← L598 の guard 後
- `persistTags`(L653): `await db.put('bookmarks', touchBookmark({ ...existing, tags: [...tags] }))`
- `persistDisplayMode`(L665): `await db.put('bookmarks', touchBookmark({ ...existing, displayMode }))`

`persistOrderIndex` / `persistOrderBatch` / `persistPhotos` / `persistMediaSlots` は `updateBookmarkOrderIndex` / `updateBookmarkOrderBatch` / `persistPhotosDb` / `persistMediaSlotsDb`(= Task 2 で対応済み)へ委譲しているだけなので**ここでは触らない**。

- [ ] **Step 6: `apply-tag-change` の既存テストに bump アサーションを足す**

`lib/private/apply-tag-change.test.ts` の `addPrivateTag` round-trip テストに:
```ts
    // updatedAt is bumped when the Private tag is applied
    expect(afterEncrypt.updatedAt).toBeGreaterThan(seededUpdatedAt)
```
(seed 時に `updatedAt: 1000` を入れておく。テストの seed helper を確認して合わせる)

- [ ] **Step 7: テスト + tsc を確認**

Run: `npx vitest run tests/lib/storage/bookmark-updated-at.test.ts tests/lib/storage/tags.test.ts lib/private/apply-tag-change.test.ts`
Run: `rtk tsc --noEmit`(または `rtk npx tsc --noEmit` が既定なら合わせる — repo の慣習に従う。CLAUDE.md は `rtk tsc`)
Expected: PASS / tsc 0 errors

- [ ] **Step 8: commit**

```bash
rtk git add lib/storage/use-board-data.ts lib/storage/tags.ts lib/private/apply-tag-change.ts tests/lib/storage/bookmark-updated-at.test.ts lib/private/apply-tag-change.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): bump updatedAt in hook / tag-relation / private write paths

Wraps every bookmark put in use-board-data persist*, tags.ts
add/removeTagToBookmark + deleteTagCascade scrub, and apply-tag-change
add/removePrivateTag with touchBookmark().

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `CardRecord.updatedAt` + `updateCard` / カード生成に適用

**Files:**
- Modify: `lib/storage/indexeddb.ts` — `CardRecord`(型・`aspectRatio?` の後 ~L170)、`updateCard`(L1111)、`buildBookmarkAndCard` の card literal(L941-955)、`addBookmarkBatch` の card literal(L1472-1486)
- Test: `tests/lib/storage/card-updated-at.test.ts`(新規)

**Interfaces:**
- Consumes: なし
- Produces: `CardRecord.updatedAt?: number` — Unix epoch ms。migration 無し(読み取りは `?? 0`)。`updateCard` と生成時に常にセットされる。

- [ ] **Step 1: 失敗するテストを書く** — `tests/lib/storage/card-updated-at.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { addBookmark, updateCard } from '@/lib/storage/indexeddb'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-card-updatedat'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) {
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
      const cs = db.createObjectStore('cards', { keyPath: 'id' })
      cs.createIndex('by-bookmark', 'bookmarkId')
    },
  })
}

describe('CardRecord.updatedAt', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('addBookmark seeds the card with updatedAt', async () => {
    const before = Date.now()
    const bm = await addBookmark(db as any, {
      url: 'https://x.com/a', title: 'a', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    const cards = await db.getAllFromIndex('cards', 'by-bookmark', bm.id)
    expect(cards[0].updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('updateCard bumps updatedAt', async () => {
    const bm = await addBookmark(db as any, {
      url: 'https://x.com/a', title: 'a', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    const cards = await db.getAllFromIndex('cards', 'by-bookmark', bm.id)
    const cardId = cards[0].id
    await db.put('cards', { ...cards[0], updatedAt: 1000 })
    await updateCard(db as any, cardId, { x: 42 })
    const after = await db.get('cards', cardId)
    expect(after.x).toBe(42)
    expect(after.updatedAt).toBeGreaterThan(1000)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/lib/storage/card-updated-at.test.ts`
Expected: FAIL

- [ ] **Step 3: 型を足す** — `CardRecord` の `aspectRatio?: number`(~L170)の後

```ts
  /** v17+: 最後にこのカード(配置・手動リサイズ)を変更した Unix epoch ms。
   *  配置は「装飾」なので migration での backfill はしない — 読み取りは `?? 0`。
   *  updateCard とカード生成時に常にセットされる。 */
  updatedAt?: number
```

- [ ] **Step 4: `updateCard` に適用**(L1111)

```ts
  const updated: CardRecord = { ...existing, ...updates, updatedAt: Date.now() }
  await db.put('cards', updated)
```

- [ ] **Step 5: カード生成2箇所に `updatedAt` を足す**

`buildBookmarkAndCard` の `card` literal(L941〜、`height` の後):
```ts
    width: dimensions.width,
    height: dimensions.height,
    updatedAt: Date.now(),
```

`addBookmarkBatch` の inline `card` literal(L1472〜、同様に `height` の後):
```ts
        width: dimensions.width,
        height: dimensions.height,
        updatedAt: Date.now(),
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run tests/lib/storage/card-updated-at.test.ts`
Expected: PASS

- [ ] **Step 7: card 関連の既存テストを確認**

Run: `npx vitest run tests/lib/indexeddb.test.ts`
Expected: PASS(`toEqual` で card を厳密比較しているテストがあれば `updatedAt` を除外 — 最小修正)

- [ ] **Step 8: commit**

```bash
rtk git add lib/storage/indexeddb.ts tests/lib/storage/card-updated-at.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): add CardRecord.updatedAt, bump in updateCard + card creation

No migration — placement is decorative, read as `?? 0`.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `TagRecord` ソフト削除フィールド + `deleteTag` / `deleteTagCascade` ソフト化 + `getAllTags` フィルタ

**Files:**
- Modify: `lib/storage/indexeddb.ts` — `TagRecord`(型・`isPrivateVault?` の後 ~L132)
- Modify: `lib/storage/tags.ts` — `getAllTags`(L47-50)、`deleteTag`(L74-76)、`deleteTagCascade`(L85-96)
- Test: `tests/lib/storage/tags-soft-delete.test.ts`(新規)、`tests/lib/storage/tags.test.ts`(既存1件を書き換え)

**Interfaces:**
- Consumes: `touchBookmark`(Task 2 — `deleteTagCascade` の scrub 用。Task 3 で既に import 済みなら再利用)
- Produces:
  - `TagRecord.isDeleted?: boolean` / `TagRecord.deletedAt?: string`(ISO 8601 — bookmark 側と同じ型)
  - `deleteTag(db, id)` / `deleteTagCascade(db, tagId)` — 物理削除せず tombstone(`isDeleted: true` / `deletedAt` / `updatedAt: Date.now()`)を書く。`deleteTagCascade` は bookmark の `tags[]` scrub を**従来通り継続**(非同期ユーザーの UX を1mm も変えない。tombstone は同期束が来るまで `tags` store に眠るだけ)。
  - `getAllTags(db)` — `!isDeleted` の tag のみ返す。raw `db.getAll('tags')`(backup 等)は tombstone も返す。

- [ ] **Step 1: 失敗するテストを書く** — `tests/lib/storage/tags-soft-delete.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { addTag, getAllTags, deleteTag, deleteTagCascade } from '@/lib/storage/tags'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-tags-soft-delete'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) {
      db.createObjectStore('tags', { keyPath: 'id' })
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
    },
  })
}

function makeBookmark(id: string, tags: string[]): BookmarkRecord {
  return {
    id, url: `https://example.com/${id}`, title: id, description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags, updatedAt: 1000,
  } as BookmarkRecord
}

describe('tag soft delete', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('deleteTag writes a tombstone instead of physically removing', async () => {
    const t = await addTag(db, { name: 'x', color: '#000', order: 0 })
    await deleteTag(db, t.id)
    const raw = await db.get('tags', t.id)
    expect(raw).toBeDefined()
    expect(raw.isDeleted).toBe(true)
    expect(typeof raw.deletedAt).toBe('string')
    expect(raw.updatedAt).toBeGreaterThanOrEqual(t.createdAt)
  })

  it('getAllTags excludes tombstoned tags', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    const b = await addTag(db, { name: 'b', color: '#000', order: 1 })
    await deleteTag(db, a.id)
    const list = await getAllTags(db)
    expect(list.map((t) => t.id)).toEqual([b.id])
  })

  it('raw db.getAll still returns tombstones (backup carries them)', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    await deleteTag(db, a.id)
    const raw = await db.getAll('tags')
    expect(raw).toHaveLength(1)
  })

  it('deleteTagCascade tombstones the tag AND still scrubs bookmarks', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    await db.put('bookmarks', makeBookmark('b1', [a.id]))
    await deleteTagCascade(db, a.id)
    const tag = await db.get('tags', a.id)
    expect(tag.isDeleted).toBe(true)
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1.tags).toEqual([])
    expect(b1.updatedAt).toBeGreaterThan(1000)
    // gone from the visible list
    expect(await getAllTags(db)).toEqual([])
  })

  it('a fresh tag with the same name after delete gets a new id and shows', async () => {
    const a = await addTag(db, { name: 'Art', color: '#000', order: 0 })
    await deleteTag(db, a.id)
    const a2 = await addTag(db, { name: 'Art', color: '#000', order: 0 })
    expect(a2.id).not.toBe(a.id)
    expect((await getAllTags(db)).map((t) => t.id)).toEqual([a2.id])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/lib/storage/tags-soft-delete.test.ts`
Expected: FAIL

- [ ] **Step 3: 型を足す** — `TagRecord` の `isPrivateVault?: boolean`(~L132)の後

```ts
  /** v17+: ソフト削除の tombstone。端末間同期で「端末Aで削除したタグ」と
   *  「端末Bでまだ作っていないタグ」を区別するため物理削除をやめる。
   *  getAllTags は isDeleted を弾く(表示・フィルタ・quick-tag 全経路が
   *  getAllTags 経由)。物理 purge は将来(30日超のみ)。 */
  isDeleted?: boolean
  /** v17+: ソフト削除した時刻(ISO 8601 — BookmarkRecord.deletedAt と同型)。 */
  deletedAt?: string
```

- [ ] **Step 4: `getAllTags` にフィルタ** — `lib/storage/tags.ts:47-50`

```ts
export async function getAllTags(db: DbLike): Promise<TagRecord[]> {
  const list = (await db.getAll('tags')) as TagRecord[]
  return list.filter((t) => !t.isDeleted).sort((a, b) => a.order - b.order)
}
```

- [ ] **Step 5: `deleteTag` をソフト化** — `lib/storage/tags.ts:74-76`

```ts
/**
 * Soft-delete a tag by id — writes an isDeleted/deletedAt tombstone rather
 * than physically removing it, so the device-sync merge can tell a deleted
 * tag from a not-yet-created one. No-op if it doesn't exist. getAllTags
 * filters tombstones out of every read path.
 */
export async function deleteTag(db: DbLike, id: string): Promise<void> {
  const existing = (await db.get('tags', id)) as TagRecord | undefined
  if (!existing) return
  await db.put('tags', {
    ...existing,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    updatedAt: Date.now(),
  })
}
```

- [ ] **Step 6: `deleteTagCascade` をソフト化(bookmark scrub は継続)** — `lib/storage/tags.ts:85-96`

```ts
export async function deleteTagCascade(db: DbLike, tagId: string): Promise<void> {
  const tx = db.transaction(['tags', 'bookmarks'], 'readwrite')
  const tagStore = tx.objectStore('tags')
  const existing = (await tagStore.get(tagId)) as TagRecord | undefined
  if (existing) {
    await tagStore.put({
      ...existing,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      updatedAt: Date.now(),
    })
  }
  const bookmarkStore = tx.objectStore('bookmarks')
  const all = (await bookmarkStore.getAll()) as BookmarkRecord[]
  for (const b of all) {
    if (b.tags.includes(tagId)) {
      await bookmarkStore.put(touchBookmark({ ...b, tags: b.tags.filter((t: string) => t !== tagId) }))
    }
  }
  await tx.done
}
```

`touchBookmark` の import を確認(Task 3 で追加済みでなければ先頭に `import { touchBookmark } from './indexeddb'`)。

- [ ] **Step 7: 既存テストを書き換え** — `tests/lib/storage/tags.test.ts:93-97`

```ts
  it('deleteTag tombstones the tag (soft delete) and hides it from getAllTags', async () => {
    const t = await addTag(db, { name: 'x', color: '#000', order: 0 })
    await deleteTag(db, t.id)
    expect(await getAllTags(db)).toEqual([])
    const raw = await db.get('tags', t.id)
    expect(raw?.isDeleted).toBe(true)
  })
```

- [ ] **Step 8: テスト全体を確認**

Run: `npx vitest run tests/lib/storage/tags-soft-delete.test.ts tests/lib/storage/tags.test.ts tests/lib/storage/use-tags*.test.ts`
Expected: PASS(`use-tags` のテストがあれば緑。`remove()` は `deleteTagCascade` 経由なので挙動は「UI から消える」で不変)

- [ ] **Step 9: `onboarding-demo` の tag 掃除が壊れていないか確認**

`lib/onboarding/onboarding-demo.ts` は `deleteTagCascade` を使ってデモ tag を消す。ソフト削除でも「`getAllTags` から消える」ので UX 不変。既存テストがあれば実行:
Run: `npx vitest run tests/lib/onboarding` (該当あれば)
Expected: PASS

- [ ] **Step 10: commit**

```bash
rtk git add lib/storage/indexeddb.ts lib/storage/tags.ts tests/lib/storage/tags-soft-delete.test.ts tests/lib/storage/tags.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): soft-delete tags (isDeleted/deletedAt tombstone)

deleteTag / deleteTagCascade now write a tombstone instead of a physical
delete; getAllTags filters tombstones from every read path. Bookmark
tags[] scrub in deleteTagCascade is unchanged — non-sync UX is identical.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `deviceId` — `lib/sync/device-id.ts`

**Files:**
- Create: `lib/sync/device-id.ts`
- Test: `tests/lib/sync/device-id.test.ts`(新規)

**Interfaces:**
- Consumes: なし
- Produces:
  - `export async function getDeviceId(db: IDBPDatabase<any>): Promise<string>` — `settings` store の `sync-device-id` キーを読み、あればその `id` を返す。無ければ `crypto.randomUUID()` を生成して `{ key: 'sync-device-id', id }` で永続してから返す。個人を特定しない無意味な UUID。端末=ブラウザプロファイル単位。

- [ ] **Step 1: 失敗するテストを書く** — `tests/lib/sync/device-id.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { getDeviceId } from '@/lib/sync/device-id'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-device-id'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) { db.createObjectStore('settings', { keyPath: 'key' }) },
  })
}

describe('getDeviceId', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('generates and persists a UUID on first call', async () => {
    const id = await getDeviceId(db as any)
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)
    const rec = await db.get('settings', 'sync-device-id')
    expect(rec.id).toBe(id)
  })

  it('returns the same id on subsequent calls', async () => {
    const a = await getDeviceId(db as any)
    const b = await getDeviceId(db as any)
    expect(b).toBe(a)
  })

  it('honors an id already in the store', async () => {
    await db.put('settings', { key: 'sync-device-id', id: 'preexisting-uuid' })
    expect(await getDeviceId(db as any)).toBe('preexisting-uuid')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/lib/sync/device-id.test.ts`
Expected: FAIL(`lib/sync/device-id.ts` が存在しない)

- [ ] **Step 3: 実装** — `lib/sync/device-id.ts`(既存の `lib/storage/onboarding-state.ts` の書式を踏襲)

```ts
import type { IDBPDatabase } from 'idb'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

/** settings store key holding this browser profile's stable device id. */
const KEY = 'sync-device-id'

type DeviceIdRecord = { key: string; id: string }

/**
 * Stable, opaque per-device id (= per browser profile). Generated once with
 * crypto.randomUUID() and persisted in the `settings` store; every later call
 * returns the same value. Carries no personal information. Used by the
 * device-sync engine to stamp `updatedBy` on the Drive manifest and to key
 * the K3 activation count. Never synced to Drive (device-local — see design §5).
 */
export async function getDeviceId(db: DbLike): Promise<string> {
  const existing = (await db.get('settings', KEY)) as DeviceIdRecord | undefined
  if (existing?.id) return existing.id
  const id = crypto.randomUUID()
  await db.put('settings', { key: KEY, id } satisfies DeviceIdRecord)
  return id
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/lib/sync/device-id.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
rtk git add lib/sync/device-id.ts tests/lib/sync/device-id.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): getDeviceId — stable opaque per-profile id in settings

First lib/sync/ module. crypto.randomUUID() generated once, persisted
under settings key 'sync-device-id'. Device-local, never synced.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 検証ゲート + 回帰確認

**Files:** なし(検証のみ。必要なら回帰の最小修正)

**Interfaces:**
- Consumes: Task 1〜6 の全成果
- Produces: 「束1 は deploy 可能」という機械検証済みの状態

- [ ] **Step 1: tsc**

Run: `rtk tsc --noEmit`(repo 慣習が `rtk npx tsc` ならそちら)
Expected: 0 errors

- [ ] **Step 2: フル vitest**

Run: `npx vitest run 2>&1 | tail -40`
Expected: 全 pass。落ちるものがあれば **原因を特定してから**修正(推測で直さない — systematic-debugging)。想定される正当な fallout は「生成レコードの `toEqual` 厳密比較に `updatedAt` が増えた」だけ。その場合は該当アサーションを `expect.objectContaining(...)` か `updatedAt` 除外に緩める(検証を弱めない範囲で)。

- [ ] **Step 3: backup round-trip 回帰**

`tests/lib/backup.test.ts` が緑であることを再確認(Task 1 Step 7 で見たはず)。加えて手動確認: `exportAllStores` → `importAllStores` で `updatedAt` / `isDeleted` / `deletedAt` / `sync-device-id` が素通りする(store 単位 `getAll`/`put` なので自動。テストが無ければ1ケース足してよいが必須ではない)。

Run: `npx vitest run tests/lib/backup.test.ts`
Expected: PASS

- [ ] **Step 4: production build**

Run: `rtk pnpm build 2>&1 | tail -20`
Expected: 成功(`output: 'export'` で `out/` 生成)

- [ ] **Step 5: 束1 の diff を一望して不変条件チェック**

```bash
rtk git log --oneline master..HEAD
rtk git diff master..HEAD --stat
```

目視で確認:
- `backup.ts` / `backfill-relative-thumbnails.ts` / UI コンポーネント / CSS / i18n messages に**変更が無い**
- `DB_NAME` は不変
- `updateBookmarkHealth` / `repairOrderIndexIfNeeded` に `touchBookmark` が**入っていない**
- 型はすべて `updatedAt?`(optional)

- [ ] **Step 6: ユーザーへ報告(deploy 判断を仰ぐ)**

以下を報告:
- 束1完了。commit 6本、`feat/device-sync` ブランチ。
- 検証: tsc 0 / vitest 全green(件数) / build OK。
- **IDB スキーマが v16→v17 に上がる**。既存ユーザーの初回起動で cursor sweep が1回走る(全ブクマに `updatedAt` を書く)。**ダウングレード不可**(memory `project_idb_irreversibility` — v17 を触った後に v16 の本番へ戻すと `VersionError`)。
- deploy するか、束2以降とまとめて deploy するかをユーザーに確認(CLAUDE.md: IDB 不可逆変更は実行前にユーザー事実確認 / merge・deploy はユーザー確認後)。

---

## Self-Review(この計画を spec §3 と突き合わせた結果)

**Spec coverage:**
- §3.1 bookmarks `updatedAt` + v16→v17 migration(`Date.parse(savedAt)`) → Task 1 ✅
- §3.1 全書き込み経路で bump + 集約リファクタの検討 → Task 2(`touchBookmark` 純関数スタンプに決定・`touchBookmark(db,id,patch)` の DB ラッパーは各書き込みの transaction 構成を壊すため不採用)+ Task 3 ✅。「bump 方針」表で受動的書き込み(`updateBookmarkHealth` 等)を明示的に除外。
- §3.2 tags ソフト削除 + `deleteTag` ソフト化 + `useTags` の `!isDeleted` フィルタ → Task 5 ✅(フィルタは `useTags` ではなく全読み取りの choke-point である `getAllTags` に置く — より網羅的)。`updatedAt` は tag に既存(v15)なので追加不要と明記。
- §3.2 物理 purge(30日超)→ **この束では作らない**(spec も「将来」扱い。§13 未決)。Task 5 のコメントに申し送り。
- §3.3 cards `updatedAt`(migration no-op・読み `?? 0`)→ Task 4 ✅
- §3.4 deviceId(`crypto.randomUUID()` を `settings` に永続)→ Task 6 ✅
- §11 migration テスト → Task 1 Step 1、暗号 round-trip の updatedAt → Task 3 Step 6、回帰(byte-identical)→ Task 7 ✅
- §12 不変条件 → Global Constraints + Task 7 Step 5 ✅

**Placeholder scan:** コード steps は全て実コード。TBD/TODO 無し。`use-board-data.ts` の `persist*` bump の単体機械検証だけは「hook のため既存 hook テスト + tsc + 束7フル + 束7 e2e」に委ねると明記(hook テスト基盤が無いため。薄いラッパーで誤り混入リスク低)。

**Type consistency:**
- `touchBookmark(rec: BookmarkRecord): BookmarkRecord` — Task 2 で定義、Task 3・Task 5 で同名 import。
- `getDeviceId(db): Promise<string>` — Task 6 で定義、束2以降が consume。
- `updatedAt?: number` — Task 1(bookmark)・Task 4(card)で一貫。tag は `updatedAt?: number`(既存)+ `isDeleted?: boolean` / `deletedAt?: string`(Task 5)。
- `deletedAt` は bookmark・tag とも **ISO 8601 文字列**(§6.1 の ms 換算は merge 束の仕事 — Explore の指摘どおり `Date.parse` でブリッジ)。

---

## 束2〜7 ロードマップ(この計画の対象外・各着手時に個別計画書を書く)

設計書 §14 より。各束は独立してテスト可能な単位:

- **束2**: 極小 Function `functions/api/gauth/*`(token 交換・refresh・何も保存しない)+ `lib/sync/auth.ts`(GIS コードモデル)+ **Google Cloud OAuth クライアント作成手順(ユーザーが1回やる作業・設計書 §4.3)**。※束2の計画書に、ユーザー向けの Google Cloud Console 手順を画面ステップで書く。
- **束3**: `lib/sync/drive-adapter.ts`(Drive REST read/write/list)+ `lib/sync/merge.ts`(store 別足し算マージ・純関数・テスト厚め・Private の id 単位マージ含む)。
- **束4**: `lib/sync/engine.ts`(pull/merge/push・楽観ロック・安全弁)+ `lib/sync/sync-store.ts`(base スナップショット・接続状態)+ `vault.json` の授受。
- **束5**: 最小 K3(Worker `/claim`・`/activate` + `lib/board/license-store.ts` + `isSyncUnlocked`)。
- **束6**: `SyncPanel` UI + 初回接続フロー + 強パスワード案内 + **文言(EN/JA を実装前に提示して承認)**。
- **束7**: e2e(擬似2端末)+ 本番 edge 実機確認。
