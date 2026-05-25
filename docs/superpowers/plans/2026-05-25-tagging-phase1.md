# Tagging Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存 `mood` 機能を `tag` にリネーム + 拡張して、 タグ AND/OR 絞り込み + WAVE CRT shutdown アニメ + reflow + 通常モード付与 UI を完成させる。

**Architecture:** `lib/storage/moods.ts` の CRUD は完成度高い → `lib/storage/tags.ts` に rename + 新規 API 追加。 IDB schema は `moods` store → `tags` store の migration (DB_VERSION 14→15) + `dominantColor` 拡張ポイント空欄予約 + `by-tag` multiEntry index 追加。 UI 側は既存 `Sidebar.tsx` / `FilterPill.tsx` 等の参照を rename + 新規 `TagFilterBar` / `TagAddPopover` / `TagButton` / `tag-shutdown` を追加。

**Tech Stack:** Next.js 14 App Router + TypeScript strict / Vanilla CSS (Tailwind 不使用) / IndexedDB via `idb` / GSAP (= FLIP + Draggable) / react-testing-library + vitest / next-intl (15 言語)。

---

## Spec reference

実装は [docs/superpowers/specs/2026-05-25-tagging-design.md](../specs/2026-05-25-tagging-design.md) に厳密に従う。 確定事項表 A-T、 Goals 1-8、 Non-goals、 Components & data flow、 Phasing を逸脱しない。

## File structure

### Rename (= 既存 file の rename + 編集)
- `lib/storage/moods.ts` → `lib/storage/tags.ts` (rename + API 名統一 + 新規 API 追加)
- `lib/storage/use-moods.ts` → `lib/storage/use-tags.ts` (rename)
- `lib/storage/indexeddb.ts` (edit: 型 rename + DB_VERSION bump + migration + dominantColor 追加 + by-tag index)
- `components/board/{Sidebar, FilterPill, CardsLayer, BoardRoot, Lightbox}.tsx` (edit: mood → tag 参照 rename)

### 新規追加
- `lib/animation/tag-shutdown/index.ts`
- `lib/animation/tag-shutdown/reflow.ts`
- `lib/animation/tag-shutdown/themes/wave.module.css`
- `lib/board/tag-candidates.ts`
- `lib/board/use-tag-filter.ts`
- `components/board/TagFilterBar/index.tsx`
- `components/board/TagFilterBar/TagFilterBar.module.css`
- `components/board/TagAddPopover/index.tsx`
- `components/board/TagAddPopover/TagAddPopover.module.css`
- `components/board/TagButton/index.tsx`
- `components/board/TagButton/TagButton.module.css`
- `tests/lib/storage/tags.test.ts` (= moods.test.ts から rename + 新規 API テスト)
- `tests/lib/storage/migrations/v15.test.ts`
- `tests/lib/animation/tag-shutdown/reflow.test.ts`
- `tests/lib/board/tag-candidates.test.ts`
- `tests/lib/board/use-tag-filter.test.ts`
- `tests/components/board/TagFilterBar.test.tsx`
- `tests/components/board/TagAddPopover.test.tsx`
- `tests/components/board/TagButton.test.tsx`

### i18n
- `messages/{ja,en,ko,zh,zh-TW,es,fr,de,it,pt,ru,ar,hi,id,vi}.json` (15 言語、 タグ関連 keys 追加)

---

# Phase 1a — データ層 rename + migration

### Task 1: 型 rename in `lib/storage/indexeddb.ts`

**Files:**
- Modify: `lib/storage/indexeddb.ts`

- [ ] **Step 1: 型と store の rename を一括で行う**

`indexeddb.ts` 内で:
- `MoodRecord` → `TagRecord`
- `MoodInput` → `TagInput`
- store 名 `moods` → `tags`
- `MoodRecord` 型に新規 optional フィールド追加: `theme?: string | null`、 `updatedAt?: number`
- `BookmarkRecord` に新規 optional フィールド追加: `dominantColor?: string | null`

```ts
/** v15: タグマスター (旧 mood、 リネーム済) */
export interface TagRecord {
  id: string
  name: string
  color: string
  order: number
  createdAt: number
  /** v15+: Phase 3 タグ別テーマ用、 Phase 1 では常に null */
  theme?: string | null
  /** v15+: rename / 編集トラッキング用 */
  updatedAt?: number
}

export interface TagInput {
  name: string
  color: string
  order: number
}

// BookmarkRecord に追加
/** v15+: Phase 3 カラーハント用 (ドミナントカラー)、 Phase 1 では常に null/undefined */
dominantColor?: string | null
```

AllMarksDB スキーマ宣言部分も `moods: ...` → `tags: ...` に置換。

- [ ] **Step 2: tsc で型エラーが噴出することを確認** (= 既存参照箇所が大量に出る、 これは想定通り)

Run: `pnpm tsc --noEmit 2>&1 | head -50`
Expected: `MoodRecord` / `MoodInput` / `moods` 等の参照エラーが数十件出る (= rename 連鎖の起点)

- [ ] **Step 3: commit (型のみ rename)**

```bash
rtk git add lib/storage/indexeddb.ts
rtk git commit -m "refactor(storage): MoodRecord → TagRecord rename (型宣言のみ、 関連参照は後続 task で順次)"
```

---

### Task 2: `lib/storage/moods.ts` を `lib/storage/tags.ts` に rename + 新規 API スケルトン

**Files:**
- Delete: `lib/storage/moods.ts`
- Create: `lib/storage/tags.ts`

- [ ] **Step 1: ファイル rename + 関数名 / 型参照を tag ベースに統一**

> ⚠️ **重要**: 物理 store 名 `'moods'` は Task 5 (= migration) で `'tags'` に切替えます。 **このタスクでは store 名は `'moods'` のまま残してください**。 ここで `'tags'` に書き換えると、 Task 5 が走るまで runtime で `NotFoundError` になります (= code reviewer 指摘の罠)。 Task 5 で migration + 同時に tags.ts 内の store 名を `'moods'` → `'tags'` に置換します。

`git mv lib/storage/moods.ts lib/storage/tags.ts` してから:
- `addMood` → `addTag` (戻り値型 `MoodRecord` → `TagRecord`、 引数型 `MoodInput` → `TagInput`)
- `getAllMoods` → `getAllTags`
- `updateMood` → `updateTag`
- `deleteMood` → `deleteTag`
- `reorderMoods` → `reorderTags`
- store 名 `'moods'` → **`'moods'` のまま残す** (= Task 5 で `'tags'` に切替)
- `import type { MoodRecord, MoodInput }` → `import type { TagRecord, TagInput }`

加えて、 `addTag` で `updatedAt: Date.now()` を初期値として書き込む (= 既存 createdAt と同じ値で OK)。

```bash
git mv lib/storage/moods.ts lib/storage/tags.ts
```

そしてエディタで file 内を編集。

- [ ] **Step 2: 新規 API スケルトンを追加 (= シグネチャと minimal 実装のみ、 詳細は次 task)**

```ts
/**
 * 指定 bookmark にタグを 1 件追加する (= 重複は自動でスキップ)。
 */
export async function addTagToBookmark(db: DbLike, bookmarkId: string, tagId: string): Promise<void> {
  const bookmark = await db.get('bookmarks', bookmarkId)
  if (!bookmark) return
  if (bookmark.tags.includes(tagId)) return
  await db.put('bookmarks', { ...bookmark, tags: [...bookmark.tags, tagId] })
}

/**
 * 指定 bookmark からタグを 1 件除去する (= 無ければ no-op)。
 */
export async function removeTagFromBookmark(db: DbLike, bookmarkId: string, tagId: string): Promise<void> {
  const bookmark = await db.get('bookmarks', bookmarkId)
  if (!bookmark) return
  if (!bookmark.tags.includes(tagId)) return
  await db.put('bookmarks', { ...bookmark, tags: bookmark.tags.filter((t: string) => t !== tagId) })
}

export type FilterMode = 'and' | 'or'

/**
 * タグ id のリストで bookmark を絞り込む。
 * - mode='and': 指定タグを全て持つ bookmark のみ
 * - mode='or' : 指定タグのいずれかを持つ bookmark
 * - tagIds 空配列 = 絞り込み無し、 全件返す
 * - isDeleted=true の bookmark は除外
 */
export async function filterBookmarks(
  db: DbLike,
  opts: { tagIds: readonly string[]; mode: FilterMode },
): Promise<BookmarkRecord[]> {
  const all = (await db.getAll('bookmarks')) as BookmarkRecord[]
  const active = all.filter((b) => !b.isDeleted)
  if (opts.tagIds.length === 0) return active
  if (opts.mode === 'and') {
    return active.filter((b) => opts.tagIds.every((tid) => b.tags.includes(tid)))
  }
  return active.filter((b) => opts.tagIds.some((tid) => b.tags.includes(tid)))
}
```

`BookmarkRecord` import を追加 (`import type { BookmarkRecord } from './indexeddb'`)。

- [ ] **Step 3: tsc 確認**

Run: `pnpm tsc --noEmit lib/storage/tags.ts 2>&1 | head -20`
Expected: tags.ts 内のエラー 0 件 (= 他ファイル参照エラーは後続 task で解消)

- [ ] **Step 4: commit**

```bash
rtk git add lib/storage/tags.ts
rtk git rm lib/storage/moods.ts 2>/dev/null || true
rtk git commit -m "refactor(storage): moods.ts → tags.ts rename + addTagToBookmark / removeTagFromBookmark / filterBookmarks 追加"
```

---

### Task 3: `tests/lib/storage/tags.test.ts` で rename 後動作 + 新規 API テスト

**Files:**
- Create: `tests/lib/storage/tags.test.ts` (= moods.test.ts がもしあれば rename ベース、 無ければ新規)

- [ ] **Step 1: 既存 moods.test.ts の有無を確認、 あれば rename**

