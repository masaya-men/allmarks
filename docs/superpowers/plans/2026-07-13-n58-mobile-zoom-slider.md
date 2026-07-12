# N-58 スマホ ARRANGE ボードズーム・スライダー 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ ARRANGE の下部に「選択解除なしでいつでもボードを拡大できる」ズーム・スライダーを足す（100枚で余白が無く2本指ボードズームに入れない穴を塞ぐ）。拡大は選択カード中心（無選択は画面中心）。

**Architecture:** 純関数 `zoomStageToScale`（pivot 中心にスケールだけ変える・既存 `clampStageTransform` 再利用）＋ controlled な `MobileZoomSlider`（位置指定なし・ARRANGE バーの最上段に載る）＋ BoardRoot が pivot を決めて適用。ボードズームは CSS transform だけで撮影（state 由来）に無影響。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright

**設計書（正本）:** `docs/superpowers/specs/2026-07-13-n58-mobile-zoom-slider-design.md`

## Global Constraints

- TS `strict`。`any` 禁止。return type 明示。CSS は `.module.css`。Tailwind / Framer Motion 禁止。
- z-index は `BOARD_Z_INDEX`（`lib/board/constants.ts`）の定数のみ。ズーム率の範囲は既存 `STAGE_ZOOM_MIN`(1)/`STAGE_ZOOM_MAX`(6)（`lib/share/stage-zoom.ts`）。
- UI 文言は世界に通じる乾いた英語（i18n キーは足さない）。
- **デスクトップ（>640px）は不変**: 追加 UI は全て `isMobile` の ARRANGE バー内。`MobileArrangeBar` の新 prop `zoom` は任意＝省略時は現状バイト同一。
- **ボードズームは共有画像に無影響**: スライダーは `stageTransform`（CSS transform）だけ触る。`collagePositions`/`collageRotations`/`band`/撮影ハンドラ（`handleMobileCaptureAndCreate`）は変更しない。
- `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` は try/catch（jsdom/Playwright の合成ポインタが投げる）。
- git は `rtk` 前置。`--no-verify` 絶対禁止。commit body は ASCII。**vitest は素の `npx vitest run <file>`**、**Playwright も素の `npx playwright test`**（`rtk npx` は誤解析で壊れる）。

## File Structure

- Modify `lib/share/stage-zoom.ts` — 純関数 `zoomStageToScale` を追加（`panStageTransform` の後）。
- Create `components/board/MobileZoomSlider.tsx` + `.module.css` + `.test.tsx`。
- Modify `components/board/MobileArrangeBar.tsx`（＋ `.test.tsx`）— 任意 `zoom` prop＋ヒント文言。
- Modify `components/board/BoardRoot.tsx` — `handleZoomSliderChange` ＋ `MobileArrangeBar` へ `zoom` を渡す。
- Modify `tests/e2e/mobile-share.spec.ts` — 選択中でもスライダーでズームできる e2e 1本。

---

### Task 1: `zoomStageToScale` 純関数 【cheap 可（完全コード）】

**Files:**
- Modify: `lib/share/stage-zoom.ts`（`panStageTransform` の後に追加）
- Test: `lib/share/stage-zoom.test.ts`（既存に追記）

**Interfaces:**
- Consumes: 既存 `StageTransform` / `StagePoint` / `clampStageTransform` / `STAGE_ZOOM_MIN` / `STAGE_ZOOM_MAX` / `IDENTITY_STAGE_TRANSFORM`
- Produces: `zoomStageToScale(current: StageTransform, nextScale: number, pivot: StagePoint, viewportW: number, viewportH: number): StageTransform`
  - pivot（screen 座標）の下のコンテンツ点を画面上の同じ位置に保ったまま scale を nextScale に変える。scale は [MIN,MAX] にクランプ、tx/ty は `clampStageTransform` で画面を覆う範囲に収める。

- [ ] **Step 1: Write the failing test**

