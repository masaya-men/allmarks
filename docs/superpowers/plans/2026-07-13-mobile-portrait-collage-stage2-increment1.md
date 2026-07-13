# スマホ縦4:5コラージュ 段階2・第1弾 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホの SHARE コラージュ編集（縦4:5・段階1 の上）に「業界水準の編集道具の核」を載せる＝選択時ツールバー（前面/背面・削除）＋重なり順の純関数＋取り消し/やり直し（1操作=1手）＋余白ダブルタップで整列。

**Architecture:** 純関数（重なり順・削除・履歴スナップショット）を新規モジュールに切り出し、上部バー `MobileArrangeTopBar`（撮影に写さないグラス）を追加、BoardRoot が編集 state（`collagePositions`/`collageOrder`/`collageRotations`）に対して配線する。連続ジェスチャ（1本指移動・2本指ピンチ）の開始/終了で「変更前スナップショットを差分ありなら1回だけ積む」。離散操作（前面/背面/削除）は即時に積む。ボードズーム（ダブルタップ整列含む）は `stageTransform` のみ変更＝撮影に無影響。全てモバイル経路のみ、デスクトップ（>640px）はバイト同一。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright

**設計書（正本）:** `docs/superpowers/specs/2026-07-13-mobile-portrait-collage-stage2-increment1-design.md`

## Global Constraints

- TS `strict`。`any` 禁止。return type 明示。CSS は `.module.css`。**z-index は `BOARD_Z_INDEX`**（本計画で `SHARE_ARRANGE_TOOLBAR` を追加）。
- **デスクトップ（>640px）はバイト同一**: 追加は全て `isMobile` のモバイル経路。新 prop は `isMobile ? x : undefined`。`MobileArrangeTopBar` はモバイル arrange のみマウント。desktop の `ShareToast`/`handleCreateHostedShare`/dom-to-image は無改変。
- **撮影は編集 state から再描画**: 削除は3マップから実際に除く（撮影にも写らない）。取り消し/やり直しは編集 state を差し替え（撮影は現在 state を反映）。**ボードズーム（ダブルタップ整列）は `stageTransform` のみ＝画像に無影響**。`renderCollageCanvasToJpeg` 本体・共有サーバー・OG route・payload は無改変。
- チロムは `data-no-capture`（既存の hide 機構を流用）。
- UI 文言は乾いた・世界共通で伝わる英語リテラル（i18n キーにしない）。
- git `rtk` 前置。`--no-verify` 禁止。ASCII commit body。**vitest は素の `npx vitest run <file>`**、**Playwright も素の `npx playwright test`**（`rtk npx` は壊れる）。

## File Structure

- Create `lib/share/collage-layer-order.ts`（＋ test）— `sendToBack` 純関数。
- Create `lib/share/collage-remove.ts`（＋ test）— `removeFromCollage` 純関数。
- Create `lib/share/collage-history.ts`（＋ test）— `CollageSnapshot`/`snapshotsEqual`/`pushSnapshot`/`MAX_COLLAGE_HISTORY`。
- Modify `lib/board/constants.ts` — `BOARD_Z_INDEX.SHARE_ARRANGE_TOOLBAR` 追加。
- Create `components/board/MobileArrangeTopBar.tsx` ＋ `.module.css`（＋ test）— 上部バー。
- Modify `components/board/CollageCanvas.tsx` — 任意 prop `onEditGestureStart?`/`onEditGestureEnd?`（`bindPointerGesture` に `onEnd?` 追加）。
- Modify `components/board/MobileArrangeGestures.tsx` — 任意 prop `onSelectedPinchEnd?`/`onDoubleTapFit?` ＋余白ダブルタップ検知。
- Modify `components/board/BoardRoot.tsx` — 履歴 state/ref・各ハンドラ・上部バーのマウント・新 prop 配線。
- Modify `tests/e2e/mobile-share.spec.ts` — 選択ツール表示・削除・取り消し/やり直し・ダブルタップ整列。

---

### Task 1: `collage-layer-order.ts` — 最背面へ 【cheap 可】

**Files:**
- Create: `lib/share/collage-layer-order.ts`
- Test: `lib/share/collage-layer-order.test.ts`

**Interfaces:**
- Produces: `export function sendToBack(order: readonly string[], id: string): string[]`（`bringToFront`（既存 `collage-layout.ts`）の対称）。

- [ ] **Step 1: Write the failing test**

`lib/share/collage-layer-order.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sendToBack } from './collage-layer-order'

describe('sendToBack', () => {
  it('moves the id to the front of the array (= back of the z-order)', () => {
    expect(sendToBack(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b'])
  })
  it('keeps ordering when the id is already first', () => {
    expect(sendToBack(['a', 'b', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  })
  it('returns a copy (not the same reference) for a known id', () => {
    const order = ['a', 'b']
    const out = sendToBack(order, 'b')
    expect(out).toEqual(['b', 'a'])
    expect(out).not.toBe(order)
  })
  it('returns a copy for an unknown id without changing order', () => {
    expect(sendToBack(['a', 'b'], 'z')).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/share/collage-layer-order.test.ts
```

