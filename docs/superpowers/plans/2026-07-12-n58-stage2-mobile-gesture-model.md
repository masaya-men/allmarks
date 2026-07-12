# N-58 段階2 スマホ操作系の再設計 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホの SHARE コラージュ編集段を「タップ選択 → 2本指でカード拡縮+回転 / 非選択なら2本指でボードズーム、1本指はカード移動 or 余白パン」に作り直し、常時ノブと四隅リサイズを廃止する（回転は維持）。

**Architecture:** 編集面を新 wrapper `MobileArrangeGestures`（多点タッチ担当・内側に CSS transform 層）で包む。2本目の指を capture 相で握り、`selectedId` の有無でカード変形（BoardRoot が base をスナップショットして絶対計算）かボードズームかに振る。1本指はカードへ素通し（既存 `CollageCanvas` の drag）、余白は覗き窓自身が pan/tap-deselect する。ボードズームは CSS transform だけで、撮影は state 由来（`renderCollageCanvasToJpeg`）なので画像に無影響。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright

**設計書（正本）:** `docs/superpowers/specs/2026-07-12-n58-stage2-mobile-gesture-model-design.md`

## Global Constraints

- TypeScript `strict: true`。`any` 禁止。return type 明示。CSS は `.module.css`。Tailwind / Framer Motion 禁止。
- z-index は `BOARD_Z_INDEX`（`lib/board/constants.ts`）の定数のみ（マジックナンバー禁止）。ズーム倍率の範囲は `lib/share/stage-zoom.ts` に定数集約。
- UI 文言は世界に通じる乾いた英語（i18n キーは足さない＝board chrome は英語リテラル）。
- **デスクトップ（>640px）はバイト同一**。新 prop（`pointerScale`/`selectedId`/`onSelect`/`touchMode`/`gestureArbiter`）は**モバイルのみ**渡す＝デスクトップは全て `undefined` で現行と完全一致。`MobileArrangeGestures` は `enabled=false` で wrapper DOM を足さず `<>{children}</>`。
- **撮影系は1行も変えない**: `renderCollageCanvasToJpeg` / `mobileCollageBandRect` / band 幾何 / `mobileCaptureScale` / 2フレーム待ち / パンくず。ボードズームは撮影に無影響（撮影は state から）。撮影ハンドラ `handleMobileCaptureAndCreate` は本計画で変更しない。
- `setPointerCapture` / `hasPointerCapture` / `releasePointerCapture` は必ず try/catch（jsdom / Playwright の合成ポインタが投げる）。
- git は `rtk` 前置。`--no-verify` 絶対禁止。**vitest は素の `npx vitest run <file>`**、**Playwright も素の `npx playwright test`**（`rtk npx` は誤解析で壊れる）。commit body は ASCII（`rtk git commit -m` の本文に日本語を入れない）。

## File Structure

- Create `lib/share/stage-zoom.ts` — ボードズーム/パンの純関数＋ジェスチャ調停役（状態を持たない数学のみ）。
- Modify `lib/share/collage-layout.ts` — 中心軸スケールの純関数 `scaleElementFromCenter` を1つ追加。
- Create `components/board/MobileArrangeGestures.tsx` + `.module.css` — 多点タッチ担当ラッパー（覗き窓＋transform 層＋指の仕分け）。
- Modify `components/board/CollageCanvas.tsx` + `.module.css` — 選択状態・倍率・選択枠・スマホでハンドル非表示・調停役を配線。
- Modify `components/board/BoardRoot.tsx` — state / base ref / ハンドラ / JSX ラップ / リセット。
- Modify `components/board/MobileArrangeBar.tsx` — ヒント文言更新＋撮影中 BACK 無効化（deferred #1）。
- Modify `components/board/MobileBandOverlay.tsx` — NaN 帯ガードを締める（deferred #2）。
- Modify `lib/share/collage-canvas-render.test.ts` — 回転の呼び出し順を検証（deferred #3）。
- Modify `tests/e2e/mobile-share.spec.ts` — 選択→カードピンチ / 非選択→ボードズーム / ズーム無影響 の e2e。

---

### Task 1: `lib/share/stage-zoom.ts` — ボードズーム/パンの数学＋調停役 【cheap 可（純関数）】

**Files:**
- Create: `lib/share/stage-zoom.ts`
- Test: `lib/share/stage-zoom.test.ts`

**Interfaces:**
- Produces:
  - `type StageTransform = { readonly scale: number; readonly tx: number; readonly ty: number }`
  - `type StagePoint = { readonly x: number; readonly y: number }`
  - `IDENTITY_STAGE_TRANSFORM: StageTransform` / `STAGE_ZOOM_MIN = 1` / `STAGE_ZOOM_MAX = 6`
  - `clampStageTransform(t: StageTransform, viewportW: number, viewportH: number): StageTransform`
  - `pinchStageTransform(args: { base; startA; startB; currA; currB; viewportW; viewportH }): StageTransform`
  - `panStageTransform(base: StageTransform, dx: number, dy: number, viewportW: number, viewportH: number): StageTransform`
  - `type CollageGestureArbiter = { readonly register: (cancel: () => void) => void; readonly clear: () => void; readonly cancelActive: () => void }`
  - `createCollageGestureArbiter(): CollageGestureArbiter`

- [ ] **Step 1: Write the failing test**

`lib/share/stage-zoom.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  clampStageTransform,
  createCollageGestureArbiter,
  IDENTITY_STAGE_TRANSFORM,
  panStageTransform,
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
    // scale 2 => tx in [-390, 0], ty in [-844, 0]
    expect(clampStageTransform({ scale: 2, tx: -500, ty: 10 }, VW, VH)).toEqual({ scale: 2, tx: -390, ty: 0 })
  })
})

describe('pinchStageTransform', () => {
  it('spreading two fingers zooms in around their midpoint', () => {
    const next = pinchStageTransform({
      base: IDENTITY_STAGE_TRANSFORM,
      startA: { x: 150, y: 400 },
      startB: { x: 250, y: 400 }, // dist 100, mid (200,400)
      currA: { x: 100, y: 400 },
      currB: { x: 300, y: 400 }, // dist 200 => 2x
      viewportW: VW,
      viewportH: VH,
    })
    expect(next.scale).toBeCloseTo(2)
    // content point under start-mid (200,400) stays under the current mid: tx = 200 - 200*2
    expect(next.tx).toBeCloseTo(-200)
    expect(next.ty).toBeCloseTo(-400)
  })

  it('moving both fingers together pans (scale unchanged)', () => {
    const next = pinchStageTransform({
      base: { scale: 2, tx: -100, ty: -100 },
      startA: { x: 100, y: 300 },
      startB: { x: 200, y: 300 },
      currA: { x: 130, y: 340 },
      currB: { x: 230, y: 340 }, // dist unchanged, mid +30,+40
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
      currB: { x: 210, y: 400 }, // pinch in => ~0.1x
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

describe('panStageTransform', () => {
  it('translates by (dx,dy) within the clamp', () => {
    expect(panStageTransform({ scale: 2, tx: -100, ty: -100 }, 30, 40, VW, VH)).toEqual({ scale: 2, tx: -70, ty: -60 })
  })

  it('cannot pan a non-zoomed stage (scale 1 pins to origin)', () => {
    expect(panStageTransform(IDENTITY_STAGE_TRANSFORM, 50, 50, VW, VH)).toEqual({ scale: 1, tx: 0, ty: 0 })
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
npx vitest run lib/share/stage-zoom.test.ts
```

