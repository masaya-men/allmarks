# N-58 段階2: スマホ編集ステージのピンチズーム＋パン（100枚コラージュを実用に）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホのコラージュ編集段（N-58 段階1）で、2 本指ピンチでステージ全体を拡縮・パンできるようにする。1 本指は従来どおりカード操作（移動・リサイズ・回転）。これで上限 100 枚のコラージュがスマホで実用になる（ユーザー確定ゴール s186）。

**Architecture:** 編集中だけ、CollageCanvas と帯ガイドを包む新しい wrapper（`MobileZoomStage`）に CSS transform（`translate + scale`）を掛ける。**撮影直前に transform を IDENTITY に戻してから撮る**ので、撮影系（帯・`fit:'cover'`・`mobileCaptureScale`・dom-to-image）は 1 行も変わらない。カード操作のドラッグ量は screen px なので、ズーム中は**ポインタ差分をズーム倍率で割って**レイアウト座標に戻す（`pointerScale` prop）。2 本目の指が下りた瞬間は、進行中のカード操作を調停役（`CollageGestureArbiter`）で中断してからピンチ追跡に入る。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright

**前提（依存・必ず確認）:** この計画は **n56 計画**（`2026-07-11-n56-mobile-share-image-fix.md`）と **n58 段階1 計画**（`2026-07-11-n58-mobile-collage-editing.md`）の**実装後**に実行する。着手前に次の 2 つを確認し、どちらかが無ければこの計画は実行できない（中断してユーザーに報告する）:

```bash
rtk grep "handleMobileEnterArrange" components/board/BoardRoot.tsx   # 段階1の分割済み関数（ヒット必須）
rtk grep "MobileArrangeBar" components/board -l                       # 段階1の編集バー（ヒット必須）
```

## 設計判断（確定済み・変更しない）

- **方式（ユーザー確定 s186）**: 編集中だけ wrapper に CSS transform（scale+translate）、撮影直前にリセット。撮影系は不変。
- **役割分担**: 2 本指＝ステージ拡縮/パン。1 本指＝カード操作。**1 本指で空白をなぞってもパンしない**（誤操作防止。パンは常に 2 本指）。
- **ピンチ中にカードは動かさない**: 2 本目の指が下りた瞬間、進行中のカード操作（移動/リサイズ/回転）は**その場の状態で中断**する（巻き戻さない。指 2 本がほぼ同時に着地する実際のピンチでは 1 本目の移動量はごく小さい）。
- **ズーム倍率は 1〜6**（`STAGE_ZOOM_MIN`/`STAGE_ZOOM_MAX`）。1 未満（縮小）はしない＝帯が画面に内接する既定の見え方が最小。上限 6 の根拠: 100 枚時のカードは高さ約 24px（390×204 の帯 ÷100 枚）→ 6 倍で約 145px＝指で確実に掴める。**実機の感触で変えるときはこの定数 1 箇所だけ**。
- **ピンチを離した後もズームは維持**（编集続行）。**IDENTITY に戻るのは**: (a) CREATE の撮影直前 (b) ARRANGE 進入時 (c) BACK / DONE / Esc での段の出入り。
- **回転はコード変更不要**: 回転角は「カード中心→ポインタ」の角度で計算しており（screen 座標同士）、一様スケール＋平行移動では角度が保存されるため、ズーム中も正しい。移動とリサイズだけ倍率で割る。
- タブレット（>640px）はデスクトップ経路のまま（この計画の新 UI は全て `isMobile` の内側）。ダブルタップでのズームリセット等の飾りは足さない（YAGNI・実機の要望が出てから）。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止。return type 明示。CSS は `.module.css`。Tailwind / Framer Motion 禁止
- z-index は `BOARD_Z_INDEX`（`lib/board/constants.ts`）の定数のみ（マジックナンバー禁止）。ズーム倍率の範囲も定数（`lib/share/stage-zoom.ts` に集約）
- UI 文言は世界に通じる英語・乾いた事実調。i18n キーは足さない（board chrome は英語リテラルが既定）
- **デスクトップ（>640px）の描画・挙動はバイト同一**。`MobileZoomStage` は `enabled=false`（デスクトップ）のとき wrapper の DOM を一切足さず子をそのまま返す
- **撮影の不変条件を守る**: 帯=中央 1.91:1、`fit:'cover'` 固定、レプリカ禁止、撮影直前に transform を IDENTITY に戻す。撮影系ファイル（`capture-collage.ts` / `mobile-band.ts` / `render-share-image` 系）は**一切変更しない**
- `setPointerCapture` / `hasPointerCapture` は必ず try/catch で包む（jsdom / Playwright の合成ポインタが投げる。既存 `bindPointerGesture` / `ResizeHandle` と同じ流儀）
- git は `rtk` 前置。`--no-verify` 絶対禁止。vitest は `rtk npx vitest run <file>`、Playwright は素の `npx playwright test`（`rtk npx playwright` は壊れる）

## 事実の索引（s187 調査済み。行番号は段階1実装後にズレるので関数名・クラス名で吸収する）

- `CollageCanvas.tsx`（283行・**状態を持たない**。座標/順序/回転は全部 BoardRoot 所有）
  - 共通プランビング `bindPointerGesture(el, pointerId, onMove)`: L85–111。`el.setPointerCapture`（try/catch）→ `pointermove`/`pointerup`/`pointercancel` を **el に** addEventListener。
  - 移動 `handleElementPointerDown`: L113–127。**L125 が座標式** `props.onMove(id, originX + (ev.clientX - startX), originY + (ev.clientY - startY))` ＝ screen px を 1:1 加算（ズーム非対応の根っこ）。
  - 回転 `handleRotatePointerDown`: L134–150。中心は `getBoundingClientRect` から、角度は `pointerAngleDeg`/`rotateFromPointer`（`@/lib/share/collage-rotate`）。**角度はズーム不変なので変更不要**。
  - 各カード要素: `transform: translate(x px, y px) rotate(deg)`（L199）、`data-testid="collage-el-${id}"`（L180）、`onPointerDown`（L202）。
  - root: `styles.root`・`zIndex: BOARD_Z_INDEX.SHARE_CANVAS`・`data-testid="collage-canvas"`（L153）。