Run: `ls tests/lib/storage/moods.test.ts 2>&1`

- ファイル存在 → `git mv tests/lib/storage/moods.test.ts tests/lib/storage/tags.test.ts` してから内容を tag 関数名にリネーム
- 存在しない → 新規作成

- [ ] **Step 2: テスト書く (= 失敗する状態で)**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import {
  addTag, getAllTags, updateTag, deleteTag, reorderTags,
  addTagToBookmark, removeTagFromBookmark, filterBookmarks,
} from '@/lib/storage/tags'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

const TEST_DB = 'allmarks-test-tags'

async function makeDb() {
  return await openDB(TEST_DB, 1, {
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
    favicon: '', siteName: '', type: 'website', savedAt: new Date().toISOString(),
    ogpStatus: 'fetched', tags,
  } as BookmarkRecord
}

describe('tags storage', () => {
  let db: Awaited<ReturnType<typeof makeDb>>
  beforeEach(async () => { db = await makeDb() })

  it('addTag creates a tag with given fields', async () => {
    const t = await addTag(db, { name: 'アート', color: '#28F100', order: 0 })
    expect(t.id).toBeDefined()
    expect(t.name).toBe('アート')
    expect(t.createdAt).toBeGreaterThan(0)
    expect(t.updatedAt).toBe(t.createdAt)
  })

  it('getAllTags returns tags sorted by order', async () => {
    await addTag(db, { name: 'b', color: '#fff', order: 1 })
    await addTag(db, { name: 'a', color: '#fff', order: 0 })
    const list = await getAllTags(db)
    expect(list.map((t) => t.name)).toEqual(['a', 'b'])
  })

  it('updateTag merges fields and bumps updatedAt', async () => {
    const t = await addTag(db, { name: 'x', color: '#000', order: 0 })
    await new Promise((r) => setTimeout(r, 2))
    await updateTag(db, t.id, { name: 'y' })
    const list = await getAllTags(db)
    expect(list[0].name).toBe('y')
  })

  it('deleteTag removes the tag', async () => {
    const t = await addTag(db, { name: 'x', color: '#000', order: 0 })
    await deleteTag(db, t.id)
    expect(await getAllTags(db)).toEqual([])
  })

  it('reorderTags assigns new order from id sequence', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    const b = await addTag(db, { name: 'b', color: '#000', order: 1 })
    await reorderTags(db, [b.id, a.id])
    const list = await getAllTags(db)
    expect(list.map((t) => t.name)).toEqual(['b', 'a'])
  })

  it('addTagToBookmark appends if not present', async () => {
    await db.put('bookmarks', makeBookmark('b1', []))
    await addTagToBookmark(db, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['tag-x'])
  })

  it('addTagToBookmark is idempotent (no duplicate)', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['tag-x']))
    await addTagToBookmark(db, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['tag-x'])
  })

  it('removeTagFromBookmark drops the tag if present', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['tag-x', 'tag-y']))
    await removeTagFromBookmark(db, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['tag-y'])
  })

  it('filterBookmarks empty tagIds returns all non-deleted', async () => {
    await db.put('bookmarks', makeBookmark('b1', []))
    await db.put('bookmarks', { ...makeBookmark('b2', []), isDeleted: true })
    const out = await filterBookmarks(db, { tagIds: [], mode: 'and' })
    expect(out.map((b) => b.id)).toEqual(['b1'])
  })

  it('filterBookmarks AND requires all tags', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['a', 'b']))
    await db.put('bookmarks', makeBookmark('b2', ['a']))
    const out = await filterBookmarks(db, { tagIds: ['a', 'b'], mode: 'and' })
    expect(out.map((b) => b.id)).toEqual(['b1'])
  })

  it('filterBookmarks OR matches any tag', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['a']))
    await db.put('bookmarks', makeBookmark('b2', ['b']))
    await db.put('bookmarks', makeBookmark('b3', ['c']))
    const out = await filterBookmarks(db, { tagIds: ['a', 'b'], mode: 'or' })
    expect(out.map((b) => b.id).sort()).toEqual(['b1', 'b2'])
  })
})
```

- [ ] **Step 3: テスト実行、 失敗確認**

Run: `rtk vitest run tests/lib/storage/tags.test.ts`
Expected: 全 11 tests FAIL (= import resolve は通るが、 IDB schema の他参照との不整合等で fail する可能性高い)

- [ ] **Step 4: テストを pass させる微調整** (= tags.ts 実装の bug があれば修正)

期待挙動と一致するまで tags.ts を微調整。 主な確認点:
- `addTag` の戻り値に `updatedAt` が含まれているか
- `updateTag` で `updatedAt: Date.now()` が merge されるか (= 必要なら追加)
- store 名が `'tags'` (複数形) で統一されてるか

- [ ] **Step 5: テスト実行、 全 pass 確認 + commit**

Run: `rtk vitest run tests/lib/storage/tags.test.ts`
Expected: 全 11 PASS

```bash
rtk git add tests/lib/storage/tags.test.ts lib/storage/tags.ts
rtk git commit -m "test(storage): tags 全 API の unit テスト (= rename 後 + 新規 3 API、 全 11 PASS)"
```

---

### Task 4: `lib/storage/use-moods.ts` を `lib/storage/use-tags.ts` に rename

**Files:**
- Delete: `lib/storage/use-moods.ts`
- Create: `lib/storage/use-tags.ts`

- [ ] **Step 1: file rename + 内部参照を tag ベースに**

```bash
git mv lib/storage/use-moods.ts lib/storage/use-tags.ts
```

エディタで:
- `useMoods` → `useTags`
- 内部 state 名 `moods` / `setMoods` → `tags` / `setTags`
- 型参照 `MoodRecord` / `MoodInput` → `TagRecord` / `TagInput`
- import 元 `'./moods'` → `'./tags'`、 関数名 `addMood` → `addTag` 等
- 戻り値オブジェクトのフィールド `moods` → `tags`

- [ ] **Step 2: tsc 確認**

Run: `pnpm tsc --noEmit 2>&1 | grep "use-tags"`
Expected: use-tags.ts 内のエラー 0 件

- [ ] **Step 3: commit**

```bash
rtk git add lib/storage/use-tags.ts
rtk git rm lib/storage/use-moods.ts 2>/dev/null || true
rtk git commit -m "refactor(storage): use-moods.ts → use-tags.ts rename + useMoods → useTags"
```

---

### Task 5: IDB schema bump 14 → 15 + migration

**Files:**
- Modify: `lib/constants.ts`
- Modify: `lib/storage/indexeddb.ts`

- [ ] **Step 1: DB_VERSION 14 → 15**

`lib/constants.ts` で `export const DB_VERSION = 14` を `15` に変更。

- [ ] **Step 2: `indexeddb.ts` の `upgrade()` に v14 → v15 migration を追記**

> ⚠️ **Task 2 step 1 で `lib/storage/tags.ts` 内の store 名は `'moods'` のままです**。 このタスクで migration の `db.createObjectStore('tags', ...)` 完了 + 旧 moods 全件複製が走ったら、 **同じ commit 内で `lib/storage/tags.ts` の store 名を `'moods'` → `'tags'` に sed/edit してください** (= migration と参照切替を atomic に)。 これで Task 5 commit 後の runtime で `'tags'` store が物理存在 + tags.ts が新 store を読む状態になります。

`upgrade(db, oldVersion, _newVersion, transaction)` 内の末尾に追記:

```ts
// ── v14 → v15: moods → tags rename + by-tag index + bookmark.dominantColor 予約 ──
if (oldVersion < 15) {
  // 1. 新 tags store を作成 (= moods と同じ shape)
  const tagsStore = db.createObjectStore('tags', { keyPath: 'id' })
  tagsStore.createIndex('by-order', 'order')

  // 2. 既存 moods の中身を tags に複製
  //    moods store がまだ存在する場合のみ (= 旧バージョンから上がってきた user)
  if (db.objectStoreNames.contains('moods')) {
    const oldStore = transaction.objectStore('moods')
    void oldStore.openCursor().then(function copyToTags(
      cursor: Awaited<ReturnType<typeof oldStore.openCursor>>,
    ): Promise<void> | undefined {
      if (!cursor) return
      const m = cursor.value as { id: string; name: string; color: string; order: number; createdAt: number }
      const t: TagRecord = {
        id: m.id,
        name: m.name,
        color: m.color,
        order: m.order,
        createdAt: m.createdAt,
        updatedAt: m.createdAt,  // v15: 旧 mood は createdAt と同値で初期化
        theme: null,             // v15: Phase 3 用、 常に null
      }
      void cursor.update(undefined as never) // no-op
      // 別 store に書き込み (transaction 内で 2 store 操作可)
      const tagsForCopy = transaction.objectStore('tags')
      void tagsForCopy.put(t)
      return cursor.continue().then(copyToTags)
    })

    // 3. 旧 moods store を削除 (= cursor 完了後に削除する必要があるため、
    //    safety のため別 upgrade 経路で deleteObjectStore は呼ばず、
    //    moods store はそのまま残しても害は無い。
    //    ただし綺麗にするなら次行のコメント解除して削除する)
    // db.deleteObjectStore('moods')
  }

  // 4. bookmark store に by-tag multiEntry index 追加 (= 既に v9 で tags フィールド存在、
  //    だが index は未作成だった想定)
  const bookmarkStore = transaction.objectStore('bookmarks')
  if (!bookmarkStore.indexNames.contains('by-tag')) {
    bookmarkStore.createIndex('by-tag', 'tags', { multiEntry: true })
  }

  // 5. bookmark.dominantColor は schema 上 optional なので、 既存全件は undefined のまま
  //    (= ここで明示的に null fill する必要無し、 Phase 3 抽出時に null → 値 に上書き)
}
```

`AllMarksDB` の DBSchema 宣言にも `tags: { ... }` を追加 (= `moods` は移行期間中残しても可)。

- [ ] **Step 3: tsc 確認**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: indexeddb.ts のエラー 0 件 (= TagRecord 型は Task 1 で既に定義済)

- [ ] **Step 4: commit (まだテスト書いてないので動作未保証だが、 型は OK)**

```bash
rtk git add lib/constants.ts lib/storage/indexeddb.ts
rtk git commit -m "feat(storage): DB_VERSION 14 → 15、 moods → tags 自動 migration + by-tag multiEntry index + dominantColor 予約"
```

---

### Task 6: migration unit テスト (`tests/lib/storage/migrations/v15.test.ts`)

**Files:**
- Create: `tests/lib/storage/migrations/v15.test.ts`

- [ ] **Step 1: テスト書く**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, deleteDB } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'

const TEST_DB = 'AllMarks'  // 本番と同じ名前を fake-indexeddb 上で使う

describe('v15 migration (moods → tags)', () => {
  beforeEach(async () => {
    await deleteDB(TEST_DB)
  })

  it('v14 → v15: moods data copies to tags store with theme=null + updatedAt=createdAt', async () => {
    // v14 で開く (= 旧 schema を模擬)
    const v14 = await openDB(TEST_DB, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) db.createObjectStore('moods', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
          bs.createIndex('by-date', 'savedAt')
        }
      },
    })
    await v14.put('moods', { id: 'm1', name: 'アート', color: '#ff0', order: 0, createdAt: 1000 })
    await v14.put('moods', { id: 'm2', name: '音楽', color: '#0ff', order: 1, createdAt: 2000 })
    v14.close()

    // v15 に上がる (= initDB が migration を走らせる)
    const v15 = await initDB()
    const tags = await v15.getAll('tags')
    expect(tags).toHaveLength(2)
    const art = tags.find((t) => t.name === 'アート')!
    expect(art.color).toBe('#ff0')
    expect(art.order).toBe(0)
    expect(art.createdAt).toBe(1000)
    expect(art.updatedAt).toBe(1000)  // createdAt と同値で初期化
    expect(art.theme).toBeNull()
  })

  it('v14 → v15: bookmark.tags 配列は維持 (= 旧 mood id 参照を壊さない)', async () => {
    const v14 = await openDB(TEST_DB, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) db.createObjectStore('moods', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('bookmarks')) db.createObjectStore('bookmarks', { keyPath: 'id' })
      },
    })
    await v14.put('moods', { id: 'm1', name: 'アート', color: '#ff0', order: 0, createdAt: 1000 })
    await v14.put('bookmarks', {
      id: 'b1', url: 'https://example.com', title: 't', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
      ogpStatus: 'fetched', tags: ['m1'],
    })
    v14.close()

    const v15 = await initDB()
    const b = await v15.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['m1'])  // 既存参照は維持
    expect(b?.dominantColor).toBeUndefined()  // Phase 1 では空欄
  })

  it('v14 → v15: bookmark store に by-tag multiEntry index が作られる', async () => {
    const v14 = await openDB(TEST_DB, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) db.createObjectStore('moods', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('bookmarks')) db.createObjectStore('bookmarks', { keyPath: 'id' })
      },
    })
    v14.close()

    const v15 = await initDB()
    const bookmarkStore = v15.transaction('bookmarks').objectStore('bookmarks')
    expect(bookmarkStore.indexNames.contains('by-tag')).toBe(true)
  })

  it('既存 user データ (= 200 ブクマ + 10 タグ) で migration が壊れない', async () => {
    const v14 = await openDB(TEST_DB, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) db.createObjectStore('moods', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('bookmarks')) db.createObjectStore('bookmarks', { keyPath: 'id' })
      },
    })
    for (let i = 0; i < 10; i++) {
      await v14.put('moods', { id: `m${i}`, name: `tag${i}`, color: '#fff', order: i, createdAt: 1000 + i })
    }
    for (let i = 0; i < 200; i++) {
      await v14.put('bookmarks', {
        id: `b${i}`, url: `https://example.com/${i}`, title: `t${i}`, description: '', thumbnail: '',
        favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
        ogpStatus: 'fetched', tags: [`m${i % 10}`],
      })
    }
    v14.close()

    const v15 = await initDB()
    const tags = await v15.getAll('tags')
    const bookmarks = await v15.getAll('bookmarks')
    expect(tags).toHaveLength(10)
    expect(bookmarks).toHaveLength(200)
  })
})
```

- [ ] **Step 2: 実行、 fail なら migration 実装を修正**

Run: `rtk vitest run tests/lib/storage/migrations/v15.test.ts`

cursor 周りの async timing で `updateを呼ばずに別 store に put する` 部分の挙動を要確認。 idb library の transaction handling に注意 (= openCursor の callback 内で別 store への put は同 transaction でないと失敗)。

実装を以下のように修正する可能性:

```ts
if (oldVersion < 15) {
  const tagsStore = db.createObjectStore('tags', { keyPath: 'id' })
  tagsStore.createIndex('by-order', 'order')

  if (db.objectStoreNames.contains('moods')) {
    const oldStore = transaction.objectStore('moods')
    const tagsForCopy = transaction.objectStore('tags')
    // openCursor + put は同 transaction なので OK
    let cursor = await oldStore.openCursor()
    while (cursor) {
      const m = cursor.value
      await tagsForCopy.put({
        id: m.id, name: m.name, color: m.color, order: m.order,
        createdAt: m.createdAt, updatedAt: m.createdAt, theme: null,
      })
      cursor = await cursor.continue()
    }
  }

  const bookmarkStore = transaction.objectStore('bookmarks')
  if (!bookmarkStore.indexNames.contains('by-tag')) {
    bookmarkStore.createIndex('by-tag', 'tags', { multiEntry: true })
  }
}
```

注意: `upgrade` callback は `async` にできない (= idb の仕様)。 上記の `await` は `transaction.done` の前なら同期的にチェーンする必要あり。 詳細は `idb` ドキュメント参照、 既存 v8 / v9 migration のパターンを真似る。

- [ ] **Step 3: 全 4 テスト PASS 確認 + commit**

Run: `rtk vitest run tests/lib/storage/migrations/v15.test.ts`
Expected: 全 4 PASS

```bash
rtk git add tests/lib/storage/migrations/v15.test.ts lib/storage/indexeddb.ts
rtk git commit -m "test(storage): v15 migration unit テスト (= moods → tags 複製 / bookmark.tags 維持 / by-tag index / 200 件動作)"
```

---

### Task 7: 既存 UI ファイルの mood → tag 参照 rename

**Files:**
- Modify: `components/board/Sidebar.tsx`
- Modify: `components/board/Sidebar.module.css` (= class 名に mood が含まれる可能性、 grep)
- Modify: `components/board/FilterPill.tsx`
- Modify: `components/board/CardsLayer.tsx`
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/Lightbox.tsx`

