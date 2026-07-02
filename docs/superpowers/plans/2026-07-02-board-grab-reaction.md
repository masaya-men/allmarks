# Board Grab-Reaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the default theme, while grab-wiggling the board, make the board's own UI react continuously — chrome menu labels scramble + RGB-glitch, the background wordmark RGB-glitches, and the waveform meter resonates — then settle on release. Remove the rejected card-edge machinery.

**Architecture:** BoardRoot sets a global `data-grabbing` flag on `<html>` while grabbing the DEFAULT theme (gated so it's never set otherwise). Existing effects react to that flag: chrome/wordmark RGB glitch via `:global(html[data-grabbing])` CSS (reusing the hover glitch language), the chrome text scramble via `useChromeScramble` observing the flag and looping its existing `triggerBurst`, and the waveform meter via a `grabbing` prop folded into ScrollMeter's existing `isInteracting` churn. No new per-card overlays, no SVG filter, no canvas.

**Tech Stack:** TypeScript (strict), React, CSS Modules, MutationObserver, Vitest.

## Global Constraints

- **Scope: default theme only** — the grab flag is set only when `grabWiggle.grabbing && themeId === DEFAULT_THEME_ID` (`'dotted-notebook'`). All reactions key off that flag, so other themes get nothing.
- **default byte-identical at rest** — every reaction is grab-flag-keyed (CSS `[data-grabbing]`, a JS loop that only runs while flagged, a meter prop that's false at rest). No existing visual rule changes. Removing the card-edge machinery returns the board to its clean pre-halftone state.
- **¥0 / server-untouched**; no network.
- **Reduced-motion**: grab-wiggle never engages under reduced-motion (flag never set); AND each effect self-gates (`triggerBurst` early-returns; CSS glitch has `@media (prefers-reduced-motion: reduce)` guards; ScrollMeter's `isInteracting` already checks `reducedMotion`).
- **Start subtle** (agreed): continuous while held, low intensity, tune UP on-device (case B). No `--no-verify`.
- **Pre-deploy gate**: `rtk tsc && rtk vitest run && rtk pnpm build` green (`tests/lib/channel.test.ts` known-flaky → re-run once). Deploy `--project-name=allmarks --branch=master`.

---

## File Structure

| File | Change |
|------|--------|
| `components/board/CardGlitch.tsx`, `CardGlitch.module.css`, `GlitchFilterDefs.tsx`, `BoardDataLayer.tsx`, `lib/board/edge-glitch.ts`, `edge-glitch.test.ts` | **DELETE** — card-edge approach dropped |
| `components/board/BoardRoot.tsx` | remove edge machinery (imports/memo/render/CSS refs); add the `<html data-grabbing>` flag; pass `grabbing` to ScrollMeter |
| `components/board/BoardRoot.module.css` | remove `.dataBandClip`/`.dataLayer`/`edge-flicker` rules + keyframes |
| `lib/board/use-idle-scramble.ts` | loop `triggerBurst` while `<html data-grabbing>` is set (MutationObserver) |
| `components/board/ChromeButton.module.css` | additive: `:global(html[data-grabbing]) .btn::before/::after` looping RGB glitch |
| `components/board/BoardBackgroundTypography.module.css` | additive: `:global(html[data-grabbing]) .text::before/::after` looping RGB glitch (ghosts via `data-wordmark-text`) |
| `components/board/ScrollMeter.tsx` | additive: `grabbing` prop → `grabbingRef` → folded into `isInteracting` |

---

## Task 1: Remove the card-edge machinery

**Files:**
- Delete: `components/board/CardGlitch.tsx`, `components/board/CardGlitch.module.css`, `components/board/GlitchFilterDefs.tsx`, `components/board/BoardDataLayer.tsx`, `lib/board/edge-glitch.ts`, `lib/board/edge-glitch.test.ts`
- Modify: `components/board/BoardRoot.tsx`, `components/board/BoardRoot.module.css`

- [ ] **Step 1: Delete the six files**

```bash
rtk git rm components/board/CardGlitch.tsx components/board/CardGlitch.module.css components/board/GlitchFilterDefs.tsx components/board/BoardDataLayer.tsx lib/board/edge-glitch.ts lib/board/edge-glitch.test.ts
```

- [ ] **Step 2: Remove the edge imports from BoardRoot.tsx**

Delete these three consecutive import lines:
```ts
import { BoardDataLayer, type DataCardRect } from './BoardDataLayer'
import { GlitchFilterDefs } from './GlitchFilterDefs'
import { EDGE_GLITCH, edgeGlitchStyleVars } from '@/lib/board/edge-glitch'
```

- [ ] **Step 3: Remove the `dataCards` memo from BoardRoot.tsx**

Delete the entire block (the comment + memo) that begins with `// Edge signal-glitch overlays (default theme only).` and ends at the memo's closing `}, [themeId, filteredItems, layout.positions, horizontalOffset, viewport.x, viewport.y, viewport.w, viewport.h])`.

- [ ] **Step 4: Remove the band-clip render block from BoardRoot.tsx**

Delete the entire block (the comment `{/* Edge signal-glitch (default theme only): ... */}` through the closing `)}`):
```tsx
            {/* Edge signal-glitch (default theme only): ... */}
            {themeId === DEFAULT_THEME_ID && (
              <>
                <GlitchFilterDefs />
                <div
                  className={styles.dataBandClip}
                  aria-hidden="true"
                  data-grabbing={grabWiggle.grabbing ? '' : undefined}
                  style={edgeGlitchStyleVars(EDGE_GLITCH) as CSSProperties}
                >
                  <div
                    className={styles.dataLayer}
                    style={{
                      transform: `translate3d(...)`,
                    }}
                  >
                    <BoardDataLayer cards={dataCards} />
                  </div>
                </div>
              </>
            )}
```
(It sits right after the cards-wrapper `</div>` and before `</InteractionLayer>`. Remove the whole `{themeId === DEFAULT_THEME_ID && ( … )}` expression and its leading comment. Leave the cards wrapper and `</InteractionLayer>` intact.)

- [ ] **Step 5: Remove the edge CSS from BoardRoot.module.css**

Delete everything from the comment `/* Default-theme "edge signal-glitch": … */` through the end of the `edge-flicker` keyframes + its `@media (prefers-reduced-motion: reduce)` guard (i.e. the entire `.dataBandClip`, `.dataBandClip[data-grabbing]`, `.dataLayer`, `.dataBandClip[data-grabbing] .dataLayer`, `@keyframes edge-flicker`, and the reduced-motion block). The last kept line is the `/* Session 43: chromeButton rule は … */` comment.

- [ ] **Step 6: Verify nothing still references the removed modules + gate**

```bash
rtk grep "CardGlitch\|GlitchFilterDefs\|BoardDataLayer\|edge-glitch\|dataBandClip\|dataCards\|DataCardRect" components lib app
```
Expected: no hits in `.ts`/`.tsx`/`.css` source (docs/plan matches are fine). Then:
```bash
rtk tsc && rtk vitest run && rtk pnpm build
```
Expected: tsc 0; vitest green minus the removed 3 edge-glitch tests (`channel.test.ts` flaky → re-run once); build writes `out/` + `[assert-share-template] OK`.

- [ ] **Step 7: Commit**

```bash
rtk git add -A
rtk git commit -m "refactor(board): remove rejected card-edge glitch machinery"
```

---

## Task 2: Global grab flag on `<html>` (default-gated)

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `grabWiggle.grabbing` (from `useGrabWiggle`), `themeId`, `DEFAULT_THEME_ID`.
- Produces: while grabbing the default board, `document.documentElement` carries the attribute `data-grabbing` (empty string). Removed otherwise + on unmount.

- [ ] **Step 1: Add the flag effect after `grabWiggle` is defined**

Find `const grabWiggle = useGrabWiggle({ containerRef: canvasElRef, resetKey: themeId })` and add immediately after it:
```tsx
  // Grab feedback flag. While the DEFAULT-theme board is being grab-wiggled,
  // set data-grabbing on <html> so the chrome + wordmark glitch (CSS) and the
  // chrome scramble loop (JS, useChromeScramble) react in lockstep, and the
  // waveform meter resonates (grabbing prop below). Gated to default + grabbing,
  // so the flag is NEVER present on other themes or at rest → the reaction is
  // default-only and the board is byte-identical at rest. Reduced-motion is
  // inherently safe: grab-wiggle never sets `grabbing` under reduced-motion.
  const grabReacting = grabWiggle.grabbing && themeId === DEFAULT_THEME_ID
  useEffect(() => {
    const html = document.documentElement
    if (grabReacting) html.setAttribute('data-grabbing', '')
    else html.removeAttribute('data-grabbing')
    return (): void => {
      html.removeAttribute('data-grabbing')
    }
  }, [grabReacting])
```

- [ ] **Step 2: Verify compile**

Run: `rtk tsc`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): set <html data-grabbing> while grabbing default board"
```

---

## Task 3: Chrome text scramble loop while grabbing

**Files:**
- Modify: `lib/board/use-idle-scramble.ts`

**Interfaces:**
- Consumes: the `<html data-grabbing>` flag (Task 2); the hook's own stable `triggerBurst`.
- Produces: while the flag is set, `useChromeScramble` re-fires `triggerBurst()` on a fixed interval so every chrome label churns continuously; stops + settles on release.

- [ ] **Step 1: Add the loop interval constant**

At the top of the module (after the imports), add:
```ts
/** How often each chrome label re-fires its scramble burst while the board is
 *  being grabbed. Subtle cadence (a burst is ~250-700ms), tune on-device. */
const GRAB_SCRAMBLE_INTERVAL_MS = 850
```

- [ ] **Step 2: Add the grab-observer effect inside `useChromeScramble`**

Immediately before the final `return { display, triggerBurst }`, add:
```ts
  // Grab feedback: while BoardRoot flags <html data-grabbing> (default board,
  // grabbing), loop the scramble burst so the label churns continuously. We
  // observe the global flag (mirroring the codebase's data-theme-id observer
  // idiom) so no prop-threading through TopHeader's actions is needed.
  // triggerBurst already no-ops under reduced-motion, and the flag is never set
  // under reduced-motion, so this stays still there.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    let loop: ReturnType<typeof setTimeout> | null = null
    const start = (): void => {
      if (loop !== null) return
      const tick = (): void => {
        triggerBurst()
        loop = setTimeout(tick, GRAB_SCRAMBLE_INTERVAL_MS)
      }
      tick()
    }
    const stop = (): void => {
      if (loop !== null) {
        clearTimeout(loop)
        loop = null
      }
    }
    const sync = (): void => {
      if (html.hasAttribute('data-grabbing')) start()
      else stop()
    }
    const obs = new MutationObserver(sync)
    obs.observe(html, { attributes: true, attributeFilter: ['data-grabbing'] })
    sync()
    return (): void => {
      obs.disconnect()
      stop()
    }
  }, [triggerBurst])
