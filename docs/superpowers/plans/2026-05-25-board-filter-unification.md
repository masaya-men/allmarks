# Board Filter Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カードタグピル click と dropdown filter を 1 つの `activeFilter` state に統合し、 背景文字 (= BoardBackgroundTypography) を含む全 chrome が同じ source of truth に反応するようにする。 副産物としてタグ絞り込み状態がリロード後も復元される。

**Architecture:** `BoardFilter` 型を string union から discriminated union object 型 (`{ kind: 'tags', tagIds, mode }` を新規追加) にリッチ化。 IDB schema v15 → v16 bump で旧 string 値 (`'mood:<id>'` 等) を新 object 形式に migrate。 `useTagFilter` hook を廃止し、 `activeFilter` 経由に統一。 並行して、 不可逆 IDB upgrade のリスク緩和として **Phase 0 で JSON export/import 機能を先に書く** = 万一の rollback 用退避手段。

**Tech Stack:** TypeScript strict / IndexedDB (`idb` library) / React / Vitest / Next.js App Router (static export) / Cloudflare Pages

---

## File Structure

### Phase 0 (= 新規)
- `lib/storage/backup.ts` — JSON export/import コア (= 全 IDB store dump + 復元)
- `lib/storage/backup.test.ts` — TDD
- `components/board/BackupButton.tsx` — chrome button (= TUNE 隣、 ChromeButton wrapper)
- `components/board/BackupButton.module.css`
- `components/board/BackupButton.test.tsx`

### Phase 1 (= 既存 modify)
- `lib/board/types.ts` — `BoardFilter` 型を object 型に拡張 + helper export
- `lib/board/filter.ts` — `applyFilter` 新型対応
- `lib/board/board-filter-migration.ts` (= 新規) — v15 string → v16 object 変換 + test
- `lib/constants.ts` — `DB_VERSION` 15 → 16
- `lib/storage/indexeddb.ts` — v15 → v16 upgrade case 追加 (= settings store の board-config record 内 activeFilter を migrate)
- `lib/storage/board-config.ts` — `DEFAULT_BOARD_CONFIG.activeFilter` を新型に
- `components/board/FilterPill.tsx` — overrideLabel/overrideCount prop 削除、 新型対応
- `components/board/BoardBackgroundTypography.tsx` — 新型対応 + tags filter ラベル派生
- `components/board/Sidebar.tsx` — 新型対応 (= mood: 比較を helper 経由に)
- `components/board/BoardRoot.tsx` — `useTagFilter` 削除、 `matchedBookmarkIds` を `activeFilter` 経由派生に、 タグピル click → setActiveFilter、 MANAGE TAGS routing 新型対応
- `components/board/CardsLayer.tsx` — `onTagFilterToggle` callback シグネチャ変更 (= 既存タグ click → activeFilter 新値を request する形に)
- **削除**: `lib/board/use-tag-filter.ts` + `lib/board/use-tag-filter.test.ts`

### test 更新
- `tests/lib/filter.test.ts` — 新 5 種 + tags kind の case
- `tests/lib/filter-dead.test.ts` — 新型のみ minor adapt
- `tests/lib/board-config.test.ts` — DEFAULT_BOARD_CONFIG 更新
- `components/board/BoardBackgroundTypography.test.tsx` — 新型対応

---

## Conventions

- Phase 0 完了 → 単独 deploy → user に「JSON export して PC 保存」 確認 → Phase 1 着手
- 各 task 完了で commit (= conventional commits 規約準拠、 `feat:` / `refactor:` / `chore:` 等)
- 全 commit 末尾: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Phase 1 着手前に **新規 git branch 作成推奨** (= `git checkout -b refactor/board-filter-unification`)、 万一の revert を簡単に
- 各 task の test step では既存 803+ PASS の維持を確認 (= 新規 add 分のみ delta 報告)

---

# Phase 0: JSON Backup/Restore (= リカバリ保険)

## Task 0.1: `lib/storage/backup.ts` 新規実装

**Files:**
- Create: `lib/storage/backup.ts`
- Create: `tests/lib/backup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/backup.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { initDB } from '@/lib/storage/indexeddb'
import { exportAllStores, importAllStores } from '@/lib/storage/backup'

describe('backup', () => {
  beforeEach(() => {
    // fake-indexeddb auto-resets per test file but be explicit
    indexedDB.deleteDatabase('booklage-db')
  })

  it('exports bookmarks / tags / settings as JSON', async () => {
    const db = await initDB()
    await db.put('bookmarks', {
      id: 'bm-1', url: 'https://example.com', title: 't', description: '',
      thumbnail: '', favicon: '', siteName: 'Example', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    await db.put('tags', {
      id: 'tag-1', name: 'Music', color: '#28F100', createdAt: '2026-05-25T00:00:00Z',
    })
    await db.put('settings', { key: 'board-config', config: { activeFilter: 'all' } })

    const json = await exportAllStores(db)

    expect(json.version).toBeGreaterThanOrEqual(15)
    expect(json.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(json.bookmarks).toHaveLength(1)
    expect(json.bookmarks[0].id).toBe('bm-1')
    expect(json.tags).toHaveLength(1)
    expect(json.tags[0].id).toBe('tag-1')
    expect(json.settings).toHaveLength(1)
  })

  it('imports JSON and restores all stores', async () => {
    const db1 = await initDB()
    await db1.put('bookmarks', {
      id: 'bm-x', url: 'https://x.com', title: 'X', description: '',
      thumbnail: '', favicon: '', siteName: 'X', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    const dump = await exportAllStores(db1)
    db1.close()

    // wipe + reimport
    indexedDB.deleteDatabase('booklage-db')
    const db2 = await initDB()
    await importAllStores(db2, dump)

    const restored = await db2.getAll('bookmarks')
    expect(restored).toHaveLength(1)
    expect(restored[0].id).toBe('bm-x')
  })

  it('importAllStores wipes existing rows before restore (= avoid id collision)', async () => {
    const db1 = await initDB()
    await db1.put('bookmarks', {
      id: 'bm-a', url: 'https://a.com', title: 'A', description: '',
      thumbnail: '', favicon: '', siteName: 'A', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    const dump = await exportAllStores(db1)

    // Add a different row in the current DB, then import the dump.
    await db1.put('bookmarks', {
      id: 'bm-b', url: 'https://b.com', title: 'B', description: '',
      thumbnail: '', favicon: '', siteName: 'B', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    await importAllStores(db1, dump)

    // Only bm-a should remain (= import is a full replace, not merge).
    const after = await db1.getAll('bookmarks')
    expect(after.map((b) => b.id)).toEqual(['bm-a'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/backup.test.ts`
Expected: FAIL — `Cannot find module '@/lib/storage/backup'`

- [ ] **Step 3: Implement `lib/storage/backup.ts`**