Expected: FAIL — module が存在しない。

- [ ] **Step 3: Implement**

`lib/share/collage-layer-order.ts`:

```ts
/** 重なり順配列で id を最背面（先頭）へ。未知 id は複製を返す（bringToFront の対称）。
 *  末尾＝最前面の規約（CollageCanvas）に合わせ、先頭＝最背面。 */
export function sendToBack(order: readonly string[], id: string): string[] {
  if (!order.includes(id)) return [...order]
  return [id, ...order.filter((x) => x !== id)]
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run lib/share/collage-layer-order.test.ts
rtk git add lib/share/collage-layer-order.ts lib/share/collage-layer-order.test.ts
rtk git commit -m "feat(share): sendToBack layer-order helper (collage stage 2)"
```

---

### Task 2: `collage-remove.ts` — 3マップから削除 【cheap 可】

**Files:**
- Create: `lib/share/collage-remove.ts`
- Test: `lib/share/collage-remove.test.ts`

**Interfaces:**
- Consumes: `CollagePositions`（`@/lib/share/collage-layout`）、`CardPosition`（`@/lib/board/types`）。
- Produces: `export function removeFromCollage(positions, order, rotations, id): { positions: CollagePositions; order: string[]; rotations: Record<string, number> }`。

- [ ] **Step 1: Write the failing test**

`lib/share/collage-remove.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { removeFromCollage } from './collage-remove'

const positions = { a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 5, y: 5, w: 20, h: 20 } }
const order = ['a', 'b']
const rotations = { a: 0, b: 15 }

describe('removeFromCollage', () => {
  it('removes the id from all three maps', () => {
    const r = removeFromCollage(positions, order, rotations, 'a')
    expect(r.positions).toEqual({ b: { x: 5, y: 5, w: 20, h: 20 } })
    expect(r.order).toEqual(['b'])
    expect(r.rotations).toEqual({ b: 15 })
  })
  it('does not mutate the inputs', () => {
    removeFromCollage(positions, order, rotations, 'a')
    expect(positions).toEqual({ a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 5, y: 5, w: 20, h: 20 } })
    expect(order).toEqual(['a', 'b'])
    expect(rotations).toEqual({ a: 0, b: 15 })
  })
  it('is a value no-op for an unknown id', () => {
    const r = removeFromCollage(positions, order, rotations, 'z')
    expect(r.positions).toEqual(positions)
    expect(r.order).toEqual(order)
    expect(r.rotations).toEqual(rotations)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/share/collage-remove.test.ts
```

Expected: FAIL — module が存在しない。

- [ ] **Step 3: Implement**

`lib/share/collage-remove.ts`:

```ts
import type { CardPosition } from '@/lib/board/types'
import type { CollagePositions } from './collage-layout'

/** コラージュの3マップ（位置・重なり順・回転）から id を除いた新オブジェクトを返す。
 *  元は変えない。order から消えるので撮影対象からも外れる。未知 id は値の等しい新オブジェクト。 */
export function removeFromCollage(
  positions: CollagePositions,
  order: readonly string[],
  rotations: Readonly<Record<string, number>>,
  id: string,
): { positions: CollagePositions; order: string[]; rotations: Record<string, number> } {
  const nextPositions: Record<string, CardPosition> = {}
  for (const key of Object.keys(positions)) {
    if (key !== id) {
      const p = positions[key]
      if (p) nextPositions[key] = p
    }
  }
  const nextRotations: Record<string, number> = {}
  for (const key of Object.keys(rotations)) {
    if (key !== id) {
      const r = rotations[key]
      if (r !== undefined) nextRotations[key] = r
    }
  }
  return { positions: nextPositions, order: order.filter((x) => x !== id), rotations: nextRotations }
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run lib/share/collage-remove.test.ts
rtk git add lib/share/collage-remove.ts lib/share/collage-remove.test.ts
rtk git commit -m "feat(share): removeFromCollage helper (collage stage 2 delete)"
```

---

### Task 3: `collage-history.ts` — スナップショット履歴 【cheap 可】

**Files:**
- Create: `lib/share/collage-history.ts`
- Test: `lib/share/collage-history.test.ts`

**Interfaces:**
- Consumes: `CollagePositions`（`@/lib/share/collage-layout`）。
- Produces:
  - `export type CollageSnapshot = { readonly positions: CollagePositions; readonly order: readonly string[]; readonly rotations: Readonly<Record<string, number>> }`
  - `export const MAX_COLLAGE_HISTORY = 40`
  - `export function snapshotsEqual(a: CollageSnapshot, b: CollageSnapshot): boolean`
  - `export function pushSnapshot(stack: readonly CollageSnapshot[], snap: CollageSnapshot, max: number): CollageSnapshot[]`

- [ ] **Step 1: Write the failing test**

