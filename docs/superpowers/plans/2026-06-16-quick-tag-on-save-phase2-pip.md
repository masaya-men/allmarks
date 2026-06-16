# Quick-Tag on Save — Phase 2 (PiP) + ON/OFF Toggle 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pop Out（PiP）を開いている時はそのカード上でその場タグ付けし、保存時の拡張タグ帯と衝突させない。あわせて機能全体の ON/OFF トグルを本体内の SETTINGS パネルに置く。

**Architecture:** 設定値の真実は本体 IndexedDB `settings` 置き場に1つ（`quick-tag-on-save`、既定 ON）。PiP（本体オリジン）は直接読む。拡張の帯は `/save-iframe` 保存応答に相乗りした `quickTagEnabled` と `pipActive` を見て、OFF または PiP 開時に出さない。PiP のタグ付けは既存共有関数 `orderTagsForSave` と `addTagToBookmark` / `postBookmarkUpdated` を本体オリジンで直接呼ぶ。

**Tech Stack:** Next.js (App Router) / TypeScript strict / Vanilla CSS Modules / IndexedDB (`idb`) / Chrome 拡張（素 JS, ESM in `extension/lib/`）/ vitest / BroadcastChannel + Document PiP。

**設計書:** [docs/superpowers/specs/2026-06-16-quick-tag-on-save-phase2-pip-design.md](../specs/2026-06-16-quick-tag-on-save-phase2-pip-design.md)

---

## ファイル構成（作成 / 変更）

- **作成** `lib/storage/quick-tag-setting.ts` — `quick-tag-on-save` boolean の読み書き（既定 ON）。
- **作成** `lib/storage/quick-tag-setting.test.ts` — 上記の単体テスト。
- **作成** `extension/lib/quick-tag-gate.js` — 純関数 `shouldSendQuickTag({ quickTagEnabled, pipActive })`。
- **作成** `tests/extension/quick-tag-gate.test.ts` — 上記の単体テスト。
- **作成** `components/pip/PipTagStrip.tsx` — PiP 用コンパクトタグ帯（TUNE風アコーディオン、既存タグのみ）。
- **作成** `components/pip/PipTagStrip.module.css` — 上記スタイル。
- **作成** `components/pip/PipTagStrip.test.tsx` — チップ表示・タップの単体テスト。
- **変更** `lib/utils/save-message.ts` — `SaveMessageResult` 成功型に `quickTagEnabled?` / `pipActive?` を追加。
- **変更** `app/save-iframe/SaveIframeClient.tsx` — `buildSavePayload` が設定を読み `quickTagEnabled` を返す。reply に `pipActive` を載せる。
- **変更** `extension/lib/dispatch.js` — `booklage:quick-tag` 送信を `shouldSendQuickTag` でゲート。
- **変更** `components/pip/PipCard.tsx` — アクティブ時に「＋」＋ `PipTagStrip` を表示。
- **変更** `components/pip/PipStack.tsx` — アクティブカードへタグ用 props を渡す。
- **変更** `components/pip/PipCompanion.tsx` — allTags / corpus / 現在タグ を読み、`onAddTag` を提供。`quickTagEnabled` で全体ゲート。
- **変更** `components/board/ExtensionEntry.tsx` + `ExtensionEntry.module.css` — SETTINGS を本体内パネル化（トグル＋拡張設定ボタン、TUNE/AllMarks ホバー様式）。
- **変更** `components/board/BoardRoot.tsx` — `quickTagEnabled` state を持ち、ExtensionEntry と PipCompanion に渡す。

---

## Task 1: 本体の ON/OFF 設定モジュール

**Files:**
- Create: `lib/storage/quick-tag-setting.ts`
- Test: `lib/storage/quick-tag-setting.test.ts`

設計①。`tag-order-mode.ts` と同じ「`settings` 置き場のキー＋値レコード」方式。`SettingsRecord` インターフェイスは触らず、`any` db ハッチを使う（既存 `board-config.test.ts` / `tag-order-mode.ts` と同流儀）。

- [ ] **Step 1: 失敗するテストを書く**

`lib/storage/quick-tag-setting.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadQuickTagEnabled, saveQuickTagEnabled } from './quick-tag-setting'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function makeFakeDb(): any {
  const store = new Map<string, unknown>()
  return {
    get: async (_name: string, key: string) => store.get(key),
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    put: async (_name: string, value: any) => { store.set(value.key, value); return value.key },
  }
}

describe('quick-tag-on-save setting', () => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let db: any
  beforeEach(() => { db = makeFakeDb() })

  it('defaults to ON when nothing saved', async () => {
    expect(await loadQuickTagEnabled(db)).toBe(true)
  })

  it('round-trips false', async () => {
    await saveQuickTagEnabled(db, false)
    expect(await loadQuickTagEnabled(db)).toBe(false)
  })

  it('round-trips true', async () => {
    await saveQuickTagEnabled(db, false)
    await saveQuickTagEnabled(db, true)
    expect(await loadQuickTagEnabled(db)).toBe(true)
  })

  it('falls back to default when stored value is not a boolean', async () => {
    await db.put('settings', { key: 'quick-tag-on-save', enabled: 'yes' })
    expect(await loadQuickTagEnabled(db)).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk npx vitest run lib/storage/quick-tag-setting.test.ts`