Expected: FAIL — `./stage-zoom` が存在しない。

- [ ] **Step 3: Implement**

`lib/share/stage-zoom.ts`:

```ts
/** N-58 段階2: スマホのコラージュ編集ステージのボードズーム/パンの数学と、
 *  「2本目の指が下りたらカード操作を止める」ための調停役。撮影系はこのモジュールを
 *  知らない（ボードズームは編集専用で、撮影は state 由来＝画像に無影響）。 */

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
 *  上限 6 は「100枚時の最小カード（高さ約24px）が指で掴める大きさになる」目安。
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

/** 2本指ピンチの現在フレームの transform。ピンチ開始時点（base/startA/startB）を
 *  基準に毎フレーム絶対計算する（増分の積み上げをしない＝誤差が溜まらない）。
 *  「開始時に2指の中点の下にあったコンテンツ点が、今の中点の下に居続ける」ように
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

/** 1本指パン（余白ドラッグ）。base に (dx,dy) を足して clamp。等倍(scale 1)では
 *  clamp が原点に固定するので実質 no-op になる（＝ズーム中だけ効く）。 */
export function panStageTransform(
  base: StageTransform,
  dx: number,
  dy: number,
  viewportW: number,
  viewportH: number,
): StageTransform {
  return clampStageTransform({ scale: base.scale, tx: base.tx + dx, ty: base.ty + dy }, viewportW, viewportH)
}

/** 1本指のカード操作（移動）を、2本目の指が下りた瞬間に中断する調停役。
 *  CollageCanvas がドラッグ開始時に自分の後始末（リスナー解除）を register し、
 *  MobileArrangeGestures がピンチ開始時に cancelActive を呼ぶ。同時に生きるカード操作は
 *  常に1つ（2本目の指はピンチに化けるので2つ目のカード操作は始まらない）。 */
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
npx vitest run lib/share/stage-zoom.test.ts
rtk git add lib/share/stage-zoom.ts lib/share/stage-zoom.test.ts
rtk git commit -m "feat(share): stage-zoom math (pinch/pan/clamp) + gesture arbiter for mobile arrange (N-58 stage 2)"
```

---

### Task 2: `lib/share/collage-layout.ts` — 中心軸スケール `scaleElementFromCenter` 【cheap 可（純関数）】

**Files:**
- Modify: `lib/share/collage-layout.ts`（`resizeElementFromCorner` の後に追加）
- Test: `lib/share/collage-layout.test.ts`（既存に追記。無ければ新規作成）

**Interfaces:**
- Consumes: 既存 `CollagePositions` / `COLLAGE_MIN_WIDTH_PX`
- Produces: `scaleElementFromCenter(positions: CollagePositions, id: string, factor: number, maxCardWidth: number): CollagePositions`
  - `positions[id]` の**中心を固定**して w,h を factor 倍。w を `[COLLAGE_MIN_WIDTH_PX, maxCardWidth]` にクランプ、h はアスペクト維持。未知 id は同一参照。
  - 呼び出し側は「ピンチ開始時の base positions」を渡す＝絶対計算で誤差ゼロ。

- [ ] **Step 1: Write the failing test**

`lib/share/collage-layout.test.ts` に追記（既存ファイルが無ければ、先頭に `import { describe, expect, it } from 'vitest'` と `import { scaleElementFromCenter, COLLAGE_MIN_WIDTH_PX } from './collage-layout'` を書いて新規作成）:

```ts
import { describe, expect, it } from 'vitest'
import { scaleElementFromCenter, COLLAGE_MIN_WIDTH_PX } from './collage-layout'

describe('scaleElementFromCenter', () => {
  const base = { a: { x: 100, y: 100, w: 200, h: 100 } } // center (200,150), aspect 2

  it('scales width/height about the card center (center stays fixed)', () => {
    const out = scaleElementFromCenter(base, 'a', 2, 5000)
    expect(out.a.w).toBeCloseTo(400)
    expect(out.a.h).toBeCloseTo(200)
    // center preserved: x = 200 - 400/2 = 0, y = 150 - 200/2 = 50
    expect(out.a.x).toBeCloseTo(0)
    expect(out.a.y).toBeCloseTo(50)
  })

  it('clamps width to the lower bound and keeps aspect', () => {
    const out = scaleElementFromCenter(base, 'a', 0.01, 5000)
    expect(out.a.w).toBe(COLLAGE_MIN_WIDTH_PX)
    expect(out.a.h).toBeCloseTo(COLLAGE_MIN_WIDTH_PX / 2)
    // still centered on (200,150)
    expect(out.a.x).toBeCloseTo(200 - COLLAGE_MIN_WIDTH_PX / 2)
  })

  it('clamps width to maxCardWidth', () => {
    const out = scaleElementFromCenter(base, 'a', 100, 600)
    expect(out.a.w).toBe(600)
    expect(out.a.h).toBeCloseTo(300)
  })

  it('returns the same reference for an unknown id', () => {
    expect(scaleElementFromCenter(base, 'zzz', 2, 5000)).toBe(base)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/share/collage-layout.test.ts
```

Expected: FAIL — `scaleElementFromCenter` が存在しない。

- [ ] **Step 3: Implement**

`lib/share/collage-layout.ts` の `bringToFront`（現行 L73-76）の直前に追加:

```ts
/** 要素を「中心を固定」して factor 倍する（2本指ピンチのカード拡縮）。幅は
 *  [COLLAGE_MIN_WIDTH_PX, maxCardWidth] にクランプ、高さはアスペクト維持。中心を保つよう
 *  x,y を再計算。未知 id は同一参照。呼び出し側は「ピンチ開始時の base positions」を渡す
 *  ＝毎フレーム絶対計算で誤差が溜まらない（N-58 段階2）。 */
export function scaleElementFromCenter(
  positions: CollagePositions,
  id: string,
  factor: number,
  maxCardWidth: number,
): CollagePositions {
  const p = positions[id]
  if (!p) return positions
  const aspect = p.w / p.h
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const w = Math.min(maxCardWidth, Math.max(COLLAGE_MIN_WIDTH_PX, p.w * factor))
  const h = w / aspect
  return { ...positions, [id]: { x: cx - w / 2, y: cy - h / 2, w, h } }
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run lib/share/collage-layout.test.ts
rtk git add lib/share/collage-layout.ts lib/share/collage-layout.test.ts
rtk git commit -m "feat(share): scaleElementFromCenter for two-finger card pinch (N-58 stage 2)"
```