`lib/share/stage-zoom.test.ts` の末尾（最後の `})` の後）に追記。先頭 import 行に `zoomStageToScale` を足す（例: `import { clampStageTransform, createCollageGestureArbiter, IDENTITY_STAGE_TRANSFORM, panStageTransform, pinchStageTransform, STAGE_ZOOM_MAX, zoomStageToScale } from './stage-zoom'`。既存 import 済みシンボルはそのまま、`zoomStageToScale` を追加するだけ）:

```ts
describe('zoomStageToScale', () => {
  const VW = 390
  const VH = 844

  it('keeps the content point under the pivot fixed on screen while changing scale', () => {
    const cur = { scale: 2, tx: -100, ty: -200 }
    const pivot = { x: 195, y: 400 }
    // content under pivot now: ((195-(-100))/2, (400-(-200))/2) = (147.5, 300)
    const next = zoomStageToScale(cur, 3, pivot, VW, VH)
    expect(next.scale).toBe(3)
    // that content point must map back under the pivot at the new scale (not clamped here)
    expect(147.5 * next.scale + next.tx).toBeCloseTo(195)
    expect(300 * next.scale + next.ty).toBeCloseTo(400)
  })

  it('zooming in about the screen center from identity keeps the center fixed', () => {
    const next = zoomStageToScale(IDENTITY_STAGE_TRANSFORM, 2, { x: VW / 2, y: VH / 2 }, VW, VH)
    expect(next.scale).toBe(2)
    // center content (195, 422) stays centered: 195*2 + tx = 195 => tx = -195
    expect(next.tx).toBeCloseTo(-195)
    expect(next.ty).toBeCloseTo(-422)
  })

  it('clamps scale into [1, MAX] and pins to the origin at scale 1', () => {
    expect(zoomStageToScale({ scale: 2, tx: -50, ty: -50 }, 0.2, { x: 100, y: 100 }, VW, VH)).toEqual(IDENTITY_STAGE_TRANSFORM)
    expect(zoomStageToScale(IDENTITY_STAGE_TRANSFORM, 99, { x: 0, y: 0 }, VW, VH).scale).toBe(STAGE_ZOOM_MAX)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/share/stage-zoom.test.ts
```

Expected: FAIL — `zoomStageToScale` が存在しない。

- [ ] **Step 3: Implement**

`lib/share/stage-zoom.ts` の `panStageTransform`（現行 L67-75）の後に追加:

```ts
/** スライダー等で「拡大率だけ」を nextScale に変える。pivot（screen 座標）の下にある
 *  コンテンツ点を画面上の同じ位置に保ったままスケールを変える（＝pivot を中心にズーム）。
 *  pinchStageTransform と同じ「点固定ズーム」を1点で行う版。current.scale は常に >=1
 *  （clamp 済み状態）なので除算は安全。 */
export function zoomStageToScale(
  current: StageTransform,
  nextScale: number,
  pivot: StagePoint,
  viewportW: number,
  viewportH: number,
): StageTransform {
  const scale = Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, nextScale))
  const contentX = (pivot.x - current.tx) / current.scale
  const contentY = (pivot.y - current.ty) / current.scale
  return clampStageTransform(
    { scale, tx: pivot.x - contentX * scale, ty: pivot.y - contentY * scale },
    viewportW,
    viewportH,
  )
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run lib/share/stage-zoom.test.ts
rtk git add lib/share/stage-zoom.ts lib/share/stage-zoom.test.ts
rtk git commit -m "feat(share): zoomStageToScale (pivot-centered zoom for the board zoom slider) (N-58)"
```

---

### Task 2: `MobileZoomSlider` コンポーネント 【Sonnet 推奨（pointer 実装）】

**Files:**
- Create: `components/board/MobileZoomSlider.tsx`
- Create: `components/board/MobileZoomSlider.module.css`
- Test: `components/board/MobileZoomSlider.test.tsx`

