# Board Grab-Wiggle Micro-interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grabbing empty board space with a plain left-drag nudges the world with depth (parallax on paper, flat on other themes) and springs back on release, without changing scroll position.

**Architecture:** A rubber-banded pointer offset is written to CSS custom properties (`--grab-x`/`--grab-y`) on the board camera element; the three existing layer wrappers (parchment / scatter / cards) read those vars inside their `transform: translate3d(calc(...))`, each multiplied by a static depth weight. Writes are imperative (no React re-render) for 60fps; release animates the vars back to 0 with a GSAP elastic tween. A pure classifier decides, per pointerdown, whether the gesture is a pan (unchanged), a wiggle, or ignored.

**Tech Stack:** TypeScript (strict), React, GSAP (already imported in board), Vitest + @testing-library/react.

## Global Constraints

- **default 盤面 byte-identical**: at rest `--grab-x/--grab-y` are unset → `calc(base + var(...,0px) * w)` evaluates to `base`; computed transform matrix must be unchanged. Only inline styles change; **no `.module.css` edits**.
- **¥0 / server-untouched**: no network, no storage.
- **Pre-deploy gate**: `rtk tsc && rtk vitest run && rtk pnpm build` all green.
- **TypeScript**: `strict: true`, no `any`, explicit return types, JSDoc on exported symbols.
- **Accessibility**: OS `prefers-reduced-motion: reduce` disables wiggle → plain left-drag falls back to existing scroll (pan).
- **Scope**: desktop mouse only. Touch/long-press is out of scope (spec §7). Existing middle-button pan / Space+drag pan / wheel scroll are preserved untouched.
- **Deploy**: `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true` (ASCII commit message).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/board/rubber-band.ts` (new) | Pure math: `rubberBand`, `computeGrabOffset`; constants `MAX_GRAB_PX`, `GRAB_LAYER_WEIGHTS`, `GRAB_SPRING`. |
| `lib/board/rubber-band.test.ts` (new) | Unit tests for the pure math. |
| `lib/board/grab-gesture.ts` (new) | Pure classifier `classifyBoardPointerDown`. |
| `lib/board/grab-gesture.test.ts` (new) | Unit tests for the classifier. |
| `components/board/use-grab-wiggle.ts` (new) | Hook: reduced-motion gate, CSS-var writes on a container ref, GSAP spring-back. |
| `components/board/use-grab-wiggle.test.tsx` (new) | Hook tests (gate, var writes, resetKey). |
| `components/board/InteractionLayer.tsx` (modify) | Route plain-left-empty pointerdown to wiggle; keep pan/scroll otherwise; grab cursor. |
| `components/board/BoardRoot.tsx` (modify) | Wire `useGrabWiggle` to `cameraRef`; extend the 3 layer `transform`s with `calc(... + var(--grab-*) * weight)`. |

---

## Task 1: Rubber-band math + constants

**Files:**
- Create: `lib/board/rubber-band.ts`
- Test: `lib/board/rubber-band.test.ts`

**Interfaces:**
- Produces:
  - `rubberBand(delta: number, limit: number): number`
  - `computeGrabOffset(originX: number, originY: number, currentX: number, currentY: number, limit: number): { x: number; y: number }`
  - `MAX_GRAB_PX: number` (= 90)
  - `GRAB_LAYER_WEIGHTS: { readonly cards: number; readonly decor: number; readonly parchment: number }`
  - `GRAB_SPRING: { readonly duration: number; readonly ease: string }`

- [ ] **Step 1: Write the failing test**

```ts
// lib/board/rubber-band.test.ts
import { describe, it, expect } from 'vitest'
import {
  rubberBand,
  computeGrabOffset,
  MAX_GRAB_PX,
  GRAB_LAYER_WEIGHTS,
} from './rubber-band'