```typescript
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

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const STORES = ['bookmarks', 'tags', 'cards', 'folders', 'settings', 'preferences'] as const

export async function exportAllStores(db: DbLike): Promise<BackupJson> {
  const [bookmarks, tags, cards, folders, settings, preferences] = await Promise.all(
    STORES.map((name) => db.getAll(name)),
  )
  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks,
    tags,
    cards,
    folders,
    settings,
    preferences,
  }
}

export async function importAllStores(db: DbLike, json: BackupJson): Promise<void> {
  // Full replace semantics: clear every store first, then re-insert the
  // dump's rows. We do this store-by-store (NOT in one giant transaction)
  // because IDB's atomicity rules forbid spanning a clear() + put() across
  // mixed-mode stores in a single tx for some browsers. Per-store tx is
  // fine for our single-user restore flow.
  for (const name of STORES) {
    const tx = db.transaction(name, 'readwrite')
    await tx.store.clear()
    const rows = (json as unknown as Record<string, ReadonlyArray<unknown>>)[name] ?? []
    for (const row of rows) {
      await tx.store.put(row)
    }
    await tx.done
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/backup.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run full test suite + tsc to confirm no regression**

Run: `npx vitest run && npx tsc --noEmit`
Expected: Full suite PASS (delta +3), tsc 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/storage/backup.ts tests/lib/backup.test.ts
git commit -m "$(cat <<'EOF'
feat(storage): JSON export/import for full IDB backup

Adds exportAllStores + importAllStores covering bookmarks / tags /
cards / folders / settings / preferences. Versioned by DB_VERSION so
forward-incompat dumps can be rejected later. Import semantics =
full replace (clear + put), per-store tx to satisfy IDB atomicity.

Recovery safety net before the BoardFilter type refactor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 0.2: `BackupButton` UI コンポーネント

**Files:**
- Create: `components/board/BackupButton.tsx`
- Create: `components/board/BackupButton.module.css`
- Create: `components/board/BackupButton.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// components/board/BackupButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { BackupButton } from './BackupButton'

describe('BackupButton', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('booklage-db')
  })

  it('renders an EXPORT button + hidden import file input', () => {
    render(<BackupButton />)
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
  })

  it('clicking EXPORT triggers a download (= URL.createObjectURL called)', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<BackupButton />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    // Allow async export
    await new Promise((r) => setTimeout(r, 50))

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledTimes(1)
    createSpy.mockRestore()
    revokeSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/board/BackupButton.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `BackupButton.tsx`**

```tsx
'use client'

import { useCallback, useRef, useState, type ReactElement } from 'react'
import { initDB } from '@/lib/storage/indexeddb'
import { exportAllStores, importAllStores, type BackupJson } from '@/lib/storage/backup'
import { ChromeButton } from './ChromeButton'

export function BackupButton(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  const onExport = useCallback(async (): Promise<void> => {
    setBusy('export')
    try {
      const db = await initDB()
      const dump = await exportAllStores(db)
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `allmarks-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setBusy(null)
    }
  }, [])

  const onImport = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('import')
    try {
      const text = await file.text()
      const json = JSON.parse(text) as BackupJson
      if (typeof json.version !== 'number' || !Array.isArray(json.bookmarks)) {
        alert('Backup ファイルの形式が認識できません。')
        return
      }
      const proceed = window.confirm(
        `これは復元です。 現在のデータ全部消えて、 backup の内容で置き換わります。 続けますか?\n\n` +
        `(export 日時: ${json.exportedAt}, version: ${json.version})`,
      )
      if (!proceed) return
      const db = await initDB()
      await importAllStores(db, json)
      alert('復元完了。 ページを再読み込みします。')
      window.location.reload()
    } finally {
      setBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  return (
    <>
      <ChromeButton label={busy === 'export' ? '...' : 'EXPORT'} onClick={() => { void onExport() }} />
      <ChromeButton label={busy === 'import' ? '...' : 'IMPORT'} onClick={onImport} />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => { void onFileChange(e) }}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/board/BackupButton.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/board/BackupButton.tsx components/board/BackupButton.test.tsx
git commit -m "$(cat <<'EOF'
feat(board): BackupButton chrome — EXPORT/IMPORT JSON

EXPORT = full IDB dump → JSON file download (filename =
allmarks-backup-YYYY-MM-DD.json). IMPORT = file picker → confirm
dialog → wipe + restore + auto reload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 0.3: BoardRoot に BackupButton 配線

**Files:**
- Modify: `components/board/BoardRoot.tsx:1431` (= TopHeader actions 内、 MANAGE TAGS の前後どこか)

- [ ] **Step 1: Read existing chrome action layout**

該当箇所 ([BoardRoot.tsx:1419-1470 周辺](components/board/BoardRoot.tsx#L1419)): `<TopHeader actions={<>...</>}>` 内に既存 `TuneTrigger` / `TagButton` / POP OUT / SHARE が並んでいる。 EXPORT/IMPORT は **TUNE と MANAGE TAGS の間** に挿入 (= 機能的に「管理系」 ひとくくり)。

- [ ] **Step 2: Add import**

```tsx
// Near other imports
import { BackupButton } from './BackupButton'
```

- [ ] **Step 3: Insert BackupButton in TopHeader actions**

該当箇所:
```tsx
              <TuneTrigger ... />
+             <BackupButton />
              <TagButton ... />
```

- [ ] **Step 4: Build + visual smoke**

Run: `pnpm build`
Expected: 成功、 25 routes static prerender

- [ ] **Step 5: Commit**

```bash
git add components/board/BoardRoot.tsx
git commit -m "$(cat <<'EOF'
chore(board): wire BackupButton into TopHeader

Slot between TUNE and MANAGE TAGS. Phase 0 of BoardFilter
unification refactor = recovery safety net.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 0.4: Phase 0 単独 deploy + user 退避依頼

- [ ] **Step 1: Final pre-deploy check**

Run: `npx vitest run && npx tsc --noEmit && pnpm build`
Expected: 全 PASS / 0 errors / build success

- [ ] **Step 2: Deploy to production**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="phase0 backup button"
```

- [ ] **Step 3: Notify user to export current state**

User に伝える文 (= 日本語):

> Phase 0 を本番反映しました。 chrome の TUNE 隣に **EXPORT** ボタンが出ています。 これを**今**押して、 `allmarks-backup-YYYY-MM-DD.json` を PC のどこかに保存してください。 これが Phase 1 (= IDB schema bump) で万一何かあった時の唯一の復旧手段です。 保存できたら次に進みます。

- [ ] **Step 4: Wait for user confirmation before Phase 1**

⚠️ **Phase 1 に進む前に user が「export して保存した」 と明示的に確認するまで待つ**。 仮に user が「進めて良い」 と言っても、 export 確認なしで Phase 1 着手は **絶対禁止** (= memory `feedback_user_urgency_override`)。

---

# Phase 1: BoardFilter 型統合 (= 案 C 本体)

⚠️ **Phase 1 着手の前提条件:**
1. Task 0.4 で user が JSON export 完了を確認したこと
2. 新規 branch `refactor/board-filter-unification` を作成 (= `git checkout -b refactor/board-filter-unification`)
3. 現在の master commit hash を記録 (= rollback 用、 `git rev-parse master` 出力を控えておく)

## Task 1.1: `BoardFilter` 型を object 型に拡張

**Files:**
- Modify: `lib/board/types.ts:78`
- Create: `lib/board/board-filter-helpers.ts`
- Create: `tests/lib/board-filter-helpers.test.ts`

- [ ] **Step 1: Write failing test for helper functions**

```typescript
// tests/lib/board-filter-helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, BOARD_FILTER_DEAD,
  isTagsFilter, makeTagsFilter, boardFilterEquals, getActiveTagIds,
} from '@/lib/board/board-filter-helpers'

describe('board-filter-helpers', () => {
  it('isTagsFilter recognizes tags kind', () => {
    expect(isTagsFilter(BOARD_FILTER_ALL)).toBe(false)
    expect(isTagsFilter(makeTagsFilter(['t1'], 'and'))).toBe(true)
  })

  it('makeTagsFilter constructs canonical tags filter', () => {
    const f = makeTagsFilter(['t1', 't2'], 'or')
    expect(f).toEqual({ kind: 'tags', tagIds: ['t1', 't2'], mode: 'or' })
  })

  it('boardFilterEquals does structural compare', () => {
    expect(boardFilterEquals(BOARD_FILTER_ALL, BOARD_FILTER_ALL)).toBe(true)
    expect(boardFilterEquals(BOARD_FILTER_ALL, BOARD_FILTER_INBOX)).toBe(false)
    expect(boardFilterEquals(
      makeTagsFilter(['a'], 'and'),
      makeTagsFilter(['a'], 'and'),
    )).toBe(true)
    expect(boardFilterEquals(
      makeTagsFilter(['a'], 'and'),
      makeTagsFilter(['a'], 'or'),
    )).toBe(false)
    expect(boardFilterEquals(
      makeTagsFilter(['a', 'b'], 'and'),
      makeTagsFilter(['b', 'a'], 'and'),
    )).toBe(false)  // order-sensitive on purpose; toggling appends in click order
  })

  it('getActiveTagIds returns the array for tags filters, empty otherwise', () => {
    expect(getActiveTagIds(BOARD_FILTER_ALL)).toEqual([])
    expect(getActiveTagIds(makeTagsFilter(['x', 'y'], 'and'))).toEqual(['x', 'y'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/board-filter-helpers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Update `lib/board/types.ts` — replace BoardFilter definition**

Replace [lib/board/types.ts:78](lib/board/types.ts#L78):
```typescript
// OLD:
// export type BoardFilter = 'all' | 'inbox' | 'archive' | 'dead' | `mood:${string}`

// NEW:
export type FilterMode = 'and' | 'or'

export type BoardFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'inbox' }
  | { readonly kind: 'archive' }
  | { readonly kind: 'dead' }
  | { readonly kind: 'tags'; readonly tagIds: readonly string[]; readonly mode: FilterMode }
```

- [ ] **Step 4: Create `lib/board/board-filter-helpers.ts`**

```typescript
import type { BoardFilter, FilterMode } from './types'

export const BOARD_FILTER_ALL: BoardFilter = { kind: 'all' }
export const BOARD_FILTER_INBOX: BoardFilter = { kind: 'inbox' }
export const BOARD_FILTER_ARCHIVE: BoardFilter = { kind: 'archive' }
export const BOARD_FILTER_DEAD: BoardFilter = { kind: 'dead' }

export function makeTagsFilter(tagIds: readonly string[], mode: FilterMode): BoardFilter {
  return { kind: 'tags', tagIds, mode }
}

export function isTagsFilter(
  f: BoardFilter,
): f is Extract<BoardFilter, { kind: 'tags' }> {
  return f.kind === 'tags'
}

export function getActiveTagIds(f: BoardFilter): readonly string[] {
  return isTagsFilter(f) ? f.tagIds : []
}

export function boardFilterEquals(a: BoardFilter, b: BoardFilter): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind !== 'tags') return true
  // both tags
  const bb = b as Extract<BoardFilter, { kind: 'tags' }>
  if (a.mode !== bb.mode) return false
  if (a.tagIds.length !== bb.tagIds.length) return false
  return a.tagIds.every((id, i) => id === bb.tagIds[i])
}