Expected: FAIL（`quick-tag-setting` モジュールが存在しない）

- [ ] **Step 3: 最小実装**

`lib/storage/quick-tag-setting.ts`:

```ts
import type { IDBPDatabase } from 'idb'

/** Persisted under its own settings key (independent of BoardConfig / tag-order-
 *  mode, which own their own keys — keeping them separate avoids one
 *  overwriting another). Source of truth for the whole quick-tag-on-save
 *  feature: PiP reads it directly, the extension reads it via the save
 *  response piggyback (/save-iframe). Default ON. */
const QUICK_TAG_KEY = 'quick-tag-on-save'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Record_ = { key: string; enabled: boolean }

export async function loadQuickTagEnabled(db: DbLike): Promise<boolean> {
  const rec = (await db.get('settings', QUICK_TAG_KEY)) as Record_ | undefined
  return typeof rec?.enabled === 'boolean' ? rec.enabled : true
}

export async function saveQuickTagEnabled(db: DbLike, enabled: boolean): Promise<void> {
  await db.put('settings', { key: QUICK_TAG_KEY, enabled } satisfies Record_)
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `rtk npx vitest run lib/storage/quick-tag-setting.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: commit**

```bash
rtk git add lib/storage/quick-tag-setting.ts lib/storage/quick-tag-setting.test.ts
rtk git commit -m "feat(storage): quick-tag-on-save setting (app IDB, default on)"
```

---

## Task 2: 保存応答の型に `quickTagEnabled` / `pipActive` を追加

**Files:**
- Modify: `lib/utils/save-message.ts:46-60`

設計①②。`SaveMessageResult` の成功型へ2フィールド追加（任意）。型のみの変更。後続 Task 3/4 が使う。

- [ ] **Step 1: 型を追加**

`lib/utils/save-message.ts` の成功バリアント（現状 L46-59）を次のように変更:

```ts
export type SaveMessageResult =
  | {
      type: 'booklage:save:result'
      nonce: string
      ok: true
      bookmarkId: string
      skipped?: true
      /** Existing tags, relevant-first, for the quick-tag strip. */
      tags?: QuickTag[]
      /** Tag ids already on this bookmark (marked ✓ in the strip). */
      currentTagIds?: string[]
      /** Active theme's resolved tokens; strip auto-follows theme changes. */
      themeTokens?: StripThemeTokens
      /** Whole-feature ON/OFF (read from app IDB). false = extension shows no
       *  strip (plain save confirmation only). Absent = treat as ON. */
      quickTagEnabled?: boolean
      /** True when a PiP companion window is open at save time. The extension
       *  suppresses its host-page strip when true (PiP handles tagging on the
       *  card instead) — avoids the two surfaces colliding. */
      pipActive?: boolean
    }
  | { type: 'booklage:save:result'; nonce: string; ok: false; error: string }
```

- [ ] **Step 2: 型チェック**

Run: `rtk tsc`
Expected: エラーなし（既存呼出元は追加フィールドが任意なので壊れない）

- [ ] **Step 3: commit**

```bash
rtk git add lib/utils/save-message.ts
rtk git commit -m "feat(save-message): carry quickTagEnabled + pipActive on save result"
```

---

## Task 3: save-iframe が設定と PiP 状態を相乗りさせて返す

**Files:**
- Modify: `app/save-iframe/SaveIframeClient.tsx:5-18,44-54,156-211`

設計①②。`buildSavePayload` が設定を読んで `quickTagEnabled` を返す。reply（成功時）に `pipActive`（`pipActiveRef.current`）を載せる。

> 注: この経路の実効動作は実機（拡張＋本番）で確認する（offscreen 越しのため vitest 単体化はしない）。設定読みの正しさは Task 1、抑止判定は Task 4 で単体化済み。

- [ ] **Step 1: import を追加**

`app/save-iframe/SaveIframeClient.tsx` の import 群（L5-8 付近）に追加:

```ts
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
```

- [ ] **Step 2: `buildSavePayload` が `quickTagEnabled` を返す**

現状（L44-54）:

```ts
async function buildSavePayload(
  db: SaveDb,
  bookmark: BookmarkRecord,
): Promise<{ tags: ReturnType<typeof orderTagsForSave>; currentTagIds: string[]; themeTokens: StripThemeTokens }> {
  const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
  return {
    tags: orderTagsForSave(bookmark, corpus, allTags),
    currentTagIds: bookmark.tags,
    themeTokens: readThemeTokens(),
  }
}
```

を次に変更:

```ts
async function buildSavePayload(
  db: SaveDb,
  bookmark: BookmarkRecord,
): Promise<{
  tags: ReturnType<typeof orderTagsForSave>
  currentTagIds: string[]
  themeTokens: StripThemeTokens
  quickTagEnabled: boolean
}> {
  const [corpus, allTags, quickTagEnabled] = await Promise.all([
    getAllBookmarks(db),
    getAllTags(db),
    loadQuickTagEnabled(db),
  ])
  return {
    tags: orderTagsForSave(bookmark, corpus, allTags),
    currentTagIds: bookmark.tags,
    themeTokens: readThemeTokens(),
    quickTagEnabled,
  }
}
```