---

### Task 3: `MobileArrangeGestures` — 多点タッチ担当ラッパー 【Sonnet 推奨】

**Files:**
- Create: `components/board/MobileArrangeGestures.tsx`
- Create: `components/board/MobileArrangeGestures.module.css`
- Test: `components/board/MobileArrangeGestures.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `StageTransform` / `StagePoint` / `pinchStageTransform` / `panStageTransform`
- Produces: `MobileArrangeGestures(props)`:
  ```ts
  export type MobileArrangeGesturesProps = {
    readonly enabled: boolean
    readonly transform: StageTransform
    readonly onTransformChange: (next: StageTransform) => void
    readonly selectedId: string | null
    readonly onSelectedPinchStart: () => void
    readonly onSelectedPinch: (change: { readonly factor: number; readonly deltaDeg: number }) => void
    readonly onDeselect: () => void
    readonly children: ReactNode
  }
  ```
  - `enabled=false` → `<>{children}</>`（wrapper DOM 無し）。
  - `data-testid="mobile-arrange-viewport"`（覗き窓）/ `data-testid="mobile-arrange-stage"`（transform が乗る層）。

- [ ] **Step 1: Write the failing test**

`components/board/MobileArrangeGestures.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IDENTITY_STAGE_TRANSFORM } from '@/lib/share/stage-zoom'
import { MobileArrangeGestures, type MobileArrangeGesturesProps } from './MobileArrangeGestures'

/** jsdom の getBoundingClientRect は全て 0 を返すので、覗き窓に 390x844 の矩形を仕込む。 */
function mockRect(el: HTMLElement): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: (): object => ({}) }),
  })
}

const noop = (): void => {}

function renderGestures(over: Partial<MobileArrangeGesturesProps> = {}): {
  vp: HTMLElement
  onTransformChange: ReturnType<typeof vi.fn>
  onSelectedPinch: ReturnType<typeof vi.fn>
  onSelectedPinchStart: ReturnType<typeof vi.fn>
  onDeselect: ReturnType<typeof vi.fn>
} {
  const onTransformChange = vi.fn()
  const onSelectedPinch = vi.fn()
  const onSelectedPinchStart = vi.fn()
  const onDeselect = vi.fn()
  render(
    <MobileArrangeGestures
      enabled
      transform={IDENTITY_STAGE_TRANSFORM}
      onTransformChange={onTransformChange}
      selectedId={null}
      onSelectedPinchStart={onSelectedPinchStart}
      onSelectedPinch={onSelectedPinch}
      onDeselect={onDeselect}
      {...over}
    >
      <div data-testid="child" />
    </MobileArrangeGestures>,
  )
  const vp = screen.getByTestId('mobile-arrange-viewport')
  mockRect(vp)
  return { vp, onTransformChange, onSelectedPinch, onSelectedPinchStart, onDeselect }
}

