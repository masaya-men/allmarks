# TopHeader TUNE Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6 elements in TopHeader's right cluster (PopOutButton / SizeSlider / GapSlider / WidthGapResetButton / ResetAllButton / Share) with 3 text-only labels (`TUNE` / `POP OUT` / `SHARE`), where `TUNE` hover-reveals a W/G readout via Matrix-style scramble animation.

**Architecture:** New `TuneTrigger` component encapsulates trigger label + scramble state machine + drag-scrub on number cells + sticky open behavior. Uses inline drag math (pointer capture + `movementX × ratio`) modeled on PrecisionSlider, without extracting a shared hook (= keeps blast radius small, YAGNI). Per-frame text updates via direct `innerHTML` writes in rAF loop (= same pattern as ScrollMeter). i18n keys added across all 15 language files. Old components stay in repo as orphans (= file kept, not imported) so future revival doesn't need digging through history.

**Tech Stack:** React 19 + TypeScript strict / Vitest + @testing-library/react / Vanilla CSS modules / 既存 `lib/i18n/t.ts` / 既存 `lib/board/undo-stack.ts` / 既存 `BOARD_SLIDERS` constants

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `lib/board/scramble.ts` | Exports `SCRAMBLE_CHARS` constant + `pickRandomChar()` helper. Pure utility, no React. |
| `lib/board/scramble.test.ts` | Vitest tests for scramble utility |
| `components/board/TuneTrigger.tsx` | Main component: idle TUNE label, hover-scramble animation, drag-scrub on number cells, sticky open, ↺ reset |
| `components/board/TuneTrigger.module.css` | Styles: per-cell color kinds (label / num / dim), padding to match POP OUT (8px 12px), no background/border |
| `components/board/TuneTrigger.test.tsx` | Vitest tests covering state machine, drag-scrub, sticky open, a11y |

### Modified files

| Path | Change |
|---|---|
| `components/board/BoardRoot.tsx` | Lines ~1247-1283: replace `<PopOutButton>` / `<SizeSlider>` / `<GapSlider>` / `<WidthGapResetButton>` / `<ResetAllButton>` / `<button>Share ↗` with `<TuneTrigger>` / `<button>POP OUT` / `<button>SHARE`. Remove 5 imports (lines ~33-38). |
| `messages/ja.json` | Add `board.chrome.{tune,popout,share}` + `board.tune.{width,gap,reset_tooltip}` keys |
| `messages/en.json` | Same |
| `messages/{de,fr,es,it,pt,nl,ko,zh,ru,tr,vi,th,ar}.json` | Same (English verbatim values; polish per-language deferred) |

### Untouched (= files kept as orphans after losing their DOM usage)

- `components/board/PopOutButton.tsx` + `.test.tsx`
- `components/board/SizeSlider.tsx`
- `components/board/GapSlider.tsx`
- `components/board/WidthGapResetButton.tsx`
- `components/board/ResetAllButton.tsx` + `.test.tsx`

### Out of scope (= explicitly NOT in this plan)

- Mobile (≤640px) tap-open UI: deferred to B-#10 mobile sprint
- Theme vocab map (TUNE → CALIBRATE etc.): deferred to theme system
- PopOut onboarding (= first-time tutorial): backlog
- Extracting PrecisionSlider drag logic into a shared `useDragScrub` hook: deferred (TuneTrigger inlines drag math instead; can extract later if a 3rd consumer appears)

---

## Task 1: Scramble utility module

**Files:**
- Create: `lib/board/scramble.ts`
- Create: `lib/board/scramble.test.ts`

- [ ] **Step 1.1: Write failing test**

File: `lib/board/scramble.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { SCRAMBLE_CHARS, pickRandomChar } from './scramble'

describe('scramble utility', () => {
  it('SCRAMBLE_CHARS contains uppercase letters, digits, and visual symbols', () => {
    expect(SCRAMBLE_CHARS).toMatch(/A/)
    expect(SCRAMBLE_CHARS).toMatch(/Z/)
    expect(SCRAMBLE_CHARS).toMatch(/0/)
    expect(SCRAMBLE_CHARS).toMatch(/9/)
    expect(SCRAMBLE_CHARS).toMatch(/·/)
    expect(SCRAMBLE_CHARS).toMatch(/#/)
  })

  it('pickRandomChar returns a single character from SCRAMBLE_CHARS', () => {
    for (let i = 0; i < 50; i++) {
      const ch = pickRandomChar()
      expect(ch.length).toBe(1)
      expect(SCRAMBLE_CHARS).toContain(ch)
    }
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run lib/board/scramble.test.ts`
Expected: FAIL with "Cannot find module './scramble'" or similar import error.

- [ ] **Step 1.3: Implement minimal scramble.ts**

File: `lib/board/scramble.ts`

```typescript
/**
 * Character set used by TuneTrigger (and any future Matrix-style scramble
 * surface) to flicker each cell through random glyphs before settling to a
 * target character. Mix of uppercase ASCII, digits, and a few visual symbols
 * — kept to monospace-friendly chars so cell widths don't jitter mid-scramble.
 */
export const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·#@$%&*?/\\|<>=+-'

/** Returns one random character from SCRAMBLE_CHARS. */
export function pickRandomChar(): string {
  const i = Math.floor(Math.random() * SCRAMBLE_CHARS.length)
  return SCRAMBLE_CHARS[i] ?? '?'
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run lib/board/scramble.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 1.5: Commit**

```bash
git add lib/board/scramble.ts lib/board/scramble.test.ts
git commit -m "feat(board): add scramble utility for TUNE trigger animation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: TuneTrigger skeleton — idle TUNE label

**Files:**
- Create: `components/board/TuneTrigger.tsx`
- Create: `components/board/TuneTrigger.module.css`
- Create: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 2.1: Write failing test**

File: `components/board/TuneTrigger.test.tsx`

