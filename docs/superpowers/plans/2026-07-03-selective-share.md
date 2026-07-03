# 選択的シェア（SELECT CARDS）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有モーダルの SELECT CARDS から盤面選択モードに入り、選んだカード（最大100枚）だけを共有できるようにする。

**Architecture:** BoardRoot が選択 state（`selectMode` / `selectedIds` / 確定済み `shareSelectedIds`）を持ち、CardsLayer は既存 `receiverMode` と同型の「モード注入 prop」で tap＝選択トグルに切替。確定後は既存 `buildShareDataFromBoard` に選択集合を盤面順で渡し、プレビューは選択集合の skyline 再計算＋モーダルローカルスクロール。受け取り側は無変更。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-07-03-selective-share-design.md`

## Global Constraints

- TypeScript strict。`any` 禁止（`unknown`＋型ガード）。Return type 明示
- Tailwind 禁止。CSS は `.module.css`。z-index は `BOARD_Z_INDEX`（lib/board/constants.ts）に定数追加
- UI ラベルは英語直書き（SELECT CARDS / SELECTED / SELECT ALL / SHARE / CANCEL / 100 MAX）。i18n 15言語作業なし
- **default 盤面 byte-identical**: 選択モード外では新規 DOM を一切 mount しない
- 100 上限は `SHARE_LIMITS_V2.MAX_CARDS`（lib/share/types-v2.ts:111）を参照。マジックナンバー 100 を新規に書かない
- テスト実行は `rtk vitest run <path>`。**dev サーバー並走禁止**。既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）
- commit は `rtk git add <files> && rtk git commit -m "..."`。`--no-verify` 絶対禁止
- Write/Edit 後は独立 Read、commit 後は `rtk git log --stat -1` の実出力で確認（偽保存対策）
- 選択モード入口は TRASH（archive）表示中は出さない（BoardRoot 側で null を渡す）

---

### Task 1: 選択の純関数 `lib/share/selection.ts`

**Files:**
- Create: `lib/share/selection.ts`
- Test: `lib/share/selection.test.ts`

**Interfaces:**
- Consumes: `SHARE_LIMITS_V2.MAX_CARDS`（`lib/share/types-v2.ts`）
- Produces（後続 Task 2/5 が使う）:
  - `type SelectionToggleResult = { readonly ids: ReadonlySet<string>; readonly capped: boolean }`
  - `toggleSelection(ids: ReadonlySet<string>, bookmarkId: string, max?: number): SelectionToggleResult`
  - `addAllVisible(ids: ReadonlySet<string>, visibleIdsInBoardOrder: ReadonlyArray<string>, max?: number): SelectionToggleResult`
  - `selectedInBoardOrder<T extends { readonly bookmarkId: string }>(itemsInBoardOrder: ReadonlyArray<T>, ids: ReadonlySet<string>): T[]`

- [ ] **Step 1: 失敗するテストを書く**

`lib/share/selection.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { addAllVisible, selectedInBoardOrder, toggleSelection } from './selection'

const setOf = (...ids: string[]): ReadonlySet<string> => new Set(ids)

describe('toggleSelection', () => {
  it('adds an unselected id', () => {
    const r = toggleSelection(setOf(), 'a')
    expect([...r.ids]).toEqual(['a'])
    expect(r.capped).toBe(false)
  })

  it('removes a selected id', () => {
    const r = toggleSelection(setOf('a', 'b'), 'a')
    expect([...r.ids]).toEqual(['b'])
    expect(r.capped).toBe(false)
  })

  it('refuses to add past the cap and reports capped', () => {
    const full = new Set(Array.from({ length: 3 }, (_, i) => `id${i}`))
    const r = toggleSelection(full, 'newcomer', 3)
    expect(r.ids).toBe(full) // 参照そのまま = 変更なし
    expect(r.capped).toBe(true)
  })

  it('still allows REMOVING when at the cap', () => {
    const full = setOf('a', 'b', 'c')
    const r = toggleSelection(full, 'b', 3)
    expect([...r.ids]).toEqual(['a', 'c'])
    expect(r.capped).toBe(false)
  })

  it('does not mutate the input set', () => {
    const input = new Set(['a'])
    toggleSelection(input, 'b')
    expect([...input]).toEqual(['a'])
  })

  it('defaults max to SHARE_LIMITS_V2.MAX_CARDS (100)', () => {
    const full = new Set(Array.from({ length: 100 }, (_, i) => `id${i}`))
    expect(toggleSelection(full, 'x').capped).toBe(true)
    expect(toggleSelection(new Set(Array.from({ length: 99 }, (_, i) => `id${i}`)), 'x').capped).toBe(false)
  })
})

