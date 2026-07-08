# スマホ専用ライトボックス Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** スマホ（`isMobile`=`max-width:640px`）でカードタップ時に、主役を画面中央に大きく出す没入型ライトボックスを新設し、4方向ジェスチャ（左右=送り／上=情報シート／下=閉じる）で操作。開閉はPCと同じモーフ（`.media` の実測rectへ着地）を流用。

**Architecture:** `Lightbox.tsx` に `isMobile` 分岐を1つ足し、モバイル時は新規 `MobileLightbox` を描画（PC経路は不変）。ジェスチャ判定は純関数 `lightbox-swipe.ts`（テスト可）＋React配線 `use-lightbox-swipe.ts`（実機のみ）に分離。情報シートは `LightboxInfoSheet`。主役ラッパに既存 `mediaRef` を付け、Lightbox側のモーフeffectを無改造で機能させる。

**Tech Stack:** Next.js14 / React / TypeScript strict / Vanilla CSS Modules / GSAP（既存モーフ）/ vitest（純関数・mount）。**検証はユーザー実機（Playwright非使用の合意）＋tsc/vitest（ビルド健全性）。**

## Global Constraints

- TypeScript `strict`。`any` 禁止（`unknown`+ガード）。Return type 明示。
- CSS は Vanilla + CSS Modules。Tailwind/Framer Motion 禁止。z-index は定数。
- **全変更を `isMobile` ゲート。デスクトップのライトボックス（`.frame` 2カラム）は1pxも変えない。**
- 金額は¥（本機能では無関係）。UI文言は世界共通の平易英語（memory `feedback_ui_vocabulary`）。
- `isMobile` の唯一の出所は `useIsMobile()`（`lib/board/use-is-mobile.ts`、`max-width:640px` と厳密一致）。
- 検証: **ジェスチャ・モーフ・スクロールの体感は実機のみ**（Playwright合成タッチ/JSスクロールはすり抜ける＝memory `reference_native_scroll_touch_action_playwright`）。tsc0 + vitest緑 + `pnpm build` を各コミット前ゲート、その後デプロイしてユーザー実機確認。

---

## File Structure

- `components/board/lightbox-swipe.ts`（新規）— 純関数: 軸ロック・完了intent判定・定数。**単体テスト対象**。
- `components/board/lightbox-swipe.test.ts`（新規）— vitest。
- `components/board/use-lightbox-swipe.ts`（新規）— React hook: pointer events → 指追従transform + 完了時コールバック。実機のみ。
- `components/board/LightboxInfoSheet.tsx` / `.module.css`（新規）— 下端の情報シート。
- `components/board/MobileLightbox.tsx` / `.module.css`（新規）— 没入レイアウト（主役中央大＋✕＋シート＋ジェスチャ層）。
- `components/board/Lightbox.tsx`（変更）— `useIsMobile()` 追加、`isMobile ? <MobileLightbox/> : <現行frame>` 分岐。主役/シートのノードをカード種別ごとに組み立てて渡す。
- `lib/board/constants.ts`（変更・任意）— `BOARD_Z_INDEX` にモバイルLB用 z を追加（既存の z 定数群に合わせる）。

---

## Task 1: ジェスチャ判定の純関数（テスト付き）

**Files:**
- Create: `components/board/lightbox-swipe.ts`
- Test: `components/board/lightbox-swipe.test.ts`

**Interfaces:**
- Produces:
  - `type SwipeAxis = 'none' | 'horizontal' | 'vertical'`
  - `type SwipeIntent = 'none' | 'next' | 'prev' | 'close' | 'sheet'`
  - `SWIPE` 定数（`AXIS_LOCK_PX`, `CLOSE_RATIO`, `NAV_RATIO`, `SHEET_RATIO`, `FLICK_VELOCITY`）
  - `resolveAxis(dx: number, dy: number, lockPx?: number): SwipeAxis`
  - `resolveIntent(a: ResolveIntentArgs): SwipeIntent`（`ResolveIntentArgs = { axis, dx, dy, vx, vy, viewportW, viewportH, atEnd?: { prev: boolean; next: boolean } }`）