```typescript
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TuneTrigger } from './TuneTrigger'

describe('TuneTrigger — skeleton', () => {
  it('renders TUNE as a button with proper data-testid in idle state', () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.textContent).toBe('TUNE')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: FAIL with "Cannot find module './TuneTrigger'".

- [ ] **Step 2.3: Create TuneTrigger.module.css with minimal styles**

File: `components/board/TuneTrigger.module.css`

```css
/* TuneTrigger — Apple v3 chrome label, identical typographic profile to
   POP OUT / SHARE / FilterPill: 11px monospace ALL CAPS, no background,
   thin black stroke for legibility over canvas content. The cell-based
   readout (W 267.84 · G 97.21 · ↺) shares the same font cascade and
   only differs via per-kind color (label / num / dim). */

.trigger {
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
}
.trigger:hover {
  color: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}
.trigger:focus-visible {
  outline: 1px dashed rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

.cell {
  display: inline-block;
  font-variant-numeric: tabular-nums;
  vertical-align: top;
}
.cell.num { color: rgba(255, 200, 120, 0.95); }
.cell.dim { color: rgba(255, 255, 255, 0.30); }
.cell.reset {
  cursor: pointer;
  padding: 0 4px;
  margin-left: 2px;
}
.cell.num {
  cursor: ew-resize;
}
```

- [ ] **Step 2.4: Write minimal TuneTrigger.tsx**

File: `components/board/TuneTrigger.tsx`

```typescript
'use client'

import { type ReactElement } from 'react'
import { t } from '@/lib/i18n/t'
import styles from './TuneTrigger.module.css'

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onChangeWidth: (next: number) => void
  readonly onChangeGap: (next: number) => void
  readonly onReset: () => void
  /** Visible label in idle state. Default 'TUNE'; future theme vocab map
   *  may override via this prop (e.g., 'CALIBRATE' for an SF military
   *  theme). */
  readonly label?: string
}

export function TuneTrigger({
  widthPx: _widthPx,
  gapPx: _gapPx,
  onChangeWidth: _onChangeWidth,
  onChangeGap: _onChangeGap,
  onReset: _onReset,
  label,
}: Props): ReactElement {
  const visibleLabel = label ?? t('board.chrome.tune')
  return (
    <button
      type="button"
      data-testid="tune-trigger"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-expanded={false}
    >
      {visibleLabel}
    </button>
  )
}
```

(Note: i18n key `board.chrome.tune` is added in Task 8; until then `t()` returns the key string itself, which equals 'board.chrome.tune'. The skeleton test pins the textContent to 'TUNE', so the test will fail until Task 8 lands. To unblock Task 2 commit independently, hardcode `'TUNE'` in this step and switch to `t()` in Task 8.)

Revised TuneTrigger.tsx for Step 2.4 (use literal 'TUNE'):

```typescript
'use client'

import { type ReactElement } from 'react'
import styles from './TuneTrigger.module.css'

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onChangeWidth: (next: number) => void
  readonly onChangeGap: (next: number) => void
  readonly onReset: () => void
  readonly label?: string
}

export function TuneTrigger({
  widthPx: _widthPx,
  gapPx: _gapPx,
  onChangeWidth: _onChangeWidth,
  onChangeGap: _onChangeGap,
  onReset: _onReset,
  label,
}: Props): ReactElement {
  const visibleLabel = label ?? 'TUNE'
  return (
    <button
      type="button"
      data-testid="tune-trigger"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-expanded={false}
    >
      {visibleLabel}
    </button>
  )
}
```

- [ ] **Step 2.5: Run test to verify it passes**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 2.6: Commit**

```bash
git add components/board/TuneTrigger.tsx components/board/TuneTrigger.module.css components/board/TuneTrigger.test.tsx
git commit -m "feat(board): TuneTrigger skeleton — idle TUNE label

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Hover-open scramble animation (v4-inplace)

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 3.1: Write failing test**

Append to `components/board/TuneTrigger.test.tsx`:

```typescript
import { fireEvent, render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// (existing import of TuneTrigger remains)

describe('TuneTrigger — hover open', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('on mouseenter, expands aria-expanded=true and renders the W/G readout', () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')

    fireEvent.mouseEnter(btn)
    // Advance enough time for all cells to settle (≈ 21*11ms + 190ms = 421ms)
    vi.advanceTimersByTime(500)

    expect(btn.getAttribute('aria-expanded')).toBe('true')
    // Settled readout text (whitespace-collapsed cells together)
    expect(btn.textContent).toBe('W 267.84 · G 97.21 · ↺')
  })
})
```

- [ ] **Step 3.2: Run failing**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: FAIL — aria-expanded stays 'false', textContent stays 'TUNE'.

- [ ] **Step 3.3: Implement open animation + state machine**

Replace `components/board/TuneTrigger.tsx` contents:

```typescript
'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { SCRAMBLE_CHARS, pickRandomChar } from '@/lib/board/scramble'
import styles from './TuneTrigger.module.css'

/** v4-inplace timing (= spec §2-3). */
const STAGGER_MS = 11
const SCRAMBLE_MIN_MS = 125
const SCRAMBLE_MAX_MS = 190
/** Mouse leave grace: don't close immediately so cursor can move onto the
 *  readout cells without losing the open state. */
const LEAVE_GRACE_MS = 180

type CellKind = 'label' | 'num' | 'dim'
type Cell = { ch: string; kind: CellKind }
type AnimatedCell = Cell & { settleAt: number }

type Phase = 'idle-tune' | 'opening' | 'idle-readout' | 'closing'

function buildReadoutCells(widthPx: number, gapPx: number): Cell[] {
  const wStr = widthPx.toFixed(2)
  const gStr = gapPx.toFixed(2)
  const parts: { text: string; kind: CellKind }[] = [
    { text: 'W ', kind: 'label' },
    { text: wStr, kind: 'num' },
    { text: ' · ', kind: 'dim' },
    { text: 'G ', kind: 'label' },
    { text: gStr, kind: 'num' },
    { text: ' · ', kind: 'dim' },
    { text: '↺', kind: 'label' },
  ]
  const cells: Cell[] = []
  for (const p of parts) {
    for (const ch of [...p.text]) cells.push({ ch, kind: p.kind })
  }
  return cells
}

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onChangeWidth: (next: number) => void
  readonly onChangeGap: (next: number) => void
  readonly onReset: () => void
  readonly label?: string
}

export function TuneTrigger({
  widthPx,
  gapPx,
  onChangeWidth: _onChangeWidth,
  onChangeGap: _onChangeGap,
  onReset: _onReset,
  label,
}: Props): ReactElement {
  const visibleLabel = label ?? 'TUNE'
  const btnRef = useRef<HTMLButtonElement>(null)
  const phaseRef = useRef<Phase>('idle-tune')
  const cellsRef = useRef<AnimatedCell[]>([])
  const phaseStartRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const [expanded, setExpanded] = useState(false)

  const writeIdleTune = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    el.innerHTML = [...visibleLabel]
      .map((c) => `<span class="${styles.cell} ${styles.label}">${c}</span>`)
      .join('')
  }, [visibleLabel])

  const writeIdleReadout = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const cells = buildReadoutCells(widthPx, gapPx)
    el.innerHTML = cells
      .map((c) => `<span class="${styles.cell} ${styles[c.kind]}">${c.ch}</span>`)
      .join('')
  }, [widthPx, gapPx])

  const tick = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const now = performance.now()
    const elapsed = now - phaseStartRef.current
    const phase = phaseRef.current

    if (phase === 'opening') {
      let allSettled = true
      const html = cellsRef.current
        .map((cell) => {
          const ch = elapsed < cell.settleAt ? pickRandomChar() : cell.ch
          if (elapsed < cell.settleAt) allSettled = false
          return `<span class="${styles.cell} ${styles[cell.kind]}">${ch}</span>`
        })
        .join('')
      el.innerHTML = html
      if (!allSettled) {
        rafIdRef.current = requestAnimationFrame(tick)
      } else {
        phaseRef.current = 'idle-readout'
        writeIdleReadout()
        rafIdRef.current = null
      }
    }
  }, [writeIdleReadout])

  const startOpen = useCallback((): void => {
    if (phaseRef.current === 'opening' || phaseRef.current === 'idle-readout') return
    const target = buildReadoutCells(widthPx, gapPx)
    cellsRef.current = target.map((c, i) => ({
      ch: c.ch,
      kind: c.kind,
      settleAt:
        i * STAGGER_MS +
        SCRAMBLE_MIN_MS +
        Math.random() * (SCRAMBLE_MAX_MS - SCRAMBLE_MIN_MS),
    }))
    phaseRef.current = 'opening'
    phaseStartRef.current = performance.now()
    setExpanded(true)
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    tick()
  }, [widthPx, gapPx, tick])

  // Initial idle render on mount.
  useEffect(() => {
    writeIdleTune()
    return (): void => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [writeIdleTune])

  const handleMouseEnter = useCallback((): void => {
    startOpen()
  }, [startOpen])

  return (
    <button
      ref={btnRef}
      type="button"
      data-testid="tune-trigger"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onMouseEnter={handleMouseEnter}
    >
      {visibleLabel}
    </button>
  )
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: PASS, 2 tests.

Note: `performance.now()` works in jsdom; `requestAnimationFrame` is shimmed but advances with `vi.advanceTimersByTime()` after `vi.useFakeTimers()`.

If the second test fails because rAF isn't ticking under fake timers, fall back to using real timers for that test and `await` a 500ms `Promise<void>`-resolving setTimeout:

```typescript
await new Promise<void>((resolve) => setTimeout(resolve, 500))
```

- [ ] **Step 3.5: Commit**

```bash
git add components/board/TuneTrigger.tsx components/board/TuneTrigger.test.tsx
git commit -m "feat(board): TuneTrigger hover-open Matrix scramble (v4-inplace)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Close animation (mouseleave + 180ms grace)

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 4.1: Write failing test**

Append to `components/board/TuneTrigger.test.tsx`:

```typescript
describe('TuneTrigger — close on mouseleave', () => {
  it('mouseleave after 180ms grace returns to idle TUNE label', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')

    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    expect(btn.textContent).toBe('W 267.84 · G 97.21 · ↺')

    fireEvent.mouseLeave(btn)
    // Wait grace (180ms) + close animation (≈ 21*11 + 190 = 421ms) = ~700ms safe
    await new Promise<void>((resolve) => setTimeout(resolve, 700))
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.textContent).toBe('TUNE')
  })

  it('mouseenter during grace cancels the pending close', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.mouseLeave(btn)
    // Re-enter during grace
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 200))
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
})
```