describe('MobileArrangeGestures', () => {
  it('renders children without any wrapper when disabled (desktop stays byte-identical)', () => {
    render(
      <MobileArrangeGestures
        enabled={false}
        transform={IDENTITY_STAGE_TRANSFORM}
        onTransformChange={noop}
        selectedId={null}
        onSelectedPinchStart={noop}
        onSelectedPinch={noop}
        onDeselect={noop}
      >
        <div data-testid="child" />
      </MobileArrangeGestures>,
    )
    expect(screen.getByTestId('child')).toBeTruthy()
    expect(screen.queryByTestId('mobile-arrange-viewport')).toBeNull()
    expect(screen.queryByTestId('mobile-arrange-stage')).toBeNull()
  })

  it('applies the transform to the stage layer', () => {
    render(
      <MobileArrangeGestures
        enabled
        transform={{ scale: 2, tx: -10, ty: -20 }}
        onTransformChange={noop}
        selectedId={null}
        onSelectedPinchStart={noop}
        onSelectedPinch={noop}
        onDeselect={noop}
      >
        <div />
      </MobileArrangeGestures>,
    )
    expect(screen.getByTestId('mobile-arrange-stage').style.transform).toBe('translate(-10px, -20px) scale(2)')
  })

  it('with NO card selected, two fingers zoom the stage', () => {
    const { vp, onTransformChange, onSelectedPinch } = renderGestures({ selectedId: null })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 }) // dist 100
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 330, clientY: 400 }) // dist 180 => 1.8x
    expect(onSelectedPinch).not.toHaveBeenCalled()
    expect(onTransformChange).toHaveBeenCalled()
    const last = onTransformChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(last.scale).toBeCloseTo(1.8)
  })

  it('with a card selected, two fingers transform the card (fires start once + factor)', () => {
    const { vp, onTransformChange, onSelectedPinch, onSelectedPinchStart } = renderGestures({ selectedId: 'a' })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    expect(onSelectedPinchStart).not.toHaveBeenCalled()
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 }) // dist 100
    expect(onSelectedPinchStart).toHaveBeenCalledTimes(1)
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 350, clientY: 400 }) // dist 200 => 2x
    expect(onTransformChange).not.toHaveBeenCalled()
    const last = onSelectedPinch.mock.calls.at(-1)?.[0] as { factor: number }
    expect(last.factor).toBeCloseTo(2)
  })

  it('a single finger never pinches (no zoom, no card transform)', () => {
    const { vp, onTransformChange, onSelectedPinch } = renderGestures({ selectedId: 'a' })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(vp, { pointerId: 1, clientX: 300, clientY: 300 })
    expect(onSelectedPinch).not.toHaveBeenCalled()
    // single finger on empty space when zoomed-in would pan, but at scale 1 clamp pins to origin
    // => onTransformChange may fire but must never change scale; here assert no pinch happened.
    for (const c of onTransformChange.mock.calls) {
      expect((c[0] as { scale: number }).scale).toBe(1)
    }
  })

  it('a single-finger tap on empty space deselects', () => {
    const { vp, onDeselect } = renderGestures({ selectedId: 'a' })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.pointerUp(vp, { pointerId: 1, clientX: 120, clientY: 120 })
    expect(onDeselect).toHaveBeenCalledTimes(1)
  })

  it('lifting either finger ends the pinch', () => {
    const { vp, onTransformChange } = renderGestures({ selectedId: null })
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
npx vitest run components/board/MobileArrangeGestures.test.tsx
```

Expected: FAIL — `./MobileArrangeGestures` が存在しない。

- [ ] **Step 3: Implement**

`components/board/MobileArrangeGestures.tsx`:

```tsx
'use client'

import { useRef, type PointerEvent, type ReactElement, type ReactNode } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { panStageTransform, pinchStageTransform, type StagePoint, type StageTransform } from '@/lib/share/stage-zoom'
import styles from './MobileArrangeGestures.module.css'

export type MobileArrangeGesturesProps = {
  /** false（デスクトップ）なら wrapper DOM を一切足さず子をそのまま返す。 */
  readonly enabled: boolean
  /** 現在のボードズーム/パン（BoardRoot 所有）。 */
  readonly transform: StageTransform
  /** ボードズーム/パンの更新（非選択時の2本指・余白1本指パン）。 */
  readonly onTransformChange: (next: StageTransform) => void
  /** いま選択中のカード id（null=非選択）。2本指の行き先を決める。 */
  readonly selectedId: string | null
  /** 選択カードのピンチ開始で1回。BoardRoot が base をスナップショットする。 */
  readonly onSelectedPinchStart: () => void
  /** 選択カードのピンチ中に毎フレーム。factor=距離比・deltaDeg=角度差（開始基準の絶対値）。 */
  readonly onSelectedPinch: (change: { readonly factor: number; readonly deltaDeg: number }) => void
  /** 余白の1本指タップで選択解除。 */
  readonly onDeselect: () => void
  readonly children: ReactNode
}

type PinchState = {
  readonly mode: 'card' | 'stage'
  readonly idA: number
  readonly idB: number
  readonly startA: StagePoint
  readonly startB: StagePoint
  readonly startDist: number
  readonly startAngleDeg: number
  readonly base: StageTransform
  readonly viewportW: number
  readonly viewportH: number
}

/** 余白から始まった1本指（pan or tap-deselect の候補）。 */
type SingleState = {
  readonly id: number
  readonly startX: number
  readonly startY: number
  moved: boolean
  readonly base: StageTransform
}

const PAN_SLOP_PX = 4

function angleDeg(a: StagePoint, b: StagePoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** スマホのコラージュ編集段の多点タッチ担当（N-58 段階2）。内側の stage 層に CSS transform を
 *  掛けるだけで、子（CollageCanvas・帯ガイド）のレイアウト座標は変えない。仕分け:
 *  - 2本指: 選択中→選択カードの拡縮+回転（onSelectedPinch）/ 非選択→ボードズーム（onTransformChange）
 *  - 1本指: カード上→素通し（CollageCanvas の drag）/ 余白→パン（ズーム中のみ効く）or タップで解除
 *  すべて capture 相で処理し、2本目の指だけ stopPropagation して2つ目のカード操作を止める。 */
export function MobileArrangeGestures(props: MobileArrangeGesturesProps): ReactElement {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointers = useRef<Map<number, StagePoint>>(new Map())
  const pinch = useRef<PinchState | null>(null)
  const single = useRef<SingleState | null>(null)

  if (!props.enabled) return <>{props.children}</>

  const toLocal = (e: PointerEvent<HTMLDivElement>): StagePoint => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const isOnCard = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null
    return !!el?.closest?.('[data-testid^="collage-el-"]')
  }

  const handlePointerDownCapture = (e: PointerEvent<HTMLDivElement>): void => {
    const local = toLocal(e)
    pointers.current.set(e.pointerId, local)

    if (pinch.current === null && pointers.current.size === 2) {
      // 2本目の指: ピンチ開始。この pointerdown が新しいカード操作を始めないよう伝播を止める。
      e.stopPropagation()
      single.current = null
      const entries = Array.from(pointers.current.entries())
      const first = entries[0]
      const second = entries[1]
      if (!first || !second) return
      const rect = viewportRef.current?.getBoundingClientRect()
      const mode: 'card' | 'stage' = props.selectedId !== null ? 'card' : 'stage'
      pinch.current = {
        mode,
        idA: first[0],
        idB: second[0],
        startA: first[1],
        startB: second[1],
        startDist: Math.hypot(second[1].x - first[1].x, second[1].y - first[1].y),
        startAngleDeg: angleDeg(first[1], second[1]),
        base: props.transform,
        viewportW: rect?.width ?? 0,
        viewportH: rect?.height ?? 0,
      }
      if (mode === 'card') props.onSelectedPinchStart()
      const vp = viewportRef.current
      if (vp) {
        try {
          vp.setPointerCapture(first[0])
        } catch {
          /* synthetic pointer */
        }
        try {
          vp.setPointerCapture(second[0])
        } catch {
          /* synthetic pointer */
        }
      }
      return
    }

    if (pointers.current.size === 1 && !isOnCard(e.target)) {
      // 余白の1本指: パン or タップ解除の候補（カード上は素通しして CollageCanvas に任せる）。
      single.current = { id: e.pointerId, startX: local.x, startY: local.y, moved: false, base: props.transform }
    }
  }

  const handlePointerMoveCapture = (e: PointerEvent<HTMLDivElement>): void => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, toLocal(e))

    const p = pinch.current
    if (p !== null && (e.pointerId === p.idA || e.pointerId === p.idB)) {
      e.stopPropagation()
      const currA = pointers.current.get(p.idA)
      const currB = pointers.current.get(p.idB)
      if (!currA || !currB) return
      if (p.mode === 'stage') {
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
      } else {
        const dist = Math.hypot(currB.x - currA.x, currB.y - currA.y)
        const factor = p.startDist > 0 ? dist / p.startDist : 1
        const deltaDeg = angleDeg(currA, currB) - p.startAngleDeg
        props.onSelectedPinch({ factor, deltaDeg })
      }
      return
    }

    const s = single.current
    if (s !== null && e.pointerId === s.id) {
      const cur = pointers.current.get(s.id)
      if (!cur) return
      const dx = cur.x - s.startX
      const dy = cur.y - s.startY
      if (!s.moved && Math.hypot(dx, dy) > PAN_SLOP_PX) s.moved = true
      if (s.moved) props.onTransformChange(panStageTransform(s.base, dx, dy, viewportRef.current?.clientWidth ?? 0, viewportRef.current?.clientHeight ?? 0))
    }
  }

  const handlePointerEndCapture = (e: PointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(e.pointerId)

    const p = pinch.current
    if (p !== null && (e.pointerId === p.idA || e.pointerId === p.idB)) {
      pinch.current = null
      e.stopPropagation()
      return
    }

    const s = single.current
    if (s !== null && e.pointerId === s.id) {
      if (!s.moved) props.onDeselect() // 余白タップ = 選択解除
      single.current = null
    }
  }

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_CANVAS }}
      data-testid="mobile-arrange-viewport"
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerEndCapture}
      onPointerCancelCapture={handlePointerEndCapture}
    >
      <div
        className={styles.stage}
        data-testid="mobile-arrange-stage"
        style={{ transform: `translate(${props.transform.tx}px, ${props.transform.ty}px) scale(${props.transform.scale})` }}
      >
        {props.children}
      </div>
    </div>
  )
}
```

`components/board/MobileArrangeGestures.module.css`:

```css
/* N-58 段階2: スマホ編集段の多点タッチ覗き窓。拡大した stage を画面サイズで切り取る。
   z-index は SHARE_CANVAS（inline style）— transform が作る stacking context の中に
   CollageCanvas が入るため、覗き窓自体が盤面カード層より上に居る必要がある。 */
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
npx vitest run components/board/MobileArrangeGestures.test.tsx
rtk git add components/board/MobileArrangeGestures.tsx components/board/MobileArrangeGestures.module.css components/board/MobileArrangeGestures.test.tsx
rtk git commit -m "feat(board): MobileArrangeGestures multi-touch wrapper (selection-gated pinch, stage zoom, empty-space pan) (N-58 stage 2)"
```

---

### Task 4: `CollageCanvas` — 選択・倍率・選択枠・スマホでハンドル非表示 【Sonnet 推奨】

**Files:**
- Modify: `components/board/CollageCanvas.tsx`
- Modify: `components/board/CollageCanvas.module.css`
- Test: `components/board/CollageCanvas.test.tsx`（既存に追記）

**Interfaces:**
- Consumes: Task 1 の `CollageGestureArbiter`
- Produces: `CollageCanvasProps` に追加（全て省略可＝デスクトップは現行と完全一致）:
  - `readonly pointerScale?: number`（省略1）
  - `readonly selectedId?: string | null`
  - `readonly onSelect?: (id: string) => void`
  - `readonly touchMode?: boolean`（true=スマホ: 回転ノブと四隅リサイズを描かない＋選択枠を出す）
  - `readonly gestureArbiter?: CollageGestureArbiter`

- [ ] **Step 1: Write the failing tests**

`components/board/CollageCanvas.test.tsx` の `describe('CollageCanvas', …)` 内に追記。先頭 import 行 `import { render } from '@testing-library/react'` を `import { fireEvent, render } from '@testing-library/react'` に変更し、`import { createCollageGestureArbiter } from '@/lib/share/stage-zoom'` を足す:

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
    // screen (100,60) / scale 2 = layout (+50,+30) => (10+50, 20+30) = (60, 50)
    expect(onMove).toHaveBeenLastCalledWith('a', 60, 50)
    fireEvent.pointerUp(el, { pointerId: 1 })
  })

  it('calls onSelect when a card is grabbed', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 } }
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.pointerDown(getByTestId('collage-el-a'), { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('touchMode hides the rotate knob and the four-corner resize handles, and shows a selection frame on the selected card', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 } }
    const { queryByTestId, container } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        touchMode
        selectedId="a"
      />,
    )
    expect(queryByTestId('collage-rotate-a')).toBeNull()
    expect(container.querySelector('[data-testid^="resize-handle-"]')).toBeNull()
    expect(queryByTestId('collage-selection-a')).toBeTruthy()
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

> 注: 四隅ハンドルの testid は `resize-handle-tl/tr/bl/br`（`ResizeHandle` が付ける）。存在確認は `[data-testid^="resize-handle-"]`。もし現行の testid 接頭辞が違っていたら、`ResizeHandle.tsx` を開いて実際の testid に合わせる（本 assert の目的は「touchMode で四隅が DOM に出ない」こと）。

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run components/board/CollageCanvas.test.tsx
```