- [ ] **Step 1: 失敗するテストを書く** — `components/board/lightbox-swipe.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { resolveAxis, resolveIntent, SWIPE } from './lightbox-swipe'

describe('resolveAxis', () => {
  it('locks to none under the threshold', () => {
    expect(resolveAxis(3, 3)).toBe('none')
  })
  it('locks horizontal when |dx| dominates', () => {
    expect(resolveAxis(20, 5)).toBe('horizontal')
  })
  it('locks vertical when |dy| dominates', () => {
    expect(resolveAxis(5, 20)).toBe('vertical')
  })
})

describe('resolveIntent', () => {
  const base = { vx: 0, vy: 0, viewportW: 400, viewportH: 800 } as const
  it('swipe left past NAV_RATIO → next', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -200, dy: 0 })).toBe('next')
  })
  it('swipe right past NAV_RATIO → prev', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: 200, dy: 0 })).toBe('prev')
  })
  it('short horizontal drag → none', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -40, dy: 0 })).toBe('none')
  })
  it('fast horizontal flick under distance → next', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -40, dy: 0, vx: -1 })).toBe('next')
  })
  it('next blocked at end boundary', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -200, dy: 0, atEnd: { prev: false, next: true } })).toBe('none')
  })
  it('down past CLOSE_RATIO → close', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: 300 })).toBe('close')
  })
  it('up past SHEET_RATIO → sheet', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: -200 })).toBe('sheet')
  })
  it('small vertical → none', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: 40 })).toBe('none')
  })
})
```

- [ ] **Step 2: 失敗を確認** — `rtk vitest run components/board/lightbox-swipe.test.ts` → FAIL（モジュール未実装）

- [ ] **Step 3: 実装** — `components/board/lightbox-swipe.ts`

```ts
export type SwipeAxis = 'none' | 'horizontal' | 'vertical'
export type SwipeIntent = 'none' | 'next' | 'prev' | 'close' | 'sheet'

export const SWIPE = {
  AXIS_LOCK_PX: 8,
  CLOSE_RATIO: 0.25,
  NAV_RATIO: 0.35,
  SHEET_RATIO: 0.18,
  FLICK_VELOCITY: 0.5, // px/ms
} as const

export function resolveAxis(dx: number, dy: number, lockPx: number = SWIPE.AXIS_LOCK_PX): SwipeAxis {
  if (Math.abs(dx) < lockPx && Math.abs(dy) < lockPx) return 'none'
  return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
}

export type ResolveIntentArgs = {
  axis: SwipeAxis
  dx: number
  dy: number
  vx: number
  vy: number
  viewportW: number
  viewportH: number
  atEnd?: { prev: boolean; next: boolean }
}

export function resolveIntent(a: ResolveIntentArgs): SwipeIntent {
  if (a.axis === 'horizontal') {
    const passed = Math.abs(a.dx) > a.viewportW * SWIPE.NAV_RATIO || Math.abs(a.vx) > SWIPE.FLICK_VELOCITY
    if (!passed) return 'none'
    if (a.dx < 0) return a.atEnd?.next ? 'none' : 'next'
    return a.atEnd?.prev ? 'none' : 'prev'
  }
  if (a.axis === 'vertical') {
    if (a.dy > 0) {
      const passed = a.dy > a.viewportH * SWIPE.CLOSE_RATIO || a.vy > SWIPE.FLICK_VELOCITY
      return passed ? 'close' : 'none'
    }
    const passed = -a.dy > a.viewportH * SWIPE.SHEET_RATIO || -a.vy > SWIPE.FLICK_VELOCITY
    return passed ? 'sheet' : 'none'
  }
  return 'none'
}
```

- [ ] **Step 4: 通過確認** — `rtk vitest run components/board/lightbox-swipe.test.ts` → PASS

- [ ] **Step 5: commit** — `rtk git add components/board/lightbox-swipe.ts components/board/lightbox-swipe.test.ts && rtk git commit -m "feat(lightbox/mobile): swipe axis-lock + intent resolution pure logic (s180)"`

---

## Task 2: ジェスチャ配線フック（実機のみ・純ロジックを消費）

**Files:**
- Create: `components/board/use-lightbox-swipe.ts`

