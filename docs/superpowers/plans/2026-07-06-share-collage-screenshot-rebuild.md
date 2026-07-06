# SHARE 作り直し（コラージュ・スクショ方式）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SHARE を「窓を出さずに盤面が入るモード」に作り直す。選んだカードを自由配置コラージュにし、ユーザーがスクショして共有する（アプリは投稿画像を生成しない）。取り込みリンクは併記できる任意アクションとして残す。

**Architecture:** 二段モード（第1段=s157 選択を流用 / 第2段=新規の自由配置キャンバス）。配置ロジックは純関数（`lib/share/collage-layout.ts` 等）に切り出して TDD、DOM ジェスチャは薄いラッパにする。カードもタイトルも「置ける要素」として同じ座標土台（既存の positions マップ → `gsap.set(el,{x,y,width,height})` 描画）を再利用。一時状態（IDB 非永続）。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / GSAP / IndexedDB(idb) / 既存 skyline-layout・s157 選択・/s リンク生成資産。

**元 spec:** [docs/superpowers/specs/2026-07-06-share-collage-screenshot-rebuild-design.md](../specs/2026-07-06-share-collage-screenshot-rebuild-design.md)

## Global Constraints

- TypeScript `strict: true`／`any` 禁止（`unknown`+型ガード）／return type 明示。
- Vanilla CSS + CSS Modules。**Tailwind 禁止**。アニメは **GSAP + CSS keyframes**（**Framer Motion 禁止**）。
- z-index は魔法の数値禁止。`lib/board/constants.ts` の `BOARD_Z_INDEX` に定数追加して使う。
- UI ラベルは globally-clear な英語直書き（`SHARE` / `ARRANGE` / `RESELECT` / `DONE` / `COPY LINK` 等）＝i18n 15言語作業を増やさない（memory `feedback_globally_clear_english`）。日本語 UI 文言を足す場合のみ i18n 方針と擦り合わせ。
- **盤面グリッド常時が核の設計法則**。自由配置は **SHARE モード限定の意図的例外**（memory `feedback_allmarks_grid_no_tilt`）。
- 配置・タイトルは **React state のみ・IDB 非永続**。モード離脱で破棄。
- ドラッグは掴んで直接（ハンドル無し・memory `feedback_inline_and_direct_drag`）。
- **カードのドラッグ/リサイズ/選択タップは `setPointerCapture` 依存で合成 Playwright ポインタ不可**（memory `reference_board_card_click_pointer_capture`）。→ ジェスチャ系タスクの検証は「純関数の単体テスト＋手動目視」。純ロジックを必ず切り出す。
- deploy 前ゲート：`rtk tsc && rtk vitest run && rtk pnpm build`。デプロイは `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 金額は¥（本 feature では登場しない想定）。

---

# フェーズ1 — コア SHARE モード（選ぶ → 並べる → スクショ）

> 完了時点で「SHARE 押下 → カード選択 → 自由配置 → スクショ → 終了」が動く出荷可能な最小形（タイトル・取り込みリンクは後フェーズ）。

## Task 1: 配置キャンバスの純ロジック `lib/share/collage-layout.ts`

**Files:**
- Create: `lib/share/collage-layout.ts`
- Test: `lib/share/collage-layout.test.ts`

**Interfaces:**
- Consumes: `computeSkylineLayout` from [lib/board/skyline-layout.ts](../../../lib/board/skyline-layout.ts)（`({cards:{id,width,height}[],containerWidth,gap}) → {positions:Record<id,{x,y,w,h}>,totalWidth,totalHeight}`）; `CardPosition` from [lib/board/types.ts](../../../lib/board/types.ts)（`{x,y,w,h}`）。
- Produces: `CollageElement`, `CollagePositions`, `seedCollagePositions`, `moveElement`, `resizeElement`, `bringToFront`。後続の CollageCanvas が使う。

- [ ] **Step 1: 失敗するテストを書く** — `lib/share/collage-layout.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { seedCollagePositions, moveElement, resizeElement, bringToFront } from './collage-layout'

const cards = [
  { id: 'a', width: 200, height: 100 },
  { id: 'b', width: 200, height: 100 },
]

