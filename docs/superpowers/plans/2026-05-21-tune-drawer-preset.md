# TUNE drawer 物理ボタン preset (J) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 vertical preset rows (DENSE/TIGHT/DEFAULT/OPEN/AMBIENT) + `ALLMARKS MK-1` decorative plate to the TUNE drawer, with latching toggle switch visuals, LED state mirror, and Ctrl+Z undo restoring both W and G simultaneously.

**Architecture:**
- New `lib/board/tune-presets.ts` holds the 5 preset definitions and a `findActivePreset(w, g)` helper with ±0.5 px tolerance.
- New `components/board/TunePresetColumn.tsx` renders the left column (5 rows + plate) — pure presentational; takes `widthPx`, `gapPx`, and `onApply(presetId)` props.
- `TuneTrigger.tsx` wraps the existing `faderGroup` + `opsLegend` (right column) and the new `TunePresetColumn` (left column) in a 2-column flex layout.
- `BoardRoot.tsx` handles `onApplyPreset` by pushing a new `tunePreset` undo entry (with both prev W and prev G), then setting state. Undo apply switch gets a new `case 'tunePreset'`.

**Tech Stack:** Next.js 14 + React 18 + TypeScript strict + Vanilla CSS Modules + vitest + idb. No new dependencies.

---

## File Structure

**Create:**
- `lib/board/tune-presets.ts` — `PRESETS` constant + `findActivePreset()` helper
- `lib/board/tune-presets.test.ts` — vitest unit tests
- `components/board/TunePresetColumn.tsx` — left column component
- `components/board/TunePresetColumn.module.css` — column styles
- `components/board/TunePresetColumn.test.tsx` — component tests

**Modify:**
- `lib/board/undo-stack.ts` — extend `UndoEntry` union with `tunePreset` kind
- `components/board/TuneTrigger.tsx` — mount left column, add `onApplyPreset` prop
- `components/board/TuneTrigger.module.css` — change drawer to 2-column flex
- `components/board/BoardRoot.tsx` — handle `onApplyPreset`, add undo apply case
- `messages/{15 langs}.json` — aria-label keys for the 5 preset rows + plate + undo toast

---

## Task 1: Define `PRESETS` constant and `findActivePreset` helper (TDD)

**Files:**
- Create: `lib/board/tune-presets.ts`
- Test: `lib/board/tune-presets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/board/tune-presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PRESETS, findActivePreset, type PresetId } from './tune-presets'

describe('PRESETS', () => {
  it('has exactly 5 entries', () => {
    expect(PRESETS.length).toBe(5)
  })

  it('has the expected ids in order (DENSE → AMBIENT)', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'dense',
      'tight',
      'default',
      'open',
      'ambient',
    ])
  })

  it('has unique (w, g) combinations', () => {
    const seen = new Set<string>()
    for (const p of PRESETS) {
      const key = `${p.w}|${p.g}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('keeps every w within slider range [120, 720]', () => {
    for (const p of PRESETS) {
      expect(p.w).toBeGreaterThanOrEqual(120)
      expect(p.w).toBeLessThanOrEqual(720)
    }
  })

  it('keeps every g within slider range [0, 300]', () => {
    for (const p of PRESETS) {
      expect(p.g).toBeGreaterThanOrEqual(0)
      expect(p.g).toBeLessThanOrEqual(300)
    }
  })

  it('default preset matches existing BOARD_SLIDERS defaults (267.84 / 97.21)', () => {
    const def = PRESETS.find((p) => p.id === 'default')!
    expect(def.w).toBe(267.84)
    expect(def.g).toBe(97.21)
  })
})