**Interfaces:**
- Consumes: `resolveAxis`, `resolveIntent`, `SwipeAxis`, `SWIPE`（Task 1）
- Produces: `useLightboxSwipe(opts: UseLightboxSwipeOpts): { bind: { onPointerDown; onPointerMove; onPointerUp; onPointerCancel }; axisRef: RefObject<SwipeAxis> }`
  - `UseLightboxSwipeOpts = { stageRef: RefObject<HTMLElement>; contentScrollable?: () => { top: boolean; bottom: boolean }; atEnd?: () => { prev: boolean; next: boolean }; onIntent: (intent: SwipeIntent) => void; onDrag?: (axis: SwipeAxis, dx: number, dy: number) => void }`

- [ ] **Step 1: 実装**（単体テストは付けない＝実タッチ依存。純ロジックは Task 1 で担保）

```ts
import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { resolveAxis, resolveIntent, type SwipeAxis, type SwipeIntent } from './lightbox-swipe'

export type UseLightboxSwipeOpts = {
  readonly stageRef: RefObject<HTMLElement>
  /** True 側はそれ方向にまだ内部スクロール余地がある＝ジェスチャを内部スクロールに譲る。 */
  readonly contentScrollable?: () => { top: boolean; bottom: boolean }
  readonly atEnd?: () => { prev: boolean; next: boolean }
  readonly onIntent: (intent: SwipeIntent) => void
  readonly onDrag?: (axis: SwipeAxis, dx: number, dy: number) => void
}

export function useLightboxSwipe(opts: UseLightboxSwipeOpts): {
  readonly bind: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: (e: ReactPointerEvent) => void
    onPointerCancel: (e: ReactPointerEvent) => void
  }
  readonly axisRef: RefObject<SwipeAxis>
} {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const axisRef = useRef<SwipeAxis>('none')

  const onPointerDown = useCallback((e: ReactPointerEvent): void => {
    if (e.pointerType === 'mouse') return
    startRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    lastRef.current = startRef.current
    axisRef.current = 'none'
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent): void => {
    const start = startRef.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    lastRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (axisRef.current === 'none') {
      const axis = resolveAxis(dx, dy)
      if (axis === 'none') return
      // 縦方向で内部スクロール余地があれば、その縦ドラッグは内部に譲る（軸=none 継続）。
      if (axis === 'vertical' && opts.contentScrollable) {
        const s = opts.contentScrollable()
        if ((dy > 0 && !s.top) || (dy < 0 && !s.bottom)) return
      }
      axisRef.current = axis
    }
    opts.onDrag?.(axisRef.current, dx, dy)
  }, [opts])

  const finish = useCallback((e: ReactPointerEvent): void => {
    const start = startRef.current
    const last = lastRef.current
    startRef.current = null
    if (!start || !last || axisRef.current === 'none') { axisRef.current = 'none'; opts.onDrag?.('none', 0, 0); return }
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const dt = Math.max(1, last.t - start.t)
    const intent = resolveIntent({
      axis: axisRef.current, dx, dy,
      vx: (last.x - start.x) / dt, vy: (last.y - start.y) / dt,
      viewportW: window.innerWidth, viewportH: window.innerHeight,
      atEnd: opts.atEnd?.(),
    })
    axisRef.current = 'none'
    opts.onIntent(intent)
  }, [opts])

  return {
    bind: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
    axisRef,
  }
}
```

- [ ] **Step 2: tsc** — `rtk tsc` → clean

- [ ] **Step 3: commit** — `rtk git add components/board/use-lightbox-swipe.ts && rtk git commit -m "feat(lightbox/mobile): pointer wiring hook for 4-direction swipe (s180)"`

---

## Task 3: 情報シート `LightboxInfoSheet`

**Files:**
- Create: `components/board/LightboxInfoSheet.tsx`, `components/board/LightboxInfoSheet.module.css`
- Test: `components/board/LightboxInfoSheet.test.tsx`

**Interfaces:**
- Produces: `LightboxInfoSheet(props: { open: boolean; onToggle: () => void; children: ReactNode }): ReactNode`
  - `data-testid="lightbox-info-sheet"`、`data-open`、上端にグラブハンドル（`aria-label="Details"` のボタン、`onClick=onToggle`）。