Expected: FAIL — 新 prop 未対応 / 選択枠 testid 無し。

- [ ] **Step 3: Implement — props と bindPointerGesture**

1. import に追加:

```ts
import type { CollageGestureArbiter } from '@/lib/share/stage-zoom'
```

2. `CollageCanvasProps` の末尾（`title` プロパティの後）に追加:

```ts
  /** ステージのズーム倍率（スマホ編集段のみ渡る。省略時1=等倍）。ポインタ差分は screen px
   *  なので、layout 座標へ戻すときこの値で割る（N-58 段階2）。 */
  readonly pointerScale?: number
  /** いま選択中のカード id（スマホのみ）。一致するカードに選択枠を出す。 */
  readonly selectedId?: string | null
  /** カード grab で選択にする（スマホのみ）。 */
  readonly onSelect?: (id: string) => void
  /** true（スマホ）で回転ノブと四隅リサイズを描かず、選択枠を出す（拡縮/回転は2本指へ）。 */
  readonly touchMode?: boolean
  /** 2本指ピンチ開始で進行中のカード移動を中断する調停役（スマホのみ）。 */
  readonly gestureArbiter?: CollageGestureArbiter
```

3. `bindPointerGesture`（現行 L85-111）を第4引数 `arbiter` 対応に置き換え:

```ts
  function bindPointerGesture(
    el: HTMLDivElement,
    pointerId: number,
    onMove: (ev: globalThis.PointerEvent) => void,
    arbiter?: CollageGestureArbiter,
  ): void {
    try {
      el.setPointerCapture(pointerId)
    } catch {
      /* jsdom / synthetic pointer — capture isn't critical for the gesture itself */
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
        /* jsdom / synthetic pointer */
      }
      arbiter?.clear()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    // ピンチ（2本目の指）が始まったら up がそのまま中断処理として呼ばれる。
    arbiter?.register(up)
  }
```

- [ ] **Step 4: Implement — 移動ハンドラで onSelect・倍率・調停役**

`handleElementPointerDown`（現行 L113-127）を置き換え:

```ts
  function handleElementPointerDown(e: PointerEvent<HTMLDivElement>, id: string): void {
    if (e.button > 0) return
    e.stopPropagation()
    const el = refs.current[id]
    const start = props.positions[id]
    if (!el || !start) return
    props.onGrab(id)
    props.onSelect?.(id)
    const startX = e.clientX
    const startY = e.clientY
    const originX = start.x
    const originY = start.y
    // ズーム中は指の移動量(screen px)を倍率で割って layout 座標に戻す（等倍は /1 で従来完全一致）。
    const scale = props.pointerScale ?? 1
    bindPointerGesture(
      el,
      e.pointerId,
      (ev) => {
        props.onMove(id, originX + (ev.clientX - startX) / scale, originY + (ev.clientY - startY) / scale)
      },
      props.gestureArbiter,
    )
  }
```

（`handleRotatePointerDown` は**変更しない**＝デスクトップのノブ専用。スマホではノブを描かないので呼ばれない。）

- [ ] **Step 5: Implement — 選択枠・ハンドルの touchMode ゲート（JSX）**

各カードの `<div className={styles.element} …>` の**子**として、`CardNode` の後・回転ノブの前に選択枠を追加:

```tsx
            {props.touchMode && props.selectedId === id && (
              <div className={styles.selectionFrame} data-testid={`collage-selection-${id}`} data-no-capture aria-hidden="true" />
            )}
```

