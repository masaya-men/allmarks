# 端末間同期 束3（足し算マージ + Drive 読み書き）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ①store 別の「足し算マージ」純関数群（`lib/sync/merge.ts`）と ②Google Drive REST v3 の読み書き薄ラッパ（`lib/sync/drive-adapter.ts`）を作る。どちらも既存コードから呼ばれない（束1 `device-id.ts` / 束2 `auth.ts` と同じ・既存挙動は 1px も変わらない）。

**Architecture:** 2 ファイル、どちらも自己完結。(1) `merge.ts` = 完全な純関数。`local` と `remote` の 2 つのスナップショットを受け取り、id 単位の和集合を作って返す。IndexedDB も fetch も一切触らない。テストの主戦場。(2) `drive-adapter.ts` = `fetch` のみ。**access token は引数で注入**（`auth.ts` の `SyncTokens.accessToken` を渡す想定・secret は持たない）。可視フォルダ `AllMarks/` の探索・作成、フォルダ内 `.json` の一覧・取得、楽観ロック用の `headRevisionId` 取得、multipart での作成・更新。pull/merge/push のオーケストレーション（`engine.ts`）と IndexedDB との橋渡し（`sync-store.ts`）は**束4**。

**Tech Stack:** TypeScript strict / 純関数（外部依存ゼロ）/ Google Drive REST v3（`www.googleapis.com/drive/v3` + `www.googleapis.com/upload/drive/v3`）/ vitest（`vi.stubGlobal('fetch')` で Google をモック・jsdom）。

**Spec:** `docs/private/2026-09-02-device-sync-design.md`（§5 = Drive 上のファイル構成 / §6 = マージ規則 / §9 = Private の id 単位マージ / §11 = テスト方針 / §15 = 必須制約。非公開・gitignored）。この plan は spec と一緒に読むこと。

## Global Constraints

- **同期未接続の挙動は 1px も変えない。** この束の追加物（`lib/sync/merge.ts` / `lib/sync/drive-adapter.ts` の 2 ファイルとテスト）はどれも既存コードから import されない。最終タスクで `git grep` が 0 件であることを確認する。
- **`merge.ts` は完全な純関数。** `Date.now()` / `crypto` / `fetch` / IndexedDB / `window` を一切呼ばない。時刻は必ず引数のレコードから読む。
- **`merge.ts` は `updatedAt` を生の値のまま数値比較しない。** 必ず `typeof x === 'number' && Number.isFinite(x) ? x : 0` を通す。理由: v17 前のバックアップを `importAllStores` で復元すると `updatedAt` 無しの行が残り、migration は再実行できない（設計 §15）。**代替案（`importAllStores` に backfill 3 行）は採らない**（CURRENT_GOAL の「どちらか明示的に選ぶ」に対する決定 = merge 側で吸収する。復元経路を触らない方が安全）。
- **`drive-adapter.ts` は `fetch` のみ。** `access_token` は毎回引数で受け取る。token 更新・永続化・リトライ・楽観ロックの判断は一切しない（束4 の責務）。secret は持たない。
- **TypeScript strict。** `any` 禁止 → `unknown` + 型ガード。全関数の戻り値型を明示。Props/公開関数に JSDoc。
- **Vanilla のみ。** 新規 npm 依存を足さない。
- **`rtk` 前置・`--no-verify` 禁止。** vitest / playwright は素の `npx`（`rtk npx` は既知の不具合）。tsc は `rtk npx tsc --noEmit`。
- **deploy 前ゲート:** `rtk npx tsc --noEmit && npx vitest run && rtk pnpm build`。
- **コミット規約:** `feat(sync):` / `test(sync):`。各コミット末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- **ブランチ:** `feat/device-sync-bundle-3`（Task 1 の頭で master から作成）。
- **テストの置き場所:** ソースの隣（`lib/sync/merge.test.ts` / `lib/sync/drive-adapter.test.ts`）。束2 の `lib/sync/*.test.ts` 3 ファイルと同じ規約。

---

## 設計上の判断（spec の補足・実装者は必読）

### 1. `merge.ts` は 2-way マージ（base スナップショット無し）

設計 §7.5 の base スナップショット（「ローカルだけの変更」と「リモートだけの変更」を区別する 3-way）と §6.5 の衝突退避（負けた版を `settings` に 30 日保管 + トースト）は **束4** の `engine.ts` の責務。束3 の `merge.ts` は `local ∪ remote` の 2-way だけを、決定的に（引数の順番を入れ替えても同じ結果）行う。衝突検出のための戻り値（負けた版のリスト等）はこの束では返さない — YAGNI。束4 が必要になったら拡張する。

### 2. `updatedAt` 同値のときの決定的タイブレーク（設計 §6.1「同値なら id 文字列が大きい方」の解釈）

id で突き合わせているので「id 文字列が大きい方」は成立しない（id は同一）。意図は「`updatedAt` が同値のとき、引数の順番に依存しない決定的な勝者を選ぶ」。**実装 = 2 レコードを安定シリアライズ（キーを再帰的にソートした JSON）して、文字列として大きい方を採用**。`mergeBookmarks(a,b)` と `mergeBookmarks(b,a)` が必ず同じ結果になる。現実にはミリ秒まで一致する編集はほぼ起きないが、決定性テスト（§11）のために必要。

### 3. board-config の `updatedAt` はまだ本体に無い

`lib/storage/board-config.ts` の保存レコードは `{ key, config }` で `updatedAt` を持たない。設計 §5 の `board-config.json` は `{ config, updatedAt }`。**この束では `saveBoardConfig` を触らない**（束4 が「保存のたびに `updatedAt` を打つ」配線をする）。`mergeBoardConfig` は `{ config, updatedAt?: number }` を受け取り、`updatedAt` が無ければ 0 として扱う。merge 側は束4 の配線を待たずに正しく動く形にしておく。

### 4. vault は v1 では「作成一度きり・以後不変」前提の deterministic pick

`PrivateVaultRecord` に `updatedAt` は無い（設計 §9）。両端末にあれば内容は同一のはず。`mergeVault` は「両方 null → null / 片方だけ → それ / 両方 → deep-equal なら片方、違えば決定的 pick」。パスワード再設定（`wrappedPrivateKey` が変わる）で LWW が要るのは将来 — その時 `mergeVault` に `updatedAt` 比較を足すだけで済む形にコメントを残す。**中の暗号文は絶対に復号しない・見ない**（束3 は `PrivateVaultRecord` を不透明な値として扱う）。

### 5. Private ブクマは `mergeBookmarks` がそのまま処理する（特別扱い無し）

設計 §9: Private ブクマは `bookmarks.json` に `encryptedPayload` を持ったまま載る。マージは §6 と同じ id 単位。`encryptedPayload` は `BookmarkRecord` の 1 フィールドに過ぎず、`mergeBookmarks` は中身を一切見ない。専用のコードパスは作らない。テストで「`encryptedPayload` が違う同一 id のブクマが LWW で正しくマージされ、暗号文が破壊されない」ことだけ確認する。

### 6. Drive フォルダの識別 = 名前 AND `appProperties` マーカー（設計 §5）

`findSyncFolder` は `name = 'AllMarks' and mimeType = folder and trashed = false` で検索し、**さらに結果を `appProperties.allmarksSync === '1'` で絞る**。ユーザーが手で作った無関係の "AllMarks" フォルダを掴まない。`createSyncFolder` は必ずこのマーカーを付けて作る。マーカー付きが複数見つかったら id を辞書順で最小のものを選ぶ（決定的）。

### 7. `emptyTrash` / `deleteBookmark` の物理削除は束4 の確認事項（束3 では扱わない）

`lib/storage/use-board-data.ts` の `emptyTrash` と `lib/storage/indexeddb.ts` の `deleteBookmark` はブクマを**墓標なしで物理削除**する（タグと違う）。足し算マージだと「ローカルに無い = リモートから復活」になる。設計 §6 が「EMPTY TRASH は端末ローカル」を実際にカバーしているかは**束4 の engine 着手前**に確認する（`merge.ts` は「ローカルに無く・リモートにある id は採用」で正しい — 何を `local` として渡すかは束4 の判断）。この束では記録だけ。

---

## File Structure

| ファイル | 責務 | 新規/変更 |
|---|---|---|
| `lib/sync/merge.ts` | store 別の足し算マージ純関数。`SyncSnapshot` 型（束4 が Drive の 6 ファイルに分解・再構成する in-memory 形）＋ `mergeBookmarks` / `mergeTags` / `mergeCards` / `mergeBoardConfig` / `mergeVault` / `mergeAll`。外部依存ゼロ | 新規 |
| `lib/sync/merge.test.ts` | 上記の全ケース（設計 §11） | 新規 |
| `lib/sync/drive-adapter.ts` | Google Drive REST v3 の薄ラッパ。`DriveError` / `DriveFileMeta` / `buildMultipartRelated`（純）/ `findSyncFolder` / `createSyncFolder` / `listFolderFiles` / `downloadFileText` / `getHeadRevisionId` / `createTextFile` / `updateTextFile`。access token 注入・fetch のみ | 新規 |
| `lib/sync/drive-adapter.test.ts` | fetch モックで全関数の送信リクエストと応答マッピングを検証 | 新規 |

