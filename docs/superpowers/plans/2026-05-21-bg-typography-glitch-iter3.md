# 背景文字 マウス追従グリッチ (I) — iter3 plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the iter1/2 "white text + 2 RGB ghost halo near cursor" visual with a 9-slice fragmentation glitch (テキストが横スライスでバラバラ) + chromatic aberration, drop rAF throttling for tighter cursor follow, and add a 800ms click-burst feature that propagates the glitch across the whole headline.

**Architecture:** Keep the single hostable `BoardBackgroundTypography` component. Inside the host, render 10 layers: 1 clean base text (always visible, clickable) + 9 horizontal-slice clones positioned at host center. Each slice has a fixed `clip-path: inset()` exposing 1/9 of the headline height, and an `animation` that drives its `translate()` displacement and color tint. The whole slice family is wrapped in a `.spotlightMask` div whose `mask-image: radial-gradient(circle at var(--mx) var(--my), ...)` limits visibility to the cursor zone. CSS var writes on `pointermove` are synchronous (no rAF) — Chrome already raf-coalesces `pointermove`. Click on the base text toggles a `.burst` class on the host for 800ms that animates `--bg-typo-glitch-amp` (1→3→1) and `--bg-typo-glitch-radius` (80→1500→80px) via a CSS keyframe, so the displacement amount and mask radius both spike and decay.

**Tech Stack:** React 18 + Next.js + TypeScript strict + CSS Modules + vitest + happy-dom. No new dependencies.

**Reference:** [original spec](../specs/2026-05-21-bg-typography-mouse-glitch-design.md) (sections 4 and 6 are superseded by this plan; sections 1–3, 5, 7–10 still apply).

---

## File Structure

**Modify:**
- `components/board/BoardBackgroundTypography.tsx` — JSX gains 9 slice spans + `.spotlightMask` wrapper, useEffect drops rAF, new useState + onClick + setTimeout for burst
- `components/board/BoardBackgroundTypography.module.css` — drop `.glitchLayer` / `.glitchTextA` / `.glitchTextB` + their keyframes; add `.spotlightMask`, `.slice`, 9 `.slice0..slice8` selectors, 3 `bg-typo-slice-*` keyframes, 1 `bg-typo-burst` keyframe, `@property` declarations for animatable vars
- `components/board/BoardBackgroundTypography.test.tsx` — update layer-count test (3→10 spans), drop CSS-var-via-rAF test, add burst-class lifecycle test + click handler test
- `docs/superpowers/specs/2026-05-21-bg-typography-mouse-glitch-design.md` — append iter3 note pointing here

---

## Task 1: Append iter3 note to the design spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-21-bg-typography-mouse-glitch-design.md`

- [ ] **Step 1: Append iter3 section to the spec**

Open `docs/superpowers/specs/2026-05-21-bg-typography-mouse-glitch-design.md`. After the existing `## 承認状態` section (= last section), append:

```markdown

---

## Iter 3 amendment (2026-05-21 session 61)

User feedback on iter1+iter2 ship: 「効果範囲が合ってない」 + 「文字の一部が崩れる感じにしたいのに今全然ちがう」 + 「マウス追従が遅い・ずれる」。 The 2-ghost radial halo was too gentle. Iter3 redesigns the visual to fragmentation slicing + adds a click-burst playful trigger.

### Replaces §4 (3-layer ghost spec)

New layer model: 1 clean base text + 9 horizontal slice clones, each clipped to ~11.1 % of text height with `clip-path: inset()`, each translated by `calc(var(--slice-tx) * var(--bg-typo-glitch-amp))`. Colors rotate white / red `#ff5060` / cyan `#50c8ff` across slices. Slices animate via 3 keyframe families (`bg-typo-slice-a/b/c`) staggered by `animation-delay` so the slices break asynchronously — a living signal-noise feel.

### Replaces §6 (mouse tracker + rAF throttle)

`pointermove` writes `--bg-typo-glitch-mx` / `--my` synchronously on the host. Chrome already raf-coalesces `pointermove`, so rAF was a redundant layer of latency. Removing it tightens cursor follow.

### New §11 — Click-burst