`lib/share/collage-history.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { snapshotsEqual, pushSnapshot, MAX_COLLAGE_HISTORY, type CollageSnapshot } from './collage-history'

const snap = (order: string[], x = 0): CollageSnapshot => ({
  positions: Object.fromEntries(order.map((id) => [id, { x, y: 0, w: 10, h: 10 }])),
  order,
  rotations: Object.fromEntries(order.map((id) => [id, 0])),
})

describe('snapshotsEqual', () => {
  it('is true for value-equal snapshots with different references', () => {
    expect(snapshotsEqual(snap(['a', 'b']), snap(['a', 'b']))).toBe(true)
  })
  it('is false when order differs', () => {
    expect(snapshotsEqual(snap(['a', 'b']), snap(['b', 'a']))).toBe(false)
  })
  it('is false when a position value differs', () => {
    expect(snapshotsEqual(snap(['a'], 0), snap(['a'], 5))).toBe(false)
  })
  it('is false when a card is removed', () => {
    expect(snapshotsEqual(snap(['a', 'b']), snap(['a']))).toBe(false)
  })
})

describe('pushSnapshot', () => {
  it('appends to the stack', () => {
    expect(pushSnapshot([], snap(['a']), MAX_COLLAGE_HISTORY)).toHaveLength(1)
  })
  it('drops the oldest when over max', () => {
    let stack: CollageSnapshot[] = []
    for (let i = 0; i < MAX_COLLAGE_HISTORY + 5; i++) stack = pushSnapshot(stack, snap([`c${i}`]), MAX_COLLAGE_HISTORY)
    expect(stack).toHaveLength(MAX_COLLAGE_HISTORY)
    expect(stack[0]?.order).toEqual(['c5'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/share/collage-history.test.ts
```

Expected: FAIL — module が存在しない。

- [ ] **Step 3: Implement**

`lib/share/collage-history.ts`:

```ts
import type { CollagePositions } from './collage-layout'

/** 編集 state のスナップショット（取り消し/やり直し用）。3マップの参照を保持する。
 *  state は毎編集ごとに新オブジェクトへ差し替わる（不変）ので参照保持で安全。 */
export type CollageSnapshot = {
  readonly positions: CollagePositions
  readonly order: readonly string[]
  readonly rotations: Readonly<Record<string, number>>
}

/** 履歴の上限（古いものから捨てる）。 */
export const MAX_COLLAGE_HISTORY = 40

/** 2つのスナップショットが「見た目上」等しいか（no-op を積まない判定）。
 *  order は順序含めて一致、positions/rotations は key 集合と各値の一致で比較。 */
export function snapshotsEqual(a: CollageSnapshot, b: CollageSnapshot): boolean {
  if (a === b) return true
  if (a.order.length !== b.order.length) return false
  for (let i = 0; i < a.order.length; i++) {
    if (a.order[i] !== b.order[i]) return false
  }
  const ka = Object.keys(a.positions)
  if (ka.length !== Object.keys(b.positions).length) return false
  for (const k of ka) {
    const va = a.positions[k]
    const vb = b.positions[k]
    if (!va || !vb) return false
    if (va.x !== vb.x || va.y !== vb.y || va.w !== vb.w || va.h !== vb.h) return false
  }
  const kra = Object.keys(a.rotations)
  if (kra.length !== Object.keys(b.rotations).length) return false
  for (const k of kra) {
    if (a.rotations[k] !== b.rotations[k]) return false
  }
  return true
}

/** stack に snap を積み、max を超えたら古いもの（先頭）から捨てた新配列を返す。 */
export function pushSnapshot(
  stack: readonly CollageSnapshot[],
  snap: CollageSnapshot,
  max: number,
): CollageSnapshot[] {
  const next = [...stack, snap]
  return next.length > max ? next.slice(next.length - max) : next
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run lib/share/collage-history.test.ts
rtk git add lib/share/collage-history.ts lib/share/collage-history.test.ts
rtk git commit -m "feat(share): collage snapshot history helpers (stage 2 undo/redo)"
```

---

### Task 4: `MobileArrangeTopBar` ＋ z-index 定数 【cheap 可（完全コード）】

**Files:**
- Modify: `lib/board/constants.ts`（`BOARD_Z_INDEX` に1行追加）
- Create: `components/board/MobileArrangeTopBar.tsx`
- Create: `components/board/MobileArrangeTopBar.module.css`
- Test: `components/board/MobileArrangeTopBar.test.tsx`

**Interfaces:**
- Produces: `export type MobileArrangeTopBarProps`、`export function MobileArrangeTopBar(props): ReactElement`。props = `canUndo`/`canRedo`/`onUndo`/`onRedo`/`hasSelection`/`onBringToFront`/`onSendToBack`/`onDelete`。testid = `mobile-arrange-topbar`/`-undo`/`-redo`/`-selection-tools`/`-to-front`/`-to-back`/`-delete`。

- [ ] **Step 1: z-index 定数を追加**

`lib/board/constants.ts` の `BOARD_Z_INDEX` 内、`SHARE_TOAST: 402,`（現行 L103）の直後に追加:

```ts
  SHARE_ARRANGE_TOOLBAR: 402,  // mobile collage arrange TOP bar (undo/redo + selection tools). Same tier as SHARE_TOAST (bottom bar) — they don't overlap (top vs bottom). data-no-capture.
```