**触ってはいけないファイル:** `lib/storage/*`（`board-config.ts` 含む）、`lib/private/*`、`components/*`、`app/*`、`functions/*`、`lib/sync/auth.ts` / `google-identity.ts` / `gauth-types.ts` / `device-id.ts`（束1・束2 の成果物・import はするが編集しない）、`wrangler.toml`、`.env*`。

---

## Task 1: `merge.ts` — 型・ヘルパー・`mergeBookmarks`

**Files:**
- Create: `lib/sync/merge.ts`
- Test: `lib/sync/merge.test.ts`

**Interfaces:**
- Consumes:
  - `type BookmarkRecord` from `@/lib/storage/indexeddb`
  - `type TagRecord`, `type CardRecord` from `@/lib/storage/indexeddb`（型だけ・Task 2/3 で使う。この Task では `SyncSnapshot` の定義に必要）
  - `type BoardConfig` from `@/lib/board/types`
  - `type PrivateVaultRecord` from `@/lib/private/vault-store`
- Produces:
  - `interface SyncBoardConfig { readonly config: BoardConfig; readonly updatedAt?: number }`
  - `interface SyncSnapshot { readonly bookmarks: readonly BookmarkRecord[]; readonly tags: readonly TagRecord[]; readonly cards: readonly CardRecord[]; readonly boardConfig: SyncBoardConfig | null; readonly vault: PrivateVaultRecord | null }`
  - `mergeBookmarks(local: readonly BookmarkRecord[], remote: readonly BookmarkRecord[]): BookmarkRecord[]`（id 昇順ソートで返す）
  - 内部ヘルパー（**export しない**）: `numericTime(x: unknown): number` / `deletedAtMs(iso: unknown): number` / `stableStringify(v: unknown): string` / `pickDeterministic<T>(a: T, b: T): T`

### 契約（`mergeBookmarks` — 設計 §6.1）

`local` と `remote` を id で突き合わせ、和集合を返す:

- **片方にしか無い id** → そのまま採用（追加は絶対に消えない）
- **両方に有る id** → 次の 3 ケース:
  1. **どちらも非トゥームストーン**（`isDeleted !== true`）→ `updatedAt`（`numericTime` 経由）が大きい方を採用。同値なら `pickDeterministic`。**採用したレコードの `tags` は、両者の `tags` の和集合**（winner の順を先頭に、loser の未含有分を後ろに追加。重複除去）
  2. **どちらもトゥームストーン**（両方 `isDeleted === true`）→ `deletedAt`（`deletedAtMs` 経由・ISO→ms）が新しい方を採用。同値なら `pickDeterministic`。`isDeleted: true` を保つ
  3. **片方だけトゥームストーン**（例: `a` が墓標・`b` が生存）→ `deletedAtMs(a.deletedAt) >= numericTime(b.updatedAt)` なら**墓標が勝つ**（`a` を `isDeleted: true` で採用）。そうでなければ**生存側が勝つ**（`b` をそのまま採用 — tags 和集合はしない。設計「両方が非トゥームストーンのとき」だけ union）
- 戻り値は **id 昇順**でソート（決定性テストで配列そのものを比較できるように）

### ヘルパーの仕様

```ts
/** レコードの updatedAt を有限数として読む。undefined / NaN / 文字列（v17 前の
 *  バックアップ復元で updatedAt 無しの行が残る・migration 再実行不可）は 0。
 *  → スタンプ済みレコードが必ず未スタンプに勝つ。設計 §15。 */
function numericTime(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0
}

/** ISO 8601 の deletedAt を epoch ms に。文字列でない / 解釈不能なら 0。 */
function deletedAtMs(iso: unknown): number {
  if (typeof iso !== 'string') return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** キーを再帰的にソートした JSON 文字列。決定的タイブレーク専用
 *  （意味的な順序ではなく「引数順に依存しない安定な比較キー」が目的）。 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** 2 つのうち安定シリアライズが文字列として大きい方。a===b 相当なら a。 */
function pickDeterministic<T>(a: T, b: T): T {
  return stableStringify(a) >= stableStringify(b) ? a : b
}
```

- [ ] **Step 1: ブランチを作る**

```bash
rtk git checkout master
rtk git pull --ff-only
rtk git checkout -b feat/device-sync-bundle-3
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/sync/merge.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import { mergeBookmarks } from './merge'

/** 最小限のフィールドで BookmarkRecord を作る（未使用フィールドは既定で埋める）。 */
function bm(over: Partial<BookmarkRecord> & Pick<BookmarkRecord, 'id'>): BookmarkRecord {
  return {
    id: over.id,
    url: over.url ?? `https://example.com/${over.id}`,
    title: over.title ?? `title-${over.id}`,
    description: '',
    thumbnail: '',
    favicon: '',
    siteName: '',
    type: 'website',
    savedAt: over.savedAt ?? '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched',
    tags: over.tags ?? [],
    ...over,
  }
}