describe('rubberBand', () => {
  it('returns 0 at delta 0', () => {
    expect(rubberBand(0, 90)).toBe(0)
  })

  it('never reaches or exceeds the limit in magnitude', () => {
    expect(Math.abs(rubberBand(10_000, 90))).toBeLessThan(90)
    expect(Math.abs(rubberBand(-10_000, 90))).toBeLessThan(90)
  })

  it('is monotonically increasing', () => {
    expect(rubberBand(20, 90)).toBeGreaterThan(rubberBand(10, 90))
    expect(rubberBand(200, 90)).toBeGreaterThan(rubberBand(100, 90))
  })

  it('preserves sign (odd function)', () => {
    expect(rubberBand(-30, 90)).toBeCloseTo(-rubberBand(30, 90), 10)
  })

  it('passes small deltas through nearly 1:1', () => {
    // at delta << limit, tanh(x) ≈ x so output ≈ delta
    expect(rubberBand(5, 90)).toBeCloseTo(5, 1)
  })

  it('returns 0 for a non-positive limit', () => {
    expect(rubberBand(50, 0)).toBe(0)
    expect(rubberBand(50, -10)).toBe(0)
  })
})

describe('computeGrabOffset', () => {
  it('is 0/0 when current equals origin', () => {
    expect(computeGrabOffset(100, 200, 100, 200, MAX_GRAB_PX)).toEqual({ x: 0, y: 0 })
  })

  it('rubber-bands each axis independently', () => {
    const out = computeGrabOffset(0, 0, 5, -5, MAX_GRAB_PX)
    expect(out.x).toBeCloseTo(rubberBand(5, MAX_GRAB_PX), 10)
    expect(out.y).toBeCloseTo(rubberBand(-5, MAX_GRAB_PX), 10)
  })
})