- [ ] **Step 2: Write the failing test**

`components/board/MobileArrangeTopBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileArrangeTopBar } from './MobileArrangeTopBar'

const baseProps = {
  canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn(),
  hasSelection: false, onBringToFront: vi.fn(), onSendToBack: vi.fn(), onDelete: vi.fn(),
}

describe('MobileArrangeTopBar', () => {
  it('shows UNDO/REDO always and hides selection tools with no selection', () => {
    render(<MobileArrangeTopBar {...baseProps} />)
    expect(screen.getByTestId('mobile-arrange-undo')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-arrange-redo')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-arrange-selection-tools')).not.toBeInTheDocument()
  })
  it('disables UNDO/REDO per canUndo/canRedo', () => {
    render(<MobileArrangeTopBar {...baseProps} canUndo canRedo={false} />)
    expect(screen.getByTestId('mobile-arrange-undo')).toBeEnabled()
    expect(screen.getByTestId('mobile-arrange-redo')).toBeDisabled()
  })
  it('shows TO FRONT / TO BACK / DELETE when a card is selected and fires DELETE', () => {
    const onDelete = vi.fn()
    render(<MobileArrangeTopBar {...baseProps} hasSelection onDelete={onDelete} />)
    expect(screen.getByTestId('mobile-arrange-to-front')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-arrange-to-back')).toBeInTheDocument()
    screen.getByTestId('mobile-arrange-delete').click()
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run components/board/MobileArrangeTopBar.test.tsx
```

Expected: FAIL — module が存在しない。

- [ ] **Step 4: Implement component + CSS**

`components/board/MobileArrangeTopBar.tsx`:

```tsx
'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileArrangeTopBar.module.css'

export type MobileArrangeTopBarProps = {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onUndo: () => void
  readonly onRedo: () => void
  /** カードが選択されているか（前面/背面/削除を出すか）。 */
  readonly hasSelection: boolean
  readonly onBringToFront: () => void
  readonly onSendToBack: () => void
  readonly onDelete: () => void
}

/** スマホのコラージュ編集段の上部バー。常に UNDO/REDO、カード選択中は
 *  TO FRONT / TO BACK / DELETE を出す。data-no-capture で撮影に写らない。
 *  MobileArrangeBar と同じグラス素材。デスクトップにはマウントしない。 */
export function MobileArrangeTopBar(props: MobileArrangeTopBarProps): ReactElement {
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_ARRANGE_TOOLBAR }}
      data-no-capture
      data-testid="mobile-arrange-topbar"
    >
      <div className={styles.group}>
        <button type="button" className={styles.action} onClick={props.onUndo} disabled={!props.canUndo} data-testid="mobile-arrange-undo">
          UNDO
        </button>
        <button type="button" className={styles.action} onClick={props.onRedo} disabled={!props.canRedo} data-testid="mobile-arrange-redo">
          REDO
        </button>
      </div>
      {props.hasSelection && (
        <div className={styles.group} data-testid="mobile-arrange-selection-tools">
          <button type="button" className={styles.action} onClick={props.onBringToFront} data-testid="mobile-arrange-to-front">
            TO FRONT
          </button>
          <button type="button" className={styles.action} onClick={props.onSendToBack} data-testid="mobile-arrange-to-back">
            TO BACK
          </button>
          <button type="button" className={styles.danger} onClick={props.onDelete} data-testid="mobile-arrange-delete">
            DELETE
          </button>
        </div>
      )}
    </div>
  )
}
```

`components/board/MobileArrangeTopBar.module.css`:

```css
/* SHARE arrange stage TOP bar (mobile). Same glass as MobileArrangeBar /
   MobileShareResult. Holds UNDO/REDO always + TO FRONT/TO BACK/DELETE when a
   card is selected. data-no-capture so it never shows in the screenshot. */
.bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 12px 8px;
  background: rgba(9, 9, 11, 0.94);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px) saturate(1.1);
  -webkit-backdrop-filter: blur(20px) saturate(1.1);
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  animation: barDown 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes barDown {
  from { transform: translateY(-100%); }
  to { transform: none; }
}

.group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action,
.danger {
  min-height: 40px;
  padding: 0 12px;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms ease, opacity 200ms ease;
}

.action {
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.danger {
  color: #ff6a5e;
  background: rgba(255, 106, 94, 0.1);
  border: 1px solid rgba(255, 106, 94, 0.4);
}

.action:disabled {
  opacity: 0.35;
  cursor: default;
}

.action:active,
.danger:active {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .bar { animation: none; }
  .action, .danger { transition: none; }
  .action:active, .danger:active { transform: none; }
}
```

- [ ] **Step 5: Run to verify it passes → Commit**

```bash
npx vitest run components/board/MobileArrangeTopBar.test.tsx
rtk git add lib/board/constants.ts components/board/MobileArrangeTopBar.tsx components/board/MobileArrangeTopBar.module.css components/board/MobileArrangeTopBar.test.tsx
rtk git commit -m "feat(board): MobileArrangeTopBar (undo/redo + selection tools) + z-index (collage stage 2)"
```