describe('mergeBookmarks — union by id', () => {
  it('keeps an id that exists only locally', () => {
    const out = mergeBookmarks([bm({ id: 'a' })], [])
    expect(out.map((b) => b.id)).toEqual(['a'])
  })

  it('keeps an id that exists only remotely', () => {
    const out = mergeBookmarks([], [bm({ id: 'b' })])
    expect(out.map((b) => b.id)).toEqual(['b'])
  })

  it('3 local + 2 different remote = 5 (additions never disappear)', () => {
    const local = [bm({ id: 'a' }), bm({ id: 'b' }), bm({ id: 'c' })]
    const remote = [bm({ id: 'd' }), bm({ id: 'e' })]
    expect(mergeBookmarks(local, remote).map((b) => b.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('returns bookmarks sorted by id', () => {
    const out = mergeBookmarks([bm({ id: 'z' }), bm({ id: 'm' })], [bm({ id: 'a' })])
    expect(out.map((b) => b.id)).toEqual(['a', 'm', 'z'])
  })
})

describe('mergeBookmarks — scalar conflict (LWW by updatedAt)', () => {
  it('takes the newer record when the same id was edited on both sides', () => {
    const local = [bm({ id: 'a', title: 'old', updatedAt: 100 })]
    const remote = [bm({ id: 'a', title: 'new', updatedAt: 200 })]
    expect(mergeBookmarks(local, remote)[0].title).toBe('new')
    // order-independent
    expect(mergeBookmarks(remote, local)[0].title).toBe('new')
  })

  it('treats a missing updatedAt as 0 (stamped record wins)', () => {
    const local = [bm({ id: 'a', title: 'stamped', updatedAt: 1 })]
    const remote = [bm({ id: 'a', title: 'unstamped' })] // no updatedAt
    expect(mergeBookmarks(local, remote)[0].title).toBe('stamped')
    expect(mergeBookmarks(remote, local)[0].title).toBe('stamped')
  })

  it('treats a non-numeric updatedAt as 0', () => {
    const local = [bm({ id: 'a', title: 'good', updatedAt: 5 })]
    const remote = [bm({ id: 'a', title: 'bad', updatedAt: NaN as unknown as number })]
    expect(mergeBookmarks(local, remote)[0].title).toBe('good')
  })

  it('equal updatedAt -> deterministic winner regardless of arg order', () => {
    const l = [bm({ id: 'a', title: 'L', updatedAt: 50 })]
    const r = [bm({ id: 'a', title: 'R', updatedAt: 50 })]
    const ab = mergeBookmarks(l, r)[0].title
    const ba = mergeBookmarks(r, l)[0].title
    expect(ab).toBe(ba)
  })
})

describe('mergeBookmarks — tags union (both live)', () => {
  it('unions the tag arrays of both sides onto the LWW winner', () => {
    const local = [bm({ id: 'a', tags: ['x'], updatedAt: 200 })]
    const remote = [bm({ id: 'a', tags: ['y'], updatedAt: 100 })]
    expect(mergeBookmarks(local, remote)[0].tags.sort()).toEqual(['x', 'y'])
  })

  it('dedupes tags', () => {
    const local = [bm({ id: 'a', tags: ['x', 'y'], updatedAt: 2 })]
    const remote = [bm({ id: 'a', tags: ['y', 'z'], updatedAt: 1 })]
    expect(mergeBookmarks(local, remote)[0].tags).toEqual(['x', 'y', 'z'])
  })

  it('winner tags come first, loser extras appended (deterministic)', () => {
    const local = [bm({ id: 'a', tags: ['b', 'a'], updatedAt: 9 })]
    const remote = [bm({ id: 'a', tags: ['c'], updatedAt: 1 })]
    expect(mergeBookmarks(local, remote)[0].tags).toEqual(['b', 'a', 'c'])
  })
})

describe('mergeBookmarks — tombstone vs edit (§6.1)', () => {
  it('tombstone wins when deletedAt >= the other side updatedAt (boundary: equal)', () => {
    const tomb = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-05-01T00:00:00.000Z', updatedAt: Date.parse('2026-05-01T00:00:00.000Z') })]
    const edit = [bm({ id: 'a', title: 'edited', updatedAt: Date.parse('2026-05-01T00:00:00.000Z') })]
    const out = mergeBookmarks(edit, tomb)[0]
    expect(out.isDeleted).toBe(true)
  })

  it('edit wins when it is strictly newer than the tombstone', () => {
    const tomb = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-05-01T00:00:00.000Z' })]
    const edit = [bm({ id: 'a', title: 'edited', updatedAt: Date.parse('2026-06-01T00:00:00.000Z') })]
    const out = mergeBookmarks(tomb, edit)[0]
    expect(out.isDeleted).not.toBe(true)
    expect(out.title).toBe('edited')
  })

  it('restore (isDeleted:false, updatedAt bumped to now) beats an older tombstone', () => {
    const tomb = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z' })]
    const restored = [bm({ id: 'a', isDeleted: false, updatedAt: Date.parse('2026-09-01T00:00:00.000Z') })]
    const out = mergeBookmarks(tomb, restored)[0]
    expect(out.isDeleted).toBe(false)
  })

  it('both tombstones -> keeps the later deletedAt', () => {
    const early = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z' })]
    const late = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-02-01T00:00:00.000Z' })]
    const out = mergeBookmarks(early, late)[0]
    expect(out.isDeleted).toBe(true)
    expect(out.deletedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(mergeBookmarks(late, early)[0].deletedAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('does NOT union tags when one side is a tombstone', () => {
    const tomb = [bm({ id: 'a', tags: ['gone'], isDeleted: true, deletedAt: '2026-09-01T00:00:00.000Z' })]
    const live = [bm({ id: 'a', tags: ['here'], updatedAt: 1 })]
    const out = mergeBookmarks(live, tomb)[0]
    expect(out.isDeleted).toBe(true)
    expect(out.tags).toEqual(['gone'])
  })
})

describe('mergeBookmarks — Private bookmarks (§9: merge by id, never inspect ciphertext)', () => {
  const payloadA = { ephemeralPublicKey: 'ekA', iv: 'ivA', ciphertext: 'ctA' }
  const payloadB = { ephemeralPublicKey: 'ekB', iv: 'ivB', ciphertext: 'ctB' }

  it('a Private bookmark present only remotely is kept intact', () => {
    const out = mergeBookmarks([], [bm({ id: 'p', title: '', encryptedPayload: payloadA })])
    expect(out[0].encryptedPayload).toEqual(payloadA)
  })

  it('same id, different encryptedPayload -> newer wins, ciphertext untouched', () => {
    const local = [bm({ id: 'p', title: '', encryptedPayload: payloadA, updatedAt: 100 })]
    const remote = [bm({ id: 'p', title: '', encryptedPayload: payloadB, updatedAt: 200 })]
    expect(mergeBookmarks(local, remote)[0].encryptedPayload).toEqual(payloadB)
    expect(mergeBookmarks(remote, local)[0].encryptedPayload).toEqual(payloadB)
  })
})
```

- [ ] **Step 3: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: FAIL（`./merge` が存在しない）

- [ ] **Step 4: `merge.ts` を実装**

`lib/sync/merge.ts`:

```ts
// lib/sync/merge.ts
// 端末間同期の「足し算マージ」。local と remote の 2 つのスナップショットを
// id 単位で和集合にする完全な純関数群。IndexedDB / fetch / Date.now / crypto を
// 一切呼ばない。設計 §6（マージ規則）・§9（Private の id 単位マージ）・§15。
//
// base スナップショット（3-way）と衝突退避（§6.5）は束4 の engine の責務。
// ここは 2-way で「決定的（引数の順番に依存しない）」だけを保証する。
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import type { BoardConfig } from '@/lib/board/types'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'

/** board-config.json の中身（設計 §5）。updatedAt は束4 が saveBoardConfig の
 *  たびに打つ。まだ配線されていない / 古いスナップショットでは undefined → 0 扱い。 */
export interface SyncBoardConfig {
  readonly config: BoardConfig
  readonly updatedAt?: number
}

/** device-sync が Drive 経由で往復させる全 store の in-memory 形（設計 §5）。
 *  束4 の engine がこれを 6 つの JSON ファイルに分解し、また組み立て直す。 */
export interface SyncSnapshot {
  readonly bookmarks: readonly BookmarkRecord[]
  readonly tags: readonly TagRecord[]
  readonly cards: readonly CardRecord[]
  readonly boardConfig: SyncBoardConfig | null
  readonly vault: PrivateVaultRecord | null
}

// ── 純ヘルパー（module-private）────────────────────────────────────────────

/** レコードの updatedAt を有限数として読む。undefined / NaN / 文字列
 *  （v17 前バックアップの復元で updatedAt 無しの行が残る・migration 再実行不可）
 *  は 0 → スタンプ済みが必ず未スタンプに勝つ。設計 §15。 */
function numericTime(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0
}

/** ISO 8601 の deletedAt を epoch ms に。文字列でない / 解釈不能なら 0。 */
function deletedAtMs(iso: unknown): number {
  if (typeof iso !== 'string') return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** キーを再帰的にソートした JSON。決定的タイブレーク専用の安定比較キー。 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** 2 つのうち安定シリアライズが文字列として大きい方。引数順に依存しない。 */
function pickDeterministic<T>(a: T, b: T): T {
  return stableStringify(a) >= stableStringify(b) ? a : b
}

/** winner の順を保ちつつ loser の未含有要素を後ろに足す（重複除去）。 */
function unionOrdered(winner: readonly string[], loser: readonly string[]): string[] {
  const out = [...winner]
  for (const t of loser) if (!out.includes(t)) out.push(t)
  return out
}

/** id をキーにした Map。後勝ち（呼び出し側は同一配列内に重複 id を渡さない前提）。 */
function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const r of rows) m.set(r.id, r)
  return m
}

// ── bookmarks（設計 §6.1）──────────────────────────────────────────────────

function mergeOneBookmark(a: BookmarkRecord, b: BookmarkRecord): BookmarkRecord {
  const aDel = a.isDeleted === true
  const bDel = b.isDeleted === true

  // ケース2: どちらも墓標 → deletedAt が新しい方（同値は決定的）
  if (aDel && bDel) {
    const am = deletedAtMs(a.deletedAt)
    const bm = deletedAtMs(b.deletedAt)
    if (am > bm) return { ...a, isDeleted: true }
    if (bm > am) return { ...b, isDeleted: true }
    return { ...pickDeterministic(a, b), isDeleted: true }
  }

  // ケース3: 片方だけ墓標
  if (aDel !== bDel) {
    const tomb = aDel ? a : b
    const live = aDel ? b : a
    if (deletedAtMs(tomb.deletedAt) >= numericTime(live.updatedAt)) {
      return { ...tomb, isDeleted: true }
    }
    return live // 生存側が勝つ（tags 和集合はしない）
  }

  // ケース1: どちらも生存 → LWW（同値は決定的）＋ tags 和集合
  const at = numericTime(a.updatedAt)
  const bt = numericTime(b.updatedAt)
  let winner: BookmarkRecord
  let loser: BookmarkRecord
  if (at > bt) { winner = a; loser = b }
  else if (bt > at) { winner = b; loser = a }
  else { winner = pickDeterministic(a, b); loser = winner === a ? b : a }
  return { ...winner, tags: unionOrdered(winner.tags, loser.tags) }
}

/** local ∪ remote（id 単位）。id 昇順で返す。設計 §6.1。 */
export function mergeBookmarks(
  local: readonly BookmarkRecord[],
  remote: readonly BookmarkRecord[],
): BookmarkRecord[] {
  const l = byId(local)
  const r = byId(remote)
  const out: BookmarkRecord[] = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    if (a && b) out.push(mergeOneBookmark(a, b))
    else out.push((a ?? b) as BookmarkRecord)
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: PASS

- [ ] **Step 6: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 7: コミット**

```bash
rtk git add lib/sync/merge.ts lib/sync/merge.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): merge.ts — union-by-id bookmark merge (LWW + tombstones + tag union)

Pure, deterministic, 2-way. numericTime() guards raw updatedAt per design §15.
SyncSnapshot / SyncBoardConfig types for the bundle-4 engine.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `merge.ts` — `mergeTags`

**Files:**
- Modify: `lib/sync/merge.ts`
- Modify: `lib/sync/merge.test.ts`

**Interfaces:**
- Consumes: `type TagRecord` from `@/lib/storage/indexeddb`（Task 1 で既に import 済み）、Task 1 の module-private ヘルパー（`numericTime` / `deletedAtMs` / `pickDeterministic` / `byId`）
- Produces: `mergeTags(local: readonly TagRecord[], remote: readonly TagRecord[]): TagRecord[]`（id 昇順）

### 契約（設計 §6.2）

タグマスタ。id 単位・和集合。`bookmark.tags[]` のような集合和の概念は無い（タグ自体が突き合わせ対象）。

- 片方にしか無い id → そのまま
- 両方に有る id:
  - 時刻源 = `numericTime(t.updatedAt) || numericTime(t.createdAt)`（`updatedAt` 無しのタグは `createdAt` を下限に。`createdAt` は `TagRecord` で必須の `number`）
  - トゥームストーン処理は bookmarks と同じ 3 ケース（両墓標 → 新しい `deletedAt` / 片墓標 → `deletedAtMs >= 相手の時刻源` なら墓標が勝つ / どちらも生存 → 時刻源 LWW）
  - 同値は `pickDeterministic`

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/merge.test.ts` の末尾に追記（先頭の import に `mergeTags` を足す・`TagRecord` の型 import を足す）:

```ts
import type { TagRecord } from '@/lib/storage/indexeddb'
import { mergeTags } from './merge'

function tag(over: Partial<TagRecord> & Pick<TagRecord, 'id'>): TagRecord {
  return {
    id: over.id,
    name: over.name ?? `tag-${over.id}`,
    color: over.color ?? '#888888',
    order: over.order ?? 0,
    createdAt: over.createdAt ?? 1_000,
    ...over,
  }
}

describe('mergeTags', () => {
  it('union by id, sorted', () => {
    const out = mergeTags([tag({ id: 'b' }), tag({ id: 'a' })], [tag({ id: 'c' })])
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('LWW by updatedAt when both live', () => {
    const local = [tag({ id: 'a', name: 'old', updatedAt: 10 })]
    const remote = [tag({ id: 'a', name: 'new', updatedAt: 20 })]
    expect(mergeTags(local, remote)[0].name).toBe('new')
    expect(mergeTags(remote, local)[0].name).toBe('new')
  })

  it('falls back to createdAt when updatedAt is absent', () => {
    const local = [tag({ id: 'a', name: 'created-later', createdAt: 5_000 })]
    const remote = [tag({ id: 'a', name: 'created-earlier', createdAt: 1_000 })]
    expect(mergeTags(local, remote)[0].name).toBe('created-later')
  })

  it('a live updatedAt beats a createdAt-only tag', () => {
    const local = [tag({ id: 'a', name: 'stamped', updatedAt: 2_000, createdAt: 1_000 })]
    const remote = [tag({ id: 'a', name: 'unstamped', createdAt: 9_999 })]
    // 9_999 (createdAt fallback) > 2_000 -> unstamped actually wins
    expect(mergeTags(local, remote)[0].name).toBe('unstamped')
  })

  it('soft-delete tombstone propagates (deletedAt >= other side time)', () => {
    const tomb = [tag({ id: 'a', isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: Date.parse('2026-06-01T00:00:00.000Z') })]
    const edit = [tag({ id: 'a', name: 'renamed', updatedAt: Date.parse('2026-05-01T00:00:00.000Z') })]
    expect(mergeTags(edit, tomb)[0].isDeleted).toBe(true)
  })

  it('a rename newer than the delete wins the tag back', () => {
    const tomb = [tag({ id: 'a', isDeleted: true, deletedAt: '2026-05-01T00:00:00.000Z' })]
    const edit = [tag({ id: 'a', name: 'renamed', updatedAt: Date.parse('2026-07-01T00:00:00.000Z') })]
    const out = mergeTags(tomb, edit)[0]
    expect(out.isDeleted).not.toBe(true)
    expect(out.name).toBe('renamed')
  })

  it('is order-independent on equal time', () => {
    const l = [tag({ id: 'a', name: 'L', updatedAt: 5 })]
    const r = [tag({ id: 'a', name: 'R', updatedAt: 5 })]
    expect(mergeTags(l, r)[0].name).toBe(mergeTags(r, l)[0].name)
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/merge.test.ts -t mergeTags`
Expected: FAIL

- [ ] **Step 3: 実装を追記**

`lib/sync/merge.ts` の bookmarks ブロックの後に:

```ts
// ── tags（設計 §6.2）──────────────────────────────────────────────────────

/** タグの時刻源。updatedAt 優先、無ければ createdAt（必須の number）を下限に。 */
function tagTime(t: TagRecord): number {
  return numericTime(t.updatedAt) || numericTime(t.createdAt)
}

function mergeOneTag(a: TagRecord, b: TagRecord): TagRecord {
  const aDel = a.isDeleted === true
  const bDel = b.isDeleted === true

  if (aDel && bDel) {
    const am = deletedAtMs(a.deletedAt)
    const bm = deletedAtMs(b.deletedAt)
    if (am > bm) return { ...a, isDeleted: true }
    if (bm > am) return { ...b, isDeleted: true }
    return { ...pickDeterministic(a, b), isDeleted: true }
  }

  if (aDel !== bDel) {
    const tomb = aDel ? a : b
    const live = aDel ? b : a
    if (deletedAtMs(tomb.deletedAt) >= tagTime(live)) return { ...tomb, isDeleted: true }
    return live
  }

  const at = tagTime(a)
  const bt = tagTime(b)
  if (at > bt) return a
  if (bt > at) return b
  return pickDeterministic(a, b)
}

/** local ∪ remote（id 単位）。id 昇順で返す。設計 §6.2。 */
export function mergeTags(
  local: readonly TagRecord[],
  remote: readonly TagRecord[],
): TagRecord[] {
  const l = byId(local)
  const r = byId(remote)
  const out: TagRecord[] = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    if (a && b) out.push(mergeOneTag(a, b))
    else out.push((a ?? b) as TagRecord)
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: PASS

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add lib/sync/merge.ts lib/sync/merge.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): merge.ts — mergeTags (id union, updatedAt||createdAt LWW, tombstones)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `merge.ts` — `mergeCards` / `mergeBoardConfig` / `mergeVault`

**Files:**
- Modify: `lib/sync/merge.ts`
- Modify: `lib/sync/merge.test.ts`

**Interfaces:**
- Consumes: `type CardRecord` from `@/lib/storage/indexeddb`、`type PrivateVaultRecord` from `@/lib/private/vault-store`、`SyncBoardConfig`（Task 1）、Task 1 のヘルパー
- Produces:
  - `mergeCards(local: readonly CardRecord[], remote: readonly CardRecord[]): CardRecord[]`（id 昇順）
  - `mergeBoardConfig(local: SyncBoardConfig | null, remote: SyncBoardConfig | null): SyncBoardConfig | null`
  - `mergeVault(local: PrivateVaultRecord | null, remote: PrivateVaultRecord | null): PrivateVaultRecord | null`

### 契約

- **`mergeCards`（設計 §6.3）**: id 単位・和集合。両方に有れば `numericTime(updatedAt)` LWW（配置は装飾なので粗くてよい）。同値は `pickDeterministic`。トゥームストーン概念は無い（`CardRecord` に `isDeleted` は無い）。id 昇順。
- **`mergeBoardConfig`（設計 §6.4）**: まるごと 1 個 LWW。両方 null → null / 片方だけ → それ / 両方 → `numericTime(updatedAt)` が大きい方（同値は `config` で `pickDeterministic`）。
- **`mergeVault`（設計 §9・plan「設計上の判断」§4）**: 両方 null → null / 片方だけ → それ / 両方 → deep-equal（`stableStringify` 一致）なら `local`、違えば `pickDeterministic`。**暗号文は復号しない・見ない。**

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/merge.test.ts` の末尾に追記（import に `CardRecord` 型・`PrivateVaultRecord` 型・`SyncBoardConfig` 型・`mergeCards` / `mergeBoardConfig` / `mergeVault` を足す）:

```ts
import type { CardRecord } from '@/lib/storage/indexeddb'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'
import { mergeCards, mergeBoardConfig, mergeVault, type SyncBoardConfig } from './merge'
import { DEFAULT_BOARD_CONFIG } from '@/lib/storage/board-config'

function card(over: Partial<CardRecord> & Pick<CardRecord, 'id'>): CardRecord {
  return {
    id: over.id,
    bookmarkId: over.bookmarkId ?? `bm-${over.id}`,
    folderId: '',
    x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: 0,
    isManuallyPlaced: false, width: 200, height: 200,
    ...over,
  }
}

describe('mergeCards', () => {
  it('union by id, sorted', () => {
    expect(mergeCards([card({ id: 'b' })], [card({ id: 'a' })]).map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('LWW by updatedAt', () => {
    const local = [card({ id: 'a', x: 10, updatedAt: 1 })]
    const remote = [card({ id: 'a', x: 99, updatedAt: 2 })]
    expect(mergeCards(local, remote)[0].x).toBe(99)
    expect(mergeCards(remote, local)[0].x).toBe(99)
  })

  it('missing updatedAt treated as 0', () => {
    const local = [card({ id: 'a', x: 5, updatedAt: 1 })]
    const remote = [card({ id: 'a', x: 7 })]
    expect(mergeCards(local, remote)[0].x).toBe(5)
  })

  it('equal updatedAt -> order-independent', () => {
    const l = [card({ id: 'a', x: 1, updatedAt: 3 })]
    const r = [card({ id: 'a', x: 2, updatedAt: 3 })]
    expect(mergeCards(l, r)[0].x).toBe(mergeCards(r, l)[0].x)
  })
})

describe('mergeBoardConfig', () => {
  const cfg = (over: Partial<SyncBoardConfig['config']>, updatedAt?: number): SyncBoardConfig => ({
    config: { ...DEFAULT_BOARD_CONFIG, ...over },
    updatedAt,
  })

  it('both null -> null', () => {
    expect(mergeBoardConfig(null, null)).toBeNull()
  })

  it('one side present -> that side', () => {
    const only = cfg({ themeId: 'paper-atelier' }, 5)
    expect(mergeBoardConfig(only, null)).toBe(only)
    expect(mergeBoardConfig(null, only)).toBe(only)
  })

  it('LWW by updatedAt', () => {
    const older = cfg({ themeId: 'dotted-notebook' }, 100)
    const newer = cfg({ themeId: 'paper-atelier' }, 200)
    expect(mergeBoardConfig(older, newer)?.config.themeId).toBe('paper-atelier')
    expect(mergeBoardConfig(newer, older)?.config.themeId).toBe('paper-atelier')
  })

  it('absent updatedAt treated as 0', () => {
    const stamped = cfg({ themeId: 'paper-atelier' }, 1)
    const unstamped = cfg({ themeId: 'dotted-notebook' })
    expect(mergeBoardConfig(unstamped, stamped)?.config.themeId).toBe('paper-atelier')
  })

  it('equal updatedAt -> order-independent', () => {
    const a = cfg({ themeId: 'dotted-notebook' }, 7)
    const b = cfg({ themeId: 'paper-atelier' }, 7)
    expect(mergeBoardConfig(a, b)?.config.themeId).toBe(mergeBoardConfig(b, a)?.config.themeId)
  })
})

describe('mergeVault', () => {
  const rec = (pub: string): PrivateVaultRecord => ({
    key: 'private-vault',
    tagId: 'priv-tag',
    salt: 'salt',
    iterations: 600_000,
    publicKey: pub,
    wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
  })

  it('both null -> null', () => {
    expect(mergeVault(null, null)).toBeNull()
  })

  it('one side present -> that side', () => {
    const v = rec('pubA')
    expect(mergeVault(v, null)).toBe(v)
    expect(mergeVault(null, v)).toBe(v)
  })

  it('identical on both sides -> returns a value (order-independent)', () => {
    const a = rec('same')
    const b = rec('same')
    expect(mergeVault(a, b)).toEqual(a)
    expect(mergeVault(b, a)).toEqual(a)
  })

  it('divergent records -> deterministic pick regardless of arg order', () => {
    const a = rec('pubA')
    const b = rec('pubB')
    expect(mergeVault(a, b)).toEqual(mergeVault(b, a))
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: FAIL（`mergeCards` 等が未 export）

- [ ] **Step 3: 実装を追記**

`lib/sync/merge.ts` の末尾に:

```ts
// ── cards（設計 §6.3）─────────────────────────────────────────────────────

/** local ∪ remote（id 単位）。両方に有れば updatedAt LWW（配置は装飾）。id 昇順。 */
export function mergeCards(
  local: readonly CardRecord[],
  remote: readonly CardRecord[],
): CardRecord[] {
  const l = byId(local)
  const r = byId(remote)
  const out: CardRecord[] = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    if (a && b) {
      const at = numericTime(a.updatedAt)
      const bt = numericTime(b.updatedAt)
      out.push(at > bt ? a : bt > at ? b : pickDeterministic(a, b))
    } else {
      out.push((a ?? b) as CardRecord)
    }
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

// ── board-config（設計 §6.4）─────────────────────────────────────────────

/** まるごと 1 個 LWW。updatedAt が無ければ 0 扱い（束4 が saveBoardConfig で
 *  打つまでの間）。同値は config を安定比較して決定的に。 */
export function mergeBoardConfig(
  local: SyncBoardConfig | null,
  remote: SyncBoardConfig | null,
): SyncBoardConfig | null {
  if (!local) return remote
  if (!remote) return local
  const lt = numericTime(local.updatedAt)
  const rt = numericTime(remote.updatedAt)
  if (lt > rt) return local
  if (rt > lt) return remote
  return pickDeterministic(local, remote)
}

// ── vault（設計 §9）──────────────────────────────────────────────────────

/** 「作成一度きり・以後不変」前提。両方あれば内容は同一のはず。違えば決定的 pick。
 *  暗号文は復号しない・見ない。将来パスワード再設定（wrappedPrivateKey 変化）で
 *  LWW が要るときは PrivateVaultRecord に updatedAt を足してここで比較する。 */
export function mergeVault(
  local: PrivateVaultRecord | null,
  remote: PrivateVaultRecord | null,
): PrivateVaultRecord | null {
  if (!local) return remote
  if (!remote) return local
  if (stableStringify(local) === stableStringify(remote)) return local
  return pickDeterministic(local, remote)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: PASS

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add lib/sync/merge.ts lib/sync/merge.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): merge.ts — mergeCards / mergeBoardConfig / mergeVault

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `merge.ts` — `mergeAll` ＋ 決定性の総合テスト

**Files:**
- Modify: `lib/sync/merge.ts`
- Modify: `lib/sync/merge.test.ts`

**Interfaces:**
- Consumes: `mergeBookmarks` / `mergeTags` / `mergeCards` / `mergeBoardConfig` / `mergeVault`（Task 1-3）、`SyncSnapshot`（Task 1）
- Produces: `mergeAll(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot`

### 契約

`SyncSnapshot` の 5 フィールドをそれぞれの merge 関数に流すだけ。戻り値の `bookmarks` / `tags` / `cards` は id 昇順（各 merge 関数の保証）。**`mergeAll(L, R)` と `mergeAll(R, L)` は deep-equal**（束4 の収束保証の土台）。

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/merge.test.ts` の末尾に追記（import に `mergeAll` / `type SyncSnapshot` を足す）:

```ts
import { mergeAll, type SyncSnapshot } from './merge'

describe('mergeAll', () => {
  const emptySnap: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }

  it('routes each store through its merge fn', () => {
    const local: SyncSnapshot = {
      ...emptySnap,
      bookmarks: [bm({ id: 'a', updatedAt: 1 })],
      tags: [tag({ id: 't1' })],
    }
    const remote: SyncSnapshot = {
      ...emptySnap,
      bookmarks: [bm({ id: 'b', updatedAt: 1 })],
      cards: [card({ id: 'c1' })],
    }
    const out = mergeAll(local, remote)
    expect(out.bookmarks.map((x) => x.id)).toEqual(['a', 'b'])
    expect(out.tags.map((x) => x.id)).toEqual(['t1'])
    expect(out.cards.map((x) => x.id)).toEqual(['c1'])
  })

  it('is deterministic: mergeAll(L,R) deep-equals mergeAll(R,L)', () => {
    const L: SyncSnapshot = {
      bookmarks: [
        bm({ id: 'a', title: 'LA', tags: ['x'], updatedAt: 100 }),
        bm({ id: 'b', isDeleted: true, deletedAt: '2026-03-01T00:00:00.000Z' }),
        bm({ id: 'c', updatedAt: 5 }),
      ],
      tags: [tag({ id: 't1', name: 'L', updatedAt: 10 }), tag({ id: 't2', createdAt: 1 })],
      cards: [card({ id: 'k1', x: 1, updatedAt: 9 }), card({ id: 'k2' })],
      boardConfig: { config: { ...DEFAULT_BOARD_CONFIG, themeId: 'dotted-notebook' }, updatedAt: 7 },
      vault: null,
    }
    const R: SyncSnapshot = {
      bookmarks: [
        bm({ id: 'a', title: 'RA', tags: ['y'], updatedAt: 200 }),
        bm({ id: 'b', title: 'resurrect?', updatedAt: Date.parse('2026-01-01T00:00:00.000Z') }),
        bm({ id: 'd', updatedAt: 3 }),
      ],
      tags: [tag({ id: 't1', name: 'R', updatedAt: 20 }), tag({ id: 't3' })],
      cards: [card({ id: 'k1', x: 50, updatedAt: 4 }), card({ id: 'k3' })],
      boardConfig: { config: { ...DEFAULT_BOARD_CONFIG, themeId: 'paper-atelier' }, updatedAt: 7 },
      vault: null,
    }
    expect(mergeAll(L, R)).toEqual(mergeAll(R, L))
  })

  it('additions from both sides all survive (3 + 2 disjoint = 5)', () => {
    const L: SyncSnapshot = { ...emptySnap, bookmarks: [bm({ id: 'a' }), bm({ id: 'b' }), bm({ id: 'c' })] }
    const R: SyncSnapshot = { ...emptySnap, bookmarks: [bm({ id: 'd' }), bm({ id: 'e' })] }
    expect(mergeAll(L, R).bookmarks).toHaveLength(5)
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/merge.test.ts -t mergeAll`
Expected: FAIL

- [ ] **Step 3: 実装を追記**

`lib/sync/merge.ts` の末尾に:

```ts
// ── 全 store（設計 §5 / §6）──────────────────────────────────────────────

/** 2 つの SyncSnapshot を store ごとにマージする。mergeAll(L,R) と mergeAll(R,L)
 *  は deep-equal（束4 の収束保証の土台）。 */
export function mergeAll(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  return {
    bookmarks: mergeBookmarks(local.bookmarks, remote.bookmarks),
    tags: mergeTags(local.tags, remote.tags),
    cards: mergeCards(local.cards, remote.cards),
    boardConfig: mergeBoardConfig(local.boardConfig, remote.boardConfig),
    vault: mergeVault(local.vault, remote.vault),
  }
}
```

- [ ] **Step 4: テストが通ることを確認 + フルスイート**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: PASS

Run: `npx vitest run 2>&1 | tail -20`
Expected: 全 PASS（束2 の 2642 + merge の新規分）

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add lib/sync/merge.ts lib/sync/merge.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): merge.ts — mergeAll orchestrator + determinism suite

mergeAll(L,R) deep-equals mergeAll(R,L). Single entrypoint for the
bundle-4 engine.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `drive-adapter.ts` — 型・`buildMultipartRelated`・`driveFetch`・フォルダ探索/作成

**Files:**
- Create: `lib/sync/drive-adapter.ts`
- Test: `lib/sync/drive-adapter.test.ts`

**Interfaces:**
- Consumes: なし（`fetch` / `crypto.randomUUID` のみ）
- Produces:
  - `class DriveError extends Error { readonly status: number }`
  - `interface DriveFileMeta { readonly id: string; readonly name: string; readonly headRevisionId?: string }`
  - `buildMultipartRelated(metadata: Readonly<Record<string, unknown>>, content: string, contentMime: string, boundary: string): { body: string; contentType: string }`（純・export）
  - `findSyncFolder(accessToken: string): Promise<string | null>`
  - `createSyncFolder(accessToken: string): Promise<string>`
  - 内部: `driveFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response>`（`Authorization: Bearer` 付与・`!res.ok` で `DriveError` throw）

### 定数（設計 §5）

```ts
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const SYNC_FOLDER_NAME = 'AllMarks'
/** ユーザーが手で作った "AllMarks" フォルダと区別するためのマーカー。 */
const SYNC_MARKER_KEY = 'allmarksSync'
const SYNC_MARKER_VALUE = '1'
```

### 契約

- **`driveFetch`**: `fetch(url, { ...init, headers: { ...init?.headers, Authorization: 'Bearer ' + accessToken } })`。`res.ok` が false なら `throw new DriveError(res.status, ` + バッククォート + `drive ${res.status}: ${(await res.text()).slice(0, 300)}` + バッククォート + `)`。`fetch` 自体が投げたら `DriveError(0, ...)` に包み直す。成功時は `res` をそのまま返す。
- **`buildMultipartRelated`**: RFC 2387 の `multipart/related`。part1 = `Content-Type: application/json; charset=UTF-8` + `JSON.stringify(metadata)`、part2 = `Content-Type: ${contentMime}` + `content`。改行は `\r\n`。戻り `contentType = ` + バッククォート + `multipart/related; boundary=${boundary}` + バッククォート。
- **`findSyncFolder`**: `GET ${DRIVE_API}/files?q=${enc(q)}&fields=files(id,appProperties)&spaces=drive&pageSize=10` — `q = ` + バッククォート + `name = '${SYNC_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false` + バッククォート。応答 `files[]` を `appProperties?.[SYNC_MARKER_KEY] === SYNC_MARKER_VALUE` で絞り、残った中で `id` が辞書順最小のものを返す。1 件も無ければ `null`。
- **`createSyncFolder`**: `POST ${DRIVE_API}/files?fields=id`、body = `JSON.stringify({ name: SYNC_FOLDER_NAME, mimeType: FOLDER_MIME, appProperties: { [SYNC_MARKER_KEY]: SYNC_MARKER_VALUE } })`、`Content-Type: application/json`。応答の `id` を返す（無ければ `DriveError(500, ...)`）。

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/drive-adapter.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildMultipartRelated, findSyncFolder, createSyncFolder, DriveError,
} from './drive-adapter'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const TOKEN = 'ya29.test'

/** 直近の fetch 呼び出しの [url, init] を返す。 */
function lastCall(m: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return m.mock.calls[m.mock.calls.length - 1] as [string, RequestInit]
}

describe('buildMultipartRelated', () => {
  it('produces an RFC-2387 body with both parts and the boundary content-type', () => {
    const { body, contentType } = buildMultipartRelated({ name: 'x.json' }, '{"a":1}', 'application/json', 'BOUNDARY')
    expect(contentType).toBe('multipart/related; boundary=BOUNDARY')
    expect(body).toBe(
      '--BOUNDARY\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      '{"name":"x.json"}\r\n' +
      '--BOUNDARY\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      '{"a":1}\r\n' +
      '--BOUNDARY--',
    )
  })
})

describe('findSyncFolder', () => {
  it('queries by name + folder mime + not-trashed and returns the marked folder id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      files: [
        { id: 'unmarked', appProperties: {} },
        { id: 'marked-1', appProperties: { allmarksSync: '1' } },
      ],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const id = await findSyncFolder(TOKEN)
    expect(id).toBe('marked-1')

    const [url, init] = lastCall(fetchMock)
    expect(url).toContain('https://www.googleapis.com/drive/v3/files?')
    expect(decodeURIComponent(url)).toContain("name = 'AllMarks'")
    expect(decodeURIComponent(url)).toContain("mimeType = 'application/vnd.google-apps.folder'")
    expect(decodeURIComponent(url)).toContain('trashed = false')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ya29.test')
  })

  it('returns the lexicographically smallest id when several are marked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      files: [
        { id: 'zzz', appProperties: { allmarksSync: '1' } },
        { id: 'aaa', appProperties: { allmarksSync: '1' } },
      ],
    }), { status: 200 })))
    expect(await findSyncFolder(TOKEN)).toBe('aaa')
  })

  it('returns null when no folder carries the marker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      files: [{ id: 'x', appProperties: {} }],
    }), { status: 200 })))
    expect(await findSyncFolder(TOKEN)).toBeNull()
  })

  it('returns null when the folder list is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ files: [] }), { status: 200 })))
    expect(await findSyncFolder(TOKEN)).toBeNull()
  })

  it('throws DriveError with the HTTP status on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })))
    await expect(findSyncFolder(TOKEN)).rejects.toBeInstanceOf(DriveError)
    await expect(findSyncFolder(TOKEN)).rejects.toMatchObject({ status: 401 })
  })

  it('wraps a fetch throw as DriveError(0)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    await expect(findSyncFolder(TOKEN)).rejects.toMatchObject({ status: 0 })
  })
})