- `CollageCanvas.module.css`: `.root { position:absolute; inset:0; isolation:isolate; clip-path: inset(var(--canvas-margin,48px) round var(--canvas-radius,0px)) }`（L5–23）。`.element { touch-action:none }`（L27）。段階1で `@media (max-width:640px) { .root { touch-action:none } }` が追加済みのはず。
- `ResizeHandle.tsx`（253行）: `handlePointerDown` L81–162。`SENSITIVITY = 2.0`（L111）、`totalDx = ev.clientX - startClientX`（L118–119）→ `resizeWidthFromPointer({...})`（L126–136）。**totalDx/totalDy が screen px**（ここも割る）。リスナーは el に張り `end()` L141–155 で解除。ドラッグ開始スロップ 2px（L120）。
- `BoardRoot.tsx`（3626行・段階1実装後は増える）
  - `sharePhase==='arrange'` ブロック: L3560–3612（段階1で `MobileBandOverlay`/`MobileArrangeBar`/`resultScrim` が加わった形になっている）。
  - `boardFrameRef`（L1619）→ `.outerFrame`（L2885–2896）＝撮影対象。`const isMobile = useIsMobile()`（L1073）。
  - 段階1の新関数: `handleMobileEnterArrange` / `handleMobileCaptureAndCreate`（旧 `handleMobileCreateShare` L2454–2513 を二分割したもの）。`handleShareReselect`（L2546–2551）、`handleExitShareMode`（L2228–2238）。
  - state: `sharePhase`(L429) / `collagePositions`(L439) / `collageOrder`(L440) / `collageRotations`(L443) / `mobileBandRect`（段階1で追加）。**ズーム系 state は存在しない（新規）**。
- 枚数上限: `SHARE_LIMITS_V2.MAX_CARDS = 100`（`lib/share/types-v2.ts:115-116`）が選択（`lib/share/selection.ts`）とペイロード（`board-to-share.ts:68`）の両方に効いている。**上限変更は不要**＝この計画は「100 枚を編集できる操作性」だけを足す。
- ピンチの既存実装は**リポジトリに皆無**（`Math.hypot` は全部 1 本指のドラッグ距離判定）。ジェスチャ基盤は PointerEvent + `setPointerCapture` で統一。
- e2e: `tests/e2e/mobile-share.spec.ts`。`seedBoard(page)`（L21–62・`SEED_COUNT=28`・IDB `booklage-db` を**バージョン指定なしで** open・`bookmarks/cards/settings` に put）、`stubCreate(page)`（L66–72）。phone プロジェクトは 390×844・hasTouch。
- 単体テストの流儀: `ResizeHandle.test.tsx` = `fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX, clientY })` → `fireEvent.pointerMove(el, {...})` が**この repo で実績のある駆動方法**（リスナーが el 直付けだから成立する）。`CollageCanvas.test.tsx` には `makeItem()` ヘルパーと IntersectionObserver の stub がある（流用する）。

---

### Task 1: 純関数 `lib/share/stage-zoom.ts`（ズーム数学＋ジェスチャ調停役） 【Haiku 可】

**Files:**
- Create: `lib/share/stage-zoom.ts`
- Test: `lib/share/stage-zoom.test.ts`

**Interfaces:**
- Produces:
  - `type StageTransform = { readonly scale: number; readonly tx: number; readonly ty: number }`
  - `type StagePoint = { readonly x: number; readonly y: number }`
  - `IDENTITY_STAGE_TRANSFORM: StageTransform` / `STAGE_ZOOM_MIN = 1` / `STAGE_ZOOM_MAX = 6`
  - `clampStageTransform(t: StageTransform, viewportW: number, viewportH: number): StageTransform`
  - `pinchStageTransform(args): StageTransform`（ピンチ開始基準の絶対計算＝誤差が溜まらない）
  - `type CollageGestureArbiter = { register; clear; cancelActive }` / `createCollageGestureArbiter(): CollageGestureArbiter`

- [ ] **Step 1: Write the failing test**

`lib/share/stage-zoom.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  clampStageTransform,
  createCollageGestureArbiter,
  IDENTITY_STAGE_TRANSFORM,
  pinchStageTransform,
  STAGE_ZOOM_MAX,
} from './stage-zoom'

const VW = 390
const VH = 844

describe('clampStageTransform', () => {
  it('clamps scale into [1, MAX] and pins translate to the origin at scale 1', () => {
    expect(clampStageTransform({ scale: 0.4, tx: 50, ty: -9999 }, VW, VH)).toEqual({ scale: 1, tx: 0, ty: 0 })
    const t = clampStageTransform({ scale: 100, tx: 5, ty: 5 }, VW, VH)
    expect(t.scale).toBe(STAGE_ZOOM_MAX)
    expect(t.tx).toBe(0)
    expect(t.ty).toBe(0)
  })

  it('keeps a legal transform untouched', () => {
    expect(clampStageTransform({ scale: 2, tx: -100, ty: -200 }, VW, VH)).toEqual({ scale: 2, tx: -100, ty: -200 })
  })

  it('clamps translate so the zoomed stage always covers the screen', () => {
    // scale 2 → tx ∈ [-390, 0], ty ∈ [-844, 0]
    expect(clampStageTransform({ scale: 2, tx: -500, ty: 10 }, VW, VH)).toEqual({ scale: 2, tx: -390, ty: 0 })
  })
})

describe('pinchStageTransform', () => {
  it('spreading two fingers zooms in around their midpoint', () => {
    const next = pinchStageTransform({
      base: IDENTITY_STAGE_TRANSFORM,
      startA: { x: 150, y: 400 },
      startB: { x: 250, y: 400 }, // 距離100・中点(200,400)
      currA: { x: 100, y: 400 },
      currB: { x: 300, y: 400 }, // 距離200 → 2倍
      viewportW: VW,
      viewportH: VH,
    })
    expect(next.scale).toBeCloseTo(2)
    // 開始中点(200,400)の下のコンテンツ点が中点の下に留まる: tx = 200 - 200*2, ty = 400 - 400*2
    expect(next.tx).toBeCloseTo(-200)
    expect(next.ty).toBeCloseTo(-400)
  })

  it('moving both fingers together pans (scale unchanged)', () => {
    const next = pinchStageTransform({
      base: { scale: 2, tx: -100, ty: -100 },
      startA: { x: 100, y: 300 },
      startB: { x: 200, y: 300 },
      currA: { x: 130, y: 340 },
      currB: { x: 230, y: 340 }, // 距離不変・中点が(+30,+40)
      viewportW: VW,
      viewportH: VH,
    })
    expect(next.scale).toBeCloseTo(2)
    expect(next.tx).toBeCloseTo(-70)
    expect(next.ty).toBeCloseTo(-60)
  })

  it('never zooms below 1 and stays clamped to the screen', () => {
    const zoomedOut = pinchStageTransform({
      base: IDENTITY_STAGE_TRANSFORM,
      startA: { x: 100, y: 400 },
      startB: { x: 300, y: 400 },
      currA: { x: 190, y: 400 },
      currB: { x: 210, y: 400 }, // つまむ → 0.1倍相当
      viewportW: VW,
      viewportH: VH,
    })
    expect(zoomedOut).toEqual(IDENTITY_STAGE_TRANSFORM)
  })

  it('a degenerate start distance (same point) keeps the base scale', () => {
    const next = pinchStageTransform({
      base: { scale: 3, tx: -50, ty: -50 },
      startA: { x: 100, y: 100 },
      startB: { x: 100, y: 100 },
      currA: { x: 100, y: 100 },
      currB: { x: 300, y: 300 },
      viewportW: VW,
      viewportH: VH,
    })
    expect(next.scale).toBe(3)
  })
})

describe('createCollageGestureArbiter', () => {
  it('cancelActive runs the registered cancel exactly once', () => {
    const arbiter = createCollageGestureArbiter()
    const cancel = vi.fn()
    arbiter.register(cancel)
    arbiter.cancelActive()
    arbiter.cancelActive()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('clear forgets the gesture without running it', () => {
    const arbiter = createCollageGestureArbiter()
    const cancel = vi.fn()
    arbiter.register(cancel)
    arbiter.clear()
    arbiter.cancelActive()
    expect(cancel).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run lib/share/stage-zoom.test.ts
```