The base text gets `pointer-events: auto`. Clicking it toggles `.burst` on the host for 800 ms via `setTimeout`. While `.burst` is set, a CSS keyframe `bg-typo-burst` animates the registered CSS properties `--bg-typo-glitch-amp` (1 → 3 → 1) and `--bg-typo-glitch-radius` (80 → 1500 → 80 px) over 800 ms, so slice displacement triples and the mask blooms to cover the entire headline before collapsing back. Slices outside the original radial zone are inside the bloomed mask, so the glitch propagates across the whole text. Requires `@property` registration (Chrome 85+, Safari 16.4+, Firefox 128+); fallback for browsers without `@property` is a no-op — the burst simply does nothing visually, base behavior unaffected.
```

- [ ] **Step 2: Commit**

```bash
rtk git add docs/superpowers/specs/2026-05-21-bg-typography-mouse-glitch-design.md
rtk git commit -m "docs(spec): bg typography glitch iter3 amendment — slices + click burst"
```

---

## Task 2: Rewrite the CSS module — 9 slice layers + burst keyframe

**Files:**
- Modify: `components/board/BoardBackgroundTypography.module.css`

- [ ] **Step 1: Replace the module CSS in full**

Open `components/board/BoardBackgroundTypography.module.css` and replace its full contents with:

```css
/* Background typography layer — sits between the dark theme background
 * and the cards, displaying the active filter's name (or "AllMarks" for
 * the all-bookmarks view) at hero scale. Cards float on top and occlude
 * the type as they scroll. Iter3 (2026-05-21): replaces the 2-ghost
 * radial halo with a 9-slice fragmentation glitch + click-to-burst.
 *
 * Z-index policy: NO explicit z-index anywhere in this module. Adding any
 * positive z-index to internal elements escapes to the parent stacking
 * context and beats the cards-wrapper sibling. DOM order alone keeps the
 * cards above the typography. */

/* Registered animatable CSS custom properties — required so the keyframe
 * `bg-typo-burst` can interpolate them. @property is Chrome 85+ / Safari
 * 16.4+ / Firefox 128+. Older browsers silently ignore the registration
 * and the burst keyframe becomes a no-op (base mouse-follow behavior
 * still works). */
@property --bg-typo-glitch-amp {
  syntax: '<number>';
  inherits: true;
  initial-value: 1;
}
@property --bg-typo-glitch-radius {
  syntax: '<length>';
  inherits: true;
  initial-value: 80px;
}
@property --bg-typo-glitch-falloff {
  syntax: '<length>';
  inherits: true;
  initial-value: 130px;
}

.host {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  overflow: hidden;

  --bg-typo-glitch-amp: 1;
  --bg-typo-glitch-radius: 80px;
  --bg-typo-glitch-falloff: 130px;
  --bg-typo-glitch-red: #ff5060;
  --bg-typo-glitch-cyan: #50c8ff;
  --bg-typo-glitch-mx: 50%;
  --bg-typo-glitch-my: 50%;
}

/* Shared typography — both the base text and the 9 slice clones must
 * use identical font / size / letter-spacing so the slice clones overlay
 * the base pixel-perfectly. */
.text,
.slice {
  font-family: var(--font-geist), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 600;
  font-size: clamp(72px, 17vw, 260px);
  line-height: 1;
  letter-spacing: -0.035em;
  text-align: center;
  white-space: nowrap;
  user-select: none;
}

/* Base text — always visible everywhere, clean. pointer-events: auto so
 * the user can click it to trigger a burst (despite the host being
 * pointer-events: none for the board interactions). */
.text {
  color: rgba(255, 255, 255, 0.95);
  pointer-events: auto;
  cursor: pointer;
}

/* Mask wrapper — fills the host, applies the radial spotlight mask so
 * the 9 slice clones inside are only visible near the cursor. The
 * radius and falloff are registered properties so the burst keyframe
 * can animate them, expanding the visible zone to cover the whole
 * headline during a burst and collapsing it back. */
.spotlightMask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: mask-image;
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

/* Each slice is absolutely positioned at the host center (matching the
 * base text). clip-path crops it to 1/9 of the headline height so only
 * one band of letters shows per slice. The translate displacement is
 * driven by the per-slice CSS variables `--slice-tx` / `--slice-ty`,
 * multiplied by --bg-typo-glitch-amp so the burst can triple it. */