---

### Task 5: ジェスチャの確定フック＋余白ダブルタップ 【Sonnet 推奨】

**Files:**
- Modify: `components/board/CollageCanvas.tsx`
- Modify: `components/board/MobileArrangeGestures.tsx`

**変更方針:** 連続ジェスチャの開始/終了と余白ダブルタップを親（BoardRoot）へ通知する任意フックを足す。**全て任意 prop＝未指定（デスクトップ）で挙動不変。** ここでは配線先は作らない（Task 6）。

**Interfaces:**
- Produces（CollageCanvas props 追加）: `onEditGestureStart?: (id: string) => void`、`onEditGestureEnd?: () => void`。
- Produces（MobileArrangeGestures props 追加）: `onSelectedPinchEnd?: () => void`、`onDoubleTapFit?: () => void`。

- [ ] **Step 1: CollageCanvas — `bindPointerGesture` に `onEnd?` を足し、移動経路にフックを通す**

1-1. `CollageCanvasProps` 型（`onSelect?`/`touchMode?` 等が並ぶ箇所）に2行追加:

```ts
  /** 1本指カード移動の開始（掴んだ id）。BoardRoot が履歴 pending を捕捉（モバイルのみ）。 */
  readonly onEditGestureStart?: (id: string) => void
  /** 1本指カード移動の終了（pointerup）。BoardRoot が差分ありなら履歴に積む（モバイルのみ）。 */
  readonly onEditGestureEnd?: () => void
```

1-2. `bindPointerGesture`（現行 L97-127）のシグネチャに `onEnd?` を足し、`up` teardown の最後で呼ぶ:

```ts
  function bindPointerGesture(
    el: HTMLDivElement,
    pointerId: number,
    onMove: (ev: globalThis.PointerEvent) => void,
    arbiter?: CollageGestureArbiter,
    onEnd?: () => void,
  ): void {
```

`up` の中、`arbiter?.clear()` の直後に:

```ts
      arbiter?.clear()
      onEnd?.()
```

1-3. `handleElementPointerDown`（現行 L129-151）で、`props.onGrab(id)` と `props.onSelect?.(id)` の**後**に開始フック、`bindPointerGesture` に終了フックを渡す（選択タップの自動前面化は履歴に含めない＝`onGrab` の後に pending を捕捉）:

```ts
    props.onGrab(id)
    props.onSelect?.(id)
    props.onEditGestureStart?.(id)
    const startX = e.clientX
```

`bindPointerGesture(...)` 呼び出しを:

```ts
    bindPointerGesture(
      el,
      e.pointerId,
      (ev) => {
        props.onMove(id, originX + (ev.clientX - startX) / scale, originY + (ev.clientY - startY) / scale)
      },
      props.gestureArbiter,
      props.onEditGestureEnd,
    )
```

（`handleRotatePointerDown` の `bindPointerGesture` 呼び出しは `onEnd` を渡さない＝回転ノブはデスクトップ専用なので不変。）

- [ ] **Step 2: MobileArrangeGestures — ピンチ終了通知＋余白ダブルタップ**

2-1. `MobileArrangeGesturesProps` に2つ追加（`onDeselect` の直後）:

```ts
  /** 選択カードのピンチ終了で1回（BoardRoot が履歴を確定）。 */
  readonly onSelectedPinchEnd?: () => void
  /** 余白のダブルタップで「整列」（ボードズームを1倍に戻す）。 */
  readonly onDoubleTapFit?: () => void
```

2-2. 余白ダブルタップ用の ref としきい値を足す（`single` ref 宣言の近く・`PAN_SLOP_PX` の近く）:

```ts
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP_PX = 24
```

`MobileArrangeGestures` 本体の他の `useRef` と並べて:

```ts
  const lastBlankTap = useRef<{ t: number; x: number; y: number } | null>(null)
```

2-3. `handlePointerEndCapture`（現行 L171-186）を、ピンチ終了通知＋ダブルタップ判定に更新:

```ts
  const handlePointerEndCapture = (e: PointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(e.pointerId)

    const p = pinch.current
    if (p !== null && (e.pointerId === p.idA || e.pointerId === p.idB)) {
      pinch.current = null
      e.stopPropagation()
      props.onSelectedPinchEnd?.()
      return
    }

    const s = single.current
    if (s !== null && e.pointerId === s.id) {
      if (!s.moved) {
        // 余白タップ: 1回目=選択解除、~300ms 内の近接2回目=整列（ダブルタップ）。
        const now = Date.now()
        const prev = lastBlankTap.current
        if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(s.startX - prev.x, s.startY - prev.y) < DOUBLE_TAP_SLOP_PX) {
          lastBlankTap.current = null
          props.onDoubleTapFit?.()
        } else {
          lastBlankTap.current = { t: now, x: s.startX, y: s.startY }
          props.onDeselect()
        }
      }
      single.current = null
    }
  }
```