Expected: FAIL — `./stage-zoom` が存在しない。

- [ ] **Step 3: Implement**

`lib/share/stage-zoom.ts`:

```ts
/** N-58 段階2: スマホのコラージュ編集ステージのピンチズーム＋パンの数学と、
 *  「2 本目の指が下りたらカード操作を止める」ための調停役。
 *  撮影系はこのモジュールを知らない（撮影直前に IDENTITY へ戻すのは BoardRoot の責務）。 */

/** ステージのズーム/パン状態。screen = content * scale + (tx, ty)。
 *  CSS では `transform: translate(txpx, typx) scale(scale)`（transform-origin: 0 0）に対応。 */
export type StageTransform = {
  readonly scale: number
  readonly tx: number
  readonly ty: number
}

export type StagePoint = { readonly x: number; readonly y: number }

export const IDENTITY_STAGE_TRANSFORM: StageTransform = { scale: 1, tx: 0, ty: 0 }

/** ズーム倍率の範囲。1 = 等倍（帯が画面に内接する既定の見え方）が最小。
 *  上限 6 は「100 枚時の最小カード（高さ約24px）が指で掴める大きさになる」目安。
 *  実機の感触で調整するときはここだけ変える。 */
export const STAGE_ZOOM_MIN = 1
export const STAGE_ZOOM_MAX = 6

/** scale/tx/ty を「拡大したステージが常に画面全体を覆う」範囲に収める。
 *  ステージは viewport と同寸・原点(0,0)・transform-origin 0 0 なので、
 *  拡大後の範囲 [t, t + size*scale] が [0, size] を包含する条件は size*(1-scale) <= t <= 0。 */
export function clampStageTransform(
  t: StageTransform,
  viewportW: number,
  viewportH: number,
): StageTransform {
  const scale = Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, t.scale))
  const tx = Math.min(0, Math.max(viewportW * (1 - scale), t.tx))
  const ty = Math.min(0, Math.max(viewportH * (1 - scale), t.ty))
  return { scale, tx, ty }
}

/** 2 本指ピンチの現在フレームの transform。ピンチ開始時点（base/startA/startB）を
 *  基準に毎フレーム絶対計算する（増分の積み上げをしない＝誤差が溜まらない）。
 *  「開始時に 2 指の中点の下にあったコンテンツ点が、今の中点の下に居続ける」ように
 *  scale と translate を同時に解く。 */
export function pinchStageTransform(args: {
  readonly base: StageTransform
  readonly startA: StagePoint
  readonly startB: StagePoint
  readonly currA: StagePoint
  readonly currB: StagePoint
  readonly viewportW: number
  readonly viewportH: number
}): StageTransform {
  const d0 = Math.hypot(args.startB.x - args.startA.x, args.startB.y - args.startA.y)
  const d1 = Math.hypot(args.currB.x - args.currA.x, args.currB.y - args.currA.y)
  const factor = d0 > 0 ? d1 / d0 : 1
  const scale = Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, args.base.scale * factor))
  const mid0 = { x: (args.startA.x + args.startB.x) / 2, y: (args.startA.y + args.startB.y) / 2 }
  const mid1 = { x: (args.currA.x + args.currB.x) / 2, y: (args.currA.y + args.currB.y) / 2 }
  const contentX = (mid0.x - args.base.tx) / args.base.scale
  const contentY = (mid0.y - args.base.ty) / args.base.scale
  return clampStageTransform(
    { scale, tx: mid1.x - contentX * scale, ty: mid1.y - contentY * scale },
    args.viewportW,
    args.viewportH,
  )
}

/** 1 本指のカード操作（移動/リサイズ/回転）を、2 本目の指が下りた瞬間に中断する調停役。
 *  CollageCanvas / ResizeHandle がジェスチャ開始時に自分の後始末（リスナー解除）を
 *  register し、MobileZoomStage がピンチ開始時に cancelActive を呼ぶ。
 *  同時に生きるカード操作は常に 1 つ（2 本目の指はピンチに化けるので 2 つ目のカード操作は始まらない）。 */
export type CollageGestureArbiter = {
  readonly register: (cancel: () => void) => void
  readonly clear: () => void
  readonly cancelActive: () => void
}

export function createCollageGestureArbiter(): CollageGestureArbiter {
  let active: (() => void) | null = null
  return {
    register: (cancel: () => void): void => {
      active = cancel
    },
    clear: (): void => {
      active = null
    },
    cancelActive: (): void => {
      const cancel = active
      active = null
      if (cancel) cancel()
    },
  }
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run lib/share/stage-zoom.test.ts
rtk git add lib/share/stage-zoom.ts lib/share/stage-zoom.test.ts
rtk git commit -m "feat(share): stage-zoom math + gesture arbiter for mobile pinch zoom (N-58 stage 2)"
```

---

### Task 2: `MobileZoomStage`（ピンチを解釈する覗き窓＋transform 層） 【Sonnet 推奨・写経すれば Haiku 可】

**Files:**
- Create: `components/board/MobileZoomStage.tsx`
- Create: `components/board/MobileZoomStage.module.css`
- Test: `components/board/MobileZoomStage.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `StageTransform` / `StagePoint` / `pinchStageTransform`
- Produces: `MobileZoomStage({ enabled, transform, onTransformChange, onPinchStart?, children })`
  - `enabled=false`（デスクトップ）では **wrapper DOM を足さず** `<>{children}</>` を返す＝バイト同一
  - `data-testid="mobile-zoom-viewport"`（覗き窓）/ `data-testid="mobile-zoom-stage"`（transform が乗る層）

- [ ] **Step 1: Write the failing test**

`components/board/MobileZoomStage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IDENTITY_STAGE_TRANSFORM } from '@/lib/share/stage-zoom'
import { MobileZoomStage } from './MobileZoomStage'