(Switch the test runner to real timers throughout TuneTrigger.test.tsx — remove the `vi.useFakeTimers()` from Task 3's test to avoid conflicts. Use `await new Promise(...)` everywhere for time advancement.)

- [ ] **Step 4.2: Run failing**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: FAIL — textContent stays 'W 267.84 · G 97.21 · ↺' after mouseLeave.

- [ ] **Step 4.3: Implement close animation**

In `components/board/TuneTrigger.tsx`, add a `closingTick` and `startClose`, plus mouseleave handler:

```typescript
// Add inside the component, after `tick` function:

const startClose = useCallback((): void => {
  if (phaseRef.current === 'closing' || phaseRef.current === 'idle-tune') return
  const target = buildReadoutCells(widthPx, gapPx)
  const n = target.length
  cellsRef.current = target.map((c, i) => ({
    ch: c.ch,
    kind: c.kind,
    // Reverse stagger: rightmost cell finishes scrambling (empties) first.
    settleAt:
      (n - 1 - i) * STAGGER_MS +
      SCRAMBLE_MIN_MS +
      Math.random() * (SCRAMBLE_MAX_MS - SCRAMBLE_MIN_MS),
  }))
  phaseRef.current = 'closing'
  phaseStartRef.current = performance.now()
  if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
  closingTick()
}, [widthPx, gapPx])

const closingTick = useCallback((): void => {
  const el = btnRef.current
  if (!el) return
  const now = performance.now()
  const elapsed = now - phaseStartRef.current
  let anyVisible = false
  const html = cellsRef.current
    .map((cell) => {
      if (elapsed < cell.settleAt) {
        anyVisible = true
        const ch = pickRandomChar()
        return `<span class="${styles.cell} ${styles[cell.kind]}">${ch}</span>`
      }
      return '' // cell consumed → empty
    })
    .join('')
  el.innerHTML = html
  if (anyVisible) {
    rafIdRef.current = requestAnimationFrame(closingTick)
  } else {
    phaseRef.current = 'idle-tune'
    setExpanded(false)
    writeIdleTune()
    rafIdRef.current = null
  }
}, [writeIdleTune])

// Update `tick`'s opening-completed branch to NOT auto-flip to idle-readout
// when phaseRef changed mid-flight. The simple way: check phaseRef === 'opening'
// before transitioning. (See updated tick code below.)

// Add mouseleave handler:
const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const handleMouseLeave = useCallback((): void => {
  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  leaveTimerRef.current = setTimeout(() => {
    startClose()
    leaveTimerRef.current = null
  }, LEAVE_GRACE_MS)
}, [startClose])

// Update handleMouseEnter to cancel any pending leave timer:
const handleMouseEnter = useCallback((): void => {
  if (leaveTimerRef.current) {
    clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = null
  }
  startOpen()
}, [startOpen])
```

Wire `onMouseLeave={handleMouseLeave}` on the `<button>` element.

Forward-declaration trick to satisfy TS: declare `closingTick` and `startClose` as mutable refs, or convert both into useCallbacks where `closingTick` is defined first (no dependency on `startClose`) and `startClose` uses `closingTick`.

Also clean up `leaveTimerRef` in the unmount cleanup effect:

```typescript
useEffect(() => {
  writeIdleTune()
  return (): void => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  }
}, [writeIdleTune])
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 4.5: Commit**

```bash
git add components/board/TuneTrigger.tsx components/board/TuneTrigger.test.tsx
git commit -m "feat(board): TuneTrigger close animation with 180ms leave grace

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Drag-scrub on number cells (W / G value)

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 5.1: Write failing test**

Append to `components/board/TuneTrigger.test.tsx`:

```typescript
describe('TuneTrigger — drag-scrub', () => {
  it('pointerdown + pointermove on a W num cell calls onChangeWidth with delta', async () => {
    const onChangeWidth = vi.fn()
    const { getByTestId, container } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={onChangeWidth}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))

    // Find the first .num cell (= part of "267.84")
    const numCells = container.querySelectorAll('[data-cell-kind="num-w"]')
    expect(numCells.length).toBeGreaterThan(0)
    const target = numCells[0] as HTMLElement

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 200, clientY: 100, movementX: 100 })
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 200, clientY: 100 })

    expect(onChangeWidth).toHaveBeenCalled()
    // ratio = (max - min) / 10000 = (720 - 120) / 10000 = 0.06
    // delta = 100 * 0.06 = 6
    // expected next = 267.84 + 6 = 273.84
    const lastCall = onChangeWidth.mock.calls[onChangeWidth.mock.calls.length - 1]
    expect(lastCall[0]).toBeCloseTo(273.84, 1)
  })
})
```

- [ ] **Step 5.2: Run failing**

Run: `npx vitest run components/board/TuneTrigger.test.tsx -t drag-scrub`
Expected: FAIL — `[data-cell-kind="num-w"]` not found (cells don't tag scope yet).

- [ ] **Step 5.3: Implement drag-scrub**

In `components/board/TuneTrigger.tsx`:

1. Add `BOARD_SLIDERS` import:

```typescript
import { BOARD_SLIDERS } from '@/lib/board/constants'
```

2. Update `buildReadoutCells` to mark cells with `scope: 'w' | 'g' | null`:

```typescript
type Cell = { ch: string; kind: CellKind; scope?: 'w' | 'g' | null }

function buildReadoutCells(widthPx: number, gapPx: number): Cell[] {
  const wStr = widthPx.toFixed(2)
  const gStr = gapPx.toFixed(2)
  const parts: { text: string; kind: CellKind; scope?: 'w' | 'g' }[] = [
    { text: 'W ', kind: 'label' },
    { text: wStr, kind: 'num', scope: 'w' },
    { text: ' · ', kind: 'dim' },
    { text: 'G ', kind: 'label' },
    { text: gStr, kind: 'num', scope: 'g' },
    { text: ' · ', kind: 'dim' },
    { text: '↺', kind: 'label' },
  ]
  const cells: Cell[] = []
  for (const p of parts) {
    for (const ch of [...p.text]) cells.push({ ch, kind: p.kind, scope: p.scope ?? null })
  }
  return cells
}
```

3. Update `writeIdleReadout` and the tick HTML emitter to include `data-cell-kind` and `data-cell-idx` attributes. The `data-cell-kind` is `num-w` / `num-g` for draggable num cells, `label` / `dim` for the rest. The `data-cell-idx` is the cell's index in the array so the pointer handler knows which cell was hit.

In `writeIdleReadout`:

```typescript
const writeIdleReadout = useCallback((): void => {
  const el = btnRef.current
  if (!el) return
  const cells = buildReadoutCells(widthPx, gapPx)
  el.innerHTML = cells
    .map((c, i) => {
      const dk = c.kind === 'num' ? `num-${c.scope}` : c.kind
      return `<span class="${styles.cell} ${styles[c.kind]}" data-cell-kind="${dk}" data-cell-idx="${i}">${c.ch}</span>`
    })
    .join('')
}, [widthPx, gapPx])
```

(Apply the same `data-cell-kind` / `data-cell-idx` markup in `tick` and `closingTick` HTML emitters.)

4. Add pointer handlers on the button (event delegation — the pointerdown's `e.target` tells us which cell was clicked):

```typescript
const MOUSE_PX_FOR_FULL_RANGE = 10000
const SHIFT_SPEED_MULTIPLIER = 10

const dragScopeRef = useRef<'w' | 'g' | null>(null)
const widthRef = useRef(widthPx)
const gapRef = useRef(gapPx)
widthRef.current = widthPx
gapRef.current = gapPx

const handlePointerDown = useCallback((e: PointerEvent<HTMLButtonElement>): void => {
  const target = e.target as HTMLElement
  const kind = target.dataset.cellKind
  if (kind !== 'num-w' && kind !== 'num-g') return
  e.preventDefault()
  e.stopPropagation()
  dragScopeRef.current = kind === 'num-w' ? 'w' : 'g'
  if (typeof e.currentTarget.setPointerCapture === 'function') {
    e.currentTarget.setPointerCapture(e.pointerId)
  }
}, [])

const handlePointerMove = useCallback((e: PointerEvent<HTMLButtonElement>): void => {
  const scope = dragScopeRef.current
  if (scope === null) return
  if (scope === 'w') {
    const range = BOARD_SLIDERS.CARD_WIDTH_MAX_PX - BOARD_SLIDERS.CARD_WIDTH_MIN_PX
    const ratio = range / MOUSE_PX_FOR_FULL_RANGE
    const eff = e.shiftKey ? ratio * SHIFT_SPEED_MULTIPLIER : ratio
    const next = Math.max(
      BOARD_SLIDERS.CARD_WIDTH_MIN_PX,
      Math.min(BOARD_SLIDERS.CARD_WIDTH_MAX_PX, widthRef.current + e.movementX * eff),
    )
    if (next !== widthRef.current) _onChangeWidth(next)
  } else {
    const range = BOARD_SLIDERS.CARD_GAP_MAX_PX - BOARD_SLIDERS.CARD_GAP_MIN_PX
    const ratio = range / MOUSE_PX_FOR_FULL_RANGE
    const eff = e.shiftKey ? ratio * SHIFT_SPEED_MULTIPLIER : ratio
    const next = Math.max(
      BOARD_SLIDERS.CARD_GAP_MIN_PX,
      Math.min(BOARD_SLIDERS.CARD_GAP_MAX_PX, gapRef.current + e.movementX * eff),
    )
    if (next !== gapRef.current) _onChangeGap(next)
  }
}, [_onChangeWidth, _onChangeGap])

const handlePointerUp = useCallback((e: PointerEvent<HTMLButtonElement>): void => {
  if (dragScopeRef.current === null) return
  dragScopeRef.current = null
  if (
    typeof e.currentTarget.hasPointerCapture === 'function' &&
    e.currentTarget.hasPointerCapture(e.pointerId)
  ) {
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
}, [])
```

5. Rename the destructured props in the function signature: drop the `_` prefix from `_onChangeWidth` / `_onChangeGap` / `_onReset` since they're now used:

```typescript
export function TuneTrigger({
  widthPx,
  gapPx,
  onChangeWidth,
  onChangeGap,
  onReset: _onReset,  // still unused until Task 6
  label,
}: Props): ReactElement {
```

6. Wire the handlers on the `<button>`:

```typescript
<button
  ref={btnRef}
  type="button"
  data-testid="tune-trigger"
  className={styles.trigger}
  aria-haspopup="dialog"
  aria-expanded={expanded}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerCancel={handlePointerUp}
>
  {visibleLabel}
</button>
```

Note: importing `PointerEvent` from 'react':

```typescript
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react'
```

Also: with `widthRef.current = widthPx` written inline (no useEffect), the ref tracks the prop on every render — drag math always uses the latest value (= no stale closure).

- [ ] **Step 5.4: Run test to verify it passes**

Run: `npx vitest run components/board/TuneTrigger.test.tsx -t drag-scrub`
Expected: PASS.

- [ ] **Step 5.5: Run all TuneTrigger tests**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5.6: Commit**

```bash
git add components/board/TuneTrigger.tsx components/board/TuneTrigger.test.tsx
git commit -m "feat(board): TuneTrigger drag-scrub on W/G num cells

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Reset (↺) + sticky open + outside click + ESC + a11y

**Files:**
- Modify: `components/board/TuneTrigger.tsx`
- Modify: `components/board/TuneTrigger.test.tsx`

- [ ] **Step 6.1: Write failing test**

Append to `components/board/TuneTrigger.test.tsx`:

```typescript
describe('TuneTrigger — reset and sticky', () => {
  it('clicking the ↺ cell calls onReset', async () => {
    const onReset = vi.fn()
    const { getByTestId, container } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={onReset}
      />,
    )
    const btn = getByTestId('tune-trigger')
    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))

    const resetCell = container.querySelector('[data-cell-kind="reset"]') as HTMLElement
    expect(resetCell).toBeTruthy()
    fireEvent.click(resetCell)
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('clicking the TUNE button toggles sticky open (mouseleave does not close)', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')

    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.click(btn)
    // Sticky now ON — leave should NOT close
    fireEvent.mouseLeave(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 700))
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('ESC closes a sticky-open readout', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.click(btn)
    fireEvent.keyDown(window, { key: 'Escape' })
    await new Promise<void>((resolve) => setTimeout(resolve, 700))
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.textContent).toBe('TUNE')
  })
})
```

- [ ] **Step 6.2: Run failing**

Run: `npx vitest run components/board/TuneTrigger.test.tsx -t "reset and sticky"`
Expected: FAIL — `[data-cell-kind="reset"]` not found and click doesn't fire onReset.

- [ ] **Step 6.3: Implement reset + sticky**

In `components/board/TuneTrigger.tsx`:

1. In `buildReadoutCells`, mark the `↺` cell with a special scope `'reset'`:

```typescript
type CellScope = 'w' | 'g' | 'reset' | null
type Cell = { ch: string; kind: CellKind; scope?: CellScope }