（`Date.now()` はアプリ実行時に利用可。ピンチ終了の `onSelectedPinchEnd?.()` は `stopPropagation` の後・return の前に呼ぶ。）

- [ ] **Step 3: 型チェック → Commit**

```bash
rtk tsc
```

Expected: tsc 0（新 prop は任意なので既存呼び出しは無改変で通る）。既存の `MobileArrangeGestures.test.tsx` / `CollageCanvas.test.tsx` があれば流し、緑を確認:

```bash
npx vitest run components/board/MobileArrangeGestures.test.tsx components/board/CollageCanvas.test.tsx
```

```bash
rtk git add components/board/CollageCanvas.tsx components/board/MobileArrangeGestures.tsx
rtk git commit -m "feat(board): gesture commit hooks + blank double-tap for collage stage 2 (optional props, desktop unchanged)"
```

---

### Task 6: BoardRoot 配線（履歴・削除・重なり順・整列・上部バー） 【Sonnet 推奨】

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: Task 1 `sendToBack`、Task 2 `removeFromCollage`、Task 3 `CollageSnapshot`/`snapshotsEqual`/`pushSnapshot`/`MAX_COLLAGE_HISTORY`、Task 4 `MobileArrangeTopBar`、Task 5 の新 prop、既存 `bringToFront`/`IDENTITY_STAGE_TRANSFORM`/`handleSelectedPinchStart`/`handleMobileEnterArrange`。

- [ ] **Step 1: import**

`BoardRoot.tsx` 冒頭の import 群に追加（既存 `bringToFront` は `collage-layout` から既に import 済のはず＝重複させない）:

```ts
import { sendToBack } from '@/lib/share/collage-layer-order'
import { removeFromCollage } from '@/lib/share/collage-remove'
import { snapshotsEqual, pushSnapshot, MAX_COLLAGE_HISTORY, type CollageSnapshot } from '@/lib/share/collage-history'
import { MobileArrangeTopBar } from './MobileArrangeTopBar'
```

- [ ] **Step 2: 履歴 state / ref / 同期**

`selectedCollageId` などの近く（現行 L461-476 のコラージュ state 群）に追加:

```ts
  const [collageUndoStack, setCollageUndoStack] = useState<CollageSnapshot[]>([])
  const [collageRedoStack, setCollageRedoStack] = useState<CollageSnapshot[]>([])
  // 3マップの現在値（同期スナップショット捕捉用）。setState は非同期なので ref でミラー。
  const collageStateRef = useRef<CollageSnapshot>({ positions: {}, order: [], rotations: {} })
  // undo/redo スタックの ref ミラー（ハンドラ内で updater をネストしないため）。
  const collageUndoRef = useRef<CollageSnapshot[]>([])
  const collageRedoRef = useRef<CollageSnapshot[]>([])
  // 連続ジェスチャ開始時の「変更前」スナップショット（終了時に差分ありなら積む）。
  const pendingHistoryRef = useRef<CollageSnapshot | null>(null)
```

BoardRoot 内の他の `useEffect` と並べて（3マップとスタックのミラー同期）:

```ts
  useEffect(() => {
    collageStateRef.current = { positions: collagePositions, order: collageOrder, rotations: collageRotations }
  }, [collagePositions, collageOrder, collageRotations])
  useEffect(() => { collageUndoRef.current = collageUndoStack }, [collageUndoStack])
  useEffect(() => { collageRedoRef.current = collageRedoStack }, [collageRedoStack])
```

- [ ] **Step 3: 履歴ハンドラ**

コラージュ関連ハンドラの近くに追加（全て `useCallback`）:

```ts
  // 連続ジェスチャ開始: 変更前スナップショットを捕捉。移動は掴んだ id を最前面にした
  // 状態を「変更前」とする（選択タップの自動前面化は履歴に含めない）。ピンチは id なし。
  const handleCollageGestureStart = useCallback((reorderId?: string): void => {
    const s = collageStateRef.current
    pendingHistoryRef.current = {
      positions: s.positions,
      order: reorderId ? bringToFront(s.order, reorderId) : s.order,
      rotations: s.rotations,
    }
  }, [])

  // 連続ジェスチャ終了: 実際に変わっていれば pending を undo に積む・redo を空に。
  const handleCollageGestureEnd = useCallback((): void => {
    const before = pendingHistoryRef.current
    pendingHistoryRef.current = null
    if (!before) return
    if (snapshotsEqual(before, collageStateRef.current)) return
    setCollageUndoStack((s) => pushSnapshot(s, before, MAX_COLLAGE_HISTORY))
    setCollageRedoStack([])
  }, [])

  // 離散操作（前面/背面/削除）用: 実行の直前に現在状態を undo に積む・redo を空に。
  const pushHistoryBeforeDiscreteEdit = useCallback((): void => {
    setCollageUndoStack((s) => pushSnapshot(s, collageStateRef.current, MAX_COLLAGE_HISTORY))
    setCollageRedoStack([])
  }, [])

  const applyCollageSnapshot = useCallback((snap: CollageSnapshot): void => {
    setCollagePositions(snap.positions)
    setCollageOrder([...snap.order])
    setCollageRotations({ ...snap.rotations })
    setSelectedCollageId((cur) => (cur && !snap.order.includes(cur) ? null : cur))
  }, [])

  const handleCollageUndo = useCallback((): void => {
    const stack = collageUndoRef.current
    if (stack.length === 0) return
    const prev = stack[stack.length - 1]
    if (!prev) return
    setCollageRedoStack((r) => pushSnapshot(r, collageStateRef.current, MAX_COLLAGE_HISTORY))
    setCollageUndoStack(stack.slice(0, -1))
    applyCollageSnapshot(prev)
  }, [applyCollageSnapshot])

  const handleCollageRedo = useCallback((): void => {
    const stack = collageRedoRef.current
    if (stack.length === 0) return
    const next = stack[stack.length - 1]
    if (!next) return
    setCollageUndoStack((u) => pushSnapshot(u, collageStateRef.current, MAX_COLLAGE_HISTORY))
    setCollageRedoStack(stack.slice(0, -1))
    applyCollageSnapshot(next)
  }, [applyCollageSnapshot])
```