- [ ] **Step 3: 成功 reply に `pipActive` を載せる**

L192 付近の成功 reply（`reply({ type: 'booklage:save:result', nonce: payload.nonce, ok: true, bookmarkId: bm.id, ...savePayload })`）を、`pipActive` を加えた形に変更:

```ts
        reply({
          type: 'booklage:save:result',
          nonce: payload.nonce,
          ok: true,
          bookmarkId: bm.id,
          ...savePayload,
          pipActive: pipActiveRef.current,
        })
```

> `savePayload` は既に `quickTagEnabled` を含む（Step 2）。`pipActiveRef.current` は既存の PiP presence 購読（L77-83）で最新化されている。スキップ（重複）分岐の成功 reply も同様に `pipActive: pipActiveRef.current` を加える（同ファイル内に重複保存の成功 reply がある場合は同様に対応。`grep -n "ok: true" app/save-iframe/SaveIframeClient.tsx` で全成功 reply を洗い出し、`...savePayload` を含む成功 reply 全てに `pipActive` を付与する）。

- [ ] **Step 4: 型チェック**

Run: `rtk tsc`
Expected: エラーなし

- [ ] **Step 5: commit**

```bash
rtk git add app/save-iframe/SaveIframeClient.tsx
rtk git commit -m "feat(save-iframe): piggyback quickTagEnabled + pipActive on save reply"
```

---

## Task 4: 拡張の帯抑止ゲート（純関数＋配線）

**Files:**
- Create: `extension/lib/quick-tag-gate.js`
- Test: `tests/extension/quick-tag-gate.test.ts`
- Modify: `extension/lib/dispatch.js:140-148`

設計①②。`booklage:quick-tag` を送るかの判定を純関数に切り出して単体テスト → dispatch.js から使う。

- [ ] **Step 1: 失敗するテストを書く**

`tests/extension/quick-tag-gate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldSendQuickTag } from '../../extension/lib/quick-tag-gate.js'

describe('shouldSendQuickTag', () => {
  it('sends when enabled and PiP closed', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: true, pipActive: false })).toBe(true)
  })
  it('suppresses when feature is OFF', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: false, pipActive: false })).toBe(false)
  })
  it('suppresses when PiP is open (PiP card handles tagging)', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: true, pipActive: true })).toBe(false)
  })
  it('treats missing quickTagEnabled as ON (back-compat with older save-iframe)', () => {
    expect(shouldSendQuickTag({ pipActive: false })).toBe(true)
  })
  it('treats missing pipActive as closed', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: true })).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk npx vitest run tests/extension/quick-tag-gate.test.ts`
Expected: FAIL（モジュール無し）

- [ ] **Step 3: 最小実装**

`extension/lib/quick-tag-gate.js`:

```js
// Decide whether the host-page quick-tag strip should be shown after a save.
// Source of truth: the save reply from /save-iframe carries `quickTagEnabled`
// (whole-feature ON/OFF from app IDB) and `pipActive` (a PiP window is open).
// - feature OFF        -> never show the strip (plain save confirmation only)
// - PiP open           -> never show on the host page; the PiP card handles
//                         tagging instead, so the two surfaces don't collide
// Missing fields are treated as the permissive default (older /save-iframe
// builds that predate this field still show the strip).
export function shouldSendQuickTag(result) {
  const enabled = result && result.quickTagEnabled !== false
  const pipOpen = !!(result && result.pipActive)
  return enabled && !pipOpen
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `rtk npx vitest run tests/extension/quick-tag-gate.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: dispatch.js に配線**

`extension/lib/dispatch.js` 冒頭の import 群（L1-2）に追加:

```js
import { shouldSendQuickTag } from './quick-tag-gate.js'
```

`extension/lib/dispatch.js:140-148` の quick-tag 送信を、ゲートで包む形に変更:

```js
  // Quick-tag strip is always rendered by floating-button.js (anchored to the
  // button, or its default slot when the button is off), regardless of which
  // confirmation surface showed. Show it only when the feature is ON and no
  // PiP window is open (PiP handles tagging on its own card — see phase 2).
  if ((finalState === 'saved' || finalState === 'duplicate') && shouldSendQuickTag(result)) {
    chrome.tabs.sendMessage(tabId, {
      type: 'booklage:quick-tag',
      bookmarkId: result.bookmarkId,
      tags: Array.isArray(result.tags) ? result.tags : [],
      currentTagIds: Array.isArray(result.currentTagIds) ? result.currentTagIds : [],
      themeTokens: result.themeTokens || null,
    }).catch(() => {})
  }
```

- [ ] **Step 6: 構文チェック（拡張 JS の必須確認）**

Run: `node --check extension/lib/quick-tag-gate.js && node --check extension/lib/dispatch.js`
Expected: 出力なし（= 構文 OK）

- [ ] **Step 7: commit**

```bash
rtk git add extension/lib/quick-tag-gate.js tests/extension/quick-tag-gate.test.ts extension/lib/dispatch.js
rtk git commit -m "feat(extension): gate quick-tag strip on quickTagEnabled + pipActive"
```

---

## Task 5: PiP 用コンパクトタグ帯コンポーネント