function buildReadoutCells(widthPx: number, gapPx: number): Cell[] {
  // ... (existing)
  const parts: { text: string; kind: CellKind; scope?: CellScope }[] = [
    { text: 'W ', kind: 'label' },
    { text: wStr, kind: 'num', scope: 'w' },
    { text: ' · ', kind: 'dim' },
    { text: 'G ', kind: 'label' },
    { text: gStr, kind: 'num', scope: 'g' },
    { text: ' · ', kind: 'dim' },
    { text: '↺', kind: 'label', scope: 'reset' },
  ]
  // ... (rest)
}
```

2. In the HTML emitters (`writeIdleReadout`, `tick`, `closingTick`), set `data-cell-kind="reset"` for the reset cell. Add `styles.reset` class so it gets pointer cursor.

3. Add `stickyOpenRef` and `handleClick`:

```typescript
const stickyOpenRef = useRef(false)

const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
  const target = e.target as HTMLElement
  const kind = target.dataset.cellKind
  if (kind === 'reset') {
    e.preventDefault()
    e.stopPropagation()
    onReset()
    return
  }
  // Click on the TUNE button itself (or any non-reset cell): toggle sticky
  stickyOpenRef.current = !stickyOpenRef.current
  if (!stickyOpenRef.current) {
    // Sticky turned off; close immediately
    startClose()
  }
}, [onReset, startClose])
```

4. Update `handleMouseLeave` to NOT close if sticky is on:

```typescript
const handleMouseLeave = useCallback((): void => {
  if (stickyOpenRef.current) return  // sticky → don't close
  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  leaveTimerRef.current = setTimeout(() => {
    startClose()
    leaveTimerRef.current = null
  }, LEAVE_GRACE_MS)
}, [startClose])
```

5. ESC handler at window level:

```typescript
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && stickyOpenRef.current) {
      stickyOpenRef.current = false
      startClose()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return (): void => window.removeEventListener('keydown', onKeyDown)
}, [startClose])
```

6. Outside-click handler (for non-test environments where mouseleave alone isn't enough on touchscreens):

```typescript
useEffect(() => {
  const onDocClick = (e: globalThis.MouseEvent): void => {
    if (!stickyOpenRef.current) return
    if (!btnRef.current?.contains(e.target as Node)) {
      stickyOpenRef.current = false
      startClose()
    }
  }
  document.addEventListener('mousedown', onDocClick)
  return (): void => document.removeEventListener('mousedown', onDocClick)
}, [startClose])
```

7. Drop `_onReset` rename to `onReset` in destructure:

```typescript
export function TuneTrigger({
  widthPx,
  gapPx,
  onChangeWidth,
  onChangeGap,
  onReset,
  label,
}: Props): ReactElement {
```

8. Wire `onClick={handleClick}` on the button.

9. Import `MouseEvent` from 'react':

```typescript
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactElement } from 'react'
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 6.5: Commit**

