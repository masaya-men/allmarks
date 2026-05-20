# 背景文字 マウス追従グリッチ (I) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mouse-following chromatic-aberration glitch to the board's hero background typography. The text reads normally everywhere except in a ~80 px radius around the cursor, where two color-shifted ghost layers reveal a localized signal-noise spotlight.

**Architecture:** Three stacked `<span>` layers — base white text + red-shift ghost + cyan-shift ghost — sharing the same content. The two ghosts are masked by a CSS `radial-gradient` driven by `--bg-typo-glitch-mx` / `--my` custom properties that a `useEffect` updates via rAF-throttled `pointermove`. All visual parameters externalised as CSS custom properties so theme stylesheets can override without forking the component.

**Tech Stack:** React 18 + Next.js + TypeScript strict + CSS Modules + vitest. No new dependencies.

---

## File Structure

**Modify:**
- `components/board/BoardBackgroundTypography.tsx` — JSX gains 2 ghost spans, component gains 1 useEffect for mouse tracking
- `components/board/BoardBackgroundTypography.module.css` — CSS variables + `.glitchRed` / `.glitchCyan` rules with `mask-image` + `mix-blend-mode`
- `components/board/BoardBackgroundTypography.test.tsx` — add tests for the 3-layer DOM and mouse-tracker CSS-var updates

---

## Task 1: Add 3-layer DOM + CSS variables + mouse tracker

**Files:**
- Modify: `components/board/BoardBackgroundTypography.tsx`
- Modify: `components/board/BoardBackgroundTypography.module.css`

- [ ] **Step 1: Replace the CSS module with the glitch-enabled stylesheet**

Open `components/board/BoardBackgroundTypography.module.css` and replace its full contents with:

```css
/* Background typography layer — sits between the dark theme background
 * and the cards, displaying the active filter's name (or "AllMarks" for
 * the all-bookmarks view) at hero scale. Cards float on top and occlude
 * the type as they scroll. Iteration 2026-05-21: adds a mouse-following
 * chromatic-aberration glitch that decorates the type only in a small
 * radius around the cursor. */
.host {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  overflow: hidden;

  /* CSS custom properties — theme stylesheets can override any of these
   * to retint or resize the glitch without touching the component. */
  --bg-typo-glitch-radius: 60px;
  --bg-typo-glitch-falloff: 100px;
  --bg-typo-glitch-offset: 2px;
  --bg-typo-glitch-red: rgba(255, 80, 90, 0.85);
  --bg-typo-glitch-cyan: rgba(80, 220, 255, 0.85);
  --bg-typo-glitch-mx: 50%;
  --bg-typo-glitch-my: 50%;
}

/* Shared block: the three layers must occupy identical box geometry so
 * the ghosts overlay the base perfectly. Only color / transform / mask
 * differ between them. */
.text,
.glitchRed,
.glitchCyan {
  font-family: var(--font-geist), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 600;
  font-size: clamp(72px, 17vw, 260px);
  line-height: 1;
  letter-spacing: -0.035em;
  text-align: center;
  white-space: nowrap;
  user-select: none;
}

.text {
  color: rgba(255, 255, 255, 0.95);
  position: relative;
  z-index: 1;
}

/* Red-shifted ghost: same text, translated right by --bg-typo-glitch-offset,
 * masked to the radial spotlight around the cursor, blended additively so
 * it lands as a true chromatic-aberration shift over the base. */
.glitchRed,
.glitchCyan {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  pointer-events: none;
  mix-blend-mode: screen;
  -webkit-mask-image: radial-gradient(
    circle at var(--bg-typo-glitch-mx) var(--bg-typo-glitch-my),
    black 0,
    black var(--bg-typo-glitch-radius),
    transparent var(--bg-typo-glitch-falloff)
  );
  mask-image: radial-gradient(
    circle at var(--bg-typo-glitch-mx) var(--bg-typo-glitch-my),
    black 0,
    black var(--bg-typo-glitch-radius),
    transparent var(--bg-typo-glitch-falloff)
  );
}

.glitchRed {
  color: var(--bg-typo-glitch-red);
  transform: translate(calc(-50% + var(--bg-typo-glitch-offset)), -50%);
}

.glitchCyan {
  color: var(--bg-typo-glitch-cyan);
  transform: translate(calc(-50% - var(--bg-typo-glitch-offset)), -50%);
}

/* Baseline variant — type is centred, mouse glitch active. The 'static'
 * label now means "no large-scale motion of the type itself", the per-
 * cursor glitch is the new resting behaviour. */
.host[data-variant='static'] .text {
  /* no-op — matches the shared declaration above */
}

/* Reserved selector slots for future variants. Empty for now.
.host[data-variant='dvd-bounce'] .text { ... }
.host[data-variant='glitch'] .text { ... }
.host[data-variant='multi'] .text { ... }
.host[data-variant='marquee'] .text { ... }
.host[data-variant='card-wind'] .text { ... }
*/
```