describe('createSyncFolder', () => {
  it('POSTs folder metadata with the sync marker and returns the new id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'new-folder' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const id = await createSyncFolder(TOKEN)
    expect(id).toBe('new-folder')

    const [url, init] = lastCall(fetchMock)
    expect(url).toBe('https://www.googleapis.com/drive/v3/files?fields=id')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'AllMarks',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { allmarksSync: '1' },
    })
  })

  it('throws DriveError(500) when the response has no id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(createSyncFolder(TOKEN)).rejects.toMatchObject({ status: 500 })
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/drive-adapter.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`lib/sync/drive-adapter.ts`:

```ts
// lib/sync/drive-adapter.ts
// Google Drive REST v3 の薄いラッパ。access token は毎回引数で注入する
// （auth.ts の SyncTokens.accessToken を渡す想定・secret は持たない）。
// pull/merge/push のオーケストレーション・token 更新・楽観ロックの判断・
// リトライは一切しない — それは束4 の engine.ts の責務。設計 §5 / §7.4。
//
// 401 (token 失効) / 403 (容量・権限) / 404 (不在) は DriveError に status を
// 載せて投げるだけ。束4 が status を見て「refresh して再試行」「容量エラー表示」
// 等を判断する。

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
/** 同期フォルダの表示名（可視フォルダ・設計 §5）。 */
export const SYNC_FOLDER_NAME = 'AllMarks'
/** ユーザーが手で作った同名フォルダと区別するための appProperties マーカー。 */
const SYNC_MARKER_KEY = 'allmarksSync'
const SYNC_MARKER_VALUE = '1'
/** アプリの JSON ファイルの MIME。 */
export const SYNC_FILE_MIME = 'application/json'

/** Drive API 呼び出しの失敗。status は HTTP ステータス（fetch throw は 0、
 *  応答が想定外の形なら 500）。束4 が status で分岐する。 */
export class DriveError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveError'
    this.status = status
  }
}

/** Drive のファイルメタ（この束が使う分だけ）。 */
export interface DriveFileMeta {
  readonly id: string
  readonly name: string
  /** バイナリファイルの現行リビジョン id。楽観ロック（設計 §7.4）に使う。 */
  readonly headRevisionId?: string
}

/**
 * RFC 2387 multipart/related。part1 = メタデータ JSON、part2 = ファイル本文。
 * boundary は呼び出し側が渡す（テストの決定性のため）。純関数。
 */
export function buildMultipartRelated(
  metadata: Readonly<Record<string, unknown>>,
  content: string,
  contentMime: string,
  boundary: string,
): { body: string; contentType: string } {
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentMime}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`
  return { body, contentType: `multipart/related; boundary=${boundary}` }
}