/** Toggle a tag in/out of an existing tags-filter.
 *  - Non-tags filter → new tags filter with this 1 tag, AND mode.
 *  - tags filter not containing id → append id.
 *  - tags filter containing id → remove id; if 0 left, return ALL filter.
 *  Mode is preserved when toggling within an existing tags filter. */
export function toggleTagInFilter(current: BoardFilter, tagId: string): BoardFilter {
  if (!isTagsFilter(current)) {
    return { kind: 'tags', tagIds: [tagId], mode: 'and' }
  }
  if (current.tagIds.includes(tagId)) {
    const next = current.tagIds.filter((id) => id !== tagId)
    if (next.length === 0) return BOARD_FILTER_ALL
    return { kind: 'tags', tagIds: next, mode: current.mode }
  }
  return { kind: 'tags', tagIds: [...current.tagIds, tagId], mode: current.mode }
}
```

- [ ] **Step 5: Run helper tests to verify they pass**

Run: `npx vitest run tests/lib/board-filter-helpers.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: tsc check — expect many failures elsewhere (= 既存 5 種 string 前提 code が壊れる、 Task 1.2-1.10 で順次 fix)**

Run: `npx tsc --noEmit`
Expected: 多数の error (= 想定通り、 commit 前に Task 1.2 で applyFilter から fix 開始)

- [ ] **Step 7: Commit (= test だけ green、 tsc は赤、 これは想定内)**

```bash
git add lib/board/types.ts lib/board/board-filter-helpers.ts tests/lib/board-filter-helpers.test.ts
git commit -m "$(cat <<'EOF'
refactor(types): BoardFilter discriminated union (= Phase 1.1)

Replace string union 'all'|'inbox'|'archive'|'dead'|mood:<id> with
object form: { kind, ...} variants including new { kind: 'tags',
tagIds, mode }. Adds board-filter-helpers (BOARD_FILTER_ALL/INBOX/
ARCHIVE/DEAD constants, makeTagsFilter, isTagsFilter, getActiveTagIds,
boardFilterEquals, toggleTagInFilter).

tsc intentionally fails here — fixed across Tasks 1.2-1.10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.2: `applyFilter` 新型対応 + AND/OR mode

**Files:**
- Modify: `lib/board/filter.ts`
- Modify: `tests/lib/filter.test.ts`

- [ ] **Step 1: Update test file to use new type**

`tests/lib/filter.test.ts` 全体を読んでから新型ベースに書き換え。 既存 case (all / inbox / archive / mood:) を新 object 形式に置換、 さらに **tags AND / tags OR の case を新規追加**:

```typescript
import { applyFilter } from '@/lib/board/filter'
import { BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, makeTagsFilter } from '@/lib/board/board-filter-helpers'

// (既存 case は kind 形式に書き換え)
expect(applyFilter(items, BOARD_FILTER_ALL)).toHaveLength(N)
expect(applyFilter(items, BOARD_FILTER_INBOX)).toHaveLength(M)

