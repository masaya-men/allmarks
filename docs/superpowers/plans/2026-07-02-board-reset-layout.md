# Board Reset Layout (N-19) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SETTINGS ドロワーに「全カードのサイズを default に戻す」「並び順を新しい順に戻す」の2操作を追加する。

**Architecture:** 中核ロジックは既存（サイズ＝`resetAllCustomWidths`、並び＝`repairOrderIndexIfNeeded` の並び替え中核）。並び側だけ「何度でも実行可能」な新関数 `resortByNewestFirst` を新設し、両操作を SETTINGS ドロワー（`ExtensionEntry`）の新グループに配線する。各操作はその場2タップ確認＋実行後トースト。default 盤面は byte-identical。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / IndexedDB via `idb` / Vanilla CSS Modules / vitest + @testing-library/react / next-intl 風の自前 i18n（`messages/*.json` 15言語）。

## Global Constraints

- `strict: true`。`any` 禁止（`unknown` + 型ガード）。Return type 常に明示。
- **default テーマ盤面は byte-identical**（新 UI は SETTINGS ドロワー内のみ・盤面 DOM / default CSS に触れない）。
- **既存を変えない**: 個別 ↺（`CardCornerActions`）／TUNE ↺（`handleResetWidthGap`）／`repairOrderIndexIfNeeded` とその起動時マイグレーション（フラグガード）は一切変更しない。
- UI 文言は世界共通で分かる英語（ボタン英字は verbatim、注意文/トーストは各言語訳）。i18n キーは **15言語すべて** に追加。
- 金額表示は無関係（本機能に金額なし）。
- 検証コマンド: `rtk tsc && rtk vitest run`（web 変更のため）、必要に応じ `rtk pnpm build`。
- コミットは feature ブランチ `feat/board-reset-layout`（作成済み）に積む。
- `t(key)` は補間非対応 → プレースホルダは呼び出し側で `.replace('{n}', String(x))`（[BackupButton.tsx:117](../../../components/board/BackupButton.tsx#L117) と同流儀）。

---

## File Structure

- `lib/storage/indexeddb.ts` — **Modify**: 新 pure helper `computeNewestFirstOrder()` ＋ 新関数 `resortByNewestFirst()` を追加（`repairOrderIndexIfNeeded` は無変更）。
- `tests/lib/idb-resort-newest-first.test.ts` — **Create**: 上記の単体テスト。
- `lib/storage/use-board-data.ts` — **Modify**: hook に `resortNewestFirst()` を追加（型 + 実装 + return）。
- `messages/{en,ja,ko,zh,es,de,fr,it,nl,pt,ru,ar,th,tr,vi}.json` — **Modify**: `board.settings` に新キー7個。
- `tests/i18n/reset-layout-keys.test.ts` — **Create**: 15言語キー存在パリティテスト。
- `components/board/ExtensionEntry.tsx` — **Modify**: props 3個追加 + LAYOUT グループ + 2タップ確認。
- `components/board/ExtensionEntry.module.css` — **Modify**: `.panelCta:disabled` / `.layoutCount` / `.panelCta[data-confirming]` の追記。
- `components/board/ExtensionEntry.test.tsx` — **Modify**: LAYOUT グループのテスト追加。
- `components/board/BoardRoot.tsx` — **Modify**: hook 分割代入に2関数追加 / `customWidthCount` 算出 / 2ハンドラ + トースト / props 受け渡し。

---

## Task 1: `resortByNewestFirst` データ層（indexeddb.ts）

**Files:**
- Modify: `lib/storage/indexeddb.ts`（`repairOrderIndexIfNeeded` の直後、[indexeddb.ts:845](../../../lib/storage/indexeddb.ts#L845) 付近に追加）
- Test: `tests/lib/idb-resort-newest-first.test.ts`（Create）

**Interfaces:**
- Produces:
  - `computeNewestFirstOrder(records: readonly { readonly id: string; readonly savedAt: string }[]): { id: string; orderIndex: number }[]` — pure。savedAt DESC（同値は id ASC）でソートし、最新に最大 orderIndex（= n-1）を割り当てた `{id, orderIndex}` 配列を返す。
  - `resortByNewestFirst(db: IDBPDatabase<AllMarksDB>): Promise<{ updated: number }>` — 全 bookmarks を上記順で orderIndex 振り直し（差分レコードのみ put）。migration flag は触らない。

**Note（スコープ判断）:** 既存 `repairOrderIndexIfNeeded`（[indexeddb.ts:779](../../../lib/storage/indexeddb.ts#L779)）は **一切変更しない**。比較ロジック数行の重複は許容し、フェイルセーフなマイグレーション経路への変更リスクを避ける（ユーザー要件「他は何も変えません」）。

- [ ] **Step 1: 失敗するテストを書く** — `tests/lib/idb-resort-newest-first.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { type IDBPDatabase } from 'idb'
import {
  initDB,
  computeNewestFirstOrder,
  resortByNewestFirst,
} from '@/lib/storage/indexeddb'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})

afterEach(() => {
  if (db) { db.close(); db = null }
})

/** Minimal valid bookmark row for these tests. fake-indexeddb does not
 *  validate schema, so only the fields under test need to be realistic. */
function mkBookmark(id: string, savedAt: string, orderIndex: number): Record<string, unknown> {
  return {
    id, url: `https://example.com/${id}`, title: id, description: '',
    thumbnail: '', favicon: '', siteName: '', type: 'website',
    savedAt, ogpStatus: 'fetched', tags: [], displayMode: null,
    sizePreset: 'S', orderIndex,
  }
}

describe('computeNewestFirstOrder (pure)', () => {
  it('assigns highest orderIndex to the newest savedAt', () => {
    const out = computeNewestFirstOrder([
      { id: 'a', savedAt: '2026-01-01T00:00:00Z' },
      { id: 'b', savedAt: '2026-03-01T00:00:00Z' },
      { id: 'c', savedAt: '2026-02-01T00:00:00Z' },
    ])
    // b newest → orderIndex 2, c → 1, a → 0
    expect(out).toEqual([
      { id: 'b', orderIndex: 2 },
      { id: 'c', orderIndex: 1 },
      { id: 'a', orderIndex: 0 },
    ])
  })

  it('breaks savedAt ties by id ASC', () => {
    const out = computeNewestFirstOrder([
      { id: 'y', savedAt: '2026-01-01T00:00:00Z' },
      { id: 'x', savedAt: '2026-01-01T00:00:00Z' },
    ])
    // equal savedAt → id ASC (x before y) → x gets higher index
    expect(out).toEqual([
      { id: 'x', orderIndex: 1 },
      { id: 'y', orderIndex: 0 },
    ])
  })
})

describe('resortByNewestFirst (IDB)', () => {
  it('rewrites scrambled orderIndex to newest-first and reports updated count', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    // Scrambled orderIndex vs savedAt: newest (b) currently has the LOWEST index.
    await d.put('bookmarks', mkBookmark('a', '2026-01-01T00:00:00Z', 5) as never)
    await d.put('bookmarks', mkBookmark('b', '2026-03-01T00:00:00Z', 0) as never)
    await d.put('bookmarks', mkBookmark('c', '2026-02-01T00:00:00Z', 9) as never)

    const { updated } = await resortByNewestFirst(d)
    expect(updated).toBe(3)

    const a = await d.get('bookmarks', 'a') as { orderIndex: number }
    const b = await d.get('bookmarks', 'b') as { orderIndex: number }
    const c = await d.get('bookmarks', 'c') as { orderIndex: number }
    expect(b.orderIndex).toBe(2) // newest → top under DESC
    expect(c.orderIndex).toBe(1)
    expect(a.orderIndex).toBe(0)
  })

  it('is a no-op (updated=0) when already newest-first', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', mkBookmark('a', '2026-01-01T00:00:00Z', 0) as never)
    await d.put('bookmarks', mkBookmark('b', '2026-03-01T00:00:00Z', 1) as never)
    const { updated } = await resortByNewestFirst(d)
    expect(updated).toBe(0)
  })

  it('handles an empty board without throwing', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    const { updated } = await resortByNewestFirst(d)
    expect(updated).toBe(0)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run tests/lib/idb-resort-newest-first.test.ts`
Expected: FAIL（`computeNewestFirstOrder` / `resortByNewestFirst` が未定義でインポートエラー）

- [ ] **Step 3: 実装を追加** — `lib/storage/indexeddb.ts` の `repairOrderIndexIfNeeded` 関数の閉じ括弧直後（[indexeddb.ts:845](../../../lib/storage/indexeddb.ts#L845)）に挿入

```ts
/**
 * Pure: given bookmark records, compute the newest-first orderIndex each
 * should have. savedAt DESC (id ASC tiebreak for determinism); the newest
 * bookmark gets the HIGHEST orderIndex (= n-1) so it appears first under the
 * board's DESC sort on orderIndex. Shared by the on-demand resort below.
 */
export function computeNewestFirstOrder(
  records: readonly { readonly id: string; readonly savedAt: string }[],
): { id: string; orderIndex: number }[] {
  const sorted = [...records].sort((a, b) => {
    const cmp = b.savedAt.localeCompare(a.savedAt)
    if (cmp !== 0) return cmp
    return a.id.localeCompare(b.id)
  })
  return sorted.map((r, i) => ({ id: r.id, orderIndex: sorted.length - 1 - i }))
}

/**
 * On-demand "sort newest first": re-number every bookmark's orderIndex by
 * savedAt DESC. Unlike {@link repairOrderIndexIfNeeded} this is NOT gated by a
 * one-shot migration flag — it is a user-triggered SETTINGS action that can run
 * any time (N-19). Only rows whose orderIndex actually changes are written.
 * Discards any manual drag-reorder (that is the point). Does not touch the
 * migration flags in `settings`.
 * @returns how many rows were rewritten (for the confirmation toast / tests).
 */
export async function resortByNewestFirst(
  db: IDBPDatabase<AllMarksDB>,
): Promise<{ updated: number }> {
  const all = await db.getAll('bookmarks')
  if (all.length === 0) return { updated: 0 }
  const desired = computeNewestFirstOrder(all)
  const byId = new Map(all.map((r) => [r.id, r]))
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  let updated = 0
  for (const { id, orderIndex } of desired) {
    const rec = byId.get(id)
    if (!rec) continue
    if ((rec.orderIndex ?? -1) !== orderIndex) {
      await store.put({ ...rec, orderIndex })
      updated++
    }
  }
  await tx.done
  return { updated }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run tests/lib/idb-resort-newest-first.test.ts`
Expected: PASS（5テスト）

- [ ] **Step 5: 既存のマイグレーションテストが無傷なことを確認**（`repairOrderIndexIfNeeded` を触っていないことの担保）

Run: `rtk vitest run tests/lib/idb-v11-custom-card-width.test.ts tests/lib/idb-v14-to-v16-migration.test.ts`
Expected: PASS（全緑）

- [ ] **Step 6: コミット**

```bash
rtk git add lib/storage/indexeddb.ts tests/lib/idb-resort-newest-first.test.ts
rtk git commit -m "feat(board): add resortByNewestFirst for on-demand order reset (N-19)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: i18n キー（15言語）+ パリティテスト

**Files:**
- Modify: `messages/{en,ja,ko,zh,es,de,fr,it,nl,pt,ru,ar,th,tr,vi}.json`（各ファイルの `board.settings` オブジェクト内）
- Test: `tests/i18n/reset-layout-keys.test.ts`（Create）

**Interfaces:**
- Produces: `board.settings.{layoutGroup, resetCardSizes, sortNewestFirst, tapAgainToConfirm, sortNewestNote, resetSizesDone, sortNewestDone}` を全ロケールに定義。`resetSizesDone` は `{n}` プレースホルダ入り。

- [ ] **Step 1: 失敗するテストを書く** — `tests/i18n/reset-layout-keys.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

const KEYS = [
  'layoutGroup',
  'resetCardSizes',
  'sortNewestFirst',
  'tapAgainToConfirm',
  'sortNewestNote',
  'resetSizesDone',
  'sortNewestDone',
] as const

describe('board reset-layout i18n keys', () => {
  it('every locale defines board.settings.<key> non-empty', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const msgs = (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>
      const board = msgs.board as Record<string, unknown>
      const settings = board?.settings as Record<string, string>
      for (const k of KEYS) {
        expect(typeof settings?.[k], `${locale}.board.settings.${k}`).toBe('string')
        expect((settings?.[k] ?? '').length, `${locale}.board.settings.${k}`).toBeGreaterThan(0)
      }
    }
  })

  it('resetSizesDone keeps the {n} placeholder in every locale', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const msgs = (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>
      const settings = (msgs.board as Record<string, unknown>).settings as Record<string, string>
      expect(settings.resetSizesDone, `${locale}.resetSizesDone`).toContain('{n}')
    }
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run tests/i18n/reset-layout-keys.test.ts`
Expected: FAIL（キー未定義）

- [ ] **Step 3: en.json にキーを追加** — `messages/en.json` の `board.settings` オブジェクト（`chooseTheme` の後にカンマ追加して続ける）

```json
      "chooseTheme": "CHOOSE A THEME",
      "layoutGroup": "LAYOUT",
      "resetCardSizes": "RESET CARD SIZES",
      "sortNewestFirst": "SORT: NEWEST FIRST",
      "tapAgainToConfirm": "TAP AGAIN TO CONFIRM",
      "sortNewestNote": "This clears any manual drag order.",
      "resetSizesDone": "Reset {n} cards to default size",
      "sortNewestDone": "Sorted newest first"
```

- [ ] **Step 4: 残り14言語に翻訳を追加**

各 `messages/<locale>.json` の `board.settings` に同じ7キーを追加する。ボタン英字（`layoutGroup` / `resetCardSizes` / `sortNewestFirst` / `tapAgainToConfirm`）は **英語 verbatim**（既存の `quickTagOnSave` 等と同じ方針＝UI ラベルは全言語共通英語）。訳すのは `sortNewestNote`（注意文）/ `resetSizesDone`（`{n}` は保持）/ `sortNewestDone`（トースト）の3つ。以下を各ファイルにコピー:

**ja.json:**
```json
      "layoutGroup": "LAYOUT",
      "resetCardSizes": "RESET CARD SIZES",
      "sortNewestFirst": "SORT: NEWEST FIRST",
      "tapAgainToConfirm": "TAP AGAIN TO CONFIRM",
      "sortNewestNote": "手動で並べ替えた順番は失われます。",
      "resetSizesDone": "{n}枚のカードを既定サイズに戻しました",
      "sortNewestDone": "新しい順に並べ替えました"
```
**ko.json:** `sortNewestNote`「수동으로 정렬한 순서는 사라집니다.」/ `resetSizesDone`「{n}개의 카드를 기본 크기로 되돌렸습니다」/ `sortNewestDone`「최신순으로 정렬했습니다」
**zh.json:** `sortNewestNote`「这会清除手动拖动的排序。」/ `resetSizesDone`「已将 {n} 张卡片重置为默认大小」/ `sortNewestDone`「已按最新排序」
**es.json:** `sortNewestNote`「Esto borra cualquier orden manual.」/ `resetSizesDone`「{n} tarjetas restablecidas al tamaño predeterminado」/ `sortNewestDone`「Ordenado por más recientes」
**de.json:** `sortNewestNote`「Dies verwirft die manuelle Reihenfolge.」/ `resetSizesDone`「{n} Karten auf Standardgröße zurückgesetzt」/ `sortNewestDone`「Nach Neueste sortiert」
**fr.json:** `sortNewestNote`「Cela efface tout ordre manuel.」/ `resetSizesDone`「{n} cartes réinitialisées à la taille par défaut」/ `sortNewestDone`「Trié par plus récent」
**it.json:** `sortNewestNote`「Questo cancella l'ordine manuale.」/ `resetSizesDone`「{n} schede ripristinate alla dimensione predefinita」/ `sortNewestDone`「Ordinato per più recenti」
**nl.json:** `sortNewestNote`「Dit wist elke handmatige volgorde.」/ `resetSizesDone`「{n} kaarten teruggezet naar standaardformaat」/ `sortNewestDone`「Gesorteerd op nieuwste」
**pt.json:** `sortNewestNote`「Isto apaga qualquer ordem manual.」/ `resetSizesDone`「{n} cartões redefinidos para o tamanho padrão」/ `sortNewestDone`「Ordenado por mais recentes」
**ru.json:** `sortNewestNote`「Это сбросит ручную сортировку.」/ `resetSizesDone`「{n} карточек сброшено до размера по умолчанию」/ `sortNewestDone`「Отсортировано по новизне」
**ar.json:** `sortNewestNote`「سيؤدي هذا إلى مسح أي ترتيب يدوي.」/ `resetSizesDone`「تمت إعادة {n} بطاقة إلى الحجم الافتراضي」/ `sortNewestDone`「تم الترتيب من الأحدث」
**th.json:** `sortNewestNote`「การทำเช่นนี้จะล้างลำดับที่จัดเรียงเอง」/ `resetSizesDone`「รีเซ็ต {n} การ์ดเป็นขนาดเริ่มต้นแล้ว」/ `sortNewestDone`「เรียงจากใหม่สุดแล้ว」
**tr.json:** `sortNewestNote`「Bu, elle sıralamayı temizler.」/ `resetSizesDone`「{n} kart varsayılan boyuta sıfırlandı」/ `sortNewestDone`「En yeniye göre sıralandı」
**vi.json:** `sortNewestNote`「Thao tác này xóa mọi thứ tự sắp xếp thủ công.」/ `resetSizesDone`「Đã đặt lại {n} thẻ về kích thước mặc định」/ `sortNewestDone`「Đã sắp xếp mới nhất trước」

（各ファイルとも英字4キーは上記 verbatim ブロックと同一。JSON の直前行末カンマに注意。）

- [ ] **Step 5: パリティテストが通ることを確認**

Run: `rtk vitest run tests/i18n/reset-layout-keys.test.ts`
Expected: PASS（2テスト）

- [ ] **Step 6: JSON の妥当性を全体テストで確認**

Run: `rtk vitest run tests/i18n`
Expected: PASS（既存の translate-keys 等も緑）

- [ ] **Step 7: コミット**

```bash
rtk git add messages/ tests/i18n/reset-layout-keys.test.ts
rtk git commit -m "i18n(board): add reset-layout SETTINGS keys in 15 locales (N-19)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: hook に `resortNewestFirst()` を追加（use-board-data.ts）

**Files:**
- Modify: `lib/storage/use-board-data.ts`（import / 返り値型 / 実装 / return オブジェクト）

**Interfaces:**
- Consumes: `resortByNewestFirst` (Task 1) / 既存 `reload()`。
- Produces: hook の返り値に `resortNewestFirst: () => Promise<number>` を追加（実行した並び替え件数を返す）。

**Note:** このリポジトリの `use-board-data.test.ts` は純関数のみをテストし hook を renderHook しない慣習。この薄いラッパー（`resortByNewestFirst` + `reload` はどちらも既検証）は **tsc 型検査で担保**し、専用単体テストは追加しない（Task 5 の統合と全体 build で最終確認）。

- [ ] **Step 1: import を追加** — `lib/storage/use-board-data.ts` の indexeddb import 群（先頭付近）に `resortByNewestFirst` を追加

```ts
import {
  // ...既存の import はそのまま...
  clearAllCustomCardWidths,
  resortByNewestFirst,
} from './indexeddb'
```

- [ ] **Step 2: 返り値型に追加** — `resetAllCustomWidths` の型宣言（[use-board-data.ts:214](../../../lib/storage/use-board-data.ts#L214)）の直後に追加

```ts
  /** Bulk drop the `customCardWidth` flag on every bookmark that had
   *  it set. Returns the ids that were actually reset so callers can
   *  prune their in-memory override map cheaply. */
  resetAllCustomWidths: () => Promise<readonly string[]>
  /** Re-number every bookmark's orderIndex by savedAt DESC (newest first),
   *  then reload so the board shows the new order. Returns how many rows
   *  changed. User-triggered SETTINGS action (N-19). */
  resortNewestFirst: () => Promise<number>
```

- [ ] **Step 3: 実装を追加** — `resetAllCustomWidths` の useCallback（[use-board-data.ts:687-696](../../../lib/storage/use-board-data.ts#L687)）の直後に追加

```ts
  const resortNewestFirst = useCallback(async (): Promise<number> => {
    const db = dbRef.current
    if (!db) return 0
    const { updated } = await resortByNewestFirst(
      db as Parameters<typeof resortByNewestFirst>[0],
    )
    // reload re-reads bookmarks and sorts active items by orderIndex DESC, so
    // the freshly-renumbered order is reflected on the board immediately.
    await reload()
    return updated
  }, [reload])
```

- [ ] **Step 4: return オブジェクトに追加** — [use-board-data.ts:754](../../../lib/storage/use-board-data.ts#L754) の `resetAllCustomWidths,` の直後に `resortNewestFirst,` を追加

```ts
    resetCustomWidth,
    resetAllCustomWidths,
    resortNewestFirst,
    persistCardPosition,
```

- [ ] **Step 5: 型検査**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 6: コミット**

```bash
rtk git add lib/storage/use-board-data.ts
rtk git commit -m "feat(board): expose resortNewestFirst from useBoardData (N-19)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SETTINGS ドロワーに LAYOUT グループ + 2タップ確認（ExtensionEntry）

**Files:**
- Modify: `components/board/ExtensionEntry.tsx`
- Modify: `components/board/ExtensionEntry.module.css`
- Test: `components/board/ExtensionEntry.test.tsx`

**Interfaces:**
- Consumes: i18n キー（Task 2）。
- Produces: `ExtensionEntryProps` に3つ追加 —
  - `customWidthCount: number`（リサイズ済みカード数。0で A ボタン無効）
  - `onResetCardSizes: () => void`（A 実行）
  - `onSortNewestFirst: () => void`（B 実行）

- [ ] **Step 1: 失敗するテストを書く** — `components/board/ExtensionEntry.test.tsx` の末尾（最後の `})` の前）に追加

```tsx
  describe('LAYOUT group (N-19)', () => {
    const baseProps = {
      quickTagEnabled: true,
      onQuickTagToggle: () => {},
      onOpenBookmarkletModal: () => {},
      themeId: 'dotted-notebook' as const,
      onOpenThemeModal: () => {},
    }

    it('disables RESET CARD SIZES when no card is resized', () => {
      render(<ExtensionEntry {...baseProps} customWidthCount={0} onResetCardSizes={() => {}} onSortNewestFirst={() => {}} />)
      fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
      const btn = screen.getByTestId('layout-reset-sizes') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })

    it('shows the resized count and enables the button when > 0', () => {
      render(<ExtensionEntry {...baseProps} customWidthCount={3} onResetCardSizes={() => {}} onSortNewestFirst={() => {}} />)
      fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
      const btn = screen.getByTestId('layout-reset-sizes') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
      expect(btn.textContent).toContain('3')
    })

    it('requires two taps to reset sizes (first tap shows confirm, second fires)', () => {
      const onReset = vi.fn()
      render(<ExtensionEntry {...baseProps} customWidthCount={3} onResetCardSizes={onReset} onSortNewestFirst={() => {}} />)
      fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
      const btn = screen.getByTestId('layout-reset-sizes')
      fireEvent.click(btn)
      expect(onReset).not.toHaveBeenCalled()
      expect(btn.getAttribute('data-confirming')).toBe('true')
      fireEvent.click(btn)
      expect(onReset).toHaveBeenCalledTimes(1)
      expect(btn.getAttribute('data-confirming')).toBe('false')
    })

    it('requires two taps to sort newest first', () => {
      const onSort = vi.fn()
      render(<ExtensionEntry {...baseProps} customWidthCount={0} onResetCardSizes={() => {}} onSortNewestFirst={onSort} />)
      fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
      const btn = screen.getByTestId('layout-sort-newest')
      fireEvent.click(btn)
      expect(onSort).not.toHaveBeenCalled()
      fireEvent.click(btn)
      expect(onSort).toHaveBeenCalledTimes(1)
    })

    it('confirming one button cancels the other', () => {
      const onReset = vi.fn()
      const onSort = vi.fn()
      render(<ExtensionEntry {...baseProps} customWidthCount={3} onResetCardSizes={onReset} onSortNewestFirst={onSort} />)
      fireEvent.mouseEnter(screen.getByTestId('extension-settings-wrap'))
      fireEvent.click(screen.getByTestId('layout-reset-sizes')) // arm A
      fireEvent.click(screen.getByTestId('layout-sort-newest'))  // arms B, cancels A
      expect(screen.getByTestId('layout-reset-sizes').getAttribute('data-confirming')).toBe('false')
      expect(screen.getByTestId('layout-sort-newest').getAttribute('data-confirming')).toBe('true')
      expect(onReset).not.toHaveBeenCalled()
      expect(onSort).not.toHaveBeenCalled()
    })
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run components/board/ExtensionEntry.test.tsx`
Expected: FAIL（props 未定義・testid 未存在）

- [ ] **Step 3: props を追加** — `ExtensionEntryProps`（[ExtensionEntry.tsx:79-100](../../../components/board/ExtensionEntry.tsx#L79)）に追記

```ts
  /** Opens the dedicated theme screen (rendered at the board root so it escapes
   *  this drawer's `overflow: hidden`). */
  readonly onOpenThemeModal: () => void
  /** N-19: number of cards with a manual custom width. Drives the RESET CARD
   *  SIZES button's count + disabled (0 = nothing to reset). */
  readonly customWidthCount: number
  /** N-19: clear every card's manual resize (bulk). */
  readonly onResetCardSizes: () => void
  /** N-19: re-sort the board to newest-first. */
  readonly onSortNewestFirst: () => void
```

- [ ] **Step 4: 関数シグネチャの分割代入に追加** — `export function ExtensionEntry({ ... })`（[ExtensionEntry.tsx:106-114](../../../components/board/ExtensionEntry.tsx#L106)）

```ts
export function ExtensionEntry({
  quickTagEnabled,
  onQuickTagToggle,
  onOpenBookmarkletModal,
  onReplayIntro,
  forceOpen = false,
  themeId,
  onOpenThemeModal,
  customWidthCount,
  onResetCardSizes,
  onSortNewestFirst,
}: ExtensionEntryProps): ReactElement {
```

- [ ] **Step 5: 2タップ確認の state と handler を追加** — コンポーネント本体、`const isOpen = forceOpen || expanded`（[ExtensionEntry.tsx:199](../../../components/board/ExtensionEntry.tsx#L199)）の直後に追加

```ts
  // N-19: two-tap confirm shared by the two LAYOUT buttons. First tap arms a
  // button (label → TAP AGAIN TO CONFIRM) for CONFIRM_MS; second tap fires.
  // Arming one disarms the other; closing the drawer or the timeout disarms.
  const CONFIRM_MS = 3000
  const [confirming, setConfirming] = useState<'sizes' | 'sort' | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disarm = useCallback((): void => {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    setConfirming(null)
  }, [])
  const armOrFire = useCallback(
    (which: 'sizes' | 'sort', fire: () => void): void => {
      if (confirming === which) {
        disarm()
        fire()
        return
      }
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      setConfirming(which)
      confirmTimerRef.current = setTimeout(() => {
        setConfirming(null)
        confirmTimerRef.current = null
      }, CONFIRM_MS)
    },
    [confirming, disarm],
  )
  // Disarm whenever the drawer closes so a stale confirm never lingers.
  useEffect(() => {
    if (!isOpen) disarm()
  }, [isOpen, disarm])
  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }, [])
```

- [ ] **Step 6: LAYOUT グループの JSX を追加** — SAVING セクションの `</section>`（[ExtensionEntry.tsx:278](../../../components/board/ExtensionEntry.tsx#L278)）の直後に挿入

```tsx
        {/* ── LAYOUT ────────────────────────────────────────────────────────
            N-19: restore the board to defaults. Both actions two-tap confirm
            (no modal); the EXPORT backup above is the ultimate safety net. */}
        <section className={styles.group}>
          <div className={styles.groupLabel}>{t('board.settings.layoutGroup')}</div>
          <button
            type="button"
            className={styles.panelCta}
            data-testid="layout-reset-sizes"
            data-confirming={confirming === 'sizes' ? 'true' : 'false'}
            disabled={customWidthCount === 0}
            onClick={(): void => armOrFire('sizes', onResetCardSizes)}
          >
            {confirming === 'sizes'
              ? t('board.settings.tapAgainToConfirm')
              : customWidthCount > 0
                ? `${t('board.settings.resetCardSizes')} (${customWidthCount})`
                : t('board.settings.resetCardSizes')}
          </button>
          <button
            type="button"
            className={styles.panelCta}
            data-testid="layout-sort-newest"
            data-confirming={confirming === 'sort' ? 'true' : 'false'}
            onClick={(): void => armOrFire('sort', onSortNewestFirst)}
          >
            {confirming === 'sort'
              ? t('board.settings.tapAgainToConfirm')
              : t('board.settings.sortNewestFirst')}
          </button>
          <p className={styles.layoutNote}>{t('board.settings.sortNewestNote')}</p>
        </section>
```

- [ ] **Step 7: CSS を追加** — `components/board/ExtensionEntry.module.css` の `.panelCta + .panelCta`（[ExtensionEntry.module.css:270](../../../components/board/ExtensionEntry.module.css#L270)）付近の後に追記

```css
/* N-19 LAYOUT group — reuse .panelCta; add a disabled + armed treatment. */
.panelCta:disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}
.panelCta[data-confirming='true'] {
  color: rgba(255, 120, 90, 0.95);
  border-color: rgba(255, 120, 90, 0.5);
  font-weight: 600;
}
.layoutNote {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.35);
}
```

- [ ] **Step 8: テストが通ることを確認**

Run: `rtk vitest run components/board/ExtensionEntry.test.tsx`
Expected: PASS（既存 + LAYOUT 5テスト）

- [ ] **Step 9: コミット**

```bash
rtk git add components/board/ExtensionEntry.tsx components/board/ExtensionEntry.module.css components/board/ExtensionEntry.test.tsx
rtk git commit -m "feat(board): LAYOUT group with two-tap reset in SETTINGS drawer (N-19)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: BoardRoot 配線 + トースト + 最終検証

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `resetAllCustomWidths` / `resortNewestFirst`（hook）/ `ExtensionEntry` の新 props（Task 4）/ i18n キー（Task 2）/ 既存 `setToast`（[BoardRoot.tsx:291](../../../components/board/BoardRoot.tsx#L291)）。

- [ ] **Step 1: hook の分割代入に2関数を追加** — `useBoardData()` の分割代入ブロック（[BoardRoot.tsx:180](../../../components/board/BoardRoot.tsx#L180) で閉じる）内に `resetAllCustomWidths` と `resortNewestFirst` を追加

```ts
    resetCustomWidth,
    resetAllCustomWidths,
    resortNewestFirst,
    // ...（ブロックの他要素はそのまま）
  } = useBoardData()
```

（注意: `resetCustomWidth` は既に分割代入済みか確認。未追加の関数のみ足す。`resetAllCustomWidths` は現状未分割代入なので追加が必要。）

- [ ] **Step 2: リサイズ済み枚数を算出** — items が確定している箇所（例 [BoardRoot.tsx:491](../../../components/board/BoardRoot.tsx#L491) の override map 生成付近、または他の `useMemo` 群）に追加。`useMemo` が未 import なら import 追加。

```ts
  // N-19: number of cards currently on a manual custom width (drives the
  // SETTINGS RESET CARD SIZES button count + disabled state).
  const customWidthCount = useMemo(
    () => items.filter((it) => it.customCardWidth).length,
    [items],
  )
```

- [ ] **Step 3: 2つのハンドラを追加** — `handleResetWidthGap`（[BoardRoot.tsx:449](../../../components/board/BoardRoot.tsx#L449)）付近に追加

```ts
  // N-19: bulk-clear every card's manual resize, then confirm via toast.
  const handleResetCardSizes = useCallback(async (): Promise<void> => {
    const cleared = await resetAllCustomWidths()
    setToast({
      message: t('board.settings.resetSizesDone').replace('{n}', String(cleared.length)),
      nonce: Date.now(),
    })
  }, [resetAllCustomWidths, t])

  // N-19: re-sort the whole board to newest-first, then confirm via toast.
  const handleSortNewestFirst = useCallback(async (): Promise<void> => {
    await resortNewestFirst()
    setToast({ message: t('board.settings.sortNewestDone'), nonce: Date.now() })
  }, [resortNewestFirst, t])
```

- [ ] **Step 4: ExtensionEntry に props を渡す** — [BoardRoot.tsx:2208-2216](../../../components/board/BoardRoot.tsx#L2208) の `<ExtensionEntry ... />` に3行追加

```tsx
              <ExtensionEntry
                quickTagEnabled={quickTagEnabled}
                onQuickTagToggle={handleQuickTagToggle}
                onOpenBookmarkletModal={handleOpenBookmarkletModal}
                onReplayIntro={() => { void startOnboardingReplay() }}
                forceOpen={forceSettingsOpen}
                themeId={themeId}
                onOpenThemeModal={() => setThemeModalOpen(true)}
                customWidthCount={customWidthCount}
                onResetCardSizes={() => { void handleResetCardSizes() }}
                onSortNewestFirst={() => { void handleSortNewestFirst() }}
              />
```

- [ ] **Step 5: 型検査**

Run: `rtk tsc`
Expected: 0 errors

- [ ] **Step 6: 全体テスト**

Run: `rtk vitest run`
Expected: PASS（既知フレーキー `tests/lib/channel.test.ts` は再実行で緑）。件数は前回 1875 + 本機能の新規テスト分。

- [ ] **Step 7: ビルド**

Run: `rtk pnpm build`
Expected: 成功（`out/` に static export）。default 盤面に影響しないこと（SETTINGS ドロワー内のみ）。

- [ ] **Step 8: コミット**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): wire reset sizes + sort newest-first into SETTINGS (N-19)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 実装後の手動確認（ユーザー実機・マージ前）

`allmarks.app` へデプロイ後にハードリロードして:

1. SETTINGS を開き **LAYOUT** グループが SAVING の下に出る。
2. 何枚か手でリサイズ → `RESET CARD SIZES (N)` の N が実数、押す → `TAP AGAIN TO CONFIRM` → もう一度で全カードが既定サイズに戻る + トースト。
3. リサイズ0枚のとき `RESET CARD SIZES` が薄く無効。
4. `SORT: NEWEST FIRST` を2タップ → 新しいものが上の並びに戻る + トースト。
5. 別テーマ（Paper）でも見た目が馴染む（`.group`/`.panelCta` の paper scoped override 自動適用）。
6. default テーマ盤面の見た目・挙動が従来どおり（byte-identical）。

問題なければ `finishing-a-development-branch` で master へマージ → デプロイ。

---

## Self-Review

**1. Spec coverage:**
- §3 A（サイズ一括）→ Task 4 UI + Task 5 `handleResetCardSizes`（既存 `resetAllCustomWidths`）✅
- §3 B（並び順）→ Task 1 `resortByNewestFirst` + Task 3 hook + Task 5 `handleSortNewestFirst` ✅
- §4.1 配置（LAYOUT グループ）→ Task 4 Step 6 ✅
- §4.2 A の枚数表示・0で無効 → Task 4 Step 6（count / disabled）+ Task 5 Step 2（count 算出）✅
- §4.4 2タップ確認（排他・タイムアウト・閉じるとキャンセル）→ Task 4 Step 5 + テスト ✅
- §4.5 フィードバック（既存トースト再利用）→ Task 5 Step 3 ✅
- §5.1 新関数 → Task 1 ✅（**spec からの意図的逸脱**: `repairOrderIndexIfNeeded` は共有せず無変更。安全側・Note に明記）
- §5.2 hook（B は resort→reload）→ Task 3 ✅
- §6 i18n 15言語 → Task 2 ✅
- §7 不変条件（default byte-identical / tsc0 / vitest緑 / build）→ Task 5 Step 5-7 + 手動確認 ✅
- §8 テスト戦略 → Task 1 / 2 / 4 のテスト ✅
- §9 エッジケース（0枚無効 / 空ボード / 既整列 / 閉じキャンセル / 排他）→ Task 1・4 のテスト ✅
- §10 UNDO はスコープ外（計画にも含めない）✅

**2. Placeholder scan:** TBD/TODO/「適切に処理」等なし。全ステップに実コード添付。翻訳14言語は具体文字列を明記。✅

**3. Type consistency:**
- `resortByNewestFirst(db): Promise<{updated:number}>`（Task 1 定義 → Task 3 consume）一致 ✅
- `resortNewestFirst(): Promise<number>`（Task 3 定義 → Task 5 consume）一致 ✅
- `computeNewestFirstOrder(records): {id,orderIndex}[]`（Task 1 内で自己完結）✅
- ExtensionEntry props `customWidthCount:number` / `onResetCardSizes` / `onSortNewestFirst`（Task 4 定義 → Task 5 で受け渡し）一致 ✅
- i18n キー名（Task 2 定義 → Task 4/5 で `t('board.settings.<key>')`）一致 ✅