**Interfaces:**
- Consumes: `STAGE_ZOOM_MIN` / `STAGE_ZOOM_MAX`（`lib/share/stage-zoom.ts`）
- Produces: `MobileZoomSlider({ scale, onScaleChange })`
  - `scale`（現在のズーム率）でつまみ位置を決める controlled。トラックへ pointer で `onScaleChange(nextScale)`。
  - 位置指定を持たない（親＝ARRANGE バーの縦積みに載る flex 行）。`data-no-capture`。
  - testid: `mobile-zoom-slider`（外枠）/ `mobile-zoom-slider-track`（トラック）/ `mobile-zoom-slider-thumb`（つまみ）。

- [ ] **Step 1: Write the failing test**

`components/board/MobileZoomSlider.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { STAGE_ZOOM_MAX, STAGE_ZOOM_MIN } from '@/lib/share/stage-zoom'
import { MobileZoomSlider } from './MobileZoomSlider'

/** jsdom の getBoundingClientRect は 0 を返すので、トラックに 0..300px の矩形を仕込む。 */
function mockTrackRect(el: HTMLElement): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 300, height: 20, right: 300, bottom: 20, x: 0, y: 0, toJSON: (): object => ({}) }),
  })
}

describe('MobileZoomSlider', () => {
  it('places the thumb at the left at min scale and near the right at max scale', () => {
    const min = render(<MobileZoomSlider scale={STAGE_ZOOM_MIN} onScaleChange={() => {}} />)
    expect((min.getByTestId('mobile-zoom-slider-thumb') as HTMLElement).style.left).toBe('0%')
    min.unmount()
    const max = render(<MobileZoomSlider scale={STAGE_ZOOM_MAX} onScaleChange={() => {}} />)
    expect((max.getByTestId('mobile-zoom-slider-thumb') as HTMLElement).style.left).toBe('100%')
  })

  it('a pointerdown at the track midpoint reports the mid scale', () => {
    const onScaleChange = vi.fn()
    const { getByTestId } = render(<MobileZoomSlider scale={STAGE_ZOOM_MIN} onScaleChange={onScaleChange} />)
    const track = getByTestId('mobile-zoom-slider-track')
    mockTrackRect(track)
    fireEvent.pointerDown(track, { button: 0, pointerId: 1, clientX: 150 }) // 150/300 = 0.5
    const mid = STAGE_ZOOM_MIN + 0.5 * (STAGE_ZOOM_MAX - STAGE_ZOOM_MIN)
    expect(onScaleChange).toHaveBeenLastCalledWith(mid)
  })

  it('dragging past the right edge clamps to max scale', () => {
    const onScaleChange = vi.fn()
    const { getByTestId } = render(<MobileZoomSlider scale={STAGE_ZOOM_MIN} onScaleChange={onScaleChange} />)
    const track = getByTestId('mobile-zoom-slider-track')
    mockTrackRect(track)
    fireEvent.pointerDown(track, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 9999 })
    expect(onScaleChange).toHaveBeenLastCalledWith(STAGE_ZOOM_MAX)
    fireEvent.pointerUp(track, { pointerId: 1 })
  })

  it('carries data-no-capture so it never bakes into the share image', () => {
    const { getByTestId } = render(<MobileZoomSlider scale={2} onScaleChange={() => {}} />)
    expect(getByTestId('mobile-zoom-slider').hasAttribute('data-no-capture')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run components/board/MobileZoomSlider.test.tsx
```

Expected: FAIL — `./MobileZoomSlider` が存在しない。

- [ ] **Step 3: Implement**

`components/board/MobileZoomSlider.tsx`:

```tsx
'use client'

import { useRef, type PointerEvent, type ReactElement } from 'react'
import { STAGE_ZOOM_MAX, STAGE_ZOOM_MIN } from '@/lib/share/stage-zoom'
import styles from './MobileZoomSlider.module.css'

export type MobileZoomSliderProps = {
  /** 現在のズーム率（stageTransform.scale）。つまみ位置を決める controlled。 */
  readonly scale: number
  /** つまみ操作で新しいズーム率を通知（BoardRoot が pivot 中心に適用する）。 */
  readonly onScaleChange: (nextScale: number) => void
}

const RANGE = STAGE_ZOOM_MAX - STAGE_ZOOM_MIN

/** スマホ ARRANGE のボードズーム・スライダー（N-58）。選択解除なしでいつでもボードを
 *  拡大できる見える操作。位置指定は持たず、ARRANGE バーの縦積みの中に1行として載る。
 *  値域は STAGE_ZOOM_MIN..MAX（線形）。撮影の transform ラッパーの外に置かれ、
 *  data-no-capture なので共有画像には写らない（そもそもボードズームは state に無影響）。 */
export function MobileZoomSlider(props: MobileZoomSliderProps): ReactElement {
  const trackRef = useRef<HTMLDivElement | null>(null)

  const fraction = Math.min(1, Math.max(0, (props.scale - STAGE_ZOOM_MIN) / RANGE))

  const scaleFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return props.scale
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return STAGE_ZOOM_MIN + f * RANGE
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button > 0) return
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* jsdom / synthetic pointer */
    }
    props.onScaleChange(scaleFromClientX(e.clientX))
    const move = (ev: globalThis.PointerEvent): void => {
      props.onScaleChange(scaleFromClientX(ev.clientX))
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      } catch {
        /* jsdom / synthetic pointer */
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <div className={styles.wrap} data-no-capture data-testid="mobile-zoom-slider">
      <span className={styles.glyph} aria-hidden="true">
        {/* minimal magnifier glyph (mono, currentColor) */}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M15.5 15.5 L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        data-testid="mobile-zoom-slider-track"
        role="slider"
        aria-label="Board zoom"
        aria-valuemin={STAGE_ZOOM_MIN}
        aria-valuemax={STAGE_ZOOM_MAX}
        aria-valuenow={Math.round(props.scale * 10) / 10}
      >
        <div className={styles.fill} style={{ width: `${fraction * 100}%` }} />
        <div className={styles.thumb} style={{ left: `${fraction * 100}%` }} data-testid="mobile-zoom-slider-thumb" />
      </div>
    </div>
  )
}
```

`components/board/MobileZoomSlider.module.css`:

```css
/* N-58: スマホ ARRANGE のボードズーム・スライダー。ARRANGE バーの縦積みに載る1行。
   ミニマルなモノトーン（数字なし）。つまみのタッチ余白を広く取る。 */
.wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 6px;
  color: rgba(255, 255, 255, 0.62);
}

.glyph {
  display: inline-flex;
  flex: 0 0 auto;
}

.track {
  position: relative;
  flex: 1 1 auto;
  height: 32px; /* タッチ帯を広く（見た目の線は中央の ::before） */
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

/* 細い実トラック（中央線） */
.track::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 3px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.fill {
  position: absolute;
  left: 0;
  top: 50%;
  height: 3px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

.thumb {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run components/board/MobileZoomSlider.test.tsx
rtk git add components/board/MobileZoomSlider.tsx components/board/MobileZoomSlider.module.css components/board/MobileZoomSlider.test.tsx
rtk git commit -m "feat(board): MobileZoomSlider control for the mobile arrange stage (N-58)"
```

---

### Task 3: `MobileArrangeBar` に載せて `BoardRoot` から配線＋e2e 【Sonnet 推奨】

**Files:**
- Modify: `components/board/MobileArrangeBar.tsx`
- Modify: `components/board/MobileArrangeBar.test.tsx`（追記）
- Modify: `components/board/BoardRoot.tsx`
- Modify: `tests/e2e/mobile-share.spec.ts`（追記）

**Interfaces:**
- Consumes: Task 1 の `zoomStageToScale` / 既存 `StagePoint`、Task 2 の `MobileZoomSlider`
- Produces: `MobileArrangeBar` に任意 `zoom?: { scale: number; onScaleChange: (n: number) => void }`

- [ ] **Step 1: Write the failing tests**

`components/board/MobileArrangeBar.test.tsx` に追記（`describe('MobileArrangeBar', …)` 内。無ければファイル冒頭の import に合わせて）:

```tsx
  it('renders the zoom slider only when the zoom prop is provided', () => {
    const without = render(<MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={false} />)
    expect(without.queryByTestId('mobile-zoom-slider')).toBeNull()
    without.unmount()
    const withZoom = render(
      <MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={false} zoom={{ scale: 2, onScaleChange: () => {} }} />,
    )
    expect(withZoom.getByTestId('mobile-zoom-slider')).toBeTruthy()
  })
```

`MobileArrangeBar.test.tsx` が `render` を import 済みでなければ `import { render } from '@testing-library/react'` を足す（既存テストの流儀に合わせる）。

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run components/board/MobileArrangeBar.test.tsx
```

Expected: FAIL — `zoom` prop 未対応。

- [ ] **Step 3: Implement — MobileArrangeBar**

`components/board/MobileArrangeBar.tsx`:

1. import に追加: `import { MobileZoomSlider } from './MobileZoomSlider'`
2. `MobileArrangeBarProps` に追加:

```ts
  /** スマホのボードズーム・スライダー（省略時は出さない＝デスクトップ/従来不変）。 */
  readonly zoom?: {
    readonly scale: number
    readonly onScaleChange: (nextScale: number) => void
  }
```

3. `.bar` の中、`.hint` の**手前**（最上段）に:

```tsx
      {props.zoom && <MobileZoomSlider scale={props.zoom.scale} onScaleChange={props.zoom.onScaleChange} />}
```

4. ヒント文言を更新（2本指ではなくスライダー主体に）:

```tsx
      <span className={styles.hint}>TAP A CARD TO SELECT — PINCH TO RESIZE OR ROTATE — SLIDER ZOOMS THE BOARD</span>
```

- [ ] **Step 4: Implement — BoardRoot**

1. import: 既存の stage-zoom からの import 行に `zoomStageToScale` と（未 import なら）`type StagePoint` を足す。例: `import { createCollageGestureArbiter, IDENTITY_STAGE_TRANSFORM, zoomStageToScale, type CollageGestureArbiter, type StagePoint, type StageTransform } from '@/lib/share/stage-zoom'`（既存 import の形に合わせて `zoomStageToScale` と `StagePoint` を追加するだけ。既存シンボルは残す）。
2. `handleSelectedPinch`（現行 L2505-2513）の**後**に追加:

```ts
  // スマホ ARRANGE のズーム・スライダー: 選択カード中心（無選択は画面中心）にボードをズーム。
  // stageTransform だけを触る（撮影は state 由来＝画像に無影響）。関数型 setState で
  // prev から pivot を計算＝stale closure を避ける。
  const handleZoomSliderChange = useCallback(
    (nextScale: number): void => {
      const box = boardFrameRef.current?.getBoundingClientRect()
      const vw = box?.width ?? viewport.w
      const vh = box?.height ?? viewport.h
      setStageTransform((prev) => {
        const pos = selectedCollageId ? collagePositions[selectedCollageId] : undefined
        let pivot: StagePoint
        if (pos) {
          const cx = pos.x + pos.w / 2
          const cy = pos.y + pos.h / 2
          pivot = { x: cx * prev.scale + prev.tx, y: cy * prev.scale + prev.ty }
        } else {
          pivot = { x: vw / 2, y: vh / 2 }
        }
        return zoomStageToScale(prev, nextScale, pivot, vw, vh)
      })
    },
    [selectedCollageId, collagePositions, viewport.w, viewport.h],
  )
```

3. `MobileArrangeBar` の JSX（現行 L3750-3754）に `zoom` prop を追加:

```tsx
                  <MobileArrangeBar
                    onBack={handleShareReselect}
                    onCreate={(): void => { void handleMobileCaptureAndCreate() }}
                    creating={shareCreateState === 'creating'}
                    zoom={{ scale: stageTransform.scale, onScaleChange: handleZoomSliderChange }}
                  />