/** jsdom の getBoundingClientRect は全て 0 を返すので、覗き窓に 390×844 の矩形を仕込む。 */
function mockRect(el: HTMLElement): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: (): object => ({}) }),
  })
}

describe('MobileZoomStage', () => {
  it('renders children without any wrapper when disabled (desktop stays byte-identical)', () => {
    render(
      <MobileZoomStage enabled={false} transform={IDENTITY_STAGE_TRANSFORM} onTransformChange={() => {}}>
        <div data-testid="child" />
      </MobileZoomStage>,
    )
    expect(screen.getByTestId('child')).toBeTruthy()
    expect(screen.queryByTestId('mobile-zoom-viewport')).toBeNull()
    expect(screen.queryByTestId('mobile-zoom-stage')).toBeNull()
  })

  it('applies the transform to the stage layer', () => {
    render(
      <MobileZoomStage enabled={true} transform={{ scale: 2, tx: -10, ty: -20 }} onTransformChange={() => {}}>
        <div />
      </MobileZoomStage>,
    )
    expect(screen.getByTestId('mobile-zoom-stage').style.transform).toBe('translate(-10px, -20px) scale(2)')
  })

  it('a second finger starts a pinch: fires onPinchStart once and reports a zoomed transform', () => {
    const onTransformChange = vi.fn()
    const onPinchStart = vi.fn()
    render(
      <MobileZoomStage enabled={true} transform={IDENTITY_STAGE_TRANSFORM} onTransformChange={onTransformChange} onPinchStart={onPinchStart}>
        <div />
      </MobileZoomStage>,
    )
    const vp = screen.getByTestId('mobile-zoom-viewport')
    mockRect(vp)
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    expect(onPinchStart).not.toHaveBeenCalled()
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 })
    expect(onPinchStart).toHaveBeenCalledTimes(1)
    // 指間 100 → 180 に開く → scale 1.8
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 330, clientY: 400 })
    expect(onTransformChange).toHaveBeenCalled()
    const last = onTransformChange.mock.calls[onTransformChange.mock.calls.length - 1]?.[0] as { scale: number }
    expect(last.scale).toBeCloseTo(1.8)
  })

  it('a single finger never zooms', () => {
    const onTransformChange = vi.fn()
    const onPinchStart = vi.fn()
    render(
      <MobileZoomStage enabled={true} transform={IDENTITY_STAGE_TRANSFORM} onTransformChange={onTransformChange} onPinchStart={onPinchStart}>
        <div />
      </MobileZoomStage>,
    )
    const vp = screen.getByTestId('mobile-zoom-viewport')
    mockRect(vp)
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(vp, { pointerId: 1, clientX: 300, clientY: 300 })
    expect(onPinchStart).not.toHaveBeenCalled()
    expect(onTransformChange).not.toHaveBeenCalled()
  })

  it('lifting either finger ends the pinch', () => {
    const onTransformChange = vi.fn()
    render(
      <MobileZoomStage enabled={true} transform={IDENTITY_STAGE_TRANSFORM} onTransformChange={onTransformChange} onPinchStart={() => {}}>
        <div />
      </MobileZoomStage>,
    )
    const vp = screen.getByTestId('mobile-zoom-viewport')
    mockRect(vp)
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 })
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 330, clientY: 400 })
    const callsBefore = onTransformChange.mock.calls.length
    fireEvent.pointerUp(vp, { pointerId: 1, clientX: 150, clientY: 400 })
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 200, clientY: 200 })
    expect(onTransformChange.mock.calls.length).toBe(callsBefore)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run components/board/MobileZoomStage.test.tsx
```

- [ ] **Step 3: Implement**

`components/board/MobileZoomStage.tsx`:

```tsx
'use client'

import { useRef, type PointerEvent, type ReactElement, type ReactNode } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { pinchStageTransform, type StagePoint, type StageTransform } from '@/lib/share/stage-zoom'
import styles from './MobileZoomStage.module.css'

export type MobileZoomStageProps = {
  /** false（デスクトップ）なら wrapper DOM を一切足さず子をそのまま返す。 */
  readonly enabled: boolean
  /** 現在のステージ transform（BoardRoot 所有。撮影直前に IDENTITY へ戻すのも BoardRoot）。 */
  readonly transform: StageTransform
  /** ピンチ中に毎フレーム呼ばれる。 */
  readonly onTransformChange: (next: StageTransform) => void
  /** 2 本目の指が下りてピンチが始まる瞬間に 1 回呼ぶ（進行中のカード操作の中断用）。 */
  readonly onPinchStart?: () => void
  readonly children: ReactNode
}

type PinchState = {
  readonly idA: number
  readonly idB: number
  readonly startA: StagePoint
  readonly startB: StagePoint
  readonly base: StageTransform
  readonly viewportW: number
  readonly viewportH: number
}

/** スマホのコラージュ編集ステージのピンチズーム＋パン（N-58 段階2）。
 *  内側の stage 層に CSS transform を掛けるだけで、子（CollageCanvas・帯ガイド）の
 *  レイアウト座標は一切変えない。2 本指 = ステージ、1 本指 = 子のカード操作:
 *  2 本目の pointerdown を capture 相で握り、伝播を止めて（＝2 つ目のカード操作を
 *  始めさせず）onPinchStart で進行中のカード操作を中断してからピンチ追跡に入る。 */