```bash
git add components/board/TuneTrigger.tsx components/board/TuneTrigger.test.tsx
git commit -m "feat(board): TuneTrigger reset + sticky open + ESC close + outside click

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Add i18n keys to all 15 language files

**Files:**
- Modify: `messages/ja.json`
- Modify: `messages/en.json`
- Modify: `messages/{de,fr,es,it,pt,nl,ko,zh,ru,tr,vi,th,ar}.json`

- [ ] **Step 7.1: Add keys to ja.json**

In `messages/ja.json`, locate the `"board": { ... }` block. Add a new `"chrome"` section and a `"tune"` section. The diff (insert after the `"slider"` block, before the closing `}` of `"board"`):

```json
    "slider": {
      "tooltipClick": "クリックでジャンプ",
      "tooltipShift": "Shiftで高速"
    },
    "chrome": {
      "tune": "TUNE",
      "popout": "POP OUT",
      "share": "SHARE"
    },
    "tune": {
      "width": "W",
      "gap": "G",
      "reset_tooltip": "初期値に戻す"
    }
```

(Make sure to add the comma after the closing `}` of `"slider"`.)

- [ ] **Step 7.2: Add same keys to en.json**

In `messages/en.json`, add identical `"chrome"` and `"tune"` blocks. English values:

```json
    "chrome": {
      "tune": "TUNE",
      "popout": "POP OUT",
      "share": "SHARE"
    },
    "tune": {
      "width": "W",
      "gap": "G",
      "reset_tooltip": "Reset to defaults"
    }