**Files:**
- Create: `components/pip/PipTagStrip.tsx`
- Create: `components/pip/PipTagStrip.module.css`
- Test: `components/pip/PipTagStrip.test.tsx`

設計③。既存タグのみ（新規作成なし）。collapsed = 上位2チップ＋`▾`、ホバー（または開）で残りを展開。チップタップで `onAdd(tagId)`。`QuickTag[]`（`orderTagsForSave` の戻り）を入力に取る。見た目の最終数値は実機調整なので CSS は素朴な初期値で良い。

- [ ] **Step 1: 失敗するテストを書く**

`components/pip/PipTagStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipTagStrip } from './PipTagStrip'
import type { QuickTag } from '@/lib/tagger/order-tags-for-save'

const TAGS: QuickTag[] = [
  { id: 't1', name: 'design', color: '#28f100' },
  { id: 't2', name: 'video', color: '#28f100' },
  { id: 't3', name: 'read-later', color: '#28f100' },
]

describe('PipTagStrip', () => {
  it('renders a chip per tag', () => {
    render(<PipTagStrip tags={TAGS} currentTagIds={[]} onAdd={() => {}} />)
    expect(screen.getByText('design')).toBeTruthy()
    expect(screen.getByText('video')).toBeTruthy()
    expect(screen.getByText('read-later')).toBeTruthy()
  })

  it('marks already-applied tags with a check', () => {
    render(<PipTagStrip tags={TAGS} currentTagIds={['t2']} onAdd={() => {}} />)
    const applied = screen.getByRole('button', { name: /video/ })
    expect(applied.getAttribute('data-has')).toBe('true')
  })

  it('calls onAdd with the tag id when a chip is tapped', () => {
    const onAdd = vi.fn()
    render(<PipTagStrip tags={TAGS} currentTagIds={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: /design/ }))
    expect(onAdd).toHaveBeenCalledWith('t1')
  })

  it('renders nothing when there are no tags', () => {
    const { container } = render(<PipTagStrip tags={[]} currentTagIds={[]} onAdd={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk npx vitest run components/pip/PipTagStrip.test.tsx`
Expected: FAIL（コンポーネント無し）

- [ ] **Step 3: 最小実装**

`components/pip/PipTagStrip.tsx`:

```tsx
'use client'

import { useState, type ReactElement } from 'react'
import type { QuickTag } from '@/lib/tagger/order-tags-for-save'
import styles from './PipTagStrip.module.css'

export interface PipTagStripProps {
  /** Existing tags, relevant-first (from orderTagsForSave). */
  readonly tags: readonly QuickTag[]
  /** Tag ids already on this bookmark — rendered with a ✓ and data-has. */
  readonly currentTagIds: readonly string[]
  /** Tap a chip → attach that existing tag to the bookmark. */
  readonly onAdd: (tagId: string) => void
}

/** Compact existing-tags strip for the PiP card. Mirrors the extension's
 *  TUNE-style accordion: a collapsed preview of the top chips plus a ▾ that
 *  expands the rest. No new-tag creation (existing only) — the PiP window is
 *  tiny and phase 1 set the precedent. */
export function PipTagStrip({ tags, currentTagIds, onAdd }: PipTagStripProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false)
  if (tags.length === 0) return null

  const COLLAPSED_COUNT = 2
  const visible = expanded ? tags : tags.slice(0, COLLAPSED_COUNT)
  const hasOverflow = tags.length > COLLAPSED_COUNT
  const current = new Set(currentTagIds)

  return (
    <div className={styles.strip} data-expanded={expanded ? 'true' : 'false'}>
      <div className={styles.row}>
        {visible.map((t) => {
          const has = current.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className={styles.chip}
              data-has={has ? 'true' : 'false'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAdd(t.id)}
            >
              {has ? '✓ ' : ''}{t.name}
            </button>
          )
        })}
        {hasOverflow && !expanded && (
          <button
            type="button"
            className={styles.more}
            aria-label="Show all tags"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setExpanded(true)}
          >
            ▾
          </button>
        )}
      </div>
    </div>
  )
}
```

`components/pip/PipTagStrip.module.css`（初期値・実機で調整）:

```css
.strip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-dark, #0a0a0a) 82%, transparent);
  border: 1px solid var(--color-card-border, rgba(255, 255, 255, 0.12));
  backdrop-filter: blur(var(--glass-blur, 8px));
  max-width: 100%;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.chip {
  font: 500 11px/1 var(--font-sans, system-ui, sans-serif);
  letter-spacing: 0.02em;
  color: var(--text-primary, #f2f2f2);
  background: transparent;
  border: 1px solid var(--color-card-border, rgba(255, 255, 255, 0.18));
  border-radius: 999px;
  padding: 4px 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.18s ease, color 0.18s ease;
}

.chip[data-has='true'] {
  color: #28f100;
  border-color: color-mix(in srgb, #28f100 60%, transparent);
}

.more {
  font: 600 11px/1 var(--font-sans, system-ui, sans-serif);
  color: var(--text-primary, #f2f2f2);
  background: transparent;
  border: 1px solid var(--color-card-border, rgba(255, 255, 255, 0.18));
  border-radius: 999px;
  padding: 4px 7px;
  cursor: pointer;
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `rtk npx vitest run components/pip/PipTagStrip.test.tsx`
Expected: PASS（4 tests）

- [ ] **Step 5: commit**

```bash
rtk git add components/pip/PipTagStrip.tsx components/pip/PipTagStrip.module.css components/pip/PipTagStrip.test.tsx
rtk git commit -m "feat(pip): PipTagStrip compact existing-tags accordion"
```

---

## Task 6: PiP のデータ配線と「＋」（PipCompanion → PipStack → PipCard）

**Files:**
- Modify: `components/pip/PipCard.tsx`
- Modify: `components/pip/PipStack.tsx`
- Modify: `components/pip/PipCompanion.tsx`
- Test: `components/pip/PipCompanion.test.tsx`（add-tag 経路を追加）

設計③。PipCompanion が `allTags` / corpus / 各カードの現在タグ を読み、`onAddTag(bookmarkId, tagId)` を提供。アクティブカード（`PipStack` の `activeIdx`）にのみ「＋」を出す。「＋」を押すと `PipTagStrip` を表示。`quickTagEnabled` が false の時は「＋」自体を出さない。

> 既存テスト `components/pip/PipCompanion.test.tsx` を壊さないこと。新 props は任意 or 既定で従来描画を維持する。

- [ ] **Step 1: PipCard にタグ用 props と「＋」を足す（先にテストを更新）**

`components/pip/PipCard.tsx` の `PipCardProps` に追加し、アクティブ時のみ「＋」＋帯を描画。`PipCard` は表示専用だったので、タグ関連 props は任意（省略時は従来どおり表示専用）。

実装（`PipCardProps` 末尾に追記 + JSX 内 `.cardInner` の後に挿入）:

```tsx
import { PipTagStrip } from './PipTagStrip'
import type { QuickTag } from '@/lib/tagger/order-tags-for-save'
// ...
export interface PipCardProps {
  readonly id: string
  readonly thumbnail: string
  readonly favicon: string
  readonly title: string
  readonly aspectRatio?: number
  /** True for the centred/active carousel card — only it shows the + affordance. */
  readonly isActive?: boolean
  /** Whole-feature toggle. When false, no + button is rendered. */
  readonly tagEnabled?: boolean
  /** Existing tags relevant-first (orderTagsForSave). */
  readonly tags?: readonly QuickTag[]
  /** Tag ids already on this bookmark. */
  readonly currentTagIds?: readonly string[]
  /** Attach an existing tag to this bookmark. */
  readonly onAddTag?: (tagId: string) => void
}
```

`PipCard` 本体内、`useState(imgErrored…)` の並びに帯の開閉 state を追加し、`.cardInner` を閉じた直後に「＋」＋帯を条件描画:

```tsx
  const [tagOpen, setTagOpen] = useState(false)
  const canTag =
    isActive === true &&
    tagEnabled !== false &&
    onAddTag !== undefined &&
    (tags?.length ?? 0) > 0
```

```tsx
      {canTag && (
        <div className={styles.tagAffordance}>
          {!tagOpen ? (
            <button
              type="button"
              className={styles.addTagButton}
              aria-label="Add tag"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTagOpen(true)}
            >
              +
            </button>
          ) : (
            <PipTagStrip
              tags={tags ?? []}
              currentTagIds={currentTagIds ?? []}
              onAdd={(tagId) => onAddTag?.(tagId)}
            />
          )}
        </div>
      )}
```

`components/pip/PipCard.module.css` に最小スタイルを追記（実機調整前提）:

```css
.tagAffordance {
  position: absolute;
  left: 6px;
  bottom: 6px;
  z-index: 2;
  max-width: calc(100% - 12px);
}