describe('addAllVisible', () => {
  it('adds all visible ids when under the cap', () => {
    const r = addAllVisible(setOf('z'), ['a', 'b'], 100)
    expect([...r.ids]).toEqual(['z', 'a', 'b'])
    expect(r.capped).toBe(false)
  })

  it('skips already-selected ids without double counting', () => {
    const r = addAllVisible(setOf('a'), ['a', 'b'], 2)
    expect([...r.ids]).toEqual(['a', 'b'])
    expect(r.capped).toBe(false)
  })

  it('fills up to the cap in visible (board) order then reports capped', () => {
    const r = addAllVisible(setOf(), ['a', 'b', 'c', 'd'], 2)
    expect([...r.ids]).toEqual(['a', 'b'])
    expect(r.capped).toBe(true)
  })

  it('reports capped=false when visible fits exactly', () => {
    const r = addAllVisible(setOf(), ['a', 'b'], 2)
    expect(r.capped).toBe(false)
  })
})

describe('selectedInBoardOrder', () => {
  it('returns items in board order regardless of set insertion order', () => {
    const items = [{ bookmarkId: 'new' }, { bookmarkId: 'mid' }, { bookmarkId: 'old' }]
    const ids = new Set(['old', 'new']) // クリック順 = old が先
    expect(selectedInBoardOrder(items, ids).map((i) => i.bookmarkId)).toEqual(['new', 'old'])
  })

  it('ignores ids not present in items', () => {
    const items = [{ bookmarkId: 'a' }]
    expect(selectedInBoardOrder(items, new Set(['a', 'ghost']))).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run lib/share/selection.test.ts`
Expected: FAIL（`./selection` が存在しない）

- [ ] **Step 3: 実装**

`lib/share/selection.ts`:

```typescript
// lib/share/selection.ts — selective-share (SELECT CARDS) の選択集合ロジック。
// UI から独立した純関数群。上限は共有ペイロードの MAX_CARDS と同じ値。
import { SHARE_LIMITS_V2 } from './types-v2'

export type SelectionToggleResult = {
  readonly ids: ReadonlySet<string>
  /** True when an add was refused (toggle) or truncated (addAll) by the cap. */
  readonly capped: boolean
}

export function toggleSelection(
  ids: ReadonlySet<string>,
  bookmarkId: string,
  max: number = SHARE_LIMITS_V2.MAX_CARDS,
): SelectionToggleResult {
  if (ids.has(bookmarkId)) {
    const next = new Set(ids)
    next.delete(bookmarkId)
    return { ids: next, capped: false }
  }
  if (ids.size >= max) return { ids, capped: true }
  const next = new Set(ids)
  next.add(bookmarkId)
  return { ids: next, capped: false }
}

export function addAllVisible(
  ids: ReadonlySet<string>,
  visibleIdsInBoardOrder: ReadonlyArray<string>,
  max: number = SHARE_LIMITS_V2.MAX_CARDS,
): SelectionToggleResult {
  const next = new Set(ids)
  let capped = false
  for (const id of visibleIdsInBoardOrder) {
    if (next.has(id)) continue
    if (next.size >= max) {
      capped = true
      break
    }
    next.add(id)
  }
  return { ids: next, capped }
}

/** 共有ペイロードは盤面順（新しい順）— クリック順ではない（spec §3）。 */
export function selectedInBoardOrder<T extends { readonly bookmarkId: string }>(
  itemsInBoardOrder: ReadonlyArray<T>,
  ids: ReadonlySet<string>,
): T[] {
  return itemsInBoardOrder.filter((it) => ids.has(it.bookmarkId))
}
```

- [ ] **Step 4: テスト green を確認**

Run: `rtk vitest run lib/share/selection.test.ts`
Expected: PASS（12 tests）

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/selection.ts lib/share/selection.test.ts
rtk git commit -m "feat(share): selection pure functions for selective share (toggle/cap/select-all/board-order)"
rtk git log --stat -1
```

---

### Task 2: 下部固定バー `ShareSelectBar`

**Files:**
- Create: `components/board/ShareSelectBar.tsx`
- Create: `components/board/ShareSelectBar.module.css`
- Modify: `lib/board/constants.ts`（`BOARD_Z_INDEX` に `SHARE_SELECT_BAR: 115` を追加 — TOOLBAR:110 の上・POPOVER:120 の下）
- Test: `components/board/ShareSelectBar.test.tsx`

**Interfaces:**
- Consumes: `BOARD_Z_INDEX`（lib/board/constants.ts）、`SHARE_LIMITS_V2.MAX_CARDS`
- Produces（Task 5 が mount する）:
  ```typescript
  type Props = {
    readonly count: number
    /** 単調増加。増えるたび琥珀 ⚠「100 MAX」pill を約1.6s 表示。0 は初期＝表示しない。 */
    readonly capFlashCycle: number
    readonly onSelectAll: () => void
    readonly onShare: () => void
    readonly onCancel: () => void
  }
  export function ShareSelectBar(props: Props): ReactElement
  ```

- [ ] **Step 1: 失敗するテストを書く**

`components/board/ShareSelectBar.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ShareSelectBar } from './ShareSelectBar'

const noop = (): void => {}
const baseProps = {
  count: 0,
  capFlashCycle: 0,
  onSelectAll: noop,
  onShare: noop,
  onCancel: noop,
}

describe('ShareSelectBar', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the counter with the shared cap', () => {
    render(<ShareSelectBar {...baseProps} count={7} />)
    expect(screen.getByText('7 / 100 SELECTED')).toBeTruthy()
  })

  it('disables SHARE at 0 and enables it with a count', () => {
    const { rerender } = render(<ShareSelectBar {...baseProps} count={0} />)
    expect((screen.getByTestId('select-share-button') as HTMLButtonElement).disabled).toBe(true)
    rerender(<ShareSelectBar {...baseProps} count={3} />)
    const btn = screen.getByTestId('select-share-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('SHARE (3)')
  })

  it('fires callbacks', () => {
    const onSelectAll = vi.fn()
    const onShare = vi.fn()
    const onCancel = vi.fn()
    render(<ShareSelectBar {...baseProps} count={1} onSelectAll={onSelectAll} onShare={onShare} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('select-all-button'))
    fireEvent.click(screen.getByTestId('select-share-button'))
    fireEvent.click(screen.getByTestId('select-cancel-button'))
    expect(onSelectAll).toHaveBeenCalledOnce()
    expect(onShare).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT show the cap pill on mount even with a stale non-zero cycle', () => {
    render(<ShareSelectBar {...baseProps} capFlashCycle={0} />)
    expect(screen.queryByText('100 MAX')).toBeNull()
  })

  it('flashes 100 MAX when capFlashCycle bumps, then hides after ~1.6s', () => {
    const { rerender } = render(<ShareSelectBar {...baseProps} capFlashCycle={0} />)
    rerender(<ShareSelectBar {...baseProps} capFlashCycle={1} />)
    expect(screen.getByText('100 MAX')).toBeTruthy()
    act((): void => { vi.advanceTimersByTime(1700) })
    expect(screen.queryByText('100 MAX')).toBeNull()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run components/board/ShareSelectBar.test.tsx`
Expected: FAIL（`./ShareSelectBar` が存在しない）

- [ ] **Step 3: `BOARD_Z_INDEX` に定数追加**

`lib/board/constants.ts` の `BOARD_Z_INDEX`（53行目〜）で `TOOLBAR: 110,` の直後に追加:

```typescript
  SHARE_SELECT_BAR: 115,  // selective-share bottom bar — above toolbar, below popovers
```

- [ ] **Step 4: 実装**

`components/board/ShareSelectBar.tsx`:

```tsx
'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { SHARE_LIMITS_V2 } from '@/lib/share/types-v2'
import styles from './ShareSelectBar.module.css'

type Props = {
  /** Currently selected card count. */
  readonly count: number
  /** Monotonic counter bumped by the parent whenever an add hits the cap.
   *  Each bump flashes the amber "100 MAX" pill for ~1.6s. 0 = initial
   *  (never flash on mount — the parent resets it when entering the mode). */
  readonly capFlashCycle: number
  /** Add every visible (filtered) card up to the cap, board order. */
  readonly onSelectAll: () => void
  /** Confirm the selection and reopen the share modal. Disabled at 0. */
  readonly onShare: () => void
  /** Leave selection mode and discard the selection. */
  readonly onCancel: () => void
}

const CAP_FLASH_MS = 1600

export function ShareSelectBar({ count, capFlashCycle, onSelectAll, onShare, onCancel }: Props): ReactElement {
  const [capVisible, setCapVisible] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    if (capFlashCycle === 0) return undefined
    setCapVisible(true)
    const t = setTimeout((): void => setCapVisible(false), CAP_FLASH_MS)
    return (): void => clearTimeout(t)
  }, [capFlashCycle])

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_SELECT_BAR }} role="toolbar" aria-label="Select cards to share">
      <div className={styles.bar}>
        <span className={styles.counter} data-testid="select-counter">
          {count} / {SHARE_LIMITS_V2.MAX_CARDS} SELECTED
        </span>
        {capVisible && <span className={styles.capPill}>100 MAX</span>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onSelectAll} data-testid="select-all-button">
            SELECT ALL
          </button>
          <button type="button" className={styles.primaryBtn} onClick={onShare} disabled={count === 0} data-testid="select-share-button">
            SHARE ({count})
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel} data-testid="select-cancel-button">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
```

`components/board/ShareSelectBar.module.css`（PasteSaveFeedback のガラス板 + 琥珀 pill と同じ語彙。クリックターゲットは 32px 以上）:

```css
/* ShareSelectBar — selective-share の下部固定バー。
 * ガラス板 = PasteSaveFeedback .panel と同系、琥珀 pill = 同 .pill と同系。 */

.root {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 24px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  /* z-index applied inline from BOARD_Z_INDEX.SHARE_SELECT_BAR */
}

.bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-radius: 16px;
  background: rgba(18, 18, 22, 0.88);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.40),
    0 1px 0 rgba(255, 255, 255, 0.05) inset;
}

.counter {
  font: 600 12px/1 var(--font-sans);
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.72);
  white-space: nowrap;
}

.capPill {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255, 176, 32, 0.15);
  border: 1px solid rgba(255, 176, 32, 0.35);
  box-shadow: 0 0 16px rgba(255, 176, 32, 0.20);
  font: 500 12px/1 var(--font-sans);
  color: #FFB020;
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.primaryBtn,
.secondaryBtn {
  min-height: 34px;
  padding: 0 18px;
  border-radius: 999px;
  font: 600 12px/1 var(--font-sans);
  letter-spacing: 0.08em;
  cursor: pointer;
  white-space: nowrap;
}

.primaryBtn {
  border: 1px solid rgba(40, 241, 0, 0.45);
  background: rgba(40, 241, 0, 0.14);
  color: #28F100;
  box-shadow: 0 0 14px rgba(40, 241, 0, 0.18);
}

.primaryBtn:disabled {
  opacity: 0.35;
  cursor: default;
  box-shadow: none;
}

.secondaryBtn {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.78);
}

.secondaryBtn:hover,
.primaryBtn:not(:disabled):hover {
  filter: brightness(1.2);
}
```

- [ ] **Step 5: テスト green を確認**

Run: `rtk vitest run components/board/ShareSelectBar.test.tsx`
Expected: PASS（5 tests）

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/ShareSelectBar.tsx components/board/ShareSelectBar.module.css components/board/ShareSelectBar.test.tsx lib/board/constants.ts
rtk git commit -m "feat(board): ShareSelectBar bottom bar for selective share (counter/select-all/share/cancel + amber cap pill)"
rtk git log --stat -1
```

---

### Task 3: CardsLayer 選択モード（tap トグル + chrome 抑止 + 選択バッジ）

**Files:**
- Modify: `components/board/CardsLayer.tsx`
  - Props 型（214-334行）に `selectionMode` 追加
  - pointerdown 分岐（1077-1081行）
  - tap ハンドラ追加（`handleReceiverPointerDown`＝972-1003行 の直後）
  - hover chrome の gate（1304-1311行 MediaTypeIndicator / 1317行〜 `!receiverMode` ブロック）
  - 選択バッジ overlay（wrapper 内、1167行 receiverMode overlay の直前）
- Modify: `components/board/CardsLayer.module.css`（バッジ/アウトライン追記）

**Interfaces:**
- Consumes: Task 1 の型は使わない（Set と callback を受けるだけ）
- Produces（Task 5 が渡す prop）:
  ```typescript
  readonly selectionMode?: {
    readonly selectedIds: ReadonlySet<string>
    readonly onToggle: (bookmarkId: string) => void
  } | null
  ```

**注**: CardsLayer は props が膨大で RTL 単体テストのコストが高い（既存も CardsLayer 本体のテストなし）。ロジックは Task 1 の純関数でカバー済み。この Task は tsc + 目視（Task 6 の実測）で検証する。

- [ ] **Step 1: Props 型に `selectionMode` を追加**

`CardsLayerProps`（`themeId` の宣言の直前、330行付近の `receiverMode` ブロックの後）に追加:

```typescript
  /** Selective-share selection mode (spec 2026-07-03). When set, a card tap
   *  toggles selection instead of opening the Lightbox; reorder drag, resize,
   *  hover chrome (+TAG, ×, ↺, play) are all suppressed. Selected cards render
   *  a green check badge + outline. Null/undefined = normal board (byte-identical). */
  readonly selectionMode?: {
    readonly selectedIds: ReadonlySet<string>
    readonly onToggle: (bookmarkId: string) => void
  } | null
```

関数シグネチャの分割代入（336-377行）に `selectionMode,` を追加（`receiverMode,` の隣）。

- [ ] **Step 2: tap ハンドラを追加**

`handleReceiverPointerDown`（972-1003行）の直後に、同じ tap-window パターンで追加（**コピーではなく onClick の代わりに onToggle を呼ぶ**。ロジック共通化は既存 receiver 実装に手を入れることになるので、今回は同型の並置にとどめる — 既存挙動を触らない）:

```tsx
  // Selective-share tap handler — same tap window as the receiver handler
  // (< CLICK_MAX_MS, < CLICK_THRESHOLD_PX): a genuine tap toggles selection;
  // a drag-ish gesture does nothing (no reorder in this mode). Pointer capture
  // mirrors the receiver handler so interrupted gestures tear down cleanly.
  const selectionToggle = selectionMode?.onToggle ?? null
  const handleSelectPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>, bookmarkId: string): void => {
      if (e.button > 0 || selectionToggle == null) return
      const el = e.currentTarget
      const pointerId = e.pointerId
      const startX = e.clientX
      const startY = e.clientY
      const startTime = e.timeStamp
      el.setPointerCapture?.(pointerId)
      const end = (ev: globalThis.PointerEvent): void => {
        el.removeEventListener('pointerup', end)
        el.removeEventListener('pointercancel', end)
        if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId)
        if (ev.type !== 'pointerup') return
        const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY)
        const elapsed = ev.timeStamp - startTime
        if (elapsed < CLICK_MAX_MS && distance < CLICK_THRESHOLD_PX) selectionToggle(bookmarkId)
      }
      el.addEventListener('pointerup', end)
      el.addEventListener('pointercancel', end)
    },
    [selectionToggle],
  )
