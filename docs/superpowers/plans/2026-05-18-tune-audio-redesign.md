# TUNE 音 motif redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TUNE chrome の chip/数字-as-handle 路線を廃止し、 縦 fader (= マイクゲインスライダー) + ラジオダイヤル目盛の drawer ベース UI に置き換える。 POPOUT / SHARE に idle scramble + hover static crackle ノイズを追加し TopHeader 全体を「音 motif」 で統一する。

**Architecture:** TuneTrigger を「button + drawer」 の wrapper 構造に分解。 button は既存の TopHeader 行内 scramble reveal を保持。 drawer は button 直下に absolute 配置、 hover で max-height transition 展開、 W/G 用の独立 `FaderColumn` component 2 本を縦並びに収納。 POPOUT / SHARE は新規 `ChromeButton` component に置換 (= scramble + crackle 内包)。 既存の drag / Shift / Ctrl+Z / DEFAULT click / sticky open / ESC / i18n は全部継承。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest / playwright / GSAP 不使用 (= CSS keyframes + React state) / 既存 `lib/board/scramble.ts` + `lib/board/constants.ts` 再利用。

---

## File Structure

### 新規 file (= 本 plan で作成)

| パス | 役割 |
|---|---|
| `components/board/FaderColumn.tsx` | 縦 fader 本体 + ラジオダイヤル目盛 + label の独立 component。 W / G で 2 回 mount される |
| `components/board/FaderColumn.module.css` | fader / track / handle / default mark / radio ruler / column label の styles |
| `components/board/FaderColumn.test.tsx` | render / drag / click / Shift / 目盛ハイライト の単体 test |
| `components/board/ChromeButton.tsx` | POPOUT / SHARE 用 chrome ボタンの汎用 component (= scramble + crackle 内包) |
| `components/board/ChromeButton.module.css` | crackle keyframe + chromeButton style (BoardRoot から移動) |
| `components/board/ChromeButton.test.tsx` | scramble timer / hover crackle / onClick の単体 test |

### 修正 file (= 既存改修)

| パス | 修正内容 |
|---|---|
| `components/board/TuneTrigger.tsx` | chip / track / drag を button から削除、 wrap span + drawer DOM 追加、 drawer 内で FaderColumn × 2 を render |
| `components/board/TuneTrigger.module.css` | chip / sliderWrap 削除、 wrap / drawer style 追加 |
| `components/board/TuneTrigger.test.tsx` | 既存 8 test を新 DOM 構造に追従、 drag scrub テストは FaderColumn に移管、 drawer 関連 test 新規追加 |
| `components/board/BoardRoot.tsx` | L1252-1268 の inline `<button>` 2 個 (POPOUT / SHARE) を ChromeButton に置換、 `chromeButton` style の import 経路調整 |
| `components/board/BoardRoot.module.css` | `.chromeButton` style 削除 (= ChromeButton.module.css に移動) |

### 削除候補 (= dead code 整理、 final task で実施)

- `components/board/PopOutButton.tsx` (orphan、 session 41 以降不使用)
- `components/board/PopOutButton.test.tsx`
- `components/board/PopOutButton.module.css`
- `components/board/WidthGapResetButton.tsx` (orphan)
- `components/board/WidthGapResetButton.module.css`
- `components/board/ResetAllButton.tsx` (orphan)
- `components/board/ResetAllButton.test.tsx`
- `components/board/ResetAllButton.module.css`
- `components/board/SizeSlider.tsx` (orphan)
- `components/board/GapSlider.tsx` (orphan)

(= 全部 session 41 で BoardRoot の参照削除済の orphan、 本 plan の polish 中に整理)

---

## Task 1: TuneTrigger を wrap span + drawer slot 構造に refactor

**目的:** button 単独 → button + drawer の 2 要素構造に分解。 hover scope を wrap 全体に広げて drawer hover で開閉が破綻しないようにする。 drawer slot は空のまま (= Task 3 で中身を入れる)。

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.module.css`
- Modify: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 1: 既存 test を read して影響範囲確認**

```bash
cd "c:/Users/masay/Desktop/マイコラージュ"
```

Read `components/board/TuneTrigger.test.tsx` 全体 (≈ 250 行)。 既存 8 tests:
1. renders TUNE label idle
2. mouseenter triggers scramble reveal
3. mouseleave after 1000ms grace returns to idle TUNE label (= session 43 で 1000 に更新済)
4. mouseenter during grace cancels the pending close
5. (drag-scrub) pointerdown + pointermove on W num cell
6-8. (drag, sticky open, reset の variant)

→ 5-8 は chip ベースなので Task 2 で削除/移動する。 Task 1 では 1-4 だけ通る状態を維持。

- [ ] **Step 2: 失敗 test を追加 — wrap span が drawer slot を含む**

`components/board/TuneTrigger.test.tsx` の 1 個目の describe ブロック末尾に追加:

```tsx
  it('renders a wrap span with button and empty drawer slot when collapsed', () => {
    const { getByTestId, container } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    const wrap = container.querySelector('[data-testid="tune-wrap"]')
    expect(wrap).not.toBeNull()
    expect(wrap?.contains(btn)).toBe(true)
    const drawer = wrap?.querySelector('[data-testid="tune-drawer"]')
    expect(drawer).not.toBeNull()
    // Collapsed by default
    expect(drawer?.getAttribute('data-open')).toBe('false')
  })
```

- [ ] **Step 3: test 実行 → 失敗を確認**

```bash
rtk vitest run components/board/TuneTrigger.test.tsx
```

Expected: FAIL with `Unable to find element with testid="tune-wrap"`

- [ ] **Step 4: TuneTrigger.tsx の JSX を wrap + drawer 構造に変更**

`components/board/TuneTrigger.tsx:453-471` の return ブロックを置換:

```tsx
  return (
    <span
      className={styles.wrap}
      data-testid="tune-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={btnRef}
        type="button"
        data-testid="tune-trigger"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        {visibleLabel}
      </button>
      <div
        className={styles.drawer}
        data-testid="tune-drawer"
        data-open={expanded ? 'true' : 'false'}
        aria-hidden={!expanded}
      >
        {/* Task 3 で FaderColumn × 2 を入れる */}
      </div>
    </span>
  )