// 新規 tags case
it('tags AND filter — keeps only items having ALL specified tags', () => {
  const items = [
    { id: '1', isDeleted: false, tags: ['a', 'b'] },
    { id: '2', isDeleted: false, tags: ['a'] },
    { id: '3', isDeleted: false, tags: ['a', 'b', 'c'] },
  ] as any
  expect(applyFilter(items, makeTagsFilter(['a', 'b'], 'and')).map((x) => x.id))
    .toEqual(['1', '3'])
})

it('tags OR filter — keeps items having ANY specified tag', () => {
  const items = [
    { id: '1', isDeleted: false, tags: ['a'] },
    { id: '2', isDeleted: false, tags: ['b'] },
    { id: '3', isDeleted: false, tags: ['c'] },
  ] as any
  expect(applyFilter(items, makeTagsFilter(['a', 'b'], 'or')).map((x) => x.id))
    .toEqual(['1', '2'])
})
```

- [ ] **Step 2: Run test to verify it fails (= 既存 applyFilter は新型受けない)**

Run: `npx vitest run tests/lib/filter.test.ts`
Expected: FAIL

- [ ] **Step 3: Rewrite `lib/board/filter.ts`**

```typescript
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { BoardFilter } from './types'

export function applyFilter(items: ReadonlyArray<BoardItem>, filter: BoardFilter): BoardItem[] {
  switch (filter.kind) {
    case 'all':
      return items.filter((it) => !it.isDeleted)
    case 'inbox':
      return items.filter((it) => !it.isDeleted && it.tags.length === 0)
    case 'archive':
      return items.filter((it) => it.isDeleted)
    case 'dead':
      return items.filter((it) => !it.isDeleted && it.linkStatus === 'gone')
    case 'tags': {
      if (filter.tagIds.length === 0) return items.filter((it) => !it.isDeleted)
      if (filter.mode === 'and') {
        return items.filter((it) =>
          !it.isDeleted && filter.tagIds.every((tid) => it.tags.includes(tid)),
        )
      }
      return items.filter((it) =>
        !it.isDeleted && filter.tagIds.some((tid) => it.tags.includes(tid)),
      )
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/filter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/board/filter.ts tests/lib/filter.test.ts
git commit -m "$(cat <<'EOF'
refactor(filter): applyFilter consumes new BoardFilter object type

Switch on filter.kind; tags kind handles AND/OR mode + empty tagIds
fallback to 'all' semantics.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.3: `board-filter-migration.ts` — v15 string → v16 object 変換

**Files:**
- Create: `lib/board/board-filter-migration.ts`
- Create: `tests/lib/board-filter-migration.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { migrateLegacyBoardFilter } from '@/lib/board/board-filter-migration'

describe('migrateLegacyBoardFilter', () => {
  it("maps 'all' → { kind: 'all' }", () => {
    expect(migrateLegacyBoardFilter('all')).toEqual({ kind: 'all' })
  })
  it("maps 'inbox' → { kind: 'inbox' }", () => {
    expect(migrateLegacyBoardFilter('inbox')).toEqual({ kind: 'inbox' })
  })
  it("maps 'archive' → { kind: 'archive' }", () => {
    expect(migrateLegacyBoardFilter('archive')).toEqual({ kind: 'archive' })
  })
  it("maps 'dead' → { kind: 'dead' }", () => {
    expect(migrateLegacyBoardFilter('dead')).toEqual({ kind: 'dead' })
  })
  it("maps 'mood:abc' → tags filter [abc] AND", () => {
    expect(migrateLegacyBoardFilter('mood:abc')).toEqual({
      kind: 'tags', tagIds: ['abc'], mode: 'and',
    })
  })
  it('unknown string falls back to all', () => {
    expect(migrateLegacyBoardFilter('garbage')).toEqual({ kind: 'all' })
    expect(migrateLegacyBoardFilter(undefined)).toEqual({ kind: 'all' })
    expect(migrateLegacyBoardFilter(null)).toEqual({ kind: 'all' })
  })
  it('already-migrated object passes through unchanged', () => {
    const obj = { kind: 'tags', tagIds: ['x'], mode: 'or' }
    expect(migrateLegacyBoardFilter(obj)).toEqual(obj)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/board-filter-migration.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement migration**

```typescript
// lib/board/board-filter-migration.ts
import type { BoardFilter } from './types'
import { BOARD_FILTER_ALL } from './board-filter-helpers'

/** Convert any v15-or-older persisted activeFilter value (= string union or
 *  unknown) into the v16 BoardFilter object form. Safe on already-migrated
 *  object values (returns input unchanged when shape matches). */
export function migrateLegacyBoardFilter(legacy: unknown): BoardFilter {
  // Already migrated?
  if (legacy && typeof legacy === 'object' && 'kind' in legacy) {
    return legacy as BoardFilter
  }
  if (typeof legacy !== 'string') return BOARD_FILTER_ALL
  switch (legacy) {
    case 'all': return { kind: 'all' }
    case 'inbox': return { kind: 'inbox' }
    case 'archive': return { kind: 'archive' }
    case 'dead': return { kind: 'dead' }
  }
  if (legacy.startsWith('mood:')) {
    const id = legacy.slice(5)
    if (id.length > 0) return { kind: 'tags', tagIds: [id], mode: 'and' }
  }
  return BOARD_FILTER_ALL
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/board-filter-migration.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/board/board-filter-migration.ts tests/lib/board-filter-migration.test.ts
git commit -m "$(cat <<'EOF'
feat(migration): migrateLegacyBoardFilter v15 string → v16 object

Maps legacy persisted activeFilter strings (all/inbox/archive/dead/
mood:<id>) to the new BoardFilter object union. Idempotent on
already-migrated input. Unknown fallback = { kind: 'all' }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.4: IDB schema v15 → v16 bump + upgrade case

**Files:**
- Modify: `lib/constants.ts:23` (= `DB_VERSION`)
- Modify: `lib/storage/indexeddb.ts` (= upgrade trigger に v16 case 追加)

- [ ] **Step 1: Bump DB_VERSION**

Replace [lib/constants.ts:23](lib/constants.ts#L23):
```typescript
export const DB_VERSION = 16
```

- [ ] **Step 2: Add v15 → v16 upgrade case**

`lib/storage/indexeddb.ts` の `upgrade` callback、 既存 v15 case の直後に追加:

```typescript
// ── v15 → v16: migrate BoardConfig.activeFilter from legacy string
//              ('all'|'inbox'|'archive'|'dead'|`mood:<id>`) to the new
//              BoardFilter object form ({ kind: 'all'|... |'tags',
//              tagIds?, mode? }). Touches the single 'board-config'
//              record in the settings store.
if (oldVersion < 16) {
  const settingsStore = transaction.objectStore('settings')
  void settingsStore.openCursor().then(function migrateFilter(
    cursor: Awaited<ReturnType<typeof settingsStore.openCursor>>,
  ): Promise<void> | undefined {
    if (!cursor) return
    if (cursor.key === 'board-config') {
      const rec = cursor.value as { key: string; config?: Record<string, unknown> }
      const legacy = rec.config?.activeFilter
      // Inline the migration (= avoid pulling in a board-side import
      // inside a storage module; upgrade callbacks should be self-
      // contained per existing convention).
      let migrated: unknown = { kind: 'all' }
      if (legacy && typeof legacy === 'object' && 'kind' in legacy) {
        migrated = legacy
      } else if (typeof legacy === 'string') {
        if (legacy === 'all' || legacy === 'inbox' || legacy === 'archive' || legacy === 'dead') {
          migrated = { kind: legacy }
        } else if (legacy.startsWith('mood:')) {
          const id = legacy.slice(5)
          if (id.length > 0) migrated = { kind: 'tags', tagIds: [id], mode: 'and' }
        }
      }
      const nextConfig = { ...(rec.config ?? {}), activeFilter: migrated }
      void cursor.update({ key: rec.key, config: nextConfig })
    }
    return cursor.continue().then(migrateFilter)
  })
}
```

- [ ] **Step 3: Manual smoke (= fake-indexeddb で migration が走るか)**

Run: `npx vitest run tests/lib/board-config.test.ts`
Expected: 既存 test が現状 PASS、 但し Task 1.5 で更新するまで一時的に赤の可能性あり。 そのまま続行。

- [ ] **Step 4: Commit**

```bash
git add lib/constants.ts lib/storage/indexeddb.ts
git commit -m "$(cat <<'EOF'
feat(idb): schema v15 → v16, migrate BoardConfig.activeFilter to object form

Bumps DB_VERSION. v16 upgrade case rewrites the settings/board-config
record's activeFilter from the legacy string union ('all'/'inbox'/
'archive'/'dead'/'mood:<id>') to the new BoardFilter object union
({ kind, tagIds?, mode? }). Inline migration; idempotent on already-
migrated object values.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.5: `board-config.ts` 新型対応

**Files:**
- Modify: `lib/storage/board-config.ts:9-15` (= DEFAULT_BOARD_CONFIG)
- Modify: `tests/lib/board-config.test.ts`

- [ ] **Step 1: Update default config**

Replace [lib/storage/board-config.ts:9-15](lib/storage/board-config.ts#L9):
```typescript
import { BOARD_FILTER_ALL } from '@/lib/board/board-filter-helpers'

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  frameRatio: { kind: 'preset', presetId: DEFAULT_PRESET_ID },
  themeId: DEFAULT_THEME_ID,
  displayMode: 'visual',
  activeFilter: BOARD_FILTER_ALL,
  motionEnabled: true,
}
```

- [ ] **Step 2: Update existing tests for new shape**

`tests/lib/board-config.test.ts` の `activeFilter: 'all'` 期待を `activeFilter: { kind: 'all' }` 等に修正。

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run tests/lib/board-config.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/storage/board-config.ts tests/lib/board-config.test.ts
git commit -m "$(cat <<'EOF'
refactor(board-config): DEFAULT_BOARD_CONFIG uses BOARD_FILTER_ALL object

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.6: `FilterPill` 新型対応 + override 廃止

**Files:**
- Modify: `components/board/FilterPill.tsx`

- [ ] **Step 1: Rewrite label/countFor for object filter + handle tags kind**

`FilterPill.tsx` の `label` / `countFor` を新型対応に置換、 さらに **`overrideLabel` / `overrideCount` prop を削除**:

```tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import { isTagsFilter, BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, BOARD_FILTER_DEAD, boardFilterEquals } from '@/lib/board/board-filter-helpers'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { useChromeScramble } from '@/lib/board/use-idle-scramble'
import styles from './FilterPill.module.css'

type Props = {
  readonly value: BoardFilter
  readonly onChange: (f: BoardFilter) => void
  readonly tags: ReadonlyArray<TagRecord>
  readonly counts: { readonly all: number; readonly inbox: number; readonly archive: number; readonly dead: number }
  /** When the current filter is a tags filter, the parent should pass the
   *  matched bookmark count (= cardinality of the matched set) so the chrome
   *  digit reflects the active tag intersection rather than the total board
   *  count. For non-tags filters this can be undefined; the pill falls back
   *  to counts[kind]. */
  readonly tagsMatchCount?: number
}

function labelFor(f: BoardFilter, tags: ReadonlyArray<TagRecord>): string {
  switch (f.kind) {
    case 'all': return 'AllMarks'
    case 'inbox': return 'INBOX'
    case 'archive': return 'ARCHIVE'
    case 'dead': return 'DEAD LINKS'
    case 'tags': {
      const names = f.tagIds.map((id) => tags.find((t) => t.id === id)?.name ?? '—')
      if (names.length === 0) return 'AllMarks'
      if (names.length === 1) return names[0]
      return `${names[0]} +${names.length - 1}`
    }
  }
}

function countDigits(
  f: BoardFilter,
  counts: { all: number; inbox: number; archive: number; dead: number },
  tagsMatchCount: number | undefined,
): string {
  switch (f.kind) {
    case 'all': return String(counts.all).padStart(3, '0')
    case 'inbox': return String(counts.inbox).padStart(3, '0')
    case 'archive': return String(counts.archive).padStart(3, '0')
    case 'dead': return String(counts.dead).padStart(3, '0')
    case 'tags': return String(tagsMatchCount ?? 0).padStart(3, '0')
  }
}

export function FilterPill({
  value, onChange, tags, counts, tagsMatchCount,
}: Props): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const effectiveLabel = labelFor(value, tags)
  const effectiveCount = countDigits(value, counts, tagsMatchCount)
  const { display: displayLabel, triggerBurst } = useChromeScramble(effectiveLabel)
  const { display: displayCount, triggerBurst: triggerCountBurst } = useChromeScramble(effectiveCount)

  const prevLabelRef = useRef(effectiveLabel)
  const prevCountRef = useRef(effectiveCount)
  useEffect(() => {
    if (prevLabelRef.current !== effectiveLabel) {
      triggerBurst()
      prevLabelRef.current = effectiveLabel
    }
  }, [effectiveLabel, triggerBurst])
  useEffect(() => {
    if (prevCountRef.current !== effectiveCount) {
      triggerCountBurst()
      prevCountRef.current = effectiveCount
    }
  }, [effectiveCount, triggerCountBurst])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const select = (f: BoardFilter): void => {
    onChange(f)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.pill}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={triggerBurst}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="filter-pill"
      >
        <span className={styles.label} data-glitch-text={effectiveLabel}>{displayLabel}</span>
        <span className={styles.separator}>·</span>
        <span className={styles.count} data-glitch-text={effectiveCount}>{displayCount}</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button type="button" className={`${styles.item} ${boardFilterEquals(value, BOARD_FILTER_ALL) ? styles.active : ''}`.trim()} onClick={() => select(BOARD_FILTER_ALL)}>
            ALL <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.all}</span>
          </button>
          <button type="button" className={`${styles.item} ${boardFilterEquals(value, BOARD_FILTER_INBOX) ? styles.active : ''}`.trim()} onClick={() => select(BOARD_FILTER_INBOX)}>
            INBOX <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.inbox}</span>
          </button>
          <button type="button" className={`${styles.item} ${boardFilterEquals(value, BOARD_FILTER_ARCHIVE) ? styles.active : ''}`.trim()} onClick={() => select(BOARD_FILTER_ARCHIVE)}>
            ARCHIVE <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.archive}</span>
          </button>
          {counts.dead > 0 && (
            <button type="button" className={`${styles.item} ${styles.deadItem} ${boardFilterEquals(value, BOARD_FILTER_DEAD) ? styles.active : ''}`.trim()} onClick={() => select(BOARD_FILTER_DEAD)}>
              <span className={styles.deadDot} />
              DEAD LINKS <span style={{ marginLeft: 'auto', color: 'rgba(220,80,80,0.85)' }}>{counts.dead}</span>
            </button>
          )}
          {tags.length > 0 && (
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />
          )}
          {tags.map((m) => {
            const f: BoardFilter = { kind: 'tags', tagIds: [m.id], mode: 'and' }
            const active = isTagsFilter(value) && value.tagIds.length === 1 && value.tagIds[0] === m.id
            return (
              <button key={m.id} type="button" className={`${styles.item} ${active ? styles.active : ''}`.trim()} onClick={() => select(f)}>
                <span className={styles.dot} style={{ background: m.color }} />
                {m.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no FilterPill test exists, or update if it does**

Run: `npx vitest run components/board/FilterPill`
Expected: 既存 test ファイルがあれば update、 無ければ skip。

- [ ] **Step 3: tsc partial check**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: BoardRoot.tsx / Sidebar.tsx 等で残 error が見える (= Task 1.7-1.10 で fix)

- [ ] **Step 4: Commit**

```bash
git add components/board/FilterPill.tsx
git commit -m "$(cat <<'EOF'
refactor(FilterPill): consume BoardFilter object directly, drop override hack

Removes overrideLabel/overrideCount props (= session 73 hack). label
+ count are derived from BoardFilter.kind including 'tags' (= name
or 'name +N-1' format). tagsMatchCount prop replaces overrideCount
for tag-match cardinality.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.7: `BoardBackgroundTypography` 新型対応 (= 本 plan の発端、 ここが核心)

**Files:**
- Modify: `components/board/BoardBackgroundTypography.tsx`
- Modify: `components/board/BoardBackgroundTypography.test.tsx`

- [ ] **Step 1: Update test cases for new type**

```tsx
// BoardBackgroundTypography.test.tsx — add cases for new tags kind
import { BOARD_FILTER_ALL, makeTagsFilter } from '@/lib/board/board-filter-helpers'

it('shows tag name for single-tag filter', () => {
  const tags = [{ id: 't1', name: 'Music', color: '#0f0', createdAt: '' }] as any
  render(<BoardBackgroundTypography activeFilter={makeTagsFilter(['t1'], 'and')} tags={tags} />)
  expect(screen.getByTestId('board-bg-typography')).toHaveTextContent('Music')
})

it("shows 'name +N-1' for multi-tag filter", () => {
  const tags = [
    { id: 't1', name: 'Music', color: '#0f0', createdAt: '' },
    { id: 't2', name: 'Art', color: '#f0f', createdAt: '' },
  ] as any
  render(<BoardBackgroundTypography activeFilter={makeTagsFilter(['t1', 't2'], 'and')} tags={tags} />)
  expect(screen.getByTestId('board-bg-typography')).toHaveTextContent('Music +1')
})

it('hides when tag id no longer exists in tags array', () => {
  render(<BoardBackgroundTypography activeFilter={makeTagsFilter(['ghost'], 'and')} tags={[]} />)
  expect(screen.queryByTestId('board-bg-typography')).toBeNull()
})

// 既存 'AllMarks' / 'Inbox' / 'Archive' / 'Dead Links' case を新型に書き換え
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/board/BoardBackgroundTypography.test.tsx`
Expected: FAIL

- [ ] **Step 3: Rewrite `deriveBoardBgTypoText` for new BoardFilter**

```tsx
export function deriveBoardBgTypoText(
  filter: BoardFilter,
  tags: readonly TagRecord[],
): string {
  switch (filter.kind) {
    case 'all': return 'AllMarks'
    case 'inbox': return 'Inbox'
    case 'archive': return 'Archive'
    case 'dead': return 'Dead Links'
    case 'tags': {
      if (filter.tagIds.length === 0) return 'AllMarks'
      const firstName = tags.find((t) => t.id === filter.tagIds[0])?.name
      if (!firstName) return ''  // first tag id resolution failed → hide
      if (filter.tagIds.length === 1) return firstName
      return `${firstName} +${filter.tagIds.length - 1}`
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/board/BoardBackgroundTypography.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/board/BoardBackgroundTypography.tsx components/board/BoardBackgroundTypography.test.tsx
git commit -m "$(cat <<'EOF'
refactor(bg-typography): derive text from BoardFilter.kind incl. tags

Single tag → name. N tags → 'name +N-1' (= matches FilterPill). Empty
tagIds → fallback AllMarks. Missing tag id → hide (existing semantics).

This is the user-facing fix: card tag-pill clicks now drive the
background wordmark through activeFilter (after Task 1.9 wires it).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.8: `Sidebar` 新型対応

**Files:**
- Modify: `components/board/Sidebar.tsx`

- [ ] **Step 1: Replace activeFilter comparison + tag literal**

Replace `isActive` / `mood:` literal with helpers:

```tsx
import { BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, isTagsFilter, boardFilterEquals } from '@/lib/board/board-filter-helpers'

// inside component:
const isActiveAll = boardFilterEquals(activeFilter, BOARD_FILTER_ALL)
const isActiveInbox = boardFilterEquals(activeFilter, BOARD_FILTER_INBOX)
const isActiveArchive = boardFilterEquals(activeFilter, BOARD_FILTER_ARCHIVE)
const isActiveTag = (id: string): boolean =>
  isTagsFilter(activeFilter) && activeFilter.tagIds.length === 1 && activeFilter.tagIds[0] === id

// usage:
onClick={() => onFilterChange(BOARD_FILTER_ALL)}
onClick={() => onFilterChange(BOARD_FILTER_INBOX)}
onClick={() => onFilterChange(BOARD_FILTER_ARCHIVE)}
// tag row:
const f: BoardFilter = { kind: 'tags', tagIds: [m.id], mode: 'and' }
onClick={() => onFilterChange(f)}
```

- [ ] **Step 2: Verify component still compiles**

Run: `npx tsc --noEmit 2>&1 | grep Sidebar`
Expected: no Sidebar errors

- [ ] **Step 3: Commit**

```bash
git add components/board/Sidebar.tsx
git commit -m "$(cat <<'EOF'
refactor(Sidebar): new BoardFilter object form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.9: `BoardRoot` 大改修 — `useTagFilter` 削除 + 統合配線

**Files:**
- Modify: `components/board/BoardRoot.tsx` (= 複数箇所、 詳細は Step 内)

- [ ] **Step 1: Remove useTagFilter usage**

[BoardRoot.tsx:23](components/board/BoardRoot.tsx#L23): import 削除
```typescript
// 削除: import { useTagFilter } from '@/lib/board/use-tag-filter'
```

[BoardRoot.tsx:85](components/board/BoardRoot.tsx#L85): hook 呼び出し削除
```typescript
// 削除: const tagFilter = useTagFilter()
```

- [ ] **Step 2: Update activeFilter state initial value**

[BoardRoot.tsx:87](components/board/BoardRoot.tsx#L87):
```typescript
import { BOARD_FILTER_ALL, isTagsFilter, toggleTagInFilter, getActiveTagIds } from '@/lib/board/board-filter-helpers'

const [activeFilter, setActiveFilter] = useState<BoardFilter>(BOARD_FILTER_ALL)
```

- [ ] **Step 3: Update matchedBookmarkIds derivation**

[BoardRoot.tsx:477-487](components/board/BoardRoot.tsx#L477) を新型ベースに:

```typescript
const matchedBookmarkIds = useMemo<ReadonlySet<string> | null>(() => {
  if (!isTagsFilter(activeFilter)) return null
  if (activeFilter.tagIds.length === 0) return null
  const ids = new Set<string>()
  const tagIds = activeFilter.tagIds
  for (const it of filteredItems) {
    const matches = activeFilter.mode === 'and'
      ? tagIds.every((tid) => it.tags.includes(tid))
      : tagIds.some((tid) => it.tags.includes(tid))
    if (matches) ids.add(it.id)
  }
  return ids
}, [filteredItems, activeFilter])
```

- [ ] **Step 4: Update handleFilterChange (= persist new object form)**

[BoardRoot.tsx:1109-1116](components/board/BoardRoot.tsx#L1109): 既存のままで OK (= BoardFilter は object になったが代入動作変わらず)。 念のため確認のみ。

- [ ] **Step 5: Update FilterPill prop**

[BoardRoot.tsx:1398-1412](components/board/BoardRoot.tsx#L1398) を簡素化:

```tsx
<FilterPill
  value={activeFilter}
  onChange={handleFilterChange}
  tags={tags}
  counts={sidebarCounts}
  tagsMatchCount={isTagsFilter(activeFilter) ? matchedBookmarkIds?.size ?? 0 : undefined}
/>
```

(= overrideLabel / overrideCount 削除済、 tagsMatchCount に置換)

- [ ] **Step 6: Update MANAGE TAGS routing**

[BoardRoot.tsx:1432-1445](components/board/BoardRoot.tsx#L1432) を新型ベースに:

```tsx
<TagButton
  onClick={(): void => {
    if (activeFilter.kind === 'all') {
      router.push('/triage')
    } else if (activeFilter.kind === 'tags' && activeFilter.tagIds.length === 1) {
      router.push(`/triage?mode=tag:${activeFilter.tagIds[0]}`)
    } else {
      router.push('/triage?mode=untagged')
    }
  }}
/>
```

- [ ] **Step 7: Update CardsLayer tag-filter prop wiring**

[BoardRoot.tsx:1541](components/board/BoardRoot.tsx#L1541) を新型ベースに:

```tsx
onTagFilterToggle={(tagId): void => {
  handleFilterChange(toggleTagInFilter(activeFilter, tagId))
}}
```

- [ ] **Step 8: tsc full check**

Run: `npx tsc --noEmit`
Expected: 0 errors (= 残り file が CardsLayer に Task 1.10 で対応、 但し既に compatible なら 0 errors)

もし errors 残 → 該当箇所を fix。

- [ ] **Step 9: Run full test suite**

Run: `npx vitest run`
Expected: 全 PASS (= delta は migration test +7、 filter test +2、 typography test +3 等)

- [ ] **Step 10: Commit**

```bash
git add components/board/BoardRoot.tsx
git commit -m "$(cat <<'EOF'
refactor(BoardRoot): drop useTagFilter, unify under activeFilter object

- useTagFilter hook removed; activeFilter (= BoardFilter object) is
  the single source of truth.
- matchedBookmarkIds is now a useMemo over activeFilter.tagIds.
- Card tag-pill clicks route through toggleTagInFilter +
  handleFilterChange so the click persists to IDB and reflects
  everywhere (chrome + bg typography + dropdown active state).
- MANAGE TAGS routing updated for the new shape.

This wires up the actual user-visible fix: tag-pill clicks now
animate the background wordmark, persist across reloads, and stay
consistent with the dropdown filter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.10: `CardsLayer` の onTagFilterToggle 経路 (= 既に互換、 念のため確認)

**Files:**
- Verify: `components/board/CardsLayer.tsx:279,317,1009-1015`

- [ ] **Step 1: Read current signature**

`onTagFilterToggle?: (tagId: string) => void` — Task 1.9 で BoardRoot から渡している callback の signature と一致。 内部の TagIndicatorStrip `onTagClick={onTagFilterToggle}` も互換。

- [ ] **Step 2: No code change required, just verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Skip commit (= no change)**

---

## Task 1.11: 旧 `useTagFilter` hook 削除

**Files:**
- Delete: `lib/board/use-tag-filter.ts`
- Delete: `tests/lib/use-tag-filter.test.ts` (= 存在すれば)

- [ ] **Step 1: Verify no remaining import**

Run: `grep -r "use-tag-filter" --include="*.ts" --include="*.tsx" .`
Expected: 0 hits (= Task 1.9 で全部削除済)

- [ ] **Step 2: Delete files**

```bash
git rm lib/board/use-tag-filter.ts
# if test exists:
git rm tests/lib/use-tag-filter.test.ts 2>/dev/null || true
```

- [ ] **Step 3: Run full test suite + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全 PASS, 0 errors

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: remove obsolete useTagFilter hook

Replaced by unified activeFilter (= BoardFilter object) in BoardRoot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.12: 周辺 component scan — 残 BoardFilter literal の根絶

**Files:**
- Grep: `'mood:` literals, string 'all'|'inbox'|'archive'|'dead' filter comparisons

- [ ] **Step 1: Find lingering legacy filter literals**

Run: `grep -rn "mood:" --include="*.ts" --include="*.tsx" components/ lib/`
Expected: コメント内残のみ (= IDB 互換 note 文等)、 実 code 0 hits

Run: `grep -rn "activeFilter === '" --include="*.ts" --include="*.tsx" .`
Expected: 0 hits

- [ ] **Step 2: Fix any remaining hits**

(= 想定 0、 但し見つかれば該当箇所を helper 経由に置換)

- [ ] **Step 3: Skip commit if no change**

---

# Phase 2: 検証 + Deploy

## Task 2.1: Full test suite + tsc + build

- [ ] **Step 1: vitest full run**

Run: `npx vitest run`
Expected: 全 PASS (= 806 → 819 程度、 +13 (helpers 4 / migration 7 / typography 3 / backup 3 - 既存 use-tag-filter test 削除分))

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: pnpm build**

Run: `pnpm build`
Expected: 成功、 25 routes static prerender

- [ ] **Step 4: ESLint** (= 任意、 既存 baseline 維持確認)

Run: `pnpm lint 2>&1 | tail -20`
Expected: 新規 error 0

---

## Task 2.2: Playwright 実機検証

**Files:**
- Test: ad hoc playwright script (= `/tmp/verify-filter-unification.mjs`)

- [ ] **Step 1: Start preview server**

Run: `npx wrangler@latest pages dev out --port=8788`
Expected: 8788 で起動

- [ ] **Step 2: Playwright script (= 本人画面 1489 × 2.58)**

```javascript
// /tmp/verify-filter-unification.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1489, height: 679 },
  deviceScaleFactor: 2.58,
})
const page = await ctx.newPage()
await page.goto('http://localhost:8788/board')
// Wait for board ready
await page.waitForSelector('[data-testid="filter-pill"]')

// シナリオ 1: タグピル click → 背景文字変化
// (= 事前にカードに tag を付けておく必要、 seed-demos と + TAG 経由)
// 詳細は実行時に手調整

// シナリオ 2: リロード後の復元確認
await page.reload()
await page.waitForSelector('[data-testid="filter-pill"]')
const labelAfterReload = await page.textContent('[data-testid="filter-pill"]')
console.log('Reload restored label:', labelAfterReload)

await browser.close()
```

- [ ] **Step 3: Run script + assert**

```bash
node /tmp/verify-filter-unification.mjs
```

確認項目:
1. seed-demos → カード 2 枚に「Test」 タグ付与
2. カードの「Test」 タグピル click → 背景文字「Test」 に変わる + chrome FilterPill も「Test」 に変わる
3. リロード → 同じ「Test」 状態が復元される
4. もう一度 click → 解除されて「AllMarks」 に戻る

- [ ] **Step 4: 既存 IDB 持ち user パターンの確認** (= 一番怖いケース)

DevTools で IDB に v15 形式の activeFilter (= `'mood:<id>'` string) を手動で書き込み → reload で migration が走り、 v16 形式の object になっているかを確認。 alternatively、 git stash で旧 build の出力を作って IDB を v15 で初期化 → 最新 build に切り替えてリロードする手順でも OK。

(= 自動化困難なので手動 + screenshot 保存推奨)

---

## Task 2.3: Preview deploy + user 確認

- [ ] **Step 1: Preview deploy**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=refactor-board-filter --commit-dirty=true --commit-message="phase1 board filter unification"
```

(= 別 branch で preview deploy、 まだ master に出さない)

- [ ] **Step 2: User に preview URL を渡して確認依頼**

User 確認項目:
1. カードのタグピル click で背景の AllMarks 文字が tag 名に変わる
2. 複数タグ click で「Music +1」 のような表示
3. リロードしても状態が復元される
4. EXPORT/IMPORT button が機能している (= Phase 0 で確認済だが再確認)
5. 既存 mood: filter (= dropdown 経由) も従来通り動く

- [ ] **Step 3: User 確認 OK 後、 master merge + 本番 deploy**

```bash
git checkout master
git merge --no-ff refactor/board-filter-unification
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="merge board filter unification"
```

---

## Task 2.4: Docs 更新

**Files:**
- Modify: `docs/TODO.md` (= 「現在の状態」 を session 74 narrative で更新)
- Modify: `docs/TODO_COMPLETED.md` (= session 74 narrative 追記)
- Modify: `docs/CURRENT_GOAL.md` (= 次セッション用に上書き、 Triage 側 polish 残 + Phase D 必須を再列挙)

- [ ] **Step 1: Update TODO.md 現在の状態**

session 73 ブロックを「旧情報」 の見出し下に移動、 session 74 ブロックを先頭に追加 (= 案 C 完遂 narrative + 残 Triage polish 8 + Phase D 5)

- [ ] **Step 2: Update TODO_COMPLETED.md**

session 74 セクションを narrative で追記 (= Phase 0 / 1 / 2 の流れ、 deploy 回数、 test 数推移、 user 検証ステップ)

- [ ] **Step 3: Rewrite CURRENT_GOAL.md for session 75**

セッション 74 の到達点 + 残 Triage polish 8 + Phase D 5 + 月末 (= 2026-05-31) ドメイン確認

- [ ] **Step 4: Commit**

```bash
git add docs/TODO.md docs/TODO_COMPLETED.md docs/CURRENT_GOAL.md
git commit -m "$(cat <<'EOF'
docs: session 74 close-out — BoardFilter unification 完遂

Phase 0 (JSON backup) + Phase 1 (BoardFilter object unification +
IDB v16 migration) + Phase 2 (verify + deploy). User-facing fix:
カードタグピル click が背景文字と chrome 両方を同じ source of truth
で駆動するように。 リロード復元も副産物として実装。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Rollback Procedure (= 万一の備え)

⚠️ **Phase 1 完了後に user が「壊れた」 と報告した場合の手順** (= 想定上の保険、 実際は Phase 0 export を活用):

1. **Cloudflare Pages dashboard で旧 deploy にロールバック** (= `booklage.pages.dev` を Phase 0 直後の deploy に戻す)
2. User に「ブラウザ DevTools → IDB → booklage-db 削除」 を依頼
3. User が EXPORT した JSON を IMPORT で復元
4. 復元後の board に問題があれば git の master を旧 commit にも戻す (= `git reset --hard <phase0-commit>` + force push、 但しこれは destructive なので user 確認必須)

---

# Self-Review (= writing-plans skill 指示通り)

## 1. Spec coverage チェック
- ✅ Phase 0 = JSON backup 機能: Task 0.1-0.4
- ✅ Phase 1 = BoardFilter 型統合: Task 1.1-1.12
  - BoardFilter object 化 (1.1)
  - applyFilter 新型 (1.2)
  - migration helper (1.3)
  - IDB schema bump (1.4)
  - board-config (1.5)
  - FilterPill (1.6)
  - BoardBackgroundTypography (1.7) ← 本 plan の発端
  - Sidebar (1.8)
  - BoardRoot (1.9) ← useTagFilter 廃止
  - CardsLayer 互換確認 (1.10)
  - useTagFilter file 削除 (1.11)
  - 残 literal 根絶 (1.12)
- ✅ Phase 2 = 検証 + deploy: Task 2.1-2.4

## 2. Placeholder scan
- ✅ "TBD" / "TODO" / "fill in details" 等の skeleton 表記なし
- ✅ 全 step が code or 具体的コマンドを伴う
- ⚠️ Task 2.2 の playwright script は ad hoc (= 「実行時に手調整」 と注記済)。 manual verification step として許容範囲

## 3. Type consistency
- `BoardFilter` 型は Task 1.1 で定義、 全 task で同 shape (= `{ kind: ... }` discriminated union) を参照
- helper 関数名は一貫 (`BOARD_FILTER_ALL` / `makeTagsFilter` / `isTagsFilter` / `getActiveTagIds` / `boardFilterEquals` / `toggleTagInFilter`)
- `BackupJson` interface は Task 0.1 で定義、 Task 0.2 で同 shape を import

---

# 実行モード選択 (= user 確認待ち)

**Plan complete and saved to `docs/superpowers/plans/2026-05-25-board-filter-unification.md`. Two execution options:**

**1. Inline Execution** (= 本 session 内で task ごと checkpoint、 user 立ち会いで進行) — **本案推奨** (= 非エンジニア user との対話進行が安定、 Phase 0 単独 ship で user export 待つフェーズが自然)

**2. Subagent-Driven** (= fresh subagent を task ごと dispatch、 review 経由で進行) — 速いが user 立ち会い度が薄い、 大物 refactor で適合度は高いが今回は不要

**Which approach?**