export function MobileZoomStage(props: MobileZoomStageProps): ReactElement {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointers = useRef<Map<number, StagePoint>>(new Map())
  const pinch = useRef<PinchState | null>(null)

  if (!props.enabled) return <>{props.children}</>

  const toLocal = (e: PointerEvent<HTMLDivElement>): StagePoint => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const handlePointerDownCapture = (e: PointerEvent<HTMLDivElement>): void => {
    pointers.current.set(e.pointerId, toLocal(e))
    if (pinch.current !== null || pointers.current.size !== 2) return
    // ここからピンチ: この pointerdown が新しいカード操作を始めないよう伝播を止め、
    // 進行中のカード操作（1 本目の指）を中断する。
    e.stopPropagation()
    props.onPinchStart?.()
    const entries = Array.from(pointers.current.entries())
    const first = entries[0]
    const second = entries[1]
    if (!first || !second) return
    const rect = viewportRef.current?.getBoundingClientRect()
    pinch.current = {
      idA: first[0],
      idB: second[0],
      startA: first[1],
      startB: second[1],
      base: props.transform,
      viewportW: rect?.width ?? 0,
      viewportH: rect?.height ?? 0,
    }
    // 指が画面端やバーの上に滑っても追跡が切れないよう覗き窓に capture する。
    // 合成ポインタ（Playwright/jsdom）は投げるので握りつぶす（capture 無しでも大抵成立する）。
    const vp = viewportRef.current
    if (vp) {
      try {
        vp.setPointerCapture(first[0])
      } catch {
        /* ignore */
      }
      try {
        vp.setPointerCapture(second[0])
      } catch {
        /* ignore */
      }
    }
  }

  const handlePointerMoveCapture = (e: PointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, toLocal(e))
    const p = pinch.current
    if (p === null || (e.pointerId !== p.idA && e.pointerId !== p.idB)) return
    e.stopPropagation()
    const currA = pointers.current.get(p.idA)
    const currB = pointers.current.get(p.idB)
    if (!currA || !currB) return
    props.onTransformChange(
      pinchStageTransform({
        base: p.base,
        startA: p.startA,
        startB: p.startB,
        currA,
        currB,
        viewportW: p.viewportW,
        viewportH: p.viewportH,
      }),
    )
  }

  const handlePointerEndCapture = (e: PointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(e.pointerId)
    const p = pinch.current
    if (p !== null && (e.pointerId === p.idA || e.pointerId === p.idB)) {
      // 片指が離れたらピンチ終了。ズームは維持（次の 1 本指はカード操作に戻る）。
      pinch.current = null
      e.stopPropagation()
    }
  }

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_CANVAS }}
      data-testid="mobile-zoom-viewport"
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerEndCapture}
      onPointerCancelCapture={handlePointerEndCapture}
    >
      <div
        className={styles.stage}
        data-testid="mobile-zoom-stage"
        style={{ transform: `translate(${props.transform.tx}px, ${props.transform.ty}px) scale(${props.transform.scale})` }}
      >
        {props.children}
      </div>
    </div>
  )
}
```

`components/board/MobileZoomStage.module.css`:

```css
/* N-58 段階2: ピンチズームの覗き窓。拡大した stage を画面サイズで切り取る。
   z-index は SHARE_CANVAS（inline style）— transform が作る stacking context の中に
   CollageCanvas が入るため、覗き窓自体が盤面カード層(z:10)より上に居る必要がある。 */
.viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* 編集ステージ上の指は全部こちらで解釈する（ブラウザのピンチ/スクロールに取られない） */
  touch-action: none;
}

.stage {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  /* transform の実値は inline style（zoom/pan） */
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run components/board/MobileZoomStage.test.tsx
rtk git add components/board/MobileZoomStage.tsx components/board/MobileZoomStage.module.css components/board/MobileZoomStage.test.tsx
rtk git commit -m "feat(board): MobileZoomStage — pinch zoom + pan viewport for the mobile arrange stage (N-58 stage 2)"
```

---

### Task 3: CollageCanvas / ResizeHandle に `pointerScale` と調停役を配線 【Sonnet 推奨】

**Files:**
- Modify: `components/board/CollageCanvas.tsx`
- Modify: `components/board/ResizeHandle.tsx`
- Test: `components/board/CollageCanvas.test.tsx`（既存に追記）
- Test: `components/board/ResizeHandle.test.tsx`（既存に追記）

**Interfaces:**
- Consumes: Task 1 の `CollageGestureArbiter`
- Produces:
  - `CollageCanvasProps` に追加: `readonly pointerScale?: number`（省略時 1）/ `readonly gestureArbiter?: CollageGestureArbiter`
  - `ResizeHandleProps` に追加: 同名 2 prop（省略時は現行と完全一致の挙動）

- [ ] **Step 1: Write the failing tests**

`components/board/CollageCanvas.test.tsx` の `describe('CollageCanvas', …)` 内に追記（`makeItem`/`seedCollagePositions` は同ファイルの既存物を使う）:

```tsx
  it('divides drag deltas by pointerScale so a zoomed stage moves cards in layout px (N-58 stage 2)', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 10, y: 20, w: 200, h: 100 } }
    const onMove = vi.fn()
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={onMove}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        pointerScale={2}
      />,
    )
    const el = getByTestId('collage-el-a')
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 100, clientY: 60 })
    // screen (100,60) ÷ scale 2 = layout (+50,+30)
    expect(onMove).toHaveBeenLastCalledWith('a', 60, 50)
    fireEvent.pointerUp(el, { pointerId: 1 })
  })

  it('cancelActive on the gesture arbiter stops an in-flight drag (pinch takeover)', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 } }
    const onMove = vi.fn()
    const arbiter = createCollageGestureArbiter()
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={onMove}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        gestureArbiter={arbiter}
      />,
    )
    const el = getByTestId('collage-el-a')
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 10, clientY: 0 })
    const callsBefore = onMove.mock.calls.length
    arbiter.cancelActive()
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 200, clientY: 0 })
    expect(onMove.mock.calls.length).toBe(callsBefore)
  })