```

- [ ] **Step 3: Verify compile + tests**

Run: `rtk tsc && rtk vitest run lib/board/scramble.test.ts`
Expected: tsc 0; scramble core tests still green (the hook itself isn't unit-tested — MutationObserver + timers aren't meaningfully testable in jsdom; behaviour is verified on-device in Task 6).

- [ ] **Step 4: Commit**

```bash
rtk git add lib/board/use-idle-scramble.ts
rtk git commit -m "feat(board): chrome labels loop scramble while grabbing (observes html flag)"
```

---

## Task 4: Chrome RGB glitch while grabbing (CSS)

**Files:**
- Modify: `components/board/ChromeButton.module.css`

**Interfaces:**
- Consumes: the `<html data-grabbing>` flag; the module's existing `.btn::before/::after` ghost copies (`content: attr(data-glitch-text)`) and the `glitch-shift-a` / `glitch-shift-b` keyframes.

- [ ] **Step 1: Add the grab-glitch rules**

After the existing `.btn:hover::after { … }` rule (and before `.btn:disabled`), add:
```css
/* Grab feedback: while the default-theme board is grabbed (BoardRoot flags
   <html data-grabbing>), every chrome label's RGB ghosts loop — the same glitch
   the label plays on hover, fired on all labels together as board-wide grab
   feedback. Only present while grabbing → default board byte-identical at rest.
   The flag is set only on the default theme, so paper/other themes never react. */