.slice {
  position: absolute;
  top: 50%;
  left: 50%;
  transform:
    translate(-50%, -50%)
    translate(
      calc(var(--slice-tx, 0px) * var(--bg-typo-glitch-amp)),
      calc(var(--slice-ty, 0px) * var(--bg-typo-glitch-amp))
    );
  will-change: transform;
}

/* 9 slice bands — clip-path values divide the text vertically into 9
 * equal strips (11.111 % each). The displacement values and colors are
 * chosen for irregular signal-noise feel: alternating direction, varied
 * magnitude, RGB tints on 4 of 9 slices, white on the other 5. */
.slice0 { clip-path: inset(0%      0 88.889% 0); --slice-tx: -22px; --slice-ty: 0px;  color: rgba(255, 255, 255, 0.95); }
.slice1 { clip-path: inset(11.111% 0 77.778% 0); --slice-tx: 28px;  --slice-ty: -1px; color: var(--bg-typo-glitch-red); }
.slice2 { clip-path: inset(22.222% 0 66.667% 0); --slice-tx: -14px; --slice-ty: 0px;  color: rgba(255, 255, 255, 0.95); }
.slice3 { clip-path: inset(33.333% 0 55.556% 0); --slice-tx: 30px;  --slice-ty: 1px;  color: var(--bg-typo-glitch-cyan); }
.slice4 { clip-path: inset(44.444% 0 44.444% 0); --slice-tx: -8px;  --slice-ty: 0px;  color: rgba(255, 255, 255, 0.95); }
.slice5 { clip-path: inset(55.556% 0 33.333% 0); --slice-tx: 24px;  --slice-ty: -1px; color: var(--bg-typo-glitch-red); }
.slice6 { clip-path: inset(66.667% 0 22.222% 0); --slice-tx: -28px; --slice-ty: 1px;  color: rgba(255, 255, 255, 0.95); }
.slice7 { clip-path: inset(77.778% 0 11.111% 0); --slice-tx: 20px;  --slice-ty: 0px;  color: var(--bg-typo-glitch-cyan); }
.slice8 { clip-path: inset(88.889% 0 0%      0); --slice-tx: -18px; --slice-ty: 0px;  color: rgba(255, 255, 255, 0.95); }

/* Slice animations — 3 step-based keyframes that scramble the per-slice
 * displacement. Each slice picks one of the three families via class +
 * an animation-delay that desyncs them. Step animation (not smooth
 * tween) is intentional: it produces the discrete じじっじじっ glitch
 * cadence, matching the chrome (TuneTrigger) glitch language. */
.slice0, .slice3, .slice6 { animation: bg-typo-slice-a 900ms steps(6, end) infinite; }
.slice1, .slice4, .slice7 { animation: bg-typo-slice-b 1100ms steps(6, end) infinite; }
.slice2, .slice5, .slice8 { animation: bg-typo-slice-c 1300ms steps(6, end) infinite; }

.slice1 { animation-delay: -120ms; }
.slice2 { animation-delay: -240ms; }
.slice3 { animation-delay: -360ms; }
.slice4 { animation-delay: -480ms; }
.slice5 { animation-delay: -600ms; }
.slice6 { animation-delay: -720ms; }
.slice7 { animation-delay: -840ms; }
.slice8 { animation-delay: -960ms; }

@keyframes bg-typo-slice-a {
  0%   { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp)), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.95; }
  16%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 1.4), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.9; }
  33%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * -0.3), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 1; }
  50%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 1.1), calc(var(--slice-ty) * var(--bg-typo-glitch-amp) * 2)); opacity: 0.85; }
  66%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 0.6), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 1; }
  83%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 1.2), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp)), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.95; }
}

@keyframes bg-typo-slice-b {
  0%   { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp)), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.9; }
  20%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * -0.5), calc(var(--slice-ty) * var(--bg-typo-glitch-amp) * 2)); opacity: 1; }
  40%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 1.3), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.85; }
  60%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 0.4), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 1; }
  80%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 1.5), calc(var(--slice-ty) * var(--bg-typo-glitch-amp) * -1)); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp)), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.9; }
}