```

同ファイル先頭の import に追記:

```ts
import { fireEvent } from '@testing-library/react'
import { createCollageGestureArbiter } from '@/lib/share/stage-zoom'
```

（既に `render` を import している行に `fireEvent` を足す形でよい）

`components/board/ResizeHandle.test.tsx` の `describe('ResizeHandle', …)` 内に追記:

```tsx
  it('divides pointer movement by pointerScale (zoomed stage resizes in layout px)', () => {
    const plain = vi.fn()
    const scaled = vi.fn()
    const a = renderInCard({ cardWidth: 240, cardHeight: 300, maxCardWidth: 5000, onResize: plain })
    fireEvent.pointerDown(a.getByTestId('resize-handle-br'), { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(a.getByTestId('resize-handle-br'), { pointerId: 1, clientX: 100, clientY: 100 })
    a.unmount()
    const b = renderInCard({ cardWidth: 240, cardHeight: 300, maxCardWidth: 5000, onResize: scaled, pointerScale: 2 })
    fireEvent.pointerDown(b.getByTestId('resize-handle-br'), { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(b.getByTestId('resize-handle-br'), { pointerId: 1, clientX: 100, clientY: 100 })
    const plainDelta = (plain.mock.calls.at(-1)?.[0] as number) - 240
    const scaledDelta = (scaled.mock.calls.at(-1)?.[0] as number) - 240
    // 同じ screen 移動でも scale 2 では半分のレイアウト移動（幅→ポインタ写像は移動量に対して一次）
    expect(scaledDelta).toBeCloseTo(plainDelta / 2, 5)
  })

  it('cancelActive on the gesture arbiter ends an in-flight resize', () => {
    const onResize = vi.fn()
    const arbiter = createCollageGestureArbiter()
    const { getByTestId } = renderInCard({ cardWidth: 240, cardHeight: 300, maxCardWidth: 1200, onResize, gestureArbiter: arbiter })
    const br = getByTestId('resize-handle-br')
    fireEvent.pointerDown(br, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(br, { pointerId: 1, clientX: 50, clientY: 50 })
    const callsBefore = onResize.mock.calls.length
    arbiter.cancelActive()
    fireEvent.pointerMove(br, { pointerId: 1, clientX: 500, clientY: 500 })
    expect(onResize.mock.calls.length).toBe(callsBefore)
  })
```

同ファイル先頭の import に追記:

```ts
import { createCollageGestureArbiter } from '@/lib/share/stage-zoom'
```

- [ ] **Step 2: Run to verify they fail**

```bash
rtk npx vitest run components/board/CollageCanvas.test.tsx components/board/ResizeHandle.test.tsx
```

Expected: FAIL — `pointerScale` / `gestureArbiter` prop が存在しない（tsc エラー or 未反映）。

- [ ] **Step 3: Implement — CollageCanvas.tsx**

1. import に追加: `import type { CollageGestureArbiter } from '@/lib/share/stage-zoom'`
2. `CollageCanvasProps` の末尾（`title` の後）に追加:

```ts
  /** ステージのズーム倍率（スマホ編集段のみ渡る。省略時 1 = 等倍）。ポインタ差分は
   *  screen px なので、layout 座標へ戻すときこの値で割る（N-58 段階2）。 */
  readonly pointerScale?: number
  /** 2 本指ピンチ開始で進行中のカード操作を中断するための調停役（スマホ編集段のみ）。 */
  readonly gestureArbiter?: CollageGestureArbiter
```

3. `bindPointerGesture`（L85–111）を以下に置き換え（第 4 引数 `arbiter` を追加。他は現状のまま）:

```ts
function bindPointerGesture(
  el: HTMLElement,
  pointerId: number,
  onMove: (ev: globalThis.PointerEvent) => void,
  arbiter?: CollageGestureArbiter,
): void {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    // jsdom / synthetic pointers — capture isn't critical for the drag itself
  }
  const move = (ev: globalThis.PointerEvent): void => {
    onMove(ev)
  }
  const up = (): void => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    try {
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
    } catch {
      // ignore
    }
    arbiter?.clear()
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  // ピンチ（2 本目の指）が始まったら up がそのまま中断処理として呼ばれる
  arbiter?.register(up)
}
```

※ 置き換え時、既存実装の try/catch コメントの文面が上と多少違っても構造が同じなら気にしない（`removeEventListener` 3 本 → capture 解放 → `arbiter?.clear()` の順になっていることが本質）。

4. `handleElementPointerDown`（L113–127）の `bindPointerGesture(...)` 呼び出しを以下に置き換え（関数のその他の行は不変）:

```ts
    // ズーム中は指の移動量(screen px)を倍率で割ってレイアウト座標(等倍px)に戻す（N-58 段階2）。
    // 等倍時は /1 で従来と完全一致。
    const scale = props.pointerScale ?? 1
    bindPointerGesture(
      el,
      e.pointerId,
      (ev) => {
        props.onMove(id, originX + (ev.clientX - startX) / scale, originY + (ev.clientY - startY) / scale)
      },
      props.gestureArbiter,
    )
```

5. `handleRotatePointerDown`（L134–150）の `bindPointerGesture(el, e.pointerId, (ev) => {...})` に第 4 引数 `props.gestureArbiter` を追加するだけ（**角度計算は変更しない**＝一様スケールで角度は不変）。
6. `<ResizeHandle` の JSX（L263–276）に 2 prop を追加: `pointerScale={props.pointerScale}` と `gestureArbiter={props.gestureArbiter}`。

- [ ] **Step 4: Implement — ResizeHandle.tsx**

1. import に追加: `import type { CollageGestureArbiter } from '@/lib/share/stage-zoom'`
2. `ResizeHandleProps` の末尾（`resizeModel` の後）に追加:

```ts
  /** ステージのズーム倍率（SHARE コラージュのスマホ編集段のみ。省略時 1 = 現行と同一挙動）。
   *  ポインタ移動量を layout px に戻すために割る（N-58 段階2）。 */
  readonly pointerScale?: number
  /** 2 本指ピンチ開始で進行中のリサイズを終了させる調停役（同上・省略可）。 */
  readonly gestureArbiter?: CollageGestureArbiter
```

3. `ResizeHandle` 本体（L55–72）: 引数の分割代入に `pointerScale, gestureArbiter` を追加し、4 つの `<Handle …/>` すべてに `pointerScale={pointerScale} gestureArbiter={gestureArbiter}` を追加。
4. `Handle`（L76 の分割代入）にも `pointerScale, gestureArbiter` を追加。
5. `handlePointerDown` 内の変更は 3 箇所:
   - `const SENSITIVITY = 2.0` の直後に追加:

```ts
      const pointerScaleValue = pointerScale ?? 1
```

   - `move`（L117–119）の先頭 2 行を置き換え:

```ts
        const totalDx = (ev.clientX - startClientX) / pointerScaleValue
        const totalDy = (ev.clientY - startClientY) / pointerScaleValue
```

   - `end`（L141–155）の `setResizing(false)` の直前に `gestureArbiter?.clear()` を追加し、`el.addEventListener('pointercancel', end)`（L159）の直後に追加:

```ts
      gestureArbiter?.register(end)
```

   - `useCallback` の依存配列（L161）に `pointerScale, gestureArbiter` を追加。

※ ドラッグ開始スロップ（L120 の `< 2`）は割った後の layout px で判定される＝ズーム 6 倍時は screen 12px。指の操作では誤差の範囲なので変えない。

- [ ] **Step 5: Run to verify they pass → Commit**

```bash
rtk npx vitest run components/board/CollageCanvas.test.tsx components/board/ResizeHandle.test.tsx
rtk git add components/board/CollageCanvas.tsx components/board/ResizeHandle.tsx components/board/CollageCanvas.test.tsx components/board/ResizeHandle.test.tsx
rtk git commit -m "feat(board): pointerScale + gesture arbiter on collage drags (N-58 stage 2)"
```

---

### Task 4: BoardRoot 配線（state・リセット 4 箇所・JSX ラップ・ヒント文言） 【Sonnet 推奨（大ファイルの配線）】

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/MobileArrangeBar.tsx`（ヒント文言 1 行）

**Interfaces:**
- Consumes: Task 1〜3 の全部（`MobileZoomStage` / `stage-zoom` / 新 prop）
- Produces: state `stageTransform: StageTransform`、`collageArbiter: CollageGestureArbiter`（インスタンス 1 個を維持）

- [ ] **Step 1: import と state**

import に追加:

```ts
import { MobileZoomStage } from './MobileZoomStage'
import {
  createCollageGestureArbiter,
  IDENTITY_STAGE_TRANSFORM,
  type CollageGestureArbiter,
  type StageTransform,
} from '@/lib/share/stage-zoom'
```

段階1で追加した `mobileBandRect` の useState 宣言の直後に:

```ts
  // スマホ編集段のステージ拡縮/パン（N-58 段階2）。撮影直前と段の出入りで必ず IDENTITY に戻す。
  const [stageTransform, setStageTransform] = useState<StageTransform>(IDENTITY_STAGE_TRANSFORM)
  // 2 本目の指が下りた瞬間に進行中のカード操作を止める調停役（インスタンスは 1 個を維持）。
  const [collageArbiter] = useState<CollageGestureArbiter>(() => createCollageGestureArbiter())
```

- [ ] **Step 2: リセット 4 箇所**

1. `handleMobileEnterArrange`: `setMobileBandRect(band)` の直後に `setStageTransform(IDENTITY_STAGE_TRANSFORM)`
2. `handleMobileCaptureAndCreate`: `setShareCreateState('creating')` の直後（`let thumb` の前）に追加。撮影は等倍で行う＝編集中のズームは撮影に写さない。既存の「2 フレーム待ち」（double rAF）がこのリセットの paint も保証する:

```ts
    // 撮影は等倍で行う（ズームは編集専用。ここで戻すことで撮影系は transform の存在を知らずに済む）
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
```

3. `handleExitShareMode`: `setCollageRotations({})` の後に `setStageTransform(IDENTITY_STAGE_TRANSFORM)`
4. `handleShareReselect`: `setSharePhase('select')` の前に `setStageTransform(IDENTITY_STAGE_TRANSFORM)`

依存配列の変更は不要（`setStageTransform` は setState で安定）。

- [ ] **Step 3: arrange ブロックの JSX ラップ**

`sharePhase === 'arrange'` ブロック内の、段階1実装後に

```tsx
    <CollageCanvas
      …既存 props…
    />
    {isMobile && mobileBandRect && <MobileBandOverlay band={mobileBandRect} />}
```

となっている 2 つを、次の形に置き換える（**CollageCanvas の既存 props は 1 つも変えずそのまま中に移す**。`MobileArrangeBar` / `resultScrim` / `MobileShareResult` はラップの**外**に残す＝position:fixed が transform の containing block に捕まらない）:

```tsx
    <MobileZoomStage
      enabled={isMobile}
      transform={stageTransform}
      onTransformChange={setStageTransform}
      onPinchStart={collageArbiter.cancelActive}
    >
      <CollageCanvas
        …既存 props をそのまま…
        pointerScale={isMobile ? stageTransform.scale : undefined}
        gestureArbiter={isMobile ? collageArbiter : undefined}
      />
      {isMobile && mobileBandRect && <MobileBandOverlay band={mobileBandRect} />}
    </MobileZoomStage>
```

デスクトップは `enabled=false` → `MobileZoomStage` が `<>{children}</>` を返し、`pointerScale`/`gestureArbiter` は `undefined`（＝`?? 1` と no-op）なので **DOM も挙動もバイト同一**。

- [ ] **Step 4: ヒント文言**

`components/board/MobileArrangeBar.tsx` の `.hint` の文字列を置き換え:

```
PINCH TO ZOOM — DRAG TO ARRANGE — THE BRIGHT BAND BECOMES THE IMAGE
```

（`MobileArrangeBar.test.tsx` はヒント文字列を assert していないので変更不要。もし assert があった場合のみ期待値を追随させる）

- [ ] **Step 5: 検証（単体＋型＋ビルド）**

```bash
rtk tsc
rtk vitest run
pnpm build
```

Expected: tsc 0 / vitest 全緑 / build OK。

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/MobileArrangeBar.tsx
rtk git commit -m "feat(board): pinch zoom + pan on the mobile arrange stage, reset before capture (N-58 stage 2)"
```

---

### Task 5: e2e（100 枚・ピンチ・撮影前リセット・ドラッグ換算） 【Sonnet 推奨】

**Files:**
- Modify: `tests/e2e/mobile-share.spec.ts`

**変更の原則:** 既存テストの検証内容は全部残す。`seedBoard` に枚数引数を足す（既定 28 のまま＝既存テスト不変）。

- [ ] **Step 1: seedBoard の枚数を引数化**

`async function seedBoard(page: Page)` → `async function seedBoard(page: Page, count: number = SEED_COUNT)` にし、関数内の `SEED_COUNT` 参照（seed ループの上限）を `count` に置き換える。`page.evaluate` へは `count` を引数で渡す（evaluate 内はブラウザ側なので closure 不可、既存の渡し方に合わせて第 2 引数で渡す）。

- [ ] **Step 2: 新規テスト 3 本を phone describe に追加**

```ts
  test('100 cards (the SHARE cap) arrange into the band (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page, 100)
    await stubCreate(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await expect(page.getByTestId('mobile-select-counter')).toHaveText('100 / 100 SELECTED')
    await page.getByTestId('mobile-select-create').tap() // ARRANGE
    await expect(page.getByTestId('mobile-arrange-bar')).toBeVisible()
    await expect(page.locator('[data-testid^="collage-el-"]')).toHaveCount(100)
    const band = await page.getByTestId('mobile-band-overlay').boundingBox()
    expect(band).not.toBeNull()
    const boxes = await page.locator('[data-testid^="collage-el-"]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { l: r.left, t: r.top, r: r.right, b: r.bottom }
      }),
    )
    for (const b of boxes) {
      expect(b.l).toBeGreaterThanOrEqual((band?.x ?? 0) - 1)
      expect(b.r).toBeLessThanOrEqual((band?.x ?? 0) + (band?.width ?? 0) + 1)
      expect(b.t).toBeGreaterThanOrEqual((band?.y ?? 0) - 1)
      expect(b.b).toBeLessThanOrEqual((band?.y ?? 0) + (band?.height ?? 0) + 1)
    }
  })

  test('two-finger pinch zooms the stage and CREATE captures at identity zoom (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await page.getByTestId('mobile-select-create').tap()
    await expect(page.getByTestId('mobile-zoom-stage')).toBeVisible()

    // 実タッチのピンチは Playwright で駆動できないので、PointerEvent を直接 dispatch する
    // （setPointerCapture は合成ポインタを拒否するが、実装側が try/catch 済みで追跡は成立する）
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="mobile-zoom-viewport"]')
      if (!vp) throw new Error('viewport not found')
      const fire = (type: string, pointerId: number, x: number, y: number): void => {
        vp.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId,
            clientX: x,
            clientY: y,
            pointerType: 'touch',
            isPrimary: pointerId === 1,
          }),
        )
      }
      fire('pointerdown', 1, 150, 420)
      fire('pointerdown', 2, 250, 420)
      fire('pointermove', 2, 340, 420) // 指間 100 → 190
      fire('pointerup', 1, 150, 420)
      fire('pointerup', 2, 340, 420)
    })
    const zoomed = await page.getByTestId('mobile-zoom-stage').evaluate((el) => (el as HTMLElement).style.transform)
    const scale = Number(/scale\(([\d.]+)\)/.exec(zoomed)?.[1])
    expect(scale).toBeGreaterThan(1.5)

    await page.getByTestId('mobile-arrange-create').tap()
    await expect(page.getByTestId('mobile-share-result')).toBeVisible()
    const after = await page.getByTestId('mobile-zoom-stage').evaluate((el) => (el as HTMLElement).style.transform)
    expect(after).toBe('translate(0px, 0px) scale(1)')
  })

  test('at 2x zoom a 100px finger drag moves a card 50 layout px (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await page.getByTestId('mobile-select-create').tap()
    await expect(page.getByTestId('mobile-zoom-stage')).toBeVisible()

    // ちょうど 2 倍にする（指間 100 → 200）
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="mobile-zoom-viewport"]')
      if (!vp) throw new Error('viewport not found')
      const fire = (type: string, pointerId: number, x: number, y: number): void => {
        vp.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId,
            clientX: x,
            clientY: y,
            pointerType: 'touch',
            isPrimary: pointerId === 1,
          }),
        )
      }
      fire('pointerdown', 1, 150, 420)
      fire('pointerdown', 2, 250, 420)
      fire('pointermove', 2, 350, 420)
      fire('pointerup', 1, 150, 420)
      fire('pointerup', 2, 350, 420)
    })

    const first = page.locator('[data-testid^="collage-el-"]').first()
    const before = await first.evaluate((el) => (el as HTMLElement).style.transform)
    await first.evaluate((el) => {
      const fire = (type: string, pointerId: number, x: number, y: number): void => {
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId,
            clientX: x,
            clientY: y,
            pointerType: 'touch',
            isPrimary: true,
          }),
        )
      }
      fire('pointerdown', 7, 100, 500)
      fire('pointermove', 7, 200, 500) // screen +100px
      fire('pointerup', 7, 200, 500)
    })
    const after = await first.evaluate((el) => (el as HTMLElement).style.transform)
    const beforeX = Number(/translate\((-?[\d.]+)px/.exec(before)?.[1])
    const afterX = Number(/translate\((-?[\d.]+)px/.exec(after)?.[1])
    expect(Math.abs(afterX - beforeX - 50)).toBeLessThanOrEqual(1) // 100 screen px ÷ zoom 2 = +50 layout px
  })