:global(html[data-grabbing]) .btn::before {
  color: #ff9d3f;
  animation: glitch-shift-a 700ms steps(7, end) infinite;
}
:global(html[data-grabbing]) .btn::after {
  color: #50c8ff;
  animation: glitch-shift-b 700ms steps(7, end) infinite;
}
@media (prefers-reduced-motion: reduce) {
  :global(html[data-grabbing]) .btn::before,
  :global(html[data-grabbing]) .btn::after {
    animation: none;
    opacity: 0;
  }
}
```

- [ ] **Step 2: Verify compile + build**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0; build writes `out/`.

- [ ] **Step 3: Commit**

```bash
rtk git add components/board/ChromeButton.module.css
rtk git commit -m "feat(board): chrome labels RGB-glitch while grabbing (additive CSS)"
```

---

## Task 5: Wordmark RGB glitch while grabbing (CSS)

**Files:**
- Modify: `components/board/BoardBackgroundTypography.module.css`

**Interfaces:**
- Consumes: the `<html data-grabbing>` flag; the `.text` element's existing `data-wordmark-text` attribute (ghost-copy source).

- [ ] **Step 1: Add the grab-glitch rules**

After the paper `@media (prefers-reduced-motion: reduce)` block (around the "Reserved selector slots" comment), add:
```css
/* Grab feedback (default theme only — the flag is set only on the default
   board): the background wordmark plays the same RGB-ghost glitch language as
   the chrome labels while grabbing. Ghost copies come from data-wordmark-text.
   All rules are grab-flag-keyed → absent at rest → byte-identical. position:
   relative is applied ONLY while grabbing so the absolute ghosts anchor without
   changing the resting layout. Gentler offsets than the chrome (the wordmark is
   huge). */