describe('findActivePreset', () => {
  it('returns the matching id when w and g equal a preset exactly', () => {
    expect(findActivePreset(267.84, 97.21)).toBe('default')
    expect(findActivePreset(207.80, 23.21)).toBe('dense')
    expect(findActivePreset(607.56, 147.87)).toBe('ambient')
  })

  it('returns the matching id within ±0.5 px tolerance', () => {
    expect(findActivePreset(267.50, 97.21)).toBe('default')
    expect(findActivePreset(267.84, 97.71)).toBe('default')
    expect(findActivePreset(268.34, 96.71)).toBe('default')
  })

  it('returns null when both axes are ≥0.51 px off', () => {
    expect(findActivePreset(267.84 + 0.51, 97.21 + 0.51)).toBeNull()
  })

  it('returns null when only one axis is within tolerance', () => {
    expect(findActivePreset(267.84, 90.00)).toBeNull()
    expect(findActivePreset(280.00, 97.21)).toBeNull()
  })

  it('PresetId type extends only the 5 expected ids', () => {
    const ids: PresetId[] = ['dense', 'tight', 'default', 'open', 'ambient']
    expect(ids.length).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/tune-presets.test.ts`
Expected: FAIL with "Cannot find module './tune-presets'"

- [ ] **Step 3: Write minimal implementation**

Create `lib/board/tune-presets.ts`:

```ts
/**
 * TUNE drawer preset definitions.
 *
 * Values were tuned by the user at 1489 CSS viewport to land just before
 * each column-count boundary (= ensures each preset fills the board at
 * maximum density for its tier). DEFAULT mirrors BOARD_SLIDERS defaults
 * so the existing reset behavior stays equivalent.
 *
 * Spec: docs/superpowers/specs/2026-05-20-tune-drawer-preset-design.md
 */

export type PresetId = 'dense' | 'tight' | 'default' | 'open' | 'ambient'

export type TunePreset = {
  readonly id: PresetId
  readonly label: string
  readonly w: number
  readonly g: number
}

export const PRESETS: readonly TunePreset[] = [
  { id: 'dense', label: 'DENSE', w: 207.80, g: 23.21 },
  { id: 'tight', label: 'TIGHT', w: 220.03, g: 65.70 },
  { id: 'default', label: 'DEFAULT', w: 267.84, g: 97.21 },
  { id: 'open', label: 'OPEN', w: 412.74, g: 62.38 },
  { id: 'ambient', label: 'AMBIENT', w: 607.56, g: 147.87 },
] as const

/** ±0.5 px tolerance absorbs float-rounding noise from GSAP tweens. */
const MATCH_TOLERANCE_PX = 0.5

/**
 * Returns the id of the preset matching (w, g) within ±0.5 px on both
 * axes. Returns null if w or g is outside tolerance of every preset.
 * The 5 presets are guaranteed unique so at most one match is possible.
 */
export function findActivePreset(w: number, g: number): PresetId | null {
  for (const preset of PRESETS) {
    if (
      Math.abs(w - preset.w) <= MATCH_TOLERANCE_PX &&
      Math.abs(g - preset.g) <= MATCH_TOLERANCE_PX
    ) {
      return preset.id
    }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/tune-presets.test.ts`
Expected: PASS (all 11 tests)

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/tune-presets.ts lib/board/tune-presets.test.ts
rtk git commit -m "feat(board): PRESETS constant + findActivePreset (J task 1)"
```

---

## Task 2: Extend `UndoEntry` with `tunePreset` kind

**Files:**
- Modify: `lib/board/undo-stack.ts:13-36`

- [ ] **Step 1: Open the file and read the current union**

Run: `cat lib/board/undo-stack.ts`
Confirm `UndoEntry` ends with `cardGap` entry.

- [ ] **Step 2: Add the new entry kind to the union**

Edit `lib/board/undo-stack.ts`, replace the closing line of the union:

```ts
  | { readonly kind: 'cardWidth'; readonly prevWidthPx: number }
  | { readonly kind: 'cardGap'; readonly prevGapPx: number }
```

with:

```ts
  | { readonly kind: 'cardWidth'; readonly prevWidthPx: number }
  | { readonly kind: 'cardGap'; readonly prevGapPx: number }
  | {
      /** Single undo entry capturing both W and G prior to a preset jump,
       *  so Ctrl+Z restores both values in a single action. */
      readonly kind: 'tunePreset'
      readonly prevWidthPx: number
      readonly prevGapPx: number
    }
```

- [ ] **Step 3: Run typecheck to verify it compiles**

Run: `rtk tsc --noEmit`
Expected: 1 new error in `BoardRoot.tsx` saying "Switch is not exhaustive" or "Property 'tunePreset' is missing in 'never'" near the undo apply switch (~line 880-885). This is intentional — Task 5 fixes it.

- [ ] **Step 4: Commit (compile failure is expected, will be resolved in Task 5)**

```bash
rtk git add lib/board/undo-stack.ts
rtk git commit -m "feat(board): add tunePreset undo entry kind (J task 2)"
```

Note: BoardRoot tsc error stays open until Task 5 — keep moving, this is part of the planned increment.

---

## Task 3: Create `TunePresetColumn` component (visual + click, no parent yet)

**Files:**
- Create: `components/board/TunePresetColumn.tsx`
- Create: `components/board/TunePresetColumn.module.css`
- Create: `components/board/TunePresetColumn.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/board/TunePresetColumn.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TunePresetColumn } from './TunePresetColumn'
import { PRESETS } from '@/lib/board/tune-presets'

describe('TunePresetColumn', () => {
  it('renders all 5 preset rows with their labels', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    for (const preset of PRESETS) {
      expect(screen.getByText(preset.label)).toBeInTheDocument()
    }
  })

  it('renders the ALLMARKS MK-1 plate', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    expect(screen.getByText(/ALLMARKS/i)).toBeInTheDocument()
    expect(screen.getByText(/MK-1/i)).toBeInTheDocument()
  })

  it('marks the row whose values match (widthPx, gapPx) as active', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    const defaultBtn = screen.getByRole('radio', { name: /DEFAULT/i })
    expect(defaultBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('marks no row active when values match no preset', () => {
    render(<TunePresetColumn widthPx={300} gapPx={50} onApply={() => {}} />)
    for (const preset of PRESETS) {
      const row = screen.getByRole('radio', { name: new RegExp(preset.label, 'i') })
      expect(row.getAttribute('aria-checked')).toBe('false')
    }
  })

  it('calls onApply with the preset id when an inactive row is clicked', async () => {
    const onApply = vi.fn()
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={onApply} />)
    await userEvent.click(screen.getByRole('radio', { name: /DENSE/i }))
    expect(onApply).toHaveBeenCalledWith('dense')
  })

  it('does NOT call onApply when the active row is clicked again', async () => {
    const onApply = vi.fn()
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={onApply} />)
    await userEvent.click(screen.getByRole('radio', { name: /DEFAULT/i }))
    expect(onApply).not.toHaveBeenCalled()
  })

  it('uses role="radiogroup" + role="radio" for accessibility', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run components/board/TunePresetColumn.test.tsx`
Expected: FAIL with "Cannot find module './TunePresetColumn'"

- [ ] **Step 3: Write the CSS module**

Create `components/board/TunePresetColumn.module.css`:

```css
.column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
  padding: 4px 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 12px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(40,40,44,1) 0%, rgba(28,28,32,1) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 2px 0 rgba(0,0,0,0.5);
  transform: translateY(0);
  transition:
    transform 150ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 150ms ease-out,
    background-color 150ms ease-out;
  cursor: pointer;
  border: none;
  width: 100%;
  text-align: left;
  height: 28px;
}

.row:hover:not(.active) {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.14),
    0 2px 0 rgba(0,0,0,0.5);
}

.row.active {
  background: rgba(20,20,22,1);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);
  transform: translateY(2px);
  cursor: default;
}

.led {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  transition: background 80ms ease-out, box-shadow 120ms ease-out;
}

.row.active .led {
  background: rgba(74, 222, 128, 0.98);
  box-shadow:
    0 0 3px rgba(134,239,172,0.95),
    0 0 6px rgba(74,222,128,0.65),
    0 0 12px rgba(34,197,94,0.4);
}

.label {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.55);
  user-select: none;
}

.row.active .label {
  color: rgba(255,255,255,0.95);
}

.plate {
  margin-top: 14px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(18,18,20,1);
  border: 1px solid rgba(255,255,255,0.04);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.25);
  text-shadow:
    0 1px 0 rgba(0,0,0,0.6),
    0 -1px 0 rgba(255,255,255,0.05);
  user-select: none;
  text-align: center;
  line-height: 1.4;
}
```

- [ ] **Step 4: Write the React component**

Create `components/board/TunePresetColumn.tsx`:

```tsx
'use client'

import { type ReactElement } from 'react'
import { PRESETS, findActivePreset, type PresetId } from '@/lib/board/tune-presets'
import styles from './TunePresetColumn.module.css'

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onApply: (id: PresetId) => void
}

export function TunePresetColumn({ widthPx, gapPx, onApply }: Props): ReactElement {
  const activeId = findActivePreset(widthPx, gapPx)

  return (
    <div className={styles.column} role="radiogroup" aria-label="Board density presets">
      {PRESETS.map((preset) => {
        const isActive = preset.id === activeId
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`${styles.row} ${isActive ? styles.active : ''}`}
            onClick={(): void => {
              if (!isActive) onApply(preset.id)
            }}
          >
            <span className={styles.led} aria-hidden="true" />
            <span className={styles.label}>{preset.label}</span>
          </button>
        )
      })}
      <div className={styles.plate} aria-hidden="true">
        ALLMARKS
        <br />
        MK-1
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `rtk vitest run components/board/TunePresetColumn.test.tsx`
Expected: PASS (all 7 tests)

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/TunePresetColumn.tsx components/board/TunePresetColumn.module.css components/board/TunePresetColumn.test.tsx
rtk git commit -m "feat(board): TunePresetColumn component + tests (J task 3)"
```

---

## Task 4: Mount `TunePresetColumn` in `TuneTrigger` (2-column layout)

**Files:**
- Modify: `components/board/TuneTrigger.tsx:422-470` (drawer JSX)
- Modify: `components/board/TuneTrigger.tsx` (Props type — add `onApplyPreset`)
- Modify: `components/board/TuneTrigger.module.css` (drawer flex layout)

- [ ] **Step 1: Find the Props type definition**

Run: `grep -n "type.*Props\|interface.*Props" components/board/TuneTrigger.tsx | head -5`
Identify the `Props` type. It will be around line 200-300 with `widthPx`, `gapPx`, `onChangeWidth`, `onChangeGap`, `onReset` fields.

- [ ] **Step 2: Add `onApplyPreset` to the Props type**

Locate the Props type in `components/board/TuneTrigger.tsx`. Add a new prop:

```ts
  readonly onApplyPreset: (id: import('@/lib/board/tune-presets').PresetId) => void
```

Also add it to the function parameter destructuring near line 270-300 (= where `widthPx, gapPx, onChangeWidth, onChangeGap, onReset` are destructured).

- [ ] **Step 3: Import `TunePresetColumn`**

Edit `components/board/TuneTrigger.tsx`. Near line 7-8 (= where `FaderColumn` is imported), add:

```ts
import { TunePresetColumn } from './TunePresetColumn'
```

- [ ] **Step 4: Wrap the drawer contents in 2 columns**

In `components/board/TuneTrigger.tsx` around line 422-470, locate:

```tsx
      <div
        className={styles.drawer}
        data-testid="tune-drawer"
        data-open={expanded ? 'true' : 'false'}
        aria-hidden={!expanded}
      >
        <div className={styles.faderGroup}>
          <FaderColumn ... />
          <FaderColumn ... />
        </div>
        <div className={styles.opsLegend} aria-hidden="true">
          ...
        </div>
      </div>
```

Wrap the existing two children (`faderGroup` + `opsLegend`) inside a new right-column wrapper, and add `TunePresetColumn` as the left column:

```tsx
      <div
        className={styles.drawer}
        data-testid="tune-drawer"
        data-open={expanded ? 'true' : 'false'}
        aria-hidden={!expanded}
      >
        <TunePresetColumn
          widthPx={widthPx}
          gapPx={gapPx}
          onApply={onApplyPreset}
        />
        <div className={styles.drawerRight}>
          <div className={styles.faderGroup}>
            <FaderColumn ... />
            <FaderColumn ... />
          </div>
          <div className={styles.opsLegend} aria-hidden="true">
            ...
          </div>
        </div>
      </div>
```

(Leave existing FaderColumn / opsLegend contents intact — only wrap them.)

- [ ] **Step 5: Update CSS for 2-column flex layout**

Edit `components/board/TuneTrigger.module.css`. Find the `.drawer` rule and change to flex row, then add `.drawerRight`:

```css
.drawer {
  /* existing styles preserved */
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 18px;
}

.drawerRight {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
```

(Keep all other existing rules — only set `display`/`flex-direction`/`align-items`/`gap` on `.drawer` if they conflict, and add `.drawerRight` as a new rule.)

- [ ] **Step 6: Run typecheck**

Run: `rtk tsc --noEmit`
Expected: still 1 error in `BoardRoot.tsx` (= the unfixed switch from Task 2). No new errors. The `TuneTrigger` call site in `BoardRoot.tsx` should now flag a missing `onApplyPreset` prop — this is intentional, Task 5 fixes it.

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/TuneTrigger.tsx components/board/TuneTrigger.module.css
rtk git commit -m "feat(board): mount TunePresetColumn in TuneTrigger (J task 4)"
```

---

## Task 5: Wire `BoardRoot` to handle preset apply + undo

**Files:**
- Modify: `components/board/BoardRoot.tsx` (multiple sections — TuneTrigger usage, undo apply switch, new callback)

- [ ] **Step 1: Find the TuneTrigger usage in BoardRoot**

Run: `grep -n "TuneTrigger\b" components/board/BoardRoot.tsx | head -5`
This identifies the call site that needs `onApplyPreset` added.

- [ ] **Step 2: Add the `onApplyPreset` callback definition**

Locate where `pushUndo` is called for `cardWidth` / `cardGap` in `BoardRoot.tsx` (= ~line 174-209 based on grep above). Below the existing `setCardGapPx` callback, add a new callback:

```ts
const onApplyPreset = useCallback(
  (id: import('@/lib/board/tune-presets').PresetId): void => {
    const preset = require('@/lib/board/tune-presets').PRESETS.find(
      (p: { id: string }) => p.id === id,
    )
    if (!preset) return
    pushUndo({
      kind: 'tunePreset',
      prevWidthPx: cardWidthPx,
      prevGapPx: cardGapPx,
    })
    setCardWidthPx(clampCardWidth(preset.w))
    setCardGapPx(clampCardGap(preset.g))
  },
  [cardWidthPx, cardGapPx, clampCardWidth, clampCardGap, pushUndo],
)
```

Replace the `require` line with a proper import at the top of the file:

```ts
import { PRESETS, type PresetId } from '@/lib/board/tune-presets'
```

Then the callback becomes:

```ts
const onApplyPreset = useCallback(
  (id: PresetId): void => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    pushUndo({
      kind: 'tunePreset',
      prevWidthPx: cardWidthPx,
      prevGapPx: cardGapPx,
    })
    setCardWidthPx(clampCardWidth(preset.w))
    setCardGapPx(clampCardGap(preset.g))
  },
  [cardWidthPx, cardGapPx, clampCardWidth, clampCardGap, pushUndo],
)
```

- [ ] **Step 3: Pass the callback to TuneTrigger**

Locate the `<TuneTrigger ... />` JSX in `BoardRoot.tsx` and add the new prop:

```tsx
<TuneTrigger
  // ... existing props
  onApplyPreset={onApplyPreset}
/>
```

- [ ] **Step 4: Add the `tunePreset` case to the undo apply switch**

Locate `components/board/BoardRoot.tsx:879-884` (= the `case 'cardGap'` block). After the closing `break` of `case 'cardGap'`, insert:

```ts
case 'tunePreset': {
  inverse = {
    kind: 'tunePreset',
    prevWidthPx: cardWidthPx,
    prevGapPx: cardGapPx,
  }
  setCardWidthPx(clampCardWidth(entry.prevWidthPx))
  setCardGapPx(clampCardGap(entry.prevGapPx))
  messageKey = `${direction}.tunePreset`
  break
}
```

- [ ] **Step 5: Run typecheck**

Run: `rtk tsc --noEmit`
Expected: 0 errors. All previous errors from Task 2 + Task 4 now resolved.

- [ ] **Step 6: Run unit tests**

Run: `rtk vitest run`
Expected: 633 PASS + new tests from Task 1 + Task 3 (= ~18 new tests). Total ~651 PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): handle onApplyPreset + undo apply (J task 5)"
```

---

## Task 6: Add i18n keys for the undo toast (15 languages)

**Files:**
- Modify: `messages/en.json`, `messages/ja.json`, plus 13 other language files

**Note:** The preset labels themselves (DENSE / TIGHT / DEFAULT / OPEN / AMBIENT / ALLMARKS / MK-1) are hard-coded English in the component (= chrome vocabulary rule). Only the undo/redo toast for the new `tunePreset` action needs translation here. The `radiogroup` aria-label is also hard-coded English for now (= "Board density presets" via `aria-label` prop on the `<div role="radiogroup">`).

- [ ] **Step 1: Locate the existing `undo.cardWidth` and `redo.cardWidth` keys**

Run: `grep -n "cardWidth\|cardGap" messages/en.json messages/ja.json`
Identify the pattern (= which nested object holds undo / redo messages).

- [ ] **Step 2: Add `tunePreset` keys to `messages/en.json`**

Find the line with `"cardGap": "Card gap"` (or similar) under the `undo` object. Add immediately after it:

```json
      "tunePreset": "Tune preset"
```

Do the same under the `redo` object.

- [ ] **Step 3: Add `tunePreset` keys to `messages/ja.json`**

Find the `cardGap` equivalent. Add:

```json
      "tunePreset": "プリセット適用"
```

under both `undo` and `redo` objects.

- [ ] **Step 4: Add the same key to the remaining 13 languages**

For each of `ar.json` / `de.json` / `es.json` / `fr.json` / `it.json` / `ko.json` / `nl.json` / `pt.json` / `ru.json` / `th.json` / `tr.json` / `vi.json` / `zh.json`, find the `cardGap` line under `undo` and `redo`, and add a `tunePreset` key. Translations (use these exact values):

| lang | translation |
|---|---|
| ar | "تطبيق الإعداد المسبق" |
| de | "Voreinstellung anwenden" |
| es | "Aplicar preajuste" |
| fr | "Appliquer un préréglage" |
| it | "Applica preset" |
| ko | "프리셋 적용" |
| nl | "Voorinstelling toepassen" |
| pt | "Aplicar predefinição" |
| ru | "Применить пресет" |
| th | "ใช้พรีเซ็ต" |
| tr | "Ön ayarı uygula" |
| vi | "Áp dụng cài đặt sẵn" |
| zh | "应用预设" |

- [ ] **Step 5: Run typecheck (= picks up missing message keys via existing test, if any)**

Run: `rtk tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Run all tests**

Run: `rtk vitest run`
Expected: all PASS (= ~651 tests).

- [ ] **Step 7: Commit**

```bash
rtk git add messages/
rtk git commit -m "i18n: tunePreset undo/redo toast (15 langs) (J task 6)"
```

---

## Task 7: Final verification — typecheck, tests, build

**Files:** none modified

- [ ] **Step 1: Run typecheck**

Run: `rtk tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run all unit tests**

Run: `rtk vitest run`
Expected: all PASS, count ~651.

- [ ] **Step 3: Run production build**

Run: `pnpm build`
(Do NOT use `rtk next build` here — `rtk` wraps `next build` but does not run the static export step; see memory `reference_pnpm_build_required.md`.)

Expected: `out/` directory generated successfully, no build errors.

- [ ] **Step 4: Confirm `out/` shipping artifacts include the new column**

Run: `rtk ls out/`
Expected: standard Next.js static export output, no missing files.

- [ ] **Step 5: Manual smoke check**

Run: `pnpm dev`
Open `http://localhost:3000/board`, expand the TUNE drawer, and verify:

1. 5 preset rows visible on the left, ALLMARKS MK-1 plate below
2. The row matching current W/G shows the green LED + pressed-in state (= DEFAULT if first visit)
3. Click DENSE → DEFAULT row releases (raises), DENSE row presses in, W/G snap to 207.80 / 23.21
4. Drag the W fader manually → DENSE row releases (= "no preset" state, all LEDs off)
5. Ctrl+Z → values return to DEFAULT 267.84 / 97.21, DEFAULT row presses in
6. Ctrl+Shift+Z → values return to DENSE 207.80 / 23.21, DENSE row presses in

Stop dev server (Ctrl+C) when satisfied.

- [ ] **Step 6: Deploy to production**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true
```

Expected: deploy successful, URL `https://booklage.pages.dev` reachable.

- [ ] **Step 7: Bump extension manifest? NO**

This is a board-only feature. The Chrome extension is not modified, so no manifest version bump and no sideload required.

- [ ] **Step 8: Commit any incidental changes (if any) and finalize**

If steps 1-6 produced any small fixes:

```bash
rtk git add -A
rtk git commit -m "chore: final J task verification"
```

If no fixes needed, just confirm clean working tree:

```bash
rtk git status
```

Expected: working tree clean.

---

## Self-review notes

- [x] Spec section 1 (概要) → covered by Tasks 1, 3, 4
- [x] Spec section 3 (レイアウト) → Task 3 (component) + Task 4 (mounting)
- [x] Spec section 4 (preset 値) → Task 1
- [x] Spec section 5 (視覚仕様) → Task 3 CSS module
- [x] Spec section 6 (ALLMARKS MK-1 プレート) → Task 3 CSS + component
- [x] Spec section 7 (LED 挙動 = state mirror, ±0.5 px) → Task 1 (`findActivePreset`) + Task 3 (active state)
- [x] Spec section 8 (preset click 動作) → Task 3 (click handler) + Task 5 (BoardRoot wiring)
- [x] Spec section 9 (Undo 統合) → Task 2 (entry type) + Task 5 (push + apply switch)
- [x] Spec section 10 (多言語) → Task 6 (15 langs)
- [x] Spec section 11 (アクセシビリティ) → Task 3 (`role="radiogroup"` + `role="radio"` + `aria-checked`)
- [x] Spec section 12 (テスト) → Task 1 + Task 3 (unit), Task 7 (manual + build)
- [x] Spec section 13 (ファイル変更) → all files covered across Tasks 1-6
- [x] Spec section 14 (スコープ外: I, mobile, sound effect) → not implemented, deferred
- [x] Type consistency: `PresetId` defined in Task 1, used identically in Task 3 (component) and Task 5 (BoardRoot)
- [x] No placeholders: every step has actual code or exact command

---

## Out of scope (deferred)

- GSAP tween of slider thumb during snap (= spec mentioned, but CSS transition on the row gives sufficient tactile feel; revisit if user reports jarring jump)
- Keyboard navigation between preset rows via ↑↓ (= relies on `role="radiogroup"` default; if browser default insufficient, add explicit `onKeyDown` handler later)
- "Click" sound effect (= deferred per spec section 14)
- Mobile / touch-specific behavior (= deferred per spec section 14)
- User-customizable preset values (= deferred per spec section 14)

---

## Related files (for the implementer)

- Spec: [docs/superpowers/specs/2026-05-20-tune-drawer-preset-design.md](../specs/2026-05-20-tune-drawer-preset-design.md)
- IDEAS source: [docs/private/IDEAS.md §J](../../private/IDEAS.md)
- Existing patterns:
  - `lib/board/constants.ts:127-134` (= BOARD_SLIDERS)
  - `lib/board/undo-stack.ts` (= undo entry union)
  - `components/board/BoardRoot.tsx:174-209` (= existing cardWidth/cardGap debounce + pushUndo pattern, for reference)
  - `components/board/BoardRoot.tsx:822-884` (= existing undo apply switch, the new case 'tunePreset' slots in after 'cardGap')