```

- [ ] **Step 3: 実行**

```bash
npx playwright test tests/e2e/mobile-share.spec.ts
```

Expected: 段階1時点の本数＋新規 3 本が全緑。`rtk npx` は使わない（壊れる）。出力の tail は失敗リストであって実行リストではない点に注意。

- [ ] **Step 4: Commit**

```bash
rtk git add tests/e2e/mobile-share.spec.ts
rtk git commit -m "test(e2e): pinch zoom + 100-card arrange + capture-at-identity guards (N-58 stage 2)"
```

---

### Task 6: デプロイ＋実機確認依頼 【どのモデルでも可】

- [ ] **Step 1: 検証一式→デプロイ**

```bash
rtk tsc && rtk vitest run && pnpm build
npx playwright test tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 2: ユーザーへの実機確認依頼（コピペで渡す）**

```
スマホで https://allmarks.app をハードリロードして:
1. SHARE → 全選択（枚数が多いほど良い）→ ARRANGE
2. 2本指でピンチ → ステージが拡大し、2本指のまま動かすと見える場所が動きますか？
3. 拡大したまま、1本指でカードを動かす／四隅で大きさ／ノブで回転。
   → 指の動きとカードの動きが一致していますか（ずれ・すべりがないか）
4. 最大まで拡大／最小（等倍）まで戻す。倍率の上限・下限の感触はどうですか（上限は調整可能）
5. CREATE → 一瞬等倍に戻ってから撮影されます。できた画像が「並べたとおり」ですか
6. 100枚でも 2〜5 が破綻しないか（重い・カクつく等があれば教えてください）
```