:global(html[data-grabbing]) .text {
  position: relative;
}
:global(html[data-grabbing]) .text::before,
:global(html[data-grabbing]) .text::after {
  content: attr(data-wordmark-text);
  position: absolute;
  inset: 0;
  font: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  text-align: inherit;
  white-space: inherit;
  text-wrap: inherit;
  max-width: inherit;
  pointer-events: none;
  -webkit-text-stroke: 0;
}
:global(html[data-grabbing]) .text::before {
  color: #ff9d3f;
  animation: wordmark-glitch-a 700ms steps(7, end) infinite;
}
:global(html[data-grabbing]) .text::after {
  color: #50c8ff;
  animation: wordmark-glitch-b 700ms steps(7, end) infinite;
}
@keyframes wordmark-glitch-a {
  0%   { opacity: 0; transform: translate(0, 0); clip-path: none; }
  10%  { opacity: 0.85; transform: translate(-2px, 0); clip-path: inset(0 0 72% 0); }
  30%  { opacity: 0.85; transform: translate(2px, -1px); clip-path: inset(30% 0 32% 0); }
  50%  { opacity: 0.85; transform: translate(-3px, 0); clip-path: inset(62% 0 6% 0); }
  70%  { opacity: 0.85; transform: translate(2px, 0); clip-path: inset(20% 0 55% 0); }
  85%  { opacity: 0.6; transform: translate(-1px, 0); clip-path: inset(40% 0 30% 0); }
  100% { opacity: 0; transform: translate(0, 0); clip-path: none; }
}
@keyframes wordmark-glitch-b {
  0%   { opacity: 0; transform: translate(0, 0); clip-path: none; }
  10%  { opacity: 0.85; transform: translate(2px, 0); clip-path: inset(0 0 72% 0); }
  30%  { opacity: 0.85; transform: translate(-2px, 1px); clip-path: inset(30% 0 32% 0); }
  50%  { opacity: 0.85; transform: translate(3px, 0); clip-path: inset(62% 0 6% 0); }
  70%  { opacity: 0.85; transform: translate(-2px, 0); clip-path: inset(20% 0 55% 0); }
  85%  { opacity: 0.6; transform: translate(1px, 0); clip-path: inset(40% 0 30% 0); }
  100% { opacity: 0; transform: translate(0, 0); clip-path: none; }
}
@media (prefers-reduced-motion: reduce) {
  :global(html[data-grabbing]) .text::before,
  :global(html[data-grabbing]) .text::after {
    animation: none;
    opacity: 0;
  }
}
```

- [ ] **Step 2: Verify compile + build**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0; build writes `out/`.

- [ ] **Step 3: Commit**

```bash
rtk git add components/board/BoardBackgroundTypography.module.css
rtk git commit -m "feat(board): wordmark RGB-glitch while grabbing (additive CSS)"
```

---

## Task 6: Waveform meter resonance while grabbing

**Files:**
- Modify: `components/board/ScrollMeter.tsx`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `grabReacting` (Task 2) from BoardRoot; ScrollMeter's existing per-frame `isInteracting` churn.
- Produces: ScrollMeter accepts `grabbing?: boolean`; while true, its waveform ticks churn continuously (reusing the tuned "audio static" interaction treatment).

- [ ] **Step 1: Add the `grabbing` prop to ScrollMeter's Props**

In `components/board/ScrollMeter.tsx`, after the `variant?: 'waveform' | 'ruler'` prop line in the `Props` type, add:
```ts
  /** True while the board is being grab-wiggled (default theme). Folds into the
   *  waveform's existing interaction churn so the meter resonates continuously
   *  while held. Ignored by the ruler variant. */
  readonly grabbing?: boolean
```

- [ ] **Step 2: Destructure it + mirror into a ref**

In the `export function ScrollMeter({ … })` destructure, add `grabbing = false,` after `variant = 'waveform',`. Then, right after the `variantRef` mirror block (`useEffect(() => { variantRef.current = variant }, [variant])`), add:
```ts
  // Mirror grabbing into a ref so the single []-deps rAF loop reads it each
  // frame. Same idiom as variantRef/modeRef.
  const grabbingRef = useRef<boolean>(grabbing)
  useEffect(() => { grabbingRef.current = grabbing }, [grabbing])