回転ノブ（現行 L228-257 の `<div className={styles.rotateHandle} …>…</div>`）と四隅リサイズ（現行 L263-276 の `<ResizeHandle …/>`）を、それぞれ `{!props.touchMode && ( … )}` で包む。例（回転ノブ）:

```tsx
            {!props.touchMode && (
              <div
                className={styles.rotateHandle}
                data-testid={`collage-rotate-${id}`}
                data-no-capture
                onPointerDown={(e): void => handleRotatePointerDown(e, id)}
              >
                {/* …既存の中身（knob svg + stem）をそのまま… */}
              </div>
            )}
```

四隅リサイズも同様に `{!props.touchMode && (<ResizeHandle …既存 props そのまま… />)}`。

- [ ] **Step 6: Implement — CSS 選択枠**

`components/board/CollageCanvas.module.css` に追加（末尾）:

```css
/* N-58 段階2: スマホのタップ選択枠。回転済み .element の内側に敷くので角丸・回転に自動追従。
   白 2px + 淡い暗い影でどんな写真の上でも視認できる。拡縮/回転は2本指なのでハンドルの点は出さない。
   pointer-events:none で編集の邪魔をせず、data-no-capture で撮影にも写らない（撮影は state 由来だが念のため）。 */
.selectionFrame {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: var(--card-radius, 0px);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  z-index: 30;
}
```

- [ ] **Step 7: Run to verify they pass → Commit**

```bash
npx vitest run components/board/CollageCanvas.test.tsx
rtk git add components/board/CollageCanvas.tsx components/board/CollageCanvas.module.css components/board/CollageCanvas.test.tsx
rtk git commit -m "feat(board): CollageCanvas selection frame + pointerScale + touch handle gating (N-58 stage 2)"
```

---

### Task 5: `BoardRoot` 配線＋バー文言＋帯ガード（deferred #1,#2,#4） 【Sonnet 推奨（大ファイルの配線）】

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/MobileArrangeBar.tsx`
- Modify: `components/board/MobileBandOverlay.tsx`

**Interfaces:**
- Consumes: Task 1〜4（`MobileArrangeGestures` / `stage-zoom` / `scaleElementFromCenter` / `CollageCanvas` の新 prop）
- Produces: state `selectedCollageId: string | null` / `stageTransform: StageTransform` / `collageArbiter: CollageGestureArbiter` / `pinchBaseRef`（`{ positions; rotation; id }`）

- [ ] **Step 1: import と state**

`BoardRoot.tsx` の import 群に追加:

```ts
import { MobileArrangeGestures } from './MobileArrangeGestures'
import {
  createCollageGestureArbiter,
  IDENTITY_STAGE_TRANSFORM,
  type CollageGestureArbiter,
  type StageTransform,
} from '@/lib/share/stage-zoom'
import { scaleElementFromCenter } from '@/lib/share/collage-layout'
```

> 注: `scaleElementFromCenter` は `collage-layout` からの追加 export。`moveElement`/`resizeElementFromCorner`/`bringToFront` を既に import している行に足してもよい。

段階1で追加した `mobileBandRect` の useState 宣言（現行 L458 付近）の直後に:

```ts
  // スマホ編集段: タップ選択のカード id（null=非選択）。2本指の行き先と選択枠を決める（N-58 段階2）。
  const [selectedCollageId, setSelectedCollageId] = useState<string | null>(null)
  // ボードのズーム/パン（編集専用・撮影に無影響）。段の出入りで IDENTITY に戻す。
  const [stageTransform, setStageTransform] = useState<StageTransform>(IDENTITY_STAGE_TRANSFORM)
  // 2本目の指で進行中のカード移動を止める調停役（インスタンスは1個を維持）。
  const [collageArbiter] = useState<CollageGestureArbiter>(() => createCollageGestureArbiter())
  // 選択カードのピンチ開始時の base（絶対計算で誤差を溜めないためのスナップショット）。
  const pinchBaseRef = useRef<{ positions: CollagePositions; rotation: number; id: string } | null>(null)
```

> `CollagePositions` 型は既に `collagePositions` state で使っているので import 済みのはず（無ければ `import type { CollagePositions } from '@/lib/share/collage-layout'`）。`useRef` も import 済みのはず。

- [ ] **Step 2: ピンチのハンドラ**

`handleMobileEnterArrange`（現行 L2477 付近）の**手前**に、選択カードのピンチ2ハンドラを追加:

```ts
  // スマホ: 選択カードの2本指ピンチ開始 — 進行中のカード移動を止め、base をスナップショット。
  const handleSelectedPinchStart = useCallback((): void => {
    collageArbiter.cancelActive()
    if (selectedCollageId === null) return
    pinchBaseRef.current = {
      positions: collagePositions,
      rotation: collageRotations[selectedCollageId] ?? 0,
      id: selectedCollageId,
    }
  }, [collageArbiter, selectedCollageId, collagePositions, collageRotations])

  // スマホ: 選択カードの2本指ピンチ中 — base から絶対計算で拡縮（中心軸）+回転。
  const handleSelectedPinch = useCallback(
    (change: { readonly factor: number; readonly deltaDeg: number }): void => {
      const base = pinchBaseRef.current
      if (!base) return
      setCollagePositions(scaleElementFromCenter(base.positions, base.id, change.factor, effectiveLayoutWidth))
      setCollageRotations((r) => ({ ...r, [base.id]: base.rotation + change.deltaDeg }))
    },
    [effectiveLayoutWidth],
  )
```

> `effectiveLayoutWidth` は arrange の `CollageCanvas` に `maxCardWidth` として渡っている値（現行 L3674）。同じ上限をカードスケールにも使う。

- [ ] **Step 3: リセット（選択・ズームを段の出入りで初期化）**

1. `handleMobileEnterArrange`: `setMobileBandRect(band)` の直後に:

```ts
    setSelectedCollageId(null)
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
```

2. `handleExitShareMode`（現行 L2255 付近）: `setCollageRotations({})` の後（無ければ関数末尾の setState 群の並びに合わせて）に:

```ts
    setSelectedCollageId(null)
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
```

3. `handleShareReselect`（現行 L2649 付近）: `setSharePhase('select')` の前に:

```ts
    setSelectedCollageId(null)
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
```

（`handleMobileCaptureAndCreate` は**変更しない**＝ボードズームは撮影に無影響。）

- [ ] **Step 4: canvasCards コメント（deferred #4）**

`handleMobileCaptureAndCreate` 内の `const canvasCards: CollageCanvasCard[] = collageOrder`（現行 L2522 付近）の直前行のコメントに、盤面順ではなく重なり順を焼く旨がなければ1行足す:

```ts
    // 重なり順（collageOrder）で並べて焼く（盤面の並び順ではない）。z 順＝collageOrder が正。