- [ ] **Step 1: 影響範囲を grep で全列挙**

Run: `rg -l "useMoods|MoodRecord|MoodInput|addMood|getAllMoods|updateMood|deleteMood|reorderMoods|'moods'|\"moods\"" --type ts --type tsx`

Expected: 上記 5 file が全部出てくる + 他にも参照あれば追加対象

- [ ] **Step 2: 各 file で機械的 rename を行う**

| 旧 | 新 |
|---|---|
| `useMoods` | `useTags` |
| `MoodRecord` | `TagRecord` |
| `MoodInput` | `TagInput` |
| `import { ... } from '@/lib/storage/use-moods'` | `'@/lib/storage/use-tags'` |
| `import { ... } from '@/lib/storage/moods'` | `'@/lib/storage/tags'` |
| 戻り値オブジェクト `.moods` | `.tags` |
| 変数 `mood` / `moods` | `tag` / `tags` |

CSS Modules の class 名 (= `.moodChip` 等) はそのままでも動くが、 統一感のため `.tagChip` 等に rename。 ただし大量の場合は Phase 1 では参照のみ rename、 class 名は Task 23 (= BoardRoot 配線) 時に整理。

- [ ] **Step 3: tsc 確認**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: 0 件 error (= mood 参照全部解消)

- [ ] **Step 4: 既存 vitest 全実行**

Run: `rtk vitest run`
Expected: 既存テスト全 PASS (= mood UI の挙動が tag rename 後も維持されている保証)

NG なら個別 fail を deeper diagnostic で潰す。 典型 fix: test ファイル内の mood 参照を tag に rename し忘れた case。

- [ ] **Step 5: build 確認**

Run: `rtk pnpm build`
Expected: success、 `out/` ディレクトリに静的ファイル生成

- [ ] **Step 6: commit**

```bash
rtk git add components/board/Sidebar.tsx components/board/FilterPill.tsx components/board/CardsLayer.tsx components/board/BoardRoot.tsx components/board/Lightbox.tsx
rtk git commit -m "refactor(board): UI 5 files の mood 参照を tag に rename (= 挙動不変、 vitest 全 PASS)"
```

---

# Phase 1b — filter state hook + tag candidates

### Task 8: `lib/board/use-tag-filter.ts` 実装

**Files:**
- Create: `lib/board/use-tag-filter.ts`
- Create: `tests/lib/board/use-tag-filter.test.ts`

- [ ] **Step 1: test 書く**

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTagFilter } from '@/lib/board/use-tag-filter'