/** Authorization を足して fetch。!res.ok は DriveError、fetch throw は DriveError(0)。 */
async function driveFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${accessToken}` },
    })
  } catch (err) {
    throw new DriveError(0, `drive fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {
      // body 読めず — status だけで十分
    }
    throw new DriveError(res.status, `drive ${res.status}: ${detail}`)
  }
  return res
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    throw new DriveError(500, 'drive response was not JSON')
  }
}

interface DriveFileListItem {
  id?: unknown
  name?: unknown
  headRevisionId?: unknown
  appProperties?: unknown
}

/**
 * 可視フォルダ `AllMarks/` を名前 + appProperties マーカーで探す。
 * マーカー付きが複数なら id 辞書順で最小（決定的）。無ければ null。
 */
export async function findSyncFolder(accessToken: string): Promise<string | null> {
  const q = `name = '${SYNC_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`
  const url =
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent('files(id,appProperties)')}&spaces=drive&pageSize=10`
  const json = await readJson(await driveFetch(accessToken, url))
  const files = (json as { files?: unknown }).files
  if (!Array.isArray(files)) return null
  const marked = files.filter((f): f is DriveFileListItem & { id: string } => {
    if (typeof f !== 'object' || f === null) return false
    const item = f as DriveFileListItem
    const props = item.appProperties
    const hasMarker =
      typeof props === 'object' && props !== null &&
      (props as Record<string, unknown>)[SYNC_MARKER_KEY] === SYNC_MARKER_VALUE
    return hasMarker && typeof item.id === 'string'
  })
  if (marked.length === 0) return null
  return marked.map((f) => f.id).sort()[0]
}

/** マーカー付きで `AllMarks/` フォルダを新規作成し、その id を返す。 */
export async function createSyncFolder(accessToken: string): Promise<string> {
  const url = `${DRIVE_API}/files?fields=id`
  const json = await readJson(await driveFetch(accessToken, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: SYNC_FOLDER_NAME,
      mimeType: FOLDER_MIME,
      appProperties: { [SYNC_MARKER_KEY]: SYNC_MARKER_VALUE },
    }),
  }))
  const id = (json as { id?: unknown }).id
  if (typeof id !== 'string' || id.length === 0) {
    throw new DriveError(500, 'createSyncFolder: response had no id')
  }
  return id
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/drive-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add lib/sync/drive-adapter.ts lib/sync/drive-adapter.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): drive-adapter — DriveError, multipart builder, folder find/create

fetch-only, access token injected. driveFetch surfaces HTTP status via
DriveError for the bundle-4 engine to branch on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `drive-adapter.ts` — ファイル一覧/取得/リビジョン/作成/更新

**Files:**
- Modify: `lib/sync/drive-adapter.ts`
- Modify: `lib/sync/drive-adapter.test.ts`

**Interfaces:**
- Consumes: `driveFetch` / `readJson` / `buildMultipartRelated` / `DriveError` / `DriveFileMeta` / `DRIVE_API` / `DRIVE_UPLOAD_API` / `SYNC_FILE_MIME`（Task 5）
- Produces:
  - `listFolderFiles(accessToken: string, folderId: string): Promise<DriveFileMeta[]>`
  - `downloadFileText(accessToken: string, fileId: string): Promise<string>`
  - `getHeadRevisionId(accessToken: string, fileId: string): Promise<string>`
  - `createTextFile(accessToken: string, folderId: string, name: string, content: string): Promise<DriveFileMeta>`
  - `updateTextFile(accessToken: string, fileId: string, content: string): Promise<DriveFileMeta>`

### 契約（設計 §5 / §7.4）

- **`listFolderFiles`**: `GET ${DRIVE_API}/files?q=${enc(q)}&fields=${enc('files(id,name,headRevisionId)')}&spaces=drive&pageSize=100` — `q = ` + バッククォート + `'${folderId}' in parents and trashed = false` + バッククォート。応答 `files[]` を `DriveFileMeta[]` に写す（`id` / `name` が文字列の行のみ・`headRevisionId` は文字列なら載せる）。フォルダに 6 ファイル程度なのでページングは扱わない。
- **`downloadFileText`**: `GET ${DRIVE_API}/files/${enc(fileId)}?alt=media` → `res.text()`。
- **`getHeadRevisionId`**: `GET ${DRIVE_API}/files/${enc(fileId)}?fields=headRevisionId` → JSON の `headRevisionId`（文字列）。無ければ `DriveError(500, ...)`。
- **`createTextFile`**: `POST ${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${enc('id,name,headRevisionId')}`。`buildMultipartRelated({ name, parents: [folderId], mimeType: SYNC_FILE_MIME }, content, SYNC_FILE_MIME, boundary)`。`boundary = ` + バッククォート + `allmarks-${crypto.randomUUID()}` + バッククォート。`Content-Type` はビルダーが返す値。応答 → `DriveFileMeta`。
- **`updateTextFile`**: `PATCH ${DRIVE_UPLOAD_API}/files/${enc(fileId)}?uploadType=multipart&fields=${enc('id,name,headRevisionId')}`。メタデータ part は `{}`（本文だけ差し替え・名前と親は保持）。それ以外は `createTextFile` と同じ。

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/drive-adapter.test.ts` の末尾に追記（import に 5 関数を足す）:

```ts
import {
  listFolderFiles, downloadFileText, getHeadRevisionId, createTextFile, updateTextFile,
} from './drive-adapter'

describe('listFolderFiles', () => {
  it('queries "<folderId> in parents" and maps to DriveFileMeta[]', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      files: [
        { id: 'f1', name: 'bookmarks.json', headRevisionId: 'r1' },
        { id: 'f2', name: 'tags.json' },
        { name: 'no-id.json' },
      ],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await listFolderFiles(TOKEN, 'FOLDER')
    expect(out).toEqual([
      { id: 'f1', name: 'bookmarks.json', headRevisionId: 'r1' },
      { id: 'f2', name: 'tags.json' },
    ])
    expect(decodeURIComponent(lastCall(fetchMock)[0])).toContain("'FOLDER' in parents and trashed = false")
  })

  it('throws DriveError on a non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 403 })))
    await expect(listFolderFiles(TOKEN, 'F')).rejects.toMatchObject({ status: 403 })
  })
})

describe('downloadFileText', () => {
  it('GETs alt=media and returns the raw text', async () => {
    const fetchMock = vi.fn(async () => new Response('{"bookmarks":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await downloadFileText(TOKEN, 'f1')).toBe('{"bookmarks":[]}')
    expect(lastCall(fetchMock)[0]).toBe('https://www.googleapis.com/drive/v3/files/f1?alt=media')
  })
})

describe('getHeadRevisionId', () => {
  it('returns the headRevisionId field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ headRevisionId: 'rev-9' }), { status: 200 })))
    expect(await getHeadRevisionId(TOKEN, 'f1')).toBe('rev-9')
  })

  it('throws DriveError(500) when headRevisionId is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(getHeadRevisionId(TOKEN, 'f1')).rejects.toMatchObject({ status: 500 })
  })
})

describe('createTextFile', () => {
  it('POSTs a multipart body to the upload endpoint and maps the result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'new', name: 'bookmarks.json', headRevisionId: 'r0',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await createTextFile(TOKEN, 'FOLDER', 'bookmarks.json', '{"a":1}')
    expect(meta).toEqual({ id: 'new', name: 'bookmarks.json', headRevisionId: 'r0' })

    const [url, init] = lastCall(fetchMock)
    expect(url).toContain('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^multipart\/related; boundary=/)
    const bodyStr = init.body as string
    expect(bodyStr).toContain('"name":"bookmarks.json"')
    expect(bodyStr).toContain('"parents":["FOLDER"]')
    expect(bodyStr).toContain('{"a":1}')
  })
})

describe('updateTextFile', () => {
  it('PATCHes the upload endpoint with an empty metadata part', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'f1', name: 'bookmarks.json', headRevisionId: 'r2',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await updateTextFile(TOKEN, 'f1', '{"b":2}')
    expect(meta.headRevisionId).toBe('r2')

    const [url, init] = lastCall(fetchMock)
    expect(url).toContain('https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=multipart')
    expect(init.method).toBe('PATCH')
    const bodyStr = init.body as string
    // metadata part is an empty object
    expect(bodyStr).toContain('Content-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n')
    expect(bodyStr).toContain('{"b":2}')
  })

  it('throws DriveError(500) when the response has no id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(updateTextFile(TOKEN, 'f1', '{}')).rejects.toMatchObject({ status: 500 })
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/drive-adapter.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装を追記**

`lib/sync/drive-adapter.ts` の末尾に:

```ts
/** DriveFileListItem を DriveFileMeta に写す（id/name が文字列の行のみ）。 */
function toFileMeta(raw: unknown): DriveFileMeta | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as DriveFileListItem
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return null
  return typeof item.headRevisionId === 'string'
    ? { id: item.id, name: item.name, headRevisionId: item.headRevisionId }
    : { id: item.id, name: item.name }
}