- [ ] **Step 1: 失敗テスト** — `LightboxInfoSheet.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LightboxInfoSheet } from './LightboxInfoSheet'

describe('LightboxInfoSheet', () => {
  it('renders children and reflects open state', () => {
    render(<LightboxInfoSheet open onToggle={() => {}}><p>caption</p></LightboxInfoSheet>)
    expect(screen.getByText('caption')).toBeTruthy()
    expect(screen.getByTestId('lightbox-info-sheet').getAttribute('data-open')).toBe('true')
  })
  it('fires onToggle when the grab handle is tapped', () => {
    const onToggle = vi.fn()
    render(<LightboxInfoSheet open={false} onToggle={onToggle}><span>x</span></LightboxInfoSheet>)
    fireEvent.click(screen.getByLabelText('Details'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 失敗確認** — `rtk vitest run components/board/LightboxInfoSheet.test.tsx` → FAIL

- [ ] **Step 3: 実装** — `LightboxInfoSheet.tsx`

```tsx
import type { ReactNode } from 'react'
import styles from './LightboxInfoSheet.module.css'

/** Bottom info sheet for the mobile lightbox. Hidden (peeking a grab handle)
 *  until the user swipes up or taps the handle. Holds title/description/source/
 *  meta/translate — the secondary info for the big-center main content. */