```

- [ ] **Step 5: arrange ブロックの JSX ラップ**

`sharePhase === 'arrange'` ブロック（現行 L3663-3684）の `<CollageCanvas … />` と `{isMobile && mobileBandRect && <MobileBandOverlay … />}` を `MobileArrangeGestures` で包む。`MobileArrangeBar` / result scrim / `MobileShareResult`（`<div data-no-capture>` 以降）は**外に残す**（position:fixed が transform の containing block に捕まらない）:

```tsx
          <MobileArrangeGestures
            enabled={isMobile}
            transform={stageTransform}
            onTransformChange={setStageTransform}
            selectedId={selectedCollageId}
            onSelectedPinchStart={handleSelectedPinchStart}
            onSelectedPinch={handleSelectedPinch}
            onDeselect={(): void => setSelectedCollageId(null)}
          >
            <CollageCanvas
              items={lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))}
              positions={collagePositions}
              order={collageOrder}
              onMove={(id, x, y): void => setCollagePositions((p) => moveElement(p, id, x, y))}
              onResize={(id, corner, w): void => setCollagePositions((p) => resizeElementFromCorner(p, id, corner, w))}
              onGrab={(id): void => setCollageOrder((o) => bringToFront(o, id))}
              rotations={collageRotations}
              onRotate={(id, deg): void => setCollageRotations((r) => ({ ...r, [id]: deg }))}
              maxCardWidth={effectiveLayoutWidth}
              displayMode={displayMode}
              paper={themeMeta.decorations === true}
              roundedCorners={roundedCorners}
              title={
                shareTitle
                  ? { config: shareTitle, defaultText: deriveBoardBgTypoText(activeFilter, tags), onChange: setShareTitle }
                  : undefined
              }
              pointerScale={isMobile ? stageTransform.scale : undefined}
              selectedId={isMobile ? selectedCollageId : undefined}
              onSelect={isMobile ? (id): void => setSelectedCollageId(id) : undefined}
              touchMode={isMobile}
              gestureArbiter={isMobile ? collageArbiter : undefined}
            />
            {isMobile && mobileBandRect && <MobileBandOverlay band={mobileBandRect} />}
          </MobileArrangeGestures>
```

> デスクトップは `enabled=false` → `MobileArrangeGestures` が `<>{children}</>` を返し、追加 prop は全て `undefined`（`touchMode={false}` 含む）なので **DOM も挙動もバイト同一**。

- [ ] **Step 6: バー文言＋撮影中 BACK 無効化（deferred #1）**

`components/board/MobileArrangeBar.tsx`:

1. `.hint` の文字列を新操作に更新:

```tsx
      <span className={styles.hint}>TAP A CARD TO SELECT — PINCH TO RESIZE OR ROTATE — TWO FINGERS ZOOM THE BOARD</span>
```

2. BACK ボタンに `disabled={props.creating}` を追加（撮影中に BACK で孤児 /s を作らせない）:

```tsx
        <button type="button" className={styles.ghost} onClick={props.onBack} disabled={props.creating} data-testid="mobile-arrange-back">
          BACK
        </button>
```

- [ ] **Step 7: 帯 NaN ガード（deferred #2）**

`components/board/MobileBandOverlay.tsx` の `if (band.width <= 0 || band.height <= 0) return null` を、NaN も弾く形に:

```tsx
  if (!(band.width > 0) || !(band.height > 0)) return null
```

- [ ] **Step 8: 検証（型＋単体＋ビルド）→ Commit**

```bash
rtk tsc
npx vitest run
pnpm build
```

Expected: tsc 0 エラー / vitest 全緑 / build OK。

```bash
rtk git add components/board/BoardRoot.tsx components/board/MobileArrangeBar.tsx components/board/MobileBandOverlay.tsx
rtk git commit -m "feat(board): wire selection-gated pinch + board zoom into arrange stage; disable BACK while creating; tighten band NaN guard (N-58 stage 2)"
```

---

### Task 6: 回転呼び出し順テスト（deferred #3）＋ e2e ＋ デプロイ 【Sonnet 推奨】

**Files:**
- Modify: `lib/share/collage-canvas-render.test.ts`
- Modify: `tests/e2e/mobile-share.spec.ts`

- [ ] **Step 1: 回転の呼び出し順（deferred #3）**

`lib/share/collage-canvas-render.test.ts` の test (f)（現行 L473-504）の末尾 assert（`expect(fakeCtx.translate).toHaveBeenCalledWith(-200, -150)` の後）に、順序検証を追加:

```ts
    // 順序を保証: translate(center) -> rotate -> translate(-center)。
    const centerIdx = fakeCtx.translate.mock.calls.findIndex((c) => c[0] === 200 && c[1] === 150)
    const backIdx = fakeCtx.translate.mock.calls.findIndex((c) => c[0] === -200 && c[1] === -150)
    const orderCenter = fakeCtx.translate.mock.invocationCallOrder[centerIdx]
    const orderRotate = fakeCtx.rotate.mock.invocationCallOrder[0]
    const orderBack = fakeCtx.translate.mock.invocationCallOrder[backIdx]
    expect(orderCenter).toBeLessThan(orderRotate)
    expect(orderRotate).toBeLessThan(orderBack)