describe('collage-layout', () => {
  it('seedCollagePositions returns a position for every card', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    expect(Object.keys(pos).sort()).toEqual(['a', 'b'])
    expect(pos.a).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: 200, h: 100 })
  })

  it('moveElement sets absolute x/y without touching size', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    const moved = moveElement(pos, 'a', 333, 444)
    expect(moved.a).toMatchObject({ x: 333, y: 444, w: pos.a.w, h: pos.a.h })
    expect(moved.b).toEqual(pos.b)
  })

  it('resizeElement clamps to 80px min and preserves aspect', () => {
    const pos = seedCollagePositions(cards, 1000, 10) // a = 200x100, aspect 2
    const small = resizeElement(pos, 'a', 40)
    expect(small.a.w).toBe(80)
    expect(small.a.h).toBe(40) // 80 / 2
    const big = resizeElement(pos, 'a', 400)
    expect(big.a).toMatchObject({ w: 400, h: 200 })
  })

  it('moveElement / resizeElement are no-ops for unknown id', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    expect(moveElement(pos, 'zzz', 1, 1)).toBe(pos)
    expect(resizeElement(pos, 'zzz', 100)).toBe(pos)
  })

  it('bringToFront moves the id to the end of the order', () => {
    expect(bringToFront(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a'])
    expect(bringToFront(['a', 'b'], 'zzz')).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認** — Run: `rtk vitest run lib/share/collage-layout.test.ts` / Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 最小実装** — `lib/share/collage-layout.ts`

```ts
import { computeSkylineLayout } from '@/lib/board/skyline-layout'
import type { CardPosition } from '@/lib/board/types'

/** 自由配置キャンバスの1要素の実測サイズ（初期詰め込みに使う）。 */
export type CollageElement = { readonly id: string; readonly width: number; readonly height: number }
/** id → 現在の自由配置座標。CardPosition = {x,y,w,h}。 */
export type CollagePositions = Readonly<Record<string, CardPosition>>

/** リサイズ下限。既存 size-migration の MIN_CARD_WIDTH と同値（80px）。 */
export const COLLAGE_MIN_WIDTH_PX = 80

/** 選択カードを skyline で1回だけ詰め、その配置を自由配置の初期値にする。 */
export function seedCollagePositions(
  cards: readonly CollageElement[],
  containerWidth: number,
  gap: number,
): CollagePositions {
  const { positions } = computeSkylineLayout({
    cards: cards.map((c) => ({ id: c.id, width: c.width, height: c.height })),
    containerWidth,
    gap,
  })
  return { ...positions }
}

/** 要素を絶対座標へ移動（サイズ不変）。未知 id は同一参照を返す。 */
export function moveElement(positions: CollagePositions, id: string, x: number, y: number): CollagePositions {
  const p = positions[id]
  if (!p) return positions
  return { ...positions, [id]: { ...p, x, y } }
}

/** 幅を変えて高さをアスペクト維持で追従（下限クランプ）。未知 id は同一参照。 */
export function resizeElement(positions: CollagePositions, id: string, nextWidth: number): CollagePositions {
  const p = positions[id]
  if (!p) return positions
  const aspect = p.w / p.h
  const w = Math.max(COLLAGE_MIN_WIDTH_PX, nextWidth)
  const h = w / aspect
  return { ...positions, [id]: { ...p, w, h } }
}

/** 重なり順配列で id を最前面（末尾）へ。未知 id は複製を返す。 */
export function bringToFront(order: readonly string[], id: string): string[] {
  if (!order.includes(id)) return [...order]
  return [...order.filter((x) => x !== id), id]
}
```

- [ ] **Step 4: テストが通るのを確認** — Run: `rtk vitest run lib/share/collage-layout.test.ts` / Expected: PASS

- [ ] **Step 5: commit**

```bash
rtk git add lib/share/collage-layout.ts lib/share/collage-layout.test.ts
rtk git commit -m "feat(share): collage free-placement layout pure functions"
```

## Task 2: 配置キャンバス `components/board/CollageCanvas.tsx`

**Files:**
- Create: `components/board/CollageCanvas.tsx`, `components/board/CollageCanvas.module.css`
- Reference (読むだけ): [components/board/CardNode.tsx](../../../components/board/CardNode.tsx)（`rotation?/locked?/selected?` 予約 prop あり・`id/title/thumbnailUrl/children`）、[components/board/CardsLayer.tsx:1105-1163](../../../components/board/CardsLayer.tsx#L1105)（wrapper の `position:absolute; top:0; left:0; width/height px` ＋ `gsap.set(el,{x,y,width,height})` で座標適用）、[components/board/cards/index.ts](../../../components/board/cards/index.ts)（カード本体レンダラ）。

**Interfaces:**
- Consumes: `CollagePositions`/`moveElement`/`resizeElement`/`bringToFront` from Task 1。
- Produces: `CollageCanvas` component with props:
```ts
type CollageCanvasProps = {
  readonly items: ReadonlyArray<{ id: string; title: string; thumbnailUrl: string | null; url: string }>
  readonly positions: CollagePositions          // 親（BoardRoot）が保持
  readonly order: readonly string[]              // 重なり順（末尾が最前面）
  readonly onMove: (id: string, x: number, y: number) => void
  readonly onResize: (id: string, nextWidth: number) => void
  readonly onGrab: (id: string) => void          // 掴んだら bringToFront させる
  readonly themeId: ThemeId
}
```

- [ ] **Step 1: キャンバス骨組みを実装**（各要素を絶対配置 wrapper で描画）

CardsLayer の wrapper パターン（[CardsLayer.tsx:1105-1163](../../../components/board/CardsLayer.tsx#L1105)）を踏襲。座標は `gsap.set` でも inline transform でもよいが、**本キャンバスは一時表示なので inline `style` の `transform: translate` + `width/height` で十分**（FLIP 不要）。要素本体は既存 `CardNode` を再利用（`selected` は使わない）。

```tsx
'use client'
import { useRef, type ReactElement } from 'react'
import { CardNode } from './CardNode'
import type { ThemeId } from '@/lib/board/types'
import type { CollagePositions } from '@/lib/share/collage-layout'
import styles from './CollageCanvas.module.css'
// ... props type above ...

export function CollageCanvas(props: CollageCanvasProps): ReactElement {
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const zBase = 10
  return (
    <div className={styles.root} data-testid="collage-canvas">
      {props.items.map((it) => {
        const p = props.positions[it.id]
        if (!p) return null
        const z = zBase + Math.max(0, props.order.indexOf(it.id))
        return (
          <div
            key={it.id}
            ref={(el) => { refs.current[it.id] = el }}
            className={styles.element}
            data-testid={`collage-el-${it.id}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${p.w}px`,
              height: `${p.h}px`,
              transform: `translate(${p.x}px, ${p.y}px)`,
              zIndex: z,
            }}
            onPointerDown={(e) => handleElementPointerDown(e, it.id)}
          >
            <CardNode id={it.id} title={it.title} thumbnailUrl={it.thumbnailUrl} />
            {/* resize corner — 掴みリサイズ（4隅の1つで十分・基本スコープ） */}
            <div className={styles.resizeCorner} onPointerDown={(e) => handleResizePointerDown(e, it.id)} />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: ドラッグ移動ジェスチャ**（`handleElementPointerDown`）

ReorderDrag と同型（[use-card-reorder-drag.ts:121-290](../../../components/board/use-card-reorder-drag.ts#L121)）だが**再パックせず x/y を直接 `onMove`**。`setPointerCapture` は try/catch で（jsdom/合成ポインタ安全）。

```ts
function handleElementPointerDown(e: React.PointerEvent, id: string): void {
  if (e.button > 0) return
  e.stopPropagation()
  const el = refs.current[id]
  const start = props.positions[id]
  if (!el || !start) return
  props.onGrab(id) // bringToFront
  const startX = e.clientX, startY = e.clientY
  const originX = start.x, originY = start.y
  try { el.setPointerCapture(e.pointerId) } catch { /* jsdom */ }
  const move = (ev: PointerEvent): void => {
    props.onMove(id, originX + (ev.clientX - startX), originY + (ev.clientY - startY))
  }
  const up = (): void => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}
```

- [ ] **Step 3: リサイズジェスチャ**（`handleResizePointerDown`）

ResizeHandle と同型（[ResizeHandle.tsx:73-155](../../../components/board/ResizeHandle.tsx#L73)）：`e.stopPropagation()`+`preventDefault()` で親ドラッグを止め、幅だけ変え `onResize(nextWidth)`。高さは `resizeElement` がアスペクト維持で追従。

```ts
function handleResizePointerDown(e: React.PointerEvent, id: string): void {
  e.stopPropagation(); e.preventDefault()
  const el = refs.current[id]; const start = props.positions[id]
  if (!el || !start) return
  const startX = e.clientX; const startW = start.w
  try { el.setPointerCapture?.(e.pointerId) } catch { /* jsdom */ }
  const move = (ev: PointerEvent): void => { props.onResize(id, startW + (ev.clientX - startX) * 2) }
  const up = (): void => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up)
  }
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up)
}
```

- [ ] **Step 4: CSS**（`CollageCanvas.module.css`）— キャンバスは盤面全面を覆う絶対レイヤ。`.root{position:absolute;inset:0}` / `.element{cursor:grab;touch-action:none}` / `.resizeCorner{position:absolute;right:0;bottom:0;width:28px;height:28px;cursor:nwse-resize}`（クリック域 ≥28px＝memory `feedback_large_pointer`）。

- [ ] **Step 5: マウントテスト**（レンダリングだけ・ジェスチャは手動）— `components/board/CollageCanvas.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CollageCanvas } from './CollageCanvas'
import { seedCollagePositions } from '@/lib/share/collage-layout'

it('renders one element node per item at its position', () => {
  const items = [{ id: 'a', title: 'A', thumbnailUrl: null, url: 'u' }]
  const positions = seedCollagePositions([{ id: 'a', width: 200, height: 100 }], 1000, 10)
  const { getByTestId } = render(
    <CollageCanvas items={items} positions={positions} order={['a']}
      onMove={() => {}} onResize={() => {}} onGrab={() => {}} themeId="sound-wave" />,
  )
  const el = getByTestId('collage-el-a')
  expect(el.style.width).toBe('200px')
  expect(el.style.transform).toContain('translate(')
})
```
Run: `rtk vitest run components/board/CollageCanvas.test.tsx` / Expected: PASS。（`themeId` の実値は [lib/board/types.ts](../../../lib/board/types.ts) の `ThemeId` から有効値を使う。）

- [ ] **Step 6: commit**

```bash
rtk git add components/board/CollageCanvas.tsx components/board/CollageCanvas.module.css components/board/CollageCanvas.test.tsx
rtk git commit -m "feat(share): CollageCanvas free-placement arrange layer"
```

## Task 3: 下部トースト `components/board/ShareToast.tsx`

**Files:**
- Create: `components/board/ShareToast.tsx`, `components/board/ShareToast.module.css`
- Reference: [components/board/ShareSelectBar.tsx](../../../components/board/ShareSelectBar.tsx)（見た目資産・`role="toolbar"`・z-index 適用パターン）、[lib/board/constants.ts:70](../../../lib/board/constants.ts#L70)（`SHARE_SELECT_BAR:115`）。

**Interfaces:**
- Produces: `ShareToast` with props（フェーズ1版・リンクは後で足す）:
```ts
type ShareToastProps = {
  readonly count: number
  readonly onReselect: () => void   // 第1段へ戻る
  readonly onDone: () => void       // モード離脱
}
```

- [ ] **Step 1: z-index 定数を追加** — [lib/board/constants.ts](../../../lib/board/constants.ts) の `BOARD_Z_INDEX` に `SHARE_TOAST: 116` を追加（`SHARE_SELECT_BAR:115` の1つ上、`POPOVER:120` 未満）。

- [ ] **Step 2: コンポーネント実装**（ShareSelectBar を下敷きに）

```tsx
'use client'
import { type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ShareToast.module.css'

export function ShareToast({ count, onReselect, onDone }: ShareToastProps): ReactElement {
  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} role="toolbar" aria-label="Sharing">
      <div className={styles.bar}>
        <span className={styles.counter} data-testid="share-toast-count">SHARING… {count}</span>
        <span className={styles.hint}>Screenshot the collage area to share（Win: Win+Shift+S / Mac: ⌘+Shift+4）</span>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onReselect} data-testid="share-toast-reselect">RESELECT</button>
          <button type="button" className={styles.primaryBtn} onClick={onDone} data-testid="share-toast-done">DONE</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: CSS** — ShareSelectBar.module.css を参考に固定下部バー（`.root{position:fixed;bottom:...;left:0;right:0;display:flex;justify-content:center}`）。ボタン域 ≥32px（memory `feedback_large_pointer`）。プレーンなスクロールバー等は出さない（memory `feedback_no_plain_scrollbars`）。

- [ ] **Step 4: マウントテスト** — `components/board/ShareToast.test.tsx`：`count=3` で `SHARING… 3` が出る／RESELECT・DONE クリックで各コールバックが呼ばれる（`@testing-library/react` + `fireEvent.click`）。Run: `rtk vitest run components/board/ShareToast.test.tsx` / Expected: PASS。

- [ ] **Step 5: commit**

```bash
rtk git add lib/board/constants.ts components/board/ShareToast.tsx components/board/ShareToast.module.css components/board/ShareToast.test.tsx
rtk git commit -m "feat(share): SHARING bottom toast (phase-1 controls)"
```

## Task 4: BoardRoot 配線 — sharePhase 二段化・SHARE 入口・旧ドロワー撤去

**Files:**
- Modify: [components/board/BoardRoot.tsx](../../../components/board/BoardRoot.tsx)（複数箇所）、[components/board/ShareSelectBar.tsx](../../../components/board/ShareSelectBar.tsx)。

**Interfaces:**
- Consumes: Task 1〜3。
- Produces: 動く二段モード（タイトル・リンクは未接続）。

- [ ] **Step 1: `selectMode` を `sharePhase` に一般化**
  - [BoardRoot.tsx:386](../../../components/board/BoardRoot.tsx#L386) `const [selectMode, setSelectMode] = useState<boolean>(false)` を
    `const [sharePhase, setSharePhase] = useState<'select' | 'arrange' | null>(null)` に置換。
  - 既存の `selectMode` 参照（[:1982](../../../components/board/BoardRoot.tsx#L1982),[:2632](../../../components/board/BoardRoot.tsx#L2632),[:2838](../../../components/board/BoardRoot.tsx#L2838) 等）を `sharePhase === 'select'` に読み替え。`selectedIds`/`capFlashCycle`/`shareSelectedIds` はそのまま。

- [ ] **Step 2: 配置状態を追加** — BoardRoot に:
```ts
const [collagePositions, setCollagePositions] = useState<CollagePositions>({})
const [collageOrder, setCollageOrder] = useState<string[]>([])
```

- [ ] **Step 3: SHARE ボタンをモード入口に配線し直す**
  - [BoardRoot.tsx:2459-2464](../../../components/board/BoardRoot.tsx#L2459) の SHARE `ChromeButton` の `onClick` を
    `(): void => { if (sharePhase === null) handleEnterSelectMode() }` に変更（`setActiveDrawer('share')` を廃止）。
  - [:1940 `handleEnterSelectMode`](../../../components/board/BoardRoot.tsx#L1940) 内の `setSelectMode(true)` を `setSharePhase('select')` に。

- [ ] **Step 4: 「配置へ」遷移**（第1段 → 第2段）
  - [:1971 `handleSelectShare`](../../../components/board/BoardRoot.tsx#L1971) を「並べる段へ入る」に置換：選択集合を盤面順で取り、実測サイズで `seedCollagePositions` して state を初期化し `sharePhase='arrange'` に。
```ts
const handleEnterArrange = useCallback((): void => {
  if (selectedIds.size === 0) return
  const chosen = lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))
  const cards = chosen.map((it) => ({
    id: it.bookmarkId,
    width: customWidths[it.bookmarkId] ?? cardWidthPx,
    height: (customWidths[it.bookmarkId] ?? cardWidthPx) / (it.aspectRatio ?? 1),
  }))
  setCollagePositions(seedCollagePositions(cards, viewport.w, cardGapPx))
  setCollageOrder(chosen.map((it) => it.bookmarkId))
  setSharePhase('arrange')
}, [selectedIds, lightboxNavItems, customWidths, cardWidthPx, cardGapPx, viewport.w])
```
（`aspectRatio` の正確な取得元は [cards/index.ts:115-118](../../../components/board/cards/index.ts#L115) の `itemSkylineHeight` を参照し、無い場合の fallback を合わせる。プレースホルダ比は同ファイルの `PLACEHOLDER_ASPECT`。）

- [ ] **Step 5: ShareSelectBar の primary をリラベル**
  - [ShareSelectBar.tsx:53-55](../../../components/board/ShareSelectBar.tsx#L53) の `SHARE ({count})` を `ARRANGE ({count})` に。prop 名は `onShare` のままでよいが、意味が変わるので JSDoc を「並べる段へ進む」に更新。
  - BoardRoot の `<ShareSelectBar ... onShare={handleEnterArrange} />`（[:2843](../../../components/board/BoardRoot.tsx#L2843)）に差し替え。表示条件は `sharePhase === 'select'`。

- [ ] **Step 6: 第2段の描画**（CollageCanvas + ShareToast を mount）
  - BoardRoot の描画に追加（`sharePhase === 'arrange'` のとき）:
```tsx
{sharePhase === 'arrange' && (
  <>
    <CollageCanvas
      items={lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId)).map((it) => ({
        id: it.bookmarkId, title: it.title, thumbnailUrl: it.thumbnail ?? null, url: it.url,
      }))}
      positions={collagePositions}
      order={collageOrder}
      onMove={(id, x, y) => setCollagePositions((p) => moveElement(p, id, x, y))}
      onResize={(id, w) => setCollagePositions((p) => resizeElement(p, id, w))}
      onGrab={(id) => setCollageOrder((o) => bringToFront(o, id))}
      themeId={themeId}
    />
    <ShareToast
      count={selectedIds.size}
      onReselect={() => setSharePhase('select')}
      onDone={handleExitShareMode}
    />
  </>
)}
```

- [ ] **Step 7: 離脱で一時状態破棄**
```ts
const handleExitShareMode = useCallback((): void => {
  setSharePhase(null); setSelectedIds(new Set())
  setCollagePositions({}); setCollageOrder([])
}, [])
```
  - [:1966 `handleSelectCancel`](../../../components/board/BoardRoot.tsx#L1966) も `handleExitShareMode` に統合（CANCEL/Esc）。Esc の effect（[:1981-1988](../../../components/board/BoardRoot.tsx#L1981)）は `sharePhase !== null` で発火し `handleExitShareMode` を呼ぶよう更新。

- [ ] **Step 8: 旧 SHARE ドロワー撤去**
  - [`ActiveDrawer`型:168](../../../components/board/BoardRoot.tsx#L168) から `'share'` を削除。`activeDrawer === 'share'` 参照（[:2657](../../../components/board/BoardRoot.tsx#L2657),[:2742](../../../components/board/BoardRoot.tsx#L2742) の `SenderShareModal`）を撤去。**フェーズ3で `SenderShareModal` を裏ヘルパーに縮小するまで、一旦 `SenderShareModal` の描画を消す**（`open` を常に false 相当に）。`onSelectCards`（[:2782](../../../components/board/BoardRoot.tsx#L2782)）関連は SHARE 入口に統合済みなので不要。

- [ ] **Step 9: 型チェック＋既存テスト**
  Run: `rtk tsc && rtk vitest run` / Expected: PASS（`selectMode` 参照残りが無いこと。`board-b0.spec.ts` 等の壊れ既知分は CURRENT_GOAL の N-07 参照で別管理）。

- [ ] **Step 10: 手動検証（ジェスチャは Playwright 不可）**
  `rtk pnpm build` 後ローカルで：SHARE→カード選択→ARRANGE→カードをドラッグ移動/隅リサイズ/掴んで最前面→RESELECT で選択維持のまま戻れる→DONE でグリッド復帰・配置破棄。目視で確認。

- [ ] **Step 11: commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/ShareSelectBar.tsx
rtk git commit -m "feat(share): two-phase SHARE mode wiring (select -> arrange -> screenshot), retire share drawer"
```

**★フェーズ1 出荷チェックポイント**：`rtk tsc && rtk vitest run && rtk pnpm build` 緑 → 本番デプロイして目視。ここまででコアのスクショ共有が動く。

---

# フェーズ2 — 編集できる/動かせるコラージュ見出し（タイトル）

> spec §4。既存の背景ワードマーク（TITLE ボタンの `bgTypoEnabled`）の見た目を流用しつつ、SHARE モードでは文言編集＋ドラッグ移動＋サイズ変更できる要素にする。既定でカードの後ろ。

## Task 5: タイトル設定の純ロジック `lib/share/share-title.ts`

**Files:**
- Create: `lib/share/share-title.ts`, `lib/share/share-title.test.ts`

**Interfaces:**
- Produces: `ShareTitleConfig`, `defaultShareTitleConfig`, `resolveTitleText`, `setTitleSize`, `moveTitle`。

- [ ] **Step 1: 失敗テスト** — `lib/share/share-title.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { defaultShareTitleConfig, resolveTitleText, setTitleSize, moveTitle, TITLE_MIN_PX, TITLE_MAX_PX } from './share-title'

describe('share-title', () => {
  it('default is centered and uses default text (null override)', () => {
    const c = defaultShareTitleConfig(true, 1000, 600)
    expect(c).toMatchObject({ enabled: true, text: null, x: 500, y: 300 })
    expect(resolveTitleText(c, 'my tag')).toBe('my tag')
  })
  it('disabled resolves to empty string', () => {
    const c = { ...defaultShareTitleConfig(true, 1000, 600), enabled: false }
    expect(resolveTitleText(c, 'my tag')).toBe('')
  })
  it('override text wins over default', () => {
    const c = { ...defaultShareTitleConfig(true, 1000, 600), text: 'SUMMER' }
    expect(resolveTitleText(c, 'my tag')).toBe('SUMMER')
  })
  it('setTitleSize clamps', () => {
    const c = defaultShareTitleConfig(true, 1000, 600)
    expect(setTitleSize(c, 5).size).toBe(TITLE_MIN_PX)
    expect(setTitleSize(c, 99999).size).toBe(TITLE_MAX_PX)
  })
  it('moveTitle sets x/y', () => {
    const c = moveTitle(defaultShareTitleConfig(true, 1000, 600), 12, 34)
    expect(c).toMatchObject({ x: 12, y: 34 })
  })
})
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run lib/share/share-title.test.ts` / Expected: FAIL

- [ ] **Step 3: 実装** — `lib/share/share-title.ts`

```ts
export type ShareTitleConfig = {
  readonly enabled: boolean
  readonly text: string | null // null = 既定（絞り込み中のタグ名）を使う
  readonly size: number        // フォント px
  readonly x: number
  readonly y: number
}

export const TITLE_DEFAULT_PX = 120
export const TITLE_MIN_PX = 24
export const TITLE_MAX_PX = 800

export function defaultShareTitleConfig(enabled: boolean, viewportW: number, viewportH: number): ShareTitleConfig {
  return { enabled, text: null, size: TITLE_DEFAULT_PX, x: Math.round(viewportW / 2), y: Math.round(viewportH / 2) }
}

export function resolveTitleText(c: ShareTitleConfig, defaultText: string): string {
  if (!c.enabled) return ''
  return c.text === null ? defaultText : c.text
}

export function setTitleSize(c: ShareTitleConfig, next: number): ShareTitleConfig {
  return { ...c, size: Math.max(TITLE_MIN_PX, Math.min(TITLE_MAX_PX, next)) }
}

export function moveTitle(c: ShareTitleConfig, x: number, y: number): ShareTitleConfig {
  return { ...c, x, y }
}
```

- [ ] **Step 4: 通過確認** — Run: `rtk vitest run lib/share/share-title.test.ts` / Expected: PASS
- [ ] **Step 5: commit** — `rtk git add lib/share/share-title.ts lib/share/share-title.test.ts && rtk git commit -m "feat(share): ShareTitleConfig pure helpers"`

## Task 6: タイトル要素 `components/board/ShareTitleElement.tsx`

**Files:**
- Create: `components/board/ShareTitleElement.tsx`
- Reference/reuse: [components/board/BoardBackgroundTypography.module.css](../../../components/board/BoardBackgroundTypography.module.css)（ワードマークの書体・見た目を流用）、[BoardBackgroundTypography.tsx](../../../components/board/BoardBackgroundTypography.tsx)（**改変しない**＝「mounted==visible・状態なし」の信頼契約を保つため、編集/移動する版は別コンポーネントにする＝spec §4 の「見た目を流用」の実装解）。

**Interfaces:**
- Consumes: `ShareTitleConfig`/`resolveTitleText`/`setTitleSize`/`moveTitle`（Task 5）。
- Produces: `ShareTitleElement`:
```ts
type ShareTitleElementProps = {
  readonly config: ShareTitleConfig
  readonly defaultText: string
  readonly onChange: (next: ShareTitleConfig) => void
}
```

- [ ] **Step 1: 実装**（背景層・inline 編集・ドラッグ・隅リサイズ）
  - ルートは `position:absolute; transform: translate(x,y)`、フォントサイズ = `config.size`。文言 = `resolveTitleText(config, defaultText)`。空なら描画しない。
  - テキストは `contentEditable`（クリックで編集 → `onInput` で `onChange({ ...config, text: el.textContent })`）。
  - ドラッグ移動＝Task 2 と同型（`onChange(moveTitle(config, ...))`）。隅リサイズ＝`onChange(setTitleSize(config, ...))`。`setPointerCapture` は try/catch。
  - 既存ワードマーク CSS クラス（`BoardBackgroundTypography.module.css` の `.text` 相当）を import して字面を合わせる（`clamp` のサイズ固定は上書きし、`config.size` を優先）。

- [ ] **Step 2: マウントテスト** — `ShareTitleElement.test.tsx`：`config.text=null, defaultText='my tag'` → `my tag` が出る／`enabled:false` → 何も描画しない。Run: `rtk vitest run components/board/ShareTitleElement.test.tsx` / Expected: PASS。
- [ ] **Step 3: commit** — `rtk git add components/board/ShareTitleElement.tsx components/board/ShareTitleElement.test.tsx && rtk git commit -m "feat(share): editable/draggable collage title element"`

## Task 7: タイトルを CollageCanvas / BoardRoot に接続

**Files:** Modify [components/board/CollageCanvas.tsx](../../../components/board/CollageCanvas.tsx)、[components/board/BoardRoot.tsx](../../../components/board/BoardRoot.tsx)

- [ ] **Step 1: CollageCanvas にタイトル層を追加** — props に `title: { config, defaultText, onChange }` を足し、**カード層より下（z 小）**に `ShareTitleElement` を描画（spec：既定でカードの後ろ）。
- [ ] **Step 2: BoardRoot にタイトル状態** — `const [shareTitle, setShareTitle] = useState<ShareTitleConfig | null>(null)`。`handleEnterArrange` の中で `setShareTitle(defaultShareTitleConfig(bgTypoEnabled, viewport.w, viewport.h))`。`defaultText = deriveBoardBgTypoText(activeFilter, tags)`（[BoardBackgroundTypography.tsx:62](../../../components/board/BoardBackgroundTypography.tsx#L62)）。
- [ ] **Step 3: TITLE トグル連動** — SHARE モード中も既存 TITLE `ChromeLedToggle`（[:2397](../../../components/board/BoardRoot.tsx#L2397)）をそのまま使う。`handleToggleBgTypo` が `bgTypoEnabled` を変えるので、arrange 中は `shareTitle.enabled` にも反映（`sharePhase==='arrange'` のとき `setShareTitle((c) => c && { ...c, enabled: next })`）。
- [ ] **Step 4: 離脱で破棄** — `handleExitShareMode` に `setShareTitle(null)` を追加。
- [ ] **Step 5: tsc + 手動検証** — `rtk tsc && rtk vitest run`。手動：arrange でタイトルが出る／クリックで文言編集／ドラッグ移動／隅で拡大（巨大化・盤面横断OK）／TITLE off で消える／カードの後ろに出る。
- [ ] **Step 6: commit** — `rtk git add components/board/CollageCanvas.tsx components/board/BoardRoot.tsx && rtk git commit -m "feat(share): wire editable collage title into arrange mode"`

**★フェーズ2 出荷チェックポイント**：ゲート緑 → デプロイ目視。

---

# フェーズ3 — 取り込みリンク併記（任意アクション）

> spec §7。**サーバーが thumb 必須**なので、出荷済みの「thumb 生成＋/s 作成」パスを**裏で回すヘッドレスヘルパー**に縮小し、トーストの「COPY LINK」から呼ぶ。ユーザーが貼るのはスクショ、これはリンクの OG プレビュー用。

## Task 8: リンク生成の純オーケストレーション `lib/share/create-import-link.ts`

**Files:** Create `lib/share/create-import-link.ts`, `lib/share/create-import-link.test.ts`
**Reference:** [SenderShareModal.tsx:120-160 `handleShareConfirm`](../../../components/share/SenderShareModal.tsx#L120)（現状の直列処理）、[lib/share/api-client.ts:8-24 `createShare`](../../../lib/share/api-client.ts#L8)（`(entry:{share,thumb?}) → Promise<{ok:true,data:{id,expiresAt}}|{ok:false,error,message}>`）。

**Interfaces:**
- Produces: `createImportLink`（thumb 生成は DOM 依存なので**注入**し、本モジュールは orchestration だけをテスト）:
```ts
type CreateImportLinkResult = { ok: true; url: string } | { ok: false; message: string }
```

- [ ] **Step 1: 失敗テスト** — `lib/share/create-import-link.test.ts`（`createShareFn` と `buildThumb` をモック）

```ts
import { describe, it, expect, vi } from 'vitest'
import { createImportLink } from './create-import-link'
import type { ShareDataV2 } from './types-v2'

const share = { v: 2, cards: [], createdAt: 0 } as unknown as ShareDataV2

it('returns /s url on success', async () => {
  const createShareFn = vi.fn<(e: { share: ShareDataV2; thumb?: string }) => Promise<{ ok: true; data: { id: string; expiresAt: number } }>>()
    .mockResolvedValue({ ok: true, data: { id: 'abc123', expiresAt: 1 } })
  const r = await createImportLink({
    getShareData: () => share,
    buildThumb: async () => 'data:image/webp;base64,xxx',
    origin: 'https://allmarks.app',
    createShareFn,
  })
  expect(r).toEqual({ ok: true, url: 'https://allmarks.app/s/abc123' })
})

it('fails when the thumbnail cannot be produced', async () => {
  const r = await createImportLink({ getShareData: () => share, buildThumb: async () => null, origin: 'o', createShareFn: vi.fn() })
  expect(r.ok).toBe(false)
})

it('propagates a createShare error', async () => {
  const createShareFn = vi.fn().mockResolvedValue({ ok: false, error: 'X', message: 'boom' })
  const r = await createImportLink({ getShareData: () => share, buildThumb: async () => 'data:image/webp;base64,x', origin: 'o', createShareFn })
  expect(r).toEqual({ ok: false, message: 'boom' })
})
```
（`vi.fn` は単一ジェネリック形＝memory `reference_vitest4_vi_fn_generic`。）

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run lib/share/create-import-link.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装**

```ts
import { createShare } from '@/lib/share/api-client'
import type { ShareDataV2 } from '@/lib/share/types-v2'

export type CreateImportLinkResult = { ok: true; url: string } | { ok: false; message: string }

export async function createImportLink(input: {
  getShareData: () => ShareDataV2
  buildThumb: () => Promise<string | null>
  origin: string
  createShareFn?: typeof createShare
}): Promise<CreateImportLinkResult> {
  const share = input.getShareData()
  const thumb = await input.buildThumb()
  if (!thumb) return { ok: false, message: 'IMAGE_CAPTURE_FAILED' }
  const fn = input.createShareFn ?? createShare
  const result = await fn({ share, thumb })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true, url: `${input.origin}/s/${result.data.id}` }
}
```

- [ ] **Step 4: 通過確認** — Run: `rtk vitest run lib/share/create-import-link.test.ts` / Expected: PASS
- [ ] **Step 5: commit** — `rtk git add lib/share/create-import-link.ts lib/share/create-import-link.test.ts && rtk git commit -m "feat(share): headless import-link orchestration"`

## Task 9: トーストに COPY LINK・裏 thumb 生成・SenderShareModal 縮小

**Files:** Modify [components/board/ShareToast.tsx](../../../components/board/ShareToast.tsx)、[components/board/BoardRoot.tsx](../../../components/board/BoardRoot.tsx)、[components/share/SenderShareModal.tsx](../../../components/share/SenderShareModal.tsx)

- [ ] **Step 1: ShareToast に COPY LINK ボタン** — props に `onCopyLink: () => void` と `linkState: 'idle'|'working'|'copied'|'error'` を足し、`SHARING…` 行に「COPY LINK / COPYING… / COPIED / RETRY」を表示（`ShareSelectBar` の COPY フィードバック様式）。
- [ ] **Step 2: 裏 thumb 生成の再利用** — BoardRoot に、arrange の選択集合を対象にした**隠し `ShareMirror` capture ノード**（[SenderShareModal.tsx:266-285](../../../components/share/SenderShareModal.tsx#L266) と同じ構造）を `sharePhase==='arrange'` の間だけ mount（画面外・不可視）。`buildThumb = () => renderShareImage(node) ?? captureMirrorToWebP(node)`（[SenderShareModal.tsx:124-148](../../../components/share/SenderShareModal.tsx#L124) の capture ブロックを流用）。※ dom-to-image は可視サブツリー前提（memory `reference_dom_to_image_bound_subtree`）＝表示中のノードを対象にする。
- [ ] **Step 3: COPY LINK ハンドラ** — `createImportLink({ getShareData: buildShareData, buildThumb, origin: window.location.origin })` → 成功で `navigator.clipboard.writeText(url)` → `linkState='copied'`（1.5s で idle）。失敗は `linkState='error'`（既存トーンの穏やかな通知）。`buildShareData` は既存（[BoardRoot.tsx:2004-2042](../../../components/board/BoardRoot.tsx#L2004)）を選択集合で呼ぶ。
- [ ] **Step 4: SenderShareModal 可視 UI 撤去** — [SenderShareModal.tsx](../../../components/share/SenderShareModal.tsx) の描画（ChromeDrawer シェル・on-screen `ShareMirror` プレビュー・SAVE IMAGE・POST TO X・SELECT CARDS）と BoardRoot からの `SenderShareModal` 描画を削除。**`render-share-image.ts`・`capture-mirror.ts`・`ShareMirror.tsx` は残す**（Step 2 の thumb 生成に使う）。`share-image-filename.ts`・`handleSaveImage` は未使用になるので削除可。
- [ ] **Step 5: tsc + vitest + 手動** — `rtk tsc && rtk vitest run`。手動：arrange で COPY LINK → クリップボードに `/s/<id>`。別タブで開いて取り込めることを目視（受け取り側は不変）。スクショ＋リンク併記できることを確認。
- [ ] **Step 6: commit** — `rtk git add -A && rtk git commit -m "feat(share): COPY LINK co-post from toast; shrink share modal to headless link helper"`

## Task 10: 最終クリーンアップ・全体検証・デプロイ

- [ ] **Step 1: 死にコード掃除** — `ActiveDrawer` から `'share'` 完全除去済みを確認。未使用 import / `shareSelectedIds`・`selectionScrollY` 等の旧選択プレビュー専用 state で不要になったものを削除。`rtk tsc` で未使用検出。
- [ ] **Step 2: 全テスト** — `rtk vitest run`（既存 `ShareSelectBar.test.tsx` の primary ラベル変更に追随。`SenderShareModal` 関連テストの撤去/更新）。Expected: PASS（tsc 0）。
- [ ] **Step 3: build** — `rtk pnpm build`（`out/` 生成確認・memory `reference_pnpm_build_required`）。
- [ ] **Step 4: デプロイ＋本番目視** — `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true` → `allmarks.app` をハードリロードして全フロー目視（memory `feedback_prod_is_default`）。
- [ ] **Step 5: docs 更新** — TODO.md の N-34/36/37/38 を完了へ、TODO_COMPLETED に narrative、CURRENT_GOAL 更新。commit。

**★フェーズ3 出荷チェックポイント**：スクショ共有＋任意リンク併記＝spec 完了。

---

## Self-Review（この plan と spec の突合）

- **spec §1 全体フロー** → Task 4（入口/遷移/離脱）✓
- **spec §2 第1段選ぶ** → Task 4 Step1/5（s157 流用・ARRANGE リラベル）✓
- **spec §3 配置キャンバス/要素モデル** → Task 1（純ロジック）+ Task 2（描画/ジェスチャ）✓
- **spec §4 タイトル** → Task 5/6/7 ✓（BoardBackgroundTypography 本体は不変＝別コンポーネント化の実装解を明記）
- **spec §5 トースト** → Task 3（基本）+ Task 9（COPY LINK）✓
- **spec §6 スクショ導線** → Task 3 Step2（撮り方＋範囲選択の一言）✓
- **spec §7 取り込みリンク（thumb 必須制約）** → Task 8/9（裏 thumb 生成を温存・ヘッドレス化）✓
- **spec §8 撤去** → Task 4 Step8 + Task 9 Step4 + Task 10 ✓
- **spec §10 データ/エラー/テスト** → 各 Task の一時 state・穏やか失敗通知・純関数テスト ✓
- **placeholder スキャン**：TBD/TODO 無し。ジェスチャ系は「純関数テスト＋手動目視」と明示（Playwright ポインタキャプチャ制約の正直な扱い）。
- **型整合**：`CollagePositions`/`CardPosition{x,y,w,h}`/`ShareTitleConfig`/`createImportLink` の戻り型は Task 間で一致。`onShare`→`handleEnterArrange`、`ARRANGE` ラベル一貫。
- **未接地参照チェック**：`computeSkylineLayout`/`createShare`/`buildShareData`/`deriveBoardBgTypoText`/`renderShareImage`/`captureMirrorToWebP`/`ShareMirror` は全て実在（調査で file:line 確認済み）。`aspectRatio` の正確な取得は Task4 Step4 で cards/index.ts を参照する注記あり。