.addTagButton {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  font: 600 16px/1 var(--font-sans, system-ui, sans-serif);
  color: var(--text-primary, #f2f2f2);
  background: color-mix(in srgb, var(--bg-dark, #0a0a0a) 70%, transparent);
  border: 1px solid var(--color-card-border, rgba(255, 255, 255, 0.2));
  backdrop-filter: blur(var(--glass-blur, 8px));
  cursor: pointer;
  display: grid;
  place-items: center;
}
```

> `.card` は既に `position` を持つ前提（カルーセルの slot 内）。持っていなければ `.card { position: relative }` を確認・追記する（`grep -n "position" components/pip/PipCard.module.css` で確認）。

- [ ] **Step 2: PipStack がアクティブカードへ props を中継**

`components/pip/PipStack.tsx` の `PipStackCard` に任意のタグフィールドを足し、`PipStackProps` にタグ用ハンドラ群を足す。`<PipCard {...card} />`（L292）を `isActive` + タグ props 付きに変更。

`PipStackCard` に追記:

```ts
export interface PipStackCard {
  readonly id: string
  readonly title: string
  readonly thumbnail: string
  readonly favicon: string
  readonly aspectRatio?: number
  /** Existing tags relevant-first for this card (orderTagsForSave). */
  readonly tags?: readonly QuickTag[]
  /** Tag ids already on this bookmark. */
  readonly currentTagIds?: readonly string[]
}
```

（`import type { QuickTag } from '@/lib/tagger/order-tags-for-save'` を追加）

`PipStackProps` に追記:

```ts
  /** Whole-feature toggle — threaded to the active card's + affordance. */
  readonly tagEnabled?: boolean
  /** Attach an existing tag to a bookmark (active card only). */
  readonly onAddTag?: (bookmarkId: string, tagId: string) => void
```

L292 の `<PipCard {...card} />` を変更:

```tsx
            <PipCard
              {...card}
              isActive={idx === activeIdx}
              tagEnabled={tagEnabled}
              onAddTag={onAddTag ? (tagId) => onAddTag(card.id, tagId) : undefined}
            />
```

- [ ] **Step 3: PipCompanion がタグデータを読み `onAddTag` を提供**

`components/pip/PipCompanion.tsx`:
- import 追加: `getAllTags, addTagToBookmark` (`@/lib/storage/tags`)、`getAllBookmarks`（`@/lib/storage/indexeddb`）、`orderTagsForSave`（`@/lib/tagger/order-tags-for-save`）、`postBookmarkUpdated`（`@/lib/board/channel`）。
- 新 prop `quickTagEnabled?: boolean`（既定 true 扱い）を受ける。
- カード挿入時に `orderTagsForSave(bm, corpus, allTags)` を計算して `tags` と `currentTagIds`（`bm.tags`）をカードに載せる。`allTags`/corpus は保存イベントごとに読む（PiP は低頻度なので十分）。
- `handleAddTag` を実装: `addTagToBookmark` → ローカル state の `currentTagIds` に push → `postBookmarkUpdated({ bookmarkId })`。

`PipCompanionProps` と state を変更:

```tsx
export interface PipCompanionProps {
  readonly onClose?: () => void
  readonly onCardClick?: (cardId: string) => void
  /** Whole-feature ON/OFF (lifted from BoardRoot). Default ON. */
  readonly quickTagEnabled?: boolean
}
```

`subscribeBookmarkSaved` のハンドラ内、`initial` を作る所を tags 込みに変更:

```tsx
      const db = await initDB()
      const bm = await db.get('bookmarks', bookmarkId)
      if (!bm) return
      const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
      const initial: PipStackCard = {
        id: bm.id,
        title: bm.title,
        thumbnail: bm.thumbnail ?? '',
        favicon: bm.favicon ?? '',
        tags: orderTagsForSave(bm, corpus, allTags),
        currentTagIds: [...bm.tags],
      }
      setCards((prev) => [...prev.filter((c) => c.id !== initial.id), initial])
```

`handleAddTag` を追加 + `PipStack` に渡す:

```tsx
  const handleAddTag = useCallback(async (bookmarkId: string, tagId: string) => {
    const db = await initDB()
    await addTagToBookmark(db, bookmarkId, tagId)
    setCards((prev) =>
      prev.map((c) =>
        c.id === bookmarkId && !(c.currentTagIds ?? []).includes(tagId)
          ? { ...c, currentTagIds: [...(c.currentTagIds ?? []), tagId] }
          : c,
      ),
    )
    postBookmarkUpdated({ bookmarkId })
  }, [])
```

```tsx
        <PipStack
          cards={cards}
          onCardClick={handleCardClick}
          tagEnabled={quickTagEnabled !== false}
          onAddTag={handleAddTag}
        />
```

- [ ] **Step 4: PipCompanion テストに add-tag 経路を追加**

`components/pip/PipCompanion.test.tsx` に、保存→カードにタグが載る／`onAddTag` で `addTagToBookmark` + `postBookmarkUpdated` が呼ばれることのテストを追加（既存テストの mock 構成に合わせる。`@/lib/storage/tags` と `@/lib/board/channel` を `vi.mock` する）。最低限:

```tsx
// 既存の vi.mock 群に追記する想定の方針メモ:
// - vi.mock('@/lib/storage/tags', () => ({ getAllTags: vi.fn(async () => []), addTagToBookmark: vi.fn(async () => {}) }))
// - vi.mock('@/lib/board/channel', ...) に postBookmarkUpdated: vi.fn() を追加
// テスト本体:
it('attaches an existing tag and broadcasts an update', async () => {
  // 1) 保存イベントを発火 → カードが1枚出る（既存ヘルパを流用）
  // 2) アクティブカードの + を押す → チップを click
  // 3) addTagToBookmark と postBookmarkUpdated が当該 bookmarkId で呼ばれることを expect
})
```

> 既存テストの記述様式（fake DB / BroadcastChannel mock）を読んでから具体化する。新規 mock を足しても既存ケースが緑のままであることを確認。

- [ ] **Step 5: 型チェック + テスト**

Run: `rtk tsc && rtk npx vitest run components/pip/`
Expected: PASS（PipCard / PipStack / PipCompanion / PipTagStrip すべて緑）

- [ ] **Step 6: commit**

```bash
rtk git add components/pip/PipCard.tsx components/pip/PipCard.module.css components/pip/PipStack.tsx components/pip/PipCompanion.tsx components/pip/PipCompanion.test.tsx
rtk git commit -m "feat(pip): tag the active PiP card in place (existing tags, broadcasts update)"
```

---

## Task 7: SETTINGS を本体内パネル化（トグル＋拡張設定ボタン）

**Files:**
- Modify: `components/board/ExtensionEntry.tsx`
- Modify: `components/board/ExtensionEntry.module.css`
- Modify: `components/board/BoardRoot.tsx:1730,2004-2009`
- Test: `components/board/ExtensionEntry.test.tsx`（無ければ作成）

設計①。拡張インストール済み時の `SETTINGS` を「外部を開くだけ」から、本体内パネル（トグル＋「OPEN EXTENSION SETTINGS」ボタン）に変える。見た目は TUNE ドロワー／GET EXTENSION の `.promo` ポップアップと同じトンマナ・同 easing（`cubic-bezier(0.16,1,0.3,1)`）。値は BoardRoot が持つ `quickTagEnabled` state を読み書き。

> パネルの開閉・outside-click/ESC 閉じは、同ファイルの GET EXTENSION promo（L90-104）と同じ capture-phase pointerdown パターンを流用する。

- [ ] **Step 1: BoardRoot に `quickTagEnabled` state を足す**

`components/board/BoardRoot.tsx`:
- import: `loadQuickTagEnabled, saveQuickTagEnabled`（`@/lib/storage/quick-tag-setting`）、`initDB`（既存があれば流用）。
- state: `const [quickTagEnabled, setQuickTagEnabled] = useState(true)`。
- mount 時に IDB から読む `useEffect`:

```tsx
  useEffect(() => {
    let alive = true
    void (async () => {
      const db = await initDB()
      const v = await loadQuickTagEnabled(db)
      if (alive) setQuickTagEnabled(v)
    })()
    return () => { alive = false }
  }, [])
```

- トグルハンドラ:

```tsx
  const handleQuickTagToggle = useCallback(async (next: boolean) => {
    setQuickTagEnabled(next)            // optimistic
    const db = await initDB()
    await saveQuickTagEnabled(db, next)
  }, [])
```

- `<ExtensionEntry />`（L1730）を変更:

```tsx
              <ExtensionEntry
                quickTagEnabled={quickTagEnabled}
                onQuickTagToggle={handleQuickTagToggle}
              />
```

- `<PipCompanion … />`（L2005-2008）に `quickTagEnabled={quickTagEnabled}` を追加。

- [ ] **Step 2: ExtensionEntry をパネル化**

`components/board/ExtensionEntry.tsx`:
- props を追加:

```tsx
export interface ExtensionEntryProps {
  readonly quickTagEnabled: boolean
  readonly onQuickTagToggle: (next: boolean) => void
}
```

- インストール済み分岐（現状 L106-108 の `return <ChromeButton label="SETTINGS" … />`）を、トグル付きパネルを開く形に変更。`open` state は既存。パネル内に:
  - タイトル `SETTINGS`
  - トグル行: ラベル `QUICK-TAG ON SAVE` ＋ チェックボックス/スイッチ（`checked={quickTagEnabled}` → `onChange` で `onQuickTagToggle(e.target.checked)`）
  - ボタン `OPEN EXTENSION SETTINGS` → 既存の `openSettings()`（`allmarks:open-settings` postMessage）

```tsx
  if (installed) {
    return (
      <span ref={wrapRef} className={styles.wrap}>
        <ChromeButton
          label="SETTINGS"
          onClick={(): void => setOpen((v) => !v)}
          aria-pressed={open}
          data-testid="extension-settings"
        />
        {open && (
          <div className={styles.panel} role="dialog" aria-label="AllMarks settings">
            <div className={styles.title}>SETTINGS</div>
            <label className={styles.toggleRow}>
              <span className={styles.toggleLabel}>QUICK-TAG ON SAVE</span>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={quickTagEnabled}
                onChange={(e): void => onQuickTagToggle(e.target.checked)}
                data-testid="quick-tag-toggle"
              />
            </label>
            <button
              type="button"
              className={styles.cta}
              onClick={(): void => { openSettings(); setOpen(false) }}
              data-testid="open-extension-settings"
            >
              OPEN EXTENSION SETTINGS
            </button>
          </div>
        )}
      </span>
    )
  }
```

> outside-click/ESC を効かせるため、既存 `useEffect`（L90-104）の `if (!open) return` ガードはインストール済みパネルにもそのまま効く（`open` 共有）。`wrapRef` をインストール済み分岐の `<span>` にも付けること（上記済み）。

- [ ] **Step 3: パネルの CSS（TUNE/promo と同様式）**

`components/board/ExtensionEntry.module.css` に `.panel` / `.title`（既存があれば流用）/ `.toggleRow` / `.toggleLabel` / `.toggle` を追加。`.promo` の glass・余白・`cubic-bezier(0.16,1,0.3,1)` の出現アニメを踏襲（`.promo` の定義をコピーして名前替え＋トグル行を足すのが最短）。

```css
/* 既存 .promo のアニメ・glass をそのまま受け継ぐ。下記は追加分のみ。 */
.toggleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  cursor: pointer;
}
.toggleLabel {
  font: 600 11px/1 var(--font-sans, system-ui, sans-serif);
  letter-spacing: 0.08em;
  color: var(--text-primary, #f2f2f2);
}
```

> `.panel` は `.promo` と同じ出現アニメ（`animation: … cubic-bezier(0.16, 1, 0.3, 1)`）・同じ背景/blur/border を使う。`.promo` の rule を複製して `.panel` 名で定義し、幅だけ内容に合わせる。

- [ ] **Step 4: テスト（トグルの永続化と相互作用）**

`components/board/ExtensionEntry.test.tsx`（無ければ作成）。拡張検知（`data-booklage-extension`）を立ててインストール済み分岐を出し、トグル操作で `onQuickTagToggle` が呼ばれること、`checked` が prop に従うことを検証:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExtensionEntry } from './ExtensionEntry'

beforeEach(() => {
  document.documentElement.dataset.booklageExtension = '1'
})

describe('ExtensionEntry settings panel', () => {
  it('opens the panel and reflects the toggle state', () => {
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={() => {}} />)
    fireEvent.click(screen.getByTestId('extension-settings'))
    const toggle = screen.getByTestId('quick-tag-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })

  it('calls onQuickTagToggle when toggled', () => {
    const onToggle = vi.fn()
    render(<ExtensionEntry quickTagEnabled={true} onQuickTagToggle={onToggle} />)
    fireEvent.click(screen.getByTestId('extension-settings'))
    fireEvent.click(screen.getByTestId('quick-tag-toggle'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})
```

> インストール済み検知は `useLayoutEffect` の同期読み（`readMarker()`）で立つので、`beforeEach` で属性を立てておけば初回 render でパネル分岐に入る。立たない場合は `data-booklage-extension` を `document.documentElement` に設定するタイミングを render 前にする。

- [ ] **Step 5: 型チェック + テスト**

Run: `rtk tsc && rtk npx vitest run components/board/ExtensionEntry.test.tsx`
Expected: PASS

- [ ] **Step 6: commit**

```bash
rtk git add components/board/ExtensionEntry.tsx components/board/ExtensionEntry.module.css components/board/ExtensionEntry.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(board): in-app SETTINGS panel with quick-tag toggle (TUNE-style)"
```

---

## Task 8: 全体検証（tsc / vitest / 構文 / 本番実機）

**Files:** なし（検証のみ）

- [ ] **Step 1: 型・テスト・構文の一括確認**

Run:
```bash
rtk tsc && rtk npx vitest run && node --check extension/lib/quick-tag-gate.js && node --check extension/lib/dispatch.js && node --check extension/floating-button.js
```
Expected: tsc エラーなし、vitest 全緑、`node --check` 出力なし

- [ ] **Step 2: 本番ビルド**

Run:
```bash
rtk pnpm build
```
Expected: `out/` 生成、エラーなし

- [ ] **Step 3: 本番デプロイ（CLAUDE.md 手順）**

```bash
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 4: 本番 allmarks.app で実機確認（目視・数値調整）**

確認シート:
1. **トグル**: ボード SETTINGS → パネルが TUNE/AllMarks ホバーと同じトンマナで出る。`QUICK-TAG ON SAVE` を OFF → 保存しても帯が出ない。ON に戻すと出る。「OPEN EXTENSION SETTINGS」で拡張設定ページが開く（localhost ではなく本番で）。
2. **衝突解消**: PiP を開いた状態で保存 → フローティングボタンの帯は出ず、PiP に新カードが入場アニメで入る（隠れない）。
3. **PiP タグ付け**: PiP のアクティブカードに「＋」→ 押すとタグ帯（既存タグ・関連順）→ チップタップで ✓、開いているボードに即反映（`bookmark-updated`）。
4. **見た目数値の調整**: 「＋」位置・帯寸法・展開アニメを実機で詰める（このタスク内で CSS 微調整＋追加 commit 可）。

- [ ] **Step 5: ドキュメント更新 + 最終 commit**

`docs/CURRENT_GOAL.md` / `docs/TODO.md`「現在の状態」/ `docs/TODO_COMPLETED.md` を更新（第2段完了、次は第3段）。`docs/private/dashboard.html` も最新化。

```bash
rtk git add docs/
rtk git commit -m "docs(session-104): quick-tag phase 2 (PiP) complete"
```

---

## Self-Review メモ（計画作成者による確認）

- **spec ①（トグル・本体真実・相乗り・SETTINGS パネル化・TUNE 様式）** → Task 1（設定）/ Task 2-3（相乗り）/ Task 7（パネル＋様式）でカバー。
- **spec ②（PiP 開時に拡張帯抑止・既存 pipActive 流用）** → Task 2-3（pipActive 相乗り）/ Task 4（ゲート）でカバー。
- **spec ③（PiP カードに「＋」・既存タグのみ・orderTagsForSave・bookmark-updated 即反映）** → Task 5（帯）/ Task 6（配線）でカバー。
- **やらないこと（新規タグ作成なし／拡張全設定の引っ越しなし／第3段は次）** → 各 Task で既存のみ・パネルは入口ボタン止まり。
- **型整合**: `quickTagEnabled` / `pipActive`（save-message.ts）、`shouldSendQuickTag`（gate）、`PipTagStrip`/`PipCard`/`PipStack`/`PipCompanion` の props 名・`QuickTag` 型を全 Task で一貫使用。
- **不可視符号維持**: `booklage:*` メッセージ型・`booklage:quick-tag`・`DB_NAME` は不変更。
- **拡張 JS 構文**: Task 4 と Task 8 で `node --check` 必須（vitest/tsc 対象外の content.js/floating-button.js 対策）。