/** フォルダ直下の（ゴミ箱でない）ファイルを列挙。ページングは扱わない
 *  （AllMarks/ は 6 ファイル程度・設計 §5）。 */
export async function listFolderFiles(accessToken: string, folderId: string): Promise<DriveFileMeta[]> {
  const q = `'${folderId}' in parents and trashed = false`
  const url =
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent('files(id,name,headRevisionId)')}&spaces=drive&pageSize=100`
  const json = await readJson(await driveFetch(accessToken, url))
  const files = (json as { files?: unknown }).files
  if (!Array.isArray(files)) return []
  return files.map(toFileMeta).filter((m): m is DriveFileMeta => m !== null)
}

/** ファイル本文をテキストで取得（alt=media）。JSON パースは呼び出し側で。 */
export async function downloadFileText(accessToken: string, fileId: string): Promise<string> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`
  return (await driveFetch(accessToken, url)).text()
}

/** 現行リビジョン id を取得（楽観ロック・設計 §7.4）。 */
export async function getHeadRevisionId(accessToken: string, fileId: string): Promise<string> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=headRevisionId`
  const json = await readJson(await driveFetch(accessToken, url))
  const rev = (json as { headRevisionId?: unknown }).headRevisionId
  if (typeof rev !== 'string' || rev.length === 0) {
    throw new DriveError(500, 'getHeadRevisionId: response had no headRevisionId')
  }
  return rev
}

function metaFromUploadResponse(json: unknown, ctx: string): DriveFileMeta {
  const meta = toFileMeta(json)
  if (!meta) throw new DriveError(500, `${ctx}: response had no id/name`)
  return meta
}

/** フォルダ内に新規テキストファイルを作る（multipart・メタ + 本文）。 */
export async function createTextFile(
  accessToken: string,
  folderId: string,
  name: string,
  content: string,
): Promise<DriveFileMeta> {
  const boundary = `allmarks-${crypto.randomUUID()}`
  const { body, contentType } = buildMultipartRelated(
    { name, parents: [folderId], mimeType: SYNC_FILE_MIME },
    content, SYNC_FILE_MIME, boundary,
  )
  const url = `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent('id,name,headRevisionId')}`
  const json = await readJson(await driveFetch(accessToken, url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  }))
  return metaFromUploadResponse(json, 'createTextFile')
}

/** 既存ファイルの本文だけ差し替える（multipart PATCH・メタは空 {}）。 */
export async function updateTextFile(
  accessToken: string,
  fileId: string,
  content: string,
): Promise<DriveFileMeta> {
  const boundary = `allmarks-${crypto.randomUUID()}`
  const { body, contentType } = buildMultipartRelated({}, content, SYNC_FILE_MIME, boundary)
  const url =
    `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}` +
    `?uploadType=multipart&fields=${encodeURIComponent('id,name,headRevisionId')}`
  const json = await readJson(await driveFetch(accessToken, url, {
    method: 'PATCH',
    headers: { 'Content-Type': contentType },
    body,
  }))
  return metaFromUploadResponse(json, 'updateTextFile')
}
```