```

button から `onMouseEnter` / `onMouseLeave` を削除 (= wrap span に移管済)。

- [ ] **Step 4.5: 既存 close-on-mouseleave 系 test の hover 対象を wrap に変更**

button から hover handler を wrap に移管したので、 既存テストが `fireEvent.mouseEnter(btn)` のままだと regression する。 修正:

`components/board/TuneTrigger.test.tsx` の `describe('TuneTrigger — mouseenter', ...)` 内、 および `describe('TuneTrigger — close on mouseleave', ...)` 内のすべての `fireEvent.mouseEnter(btn)` / `fireEvent.mouseLeave(btn)` を以下のように書き換える:

```tsx
const wrap = btn.parentElement!  // または getByTestId('tune-wrap')
fireEvent.mouseEnter(wrap)
// ...
fireEvent.mouseLeave(wrap)
```

各 test 冒頭で `const wrap = btn.parentElement as HTMLElement` を追加し、 以降 wrap に対して mouse event を fire するように統一。

- [ ] **Step 5: CSS で wrap + drawer の基礎 style を追加**

`components/board/TuneTrigger.module.css` 末尾に追加:

```css
/* === Audio redesign: wrap span + drawer === */

.wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.drawer {
  position: absolute;
  top: 100%;
  right: 0;
  background: rgba(10, 10, 10, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0 24px;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
              padding 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  z-index: 50;
  pointer-events: none;
}

.drawer[data-open='true'] {
  max-height: 200px;
  padding: 22px 24px 24px;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .drawer {
    transition: none;
  }
}
```

- [ ] **Step 6: test 実行 → 通過確認**

```bash
rtk vitest run components/board/TuneTrigger.test.tsx
```

Expected: 9/9 pass (= 既存 8 + 新規 1)。 既存 drag scrub テストは chip がまだあるので通る (= Task 2 で chip 削除する)。

- [ ] **Step 7: tsc clean 確認**

```bash
rtk tsc --noEmit
```

Expected: no errors。

- [ ] **Step 8: commit**

```bash
rtk git add components/board/TuneTrigger.tsx components/board/TuneTrigger.module.css components/board/TuneTrigger.test.tsx
rtk git commit -m "refactor(board): TuneTrigger を wrap span + drawer slot 構造に分解 (= 音 redesign 準備)"
```

---

## Task 2: chip / track / drag-scrub を button から削除

**目的:** 「数字=ハンドル」 路線を廃止。 readout は flat な数字 spans のみ (= chip も pill track も無し)。 drag scrub は FaderColumn に移管されるので button からは削除。

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.module.css`
- Modify: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 1: 失敗 test を追加 — readout には chip も sliderWrap も無い**

`components/board/TuneTrigger.test.tsx` の opening 関連 describe ブロックに追加:

```tsx
  it('settled readout has flat number spans, not chip or sliderWrap', async () => {
    const { getByTestId, container } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    fireEvent.mouseEnter(btn.parentElement!)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    // No chip, no sliderWrap
    expect(btn.querySelector('[data-cell-kind^="num-"]')).toBeNull()
    expect(btn.querySelector('[data-scope]')).toBeNull()
    // Number cells exist as plain spans
    expect(btn.textContent).toBe('267.84 · 97.21 · DEFAULT')
  })
```

注: hover は wrap (= `btn.parentElement`) に対して発火させる。

- [ ] **Step 2: 既存 chip 系 test を削除**

`components/board/TuneTrigger.test.tsx` の `describe('TuneTrigger — drag-scrub', ...)` ブロック全体を削除 (= chip 関連 3 tests)。 FaderColumn の test に移管される (= Task 4)。

`describe('TuneTrigger — mouseenter')` の中で「Settled readout text」 assertion を更新:
```tsx
    expect(btn.textContent).toBe('267.84 · 97.21 · DEFAULT')
```
(これは既存と同じ、 変更なし — 念のため確認)。

`describe('TuneTrigger — close on mouseleave')` の 2 tests も hover 対象を wrap に変更。 `fireEvent.mouseEnter(btn)` → `fireEvent.mouseEnter(btn.parentElement!)`、 同じく mouseLeave も。

- [ ] **Step 3: test 実行 → 失敗を確認**

```bash
rtk vitest run components/board/TuneTrigger.test.tsx
```

Expected: 新規 test FAIL (chip がまだ DOM にある)、 既存 hover test PASS (= wrap に hover 移管したので)。

- [ ] **Step 4: emitReadoutHtml を簡略化 — chip / sliderWrap / track 削除**

`components/board/TuneTrigger.tsx:90-148` の `emitReadoutHtml` 関数を以下に置換:

```tsx
function emitReadoutHtml(
  cells: ReadonlyArray<AnimatedCell | Cell>,
  getCh: (cell: AnimatedCell | Cell, idx: number) => string | null,
  widthPx: number,
  gapPx: number,
): { html: string; anyContent: boolean } {
  let html = ''
  let anyContent = false
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const ch = getCh(cell, i)
    if (ch === null) continue
    anyContent = true
    if (cell.scope === 'w' || cell.scope === 'g') {
      html += `<span class="${styles.cell} ${styles.num}">${ch}</span>`
      continue
    }
    // 'reset' cells (= "DEFAULT" 文字列) state ベース grey 判定は維持
    const isStateDefault =
      Math.abs(widthPx - BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX) < 0.005 &&
      Math.abs(gapPx - BOARD_SLIDERS.CARD_GAP_DEFAULT_PX) < 0.005
    const dk = cell.scope === 'reset' ? 'reset' : cell.kind
    const kindClass = cell.scope === 'reset' ? styles.reset : styles[cell.kind]
    const cls =
      cell.scope === 'reset' && isStateDefault
        ? `${styles.cell} ${kindClass} ${styles.resetIdle}`
        : `${styles.cell} ${kindClass}`
    html += `<span class="${cls}" data-cell-kind="${dk}">${ch}</span>`
  }
  return { html, anyContent }
}
```

- [ ] **Step 5: chip 関連の dead code を削除**

`components/board/TuneTrigger.tsx` から以下を削除:
- `TRACK_WIDTH_PX = 100` const (= L27)
- `CHIP_INSET_PX = 18` const (= L28)
- `chipLeftPx` 関数全体 (= L79-83)
- `valueToFraction` 関数全体 (= L63-70) — FaderColumn が同じ実装を持つので削除
- `fractionToValue` 関数全体 (= L73-77) — 同上

- [ ] **Step 6: drag handler を button から削除**

`components/board/TuneTrigger.tsx` の以下を削除:
- `MOUSE_PX_FOR_FULL_RANGE = 30000` const
- `SHIFT_SPEED_MULTIPLIER = 40` const
- `handlePointerDown` callback 全体 (= L365-405)
- `handlePointerMove` callback 全体 (= L407-429)
- `handlePointerUp` callback 全体 (= L431-440)
- `dragScopeRef` (= L175)
- button の onPointerDown / onPointerMove / onPointerUp / onPointerCancel props

`handleClick` から chip 判定を削除:
```tsx
  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
    const target = e.target as HTMLElement
    const kind = target.dataset.cellKind
    if (kind === 'reset') {
      e.preventDefault()
      e.stopPropagation()
      onReset()
      return
    }
    stickyOpenRef.current = !stickyOpenRef.current
    if (!stickyOpenRef.current) startClose()
  }, [onReset, startClose])
```

(chip 判定の `if (target.closest('.${styles.chip}'))` を削除)。

- [ ] **Step 7: CSS から chip / sliderWrap / track の rule 削除**

`components/board/TuneTrigger.module.css` から以下の rule を削除:
- `.sliderWrap { ... }`
- `.track { ... }`
- `.chip { ... }`
- `.chip:hover { ... }`

(L57-102 が該当範囲)。

- [ ] **Step 8: test 実行 → 全通過確認**

```bash
rtk vitest run components/board/TuneTrigger.test.tsx
```

Expected: 6/6 pass (= drag-scrub describe ブロック 3 test 削除済、 wrap + chip 関連 新規 2 test + 既存 4 test = 6 個)。

- [ ] **Step 9: tsc clean 確認**

```bash
rtk tsc --noEmit
```

Expected: no errors。 chipLeftPx / valueToFraction を他から参照してないことを確認。

- [ ] **Step 10: commit**

```bash
rtk git add components/board/TuneTrigger.tsx components/board/TuneTrigger.module.css components/board/TuneTrigger.test.tsx
rtk git commit -m "refactor(board): chip + drag-scrub を TuneTrigger button から削除 (= readout を flat spans に)"
```

---

## Task 3: FaderColumn component を作成 — render + 目盛 + 視覚

**目的:** 縦 fader + ラジオダイヤル目盛 + label の独立 component を新設。 視覚 render と handle 位置計算まで。 drag は次タスクで。

**Files:**
- Create: `components/board/FaderColumn.tsx`
- Create: `components/board/FaderColumn.module.css`
- Create: `components/board/FaderColumn.test.tsx`

- [ ] **Step 1: 失敗 test を追加 — column が handle, ruler, label を render**

新規 file `components/board/FaderColumn.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { FaderColumn } from './FaderColumn'

describe('FaderColumn — render', () => {
  it('renders track, handle, default mark, ruler, and label', () => {
    const { container, getByText } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    expect(container.querySelector('[data-testid="fader-track"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="fader-handle"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="fader-default-mark"]')).not.toBeNull()
    const ruler = container.querySelector('[data-testid="radio-ruler"]')
    expect(ruler).not.toBeNull()
    expect(ruler!.querySelectorAll('[data-tick]').length).toBe(22)
    expect(getByText('W')).toBeTruthy()
  })

  it('handle is at top 50% when value equals default', () => {
    const { container } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    expect(handle.style.top).toBe('50%')
  })

  it('handle is at top 25% when value is halfway above default', () => {
    const { container } = render(
      <FaderColumn
        scope="w"
        value={383.92}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    // value = def + (max - def) * 0.5 → fraction = 0.75 → top = (1 - 0.75) * 100% = 25%
    expect(handle.style.top).toBe('25%')
  })
})
```

- [ ] **Step 2: test 実行 → 失敗を確認**

```bash
rtk vitest run components/board/FaderColumn.test.tsx
```

Expected: FAIL (= FaderColumn not found)。

- [ ] **Step 3: FaderColumn.tsx を新規作成**

新規 file `components/board/FaderColumn.tsx`:

```tsx
'use client'

import { useCallback, useRef, type PointerEvent, type ReactElement } from 'react'
import styles from './FaderColumn.module.css'

/** Default-centered piecewise-linear position mapping: default value → 50%
 *  (track center), min → 0%, max → 100%. Same as legacy TuneTrigger chip
 *  mapping (Amendment 1) but applied to vertical axis. */
function valueToFraction(value: number, min: number, max: number, def: number): number {
  if (value <= def) {
    const below = def - min
    return below > 0 ? ((value - min) / below) * 0.5 : 0
  }
  const above = max - def
  return above > 0 ? 0.5 + ((value - def) / above) * 0.5 : 1
}

function fractionToValue(fraction: number, min: number, max: number, def: number): number {
  const f = Math.max(0, Math.min(1, fraction))
  if (f <= 0.5) return min + (f / 0.5) * (def - min)
  return def + ((f - 0.5) / 0.5) * (max - def)
}

/** 22 tick mark positions (% from top). Every 4th = major.
 *  index 0, 5, 10 (= 50%), 15, 20 → major (= 5 majors total)
 *  index 10 = special (= default center, brightest). */
const TICK_POSITIONS = Array.from({ length: 22 }, (_, i) => (i / 21) * 100)

type Props = {
  readonly scope: 'w' | 'g'
  readonly value: number
  readonly min: number
  readonly max: number
  readonly def: number
  readonly onChange: (next: number) => void
  readonly label: string
}

const MOUSE_PX_FOR_FULL_RANGE = 30000
const SHIFT_SPEED_MULTIPLIER = 40

export function FaderColumn({
  scope,
  value,
  min,
  max,
  def,
  onChange,
  label,
}: Props): ReactElement {
  const valueRef = useRef(value)
  valueRef.current = value
  const draggingRef = useRef(false)

  const fraction = valueToFraction(value, min, max, def)
  // Top % is inverted (high value → top of track → low %)
  const handleTopPct = (1 - fraction) * 100
  // Default mark is always at 50%
  const defaultTopPct = 50

  // Tick highlight: tick is 'hi' if within ±10% of handle fraction
  const isHi = (tickPct: number): boolean => {
    // tickPct is from top → convert to fraction (high val = low %, so fraction = 1 - tickPct/100)
    const tickFraction = 1 - tickPct / 100
    return Math.abs(tickFraction - fraction) <= 0.10
  }

  const isMajor = (i: number): boolean => i % 5 === 0 || i === 21
  const isCenterMajor = (i: number): boolean => i === 10 || i === 11

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    // Click position → fraction (top of column = max, bottom = min)
    if (rect.height > 0) {
      const clickY = e.clientY - rect.top
      const fr = Math.max(0, Math.min(1, 1 - clickY / rect.height))
      onChange(fractionToValue(fr, min, max, def))
    }
    draggingRef.current = true
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(e.pointerId)
    }
  }, [onChange, min, max, def])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    const range = max - min
    const ratio = range / MOUSE_PX_FOR_FULL_RANGE
    const eff = e.shiftKey ? ratio * SHIFT_SPEED_MULTIPLIER : ratio
    // Negative movementY = mouse moves up = value increases
    const delta = -e.movementY * eff
    const next = Math.max(min, Math.min(max, valueRef.current + delta))
    if (next !== valueRef.current) onChange(next)
  }, [onChange, min, max])

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const target = e.currentTarget
    if (
      typeof target.hasPointerCapture === 'function' &&
      target.hasPointerCapture(e.pointerId)
    ) {
      target.releasePointerCapture(e.pointerId)
    }
  }, [])

  return (
    <div className={styles.column} data-scope={scope}>
      <div
        className={styles.unit}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={styles.fader}>
          <div className={styles.track} data-testid="fader-track" />
          <div
            className={styles.defaultMark}
            data-testid="fader-default-mark"
            style={{ top: `${defaultTopPct}%` }}
          />
          <div
            className={styles.handle}
            data-testid="fader-handle"
            style={{ top: `${handleTopPct}%` }}
          />
        </div>
        <div className={styles.ruler} data-testid="radio-ruler">
          {TICK_POSITIONS.map((pct, i) => {
            const classes: string[] = [styles.tick]
            if (isMajor(i)) classes.push(styles.major)
            else classes.push(styles.minor)
            if (isCenterMajor(i)) classes.push(styles.centerMajor)
            if (isHi(pct)) classes.push(styles.hi)
            return (
              <div
                key={i}
                data-tick=""
                data-tick-index={i}
                className={classes.join(' ')}
                style={{ top: `${pct}%` }}
              />
            )
          })}
        </div>
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
```

- [ ] **Step 4: FaderColumn.module.css を新規作成**

新規 file `components/board/FaderColumn.module.css`:

```css
.column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.unit {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  cursor: ns-resize;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.fader {
  position: relative;
  width: 22px;
  height: 110px;
}

.track {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  width: 2px;
  background: linear-gradient(to top, #333 0%, #555 50%, #333 100%);
  border-radius: 1px;
}

.defaultMark {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 1px;
  background: rgba(255, 255, 255, 0.42);
  pointer-events: none;
}

.handle {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 7px;
  background: #ff9d3f;
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(255, 157, 63, 0.6),
              inset 0 1px 0 rgba(255, 255, 255, 0.3);
  /* Grip marks */
  background-image:
    linear-gradient(to bottom,
      transparent 0%,
      transparent 25%,
      rgba(0, 0, 0, 0.35) 25%,
      rgba(0, 0, 0, 0.35) calc(25% + 1px),
      transparent calc(25% + 1px),
      transparent 75%,
      rgba(0, 0, 0, 0.35) 75%,
      rgba(0, 0, 0, 0.35) calc(75% + 1px),
      transparent calc(75% + 1px),
      transparent 100%);
  pointer-events: none;
}

.ruler {
  position: relative;
  width: 18px;
  height: 110px;
}

.tick {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  height: 1px;
  transition: background 0.15s, box-shadow 0.15s;
}

.tick.minor { width: 6px; background: #444; }
.tick.major { width: 12px; background: #777; }
.tick.centerMajor { width: 14px; background: #aaa; }
.tick.hi {
  background: #ff9d3f !important;
  box-shadow: 0 0 4px rgba(255, 157, 63, 0.6);
}

.label {
  color: rgba(255, 255, 255, 0.55);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
```

- [ ] **Step 5: test 実行 → 通過確認**

```bash
rtk vitest run components/board/FaderColumn.test.tsx
```

Expected: 3/3 pass。

- [ ] **Step 6: tsc clean 確認**

```bash
rtk tsc --noEmit
```

Expected: no errors。

- [ ] **Step 7: commit**

```bash
rtk git add components/board/FaderColumn.tsx components/board/FaderColumn.module.css components/board/FaderColumn.test.tsx
rtk git commit -m "feat(board): FaderColumn component 新設 (= 縦 fader + ラジオダイヤル目盛)"
```

---

## Task 4: FaderColumn の drag + click + Shift + 目盛ハイライト test

**目的:** Task 3 で実装した drag / click / Shift / hi class ロジックの test を追加。 既に Task 3 で実装は終わってるので test 追加のみ。

**Files:**
- Modify: `components/board/FaderColumn.test.tsx`

- [ ] **Step 1: 失敗 test 群を追加 — drag / click / Shift / highlight**

`components/board/FaderColumn.test.tsx` 末尾に追加:

```tsx
describe('FaderColumn — drag', () => {
  it('pointerdown then pointermove invokes onChange with vertical delta', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={onChange}
        label="W"
      />,
    )
    const unit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    // Mock getBoundingClientRect for column
    vi.spyOn(unit, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 110, left: 0, right: 40, width: 40, height: 110,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    // pointermove with movementY = -10 (mouse up by 10px)
    fireEvent.pointerMove(unit, { clientX: 20, clientY: 45, movementY: -10, pointerId: 1 })
    // onChange called at least twice (click jump + drag move)
    expect(onChange).toHaveBeenCalled()
    // Drag movement increased value (mouse moved up)
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    expect(lastCall[0]).toBeGreaterThan(267.84)
  })

  it('Shift+pointermove applies SHIFT_SPEED_MULTIPLIER factor', () => {
    const onChangeNoShift = vi.fn()
    const onChangeShift = vi.fn()
    const { container: c1 } = render(
      <FaderColumn scope="w" value={300} min={100} max={500} def={267.84}
        onChange={onChangeNoShift} label="W" />,
    )
    const { container: c2 } = render(
      <FaderColumn scope="w" value={300} min={100} max={500} def={267.84}
        onChange={onChangeShift} label="W" />,
    )
    const u1 = c1.querySelector('[data-scope="w"] > div') as HTMLElement
    const u2 = c2.querySelector('[data-scope="w"] > div') as HTMLElement
    vi.spyOn(u1, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 110, left: 0, right: 40, width: 40, height: 110,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    vi.spyOn(u2, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 110, left: 0, right: 40, width: 40, height: 110,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(u1, { clientX: 20, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(u1, { movementY: -50, shiftKey: false, pointerId: 1 })
    fireEvent.pointerDown(u2, { clientX: 20, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(u2, { movementY: -50, shiftKey: true, pointerId: 1 })
    const noShiftDelta = onChangeNoShift.mock.calls[onChangeNoShift.mock.calls.length - 1][0] - 300
    const shiftDelta = onChangeShift.mock.calls[onChangeShift.mock.calls.length - 1][0] - 300
    // Shift should be roughly 40× faster
    expect(Math.abs(shiftDelta / noShiftDelta - 40)).toBeLessThan(0.5)
  })

  it('pointerdown at top of column jumps to max value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="g" value={97.21} min={20} max={200} def={97.21}
        onChange={onChange} label="G" />,
    )
    const unit = container.querySelector('[data-scope="g"] > div') as HTMLElement
    vi.spyOn(unit, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 110, left: 0, right: 40, width: 40, height: 110,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 0, pointerId: 1 })
    // clientY = 0 = top = fraction 1 = max
    expect(onChange).toHaveBeenCalledWith(200)
  })
})

describe('FaderColumn — ruler tick highlight', () => {
  it('ticks within ±10% of handle have hi class', () => {
    const { container } = render(
      <FaderColumn scope="w" value={267.84} min={100} max={500} def={267.84}
        onChange={vi.fn()} label="W" />,
    )
    // value = def → handle at fraction 0.5 → ticks within fraction 0.4-0.6 get hi
    // tickPct from top: fraction = 1 - pct/100. fraction 0.4 → pct 60, fraction 0.6 → pct 40
    // So ticks at pct in [40, 60] get hi.
    const ticks = container.querySelectorAll('[data-tick]')
    const hiTicks = Array.from(ticks).filter((t) =>
      (t as HTMLElement).className.includes('hi'),
    )
    expect(hiTicks.length).toBeGreaterThan(0)
    expect(hiTicks.length).toBeLessThanOrEqual(7)
  })
})
```

- [ ] **Step 2: test 実行 → 全通過確認**

```bash
rtk vitest run components/board/FaderColumn.test.tsx
```

Expected: 7/7 pass (= Task 3 の 3 + 本タスクの 4)。

- [ ] **Step 3: tsc clean 確認**

```bash
rtk tsc --noEmit
```

Expected: no errors。

- [ ] **Step 4: commit**

```bash
rtk git add components/board/FaderColumn.test.tsx
rtk git commit -m "test(board): FaderColumn の drag / click / Shift / tick highlight を test"
```

---

## Task 5: TuneTrigger drawer に FaderColumn × 2 を mount

**目的:** Task 1 で作った drawer slot の中に W / G の FaderColumn を 2 本入れる。 onChange を TuneTrigger の onChangeWidth / onChangeGap に forward。 drawer hover で grace close が cancel される動作を保証。

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 1: 失敗 test を追加 — drawer に 2 つの FaderColumn**

`components/board/TuneTrigger.test.tsx` の `describe('TuneTrigger — close on mouseleave', ...)` の後に追加:

```tsx
describe('TuneTrigger — drawer with FaderColumns', () => {
  it('drawer contains W and G FaderColumns when expanded', async () => {
    const { container, getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const wrap = getByTestId('tune-wrap')
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    const drawer = getByTestId('tune-drawer')
    expect(drawer.getAttribute('data-open')).toBe('true')
    expect(drawer.querySelector('[data-scope="w"]')).not.toBeNull()
    expect(drawer.querySelector('[data-scope="g"]')).not.toBeNull()
  })

  it('drag on W FaderColumn calls onChangeWidth', async () => {
    const onChangeWidth = vi.fn()
    const { container, getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={onChangeWidth}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.mouseEnter(getByTestId('tune-wrap'))
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    const wUnit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    vi.spyOn(wUnit, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 110, left: 0, right: 40, width: 40, height: 110,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(wUnit, { clientX: 20, clientY: 0, pointerId: 1 })
    expect(onChangeWidth).toHaveBeenCalled()
  })

  it('mouseenter on drawer cancels pending leave-grace close', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const wrap = getByTestId('tune-wrap')
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.mouseLeave(wrap)
    // Within grace, re-enter (= via drawer hover)
    await new Promise<void>((resolve) => setTimeout(resolve, 200))
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 200))
    expect(getByTestId('tune-drawer').getAttribute('data-open')).toBe('true')
  })
})
```

- [ ] **Step 2: test 実行 → 失敗を確認**

```bash
rtk vitest run components/board/TuneTrigger.test.tsx
```

Expected: 新規 3 tests FAIL (= FaderColumn が drawer に居ない)。

- [ ] **Step 3: TuneTrigger.tsx で FaderColumn を import + drawer 内に mount**

`components/board/TuneTrigger.tsx` の import セクション (= L1-7) に追加:

```tsx
import { FaderColumn } from './FaderColumn'
```

return 内の drawer (= Task 1 で追加した空 slot) を以下に置換:

```tsx
      <div
        className={styles.drawer}
        data-testid="tune-drawer"
        data-open={expanded ? 'true' : 'false'}
        aria-hidden={!expanded}
      >
        <div className={styles.faderGroup}>
          <FaderColumn
            scope="w"
            value={widthPx}
            min={BOARD_SLIDERS.CARD_WIDTH_MIN_PX}
            max={BOARD_SLIDERS.CARD_WIDTH_MAX_PX}
            def={BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX}
            onChange={onChangeWidth}
            label="W"
          />
          <FaderColumn
            scope="g"
            value={gapPx}
            min={BOARD_SLIDERS.CARD_GAP_MIN_PX}
            max={BOARD_SLIDERS.CARD_GAP_MAX_PX}
            def={BOARD_SLIDERS.CARD_GAP_DEFAULT_PX}
            onChange={onChangeGap}
            label="G"
          />
        </div>
      </div>
```

- [ ] **Step 4: CSS で faderGroup を追加**

`components/board/TuneTrigger.module.css` 末尾に追加:

```css
.faderGroup {
  display: flex;
  gap: 28px;
  align-items: flex-end;
}
```

- [ ] **Step 5: test 実行 → 全通過確認**

```bash
rtk vitest run components/board/TuneTrigger.test.tsx
```

Expected: 9/9 pass (= 既存 6 + 新規 3)。

- [ ] **Step 6: tsc clean 確認**

```bash
rtk tsc --noEmit
```

Expected: no errors。

- [ ] **Step 7: commit**

```bash
rtk git add components/board/TuneTrigger.tsx components/board/TuneTrigger.module.css components/board/TuneTrigger.test.tsx
rtk git commit -m "feat(board): TuneTrigger drawer に W/G FaderColumn 2 本を mount"
```

---

## Task 6: ChromeButton component を作成 — scramble + crackle 内包

**目的:** POPOUT / SHARE / SHARE 等の汎用 chrome ボタン。 内部で idle scramble timer + hover crackle keyframe を持つ。 既存の `.chromeButton` style を吸収。

**Files:**
- Create: `components/board/ChromeButton.tsx`
- Create: `components/board/ChromeButton.module.css`
- Create: `components/board/ChromeButton.test.tsx`

- [ ] **Step 1: 失敗 test を追加 — render + onClick + scramble + a11y**

新規 file `components/board/ChromeButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ChromeButton } from './ChromeButton'

describe('ChromeButton — basic', () => {
  it('renders label and forwards onClick', () => {
    const onClick = vi.fn()
    const { getByText, getByTestId } = render(
      <ChromeButton label="POP OUT" onClick={onClick} data-testid="popout-btn" />,
    )
    expect(getByText('POP OUT')).toBeTruthy()
    fireEvent.click(getByTestId('popout-btn'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('respects disabled prop', () => {
    const onClick = vi.fn()
    const { getByTestId } = render(
      <ChromeButton label="POP OUT" onClick={onClick} disabled data-testid="popout-btn" />,
    )
    const btn = getByTestId('popout-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ChromeButton — idle scramble', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('label still rendered after random scramble timer fires', () => {
    const { getByTestId } = render(
      <ChromeButton label="POP OUT" onClick={vi.fn()} data-testid="popout-btn" />,
    )
    // Advance 20 seconds — covers the random 10-20s window
    vi.advanceTimersByTime(20000)
    const btn = getByTestId('popout-btn')
    // After scramble animation completes, label is back
    vi.advanceTimersByTime(500)
    expect(btn.textContent).toBe('POP OUT')
  })
})
```

- [ ] **Step 2: test 実行 → 失敗を確認**

```bash
rtk vitest run components/board/ChromeButton.test.tsx
```

Expected: FAIL (= ChromeButton not found)。

- [ ] **Step 3: ChromeButton.tsx を新規作成**

新規 file `components/board/ChromeButton.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { pickRandomChar } from '@/lib/board/scramble'
import styles from './ChromeButton.module.css'

const SCRAMBLE_INTERVAL_MIN_MS = 10000
const SCRAMBLE_INTERVAL_MAX_MS = 20000
const SCRAMBLE_DURATION_MIN_MS = 125
const SCRAMBLE_DURATION_MAX_MS = 190
const STAGGER_MS = 11

type Props = {
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly className?: string
  readonly 'data-testid'?: string
}

export function ChromeButton({
  label,
  onClick,
  disabled,
  className,
  'data-testid': dataTestId,
}: Props): ReactElement {
  const [displayText, setDisplayText] = useState(label)
  const labelRef = useRef(label)
  labelRef.current = label
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  const scheduleScramble = useCallback((): void => {
    const delay =
      SCRAMBLE_INTERVAL_MIN_MS +
      Math.random() * (SCRAMBLE_INTERVAL_MAX_MS - SCRAMBLE_INTERVAL_MIN_MS)
    timerRef.current = setTimeout(() => {
      runScramble()
    }, delay)
  }, [])

  const runScramble = useCallback((): void => {
    const target = labelRef.current
    const chars = [...target]
    const settleAt = chars.map((_, i) =>
      i * STAGGER_MS +
      SCRAMBLE_DURATION_MIN_MS +
      Math.random() * (SCRAMBLE_DURATION_MAX_MS - SCRAMBLE_DURATION_MIN_MS),
    )
    const start = performance.now()
    const tick = (): void => {
      const elapsed = performance.now() - start
      let allSettled = true
      const out = chars.map((c, i) => {
        if (elapsed < settleAt[i]) {
          allSettled = false
          // Preserve whitespace
          return c === ' ' ? ' ' : pickRandomChar()
        }
        return c
      })
      setDisplayText(out.join(''))
      if (!allSettled) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
        setDisplayText(target)
        scheduleScramble()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [scheduleScramble])

  useEffect(() => {
    // Skip scramble entirely under reduced-motion preference.
    const mql = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    if (mql?.matches) return
    scheduleScramble()
    return (): void => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [scheduleScramble])

  // Keep label in sync if it changes (= i18n switch等)
  useEffect(() => {
    setDisplayText(label)
  }, [label])

  const cls = className ? `${styles.btn} ${className}` : styles.btn

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
    >
      {displayText}
    </button>
  )
}
```

- [ ] **Step 4: ChromeButton.module.css を新規作成**

新規 file `components/board/ChromeButton.module.css`:

```css
.btn {
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  -webkit-text-stroke: 0.5px rgba(0, 0, 0, 0.45);
  paint-order: stroke fill;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, transform 0.15s;
  position: relative;
}

.btn:hover {
  color: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
  animation: crackle 100ms steps(4, end);
}

@keyframes crackle {
  0%   { transform: translate(0, -1px); filter: none; text-shadow: none; }
  25%  { transform: translate(-0.7px, -1px); filter: blur(0.4px);
         text-shadow: 1px 0 rgba(255, 255, 255, 0.4); }
  50%  { transform: translate(0.8px, -1.2px); filter: none;
         text-shadow: -1px 0 rgba(255, 255, 255, 0.3); }
  75%  { transform: translate(-0.4px, -1px); filter: blur(0.3px); text-shadow: none; }
  100% { transform: translate(0, -1px); filter: none; text-shadow: none; }
}

.btn:disabled {
  color: rgba(255, 255, 255, 0.30);
  cursor: not-allowed;
  transform: none;
}

.btn:disabled:hover {
  animation: none;
  transform: none;
}

.btn:focus-visible {
  outline: 1px dashed rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .btn,
  .btn:hover {
    animation: none;
    transition: color 0.15s;
    transform: none;
  }
}
```

- [ ] **Step 5: test 実行 → 通過確認**

```bash
rtk vitest run components/board/ChromeButton.test.tsx
```

Expected: 3/3 pass。

- [ ] **Step 6: tsc clean 確認**

```bash
rtk tsc --noEmit
```

Expected: no errors。

- [ ] **Step 7: commit**

```bash
rtk git add components/board/ChromeButton.tsx components/board/ChromeButton.module.css components/board/ChromeButton.test.tsx
rtk git commit -m "feat(board): ChromeButton 新設 (= scramble + crackle 内包の chrome ボタン)"
```

---

## Task 7: BoardRoot の POPOUT / SHARE inline button を ChromeButton に置換

**目的:** `components/board/BoardRoot.tsx:1252-1268` の inline `<button>` 2 個を `ChromeButton` に差し替える。 `chromeButton` style を BoardRoot.module.css から削除 (= ChromeButton.module.css に吸収済)。

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/BoardRoot.module.css`

- [ ] **Step 1: BoardRoot.tsx で ChromeButton を import**

`components/board/BoardRoot.tsx` の import セクションに追加:

```tsx
import { ChromeButton } from './ChromeButton'
```

- [ ] **Step 2: POPOUT / SHARE の inline button を ChromeButton に置換**

`components/board/BoardRoot.tsx:1252-1268` を以下に置換:

```tsx
              <ChromeButton
                label={t('board.chrome.popout')}
                onClick={() => { void pip.open() }}
                disabled={!pip.isSupported}
                data-testid="pop-out-button"
              />
              <ChromeButton
                label={t('board.chrome.share')}
                onClick={(): void => setShareComposerOpen(true)}
                data-testid="share-pill"
              />
```

- [ ] **Step 3: BoardRoot.module.css から chromeButton rule を削除**

`components/board/BoardRoot.module.css:82-110` の `.chromeButton`, `.chromeButton:hover`, `.chromeButton:disabled`, `.chromeButton:focus-visible` の rule をすべて削除。

- [ ] **Step 4: vitest 全体実行 → 既存 test に regression が無いか確認**

```bash
rtk vitest run
```

Expected: 全 test pass。 万一 BoardRoot 周辺の test で `.chromeButton` class 名を assert してるものがあれば修正。

- [ ] **Step 5: tsc clean 確認**

```bash
rtk tsc --noEmit
```

Expected: no errors。

- [ ] **Step 6: commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/BoardRoot.module.css
rtk git commit -m "refactor(board): POPOUT / SHARE を ChromeButton に置換 (= 音 motif polish 適用)"
```

---

## Task 8: dead code 整理 (= 旧 component file の削除)

**目的:** session 41 で orphan 化したまま残置の component file を物理削除。 本 redesign で参照源がさらに無くなったタイミングで一気にクリーンアップ。

**Files:**
- Delete: `components/board/PopOutButton.tsx`
- Delete: `components/board/PopOutButton.test.tsx`
- Delete: `components/board/PopOutButton.module.css`
- Delete: `components/board/WidthGapResetButton.tsx`
- Delete: `components/board/WidthGapResetButton.module.css`
- Delete: `components/board/ResetAllButton.tsx`
- Delete: `components/board/ResetAllButton.test.tsx`
- Delete: `components/board/ResetAllButton.module.css`
- Delete: `components/board/SizeSlider.tsx`
- Delete: `components/board/GapSlider.tsx`

- [ ] **Step 1: 各 file が本当に未参照かを grep で確認**

```bash
rtk grep -l "PopOutButton" components/ app/ lib/
rtk grep -l "WidthGapResetButton" components/ app/ lib/
rtk grep -l "ResetAllButton" components/ app/ lib/
rtk grep -l "SizeSlider" components/ app/ lib/
rtk grep -l "GapSlider" components/ app/ lib/
```

Expected: 各検索が「該当 file 自身のみ」 を返す (= 外部参照ゼロ)。 外部参照が見つかったらそのコンポーネントは削除対象から外す。

- [ ] **Step 2: 確認できた file を削除**

```bash
rm components/board/PopOutButton.tsx
rm components/board/PopOutButton.test.tsx
rm components/board/PopOutButton.module.css
rm components/board/WidthGapResetButton.tsx
rm components/board/WidthGapResetButton.module.css
rm components/board/ResetAllButton.tsx
rm components/board/ResetAllButton.test.tsx
rm components/board/ResetAllButton.module.css
rm components/board/SizeSlider.tsx
rm components/board/GapSlider.tsx
```

(Step 1 で外部参照が見つかったコンポーネントはこの list から除外)。

- [ ] **Step 3: vitest 全体 → tsc clean 確認**

```bash
rtk vitest run
rtk tsc --noEmit
```

Expected: 全 test pass、 tsc no errors。

- [ ] **Step 4: commit**

```bash
rtk git add -u components/board/
rtk git commit -m "chore(board): session 41 から orphan の component file を物理削除"
```

---

## Task 9: 全体 vitest + tsc + pnpm build で最終検証

**目的:** 全 task 終了後の最終チェック。 Cloudflare static export が壊れていないこと、 vitest 全 test pass、 tsc clean を保証。 deploy はこのタスクでは行わない (= user 主導)。

**Files:** なし (= 検証のみ)

- [ ] **Step 1: vitest 全件実行**

```bash
rtk vitest run
```

Expected: 全 test pass。 失敗があれば原因究明して個別 fix。

- [ ] **Step 2: tsc 全体型チェック**

```bash
rtk tsc --noEmit
```

Expected: no errors。

- [ ] **Step 3: pnpm build (= 重要、 next build じゃない)**

```bash
pnpm build
```

Expected: success、 `out/` directory が生成される。 `rtk next build` ではなく **必ず `pnpm build`** を使う (= static export 設定が違う、 memory `reference_pnpm_build_required.md`)。

- [ ] **Step 4: out/board.html を簡易確認**

```bash
ls out/board.html
```

存在を確認。

- [ ] **Step 5: 最終 commit (= 検証通過の証跡として)**

検証のみで code 変更が無ければ commit 不要。 deploy は user の判断で次に進める。

```bash
rtk git status
```

Expected: working tree clean (= 全 task の commit が済んでる状態)。

---

## 完了基準 (= acceptance criteria)

すべての task 完了後、 以下を満たす:

- [ ] vitest 全件 pass
- [ ] tsc no errors
- [ ] pnpm build 成功 (= `out/` 生成)
- [ ] TUNE hover で TopHeader 下に drawer が「すっ」 とスライド展開 (= 500ms cubic-bezier)
- [ ] drawer 内に W / G の縦 fader + ラジオダイヤル目盛が表示
- [ ] fader handle drag で値変化、 readout (= TopHeader 行内) が同期更新
- [ ] track / ラジオダイヤル click でジャンプ
- [ ] Shift+drag で 40 倍速
- [ ] mouseleave 1000ms grace 後に drawer 閉 + readout collapse 同期
- [ ] DEFAULT 文字 click で W/G default 戻し (= 既存挙動)
- [ ] Ctrl+Z で undo (= 既存 undo system 連携)
- [ ] POPOUT / SHARE が時々 scramble 発火 (= idle、 10-20 秒 random)
- [ ] POPOUT / SHARE hover で crackle 100ms (= 「じじっ」 ノイズ)
- [ ] prefers-reduced-motion: scramble / crackle 停止、 drawer 開閉も即時
- [ ] 既存 i18n key 全部生きてる (= board.chrome.tune / popout / share / board.tune.*)
- [ ] FILTER pill は無変更 (= 別 sprint)
- [ ] mobile (≤640px) は対応外 (= 別 sprint、 B-#10 mobile UX)

---

## 既知の trade-off / 後続課題

- **drawer の z-index**: 50 で TopHeader 上に被るが、 Lightbox (= z 1000+) や PiP 上には乗らない設計。 必要なら最終調整。
- **drawer の幅**: faderGroup の auto-sizing に任せる。 W/G 2 列で 約 100px。 TopHeader 右端 (= `right: 0`) アンカーなので右に寄って表示される。 大画面で違和感あれば左アンカー / 中央寄せの調整余地。
- **scramble timer accuracy**: vitest の fake timer + requestAnimationFrame の組み合わせは安定しないことがある。 timer test が flaky なら polling 検証に切り替える余地あり。
- **playwright 統合 test**: 本 plan では vitest 単体 test のみ。 playwright での integration verify は user による視認 (= `https://booklage.pages.dev` ハードリロード) で代替する想定。 必要なら別 sprint で追加。

---

## 参考

- spec: [docs/superpowers/specs/2026-05-18-tune-audio-redesign-design.md](../specs/2026-05-18-tune-audio-redesign-design.md)
- 視覚 mockup: `.superpowers/brainstorm/1868-1779074573/content/final-shape.html`
- 既存 TUNE chrome spec: [docs/superpowers/specs/2026-05-18-topheader-tune-trigger-design.md](../specs/2026-05-18-topheader-tune-trigger-design.md)
- 既存 sliders spec (= PrecisionSlider): [docs/superpowers/specs/2026-05-16-precision-slider-design.md](../specs/2026-05-16-precision-slider-design.md)