export function LightboxInfoSheet({
  open, onToggle, children,
}: {
  readonly open: boolean
  readonly onToggle: () => void
  readonly children: ReactNode
}): ReactNode {
  return (
    <div className={styles.sheet} data-testid="lightbox-info-sheet" data-open={open ? 'true' : 'false'}>
      <button type="button" className={styles.handle} aria-label="Details" onClick={onToggle}>
        <span className={styles.grip} aria-hidden="true" />
      </button>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
```

`LightboxInfoSheet.module.css`:

```css
.sheet {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  max-height: 80%;
  display: flex;
  flex-direction: column;
  background: rgba(12, 12, 16, 0.92);
  backdrop-filter: blur(18px);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  transform: translateY(calc(100% - 34px)); /* peek: only the handle shows */
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.sheet[data-open='true'] { transform: translateY(0); }
.handle {
  flex: none;
  height: 34px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  touch-action: none;
}
.grip { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.4); }
.body { overflow-y: auto; padding: 4px 22px 32px; color: #fff; }
```

- [ ] **Step 4: 通過確認** — `rtk vitest run components/board/LightboxInfoSheet.test.tsx` → PASS

- [ ] **Step 5: commit** — `rtk git add components/board/LightboxInfoSheet.* && rtk git commit -m "feat(lightbox/mobile): bottom info sheet with grab handle (s180)"`

---

## Task 4: 没入レイアウト `MobileLightbox`

**Files:**
- Create: `components/board/MobileLightbox.tsx`, `components/board/MobileLightbox.module.css`
- Test: `components/board/MobileLightbox.test.tsx`

**Interfaces:**
- Consumes: `useLightboxSwipe`（Task 2）, `LightboxInfoSheet`（Task 3）, `SwipeIntent`
- Produces: `MobileLightbox(props: MobileLightboxProps): ReactNode`

```ts
type MobileLightboxProps = {
  readonly view: LightboxItem            // from lib/share/lightbox-item
  readonly mediaRef: RefObject<HTMLDivElement>   // morph target — wraps `main`
  readonly main: ReactNode               // big-center content (media / tweet body / large text)
  readonly sheet: ReactNode              // info content for the bottom sheet
  readonly nav: LightboxNav | null
  readonly onClose: () => void
  readonly contentScrollable?: () => { top: boolean; bottom: boolean }
}
```

**動作**: `data-testid="mobile-lightbox"`。主役ラッパ（`ref={mediaRef}`, `className=styles.main`）に `main` を入れる。右上に✕（`onClose`）。下端に `LightboxInfoSheet`。ステージ全体に `useLightboxSwipe` を配線: `onIntent` で `next/prev`→`nav.onNav(±1)`、`close`→`onClose`、`sheet`→シート open。`onDrag` で指追従（縦=stage translateY+微縮小 / 横=main translateX）。`atEnd` は `nav` の index/total から算出。

- [ ] **Step 1: 失敗テスト（構造のみ）** — `MobileLightbox.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { MobileLightbox } from './MobileLightbox'
import type { LightboxItem } from '@/lib/share/lightbox-item'

const view = { url: 'https://x.test/a', title: 'T', description: '', thumbnail: null } as unknown as LightboxItem

describe('MobileLightbox', () => {
  it('renders the big-center main and the info sheet', () => {
    render(
      <MobileLightbox view={view} mediaRef={createRef()} main={<img alt="m" />} sheet={<p>info</p>} nav={null} onClose={() => {}} />,
    )
    expect(screen.getByTestId('mobile-lightbox')).toBeTruthy()
    expect(screen.getByAltText('m')).toBeTruthy()
    expect(screen.getByTestId('lightbox-info-sheet')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 失敗確認** — `rtk vitest run components/board/MobileLightbox.test.tsx` → FAIL

- [ ] **Step 3: 実装** — `MobileLightbox.tsx`（下記コード）と `MobileLightbox.module.css`（全画面ステージ・主役中央 `contain`・✕）。ジェスチャ配線＋指追従＋シート open state。

```tsx
'use client'
import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useLightboxSwipe } from './use-lightbox-swipe'
import { LightboxInfoSheet } from './LightboxInfoSheet'
import type { LightboxItem } from '@/lib/share/lightbox-item'
import type { LightboxNav } from './lightbox-nav-types' // ※ LightboxNav を Lightbox.tsx から export 抽出（Task 5 で対応）
import styles from './MobileLightbox.module.css'

type MobileLightboxProps = {
  readonly view: LightboxItem
  readonly mediaRef: RefObject<HTMLDivElement>
  readonly main: ReactNode
  readonly sheet: ReactNode
  readonly nav: LightboxNav | null
  readonly onClose: () => void
  readonly contentScrollable?: () => { top: boolean; bottom: boolean }
}

export function MobileLightbox({ view, mediaRef, main, sheet, nav, onClose, contentScrollable }: MobileLightboxProps): ReactNode {
  const stageRef = useRef<HTMLDivElement>(null)
  const mainWrapRef = mediaRef
  const [sheetOpen, setSheetOpen] = useState(false)

  const atEnd = useCallback(() => ({
    prev: nav ? nav.currentIndex <= 0 : true,
    next: nav ? nav.currentIndex >= nav.total - 1 : true,
  }), [nav])

  const { bind } = useLightboxSwipe({
    stageRef,
    contentScrollable,
    atEnd,
    onDrag: (axis, dx, dy) => {
      const stage = stageRef.current
      const mainEl = mainWrapRef.current
      if (axis === 'vertical' && stage) {
        const damp = dy > 0 ? dy : dy * 0.4 // 上方向は控えめ（シートが主役）
        stage.style.transform = `translateY(${damp}px) scale(${Math.max(0.9, 1 - Math.abs(dy) / 1600)})`
      } else if (axis === 'horizontal' && mainEl) {
        mainEl.style.transform = `translateX(${dx}px)`
      } else if (axis === 'none' && stage && mainEl) {
        stage.style.transform = ''
        mainEl.style.transform = ''
      }
    },
    onIntent: (intent) => {
      const stage = stageRef.current
      const mainEl = mainWrapRef.current
      if (stage) stage.style.transform = ''
      if (mainEl) mainEl.style.transform = ''
      if (intent === 'close') onClose()
      else if (intent === 'next') nav?.onNav(1)
      else if (intent === 'prev') nav?.onNav(-1)
      else if (intent === 'sheet') setSheetOpen(true)
    },
  })

  return (
    <div ref={stageRef} className={styles.stage} data-testid="mobile-lightbox" role="dialog" aria-modal="true" {...bind}>
      <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
        <span aria-hidden="true">✕</span>
      </button>
      <div ref={mainWrapRef} className={styles.main} onClick={(e) => e.stopPropagation()}>
        {main}
      </div>
      <LightboxInfoSheet open={sheetOpen} onToggle={() => setSheetOpen((v) => !v)}>
        {sheet}
      </LightboxInfoSheet>
    </div>
  )
}
```

`MobileLightbox.module.css`（要点）:

```css
.stage {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  touch-action: none;              /* ジェスチャは自前。内部スクロールは main 側で pan-y */
  will-change: transform;
}
.main {
  max-width: 100vw; max-height: 100vh;
  display: flex; align-items: center; justify-content: center;
}
.main :global(img), .main :global(video) { max-width: 100vw; max-height: 100vh; object-fit: contain; }
.close {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(0,0,0,0.4); color: #fff; border: none; cursor: pointer;
}
```

- [ ] **Step 4: 通過確認** — `rtk vitest run components/board/MobileLightbox.test.tsx` → PASS（`lightbox-nav-types` は Task 5 で用意するため、本Taskでは `LightboxNav` 型を一時的に `MobileLightbox.tsx` 内 local 定義で開始し、Task 5 で共有 export に差し替えてもよい）

- [ ] **Step 5: commit** — `rtk git add components/board/MobileLightbox.* && rtk git commit -m "feat(lightbox/mobile): immersive stage + gesture wiring (s180)"`

---

## Task 5: `Lightbox.tsx` にモバイル分岐を配線（種別ごとの main/sheet）

**Files:**
- Modify: `components/board/Lightbox.tsx`（`useIsMobile` 追加、`.stage` 内の描画を分岐）
- Create（任意）: `components/board/lightbox-nav-types.ts`（`LightboxNav` を切り出して MobileLightbox と共有）

**Interfaces:**
- Consumes: `MobileLightbox`（Task 4）, `useIsMobile`（`lib/board/use-is-mobile.ts`）
- 主役/シートの組み立て（種別）:
  - 画像/動画/website: `main = <LightboxMedia item={view} />`、`sheet = <DefaultText item={view} host={host} />`（既存コンポーネント再利用）。**mediaRef は MobileLightbox 側の `.main` ラッパに付く**（＝モーフ着地先。desktop で mediaRef が付いていた `.media` の役割を mobile では `.main` が担う）。
  - tweet: `main = <TweetMediaOrBody .../>`（既存 `TweetColumns` の右パネル相当の中身）、`sheet` に翻訳トグル＋meta。※ tweet は複雑なので **本Taskでは tweet も `LightboxMedia`+`DefaultText` 相当のフォールバックで最低限表示**し、tweet 専用の main/sheet 最適化は Task 6 に回す。
  - 文字カード: `main` に大きめテキスト（`shouldRenderLargePlaceholderCard` 経路 or `DefaultText`）、`sheet` は出典/meta のみ。

- [ ] **Step 1: `LightboxNav` を共有 export 化**（`lightbox-nav-types.ts` に移し、Lightbox.tsx と MobileLightbox.tsx が import）。※移動のみ・挙動不変。

- [ ] **Step 2: Lightbox に isMobile 分岐を追加** — `.stage` 内の `nav chevron` と `.frame` を、`isMobile` の時は描画せず、代わりに `<MobileLightbox .../>` を描画。desktop 経路（`!isMobile`）は現状のまま。

```tsx
// Lightbox 本体の描画側（.stage の子）
const isMobile = useIsMobile()
// ...
{isMobile ? (
  <MobileLightbox
    view={view}
    mediaRef={mediaRef}
    nav={nav ?? null}
    onClose={requestClose}
    main={tweetId ? <LightboxMedia item={view} /> : <LightboxMedia item={view} />}
    sheet={<DefaultText item={view} host={host} />}
    contentScrollable={() => {
      const el = textRef.current
      if (!el) return { top: true, bottom: true }
      return { top: el.scrollTop <= 0, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1 }
    }}
  />
) : (
  <>
    {nav && nav.total > 1 && (<><LightboxNavChevron dir="prev" .../><LightboxNavChevron dir="next" .../></>)}
    <div ref={frameRef} className={styles.frame} onClick={requestClose}>{/* 既存2カラム */}</div>
  </>
)}
```

- [ ] **Step 3: 回帰テスト（構造）** — `components/board/Lightbox.mobile.test.tsx` を追加。`useIsMobile` を mock:
  - `matchMedia` を `matches:false` にすると `screen.queryByTestId('mobile-lightbox')` が null、`screen.getByTestId('lightbox')`（既存 `.stage`）内に `.frame` 相当が出る。
  - `matches:true` にすると `mobile-lightbox` が出て、PCの `.frame` チェブロンが出ない。
  （`useIsMobile` は effect後に true 化するので `waitFor` を使う。既存 mount テストのパターンに合わせる。）

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Lightbox } from './Lightbox'

function stubMatch(matches: boolean): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

const item = { bookmarkId: 'a', url: 'https://x.test/a', title: 'T', tags: [] } as never

describe('Lightbox mobile branch', () => {
  beforeEach(() => vi.unstubAllGlobals())
  it('desktop renders the 2-column frame, not the mobile stage', async () => {
    stubMatch(false)
    render(<Lightbox item={item} originRect={null} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('lightbox')).toBeTruthy())
    expect(screen.queryByTestId('mobile-lightbox')).toBeNull()
  })
  it('mobile renders the immersive stage', async () => {
    stubMatch(true)
    render(<Lightbox item={item} originRect={null} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('mobile-lightbox')).toBeTruthy())
  })
})
```

- [ ] **Step 4: tsc + 全 vitest** — `rtk tsc` → clean、`rtk vitest run` → 全緑（既存2154 + 新規）。

- [ ] **Step 5: commit** — `rtk git add -A && rtk git commit -m "feat(lightbox/mobile): mount MobileLightbox under isMobile, desktop untouched (s180)"`

---

## Task 6: 種別ごとの main/sheet 最適化（tweet・文字カード・複数画像）

**Files:**
- Modify: `components/board/Lightbox.tsx`（`main`/`sheet` の組み立てを種別分岐に）

- [ ] **Step 1: tweet** — `main` にツイート本文＋メディア（既存 `TweetText`/`TweetColumns` の中身から翻訳トグルを除いた表示）、`sheet` に翻訳トグル＋meta。翻訳フックは既存を Lightbox 側で保持し、トグルを sheet に置く。
- [ ] **Step 2: 複数画像** — `main` に画像＋既存の画像ドット（`lightboxImageDots`、タップ切替）。左右スワイプはカード送りのまま（ドットで画像内切替）。
- [ ] **Step 3: 文字カード** — `shouldRenderLargePlaceholderCard(view)` の時、`main` に大きめテキスト表示、`sheet` は出典/meta のみ。
- [ ] **Step 4: tsc + vitest + `pnpm build`** → 全緑。
- [ ] **Step 5: commit** — `rtk git commit -m "feat(lightbox/mobile): per-type main/sheet for tweet, multi-image, text cards (s180)"`

---

## Task 7: ビルド確認 → デプロイ → ユーザー実機確認

- [ ] **Step 1:** `rtk tsc` clean / `rtk vitest run` 全緑 / `rtk pnpm build` OK。
- [ ] **Step 2:** デプロイ — `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="s180 mobile lightbox"`
- [ ] **Step 3:** ユーザーに `allmarks.app` をスマホでハードリロード → カードタップで開く/左右送り/上で情報/下で閉じる/モーフ、を確認依頼。**フィードバックで閾値・見た目を実機調整**（Playwright非使用の合意）。
- [ ] **Step 4:** docs 更新（TODO_COMPLETED narrative / TODO 現在の状態 / CURRENT_GOAL 次段）＋ commit。

---

## Self-Review 結果（spec 突合）

- **spec 各節 → task 対応**: 操作モデル→T1/T2/T4、レイアウト→T4/T3、開閉モーフ→T5（mediaRef を `.main` に付与＝既存effect流用）、種別→T5/T6、検証→T7（実機＋tsc/vitest）。gap なし。
- **placeholder**: なし（tweet最適化は T6 に明示分離、T5 で最低限表示を先行）。
- **型整合**: `LightboxNav`（currentIndex/total/onNav/onJump）を T5 で共有 export 化し T4 と一致。`SwipeIntent`/`SwipeAxis` は T1 定義を T2/T4 が消費。`resolveIntent` の引数名は T1 と一致。
- **リスク**: モーフのモバイル実挙動は T7 実機で確認（memory `reference_lightbox_morph_gotchas`）。tweet 分割は T6 に隔離して T5 を安全に通す。
