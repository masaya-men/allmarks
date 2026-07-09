# PC盤面＋共有の磨き 4点 実装計画（①テキストカードのフェード ②共有受け取り ③CREATE インジケーター ④TUNEマージンスナップ）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** s183 でユーザーが挙げた4点（N-42/N-43/N-44/N-27）を直す：①PCテキストカードの醜いスクロールバーを両端フェードに、②共有リンク受け取り画面の乱れ（スマホ1列・PC古メーター）、③SHARE の「作成中」表示が撮影中に消える、④TUNE の W/G スナップを「今の列数のまま左右マージン一致」に作り直し＋範囲UI。

**Architecture:** ①は既存の FilterPill タグ一覧のフェード機構（`computeTagScrollEdge`）を PlaceholderCard に流用。②は本物のボードから抜けている2つ（モバイル幅上書き／メーター配置）を SharedBoard に移植。③は進捗表示を撮影対象の外（body への portal）へ。④は fill-snap を「全列数の最近傍」から「今の列数の候補だけ」に絞り、しきい値を画面px基準に。

**Tech Stack:** Next.js static-export / React 19 / TS strict / Vanilla CSS Modules / vitest 4 / Playwright。

## Global Constraints
- **デスクトップ回帰ゼロ**: ①③④はデスクトップ変更。既存の盤面本体の他機能を壊さない。1489×679 回帰スクショ。
- TypeScript strict / `any` 禁止（`unknown`＋ガード）/ 明示 return type。
- Vanilla CSS Module のみ / Tailwind・Framer 禁止。z-index は `BOARD_Z_INDEX` 定数（魔法の数値禁止）。
- **中央寄せ禁止（④）**: 左詰めは維持。スナップは「今の列数のまま」左右マージン一致（列数を変えない）。
- 検証は `rtk tsc` / `rtk vitest run` / `pnpm build`（`rtk next build` 不可）。モバイル Playwright は 390×844。フェーダー吸着は Playwright 不可（`setPointerCapture`）＝純関数＋単体で担保。
- `--no-verify` 禁止。1機能=1コミット。**デプロイは最終レビュー後にコントローラが実施**（各タスクではしない）。
- 正本 spec: `docs/superpowers/specs/2026-07-09-board-share-polish-batch-design.md`。

---

## Task 1: ④ fill-snap の新純関数（今の列数でのマージン一致スナップ）

**Files:**
- Modify: `lib/board/fill-snap.ts`
- Modify: `lib/board/fill-snap.test.ts`

**Interfaces:**
- Consumes: 既存 `FillAxis`（'width'|'gap'）、`FillSnapInput`、`DEFAULT_FILL_SNAP_THRESHOLD_PX`（同ファイル）。
- Produces:
  - `currentColumnCount(width: number, gap: number, containerWidth: number): number`
  - `fillValueAtColumns(columns: number, other: number, containerWidth: number, axis: FillAxis, min: number, max: number): number | null`
  - `snapToFillAtCurrentColumns(input: FillSnapInput): number`

- [ ] **Step 1: 失敗テストを書く**

`lib/board/fill-snap.test.ts` の末尾に追記（既存 import に新関数を追加）:

```typescript
import { currentColumnCount, fillValueAtColumns, snapToFillAtCurrentColumns } from './fill-snap'

describe('currentColumnCount', () => {
  it('counts how many uniform cards+gaps fit in the container', () => {
    // width 100, gap 20, container 500 → floor((500+20)/(100+20)) = floor(4.33) = 4
    expect(currentColumnCount(100, 20, 500)).toBe(4)
  })
  it('is at least 1 for a card wider than the container', () => {
    expect(currentColumnCount(600, 20, 500)).toBe(1)
  })
  it('guards zero/negative container or width', () => {
    expect(currentColumnCount(100, 20, 0)).toBe(1)
    expect(currentColumnCount(0, 20, 500)).toBe(1)
  })
})

describe('fillValueAtColumns', () => {
  it('width that fills exactly at N columns (equal L/R margins)', () => {
    // 5 columns, gap 20, container 1180 → (1180 - 4*20)/5 = 220
    expect(fillValueAtColumns(5, 20, 1180, 'width', 120, 720)).toBe(220)
  })
  it('gap that fills exactly at N columns', () => {
    // 5 columns, width 220, container 1180 → (1180 - 5*220)/4 = 20
    expect(fillValueAtColumns(5, 220, 1180, 'gap', 0, 300)).toBe(20)
  })
  it('returns null when the fill value is outside [min,max]', () => {
    expect(fillValueAtColumns(1, 0, 5000, 'width', 120, 720)).toBeNull() // 5000 > max
  })
  it('returns null for gap axis with a single column (gap undefined)', () => {
    expect(fillValueAtColumns(1, 220, 1180, 'gap', 0, 300)).toBeNull()
  })
})

describe('snapToFillAtCurrentColumns', () => {
  const base = { other: 20, containerWidth: 1180, axis: 'width' as const, min: 120, max: 720 }
  it('snaps a near-fill width to the exact fill value at the CURRENT column count', () => {
    // current width 224, gap 20 → N = floor((1180+20)/(224+20)) = floor(4.91) = 4
    // fill at 4 cols = (1180 - 3*20)/4 = 280 — but 224 is far from 280, so NO snap here.
    // Use a width close to its own N's fill: width 216 → N = floor(1200/236)=5, fill@5 = 220, |216-220|=4 → snaps to 220.
    expect(snapToFillAtCurrentColumns({ ...base, value: 216, thresholdPx: 10 })).toBe(220)
  })
  it('does NOT jump to a different column count (5 stays 5, never 4)', () => {
    // width 219 → N=5, fill@5=220 (snaps up to 220), never to fill@4=280.
    const snapped = snapToFillAtCurrentColumns({ ...base, value: 219, thresholdPx: 10 })
    expect(snapped).toBe(220)
    expect(snapped).not.toBe(280)
  })
  it('leaves a value far from its column fill untouched', () => {
    // width 250 → N = floor(1200/270)=4, fill@4=280, |250-280|=30 > threshold → unchanged.
    expect(snapToFillAtCurrentColumns({ ...base, value: 250, thresholdPx: 10 })).toBe(250)
  })
})
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run lib/board/fill-snap.test.ts`
Expected: FAIL（新関数が未定義）

- [ ] **Step 3: 実装**

`lib/board/fill-snap.ts` の末尾に追加:

```typescript
/**
 * How many uniform-width cards (+ gaps between them) currently fit in the
 * container. N columns need N·width + (N−1)·gap ≤ containerWidth, i.e.
 * N ≤ (containerWidth + gap) / (width + gap). Always ≥ 1.
 */
export function currentColumnCount(width: number, gap: number, containerWidth: number): number {
  if (!(containerWidth > 0) || !(width > 0)) return 1
  return Math.max(1, Math.floor((containerWidth + gap) / (width + gap)))
}

/**
 * The dragged-axis value that fills the container edge-to-edge at EXACTLY
 * `columns` columns (so the left and right margins are equal), holding the
 * other axis fixed. Returns null when the value falls outside [min,max] or the
 * column count is invalid for the axis (gap needs ≥ 2 columns).
 */
export function fillValueAtColumns(
  columns: number,
  other: number,
  containerWidth: number,
  axis: FillAxis,
  min: number,
  max: number,
): number | null {
  if (!(containerWidth > 0) || columns < 1) return null
  let v: number
  if (axis === 'width') {
    v = (containerWidth - (columns - 1) * other) / columns
  } else {
    if (columns < 2) return null
    v = (containerWidth - columns * other) / (columns - 1)
  }
  if (v < min || v > max) return null
  return v
}

/**
 * Snap on release to the even-margin fill value FOR THE CURRENT COLUMN COUNT
 * only — never jumps to a neighbouring column count's fill (the s173 bug where
 * releasing at 5 columns snapped down to a 4-column fill). Keeps the board's
 * left-packed layout; the snap just makes the leftmost/rightmost gaps equal at
 * the count the user already has.
 */
export function snapToFillAtCurrentColumns(input: FillSnapInput): number {
  const { value, other, containerWidth, axis, min, max } = input
  const threshold = input.thresholdPx ?? DEFAULT_FILL_SNAP_THRESHOLD_PX
  const width = axis === 'width' ? value : other
  const gap = axis === 'width' ? other : value
  const n = currentColumnCount(width, gap, containerWidth)
  const target = fillValueAtColumns(n, other, containerWidth, axis, min, max)
  if (target === null) return value
  return Math.abs(target - value) <= threshold ? target : value
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/board/fill-snap.test.ts`
Expected: PASS（既存＋新規全て）。数値が実際の計算とズレたら期待値を実計算に合わせて調整（関数は変えない）。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/board/fill-snap.ts lib/board/fill-snap.test.ts
rtk git commit -m "feat(board): fill-snap at current column count (no column-count jump)"
```

---

## Task 2: ④ FaderColumn を「今の列数の候補だけ＋範囲ハイライト＋画面px基準スナップ」に

**Files:**
- Modify: `components/board/FaderColumn.tsx`
- Modify: `components/board/FaderColumn.module.css`

**Interfaces:**
- Consumes: `currentColumnCount` / `fillValueAtColumns` / `snapToFillAtCurrentColumns`（Task 1）。既存 `valueToFraction`。
- Produces: 単一の「今の列数の fill マーク」＋範囲内での強調＋release 時に現在列数へスナップ。

> UI タスク＝vitest ではなく tsc/build＋（Task 6 の）目視。フェーダー吸着自体は `setPointerCapture` で Playwright 不可＝Task 1 の純関数で担保。

- [ ] **Step 1: import を差し替え**

`components/board/FaderColumn.tsx` 冒頭の fill-snap import に新関数を追加（`snapToFill`/`fillCandidates` は使わなくなるので削除）:

```typescript
import { currentColumnCount, fillValueAtColumns, snapToFillAtCurrentColumns } from '@/lib/board/fill-snap'
```

- [ ] **Step 2: 単一候補＋範囲しきい値を算出**

`FaderColumn.tsx` の `fillMarks`（現状 lines 87-92）を置換。track の CSS 高さ 110px（`FaderColumn.module.css` の `.fader`/`.track` 高さ）を基準に、画面上 ~8px の吸着範囲を value 空間へ換算する:

```typescript
const axis = scope === 'w' ? 'width' : 'gap'
const snapEnabled =
  typeof containerWidth === 'number' && containerWidth > 0 && typeof otherValue === 'number'