```

- [ ] **Step 3: Fold `grabbing` into `isInteracting`**

Find:
```ts
      const isInteracting = !reducedMotion && (
        glitchBurstActiveRef.current
        || scrubFractionRef.current !== null
      )
```
Replace with:
```ts
      const isInteracting = !reducedMotion && (
        glitchBurstActiveRef.current
        || scrubFractionRef.current !== null
        || grabbingRef.current
      )
```

- [ ] **Step 4: Pass `grabbing` from BoardRoot**

In `components/board/BoardRoot.tsx`, find the `<ScrollMeter … />` usage and add the prop after `variant={themeMeta.scrollMeterVariant}`:
```tsx
            grabbing={grabReacting}
```

- [ ] **Step 5: Verify compile + tests + build**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0; vitest green (`ScrollMeter.test.tsx` still passes — the new prop is optional; `channel.test.ts` flaky → re-run once); build writes `out/`.

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/ScrollMeter.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(board): waveform meter resonates while grabbing (grabbing prop)"
```

---

## Task 7: At-rest byte-identical check, deploy, on-device tune, docs

**Files:** none (verification + deploy + tuning + docs).

- [ ] **Step 1: At-rest byte-identical check (Playwright)**

Serve `out/`, load the default `/board` with no interaction, assert via `getComputedStyle` / DOM:
- `<html>` has NO `data-grabbing` attribute at rest.
- there is NO `.dataBandClip` element in the DOM (edge machinery removed).
- a chrome `.btn`'s `::before` has `animation-name: none` (or `content` empty) at rest — no glitch running.
- the grab layers' transforms are pure translations (unchanged from the shipped grab-wiggle at-rest check).
Script pattern (run from project root so it resolves the local `playwright`; a static server + `page.evaluate` — reuse the session's earlier at-rest script, updating the assertions above). Expected: at rest nothing from this feature is active → default byte-identical. (Grab drag isn't scriptable — `setPointerCapture` — so the reaction itself is verified manually in Step 3.)

- [ ] **Step 2: Deploy**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 3: User manual verification on allmarks.app (default theme)**

Ask the user to hard-reload, ensure the default theme, then grab-drag empty space and confirm while held:
- the chrome menu labels scramble + RGB-glitch (all together);
- the background wordmark (TITLE on) RGB-glitches;
- the bottom waveform meter churns/resonates;
- releasing settles everything; nothing runs at rest.
Collect feedback and tune: `GRAB_SCRAMBLE_INTERVAL_MS` (scramble cadence), the glitch `700ms`/offsets (chrome + wordmark), and — if the meter churn reads too loud as sustained — dial the grab case (e.g. a gentler multiplier when `grabbingRef` drives it). Redeploy per feedback.

- [ ] **Step 4: Update session docs + commit**

Update `docs/TODO.md`, `docs/TODO_COMPLETED.md`, `docs/CURRENT_GOAL.md` (grab-reaction shipped, card-edge removed, awaiting on-device tune); commit.

---

## Self-Review (author checklist — completed)

- **Spec coverage**: §1 goal/scope → Tasks 2–6 (default-gated flag + reactions); §2 behaviour (rest/while-held/release/reduced-motion) → Task 2 flag + per-effect self-gates; §3 trigger mechanism (html flag + observer) → Tasks 2–3; §4.1 chrome (glitch+scramble) → Tasks 3–4; §4.2 wordmark → Task 5; §4.3 meter → Task 6; §5 removal → Task 1; §6 params → Task 3 const + CSS durations + meter (tune on-device); §7 invariants → Global Constraints + Task 7 checks; §8 testing → scramble core kept + Task 7 playwright/manual.
- **Placeholder scan**: none — full code in every code step; deletions listed explicitly; the render/CSS blocks to remove are identified by their exact leading comments.
- **Type consistency**: `grabReacting` defined in BoardRoot (Task 2), consumed by the html flag (Task 2) and the ScrollMeter `grabbing` prop (Task 6); `grabbing?: boolean` added to ScrollMeter Props (Task 6) matches the BoardRoot usage; `GRAB_SCRAMBLE_INTERVAL_MS` defined + used in Task 3; the CSS keyframes `glitch-shift-a/b` (reused, ChromeButton) and `wordmark-glitch-a/b` (new, BoardBackgroundTypography) are module-scoped to their own files (no cross-module keyframe reference).
- **byte-identical**: all reactions grab-flag-keyed; the flag is default-only + grab-only; removing the edge machinery returns the board to clean state; verified Task 7 Step 1.
- **Removal safety**: Task 1 Step 6 greps for every removed symbol before building, so a dangling reference fails fast.
```