- [ ] **Step 2: Update the component JSX + add the mouse tracker**

Open `components/board/BoardBackgroundTypography.tsx` and replace the `BoardBackgroundTypography` function (= lines 78-96) with the version below. Keep all exports above (`BoardBgTypoVariant`, `isBoardBgTypoVariant`, `deriveBoardBgTypoText`) untouched, and update the React import to include `useEffect` and `useRef`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import type { MoodRecord } from '@/lib/storage/indexeddb'
import styles from './BoardBackgroundTypography.module.css'

// ... existing exports unchanged ...

export function BoardBackgroundTypography({
  activeFilter,
  moods,
  variant = 'static',
}: Props): React.ReactElement | null {
  const text = deriveBoardBgTypoText(activeFilter, moods)
  const hostRef = useRef<HTMLDivElement>(null)

  // Mouse tracker: every pointermove anywhere over the host's positioned
  // ancestor (= board canvas) is captured, rAF-throttled, and written
  // back into two CSS custom properties on the host. The two ghost
  // layers read those properties through their mask-image radial
  // gradient, so the spotlight appears to follow the cursor live.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const tracked = host.offsetParent as HTMLElement | null
    const target: HTMLElement | Document = tracked ?? document
    let rafId: number | null = null
    let pendingX = 0
    let pendingY = 0

    const flush = (): void => {
      host.style.setProperty('--bg-typo-glitch-mx', `${pendingX}px`)
      host.style.setProperty('--bg-typo-glitch-my', `${pendingY}px`)
      rafId = null
    }

    const onMove = (e: Event): void => {
      const pe = e as PointerEvent
      const rect = host.getBoundingClientRect()
      pendingX = pe.clientX - rect.left
      pendingY = pe.clientY - rect.top
      if (rafId === null) rafId = requestAnimationFrame(flush)
    }

    target.addEventListener('pointermove', onMove as EventListener)
    return (): void => {
      target.removeEventListener('pointermove', onMove as EventListener)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  if (!text) return null

  return (
    <div
      ref={hostRef}
      className={styles.host}
      data-variant={variant}
      data-testid="board-bg-typography"
      aria-hidden="true"
    >
      <span className={styles.text}>{text}</span>
      <span className={styles.glitchRed} aria-hidden="true">{text}</span>
      <span className={styles.glitchCyan} aria-hidden="true">{text}</span>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `rtk tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Run the existing BoardBackgroundTypography tests**

Run: `rtk vitest run components/board/BoardBackgroundTypography`
Expected: existing tests still PASS (= deriveBoardBgTypoText / isBoardBgTypoVariant / variant render). The 3-layer change doesn't break existing assertions.

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/BoardBackgroundTypography.tsx components/board/BoardBackgroundTypography.module.css
rtk git commit -m "feat(board): mouse-following chromatic-aberration glitch on bg type (I task 1)"
```

---

## Task 2: Add new tests for the 3-layer DOM + mouse tracker

**Files:**
- Modify: `components/board/BoardBackgroundTypography.test.tsx`

- [ ] **Step 1: Read the existing test file to find the insertion point**

Run: `grep -n "describe\|it\(" components/board/BoardBackgroundTypography.test.tsx | head -10`

Identify the existing describe block(s). Add a new describe block at the end of the file (= after all existing tests, before final `})` of the outer describe if any).

- [ ] **Step 2: Append the new test cases**

Open `components/board/BoardBackgroundTypography.test.tsx` and append after the last `})` (= at end of file):

```ts
describe('BoardBackgroundTypography — glitch layers', () => {
  it('renders the base text + 2 ghost layers when text is non-empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="all" moods={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]')
    expect(host).not.toBeNull()
    // 3 spans (= base + red ghost + cyan ghost) all with the same text content
    const spans = host!.querySelectorAll('span')
    expect(spans.length).toBe(3)
    for (const span of spans) {
      expect(span.textContent).toBe('AllMarks')
    }
  })

  it('does NOT render anything when text resolves to empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="mood:nonexistent" moods={[]} />,
    )
    expect(container.querySelector('[data-testid="board-bg-typography"]')).toBeNull()
  })

  it('updates --bg-typo-glitch-mx / --my on pointermove (rAF-throttled)', async () => {
    vi.useFakeTimers()
    // happy-dom does not auto-fire rAF; mock it to be synchronous.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const { container } = render(
      <BoardBackgroundTypography activeFilter="all" moods={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]') as HTMLElement
    // The component attaches the listener to host.offsetParent; in happy-dom
    // offsetParent is null on a detached host, so the fallback is document.
    fireEvent.pointerMove(document, { clientX: 100, clientY: 200 })

    expect(host.style.getPropertyValue('--bg-typo-glitch-mx')).not.toBe('')
    expect(host.style.getPropertyValue('--bg-typo-glitch-my')).not.toBe('')
    rafSpy.mockRestore()
    vi.useRealTimers()
  })
})
```

Also make sure these imports exist at the top of the file (add any missing):

```ts
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { BoardBackgroundTypography } from './BoardBackgroundTypography'
```

- [ ] **Step 3: Run tests**

Run: `rtk vitest run components/board/BoardBackgroundTypography`
Expected: all PASS (= previous + 3 new).

- [ ] **Step 4: Run the whole suite to confirm no regressions**

Run: `rtk vitest run`
Expected: 656 PASS (= previous 653 + 3 new).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/BoardBackgroundTypography.test.tsx
rtk git commit -m "test(board): bg typography 3-layer glitch + tracker (I task 2)"
```

---

## Task 3: Final verification + deploy

**Files:** none modified

- [ ] **Step 1: typecheck + tests**

Run: `rtk tsc --noEmit && rtk vitest run`
Expected: 0 tsc errors, 656 PASS.

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: clean build, `out/` populated.

- [ ] **Step 3: Deploy**

Run: `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true`
Expected: success, deploy URL printed.

- [ ] **Step 4: Push**

Run: `rtk git push origin master`
Expected: master pushed.

---

## Self-review

- [x] Spec section 3 (動作) → Task 1 useEffect on `pointermove`, fallback to document if no offsetParent.
- [x] Spec section 4 (視覚仕様 3 層構造) → Task 1 JSX adds 2 ghost spans, CSS shared block + per-color `mask-image`.
- [x] Spec section 5 (テーマ / フィルタ拡張性) → All visual params declared as CSS custom properties on `.host`; text source unchanged so filter swaps flow through naturally.
- [x] Spec section 6 (実装) → Task 1 implements both CSS and JS.
- [x] Spec section 7 (テスト) → Task 2 adds 3 new tests covering layers, empty-text branch, and pointer-tracker side-effect.
- [x] Placeholders: none.
- [x] Type consistency: `--bg-typo-glitch-mx` / `--my` consistent across CSS, JS, and tests. `host.offsetParent` pattern used in JS, fallback `document` listener used in test.

---

## Out of scope (deferred)

- pointerleave fade — IDEAS spec accepts "last position holds"
- prefer-reduced-motion check — the glitch is static visual sleight; no animated motion to suppress
- touch / mobile events — desktop only matches existing component scope
- `'static-pure'` variant for users who want no glitch — reserved selector slot only, no implementation this iteration