describe('useTagFilter', () => {
  it('初期 state は タグ空配列 + mode=and', () => {
    const { result } = renderHook(() => useTagFilter())
    expect(result.current.selectedTagIds).toEqual([])
    expect(result.current.mode).toBe('and')
  })

  it('toggleTag は未選択タグを追加', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.toggleTag('t1'))
    expect(result.current.selectedTagIds).toEqual(['t1'])
  })

  it('toggleTag は既選択タグを除去', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.toggleTag('t1'))
    act(() => result.current.toggleTag('t1'))
    expect(result.current.selectedTagIds).toEqual([])
  })

  it('setMode は mode を切替', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.setMode('or'))
    expect(result.current.mode).toBe('or')
  })

  it('clearAll は state を初期化', () => {
    const { result } = renderHook(() => useTagFilter())
    act(() => result.current.toggleTag('t1'))
    act(() => result.current.setMode('or'))
    act(() => result.current.clearAll())
    expect(result.current.selectedTagIds).toEqual([])
    expect(result.current.mode).toBe('and')
  })

  it('isActive は絞り込み中かを返す', () => {
    const { result } = renderHook(() => useTagFilter())
    expect(result.current.isActive).toBe(false)
    act(() => result.current.toggleTag('t1'))
    expect(result.current.isActive).toBe(true)
  })
})
```

- [ ] **Step 2: 実行、 fail 確認**

Run: `rtk vitest run tests/lib/board/use-tag-filter.test.ts`
Expected: 全 fail (`Cannot find module ... use-tag-filter`)

- [ ] **Step 3: 実装書く**

```ts
'use client'
import { useCallback, useMemo, useState } from 'react'
import type { FilterMode } from '@/lib/storage/tags'

export function useTagFilter(): {
  selectedTagIds: readonly string[]
  mode: FilterMode
  toggleTag: (tagId: string) => void
  setMode: (mode: FilterMode) => void
  clearAll: () => void
  isActive: boolean
} {
  const [selectedTagIds, setSelected] = useState<readonly string[]>([])
  const [mode, setMode] = useState<FilterMode>('and')

  const toggleTag = useCallback((tagId: string): void => {
    setSelected((prev) => {
      if (prev.includes(tagId)) return prev.filter((id) => id !== tagId)
      return [...prev, tagId]
    })
  }, [])

  const clearAll = useCallback((): void => {
    setSelected([])
    setMode('and')
  }, [])

  const isActive = useMemo(() => selectedTagIds.length > 0, [selectedTagIds])

  return { selectedTagIds, mode, toggleTag, setMode, clearAll, isActive }
}
```

- [ ] **Step 4: 全 6 test PASS + commit**

Run: `rtk vitest run tests/lib/board/use-tag-filter.test.ts`

```bash
rtk git add lib/board/use-tag-filter.ts tests/lib/board/use-tag-filter.test.ts
rtk git commit -m "feat(board): useTagFilter hook (= selectedTagIds + mode + toggleTag + clearAll + isActive)"
```

---

### Task 9: `lib/board/tag-candidates.ts` 実装

**Files:**
- Create: `lib/board/tag-candidates.ts`
- Create: `tests/lib/board/tag-candidates.test.ts`

- [ ] **Step 1: test 書く**

```ts
import { describe, it, expect } from 'vitest'
import { extractCandidatesFromBookmark, scoreSimilarBookmarks } from '@/lib/board/tag-candidates'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

function mk(id: string, fields: Partial<BookmarkRecord>): BookmarkRecord {
  return {
    id, url: 'https://example.com', title: '', description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags: [], ...fields,
  } as BookmarkRecord
}

describe('extractCandidatesFromBookmark', () => {
  it('Twitter ハッシュタグを抽出', () => {
    const b = mk('b1', { title: '#アート と #デザイン の話', type: 'tweet' })
    expect(extractCandidatesFromBookmark(b)).toEqual(['アート', 'デザイン'])
  })

  it('YouTube は siteName + チャンネル名候補', () => {
    const b = mk('b1', { siteName: 'YouTube', title: 'Lo-Fi Chill Music by ChillBeats', type: 'youtube' })
    const c = extractCandidatesFromBookmark(b)
    expect(c).toContain('YouTube')
  })

  it('OGP siteName を最初に出す', () => {
    const b = mk('b1', { siteName: 'Vimeo', type: 'website' })
    const c = extractCandidatesFromBookmark(b)
    expect(c[0]).toBe('Vimeo')
  })

  it('重複は dedupe', () => {
    const b = mk('b1', { title: '#test #test', siteName: 'test', type: 'tweet' })
    const c = extractCandidatesFromBookmark(b)
    expect(new Set(c).size).toBe(c.length)
  })

  it('siteName 無し + ハッシュタグ無し = 空配列', () => {
    const b = mk('b1', { title: '普通のテキスト', type: 'website' })
    expect(extractCandidatesFromBookmark(b)).toEqual([])
  })
})

describe('scoreSimilarBookmarks', () => {
  it('同ドメインで頻出するタグを上位に', () => {
    const target = mk('b1', { url: 'https://example.com/x' })
    const corpus = [
      mk('a1', { url: 'https://example.com/a', tags: ['アート', 'デザイン'] }),
      mk('a2', { url: 'https://example.com/b', tags: ['アート'] }),
      mk('a3', { url: 'https://other.com/c', tags: ['全然関係ない'] }),
    ]
    const scored = scoreSimilarBookmarks(target, corpus)
    expect(scored[0]).toBe('アート')
  })

  it('target 自身は除外', () => {
    const target = mk('b1', { url: 'https://example.com/x', tags: ['x'] })
    const scored = scoreSimilarBookmarks(target, [target])
    expect(scored).toEqual([])
  })
})
```

- [ ] **Step 2: fail 確認**

Run: `rtk vitest run tests/lib/board/tag-candidates.test.ts`
Expected: 全 fail

- [ ] **Step 3: 実装書く**

```ts
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

/** Twitter ハッシュタグ抽出 (= `#word` を捕捉、 空白 / 文末で区切る) */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#([^\s#]+)/g) ?? []
  return matches.map((m) => m.slice(1))
}

/** URL のドメイン部分を抽出 (= 失敗時 空文字) */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * bookmark 単体から「初出のタグ候補」 を抽出。
 * - Twitter / X ならハッシュタグ
 * - OGP siteName があれば最初に
 * - YouTube / Vimeo 等の siteName も拾う
 * 重複は dedupe、 順序は (siteName, ハッシュタグ) の順。
 */
export function extractCandidatesFromBookmark(b: BookmarkRecord): string[] {
  const out: string[] = []
  const push = (s: string): void => {
    if (s && !out.includes(s)) out.push(s)
  }

  if (b.siteName) push(b.siteName)

  if (b.type === 'tweet') {
    extractHashtags(b.title).forEach(push)
    extractHashtags(b.description).forEach(push)
  }

  return out
}

/**
 * 既存 bookmark 群から、 target に「関連が高そうな」 既存タグを上位に並べる。
 * - 同じドメインのブクマで頻出するタグを優先
 * - target 自身は除外
 * - target の tags に既に含まれてるものは除外
 */
export function scoreSimilarBookmarks(target: BookmarkRecord, corpus: readonly BookmarkRecord[]): string[] {
  const targetHost = hostnameOf(target.url)
  const counts = new Map<string, number>()
  for (const b of corpus) {
    if (b.id === target.id) continue
    if (target.tags.includes(...(b.tags as string[]))) continue
    const sameHost = targetHost && hostnameOf(b.url) === targetHost
    const weight = sameHost ? 3 : 1
    for (const t of b.tags) {
      if (target.tags.includes(t)) continue
      counts.set(t, (counts.get(t) ?? 0) + weight)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
}
```

- [ ] **Step 4: 全 7 test PASS + commit**

```bash
rtk git add lib/board/tag-candidates.ts tests/lib/board/tag-candidates.test.ts
rtk git commit -m "feat(board): tag-candidates (= ハッシュタグ抽出 + siteName + 同ドメイン頻出スコアリング)"
```

---

# Phase 1c — アニメ層 (WAVE CRT shutdown + FLIP reflow)

### Task 10: `lib/animation/tag-shutdown/themes/wave.module.css` (= F6 keyframes)

**Files:**
- Create: `lib/animation/tag-shutdown/themes/wave.module.css`

- [ ] **Step 1: spec の F6 + 業界 best (lbebber 派生) に基づき keyframes 実装**

```css
/* WAVE テーマ用 CRT shutdown effect.
   spec: docs/superpowers/specs/2026-05-25-tagging-design.md §「アニメ層設計」
   触る数値は :root の CSS 変数経由のみ。 */

:root {
  --tag-shutdown-duration: 0.55s;
  --tag-shutdown-stretch-y: 1.3;
  --tag-shutdown-easing: cubic-bezier(0.230, 1.000, 0.320, 1.000);
  --tag-shutdown-easing-end: cubic-bezier(0.755, 0.050, 0.855, 0.060);
  --tag-shutdown-flash-color: #28F100;
  --tag-shutdown-stagger-step: 30ms;
  --tag-shutdown-scanline-intensity: 0.4;
  --tag-shutdown-flicker-intensity: 0.5;
}

/* 適用対象: [data-tagged-out="true"] のカードのみ。
   通常状態 / 該当カード / ボード背景には一切影響させない。 */
.shutdown {
  animation: lbebber-green var(--tag-shutdown-duration) var(--tag-shutdown-easing) forwards;
  transform-origin: center;
  position: relative;
}

@keyframes lbebber-green {
  0% {
    transform: scale(1, 1);
    filter: brightness(1);
    opacity: 1;
  }
  /* warm glitch (= AllMarks 既存 chromatic aberration 言語) */
  10% {
    transform: translate(2px, -1px);
    box-shadow: -2px 0 0 #ff3a5a, 2px 0 0 #5aefff;
  }
  15% {
    transform: translate(-2px, 1px);
    box-shadow: 2px 0 0 #ff3a5a, -2px 0 0 #5aefff;
    opacity: 0.9;
  }
  /* 縦膨らみ */
  25% {
    transform: scale(1, var(--tag-shutdown-stretch-y));
    filter: brightness(1.2);
    background: #1f3a1f;
    box-shadow: 0 0 8px rgba(40, 241, 0, 0.4);
    opacity: 1;
  }
  /* 横膨らんで水平線 + 緑 flash */
  50% {
    transform: scale(1.3, 0.02);
    filter: brightness(8) saturate(2);
    background: var(--tag-shutdown-flash-color);
    box-shadow: 0 0 24px var(--tag-shutdown-flash-color), 0 0 48px rgba(40, 241, 0, 0.6);
    opacity: 1;
    animation-timing-function: var(--tag-shutdown-easing-end);
  }
  /* 点化 */
  75% {
    transform: scale(0.001, 0.001);
    filter: brightness(30);
    background: var(--tag-shutdown-flash-color);
    box-shadow: 0 0 12px var(--tag-shutdown-flash-color);
    opacity: 1;
  }
  /* 消滅 */
  100% {
    transform: scale(0, 0);
    opacity: 0;
    filter: brightness(1);
    box-shadow: none;
  }
}

/* shutdown 中だけ可視の scanline overlay (= 該当カードや通常時には絶対乗らない) */
.shutdown::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, calc(0.4 * var(--tag-shutdown-scanline-intensity))) 50%),
    linear-gradient(90deg, rgba(255, 0, 0, 0.12), rgba(0, 255, 0, 0.04), rgba(0, 0, 255, 0.12));
  background-size: 100% 2px, 3px 100%;
  pointer-events: none;
  z-index: 4;
  border-radius: inherit;
  opacity: 1;
  animation: scanline-fade var(--tag-shutdown-duration) linear forwards;
}