```

- [ ] **Step 3: pointerdown 分岐に組み込む**

1077-1081行の分岐を変更:

```tsx
            onPointerDown={(e: PointerEvent<HTMLDivElement>): void =>
              selectionMode
                ? handleSelectPointerDown(e, it.bookmarkId)
                : receiverMode
                  ? handleReceiverPointerDown(e, it.bookmarkId)
                  : handleReorderPointerDown(e, it.bookmarkId)
            }
```

- [ ] **Step 4: hover chrome を gate**

以下の 2 箇所に `!selectionMode` 条件を足す:

(a) `MediaTypeIndicator`（1304-1311行）— 再生トグルボタンを出さない:

```tsx
            {canPlayInline(it) && (
              <MediaTypeIndicator
                type={deriveMediaType(it)}
                visible={hoverActive && !selectionMode}
                onActivate={(): void => onToggleAudio(it.bookmarkId)}
                active={audioActiveId === it.bookmarkId}
              />
            )}
```

(b) `!receiverMode` ブロック（1317行〜。CardCornerActions / ResizeHandle / +TAG 等の編集 chrome 一式）:

```tsx
            {!receiverMode && !selectionMode && (
```

（このブロックの閉じ側は変更不要。ブロック全体が mount されなくなるだけ）

- [ ] **Step 5: 選択バッジ overlay を追加**

receiverMode overlay（1167行 `{receiverMode && (() => {`）の**直前**に追加:

```tsx
            {selectionMode && (
              <div
                className={styles.selectOverlay}
                data-selected={selectionMode.selectedIds.has(it.bookmarkId) ? 'true' : 'false'}
                aria-hidden="true"
              >
                <span className={styles.selectCheck}>✓</span>
              </div>
            )}
```

`components/board/CardsLayer.module.css` の末尾に追記:

```css
/* Selective-share selection overlay — green check badge + outline on the
 * selected card (pill vocabulary: ✓ green #28F100). pointer-events:none so
 * the wrapper's tap handler still receives the gesture. */
.selectOverlay {
  position: absolute;
  inset: 0;
  border-radius: var(--card-radius, 20px);
  pointer-events: none;
  z-index: 55; /* above card media overlays (10) & control bar (60 is fine to sit under) */
}

.selectOverlay[data-selected='true'] {
  outline: 2px solid #28F100;
  outline-offset: -2px;
  box-shadow: 0 0 14px rgba(40, 241, 0, 0.28);
}

.selectCheck {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: none;
  align-items: center;
  justify-content: center;
  background: #28F100;
  color: #0a0a0a;
  font: 700 14px/1 var(--font-sans);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45), 0 0 10px rgba(40, 241, 0, 0.5);
}

.selectOverlay[data-selected='true'] .selectCheck {
  display: flex;
}
```

**注意**: CardsLayer.module.css の import 名（`styles`）は既存の `styles.receiverOverlay` と同じファイル。別名の場合は実ファイル冒頭の import を確認して合わせる。

- [ ] **Step 6: tsc + 既存テストが壊れていないことを確認**

Run: `rtk tsc && rtk vitest run tests/components/board`
Expected: tsc エラー 0、既存テスト PASS

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/CardsLayer.tsx components/board/CardsLayer.module.css
rtk git commit -m "feat(board): CardsLayer selection mode — tap toggles selection, chrome suppressed, green check badge"
rtk git log --stat -1
```

---

### Task 4: SenderShareModal に SELECT CARDS ボタン

**Files:**
- Modify: `components/share/SenderShareModal.tsx`（Props 18-54行 / hint 206-208行 / actions idle 分岐 245-252行）
- Test: `components/share/SenderShareModal.test.tsx`（既存ファイルにケース追加）

**Interfaces:**
- Produces（Task 5 が渡す props）:
  ```typescript
  /** SELECT CARDS entry. Null hides the button (= archive/trash view). */
  readonly onSelectCards?: (() => void) | null
  /** True when previewing a confirmed selection (changes the hint copy). */
  readonly selectionActive?: boolean
  ```

- [ ] **Step 1: 失敗するテストを書く**

`components/share/SenderShareModal.test.tsx` の既存 describe 内に追加（props の組み立ては既存テストのヘルパー/ベース props をそのまま流用する。ファイル冒頭を読んで倣うこと）:

```tsx
  it('shows SELECT CARDS in idle state and fires the callback', () => {
    const onSelectCards = vi.fn()
    render(<SenderShareModal {...baseProps} onSelectCards={onSelectCards} />)
    const btn = screen.getByTestId('select-cards-button')
    fireEvent.click(btn)
    expect(onSelectCards).toHaveBeenCalledOnce()
  })

  it('hides SELECT CARDS when the prop is null/undefined', () => {
    render(<SenderShareModal {...baseProps} onSelectCards={null} />)
    expect(screen.queryByTestId('select-cards-button')).toBeNull()
  })

  it('switches the hint copy while previewing a selection', () => {
    render(<SenderShareModal {...baseProps} selectionActive />)
    expect(screen.getByText(/SELECTED CARDS ONLY/)).toBeTruthy()
  })
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run components/share/SenderShareModal.test.tsx`
Expected: FAIL（新規 3 ケースのみ。既存ケースは PASS のまま）

- [ ] **Step 3: 実装**

(a) Props 型（53行 `custom` の後）に追加:

```typescript
  /** Selective share entry — renders a SELECT CARDS button in the idle state.
   *  Pressing it is expected to close this modal and enter board selection
   *  mode (parent-owned). Null/undefined hides the button (archive view). */
  readonly onSelectCards?: (() => void) | null
  /** True when this modal is previewing a confirmed manual selection. */
  readonly selectionActive?: boolean
```

分割代入（56-74行）に `onSelectCards = null,` と `selectionActive = false,` を追加。

(b) hint（206-208行）を差し替え:

```tsx
        <p className={styles.hint}>
          {selectionActive
            ? 'SELECTED CARDS ONLY · PRESS SHARE NOW WHEN READY'
            : 'SCROLL TO POSITION · PRESS SHARE NOW WHEN READY'}
        </p>
```

(c) actions の idle 分岐（245-252行の `) : (` ブロック）を差し替え — SHARE NOW の後に SELECT CARDS を置く:

```tsx
          ) : (
            <>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={state.kind === 'capturing'}
                onClick={handleShareConfirm}
              >{state.kind === 'capturing' ? 'CAPTURING…' : 'SHARE NOW'}</button>
              {onSelectCards && state.kind === 'idle' && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={onSelectCards}
                  data-testid="select-cards-button"
                >SELECT CARDS</button>
              )}
            </>
          )}
```

- [ ] **Step 4: テスト green を確認**

Run: `rtk vitest run components/share/SenderShareModal.test.tsx`
Expected: PASS（既存＋新規 3）

- [ ] **Step 5: Commit**

```bash
rtk git add components/share/SenderShareModal.tsx components/share/SenderShareModal.test.tsx
rtk git commit -m "feat(share): SELECT CARDS entry + selection hint in SenderShareModal"
rtk git log --stat -1
```

---

### Task 5: BoardRoot 配線（state・Esc・payload/preview 分岐・bar mount）

**Files:**
- Modify: `components/board/BoardRoot.tsx`
  - import 追加
  - state 追加（366行 `shareModalOpen` 付近）
  - ハンドラ群＋Esc effect＋選択レイアウト（`buildShareData`＝1828行 の手前に配置）
  - `buildShareData` 分岐（1828-1861行）
  - SHARE ChromeButton の selectMode ガード（2277行）
  - `<CardsLayer>` に prop 追加（2400行〜）
  - `<SenderShareModal>` props 分岐（2540-2576行）
  - `<ShareSelectBar>` mount（2629行 `<PasteSaveFeedback>` の隣）

**Interfaces:**
- Consumes: Task 1 `toggleSelection/addAllVisible/selectedInBoardOrder`、Task 2 `ShareSelectBar`、Task 3 `selectionMode` prop、Task 4 `onSelectCards/selectionActive` props
- 既存の内部変数: `items`（live bookmarks・盤面順）/ `lightboxNavItems` / `customWidths` / `cardWidthPx` / `cardGapPx` / `effectiveLayoutWidth` / `viewport` / `shareLayout` / `contentBounds` / `matchedBookmarkIds` / `activeFilter` / `BOARD_TOP_PAD_PX` / `itemSkylineHeight` / `computeSkylineLayout` / `SkylineCard`

- [ ] **Step 1: import 追加**

```typescript
import { addAllVisible, selectedInBoardOrder, toggleSelection } from '@/lib/share/selection'
import { ShareSelectBar } from '@/components/board/ShareSelectBar'
```

（`computeSkylineLayout` / `SkylineCard` / `itemSkylineHeight` は既に import 済み — 4行目ほか）

- [ ] **Step 2: state 追加**

366行 `shareModalOpen` の直後:

```typescript
  // Selective share (spec 2026-07-03). selectMode = the board is in
  // tap-to-select mode; selectedIds = the working selection while in the mode;
  // shareSelectedIds = the CONFIRMED selection the share modal previews
  // (null = normal newest-100 share). selectionScrollY = the modal preview's
  // local scroll for a selection (the bg board scroll is meaningless there).
  const [selectMode, setSelectMode] = useState<boolean>(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [capFlashCycle, setCapFlashCycle] = useState<number>(0)
  const [shareSelectedIds, setShareSelectedIds] = useState<ReadonlySet<string> | null>(null)
  const [selectionScrollY, setSelectionScrollY] = useState<number>(0)
```

- [ ] **Step 3: 選択レイアウト＋ハンドラ群を追加**

`buildShareData`（1828行）の**直前**に追加:

```typescript
  // ---- Selective share ------------------------------------------------
  // Payload/preview items resolve against `items` (live bookmarks, orderIndex
  // DESC) so the shared set is board-ordered, not click-ordered. Ids selected
  // under a different tag filter still resolve here (selection survives
  // filter switches; spec §2).
  const shareSelectedItems = useMemo(
    () => (shareSelectedIds == null ? null : selectedInBoardOrder(items, shareSelectedIds)),
    [items, shareSelectedIds],
  )

  // Compact skyline of ONLY the selected cards — the same reflow the receiver
  // reconstructs, so the preview shows what they will actually see (spec §3).
  const selectionLayout = useMemo(() => {
    if (shareSelectedItems == null) return null
    const cards: SkylineCard[] = shareSelectedItems.map((it) => {
      const w = customWidths[it.bookmarkId] ?? cardWidthPx
      return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
    })
    return computeSkylineLayout({ cards, containerWidth: effectiveLayoutWidth, gap: cardGapPx })
  }, [shareSelectedItems, customWidths, cardWidthPx, effectiveLayoutWidth, cardGapPx])

  const selectionContentHeight =
    selectionLayout == null ? 0 : selectionLayout.totalHeight + BOARD_TOP_PAD_PX

  const handleEnterSelectMode = useCallback((): void => {
    setShareModalOpen(false)
    setShareSelectedIds(null)
    setSelectedIds(new Set())
    setCapFlashCycle(0) // stale cycle would flash the pill on bar mount
    setSelectMode(true)
  }, [])

  const handleSelectToggle = useCallback(
    (bookmarkId: string): void => {
      const r = toggleSelection(selectedIds, bookmarkId)
      if (r.capped) {
        setCapFlashCycle((c) => c + 1)
        return
      }
      setSelectedIds(r.ids)
    },
    [selectedIds],
  )

  const handleSelectAll = useCallback((): void => {
    const r = addAllVisible(selectedIds, lightboxNavItems.map((it) => it.bookmarkId))
    if (r.capped) setCapFlashCycle((c) => c + 1)
    setSelectedIds(r.ids)
  }, [selectedIds, lightboxNavItems])

  const handleSelectCancel = useCallback((): void => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const handleSelectShare = useCallback((): void => {
    if (selectedIds.size === 0) return
    setSelectMode(false)
    setShareSelectedIds(selectedIds)
    setSelectionScrollY(0)
    setShareModalOpen(true)
  }, [selectedIds])

  // Esc leaves selection mode (= CANCEL). The share modal is closed while the
  // mode is active, so this never fights the modal's own Esc handler.
  useEffect((): (() => void) | undefined => {
    if (!selectMode) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleSelectCancel()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [selectMode, handleSelectCancel])

  // Local preview pan for a selection share — clamped to the selection's own
  // content height; the bg board's viewport is not touched.
  const handleSelectionPanY = useCallback(
    (dy: number): void => {
      const maxY = Math.max(0, selectionContentHeight - viewport.h)
      setSelectionScrollY((y) => Math.min(Math.max(y + dy, 0), maxY))
    },
    [selectionContentHeight, viewport.h],
  )
  // ---- /Selective share -----------------------------------------------
```

- [ ] **Step 4: `buildShareData` を分岐**

1828-1861行の `buildShareData` を変更（`items:` の source と `filter:` の 2 点＋deps）:

```typescript
  const buildShareData = useCallback((): ShareDataV2 => {
    // Selection share sends the confirmed manual set (board order); normal
    // share keeps the existing visible-set behaviour.
    const source = shareSelectedItems ?? lightboxNavItems
    return buildShareDataFromBoard({
      items: source.map((it) => ({
        bookmarkId: it.bookmarkId,
        url: it.url,
        title: it.title,
        description: it.description ?? undefined,
        thumbnail: it.thumbnail ?? undefined,
        aspectRatio: it.aspectRatio,
        tags: it.tags,
        cardWidth: customWidths[it.bookmarkId] ?? cardWidthPx,
      })),
      tags: tags.map((tg) => ({ id: tg.id, name: tg.name, color: tg.color })),
      // A manual selection is independent of the tag filter — no filter strip
      // on the receiver (spec §3).
      filter: shareSelectedItems == null && activeFilter.kind === 'tags'
        ? { mode: activeFilter.mode, tagIds: activeFilter.tagIds }
        : null,
      now: Date.now(),
      themeId,
      custom: resolvedCustom ?? undefined,
      gap: cardGapPx,
      defaultWidth: cardWidthPx,
    })
  }, [shareSelectedItems, lightboxNavItems, tags, activeFilter, customWidths, cardWidthPx, cardGapPx, themeId, resolvedCustom])
```

（既存のコメントは残してよい。`isTagsFilter(activeFilter)` を使っている場合はその形を維持して `shareSelectedItems == null &&` を前置するだけでもよい — 実ファイルの現行コードに合わせる）

- [ ] **Step 5: SHARE ChromeButton を selectMode ガード**

2277行:

```tsx
                onClick={(): void => { if (!selectMode) setShareModalOpen(true) }}
```

- [ ] **Step 6: CardsLayer に prop**

2400行 `<CardsLayer` の props に追加:

```tsx
                selectionMode={selectMode ? { selectedIds, onToggle: handleSelectToggle } : null}
```

- [ ] **Step 7: SenderShareModal props を分岐**

2540-2576行を変更。分岐が読めるように直前でローカル変数を作ってよい:

```tsx
      <SenderShareModal
        open={shareModalOpen}
        onClose={(): void => {
          setShareModalOpen(false)
          setShareSelectedIds(null) // selection is one-shot — discard on close (spec §1)
        }}
        getShareData={buildShareData}
        themeId={themeId}
        custom={resolvedCustom}
        totalBoardCount={(shareSelectedItems ?? lightboxNavItems).length}
        scrollY={shareSelectedItems != null ? selectionScrollY : viewport.y}
        contentHeight={shareSelectedItems != null
          ? selectionContentHeight
          : matchedBookmarkIds == null
            ? contentBounds.height
            : shareLayout.totalHeight + BOARD_TOP_PAD_PX}
        viewportHeight={viewport.h}
        activeTagNames={shareSelectedItems != null || !isTagsFilter(activeFilter)
          ? []
          : activeFilter.tagIds.flatMap((id): string[] => {
              const tag = tags.find((t) => t.id === id)
              return tag ? [tag.name] : []
            })}
        onPanY={shareSelectedItems != null
          ? handleSelectionPanY
          : (dy: number): void => { handlePanY(dy) }}
        items={(shareSelectedItems ?? lightboxNavItems).map((it): MirrorItem => ({
          id: it.bookmarkId,
          url: it.url,
          title: it.title,
          thumbnailUrl: it.thumbnail ?? null,
        }))}
        positions={Object.entries(
          shareSelectedItems != null && selectionLayout != null
            ? selectionLayout.positions
            : shareLayout.positions,
        ).map(([id, p]): MirrorPosition => ({ id, x: p.x, y: p.y, w: p.w, h: p.h }))}
        bgViewportWidth={effectiveLayoutWidth}
        bgCanvasWidth={viewport.w}
        bgTypoEnabled={bgTypoEnabled}
        bgTypoText={deriveBoardBgTypoText(activeFilter, tags)}
        onSelectCards={activeFilter.kind === 'archive' ? null : handleEnterSelectMode}
        selectionActive={shareSelectedItems != null}
      />
```

- [ ] **Step 8: ShareSelectBar を mount**

2629行 `<PasteSaveFeedback ... />` の直後に追加:

```tsx
      {selectMode && (
        <ShareSelectBar
          count={selectedIds.size}
          capFlashCycle={capFlashCycle}
          onSelectAll={handleSelectAll}
          onShare={handleSelectShare}
          onCancel={handleSelectCancel}
        />
      )}
```

- [ ] **Step 9: tsc + 全テスト**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 エラー、全テスト PASS（`tests/lib/channel.test.ts` フレークは再実行）

- [ ] **Step 10: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): wire selective share — selection state, Esc, payload/preview branch, ShareSelectBar mount"
rtk git log --stat -1
```

---

### Task 6: 検証・デプロイ・実測

**Files:** なし（検証のみ。必要なら修正 commit）

- [ ] **Step 1: フルビルド**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: 全部 green、`out/` 生成（`pnpm build` は static export — `rtk next build` で代用しない）

- [ ] **Step 2: dev サーバーで一連の流れを目視/Playwright**

dev サーバー起動（vitest と並走しない）→ 確認項目:

1. SHARE → モーダルに SELECT CARDS が出る（TRASH 表示では出ない）
2. SELECT CARDS → モーダルが閉じ、下部バー出現（`0 / 100 SELECTED`・SHARE disabled）
3. カードクリックで ✓ バッジ＋緑アウトライン、再クリックで解除。Lightbox が開かないこと・ドラッグ並べ替えが起きないこと・hover の ×/↺/+TAG/再生ボタンが出ないこと
4. タグ絞り込みを切り替えても選択が維持される
5. SELECT ALL で可視集合が追加される。100 到達で琥珀「100 MAX」pill
6. Esc / CANCEL で通常盤面へ（選択破棄）
7. SHARE (n) → モーダルが選択カードだけの詰め直しプレビューで開く。ホイールでプレビューだけがスクロール（背後の盤面は動かない）
8. SHARE NOW → リンク発行 → `/s/<id>` を開いて選択カードだけが並ぶ
9. 選択モードに入らない通常 SHARE が従来どおり動く（回帰確認）

注: 盤面カードの実クリックは Playwright 合成ポインタで不安定な既知事情（reorder の pointer capture 起因）。選択モードは reorder を通らないので動く可能性が高いが、ダメなら目視で確認し、その旨を記録する。

- [ ] **Step 3: デプロイ**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 4: 本番実測**

`https://allmarks.app` をハードリロード → Step 2 の 1/2/3/7/8/9 を本番で再確認（特に 8 = 受け取りリンク）。

- [ ] **Step 5: セッション記録**

- `docs/TODO.md` 現在の状態を更新、`docs/TODO_COMPLETED.md` に narrative 追記、`docs/CURRENT_GOAL.md` を次セッション用に上書き
- commit + push

---

## Self-Review 済メモ

- spec §1〜§6 全要件にタスク対応あり（§2 バッジ=T3、バー=T2、上限⚠=T1+T2、§3 payload/preview=T5、SELECT CARDS=T4、archive ガード=T5 Step 7）
- 型整合: `SelectionToggleResult`（T1）→ BoardRoot ハンドラ（T5）、`selectionMode` prop 形（T3）＝ T5 Step 6 の渡し形、`onSelectCards`/`selectionActive`（T4）＝ T5 Step 7 の渡し形
- BoardRoot の行番号は 2026-07-03 時点の実測。編集時は前後のコードで照合すること（行ズレ許容）