- [ ] **Step 3: 記録** — TODO.md の N-58 を「段階2完了（実機確認待ち）」に更新。実機の感触（ズーム上限・スロップ）で調整が要れば `STAGE_ZOOM_MAX`（`lib/share/stage-zoom.ts`）だけ変えて再デプロイ。

---

## Self-Review 済みの注意点（実装者へ）

- **撮影系は 1 行も変わらない**。変わるのは「撮影直前に `setStageTransform(IDENTITY_STAGE_TRANSFORM)` する」だけで、既存の double-rAF（2 フレーム待ち）がリセットの paint を保証する。黒帯検出テスト・帯の幾何テストが最後の砦。
- **`MobileArrangeBar`（position:fixed）と `resultScrim` / `MobileShareResult` は必ず `MobileZoomStage` の外**。transform を掛けた祖先は position:fixed の containing block になってしまう（memory `reference_will_change_containing_block` と同種の罠）。
- **`MobileZoomStage` の viewport に z-index SHARE_CANVAS が必須**。transform が stacking context を作るため、中の CollageCanvas root の z:95 は外に効かなくなる。覗き窓自体を 95 に上げないと盤面カード（z:10）の下に沈む。
- **回転はいじらない**。角度は screen 座標で計算しても一様スケール下で layout 座標と一致する。移動・リサイズの「距離」だけがスケールの影響を受ける。
- ピンチ終了後に残った 1 本指は（pointerdown を過ぎているので）何も操作しない。いったん離してから触り直すのが仕様（世のコラージュアプリと同じ）。
- 帯ガイドの 1px 破線はズームで太く見える（最大 6px）。ガイドなので許容。気になったら実機確認後に `border-width` を `calc(1px / var(--stage-zoom))` にする手はあるが今回はやらない（YAGNI）。
- `pointers` Map は React の再レンダーに依存しない ref。`MobileZoomStage` のハンドラは毎レンダー再生成されるので `props.transform` の閉じ込みは常に最新（useCallback にしないのは意図的）。
- Playwright の合成 PointerEvent は `setPointerCapture` に拒否される（memory `reference_board_card_click_pointer_capture`）が、実装側は全部 try/catch 済み＋dispatch 先が要素直なので追跡は成立する。**実タッチのピンチの感触は実機のみ**（恒久ルール）。