@keyframes scanline-fade {
  0%, 90% { opacity: 1; }
  100% { opacity: 0; }
}

/* shutdown 中だけ可視の flicker overlay (= aleclownes 業界正規値、 7Hz) */
.shutdown::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.05);
  pointer-events: none;
  z-index: 5;
  border-radius: inherit;
  opacity: 0;
  animation: flicker-burst var(--tag-shutdown-duration) linear forwards;
}

@keyframes flicker-burst {
  0% { opacity: 0; }
  5% { opacity: calc(0.27 * var(--tag-shutdown-flicker-intensity)); }
  10% { opacity: calc(0.88 * var(--tag-shutdown-flicker-intensity)); }
  15% { opacity: calc(0.13 * var(--tag-shutdown-flicker-intensity)); }
  25% { opacity: calc(0.67 * var(--tag-shutdown-flicker-intensity)); }
  35% { opacity: calc(0.91 * var(--tag-shutdown-flicker-intensity)); }
  45% { opacity: calc(0.07 * var(--tag-shutdown-flicker-intensity)); }
  60% { opacity: calc(0.62 * var(--tag-shutdown-flicker-intensity)); }
  75% { opacity: calc(0.55 * var(--tag-shutdown-flicker-intensity)); }
  90%, 100% { opacity: 0; }
}

/* prefers-reduced-motion: 視覚過敏 user 配慮、 すべて単純フェードに置換 */
@media (prefers-reduced-motion: reduce) {
  .shutdown {
    animation: simple-fade-out var(--tag-shutdown-duration) ease-out forwards;
  }
  .shutdown::before,
  .shutdown::after {
    animation: none;
    opacity: 0;
  }
  @keyframes simple-fade-out {
    0% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.98); }
  }
}
```

- [ ] **Step 2: commit (= CSS 単体、 まだ参照されない)**

```bash
rtk git add lib/animation/tag-shutdown/themes/wave.module.css
rtk git commit -m "feat(animation): WAVE テーマ CRT shutdown CSS (= F6 + scanline + flicker + reduced-motion 対応 + CSS 変数調整可)"
```

---

### Task 11: `lib/animation/tag-shutdown/index.ts` (= theme key → CSS class API)

**Files:**
- Create: `lib/animation/tag-shutdown/index.ts`
- Create: `tests/lib/animation/tag-shutdown/index.test.ts`

- [ ] **Step 1: test 書く**

```ts
import { describe, it, expect } from 'vitest'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'

describe('getShutdownAnimationClass', () => {
  it('wave テーマで CSS class が返る', () => {
    const c = getShutdownAnimationClass('wave')
    expect(c).toMatch(/shutdown/)
  })

  it('未対応テーマ key では undefined フォールバック (= shutdown アニメ無し)', () => {
    const c = getShutdownAnimationClass('forest')
    expect(c).toBeUndefined()
  })
})
```

- [ ] **Step 2: 実装書く**

```ts
import waveStyles from './themes/wave.module.css'

export type SupportedTheme = 'wave'

/**
 * テーマ key を渡すと、 そのテーマの shutdown CSS class 名を返す。
 * - 未対応 theme は undefined (= shutdown アニメ無しのフォールバック、
 *   非該当カードは即座に display:none する等で対応する)。
 * - Phase 3 で他テーマ追加時は themes/{theme}.module.css を足して
 *   このファイルの switch に case 追加するだけ。
 */
export function getShutdownAnimationClass(theme: string): string | undefined {
  switch (theme) {
    case 'wave':
      return waveStyles.shutdown
    default:
      return undefined
  }
}
```

- [ ] **Step 3: 全 2 PASS + commit**

```bash
rtk git add lib/animation/tag-shutdown/index.ts tests/lib/animation/tag-shutdown/index.test.ts
rtk git commit -m "feat(animation): getShutdownAnimationClass(theme) = テーマ key から shutdown CSS class を引く"
```

---

### Task 12: `lib/animation/tag-shutdown/reflow.ts` (= FLIP reflow)

**Files:**
- Create: `lib/animation/tag-shutdown/reflow.ts`
- Create: `tests/lib/animation/tag-shutdown/reflow.test.ts`

- [ ] **Step 1: 既存 masonry FLIP 実装の場所を確認**

Run: `rg "FLIP|getBoundingClientRect" components/board lib/board --type ts --type tsx -l`

既存 FLIP 実装があれば流用、 無ければ独立実装。 想定: `BoardRoot.tsx` や `CardsLayer.tsx` で reorder 時 FLIP がある可能性。

- [ ] **Step 2: test 書く**

```ts
import { describe, it, expect, vi } from 'vitest'
import { runFlipReflow } from '@/lib/animation/tag-shutdown/reflow'

describe('runFlipReflow', () => {
  it('要素の rect 差分から transform を計算し animate.fillMode=forwards で適用', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: vi.fn().mockReturnValueOnce({ left: 100, top: 200, width: 50, height: 50 })
                       .mockReturnValueOnce({ left: 150, top: 250, width: 50, height: 50 }),
    })
    el.animate = vi.fn().mockReturnValue({ finished: Promise.resolve() })

    const first = el.getBoundingClientRect()
    // ここで element が DOM 上で移動 (シミュレーション)
    runFlipReflow(el, first, 400, 'ease-out')

    expect(el.animate).toHaveBeenCalledWith(
      [
        { transform: 'translate(-50px, -50px)' },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 400, easing: 'ease-out', fill: 'forwards' },
    )
  })

  it('rect が同じなら animate 呼ばれない (= 動かない)', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 200, width: 50, height: 50 }),
    })
    el.animate = vi.fn()
    const first = el.getBoundingClientRect()
    runFlipReflow(el, first, 400, 'ease-out')
    expect(el.animate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 実装書く**

```ts
/**
 * FLIP (First-Last-Invert-Play) reflow を 1 要素に対して実行。
 *
 * 使い方:
 * 1. 並び替え前に各要素の rect を取得 (first)
 * 2. 並び替え (= DOM 上で位置変化)
 * 3. この関数を呼ぶ (= 内部で last rect を取得、 差分を逆方向 transform で適用 → 0 に向かって animate)
 *
 * @param el 要素
 * @param first 並び替え前の getBoundingClientRect() 結果
 * @param duration アニメ時間 (ms)、 default 400
 * @param easing easing 名、 default 'cubic-bezier(0.4, 0, 0.2, 1)'
 * @returns Animation Promise (完了で resolve)
 */
export function runFlipReflow(
  el: HTMLElement,
  first: DOMRect,
  duration = 400,
  easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
): Promise<void> {
  const last = el.getBoundingClientRect()
  const dx = first.left - last.left
  const dy = first.top - last.top
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    return Promise.resolve()
  }
  const anim = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration, easing, fill: 'forwards' },
  )
  return anim.finished.then(() => undefined).catch(() => undefined)
}
```

注: test の transform 値 (`-50px, -50px`) と一致するように `first.left - last.left = 100 - 150 = -50` で正しい。

- [ ] **Step 4: 全 2 PASS + commit**

```bash
rtk git add lib/animation/tag-shutdown/reflow.ts tests/lib/animation/tag-shutdown/reflow.test.ts
rtk git commit -m "feat(animation): runFlipReflow (= 1 要素の FLIP 移動を Web Animations API で適用)"
```

---

# Phase 1d — UI 層 (filter bar / popover / TAG button / i18n)

### Task 13: `components/board/TagFilterBar/` 実装

**Files:**
- Create: `components/board/TagFilterBar/index.tsx`
- Create: `components/board/TagFilterBar/TagFilterBar.module.css`
- Create: `tests/components/board/TagFilterBar.test.tsx`

- [ ] **Step 1: test 書く**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagFilterBar } from '@/components/board/TagFilterBar'
import type { TagRecord } from '@/lib/storage/indexeddb'

const tags: TagRecord[] = [
  { id: 't1', name: 'アート', color: '#28F100', order: 0, createdAt: 1 },
  { id: 't2', name: '音楽', color: '#28F100', order: 1, createdAt: 2 },
]