@keyframes bg-typo-slice-c {
  0%   { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp)), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.95; }
  25%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 1.2), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.85; }
  50%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * -0.4), calc(var(--slice-ty) * var(--bg-typo-glitch-amp) * 1.5)); opacity: 1; }
  75%  { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp) * 1.6), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) translate(calc(var(--slice-tx) * var(--bg-typo-glitch-amp)), calc(var(--slice-ty) * var(--bg-typo-glitch-amp))); opacity: 0.95; }
}

/* Burst — applied as a class on .host for 800 ms after the user clicks
 * the base text. Animates the amplitude and mask radius so the glitch
 * triples in displacement AND the spotlight blooms to cover the whole
 * headline before collapsing back. Uses ease-out for the bloom and the
 * collapse, matching a "shock wave" rhythm. */
.host.burst {
  animation: bg-typo-burst 800ms ease-out forwards;
}

@keyframes bg-typo-burst {
  /* 0%: rest. 15%: initial impact — 2.5x radius (200px) + amp 2.5x.
   * 40%: shock wave reaches the whole headline — radius 1500px (covers
   * the entire text width at any reasonable viewport) + amp 3x. 100%:
   * collapse back to rest. The 2.5x radius / 3x amp values are user-
   * specified; the 1500px peak is the "propagate to entire text" stage. */
  0%   { --bg-typo-glitch-amp: 1;   --bg-typo-glitch-radius: 80px;   --bg-typo-glitch-falloff: 130px;  }
  15%  { --bg-typo-glitch-amp: 2.5; --bg-typo-glitch-radius: 200px;  --bg-typo-glitch-falloff: 280px;  }
  40%  { --bg-typo-glitch-amp: 3;   --bg-typo-glitch-radius: 1500px; --bg-typo-glitch-falloff: 2000px; }
  100% { --bg-typo-glitch-amp: 1;   --bg-typo-glitch-radius: 80px;   --bg-typo-glitch-falloff: 130px;  }
}

@media (prefers-reduced-motion: reduce) {
  .slice {
    animation: none;
    opacity: 0;
  }
  .host.burst {
    animation: none;
  }
}

/* ─── Variants ────────────────────────────────────────────────────────────
 *
 * Baseline — type centred, slice-fragmentation glitch active near cursor.
 * The 'static' label means "no large-scale motion of the type body"; the
 * cursor-local slice glitch is the resting behaviour. */
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

- [ ] **Step 2: Type-check + run existing CSS-touching tests**

Run:

```bash
rtk pnpm tsc --noEmit
rtk pnpm vitest run components/board/BoardBackgroundTypography
```

Expected: tsc PASS. Vitest will FAIL on the "renders the base text + 2 ghost layers" test (expects 3 spans, will find 10) and on the rAF-throttle test (CSS var write path changed). That's fine — those tests get updated in Task 4.

- [ ] **Step 3: Do NOT commit yet**

The component still references `.glitchLayer` / `.glitchText` classes that no longer exist in the CSS — leaving things compiled but broken. Task 3 rewires the TSX. Skip the commit until both are in sync.

---

## Task 3: Rewrite the TSX — 9 slices + sync mouse tracker + click burst

**Files:**
- Modify: `components/board/BoardBackgroundTypography.tsx`

- [ ] **Step 1: Replace the component body**

Open `components/board/BoardBackgroundTypography.tsx`. Replace the `BoardBackgroundTypography` function (= the JSX returner, starting at `export function BoardBackgroundTypography(`) and the `useEffect` block above it with:

```tsx
type Props = {
  readonly activeFilter: BoardFilter
  readonly moods: readonly MoodRecord[]
  readonly variant?: BoardBgTypoVariant
}

const BURST_DURATION_MS = 800
const SLICE_COUNT = 9

export function BoardBackgroundTypography({
  activeFilter,
  moods,
  variant = 'static',
}: Props): React.ReactElement | null {
  const text = deriveBoardBgTypoText(activeFilter, moods)
  const hostRef = useRef<HTMLDivElement>(null)
  const burstTimerRef = useRef<number | null>(null)
  const [burst, setBurst] = useState(false)

  // Mouse tracker: write CSS vars synchronously on every pointermove. Chrome
  // already raf-coalesces pointermove, so an extra rAF layer just added
  // latency. listening on the document keeps the math right regardless of
  // where the board's pan/zoom transforms live in the parent tree, since
  // host.getBoundingClientRect() returns the on-screen rect.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const onMove = (e: Event): void => {
      const pe = e as PointerEvent
      const rect = host.getBoundingClientRect()
      host.style.setProperty('--bg-typo-glitch-mx', `${pe.clientX - rect.left}px`)
      host.style.setProperty('--bg-typo-glitch-my', `${pe.clientY - rect.top}px`)
    }

    document.addEventListener('pointermove', onMove as EventListener)
    return (): void => {
      document.removeEventListener('pointermove', onMove as EventListener)
    }
  }, [])

  // Burst timer cleanup on unmount
  useEffect(() => {
    return (): void => {
      if (burstTimerRef.current !== null) {
        window.clearTimeout(burstTimerRef.current)
      }
    }
  }, [])

  const triggerBurst = (): void => {
    if (burstTimerRef.current !== null) {
      window.clearTimeout(burstTimerRef.current)
    }
    // Re-trigger: drop and re-set so the CSS animation restarts cleanly.
    setBurst(false)
    // Schedule the actual set on the next frame so React commits the false
    // value first, removing the animation, then re-applies it.
    window.requestAnimationFrame(() => {
      setBurst(true)
      burstTimerRef.current = window.setTimeout(() => {
        setBurst(false)
        burstTimerRef.current = null
      }, BURST_DURATION_MS)
    })
  }

  if (!text) return null

  return (
    <div
      ref={hostRef}
      className={styles.host + (burst ? ' ' + styles.burst : '')}
      data-variant={variant}
      data-testid="board-bg-typography"
      data-burst={burst ? 'true' : 'false'}
      aria-hidden="true"
    >
      <span
        className={styles.text}
        onClick={triggerBurst}
        data-testid="board-bg-typography-text"
      >
        {text}
      </span>
      <div className={styles.spotlightMask} aria-hidden="true">
        {Array.from({ length: SLICE_COUNT }, (_, i) => (
          <span
            key={i}
            className={`${styles.slice} ${styles['slice' + i]}`}
            aria-hidden="true"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `useState` to the import**

At the top of the file, change the React import to:

```tsx
import { useEffect, useRef, useState } from 'react'
```

- [ ] **Step 3: Type-check**

Run:

```bash
rtk pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Do NOT commit yet — tests still fail**

The next task updates the tests. Once green, commit happens at the end of Task 4.

---

## Task 4: Update the tests — 10 spans, click burst, synchronous mouse var write

**Files:**
- Modify: `components/board/BoardBackgroundTypography.test.tsx`

- [ ] **Step 1: Replace the `'BoardBackgroundTypography — glitch layers'` describe block**

In `components/board/BoardBackgroundTypography.test.tsx`, replace the entire `describe('BoardBackgroundTypography — glitch layers', ...)` block (starting at line 46) with:

```tsx
describe('BoardBackgroundTypography — slice glitch + click burst', () => {
  it('renders the base text + 9 slice spans (10 spans total) when text is non-empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="all" moods={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]')
    expect(host).not.toBeNull()
    const spans = host!.querySelectorAll('span')
    // 1 base text + 9 slice clones
    expect(spans.length).toBe(10)
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

  it('updates --bg-typo-glitch-mx / --my synchronously on pointermove (no rAF)', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="all" moods={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]') as HTMLElement
    fireEvent.pointerMove(document, { clientX: 100, clientY: 200 })
    expect(host.style.getPropertyValue('--bg-typo-glitch-mx')).not.toBe('')
    expect(host.style.getPropertyValue('--bg-typo-glitch-my')).not.toBe('')
  })

  it('toggles data-burst=true on click and clears it after 800ms', async () => {
    vi.useFakeTimers()
    // The triggerBurst path uses requestAnimationFrame to re-arm the
    // animation cleanly; make rAF synchronous so the burst class lands
    // immediately under fake timers.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    try {
      const { container } = render(
        <BoardBackgroundTypography activeFilter="all" moods={[]} />,
      )
      const host = container.querySelector(
        '[data-testid="board-bg-typography"]',
      ) as HTMLElement
      const textSpan = container.querySelector(
        '[data-testid="board-bg-typography-text"]',
      ) as HTMLElement

      expect(host.getAttribute('data-burst')).toBe('false')

      fireEvent.click(textSpan)
      expect(host.getAttribute('data-burst')).toBe('true')

      vi.advanceTimersByTime(799)
      expect(host.getAttribute('data-burst')).toBe('true')

      vi.advanceTimersByTime(2)
      expect(host.getAttribute('data-burst')).toBe('false')
    } finally {
      rafSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})
```