**注**: Task 5 で `readJson` は module-private。この Task で使うのでそのまま参照できる（同一ファイル）。もし Task 5 実装で `readJson` を書いていなかったら、この Task で Task 5 の契約どおり追加すること。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/drive-adapter.test.ts`
Expected: PASS

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add lib/sync/drive-adapter.ts lib/sync/drive-adapter.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): drive-adapter — list / download / headRevisionId / create / update

Multipart upload+PATCH via buildMultipartRelated. Covers the Drive I/O the
bundle-4 engine needs for pull/merge/push + optimistic locking.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 束の仕上げ — 呼び出し元ゼロ確認・フルゲート

**Files:** なし（検証のみ）

- [ ] **Step 1: 呼び出し元ゼロを確認**

Run: `git grep -n "sync/merge\|sync/drive-adapter" -- '*.ts' '*.tsx'`
Expected: ヒットは `lib/sync/merge.test.ts` / `lib/sync/drive-adapter.test.ts` のみ。`components/` `app/` `lib/board/` `lib/storage/` `functions/` `lib/sync/engine*` 等からのヒットが **0 件**（この束では engine/UI に配線しない = 既存挙動は完全不変）。

- [ ] **Step 2: `merge.ts` の純度を確認**

Run: `git grep -nE "Date\.now|crypto\.|fetch\(|indexedDB|window\.|localStorage" -- lib/sync/merge.ts`
Expected: 出力なし（完全な純関数）。

- [ ] **Step 3: deploy 前ゲート（フル）**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

Run: `npx vitest run 2>&1 | tail -15`
Expected: 全 PASS（束2 到達点 2642 + merge/drive-adapter の新規テスト。失敗 0）

Run: `rtk pnpm build`
Expected: 成功（`out/` 生成・新規ファイルは誰も import しないのでバンドルサイズ実質不変）

- [ ] **Step 4: 束3 完了を記録（コミットはしない・親セッションがまとめる）**

このタスクでは docs を触らない。親セッション（司令塔）が:
- opus 全ブランチレビュー（fresh context・`superpowers:requesting-code-review`）
- レビュー指摘のうち「正しさに関わるもの」だけ修正
- `docs/private/2026-09-02-device-sync-design.md` §15 に束3 の申し送りを追記
- `docs/TODO.md` / `docs/CURRENT_GOAL.md` 更新
- master マージ（ユーザー確認後）
をまとめて行う。

---

## Self-Review（spec 突き合わせ）

**1. Spec coverage:**

| spec 項目 | 対応タスク |
|---|---|
| §5 Drive ファイル構成（`AllMarks/` 可視フォルダ・名前 + appProperties で探索） | Task 5（`findSyncFolder` / `createSyncFolder`） |
| §5 各 `.json` の GET | Task 6（`downloadFileText`） |
| §5 `files.get(fileId, fields=headRevisionId)` 楽観ロック用取得 | Task 6（`getHeadRevisionId`） |
| §5 multipart PATCH | Task 6（`updateTextFile` / `buildMultipartRelated`） |
| §5 `SyncSnapshot`（6 ファイルの in-memory 形） | Task 1（`SyncSnapshot` / `SyncBoardConfig`） |
| §6.1 bookmarks 足し算マージ（片側のみ / 両側 / tags 集合和 / トゥームストーン / 復元） | Task 1（`mergeBookmarks`） |
| §6.2 tags 足し算マージ（LWW・ソフト削除トゥームストーン） | Task 2（`mergeTags`） |
| §6.3 cards 足し算マージ（LWW・装飾なので粗く） | Task 3（`mergeCards`） |
| §6.4 board-config まるごと LWW | Task 3（`mergeBoardConfig`） |
| §6 決定性（同じ入力→同じ出力・順序非依存） | Task 1-4 の各順序独立テスト ＋ Task 4（`mergeAll` deep-equal） |
| §9 Private ブクマを中身を見ず id 単位でマージ | Task 1（Private テスト群・`encryptedPayload` 不透明扱い） |
| §9 `vault.json` の授受（作成一度きり前提） | Task 3（`mergeVault`） |
| §11 `drive-adapter` を fetch モックで単体テスト | Task 5 / 6 の全テスト |
| §15 `merge.ts` は `updatedAt` を `typeof x === 'number' ? x : 0` で読む | Task 1（`numericTime`）＋ Global Constraints で「backfill 案は採らない」と明示 |
| §12 不変条件（未接続は不変・¥0・default byte-identical） | Task 7 Step 1-3（呼び出し元ゼロ・純度・ビルド） |

**gap（意図的に束3 のスコープ外）:**
- pull/merge/push オーケストレーション・楽観ロックの再マージ判断・安全弁（大量削除ブロック）・base スナップショット・§6.5 衝突退避 → **束4**（`engine.ts`）
- `saveBoardConfig` への `updatedAt` 打刻の配線 → **束4**（`mergeBoardConfig` は `updatedAt` 無しでも動く形にしてある）
- `emptyTrash` / `deleteBookmark` の物理削除と足し算マージの相互作用 → **束4 着手前に確認**（plan「設計上の判断」§7・`merge.ts` 自体は正しい）
- 暗号 round-trip（端末A `createVault` → `vault.json` → 端末B `unlockVault`）→ **束4**（`vault.json` の実際の授受と一緒に）
- e2e（擬似2端末）→ **束7**

**2. Placeholder scan:** 各コードステップに実コードを記載済み。「適切なエラー処理」「TBD」等なし。`buildMultipartRelated` の期待文字列はテストにリテラルで記載。

**3. Type consistency:**
- `numericTime` / `deletedAtMs` / `stableStringify` / `pickDeterministic` / `byId` / `unionOrdered` は Task 1 で定義、Task 2/3 が同一ファイル内で参照 — module-private・名前一致。
- `SyncSnapshot`（`bookmarks` / `tags` / `cards` / `boardConfig` / `vault`）は Task 1 定義、Task 4 `mergeAll` が全フィールドを対応する merge 関数へ — フィールド名一致。
- `SyncBoardConfig`（`config` / `updatedAt?`）は Task 1 定義、Task 3 `mergeBoardConfig` と Task 4 で使用 — 一致。
- `DriveFileMeta`（`id` / `name` / `headRevisionId?`）は Task 5 定義、Task 6 の `listFolderFiles` / `createTextFile` / `updateTextFile` が返す — 一致。
- `DriveError`（`status: number`）は Task 5 定義、Task 6 の全関数と両タスクのテストが `toMatchObject({ status })` で検証 — 一致。
- `buildMultipartRelated(metadata, content, contentMime, boundary)` の引数順は Task 5 定義、Task 6 の `createTextFile` / `updateTextFile` の呼び出しと一致。
- `driveFetch(accessToken, url, init?)` / `readJson(res)` は Task 5 で定義、Task 6 が同一ファイル内で参照 — Task 6 Step 3 の「注」で `readJson` の存在を担保。

---

## 実行方式

**Plan complete。`docs/superpowers/plans/2026-09-04-device-sync-bundle-3-merge-drive.md` に保存。**

推奨: **Subagent-Driven**（`superpowers:subagent-driven-development`）。

- Task 1 → 2 → 3 → 4 は直列（全て `lib/sync/merge.ts` を育てる・同一ファイル直列コミット）。
- Task 5 → 6 は直列（全て `lib/sync/drive-adapter.ts`）。
- **merge 系（1-4）と drive-adapter 系（5-6）はファイルが重ならないので並行可**。ただし同一ブランチへの直列コミットになるので、subagent-driven なら 1 タスクずつ順に流すのが安全（並行させるなら merge を全部終えてから drive-adapter、または逆）。
- 各タスク後に 2 段レビュー（実装 subagent とは別の fresh subagent がレビュー → 司令塔が採否）。
- 全タスク完了後（Task 7）: フルスイート ＋ `rtk pnpm build` ＋ opus 全ブランチレビュー（`superpowers:requesting-code-review`）。「正しさに関わる指摘」だけ採用。
- 触ってはいけないファイル: File Structure の一覧参照。特に `lib/storage/*` `lib/private/*` `functions/*` `components/*` `app/*` と 束1/束2 の `lib/sync/*`。