```

```bash
npx vitest run lib/share/collage-canvas-render.test.ts
```

Expected: PASS。

- [ ] **Step 2: e2e — 選択→カードピンチ / 非選択→ボードズーム / ズーム無影響**

`tests/e2e/mobile-share.spec.ts` の phone describe に3本追加（既存 helper `seedBoard`/`stubCreate` を使う。合成 PointerEvent を dispatch する。`mobile-nav-share`→`mobile-select-all`→`mobile-select-create` で arrange へ入る流れは既存テストに準拠）:

```ts
  test('tapping a card selects it (selection frame appears) (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await page.getByTestId('mobile-select-create').tap()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()
    const first = page.locator('[data-testid^="collage-el-"]').first()
    const id = await first.evaluate((el) => el.getAttribute('data-testid')?.replace('collage-el-', '') ?? '')
    await first.evaluate((el) => {
      const fire = (type: string, x: number, y: number): void => {
        const r = el.getBoundingClientRect()
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: r.left + r.width / 2 + x, clientY: r.top + r.height / 2 + y, pointerType: 'touch', isPrimary: true }))
      }
      fire('pointerdown', 0, 0)
      fire('pointerup', 0, 0) // tap (no move) => select only
    })
    await expect(page.getByTestId(`collage-selection-${id}`)).toBeVisible()
  })

  test('two fingers on a selected card resize it; the image is unaffected by board zoom (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await page.getByTestId('mobile-select-create').tap()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    const first = page.locator('[data-testid^="collage-el-"]').first()
    const beforeW = await first.evaluate((el) => (el as HTMLElement).style.width)
    // Select, then two-finger spread ON the card (dist 100 -> 200 = 2x) via the viewport.
    await page.evaluate(() => {
      const card = document.querySelector('[data-testid^="collage-el-"]') as HTMLElement | null
      const vp = document.querySelector('[data-testid="mobile-arrange-viewport"]')
      if (!card || !vp) throw new Error('not found')
      const r = card.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const fireCard = (type: string, x: number, y: number): void =>
        void card.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }))
      const fireVp = (type: string, id: number, x: number, y: number): void =>
        void vp.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: id === 1 }))
      // tap-select the card first
      fireCard('pointerdown', cx, cy)
      fireCard('pointerup', cx, cy)
      // two-finger pinch on the card (fingers straddle center, dist 100 -> 200)
      fireVp('pointerdown', 1, cx - 50, cy)
      fireVp('pointerdown', 2, cx + 50, cy)
      fireVp('pointermove', 2, cx + 150, cy)
      fireVp('pointerup', 1, cx - 50, cy)
      fireVp('pointerup', 2, cx + 150, cy)
    })
    const afterW = await first.evaluate((el) => (el as HTMLElement).style.width)
    expect(parseFloat(afterW)).toBeGreaterThan(parseFloat(beforeW) * 1.5)

    // Capture still succeeds and yields an image (board zoom/card edits are baked from state).
    await page.getByTestId('mobile-arrange-create').tap()
    await expect(page.getByTestId('mobile-share-result')).toBeVisible()
  })

  test('with nothing selected, two fingers zoom the board (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.getByTestId('mobile-nav-share').tap()
    await page.getByTestId('mobile-select-all').tap()
    await page.getByTestId('mobile-select-create').tap()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="mobile-arrange-viewport"]')
      if (!vp) throw new Error('viewport not found')
      const fire = (type: string, id: number, x: number, y: number): void =>
        void vp.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: id === 1 }))
      // no card selected (fresh arrange) => two fingers zoom the stage
      fire('pointerdown', 1, 150, 420)
      fire('pointerdown', 2, 250, 420) // dist 100
      fire('pointermove', 2, 350, 420) // dist 200 => 2x
      fire('pointerup', 1, 150, 420)
      fire('pointerup', 2, 350, 420)
    })
    const t = await page.getByTestId('mobile-arrange-stage').evaluate((el) => (el as HTMLElement).style.transform)
    const scale = Number(/scale\(([\d.]+)\)/.exec(t)?.[1])
    expect(scale).toBeGreaterThan(1.5)
  })
```

> 注: `mobile-select-all` / `mobile-select-create` / `mobile-share-result` の testid は段階1の既存テストに存在する。もし名前が違えば `tests/e2e/mobile-share.spec.ts` の既存テストの記述に合わせる（arrange への到達手順は既存テストからコピーする）。tap-select は「pointerdown→pointerup を動かさず」で成立する（`handleElementPointerDown` が onSelect を呼び、移動が無ければ選択のみ）。

- [ ] **Step 3: e2e 実行**

```bash
npx playwright test tests/e2e/mobile-share.spec.ts
```

Expected: 段階1時点の本数＋新規3本が全緑。`rtk npx` は使わない。出力 tail は失敗リストであって実行リストではない点に注意。

- [ ] **Step 4: Commit**

```bash
rtk git add lib/share/collage-canvas-render.test.ts tests/e2e/mobile-share.spec.ts
rtk git commit -m "test: rotation call order + mobile selection/pinch/zoom e2e (N-58 stage 2)"
```

- [ ] **Step 5: 全体検証 → デプロイ**

```bash
rtk tsc && npx vitest run && pnpm build
npx playwright test tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 6: ユーザーへの実機確認依頼（コピペで渡す）**

```
スマホで https://allmarks.app をハードリロードして:
1. SHARE → 全選択 → ARRANGE（枚数が多いほど良い）
2. カードを1回タップ → 白い枠が出て「選択中」になりますか
3. 選択したまま2本指ピンチ → そのカードが拡大/縮小しますか。二本指をひねると回りますか
4. カードを1本指でドラッグ → 動きますか（指とズレないか）
5. 余白を1回タップ → 枠が消えて選択解除されますか
6. 何も選択していない状態で2本指ピンチ → ボード全体が拡大しますか。拡大したまま1本指で余白をなぞると見える場所が動きますか
7. CREATE → できた画像が「並べたとおり」ですか（ボードのズームは画像に影響しないはず）
8. 100枚でも 2〜7 が破綻しないか（重い/カクつく等あれば教えてください）
```

- [ ] **Step 7: 記録** — TODO.md / TODO_COMPLETED.md / CURRENT_GOAL.md / dashboard を更新。実機の感触でズーム上限やスロップの調整が要れば `STAGE_ZOOM_MAX`（`lib/share/stage-zoom.ts`）/ `PAN_SLOP_PX`（`MobileArrangeGestures.tsx`）だけ変えて再デプロイ。

---

## Self-Review（実装者への注意）

- **撮影系は1行も変わらない**。ボードズームは CSS transform のみで、撮影は state（`collagePositions`/`collageRotations`/`collageOrder` + `band`）から `renderCollageCanvasToJpeg` で再描画する＝ズーム/パンは画像に無影響。段の出入りで IDENTITY に戻すのは「再入場を綺麗にする」ためで、撮影のためではない。
- **`MobileArrangeBar` / result scrim / `MobileShareResult` は必ず `MobileArrangeGestures` の外**。transform を掛けた祖先は position:fixed の containing block になる（memory `reference_will_change_containing_block` と同種の罠）。
- **覗き窓の z-index は SHARE_CANVAS 必須**。transform が stacking context を作るため、中の `CollageCanvas` root の z:95 は外に効かなくなる。覗き窓自体を 95 に上げないと盤面カード（z:10）の下に沈む。
- **カード変形は base スナップショットから絶対計算**（`pinchBaseRef`）。毎フレーム現在値を掛けると誤差が溜まる。回転も `base.rotation + deltaDeg`。
- **回転はスケール不変**。角度は screen 座標同士で計算しても一様スケール下で保存されるので、既存 `collage-rotate` はそのまま通用。
- **1本指はカードへ素通し**（capture 相で size===1 かつカード上なら single を張らず stopPropagation もしない）。余白の1本指だけ覗き窓が pan/tap-deselect する。2本目の指だけ stopPropagation してカード操作の二重発火を防ぐ。
- Playwright の合成 PointerEvent は `setPointerCapture` に拒否される（memory `reference_board_card_click_pointer_capture`）が、実装は全部 try/catch 済み＋dispatch 先が要素直なので追跡は成立する。**実タッチのピンチ/回転の感触は実機のみ**（恒久ルール）。
- デスクトップ（>640px）は全新 prop が undefined ＝ DOM・挙動ともバイト同一。arrange の四隅リサイズ・ホバー回転ノブは従来どおり。