```

（`MobileArrangeBar` は既に `isMobile` の分岐内なので、これで mobile 限定。デスクトップの `ShareToast` 経路は無変更。）

- [ ] **Step 5: 検証（型＋単体＋ビルド）**

```bash
rtk tsc
npx vitest run components/board/MobileZoomSlider.test.tsx components/board/MobileArrangeBar.test.tsx lib/share/stage-zoom.test.ts
npx vitest run
pnpm build
```

Expected: tsc 0 / 対象単体緑 / 全 vitest 緑 / build OK。

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/MobileArrangeBar.tsx components/board/MobileArrangeBar.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(board): wire board zoom slider into mobile arrange (pivot = selected card, else center) (N-58)"
```

- [ ] **Step 7: e2e — 選択中でもスライダーでズームできる（今回の穴の回帰）**

`tests/e2e/mobile-share.spec.ts` の phone describe に追記（既存 helper `seedBoard`/`stubCreate` と、ARRANGE への到達＝`mobile-nav-share`→`mobile-select-all`→`mobile-select-create` は既存テストの流儀に合わせる。既存テストが `.click()` を使っていれば `.click()`、`.tap()` なら `.tap()`）:

```ts
  test('the zoom slider zooms the board even while a card is selected (N-58 packed-board fix)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.getByTestId('mobile-nav-share').click()
    await page.getByTestId('mobile-select-all').click()
    await page.getByTestId('mobile-select-create').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    // select a card first (tap = pointerdown+up, no move) so we're in the "card selected" state
    const first = page.locator('[data-testid^="collage-el-"]').first()
    const id = await first.evaluate((el) => el.getAttribute('data-testid')?.replace('collage-el-', '') ?? '')
    await first.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const fire = (t: string): void =>
        void el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }))
      fire('pointerdown')
      fire('pointerup')
    })
    await expect(page.getByTestId(`collage-selection-${id}`)).toBeVisible()

    // drag the zoom slider track to the right — must zoom the board WITHOUT any deselect
    await page.getByTestId('mobile-zoom-slider-track').evaluate((el) => {
      const r = el.getBoundingClientRect()
      const y = r.top + r.height / 2
      const fire = (t: string, x: number): void =>
        void el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 5, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }))
      fire('pointerdown', r.left + 2)
      fire('pointermove', r.left + r.width * 0.8)
      fire('pointerup', r.left + r.width * 0.8)
    })
    const t = await page.getByTestId('mobile-arrange-stage').evaluate((el) => (el as HTMLElement).style.transform)
    const scale = Number(/scale\(([\d.]+)\)/.exec(t)?.[1])
    expect(scale).toBeGreaterThan(1.5)
  })
```

- [ ] **Step 8: 実行 → Commit**

```bash
npx playwright test tests/e2e/mobile-share.spec.ts
rtk git add tests/e2e/mobile-share.spec.ts
rtk git commit -m "test(e2e): zoom slider zooms while a card is selected (N-58 packed-board fix)"
```

Expected: 直前の本数＋新規1本が全緑。`rtk npx` は使わない。出力 tail は失敗リストであって実行リストではない。

---

## Self-Review（実装者への注意）

- **ボードズームは共有画像に無影響**。スライダーは `stageTransform` だけを触り、撮影（`renderCollageCanvasToJpeg`）は `collagePositions`/`collageRotations`/`band` から描く。撮影ハンドラは無改変。
- **pivot 中心ズーム**: 選択カードの中心を「現在の transform で screen 座標へ写像」してから `zoomStageToScale` に渡す（＝拡大してもその点が画面上で動かない）。関数型 setState（`setStageTransform((prev) => …)`）で prev から pivot を計算＝stale closure 回避。
- **`current.scale` は常に >=1**（clamp 済み状態）なので `zoomStageToScale` の除算は安全。
- **デスクトップ不変**: `MobileArrangeBar` の `zoom` は任意。BoardRoot は `isMobile` の ARRANGE バー分岐でのみ渡す。省略時は既存テストも DOM も不変。
- スライダーの pointer リスナーはトラック要素に addEventListener（合成ポインタでも成立）。`setPointerCapture` は try/catch。**実タッチの感触は実機のみ**。
- 2本指ボードズームとスライダーは同じ `stageTransform` を読み書き＝常に一致（controlled）。