- [ ] **Step 4: 削除・重なり順・整列ハンドラ**

```ts
  const handleDeleteSelectedCollage = useCallback((): void => {
    const id = selectedCollageId
    if (!id) return
    pushHistoryBeforeDiscreteEdit()
    const s = collageStateRef.current
    const r = removeFromCollage(s.positions, s.order, s.rotations, id)
    setCollagePositions(r.positions)
    setCollageOrder(r.order)
    setCollageRotations(r.rotations)
    setSelectedCollageId(null)
  }, [selectedCollageId, pushHistoryBeforeDiscreteEdit])

  const handleBringSelectedToFront = useCallback((): void => {
    const id = selectedCollageId
    if (!id) return
    pushHistoryBeforeDiscreteEdit()
    setCollageOrder((o) => bringToFront(o, id))
  }, [selectedCollageId, pushHistoryBeforeDiscreteEdit])

  const handleSendSelectedToBack = useCallback((): void => {
    const id = selectedCollageId
    if (!id) return
    pushHistoryBeforeDiscreteEdit()
    setCollageOrder((o) => sendToBack(o, id))
  }, [selectedCollageId, pushHistoryBeforeDiscreteEdit])

  const handleDoubleTapFit = useCallback((): void => {
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
  }, [])
```

- [ ] **Step 5: ピンチ開始に履歴 pending を足す＋入場/退場でスタックを空に**

5-1. 既存 `handleSelectedPinchStart`（ピンチ開始で base をスナップショットする既存ハンドラ）の**先頭**に1行:

```ts
    handleCollageGestureStart()
```

（`handleSelectedPinchStart` の依存配列に `handleCollageGestureStart` を追加。`handleCollageGestureStart` は空依存の安定参照。）

5-2. `handleMobileEnterArrange`（現行 L2542-2570・帯確定と各 setState が並ぶ箇所）内の他リセットと並べて:

```ts
    setCollageUndoStack([])
    setCollageRedoStack([])
    pendingHistoryRef.current = null
```

5-3. コラージュ退場リセット（現行 L2276 付近＝`setCollagePositions({})` 等が並ぶ SHARE 退場処理）にも同じ3行を足す（残留履歴を持ち越さない）。

- [ ] **Step 6: 上部バーのマウント＋新 prop の配線**

6-1. `MobileArrangeGestures`（現行 L3743-3751）に Task 5 の新 prop を足す:

```tsx
          <MobileArrangeGestures
            enabled={isMobile}
            transform={stageTransform}
            onTransformChange={setStageTransform}
            selectedId={selectedCollageId}
            onSelectedPinchStart={handleSelectedPinchStart}
            onSelectedPinch={handleSelectedPinch}
            onSelectedPinchEnd={handleCollageGestureEnd}
            onDeselect={(): void => setSelectedCollageId(null)}
            onDoubleTapFit={handleDoubleTapFit}
          >
```

6-2. `CollageCanvas`（現行 L3770-3774 の mobile prop 群）に Task 5 のフックを足す:

```tsx
              onEditGestureStart={isMobile ? handleCollageGestureStart : undefined}
              onEditGestureEnd={isMobile ? handleCollageGestureEnd : undefined}
```

6-3. 上部バーを、下部 `MobileArrangeBar` と**同じ表示条件**（現行 L3783 `hostedShareUrl === null && shareCreateState !== 'error'`）でマウント。`<div data-no-capture>`（現行 L3780）の `isMobile ?` ブロック内、`MobileArrangeBar` の条件ブロックの直前に:

```tsx
                {hostedShareUrl === null && shareCreateState !== 'error' && (
                  <MobileArrangeTopBar
                    canUndo={collageUndoStack.length > 0}
                    canRedo={collageRedoStack.length > 0}
                    onUndo={handleCollageUndo}
                    onRedo={handleCollageRedo}
                    hasSelection={selectedCollageId !== null}
                    onBringToFront={handleBringSelectedToFront}
                    onSendToBack={handleSendSelectedToBack}
                    onDelete={handleDeleteSelectedCollage}
                  />
                )}
```