describe('GRAB_LAYER_WEIGHTS', () => {
  it('orders front (cards) > middle (decor) > back (parchment)', () => {
    expect(GRAB_LAYER_WEIGHTS.cards).toBeGreaterThan(GRAB_LAYER_WEIGHTS.decor)
    expect(GRAB_LAYER_WEIGHTS.decor).toBeGreaterThan(GRAB_LAYER_WEIGHTS.parchment)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/rubber-band.test.ts`
Expected: FAIL — cannot resolve `./rubber-band`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/board/rubber-band.ts

/** Upper bound (px) for the grab offset before the pull is fully resisted.
 *  Applied to the base offset; each layer scales it by GRAB_LAYER_WEIGHTS. */
export const MAX_GRAB_PX = 90

/** Per-layer depth multipliers for the grab offset. Front (cards) follows the
 *  pointer most; deeper layers lag, producing parallax on paper themes. */
export const GRAB_LAYER_WEIGHTS = {
  cards: 1.0,
  decor: 0.55,
  parchment: 0.28,
} as const

/** Spring-back tween config used when the grab is released. */
export const GRAB_SPRING = {
  duration: 0.7,
  ease: 'elastic.out(1, 0.4)',
} as const

/** Resistance curve: near-linear for small |delta|, asymptoting to ±limit as
 *  |delta| grows (rubber-band). Odd function, so sign is preserved. Returns 0
 *  for a non-positive limit. */
export function rubberBand(delta: number, limit: number): number {
  if (limit <= 0) return 0
  return limit * Math.tanh(delta / limit)
}

/** Rubber-banded offset from a grab origin to the current pointer, per axis. */
export function computeGrabOffset(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  limit: number,
): { x: number; y: number } {
  return {
    x: rubberBand(currentX - originX, limit),
    y: rubberBand(currentY - originY, limit),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/rubber-band.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/rubber-band.ts lib/board/rubber-band.test.ts
rtk git commit -m "feat(board): rubber-band math + grab constants for wiggle"
```

---

## Task 2: Pointer-down intent classifier

**Files:**
- Create: `lib/board/grab-gesture.ts`
- Test: `lib/board/grab-gesture.test.ts`

**Interfaces:**
- Produces:
  - `type BoardPointerIntent = 'pan' | 'wiggle' | 'ignore'`
  - `classifyBoardPointerDown(input: { button: number; spaceHeld: boolean; isSelfTarget: boolean; wiggleEnabled: boolean }): BoardPointerIntent`

**Notes on parity with existing behavior** ([InteractionLayer.tsx:158-178](../../../components/board/InteractionLayer.tsx#L158)): today middle button OR left+Space engages pan (even over cards); otherwise a bare-layer pointerdown (`e.target === e.currentTarget`) engages pan; anything over a card is ignored. This classifier keeps all of that and only re-routes the **plain left button on the bare layer** to `'wiggle'` when wiggle is enabled. Right-button-on-empty keeps its existing pan behavior to avoid an unintended change.

- [ ] **Step 1: Write the failing test**

```ts
// lib/board/grab-gesture.test.ts
import { describe, it, expect } from 'vitest'
import { classifyBoardPointerDown } from './grab-gesture'

const base = { button: 0, spaceHeld: false, isSelfTarget: true, wiggleEnabled: true }

describe('classifyBoardPointerDown', () => {
  it('middle button → pan (even over a card)', () => {
    expect(classifyBoardPointerDown({ ...base, button: 1, isSelfTarget: false })).toBe('pan')
  })

  it('left + Space → pan (even over a card)', () => {
    expect(classifyBoardPointerDown({ ...base, spaceHeld: true, isSelfTarget: false })).toBe('pan')
  })

  it('plain left on empty + wiggle enabled → wiggle', () => {
    expect(classifyBoardPointerDown({ ...base })).toBe('wiggle')
  })

  it('plain left on empty + wiggle disabled → pan (existing scroll)', () => {
    expect(classifyBoardPointerDown({ ...base, wiggleEnabled: false })).toBe('pan')
  })

  it('plain left over a card → ignore', () => {
    expect(classifyBoardPointerDown({ ...base, isSelfTarget: false })).toBe('ignore')
  })

  it('right button on empty → pan (existing quirk preserved)', () => {
    expect(classifyBoardPointerDown({ ...base, button: 2 })).toBe('pan')
  })

  it('right button over a card → ignore', () => {
    expect(classifyBoardPointerDown({ ...base, button: 2, isSelfTarget: false })).toBe('ignore')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/grab-gesture.test.ts`
Expected: FAIL — cannot resolve `./grab-gesture`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/board/grab-gesture.ts

/** What a board pointerdown should engage. */
export type BoardPointerIntent = 'pan' | 'wiggle' | 'ignore'

/** Decide how to handle a board pointerdown. Preserves existing pan triggers
 *  (middle button, left+Space, bare-layer drag) and only re-routes the plain
 *  left button on the bare interaction layer to 'wiggle' when enabled.
 *
 *  @param input.button        PointerEvent.button (0=left, 1=middle, 2=right)
 *  @param input.spaceHeld     whether Space is held (pan modifier)
 *  @param input.isSelfTarget  e.target === e.currentTarget (bare empty area)
 *  @param input.wiggleEnabled whether the grab-wiggle interaction is active
 */
export function classifyBoardPointerDown(input: {
  button: number
  spaceHeld: boolean
  isSelfTarget: boolean
  wiggleEnabled: boolean
}): BoardPointerIntent {
  const { button, spaceHeld, isSelfTarget, wiggleEnabled } = input
  if (button === 1 || (button === 0 && spaceHeld)) return 'pan'
  if (!isSelfTarget) return 'ignore'
  if (button === 0 && wiggleEnabled) return 'wiggle'
  return 'pan'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/grab-gesture.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/grab-gesture.ts lib/board/grab-gesture.test.ts
rtk git commit -m "feat(board): pointerdown intent classifier for grab-wiggle"
```

---

## Task 3: useGrabWiggle hook

**Files:**
- Create: `components/board/use-grab-wiggle.ts`
- Test: `components/board/use-grab-wiggle.test.tsx`

**Interfaces:**
- Consumes: `computeGrabOffset`, `MAX_GRAB_PX`, `GRAB_SPRING` from `@/lib/board/rubber-band`; `gsap` from `gsap`.
- Produces:
  - `type GrabWiggleController = { readonly enabled: boolean; readonly grabbing: boolean; begin(clientX: number, clientY: number): void; move(clientX: number, clientY: number): void; end(): void }`
  - `useGrabWiggle(opts: { containerRef: RefObject<HTMLElement>; resetKey?: unknown }): GrabWiggleController`

**Behavior:**
- `enabled = !prefers-reduced-motion` (checked via `matchMedia`, mirroring [use-paper-parallax.ts:31-51](../../../components/board/use-paper-parallax.ts#L31)).
- `begin`: no-op if disabled. Kill any running tween, reset offset to `{0,0}` and write vars 0 (normal grabs start from rest, so no jump; a rare mid-spring re-grab snaps the small leftover to 0 — acceptable). Record origin, set `grabbing = true`.
- `move`: no-op if disabled or not grabbing. `offset = computeGrabOffset(origin, current, MAX_GRAB_PX)`; write `--grab-x/--grab-y`.
- `end`: no-op if disabled. Clear origin, set `grabbing = false`, GSAP-tween the offset object to `{0,0}` (`GRAB_SPRING`), writing vars each `onUpdate`; on complete write `0,0`.
- `resetKey` change (e.g. theme switch): kill tween, write vars 0, clear grabbing.
- Unmount: kill tween.
- Vars are written on `containerRef.current` via `style.setProperty` — CSS custom properties inherit to all descendant layer wrappers.

- [ ] **Step 1: Write the failing test**

```tsx
// components/board/use-grab-wiggle.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useGrabWiggle } from './use-grab-wiggle'
import { MAX_GRAB_PX, rubberBand } from '@/lib/board/rubber-band'

function setReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

/** Render the hook with a real detached <div> as the container. */
function renderWithContainer(reduced: boolean) {
  setReducedMotion(reduced)
  const el = document.createElement('div')
  return {
    el,
    ...renderHook(() => {
      const ref = useRef<HTMLDivElement>(el)
      return useGrabWiggle({ containerRef: ref })
    }),
  }
}

describe('useGrabWiggle', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('is disabled under prefers-reduced-motion and writes no vars', () => {
    const { el, result } = renderWithContainer(true)
    expect(result.current.enabled).toBe(false)
    act(() => { result.current.begin(100, 100); result.current.move(200, 100) })
    expect(el.style.getPropertyValue('--grab-x')).toBe('')
  })

  it('writes rubber-banded vars on begin+move when enabled', () => {
    const { el, result } = renderWithContainer(false)
    expect(result.current.enabled).toBe(true)
    act(() => { result.current.begin(100, 100) })
    act(() => { result.current.move(140, 100) })
    const expectedX = rubberBand(40, MAX_GRAB_PX)
    expect(parseFloat(el.style.getPropertyValue('--grab-x'))).toBeCloseTo(expectedX, 2)
    expect(parseFloat(el.style.getPropertyValue('--grab-y'))).toBeCloseTo(0, 2)
  })

  it('sets grabbing true on begin and false on end', () => {
    const { result } = renderWithContainer(false)
    act(() => { result.current.begin(0, 0) })
    expect(result.current.grabbing).toBe(true)
    act(() => { result.current.end() })
    expect(result.current.grabbing).toBe(false)
  })

  it('move before begin is a no-op', () => {
    const { el, result } = renderWithContainer(false)
    act(() => { result.current.move(50, 50) })
    expect(el.style.getPropertyValue('--grab-x')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run components/board/use-grab-wiggle.test.tsx`
Expected: FAIL — cannot resolve `./use-grab-wiggle`.

- [ ] **Step 3: Write minimal implementation**

```ts
// components/board/use-grab-wiggle.ts
'use client'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { computeGrabOffset, MAX_GRAB_PX, GRAB_SPRING } from '@/lib/board/rubber-band'

/** Imperative controller for the empty-board grab-wiggle. */
export type GrabWiggleController = {
  /** false under prefers-reduced-motion — callers fall back to scroll. */
  readonly enabled: boolean
  /** true between begin() and end() (drives the grabbing cursor). */
  readonly grabbing: boolean
  begin(clientX: number, clientY: number): void
  move(clientX: number, clientY: number): void
  end(): void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Owns the `--grab-x`/`--grab-y` CSS vars on `containerRef` and springs them
 *  back to 0 on release. Vars inherit to the board's layer wrappers, whose
 *  transforms scale them per depth weight. Disabled under reduced-motion.
 *
 *  @param opts.containerRef element carrying the CSS vars (board camera wrap)
 *  @param opts.resetKey     when this changes (e.g. theme switch), reset to 0
 */
export function useGrabWiggle(opts: {
  containerRef: RefObject<HTMLElement>
  resetKey?: unknown
}): GrabWiggleController {
  const { containerRef, resetKey } = opts

  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])

  const enabled = !reduced && !prefersReducedMotion()

  const originRef = useRef<{ x: number; y: number } | null>(null)
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  const writeVars = useCallback((x: number, y: number): void => {
    const el = containerRef.current
    if (!el) return
    el.style.setProperty('--grab-x', `${x}px`)
    el.style.setProperty('--grab-y', `${y}px`)
  }, [containerRef])

  const killTween = useCallback((): void => {
    if (tweenRef.current) {
      tweenRef.current.kill()
      tweenRef.current = null
    }
  }, [])

  const begin = useCallback((clientX: number, clientY: number): void => {
    if (!enabled) return
    killTween()
    offsetRef.current = { x: 0, y: 0 }
    writeVars(0, 0)
    originRef.current = { x: clientX, y: clientY }
    setGrabbing(true)
  }, [enabled, killTween, writeVars])

  const move = useCallback((clientX: number, clientY: number): void => {
    if (!enabled) return
    const origin = originRef.current
    if (!origin) return
    const offset = computeGrabOffset(origin.x, origin.y, clientX, clientY, MAX_GRAB_PX)
    offsetRef.current = offset
    writeVars(offset.x, offset.y)
  }, [enabled, writeVars])

  const end = useCallback((): void => {
    if (!enabled) return
    originRef.current = null
    setGrabbing(false)
    killTween()
    tweenRef.current = gsap.to(offsetRef.current, {
      x: 0,
      y: 0,
      duration: GRAB_SPRING.duration,
      ease: GRAB_SPRING.ease,
      onUpdate: () => writeVars(offsetRef.current.x, offsetRef.current.y),
      onComplete: () => { writeVars(0, 0); tweenRef.current = null },
    })
  }, [enabled, killTween, writeVars])

  // Reset on theme (or other keyed) change to avoid a stuck offset.
  useEffect(() => {
    killTween()
    originRef.current = null
    offsetRef.current = { x: 0, y: 0 }
    writeVars(0, 0)
    setGrabbing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Kill any in-flight tween on unmount.
  useEffect(() => (): void => { killTween() }, [killTween])

  return { enabled, grabbing, begin, move, end }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run components/board/use-grab-wiggle.test.tsx`
Expected: PASS. (Tests don't assert on the GSAP tween's completion — only begin/move/gate/grabbing state.)

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/use-grab-wiggle.ts components/board/use-grab-wiggle.test.tsx
rtk git commit -m "feat(board): useGrabWiggle hook (CSS-var offset + spring-back)"
```

---

## Task 4: Route the gesture in InteractionLayer

**Files:**
- Modify: `components/board/InteractionLayer.tsx`

**Interfaces:**
- Consumes: `classifyBoardPointerDown` from `@/lib/board/grab-gesture`; `GrabWiggleController` from `./use-grab-wiggle`.
- Produces: adds optional prop `wiggle?: GrabWiggleController` to `InteractionLayerProps`.

This task has no new unit test (pointer-capture + PointerEvent plumbing is not reliably testable in jsdom; the risky decision logic is already covered by Task 2's classifier). Verification is `tsc`/`build` plus the manual check in Task 6.

- [ ] **Step 1: Add imports and the `wiggle` prop**

At the top of `components/board/InteractionLayer.tsx`, add after the existing imports:

```ts
import { classifyBoardPointerDown } from '@/lib/board/grab-gesture'
import type { GrabWiggleController } from './use-grab-wiggle'
```

Extend `InteractionLayerProps` (currently ends after `spaceHeld` / `children`):

```ts
type InteractionLayerProps = {
  readonly direction: ScrollDirection
  readonly onScroll: (deltaX: number, deltaY: number) => void
  readonly spaceHeld: boolean
  /** Empty-board grab-wiggle controller. When enabled, a plain left-drag on the
   *  bare layer nudges the world and springs back instead of scrolling. */
  readonly wiggle?: GrabWiggleController
  readonly children?: ReactNode
}
```

Add `wiggle` to the destructured params in `export function InteractionLayer({ ... })`.

- [ ] **Step 2: Add a gesture-mode ref**

Just below `const dragRef = useRef<{ lastX: number; lastY: number } | null>(null)`:

```ts
  // Which gesture the current pointer sequence engaged: 'pan' uses dragRef +
  // onScroll (existing), 'wiggle' delegates to the grab-wiggle controller.
  const modeRef = useRef<'pan' | 'wiggle' | null>(null)
  const wiggleRef = useRef<GrabWiggleController | undefined>(wiggle)
  wiggleRef.current = wiggle
```

- [ ] **Step 3: Replace `handlePointerDown`**

Replace the whole existing `handlePointerDown` (lines ~158-178) with:

```ts
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      const w = wiggleRef.current
      const intent = classifyBoardPointerDown({
        button: e.button,
        spaceHeld: spaceHeldRef.current,
        isSelfTarget: e.target === e.currentTarget,
        wiggleEnabled: !!w?.enabled,
      })
      if (intent === 'ignore') return
      // Suppress native dragstart / selection / middle-click autoscroll so our
      // drag logic stays in sole control (matches prior behavior).
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      if (intent === 'wiggle' && w) {
        modeRef.current = 'wiggle'
        w.begin(e.clientX, e.clientY)
      } else {
        modeRef.current = 'pan'
        dragRef.current = { lastX: e.clientX, lastY: e.clientY }
      }
    },
    [],
  )
```

- [ ] **Step 4: Update `handlePointerMove` to branch on mode**

At the very top of `handlePointerMove`, before the existing `const d = dragRef.current` line, insert:

```ts
      if (modeRef.current === 'wiggle') {
        wiggleRef.current?.move(e.clientX, e.clientY)
        return
      }
```

(The existing scroll-drag body below is unchanged and only runs in 'pan' mode.)

- [ ] **Step 5: Update `handlePointerUp` to end wiggle**

Replace the existing `handlePointerUp` body with:

```ts
  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (modeRef.current === 'wiggle') {
        wiggleRef.current?.end()
      }
      modeRef.current = null
      dragRef.current = null
    },
    [],
  )
```

- [ ] **Step 6: Add the grab cursor**

In the returned root `<div>` style object, add a `cursor` entry (keep everything else):

```ts
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: BOARD_Z_INDEX.INTERACTION_OVERLAY,
        touchAction: 'none',
        overflow: 'hidden',
        cursor: wiggle?.enabled ? (wiggle.grabbing ? 'grabbing' : 'grab') : undefined,
      }}
```

- [ ] **Step 7: Verify compile + existing tests**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 errors; vitest green (`channel.test.ts` may be flaky — re-run once if it fails).

- [ ] **Step 8: Commit**

```bash
rtk git add components/board/InteractionLayer.tsx
rtk git commit -m "feat(board): route plain left-drag on empty board to grab-wiggle"
```

---

## Task 5: Wire the CSS vars into BoardRoot's layer transforms

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `useGrabWiggle` from `./use-grab-wiggle`; `GRAB_LAYER_WEIGHTS` from `@/lib/board/rubber-band`.

The three layer wrappers currently read (exact current strings):
- Parchment/background ([BoardRoot.tsx:2259](../../../components/board/BoardRoot.tsx#L2259)): `` `translate3d(${-viewport.x}px, ${-viewport.y + paperParallaxY}px, 0)` ``
- Scatter/decor ([BoardRoot.tsx:2284](../../../components/board/BoardRoot.tsx#L2284)): `` `translate3d(${-viewport.x}px, ${-viewport.y + decorParallaxY}px, 0)` ``
- Cards ([BoardRoot.tsx:2323](../../../components/board/BoardRoot.tsx#L2323)): `` `translate3d(${horizontalOffset - viewport.x}px, ${BOARD_TOP_PAD_PX - viewport.y}px, 0)` ``

`cameraRef` already exists ([BoardRoot.tsx:2222](../../../components/board/BoardRoot.tsx#L2222) `<div ref={cameraRef} className={styles.cameraWrap}>`) and is an ancestor of all three wrappers.

- [ ] **Step 1: Add imports**

Add `useGrabWiggle` to the existing `./use-paper-parallax` sibling import area:

```ts
import { useGrabWiggle } from './use-grab-wiggle'
```

Add `GRAB_LAYER_WEIGHTS` to the existing import from `@/lib/board/rubber-band` (create the import if none exists):

```ts
import { GRAB_LAYER_WEIGHTS } from '@/lib/board/rubber-band'
```

- [ ] **Step 2: Instantiate the controller + per-theme bg weight**

Just after the `gridBgPanY` line ([BoardRoot.tsx:881](../../../components/board/BoardRoot.tsx#L881)):

```ts
  // Empty-board grab-wiggle: writes --grab-x/--grab-y on cameraRef; the layer
  // transforms below add them scaled per depth. Reset on theme change so an
  // offset never sticks across a switch.
  const grabWiggle = useGrabWiggle({ containerRef: cameraRef, resetKey: themeId })
  // Parchment/background layer only parallaxes on paper-atelier; other themes
  // keep the bg static under the grab (flat wiggle = cards only).
  const bgGrabWeight = themeId === 'paper-atelier' ? GRAB_LAYER_WEIGHTS.parchment : 0
```

- [ ] **Step 3: Pass the controller to InteractionLayer**

At the `<InteractionLayer>` usage ([BoardRoot.tsx:2223](../../../components/board/BoardRoot.tsx#L2223)), add the prop:

```tsx
          <InteractionLayer
            direction={themeMeta.direction}
            onScroll={handleScroll}
            spaceHeld={spaceHeld}
            wiggle={grabWiggle}
          >
```

- [ ] **Step 4: Extend the parchment/background transform**

Replace the parchment wrapper `transform` string (line ~2259) with:

```ts
                transform: `translate3d(calc(${-viewport.x}px + var(--grab-x, 0px) * ${bgGrabWeight}), calc(${-viewport.y + paperParallaxY}px + var(--grab-y, 0px) * ${bgGrabWeight}), 0)`,
```

- [ ] **Step 5: Extend the scatter/decor transform**

Replace the decor wrapper `transform` string (line ~2284) with:

```ts
                  transform: `translate3d(calc(${-viewport.x}px + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.decor}), calc(${-viewport.y + decorParallaxY}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.decor}), 0)`,
```

- [ ] **Step 6: Extend the cards transform**

Replace the cards wrapper `transform` string (line ~2323) with:

```ts
                transform: `translate3d(calc(${horizontalOffset - viewport.x}px + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), calc(${BOARD_TOP_PAD_PX - viewport.y}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), 0)`,
```

- [ ] **Step 7: Verify compile + full test suite + build**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0; vitest green (re-run `channel.test.ts` once if flaky); build writes `out/`.

- [ ] **Step 8: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): apply grab-wiggle offset to parchment/scatter/cards layers"
```

---

## Task 6: Verify default byte-identical (at rest) + manual feel, then deploy

**Files:** none (verification + deploy).

- [ ] **Step 1: At-rest equivalence check (default + paper), automated measurement**

Serve the built app and, via the playwright skill, open the board on the **default** theme with no pointer interaction. Measure the cards wrapper's computed transform:

- Confirm `getComputedStyle(cardsWrapper).transform` is a pure translation `matrix(1, 0, 0, 1, tx, ty)` (no scale/skew introduced) and that `--grab-x`/`--grab-y` resolve to `0px` (unset).
- Repeat on **paper-atelier**; confirm the parchment and scatter wrappers are also pure translations at rest.

Expected: the added `calc(... + var(--grab-*) * w)` evaluates to the same translation as before (byte-identical rendering at rest). If any wrapper shows an unexpected offset, stop and fix before deploying.

Note: the grab drag itself uses `setPointerCapture`, which rejects playwright synthetic pointers (memory `reference_board_card_click_pointer_capture`) — so the *drag* is verified manually by the user in Step 3, not scripted.

- [ ] **Step 2: Deploy to production**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 3: User manual verification on allmarks.app**

Ask the user to hard-reload `allmarks.app` and check:
- **Default theme**: grab empty space with left-drag → whole board nudges flatly and springs back on release; wheel scroll unchanged; grab cursor appears over empty space.
- **Paper Atelier** (`/seed-demos` → set IDB `board-config.themeId='paper-atelier'`): grab → parchment/scatter/cards move at different speeds (depth), springs back.
- Middle-button / Space+drag still pan; nothing triggers over cards/header/pills.
- (Optional) OS "reduce motion" ON → grab falls back to scroll (no springy motion).

Collect feedback on the tuning numbers (`GRAB_LAYER_WEIGHTS`, `MAX_GRAB_PX`, `GRAB_SPRING`) and adjust in `lib/board/rubber-band.ts`.

- [ ] **Step 4: Update session docs**

Update `docs/TODO.md` "現在の状態", move the completed item to `docs/TODO_COMPLETED.md` (narrative), overwrite `docs/CURRENT_GOAL.md` for the next session, and note the IDEAS.md item as shipped. Commit.

```bash
rtk git add docs/
rtk git commit -m "docs: session 147 close-out — board grab-wiggle shipped"
```

---

## Self-Review (author checklist — completed)

- **Spec coverage**: behavior spec §1 → Tasks 3-5; existing-behavior parity §2 → Task 2 classifier + Task 4; CSS-var/calc method §3.1 → Task 5; rubberBand §3.2 → Task 1; GSAP spring §3.3 → Task 3; file structure §3.4 → all tasks; cursor §3.5 → Task 4 Step 6; edges §4 → classifier (ignore over cards), reduced-motion gate (Task 3), resetKey theme-switch (Task 3); tests §5 → Tasks 1-3 unit + Task 6 manual; numbers §6 → Task 1 constants; out-of-scope §7 → not implemented (documented).
- **Placeholder scan**: none — every code step has full content.
- **Type consistency**: `GrabWiggleController` (Task 3) consumed verbatim in Task 4/5; `classifyBoardPointerDown` signature (Task 2) matches its Task 4 call; `GRAB_LAYER_WEIGHTS`/`MAX_GRAB_PX`/`GRAB_SPRING`/`computeGrabOffset` names consistent across Tasks 1/3/5.
- **byte-identical**: guaranteed by construction (`+ var(--grab-*,0px) * w` = `+0px` at rest; default bg weight 0); verified at rest in Task 6 Step 1; no `.module.css` edits.