describe('TagFilterBar', () => {
  it('全タグの chip を表示', () => {
    render(<TagFilterBar tags={tags} selectedTagIds={[]} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={0} matchCount={0} />)
    expect(screen.getByText('アート')).toBeInTheDocument()
    expect(screen.getByText('音楽')).toBeInTheDocument()
  })

  it('chip click で onToggle が呼ばれる', () => {
    const onToggle = vi.fn()
    render(<TagFilterBar tags={tags} selectedTagIds={[]} mode="and" onToggle={onToggle} onModeChange={() => {}} onClearAll={() => {}} totalCount={0} matchCount={0} />)
    fireEvent.click(screen.getByText('アート'))
    expect(onToggle).toHaveBeenCalledWith('t1')
  })

  it('選択中タグには data-selected="true" 属性', () => {
    render(<TagFilterBar tags={tags} selectedTagIds={['t1']} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={10} matchCount={3} />)
    const chip = screen.getByText('アート').closest('[data-selected]')
    expect(chip?.getAttribute('data-selected')).toBe('true')
  })

  it('絞り込み中はカウンタと解除ボタン表示', () => {
    render(<TagFilterBar tags={tags} selectedTagIds={['t1']} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={47} matchCount={3} />)
    expect(screen.getByText(/47.*3/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear|解除/i })).toBeInTheDocument()
  })

  it('AND/OR トグル click で onModeChange', () => {
    const onModeChange = vi.fn()
    render(<TagFilterBar tags={tags} selectedTagIds={['t1', 't2']} mode="and" onToggle={() => {}} onModeChange={onModeChange} onClearAll={() => {}} totalCount={10} matchCount={2} />)
    fireEvent.click(screen.getByRole('button', { name: /AND|OR/i }))
    expect(onModeChange).toHaveBeenCalledWith('or')
  })

  it('タグ 0 件なら bar 自体表示しない', () => {
    const { container } = render(<TagFilterBar tags={[]} selectedTagIds={[]} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={0} matchCount={0} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: 実装書く**

```tsx
'use client'
import type { TagRecord } from '@/lib/storage/indexeddb'
import type { FilterMode } from '@/lib/storage/tags'
import styles from './TagFilterBar.module.css'

export interface TagFilterBarProps {
  tags: readonly TagRecord[]
  selectedTagIds: readonly string[]
  mode: FilterMode
  onToggle: (tagId: string) => void
  onModeChange: (mode: FilterMode) => void
  onClearAll: () => void
  totalCount: number
  matchCount: number
}

export function TagFilterBar({
  tags, selectedTagIds, mode, onToggle, onModeChange, onClearAll, totalCount, matchCount,
}: TagFilterBarProps): JSX.Element | null {
  if (tags.length === 0) return null
  const isActive = selectedTagIds.length > 0

  return (
    <div className={styles.bar}>
      <div className={styles.chipScroll}>
        {tags.map((t) => {
          const selected = selectedTagIds.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className={styles.chip}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => onToggle(t.id)}
            >
              {t.name}
            </button>
          )
        })}
      </div>
      {isActive && (
        <div className={styles.controls}>
          {selectedTagIds.length >= 2 && (
            <button
              type="button"
              className={styles.modeToggle}
              onClick={() => onModeChange(mode === 'and' ? 'or' : 'and')}
              aria-label={mode === 'and' ? 'Switch to OR' : 'Switch to AND'}
            >
              {mode === 'and' ? 'AND' : 'OR'}
            </button>
          )}
          <span className={styles.counter}>{totalCount} / {matchCount}</span>
          <button type="button" className={styles.clear} onClick={onClearAll} aria-label="Clear all filters">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: CSS 書く**

```css
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  pointer-events: auto;
  font-size: 13px;
}
.chipScroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  max-width: 60vw;
  scrollbar-width: none;
}
.chipScroll::-webkit-scrollbar { display: none; }
.chip {
  appearance: none;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ddd;
  padding: 4px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 0.06em;
  white-space: nowrap;
  transition: background 120ms, border-color 120ms, box-shadow 120ms;
}
.chip:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.24);
}
.chip[data-selected="true"] {
  background: rgba(40, 241, 0, 0.16);
  border-color: rgba(40, 241, 0, 0.6);
  color: #28F100;
  box-shadow: 0 0 12px rgba(40, 241, 0, 0.3);
}
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.modeToggle {
  appearance: none;
  background: rgba(40, 241, 0, 0.16);
  border: 1px solid rgba(40, 241, 0, 0.6);
  color: #28F100;
  padding: 2px 8px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  letter-spacing: 0.12em;
}
.counter {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.clear {
  appearance: none;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  width: 22px;
  height: 22px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.clear:hover {
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}
```

- [ ] **Step 4: 全 6 PASS + commit**

```bash
rtk git add components/board/TagFilterBar/ tests/components/board/TagFilterBar.test.tsx
rtk git commit -m "feat(board): TagFilterBar (= chip + AND/OR トグル + カウンタ + 解除ボタン)"
```

---

### Task 14: `components/board/TagAddPopover/` 実装

**Files:**
- Create: `components/board/TagAddPopover/index.tsx`
- Create: `components/board/TagAddPopover/TagAddPopover.module.css`
- Create: `tests/components/board/TagAddPopover.test.tsx`

- [ ] **Step 1: test 書く**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagAddPopover } from '@/components/board/TagAddPopover'
import type { TagRecord } from '@/lib/storage/indexeddb'

const allTags: TagRecord[] = [
  { id: 't1', name: 'アート', color: '#28F100', order: 0, createdAt: 1 },
]

describe('TagAddPopover', () => {
  it('既存タグ + 元サイト候補 + 新規入力欄を表示', () => {
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        siteCandidates={['YouTube']}
        onAddExisting={() => {}}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('アート')).toBeInTheDocument()
    expect(screen.getByText('YouTube')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/new|新規/i)).toBeInTheDocument()
  })

  it('既存タグ click で onAddExisting', () => {
    const onAdd = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        siteCandidates={[]}
        onAddExisting={onAdd}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('アート'))
    expect(onAdd).toHaveBeenCalledWith('t1')
  })

  it('元サイト候補 click で onAddNew (= 文字列で渡す)', () => {
    const onAddNew = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        siteCandidates={['YouTube']}
        onAddExisting={() => {}}
        onAddNew={onAddNew}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('YouTube'))
    expect(onAddNew).toHaveBeenCalledWith('YouTube')
  })

  it('新規入力 + Enter で onAddNew', () => {
    const onAddNew = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        siteCandidates={[]}
        onAddExisting={() => {}}
        onAddNew={onAddNew}
        onClose={() => {}}
      />,
    )
    const input = screen.getByPlaceholderText(/new|新規/i)
    fireEvent.change(input, { target: { value: '新しいタグ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAddNew).toHaveBeenCalledWith('新しいタグ')
  })

  it('既に付いてるタグは「✓」 マーク表示 + click で onAddExisting (= toggle off は親側責務)', () => {
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={['t1']}
        siteCandidates={[]}
        onAddExisting={() => {}}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    const chip = screen.getByText('アート').closest('button')
    expect(chip?.textContent).toContain('✓')
  })

  it('Esc キーで onClose', () => {
    const onClose = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        siteCandidates={[]}
        onAddExisting={() => {}}
        onAddNew={() => {}}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 実装書く**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './TagAddPopover.module.css'

export interface TagAddPopoverProps {
  allTags: readonly TagRecord[]
  currentTagIds: readonly string[]
  siteCandidates: readonly string[]
  onAddExisting: (tagId: string) => void
  onAddNew: (name: string) => void
  onClose: () => void
}

export function TagAddPopover({
  allTags, currentTagIds, siteCandidates, onAddExisting, onAddNew, onClose,
}: TagAddPopoverProps): JSX.Element {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key !== 'Enter') return
    const value = input.trim()
    if (!value) return
    onAddNew(value)
    setInput('')
  }

  const newCandidates = siteCandidates.filter((s) => !allTags.some((t) => t.name === s))

  return (
    <div className={styles.popover} role="dialog">
      {allTags.length > 0 && (
        <div className={styles.section}>
          {allTags.map((t) => {
            const has = currentTagIds.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                className={styles.chip}
                data-has={has ? 'true' : 'false'}
                onClick={() => onAddExisting(t.id)}
              >
                {has ? '✓ ' : ''}{t.name}
              </button>
            )
          })}
        </div>
      )}
      {newCandidates.length > 0 && (
        <div className={styles.section}>
          {newCandidates.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.chipNew}
              onClick={() => onAddNew(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder="new tag…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleEnter}
      />
    </div>
  )
}
```

- [ ] **Step 3: CSS**

```css
.popover {
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 100;
}
.section {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip, .chipNew {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: #ddd;
  padding: 3px 8px;
  border-radius: 2px;
  font-size: 11px;
  cursor: pointer;
  transition: background 100ms, border-color 100ms;
}
.chip:hover, .chipNew:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
}
.chip[data-has="true"] {
  background: rgba(40, 241, 0, 0.16);
  border-color: rgba(40, 241, 0, 0.6);
  color: #28F100;
}
.chipNew {
  border-style: dashed;
  border-color: rgba(40, 241, 0, 0.4);
  color: rgba(40, 241, 0, 0.85);
}
.input {
  appearance: none;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  padding: 4px 8px;
  border-radius: 2px;
  font-size: 12px;
  outline: none;
}
.input:focus {
  border-color: rgba(40, 241, 0, 0.6);
}
```

- [ ] **Step 4: 全 6 PASS + commit**

```bash
rtk git add components/board/TagAddPopover/ tests/components/board/TagAddPopover.test.tsx
rtk git commit -m "feat(board): TagAddPopover (= 既存 + サイト候補 + 新規入力 + Esc 閉じ)"
```

---

### Task 15: `components/board/TagButton/` (= chrome の TAG ボタン)

**Files:**
- Create: `components/board/TagButton/index.tsx`
- Create: `components/board/TagButton/TagButton.module.css`
- Create: `tests/components/board/TagButton.test.tsx`

- [ ] **Step 1: test 書く**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagButton } from '@/components/board/TagButton'

describe('TagButton', () => {
  it('TAG ラベル表示', () => {
    render(<TagButton onClick={() => {}} />)
    expect(screen.getByText('TAG')).toBeInTheDocument()
  })
  it('click で onClick', () => {
    const fn = vi.fn()
    render(<TagButton onClick={fn} />)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 実装 (= 既存 `ChromeButton.tsx` の系統に合わせる、 plan 実装者は既存 ChromeButton.tsx を参考にして同じ styling 系統を踏襲)**

```tsx
'use client'
import styles from './TagButton.module.css'

export interface TagButtonProps {
  onClick: () => void
  active?: boolean
}

export function TagButton({ onClick, active }: TagButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={styles.button}
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
      aria-label="Open tag management"
    >
      TAG
    </button>
  )
}
```

```css
.button {
  appearance: none;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 12px;
  border-radius: 3px;
  font-size: 11px;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, color 120ms;
}
.button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.24);
  color: #fff;
}
.button[data-active="true"] {
  background: rgba(40, 241, 0, 0.16);
  border-color: rgba(40, 241, 0, 0.6);
  color: #28F100;
}
```

- [ ] **Step 3: 全 2 PASS + commit**

```bash
rtk git add components/board/TagButton/ tests/components/board/TagButton.test.tsx
rtk git commit -m "feat(board): TagButton (= chrome の TAG ボタン、 既存タグ管理画面入口)"
```

---

### Task 16: i18n keys を 15 言語に追加

**Files:**
- Modify: `messages/ja.json`, `messages/en.json`, `messages/ko.json`, `messages/zh.json`, `messages/zh-TW.json`, `messages/es.json`, `messages/fr.json`, `messages/de.json`, `messages/it.json`, `messages/pt.json`, `messages/ru.json`, `messages/ar.json`, `messages/hi.json`, `messages/id.json`, `messages/vi.json`

- [ ] **Step 1: 既存 messages の構造を確認**

Run: `cat messages/ja.json | head -30`

既存の翻訳ファイル構造を確認 (例: `{ "board": { "header": "..." } }` のようなネスト構造)。

- [ ] **Step 2: タグ関連 keys を 15 言語に追加**

各 file の適切な位置 (例: `board` セクションの下) に以下を追加。 全部 ASCII 文字列キー、 値だけ翻訳:

```json
{
  "tag": {
    "addLabel": "+ TAG",
    "newPlaceholder": "new tag…",
    "filterClearAria": "Clear all filters",
    "modeAnd": "AND",
    "modeOr": "OR",
    "buttonLabel": "TAG",
    "buttonAria": "Open tag management"
  }
}
```

15 言語分。 翻訳は実装者が機械翻訳 + 軽く校正、 もしくは全部英語のまま (= UI 英語語彙ルール、 memory `feedback_ui_vocabulary`) で OK。 推奨は **全 15 言語で英語のまま** (= UI vocabulary はグローバル英語語彙、 ただし `newPlaceholder` は各言語の自然な表現でも OK)。

- [ ] **Step 3: tsc + i18n typegen 確認**

Run: `rtk pnpm tsc --noEmit`
Expected: 0 error

i18n type generation (next-intl) が走るプロジェクトなら、 そのコマンドも実行。

- [ ] **Step 4: commit**

```bash
rtk git add messages/
rtk git commit -m "i18n(tag): 15 言語にタグ関連 keys 追加 (= UI 英語語彙統一、 placeholder のみ各言語可)"
```

---

# Phase 1e — 統合 + BoardRoot 配線 + 視覚検証

### Task 17: BoardRoot に tag filter state を配線 + data-tagged-out 属性付与

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/CardsLayer.tsx` (= カード wrapper に data-tagged-out 属性を付ける)

- [ ] **Step 1: BoardRoot に useTagFilter + useTags を追加し、 filter 結果をカードに反映**

`BoardRoot.tsx` の relevant 箇所 (= 状態定義 + render):

```tsx
import { useTags } from '@/lib/storage/use-tags'
import { useTagFilter } from '@/lib/board/use-tag-filter'

// ...既存 state の隣
const { tags } = useTags()
const tagFilter = useTagFilter()

// matchedBookmarkIds の計算:
const matchedBookmarkIds = useMemo(() => {
  if (!tagFilter.isActive) return null  // null = 絞り込み無し、 全件該当扱い
  return new Set(
    bookmarks
      .filter((b) => {
        if (tagFilter.mode === 'and') {
          return tagFilter.selectedTagIds.every((tid) => b.tags.includes(tid))
        }
        return tagFilter.selectedTagIds.some((tid) => b.tags.includes(tid))
      })
      .map((b) => b.id),
  )
}, [bookmarks, tagFilter.isActive, tagFilter.mode, tagFilter.selectedTagIds])

// CardsLayer に渡す props に追加
<CardsLayer
  // ...既存 props
  matchedBookmarkIds={matchedBookmarkIds}
/>

// TagFilterBar を ScrollMeter の隣 (= chrome 領域内) に配置
<TagFilterBar
  tags={tags}
  selectedTagIds={tagFilter.selectedTagIds}
  mode={tagFilter.mode}
  onToggle={tagFilter.toggleTag}
  onModeChange={tagFilter.setMode}
  onClearAll={tagFilter.clearAll}
  totalCount={bookmarks.length}
  matchCount={matchedBookmarkIds?.size ?? bookmarks.length}
/>
```

- [ ] **Step 2: CardsLayer の各カード wrapper に data-tagged-out + shutdown class を付与**

```tsx
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'

// CardsLayer の render 内、 各 card 要素に:
const taggedOut = props.matchedBookmarkIds && !props.matchedBookmarkIds.has(card.id)
const shutdownClass = taggedOut ? getShutdownAnimationClass('wave') : undefined

<div
  key={card.id}
  className={[existingCardClass, shutdownClass].filter(Boolean).join(' ')}
  data-tagged-out={taggedOut ? 'true' : undefined}
  // ...既存属性
>
  {/* card 中身 */}
</div>
```

- [ ] **Step 3: tsc 確認 + 既存テスト全 PASS**

Run: `pnpm tsc --noEmit && rtk vitest run`
Expected: 0 error + 既存テスト全 PASS

- [ ] **Step 4: commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/CardsLayer.tsx
rtk git commit -m "feat(board): BoardRoot に TagFilterBar + useTagFilter 配線、 CardsLayer で data-tagged-out + shutdown class 付与"
```

---

### Task 18: タグ付与 popover を CardsLayer に統合

**Files:**
- Modify: `components/board/CardsLayer.tsx` (= カード hover で `+ TAG` アイコン + popover 表示)
- Modify: `components/board/MediaTypeIndicator.tsx` (もし `+ TAG` アイコンをここに置くなら、 既存ボタンと並列で)

- [ ] **Step 1: カード hover で表示する `+ TAG` アイコンを追加** (= 既存 MediaTypeIndicator の隣、 別 z-index)

CardsLayer の各カード wrapper 内に状態 + アイコン + popover 配置:

```tsx
const [popoverOpenFor, setPopoverOpenFor] = useState<string | null>(null)
const { tags: allTagsForPopover } = useTags()
const dbRef = useRef<...>(null) // initDB で取得済 (BoardRoot からのインジェクション or context 経由)

// 各カード:
<div ... onMouseEnter={...} onMouseLeave={...}>
  {/* 既存内容 */}
  <button
    className={styles.addTagButton}
    onClick={(e) => { e.stopPropagation(); setPopoverOpenFor(card.id) }}
    aria-label="Add tag"
  >
    + TAG
  </button>
  {popoverOpenFor === card.id && (
    <TagAddPopover
      allTags={allTagsForPopover}
      currentTagIds={card.tags}
      siteCandidates={extractCandidatesFromBookmark(card)}
      onAddExisting={async (tagId) => {
        if (card.tags.includes(tagId)) {
          await removeTagFromBookmark(dbRef.current!, card.id, tagId)
        } else {
          await addTagToBookmark(dbRef.current!, card.id, tagId)
        }
      }}
      onAddNew={async (name) => {
        const tag = await addTag(dbRef.current!, { name, color: '#28F100', order: allTagsForPopover.length })
        await addTagToBookmark(dbRef.current!, card.id, tag.id)
      }}
      onClose={() => setPopoverOpenFor(null)}
    />
  )}
</div>
```

- [ ] **Step 2: `+ TAG` ボタンの CSS (= CardsLayer.module.css に追記)**

```css
.addTagButton {
  position: absolute;
  top: 8px;
  right: 8px;
  appearance: none;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  padding: 3px 8px;
  border-radius: 2px;
  font-size: 10px;
  letter-spacing: 0.08em;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms;
  z-index: 20;
}
.cardWrapper:hover .addTagButton {
  opacity: 1;
  pointer-events: auto;
}
.addTagButton:hover {
  background: rgba(40, 241, 0, 0.2);
  border-color: rgba(40, 241, 0, 0.6);
  color: #28F100;
}
```

- [ ] **Step 3: tsc + 既存テスト全 PASS**

Run: `pnpm tsc --noEmit && rtk vitest run`

- [ ] **Step 4: commit**

```bash
rtk git add components/board/CardsLayer.tsx components/board/CardsLayer.module.css
rtk git commit -m "feat(board): カード hover で + TAG ボタン + TagAddPopover、 add/remove API 配線"
```

---

### Task 19: TagButton を chrome に追加

**Files:**
- Modify: `components/board/TopHeader.tsx` (= 既存の chrome 配置 file、 grep で確認)
- もしくは TUNE / POP OUT が並んでる component を特定して同じ階層に追加

- [ ] **Step 1: 既存 chrome ボタンの位置確認**

Run: `rg -l "TuneTrigger|POP OUT|SHARE" components/board --type tsx`

該当 file (= 多分 TopHeader.tsx) に `<TagButton onClick={...} />` を TUNE の隣 (or POP OUT の隣) に追加。

```tsx
import { TagButton } from '@/components/board/TagButton'

// 既存の chrome JSX 内、 TUNE の隣:
<TagButton onClick={() => setTagPanelOpen(true)} />
```

state は BoardRoot で管理:
```tsx
const [tagPanelOpen, setTagPanelOpen] = useState(false)
// ...
{tagPanelOpen && <SimpleTagList tags={tags} onClose={() => setTagPanelOpen(false)} />}
```

`SimpleTagList` は Phase 1 placeholder として、 既存 `Sidebar.tsx` を流用 or 簡易 modal 新規:

```tsx
function SimpleTagList({ tags, onClose }: { tags: readonly TagRecord[]; onClose: () => void }): JSX.Element {
  return (
    <div role="dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: '#111', padding: 24, borderRadius: 6, minWidth: 320 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Tags</h3>
        {tags.length === 0 ? <p style={{ color: '#888' }}>No tags yet.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tags.map((t) => <li key={t.id} style={{ padding: '4px 0', color: '#ddd' }}>{t.name}</li>)}
          </ul>
        )}
        <button type="button" onClick={onClose} style={{ marginTop: 12 }}>Close</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc + 既存テスト全 PASS**

```bash
pnpm tsc --noEmit && rtk vitest run
```

- [ ] **Step 3: commit**

```bash
rtk git add components/board/TopHeader.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(board): TopHeader に TagButton 配置 + SimpleTagList placeholder (= Phase 2 で Triage に進化)"
```

---

### Task 20: FLIP reflow を BoardRoot に統合

**Files:**
- Modify: `components/board/BoardRoot.tsx` or `CardsLayer.tsx`
- Use: `lib/animation/tag-shutdown/reflow.ts`

- [ ] **Step 1: 絞り込み state が変化したら、 該当カードに対して FLIP**

```tsx
import { runFlipReflow } from '@/lib/animation/tag-shutdown/reflow'

// matchedBookmarkIds が更新される前後で各該当 card の rect を取得 / FLIP
useLayoutEffect(() => {
  if (!matchedBookmarkIds) return  // 絞り込み無し = FLIP 不要
  // 各 card 要素の rect を pre-変化 状態で取得
  const cardEls = Array.from(document.querySelectorAll<HTMLElement>('[data-card-id]'))
  const firsts = new Map<string, DOMRect>()
  for (const el of cardEls) {
    const id = el.dataset.cardId
    if (id && matchedBookmarkIds.has(id)) firsts.set(id, el.getBoundingClientRect())
  }
  // 1 フレーム後 (= layout 確定後) に FLIP 適用
  requestAnimationFrame(() => {
    for (const [id, first] of firsts) {
      const el = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
      if (el) runFlipReflow(el, first, 400, 'cubic-bezier(0.4, 0, 0.2, 1)')
    }
  })
}, [matchedBookmarkIds])
```

各 card wrapper に `data-card-id={card.id}` 属性付与。

- [ ] **Step 2: 既存テスト + 新規視覚 (= 実機)**

Run: `pnpm tsc --noEmit && rtk vitest run`

- [ ] **Step 3: commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/CardsLayer.tsx
rtk git commit -m "feat(board): 絞り込み時 FLIP reflow (= 該当カードが上に詰まる、 useLayoutEffect + requestAnimationFrame)"
```

---

### Task 21: preview で全機能を実機検証

**Files:** (動作確認のみ)

- [ ] **Step 1: dev サーバ起動 + 主要動線確認**

```bash
npx -y wrangler@latest pages dev out/ --port 8788
```

別ターミナルで `rtk pnpm build` を先に実行。

ブラウザで `http://localhost:8788` を開いて以下を順に確認:

| 項目 | 確認内容 | 期待結果 |
|---|---|---|
| 1. 既存 mood UI 回帰 | 既存タグが Sidebar / FilterPill に表示されるか | mood 時代と同じ表示 |
| 2. TagButton 表示 | chrome 右上に TAG ボタンが TUNE の隣 | 表示 OK、 click で SimpleTagList modal |
| 3. + TAG 付与 | カード hover → + TAG → popover → 既存 click | カード tags 配列に追加、 popover 内で ✓ 表示 |
| 4. 新規タグ作成 | popover の input に文字 → Enter | 新タグ作成 + 即付与 |
| 5. 元サイト候補 | YouTube カードの popover に「YouTube」 候補 | 表示 + click で付与 |
| 6. filter bar 表示 | タグが 1+ 件あれば bar 表示、 0 件なら非表示 | 期待通り |
| 7. chip click 絞り込み | chip click → 非該当カードに CRT shutdown | shutdown アニメ + 上詰めで reflow |
| 8. 複数 chip + AND | 2 chip 選択 + AND mode、 両方持つカードのみ残る | 期待通り |
| 9. mode toggle | AND ↔ OR で再絞り込み | 該当カード変化 + 再 shutdown |
| 10. 解除 | × ボタン click | 全カード復活 (= 逆 reverse でフェードイン or 即表示) |
| 11. reduced-motion | OS で「視覚効果減らす」 ON にして再確認 | shutdown が単純フェードに |

- [ ] **Step 2: 視覚バグ / UX 違和感を修正**

問題が出たら個別に潰す。 典型 fix:
- shutdown アニメが該当カードにも乗ってる → CardsLayer の class 適用条件を再確認
- reflow が滑らかでない → FLIP の rect 取得タイミングを useLayoutEffect 内に
- 解除時に カードが瞬間表示で違和感 → reverse アニメを後フェーズで追加

- [ ] **Step 3: 修正後 vitest 全 PASS 確認**

Run: `rtk vitest run && pnpm tsc --noEmit`
Expected: 全 PASS + 0 error

- [ ] **Step 4: commit (= 修正があれば)**

```bash
rtk git add -A
rtk git commit -m "fix(board): タグ機能の preview 検証で見つかった視覚 / UX 微調整"
```

---

### Task 22: 本番 ship + user 検証 案内

**Files:** (動作のみ)

- [ ] **Step 1: build + deploy**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="tagging-phase1-ship"
```

- [ ] **Step 2: deploy 完了確認 + user 案内**

user に「`booklage.pages.dev` をハードリロードしてください、 タグ機能 Phase 1 完成」 と伝える。 user 検証で再現する症状があれば一覧してから次のセッションで対応。

- [ ] **Step 3: TODO.md / TODO_COMPLETED.md / CURRENT_GOAL.md を更新 + commit**

```bash
# TODO.md にタグ機能 Phase 1 完了を記載
# TODO_COMPLETED.md に narrative 追記
# CURRENT_GOAL.md を次セッション用 (= Phase 2 = Triage 高速振り分け実装) に上書き
rtk git add docs/
rtk git commit -m "session XX close: タグ機能 Phase 1 完成 (= mood → tag rename + AND/OR 絞り込み + WAVE CRT shutdown + FLIP reflow + 付与 popover + TAG ボタン)"
```

---

# Self-review (= 実装着手前のチェックリスト)

**Spec coverage:**

| spec 確定事項 | カバー task |
|---|---|
| A 目的: タグで絞り込み | Task 17, 20 |
| B 重点: ビジュアル遷移 + 複数タグ絞り込み | Task 10-12, 13, 17, 20 |
| C フォルダ廃止 (= 既存資産活用) | Task 2-7 (= rename + 既存 UI 編集) |
| D 通常モード付与 (drag + 候補 + 手動) | Task 14, 18 |
| E TAG ボタン | Task 15, 19 |
| F Triage 振り分け先 (= Phase 2) | (Phase 2 plan) |
| G Shift で 5-8 番 (= Phase 2) | (Phase 2 plan) |
| H WAVE CRT shutdown F6 | Task 10, 11 |
| I 適用範囲厳守 | Task 10 (CSS の `.shutdown` セレクタ条件 + 17 で `data-tagged-out` 限定) |
| J theme フィールド予約 | Task 1 |
| K Phase 2 | (Phase 2 plan) |
| L Phase 3 | (Phase 3 plan) |
| M WAVE | Task 11 (theme key) |
| N テーマ連動差し替え構造 | Task 11 (wave のみ実装、 case 追加で他テーマ可) |
| O プロジェクト全体方針 | spec で明記済、 plan 全体で「テーマ key 経由」 を徹底 |
| P IDB schema 鉄則 | Task 5, 6 (= migration テスト + 慎重実装) |
| Q mood リネーム + 拡張 | Task 1-7 |
| R カラーハント Phase 3 | (Phase 3 plan) |
| S dominantColor 予約 | Task 1 |
| T backfill サイレント (= Phase 3) | (Phase 3 plan) |

**Placeholder scan:** "TBD" / "TODO" / "実装は後で" 等 → 0 件 (= 全 task に完成形コードあり)

**Type consistency:**
- `TagRecord` / `TagInput` / `FilterMode` の名前は全 task で統一
- `addTagToBookmark` / `removeTagFromBookmark` / `filterBookmarks` 名前は Task 2, 3, 8, 18 で一致
- `useTagFilter` の戻り値型は Task 8 で定義 → Task 17 で使用、 props 一致

**Ambiguity:**
- Task 18 の `dbRef.current` 注入経路 → 既存 BoardRoot で initDB() を持ってるなら context 経由、 もしくは props drilling、 実装者は既存パターンに合わせる (= AllMarks の他 `useEffect + initDB` パターン参照)
- Task 19 の `SimpleTagList` placeholder → 既存 `Sidebar.tsx` を流用する選択肢も実装者裁量で OK

---

*次のステップ: execution choice を user に確認 → subagent-driven or inline で実行開始。*