- [ ] **Step 7: 検証（型＋単体＋ビルド）→ Commit**

```bash
rtk tsc
npx vitest run
pnpm build
```

Expected: tsc 0 / vitest 緑 / build OK（`assert-share-template OK`）。デスクトップ経路は無改変（新 prop は `isMobile ? … : undefined`・上部バーは `isMobile` ブロック内）。

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): wire collage stage 2 editing chrome (undo/redo, front/back, delete, double-tap-fit)"
```

---

### Task 7: e2e ＋ 全体ゲート 【Sonnet 推奨】

**Files:**
- Modify: `tests/e2e/mobile-share.spec.ts`

**変更方針:** 縦4:5 前提はそのまま。段階2 第1弾の新規挙動を足す。**既存テストは不変**。到達（SHARE→全選択→ARRANGE）は既存ヘルパーに倣う（memory `reference_playwright_board_share_verify`）。カードのタップ選択は `.click()`（既存慣習）。

- [ ] **Step 1: 新規 e2e を追加**

`tests/e2e/mobile-share.spec.ts` の ARRANGE 到達後に対する新規テスト（既存の到達手順・seed を流用）:

1. **選択でツールが出る**: カードを1枚 `.click()` → `mobile-arrange-topbar` 内に `mobile-arrange-to-front`/`-to-back`/`-delete` が visible。未選択（余白タップ）で `mobile-arrange-selection-tools` が消える。
2. **削除**: カード数（`[data-testid^="collage-el-"]`）を取得 → 1枚選択 → `mobile-arrange-delete` → カード数が1減る・選択ツールが消える。
3. **取り消し/やり直し**: 削除後 `mobile-arrange-undo` → カード数が戻る。`mobile-arrange-redo` → 再び1減る。
4. **ダブルタップ整列**: スライダー or 2本指でズーム→`mobile-arrange-stage` の transform scale > 1 を確認 → 余白を素早く2回 `.click()`（`mobile-arrange-viewport` の空き領域、~300ms 内）→ scale が 1 に戻る。合成タップの二連が難しい場合は、`onDoubleTapFit` 相当の到達性を **スライダーを最小へ戻す代替 or `dispatchEvent` の2連 pointerup** で検証し、意図（整列でズームが1に戻る）を落とさない。
5. **デスクトップ不変**: 既存 "desktop SHARE — unchanged" テストに、`mobile-arrange-topbar` が**存在しない**ことを1行足す（`toHaveCount(0)`）。

- [ ] **Step 2: 実行**

```bash
npx playwright test tests/e2e/mobile-share.spec.ts
```

Expected: 全緑（既存＋新規）。`rtk npx` は使わない。tail は失敗リスト。

- [ ] **Step 3: Commit**

```bash
rtk git add tests/e2e/mobile-share.spec.ts
rtk git commit -m "test(e2e): collage stage 2 increment 1 (selection tools, delete, undo/redo, double-tap-fit)"
```

- [ ] **Step 4: 全体ゲート（コントローラが実施）→ デプロイ→実機確認依頼**

```bash
rtk tsc && npx vitest run && pnpm build
npx playwright test tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

実機確認（コピペ用）:
```
スマホで https://allmarks.app をハードリロードして:
1. SHARE → 全選択 → ARRANGE。上部に UNDO/REDO が出ていますか。
2. カードを1つタップ → 上部に TO FRONT / TO BACK / DELETE が出ますか。
3. TO BACK でそのカードが他の後ろへ、TO FRONT で最前面へ来ますか。
4. DELETE でカードが消え、UNDO で戻り、REDO でまた消えますか。
5. 指2本 or スライダーでズーム → 余白を素早く2回タップ → 元の全体表示（整列）に戻りますか。
6. CREATE で作った画像に、編集結果（重なり順・削除）が反映されていますか（UNDO/REDO/上部バーは写らない）。
```

---

## Self-Review（実装者への注意）

- **デスクトップ経路は無改変**。CollageCanvas / MobileArrangeGestures の追加は全て任意 prop、未指定で挙動不変。上部バーは `isMobile` ブロック内・下部バーと同じ表示条件。
- **選択タップの自動前面化は履歴に含めない**（移動の pending は `bringToFront(order, id)` 済みの状態を「変更前」とする）＝タップだけで undo が増えない。
- **1操作=1手**: 連続ジェスチャは開始で捕捉・終了で `snapshotsEqual` 差分ありなら1回だけ push。離散操作は即時 push。
- **撮影は state から再描画**＝削除・重なり順・取り消しは画像に反映、ボードズーム（ダブルタップ整列）は画像に無影響。`renderCollageCanvasToJpeg`・サーバー・OG は無改変。
- **undo/redo は in-memory・退場で破棄**（IDB 非永続）。入場/退場でスタックを空に。
- 実タッチ（ピンチ・ダブルタップの感触）は**実機のみ**確認可。