- [ ] **Step 2: Run the test file**

Run:

```bash
rtk pnpm vitest run components/board/BoardBackgroundTypography
```

Expected: all 4 tests in this file PASS.

- [ ] **Step 3: Run the full board test surface to confirm no regressions**

Run:

```bash
rtk pnpm vitest run
```

Expected: total PASS count = 663 (= prior 662 baseline minus 1 deleted "renders the base text + 2 ghost layers" test minus 1 deleted rAF test plus 2 new tests: `+9 slice spans` total and `data-burst lifecycle`; the renders-not-rendered + sync-mouse-var tests already existed, just got updated content). If the count differs, inspect the failures and fix them in the test file — do NOT modify the component to satisfy stale tests.

- [ ] **Step 4: Commit CSS + TSX + tests as one cohesive unit**

```bash
rtk git add components/board/BoardBackgroundTypography.module.css components/board/BoardBackgroundTypography.tsx components/board/BoardBackgroundTypography.test.tsx
rtk git commit -m "feat(board): bg typography glitch iter3 — 9 slices + click burst + sync follow"
```

---

## Task 5: Build + Playwright verify + deploy

**Files:**
- (none — verification + deploy only)

- [ ] **Step 1: Production build**

Run:

```bash
rtk pnpm build
```

Expected: build success, `out/` regenerated.

- [ ] **Step 2: Playwright verify on the production build**

Write `/tmp/verify-bg-glitch-iter3.mjs`:

```javascript
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const indexPath = resolve(__dirname, '..', 'Users', 'masay', 'Desktop', 'マイコラージュ', 'out', 'board', 'index.html')

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1489, height: 679 },
  deviceScaleFactor: 2.58,
})
const page = await ctx.newPage()
await page.goto('file://' + indexPath)
await page.waitForSelector('[data-testid="board-bg-typography"]', { timeout: 5000 })

// Move mouse to a known viewport position and read the CSS var the
// component writes. The var value should match the mouse position
// converted to host-local pixels — verifying the synchronous tracker.
await page.mouse.move(700, 400)
await page.waitForTimeout(50)
const mx = await page.evaluate(() => {
  const host = document.querySelector('[data-testid="board-bg-typography"]')
  return host ? getComputedStyle(host).getPropertyValue('--bg-typo-glitch-mx') : null
})
console.log('mx after mouse move:', mx)

// Click the base text and confirm data-burst flips to true
await page.click('[data-testid="board-bg-typography-text"]')
const burstActive = await page.getAttribute('[data-testid="board-bg-typography"]', 'data-burst')
console.log('data-burst immediately after click:', burstActive)

// Wait past the 800ms burst window and confirm it cleared
await page.waitForTimeout(900)
const burstCleared = await page.getAttribute('[data-testid="board-bg-typography"]', 'data-burst')
console.log('data-burst after 900ms:', burstCleared)

await page.screenshot({ path: '/tmp/bg-glitch-iter3.png' })
await browser.close()
```

Run:

```bash
node /tmp/verify-bg-glitch-iter3.mjs
```

Expected output:
- `mx after mouse move:` non-empty px value (≈ 700 px - host-left offset; sign/magnitude depends on viewport but must be non-empty)
- `data-burst immediately after click:` `true`
- `data-burst after 900ms:` `false`
- `/tmp/bg-glitch-iter3.png` written

If any of those fail, debug before deploying. Do NOT deploy a regression.

- [ ] **Step 3: Deploy**

Run from project root:

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="bg-typo-glitch-iter3"
```

Expected: deploy succeeds, prints the `booklage.pages.dev` URL.

- [ ] **Step 4: User verify**

Message the user with: 「iter3 を deploy しました。 `booklage.pages.dev` をハードリロードしてみて、 (1) マウス追従が改善したか、 (2) 文字が崩れる感じが出てるか、 (3) 背景文字をクリックして強烈バーストが効くか、 確認お願いします。」

- [ ] **Step 5: Wait for user feedback before any further iteration**

Do NOT immediately keep tweaking. Land + wait.