// Value-space snap radius that maps to a comfortable ~8 CSS px on the 110px
// track (regardless of the axis's value range). The s173 fixed 10-"value-px"
// radius was ~1.8 px for W / ~3.7 px for G — effectively unreachable.
const TRACK_HEIGHT_PX = 110  // mirrors FaderColumn.module.css .fader height
const SNAP_SCREEN_PX = 8
const snapThresholdValue = ((max - min) * SNAP_SCREEN_PX) / TRACK_HEIGHT_PX

// The ONE fill value for the CURRENT column count (equal L/R margins without
// changing how many columns are shown). null when snapping is disabled or the
// fill value is out of range at the current count.
const fillTarget = snapEnabled
  ? fillValueAtColumns(
      currentColumnCount(
        axis === 'width' ? value : (otherValue as number),
        axis === 'width' ? (otherValue as number) : value,
        containerWidth as number,
      ),
      otherValue as number,
      containerWidth as number,
      axis,
      min,
      max,
    )
  : null
const fillInRange = fillTarget !== null && Math.abs(fillTarget - value) <= snapThresholdValue
```

- [ ] **Step 3: マーク描画を単一候補＋範囲強調に**

`fillMarks.map(...)`（現状 lines 225-233）を、`fillTarget` がある時だけ1本描く形に置換:

```tsx
{fillTarget !== null && (
  <div
    className={styles.fillMark}
    data-testid="fader-fill-mark"
    data-fill-value={fillTarget.toFixed(2)}
    data-in-range={fillInRange ? 'true' : 'false'}
    style={{ top: `${(1 - valueToFraction(fillTarget, min, max)) * 100}%` }}
  />
)}
```

- [ ] **Step 4: release スナップを現在列数版に**

`handlePointerUp` の `snapToFill({...})` 呼び出し（現状 lines 197-205）を置換。依存配列に変更なし（同じ変数）:

```tsx
const snapped = snapToFillAtCurrentColumns({
  value: valueRef.current,
  other: otherValue,
  containerWidth,
  axis,
  min,
  max,
  thresholdPx: ((max - min) * 8) / 110,
})
if (snapped !== valueRef.current) onChange(snapped)
```

- [ ] **Step 5: 範囲内マークの強調 CSS**

`components/board/FaderColumn.module.css` の `.fillMark`（現状 lines 72-81）に、`data-in-range='true'` で太く・明るく光る指定を追加（近づくと分かる）:

```css
.fillMark[data-in-range='true'] {
  height: 3px;
  background: var(--accent, #28f100);
  opacity: 1;
  box-shadow: 0 0 6px 1px color-mix(in srgb, var(--accent, #28f100) 70%, transparent);
}
```

（既存 `.fillMark` の 18px幅/1px/60%緑 はベースとして残す。`--accent` が未定義環境向けに `#28f100` フォールバック＝ブランドの緑 [[project_a_motif_logo]]）

- [ ] **Step 6: 型・ビルド確認**

Run: `rtk tsc`
Expected: 0 errors（未使用 import が無いこと）
Run: `pnpm build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
rtk git add components/board/FaderColumn.tsx components/board/FaderColumn.module.css
rtk git commit -m "feat(board/tune): W/G snap to current-column fill only + in-range mark glow"
```

---

## Task 3: ① PC テキストカードのスクロールバー廃止 → 両端フェード

**Files:**
- Modify: `components/board/cards/PlaceholderCard.tsx`
- Modify: `components/board/cards/PlaceholderCard.module.css`

**Interfaces:**
- Consumes: 既存 `computeTagScrollEdge`（[lib/board/tag-scroll-edge.ts](../../../lib/board/tag-scroll-edge.ts)・`TagScrollEdge='none'|'top'|'middle'|'bottom'`）。
- Produces: `.titleScroll` が `data-scroll-edge` で両端フェード＋スクロールバー非表示。

- [ ] **Step 1: スクロール状態を4状態 edge に**

`PlaceholderCard.tsx` の状態（現状 lines 118-132）を置換。既存の純関数 `computeTagScrollEdge` を流用（card は開閉アニメが無いので `maxHeight` に live `clientHeight` を渡せば `cap=clientHeight` で従来同等の overflow 判定）:

```tsx
import { computeTagScrollEdge, type TagScrollEdge } from '@/lib/board/tag-scroll-edge'
// ...
const titleScrollRef = useRef<HTMLDivElement>(null)
const [scrollEdge, setScrollEdge] = useState<TagScrollEdge>('none')

const updateScrollState = useCallback((): void => {
  const el = titleScrollRef.current
  if (!el) return
  setScrollEdge(computeTagScrollEdge({
    scrollHeight: el.scrollHeight,
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    maxHeight: el.clientHeight, // cards don't animate open; clientHeight is stable
  }))
}, [])
```

`handleCardWheel`（lines 146-157）の `hasOverflow` 参照を `scrollEdge !== 'none'` に置換:

```tsx
const handleCardWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>): void => {
  if (scrollEdge === 'none') return
  const el = titleScrollRef.current
  if (!el) return
  const dy = e.deltaY
  if (dy === 0) return
  const atTop = el.scrollTop <= 0
  const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
  if ((dy > 0 && !atEnd) || (dy < 0 && !atTop)) {
    e.stopPropagation()
  }
}, [scrollEdge])
```

`useEffect` の ResizeObserver（lines 134-141）は変更不要（`updateScrollState` を呼ぶだけ）。

- [ ] **Step 2: 両方の `.titleScroll` の属性を差し替え**

paperNote 版（lines 180-187）と main 版（lines 213-220）の両方で、`data-overflow`/`data-at-bottom` を `data-scroll-edge={scrollEdge}` に置換（`data-card-scroll`/`onScroll`/`onWheel`/`ref` は維持）:

```tsx
<div
  ref={titleScrollRef}
  className={styles.titleScroll}          {/* paperNote 版は `${styles.titleScroll} ${styles.paperNoteScroll}` を維持 */}
  data-scroll-edge={scrollEdge}
  data-card-scroll="true"
  onScroll={updateScrollState}
  onWheel={handleCardWheel}
>
```

- [ ] **Step 3: CSS＝スクロールバー完全非表示＋両端フェード**

`PlaceholderCard.module.css` の `.titleScroll` のスクロールバー系（現状 lines 91-111 の `scrollbar-width`/`scrollbar-color`/`:hover`/`::-webkit-scrollbar*`）を**完全非表示**に置換し、下端専用フェード（lines 116-127）を `data-scroll-edge` 版に置換:

```css
.titleScroll {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 22px 22px;
  scrollbar-width: none;           /* Firefox — no native bar */
}
.titleScroll::-webkit-scrollbar { width: 0; height: 0; display: none; }

/* Edge fade (no-plain-scrollbar house rule): fade the cut-off end(s); the fade
   clears at whichever end you've scrolled to. Mirrors FilterPill's tag list. */
.titleScroll[data-scroll-edge='middle'] {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%);
}
.titleScroll[data-scroll-edge='top'] {
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.5) 92%, transparent 100%);
          mask-image: linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.5) 92%, transparent 100%);
}
.titleScroll[data-scroll-edge='bottom'] {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 8%, black 18%, black 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 8%, black 18%, black 100%);
}
```

- [ ] **Step 4: 型・ビルド確認**

Run: `rtk tsc` → 0 errors
Run: `rtk vitest run` → 全緑（`computeTagScrollEdge` の既存テスト含む）
Run: `pnpm build` → 成功

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/cards/PlaceholderCard.tsx components/board/cards/PlaceholderCard.module.css
rtk git commit -m "feat(board/cards): text-card edge fade (both ends, no native scrollbar) via computeTagScrollEdge"
```

---

## Task 4: ③ SHARE「作成中」インジケーターを撮影外（portal）に常時表示

**Files:**
- Create: `components/board/ShareCreatingIndicator.tsx`
- Create: `components/board/ShareCreatingIndicator.module.css`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `ShareCreateState`（[components/board/ShareToast.tsx](../../../components/board/ShareToast.tsx)）、既存 `shareCreateState`（BoardRoot state）、`createPortal`。
- Produces: `ShareCreatingIndicator({ active }: { active: boolean }): ReactElement | null` — `active` の間だけ body に「Creating your link…」を portal 表示。

- [ ] **Step 1: portal インジケーターを実装**

`components/board/ShareCreatingIndicator.tsx`（新規）:

```tsx
'use client'
import { useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import styles from './ShareCreatingIndicator.module.css'

/** "Creating your link…" progress indicator for the SHARE auto-capture flow.
 *  Rendered via a portal to document.body — OUTSIDE the board's capture subtree
 *  (`boardFrameRef`) — so it (a) is never baked into the dom-to-image screenshot
 *  and (b) is never hidden by the `.outerFrame[data-capturing] [data-no-capture]`
 *  visibility rule, unlike the in-frame ShareToast button. Stays visible across
 *  BOTH the capture and upload phases until the link is ready. */
export function ShareCreatingIndicator({ active }: { readonly active: boolean }): ReactElement | null {
  const [mounted, setMounted] = useState(false)
  useEffect((): void => setMounted(true), [])
  if (!active || !mounted || typeof document === 'undefined') return null
  return createPortal(
    <div className={styles.root} role="status" aria-live="polite" data-testid="share-creating-indicator">
      <span className={styles.dot} />
      <span className={styles.label}>CREATING YOUR LINK…</span>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: CSS**

`components/board/ShareCreatingIndicator.module.css`（新規）。z-index は本来 `BOARD_Z_INDEX` 由来にすべきだが portal は body 直下＝盤面の stacking の外なので、既存の最前面帯より上に出す固定値でよい（撮影に写らないので盤面 z 体系と競合しない）。ただし魔法数値回避のため BOARD_Z_INDEX に定数を足して参照する:

```css
.root {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(16, 16, 20, 0.9);
  color: #f5f5f5;
  font-size: 13px;
  letter-spacing: 0.06em;
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
.dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent, #28f100);
  box-shadow: 0 0 8px 1px color-mix(in srgb, var(--accent, #28f100) 70%, transparent);
  animation: sci-pulse 1s ease-in-out infinite;
}
@keyframes sci-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
```

- [ ] **Step 3: z-index 定数を追加して参照**

`lib/board/constants.ts` の `BOARD_Z_INDEX` に追加（body-portal 用・盤面外なので最上位帯でよい）:

```typescript
  SHARE_CREATING: 500,  // body-portal "creating your link…" indicator (outside the capture subtree; above all board chrome)
```

`ShareCreatingIndicator.module.css` の `.root` に `z-index` は付けず、コンポーネント側で inline `style={{ zIndex: BOARD_Z_INDEX.SHARE_CREATING }}` を付与（Step 1 の JSX に追記）:

```tsx
import { BOARD_Z_INDEX } from '@/lib/board/constants'
// ...
<div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_CREATING }} role="status" ...>
```

- [ ] **Step 4: BoardRoot に配線**

`components/board/BoardRoot.tsx`：import 追加＋既存 `<PasteSaveFeedback .../>` の近く（枠の外側・`data-no-capture` の外）に mount。`shareCreateState` は既存 state（`handleCreateHostedShare` が 'creating' にする）:

```tsx
import { ShareCreatingIndicator } from './ShareCreatingIndicator'
// ... JSX 内、outerFrame の外側 or 撮影対象でない位置に:
<ShareCreatingIndicator active={shareCreateState === 'creating'} />
```

> 配置注意：`boardFrameRef`（`.outerFrame`）の**子孫にしない**こと（撮影・非表示 CSS の外に出すのが目的）。BoardRoot のトップレベル return 直下（`.outerFrame` の兄弟）に置く。実装者は `boardFrameRef` の JSX 位置を確認して外側に置く。

- [ ] **Step 5: 型・ビルド確認**

Run: `rtk tsc` → 0 errors
Run: `pnpm build` → 成功

- [ ] **Step 6: コミット**

```bash
rtk git add components/board/ShareCreatingIndicator.tsx components/board/ShareCreatingIndicator.module.css lib/board/constants.ts components/board/BoardRoot.tsx
rtk git commit -m "feat(board/share): portal 'creating your link' indicator (visible during capture, outside screenshot)"
```

---

## Task 5: ② 共有受け取り画面の乱れ（スマホ1列＋PC古メーター）

**Files:**
- Modify: `components/share/SharedBoard.tsx`

**Interfaces:**
- Consumes: `useIsMobile`（[lib/board/use-is-mobile.ts](../../../lib/board/use-is-mobile.ts)）、`MOBILE_LAYOUT`（[lib/board/constants.ts](../../../lib/board/constants.ts)）、既存の同一 CSS module `frame`（`@/components/board/BoardRoot.module.css`・SharedBoard で import 済）、既存 `CardsLayer`/`ScrollMeter`。
- Produces: 受け取り画面がスマホで3列・PC でメーターが今の枠下帯位置。

> 参照＝本物のボードのモバイル導出 [BoardRoot.tsx:1074-1083](../../../components/board/BoardRoot.tsx#L1074) と メーター配置 [BoardRoot.tsx:2884-2896](../../../components/board/BoardRoot.tsx#L2884)。

- [ ] **Step 1: モバイル幅上書きを移植（スマホ1列の解消）**

`SharedBoard.tsx` に `useIsMobile()` を追加し、BoardRoot と同じ導出でカード幅/gap/customWidths を作る。`effectiveLayoutWidth` に相当する受け取り側のコンテナ幅（既存の幅変数）を使う。**BoardRoot のロジックをそのまま移植**（列数 `MOBILE_LAYOUT.COLUMNS`、`mobileCardWidth = (width - (cols-1)*MOBILE_LAYOUT.GAP_PX)/cols`、モバイル時 `customWidths` は空）。導出した width/gap/customWidths を、`computeSkylineLayout`（spacer 用・現状 264-274）と `CardsLayer` props（現状 512-537）の**両方**に渡す（今は送信者の生 `cardWidthPx`/`gapPx`/`customWidths` を渡している所を差し替え）。

> 実装者へ：SharedBoard の現在のコンテナ幅変数名・props 名を読んで正確に差し替えること。BoardRoot と同じ `EMPTY_CUSTOM_WIDTHS` 定数があれば流用、無ければ空配列/空 Map を渡す（既存 customWidths の型に合わせる）。

- [ ] **Step 2: メーターを今の枠下帯へ（PC 古配置の解消）**

`SharedBoard.tsx:551-576` のメーター wrapper（`position:absolute; bottom:24px; left:50%; translateX(-50%)` を手書きし `.canvas` の中に置いている）を、`.canvas` の**外の兄弟**にして `className={frame.frameBottomChrome}` を使う形へ。inline の絶対配置スタイルは撤去。表示条件は本物に合わせ、モバイルでは出さない（`!isMobile`）— 受け取り側の縦スクロール体験を本物と揃える。

> 実装者へ：`.canvas` の開閉タグ（SharedBoard.tsx:435 で開き 580 で閉じる）を確認し、メーターを閉じタグの**後**に移す。`frame.frameBottomChrome` の CSS は canvas 外の枠下マージンに置かれる前提（`--canvas-margin` グローバル変数依存）なので、SharedBoard の外枠構造が `frame.outerFrame`/`frame.canvas` を使っているか確認（使っていれば整合）。

- [ ] **Step 3: 型・ビルド確認**

Run: `rtk tsc` → 0 errors
Run: `rtk vitest run` → 全緑（SharedBoard 関連の既存テスト `components/share/*.test.tsx` が緑）
Run: `pnpm build` → 成功

- [ ] **Step 4: コミット**

```bash
rtk git add components/share/SharedBoard.tsx
rtk git commit -m "fix(share/receiver): port mobile 3-col width + move scroll meter to frame bottom band (match real board)"
```

---

## Task 6: 総検証（Playwright）＋回帰＋コントローラ引き渡し

**Files:**
- Create: `tests/e2e/board-share-polish.spec.ts`（可能な範囲で）

> ④のフェーダー吸着は Playwright 不可（Task 1 の純関数で担保済）。Playwright で担保できるのは ①フェード属性・③portal 表示・②受け取り画面の DOM。**デプロイはコントローラが最終レビュー後に実施**（このタスクではしない）。

- [ ] **Step 1: Playwright（担保できる範囲）**

`tests/e2e/board-share-polish.spec.ts`（既存 board e2e の preseed パターン流用・`board-b0.spec.ts`/`tune-corners-and-snap.spec.ts` 参照）:
- **①**: テキストのみカードでスクロールが起きる状態を作り、`[data-card-scroll]` に `data-scroll-edge` が付き（`top`→スクロール→`middle`/`bottom`）ネイティブスクロールバーが出ない（CSS で width:0）ことを確認。
- **③**: SHARE→SELECT→ARRANGE→CREATE を駆動し、`share-creating-indicator`（body portal）が表示されることを確認（撮影が走る間 visible）。※headless で /api/img が無くても capture は走り indicator は出る。
- **②**: `/s/<id>` 実共有を 390×844 で開き CardsLayer が3列想定の幅（1列でない）になること、1489 でメーターが枠下帯に居ること（`frame.frameBottomChrome` 内）を確認。preseed/実共有生成は既存 share e2e（`share-sender.spec.ts` 等）を参照。
- 環境依存で不安定になる assertion は UI レベルの確実な signal に置換し report に明記（`reference_playwright_board_share_verify`）。

- [ ] **Step 2: 総検証**

Run: `rtk tsc` → 0
Run: `rtk vitest run` → 全緑
Run: `pnpm build` → 成功
Run: `rtk playwright test tests/e2e/board-share-polish.spec.ts` → PASS

- [ ] **Step 3: デスクトップ回帰スクショ**

Playwright 1489×679 / dpr2.58 で盤面（①③④の変更が他要素に回帰を出していない）＋ TUNE ドロワー（④のマーク）を撮影・目視。

- [ ] **Step 4: コミット**

```bash
rtk git add tests/e2e/board-share-polish.spec.ts
rtk git commit -m "test(e2e): board/share polish — text-card edge fade, share-creating indicator, receiver layout"
```

- [ ] **Step 5: コントローラへ**

デプロイは行わない。コントローラが最終ブランチレビュー → master マージ → 本番デプロイ → 実機確認依頼（②スマホ受け取りのタップ/スクロール、④スナップの効き/範囲UI、①フェード、③作成中表示）。

---

## Self-Review（spec 突き合わせ）
- **① N-42** → Task 3（`computeTagScrollEdge` 流用・両端フェード・バー非表示・paperNote 追従・Lightbox 文字カードにも波及）。✓
- **② N-43** → Task 5（スマホ幅上書き移植＝1列解消／メーターを frameBottomChrome＝古配置解消・isMobile+receiverMode は実機確認）。✓
- **③ N-44** → Task 4（body portal 進捗・撮影に写らず非表示 CSS も回避・`shareCreateState==='creating'` gate・z 定数）。✓
- **④ N-27** → Task 1（純関数：現在列数・その列数の fill 値・現在列数スナップ）＋Task 2（単一候補マーク＋範囲光る＋画面px しきい値・中央寄せせず左詰め維持）。✓
- **検証** → Task 6（Playwright 担保範囲＋純関数＋回帰＋実機はコントローラ）。✓

**型整合**: `currentColumnCount(w,g,C):number`／`fillValueAtColumns(cols,other,C,axis,min,max):number|null`／`snapToFillAtCurrentColumns(FillSnapInput):number`／`TagScrollEdge`／`ShareCreatingIndicator({active}):ReactElement|null`／`BOARD_Z_INDEX.SHARE_CREATING` — 全タスク一貫。プレースホルダなし。

**非対象**: ⑤ Pinterest（N-28・来週）。③の孤児コード掃除（任意）。