```

- [ ] **Step 7.3: Add the same blocks (English verbatim values) to the remaining 13 files**

For each of: `de.json`, `fr.json`, `es.json`, `it.json`, `pt.json`, `nl.json`, `ko.json`, `zh.json`, `ru.json`, `tr.json`, `vi.json`, `th.json`, `ar.json`

Add identical structure with English values verbatim. The `reset_tooltip` should use a language-appropriate phrase if obvious (e.g., German `"Auf Standard zurücksetzen"`), or English `"Reset to defaults"` if uncertain — explicit polish per language is deferred.

Suggested values per language for `reset_tooltip`:

| lang | reset_tooltip |
|---|---|
| de | "Auf Standard zurücksetzen" |
| fr | "Réinitialiser" |
| es | "Restablecer valores" |
| it | "Ripristina valori" |
| pt | "Redefinir valores" |
| nl | "Standaardwaarden herstellen" |
| ko | "기본값으로 재설정" |
| zh | "重置为默认值" |
| ru | "Сбросить к значениям по умолчанию" |
| tr | "Varsayılana sıfırla" |
| vi | "Đặt lại giá trị mặc định" |
| th | "รีเซ็ตเป็นค่าเริ่มต้น" |
| ar | "إعادة تعيين القيم" |

`tune`, `popout`, `share`, `width`, `gap` keys: leave as English verbatim in all 13 files (= matches UI vocab rule per memory `feedback_ui_vocabulary.md`).

- [ ] **Step 7.4: Verify JSON validity**

Run: `node -e "['ja','en','de','fr','es','it','pt','nl','ko','zh','ru','tr','vi','th','ar'].forEach(l => JSON.parse(require('fs').readFileSync('messages/' + l + '.json')))"`
Expected: no output (= all parse successfully). Any `SyntaxError` = a comma / brace problem to fix.

- [ ] **Step 7.5: Switch TuneTrigger to use t() for label**

In `components/board/TuneTrigger.tsx`:

```typescript
import { t } from '@/lib/i18n/t'

// inside the component:
const visibleLabel = label ?? t('board.chrome.tune')
```

- [ ] **Step 7.6: Run TuneTrigger tests to confirm i18n integration**

Run: `npx vitest run components/board/TuneTrigger.test.tsx`
Expected: PASS, 8 tests (= test pins to 'TUNE' which now resolves via t() from ja.json).

- [ ] **Step 7.7: Commit**

```bash
git add messages/*.json components/board/TuneTrigger.tsx
git commit -m "i18n(board): add chrome.{tune,popout,share} + tune.{width,gap,reset_tooltip} keys to 15 languages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Integrate TuneTrigger into BoardRoot

**Files:**
- Modify: `components/board/BoardRoot.tsx`

- [ ] **Step 8.1: Open BoardRoot.tsx and locate the actions slot**

The actions slot is lines ~1257-1283 inside `<TopHeader actions={ ... }>`. Current content:

```typescript
actions={
  <>
    <PopOutButton onClick={...} disabled={...} />
    <SizeSlider value={cardWidthPx} onChange={handleCardWidthChange} />
    <GapSlider value={cardGapPx} onChange={handleCardGapChange} />
    <WidthGapResetButton widthPx={...} gapPx={...} onReset={handleResetWidthGap} />
    <ResetAllButton count={customWidthCount} onClick={handleResetAllCustomWidths} />
    <button type="button" className={styles.sharePill} onClick={...} data-testid="share-pill">
      Share ↗
    </button>
  </>
}
```

- [ ] **Step 8.2: Replace with new 3-element actions**

Change the actions slot to:

```typescript
actions={
  <>
    <TuneTrigger
      widthPx={cardWidthPx}
      gapPx={cardGapPx}
      onChangeWidth={handleCardWidthChange}
      onChangeGap={handleCardGapChange}
      onReset={handleResetWidthGap}
    />
    <button
      type="button"
      className={styles.chromeButton}
      onClick={() => { void pip.open() }}
      disabled={!pip.isSupported}
      data-testid="pop-out-button"
    >
      {t('board.chrome.popout')}
    </button>
    <button
      type="button"
      className={styles.chromeButton}
      onClick={(): void => setShareComposerOpen(true)}
      data-testid="share-pill"
    >
      {t('board.chrome.share')}
    </button>
  </>
}
```

(Keep `data-testid="share-pill"` on the SHARE button so the existing mobile media query in `TopHeader.module.css` correctly hides everything else on mobile.)

- [ ] **Step 8.3: Update imports in BoardRoot.tsx**

Remove these imports (lines ~33-37 currently):

```typescript
import { SizeSlider } from './SizeSlider'
import { GapSlider } from './GapSlider'
import { WidthGapResetButton } from './WidthGapResetButton'
import { ResetAllButton } from './ResetAllButton'
import { PopOutButton } from './PopOutButton'
```

Add this import:

```typescript
import { TuneTrigger } from './TuneTrigger'
```

(Keep `t` import — it's already present per session 40 i18n.)

- [ ] **Step 8.4: Remove unused handlers / state**

`handleResetAllCustomWidths` and `customWidthCount` are no longer referenced. Remove their declarations (lines ~295 and ~300 in BoardRoot.tsx) to avoid "declared but never used" errors:

```typescript
// Remove:
const handleResetAllCustomWidths = useCallback(() => { ... }, [...])
const customWidthCount = useMemo(() => { ... }, [...])
```

If the `useMemo` calculates something referenced elsewhere, leave it; otherwise remove. Verify with grep first.

- [ ] **Step 8.5: Add `.chromeButton` style to BoardRoot.module.css**

Open `components/board/BoardRoot.module.css`. Find the existing `.sharePill` rule. Add a new `.chromeButton` rule that mirrors TuneTrigger's `.trigger` look (= 11px monospace, white 0.85 color, thin stroke, no background). The existing `.sharePill` can stay for now if the SHARE button still references it — but the spec calls for SHARE to be visually identical to POP OUT. Easier: just use `.chromeButton` for both POP OUT and SHARE, deprecate `.sharePill`.

```css
.chromeButton {
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
}
.chromeButton:hover {
  color: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}
.chromeButton:disabled {
  color: rgba(255, 255, 255, 0.30);
  cursor: not-allowed;
  transform: none;
}
.chromeButton:focus-visible {
  outline: 1px dashed rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}
```

- [ ] **Step 8.6: Run all tests**

Run: `npx vitest run`
Expected: All passing. If `PopOutButton.test.tsx` / `ResetAllButton.test.tsx` still pass — good, those orphan components still render correctly even though BoardRoot no longer uses them.

- [ ] **Step 8.7: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8.8: Run build**

Run: `pnpm build`
Expected: Next.js static export completes successfully, `out/` directory generated.

- [ ] **Step 8.9: Commit**

```bash
git add components/board/BoardRoot.tsx components/board/BoardRoot.module.css
git commit -m "feat(board): integrate TuneTrigger + text-only POP OUT / SHARE in TopHeader

Replace 6 components (PopOut/SizeSlider/GapSlider/WidthGapReset/ResetAll/Share-with-arrow)
with 3 text labels (TUNE / POP OUT / SHARE) per session 41 brainstorm. TUNE hover
opens Matrix-scramble W/G readout. ResetAll dropped — Ctrl+Z (session 40 undo)
covers it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Manual verification + deploy

**No files modified — verification + deploy.**

- [ ] **Step 9.1: Start dev server**

Run: `pnpm dev`
Wait for "ready - started server on..."

- [ ] **Step 9.2: Open board in Chrome at user viewport**

Open `http://localhost:3000/board` in Chrome. Resize Chrome window so DevTools viewport is approximately 1489×679 (= user's actual CSS viewport per CLAUDE.md global instructions).

- [ ] **Step 9.3: Verify idle state**

Confirm visually:
- TopHeader right side shows `TUNE` `POP OUT` `SHARE` as plain text (no boxes / borders / backgrounds)
- TUNE text is exactly the same size and color as POP OUT and SHARE
- No jitter / animation while at idle — TUNE just sits there

- [ ] **Step 9.4: Verify hover-open scramble**

Hover over `TUNE`:
- Within ~430ms, the readout `W 267.84 · G 97.21 · ↺` fully materializes via left-to-right cell settling
- Each cell flickers through random characters before settling
- POP OUT and SHARE stay visually anchored at the right edge
- Number cells (`267.84`, `97.21`) are orange (`rgba(255,200,120,0.95)`)
- `·` separators are dim

- [ ] **Step 9.5: Verify drag-scrub on number cells**

While hovered:
- Mouse down on the first digit of `267.84` → cursor changes to ew-resize
- Drag right by ~50px → the W value increases by ~3 (= 50 × 0.06)
- Card layout reflows live as the value changes
- Hold Shift while dragging → value moves ~10× faster
- Release → drag ends

- [ ] **Step 9.6: Verify reset (↺)**

While hovered:
- Click on `↺` at the end of readout → W and G snap back to 267.84 / 97.21
- Press Ctrl+Z → values revert to whatever they were before the reset (= undo stack records it)

- [ ] **Step 9.7: Verify mouse leave close**

- Move cursor off `TUNE` toward the canvas
- Within ~700ms, the readout cells disappear right-to-left with brief scramble, then `TUNE` returns
- aria-expanded becomes 'false' (check DevTools)

- [ ] **Step 9.8: Verify sticky open**

- Hover TUNE → readout opens
- Click on the readout (not on ↺ or a num cell) → readout stays open even after mouseleave
- Press ESC → readout closes back to `TUNE`

- [ ] **Step 9.9: Verify POP OUT and SHARE**

- Click POP OUT → PiP window opens (or shows disabled state if PiP unsupported)
- Click SHARE → Share composer modal opens

- [ ] **Step 9.10: Verify keyboard accessibility**

- Tab through chrome → focus reaches TUNE, POP OUT, SHARE in order
- Tab focus on TUNE → press Enter → readout opens (sticky)
- Press ESC → readout closes

- [ ] **Step 9.11: Run full test suite + tsc + build**

```bash
npx vitest run
npx tsc --noEmit
pnpm build
```

All must pass.

- [ ] **Step 9.12: Deploy to production**

Per `CLAUDE.md` deploy convention:

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="chore: deploy TopHeader TUNE trigger"
```

- [ ] **Step 9.13: Verify production**

Open `https://booklage.pages.dev` in Chrome, hard reload (Ctrl+Shift+R).
Run the same checks from Step 9.3 to 9.10 against the production URL.

- [ ] **Step 9.14: Update docs**

In a final commit, update:
- `docs/TODO.md`: move B-#13 narrative to TODO_COMPLETED.md
- `docs/CURRENT_GOAL.md`: write next session's goal
- `docs/TODO_COMPLETED.md`: append session 41 narrative

```bash
git add docs/
git commit -m "docs(session-41): TopHeader TUNE trigger narrative + next-session goal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

Looking at the plan vs. the spec:

**1. Spec coverage** — every spec section maps to one or more tasks:
- §1 Layout: Task 8 (BoardRoot integration)
- §2-1/2-2/2-3 Hover scramble: Tasks 3, 4
- §2-4 Cell colors: Task 2 (CSS) + Task 3 (HTML emitter)
- §2-5 Click/drag/reset: Tasks 5, 6
- §2-6 Keyboard/a11y: Task 6 (ESC + aria-expanded), Task 9 verification
- §3 Mobile deferred: noted in "Out of scope"
- §4 Cleanup of old components: Task 8 (imports removed); files kept as orphans
- §5 New component: Tasks 2-6
- §6 Migration sequence: Tasks 2-9 follow the order
- §7 i18n: Task 7
- §8 Future hooks: structure in place (label prop accepts override), nothing built
- §9 File list: matches task File sections

**2. Placeholder scan** — no "TBD" or "implement later" remain. Step 7.3 lists language-specific reset_tooltip values explicitly rather than saying "translate appropriately".

**3. Type consistency** — `Cell` type evolves between tasks (scope field added in Task 5, expanded in Task 6); each task shows the full type def at point of change. Function names `tick` / `closingTick` / `startOpen` / `startClose` consistent. Props `onChangeWidth` / `onChangeGap` / `onReset` consistent across spec, skeleton, and final implementation.

**4. Ambiguity** — Task 3 step 2.4 had two versions of TuneTrigger.tsx (one using t(), one with hardcoded 'TUNE'). Fixed by clarifying the literal-then-i18n migration in Step 2.4 + Step 7.5.

---

*Plan saved 2026-05-18 / session 41.*
