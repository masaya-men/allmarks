# Board Grab-Reaction (whole-UI feedback) — Design

**Date:** 2026-07-02 (session 148 続き)
**Status:** approved (brainstorming) — pending spec review
**Supersedes:** BOTH prior card-edge attempts on this branch — the halftone (`2026-07-02-board-edge-data-dissolve-design.md`) and the signal-glitch (`2026-07-02-board-edge-signal-glitch-design.md`). Both treated card EDGES and were rejected on-device three times over. This design **removes all card-edge machinery** and instead makes the board's own existing UI micro-effects react to the grab.

## 1. Goal & Scope

On the **default theme**, while the user grab-wiggles the board (left-drag on empty space), the whole board UI **reacts continuously** — as if grabbing energizes the interface:

- **Chrome menu labels** (TITLE / TUNE / GET EXTENSION / MANAGE / POP OUT / SHARE + the board wordmark link) **scramble their text and fire their RGB glitch** — the exact effect they already play on hover, but fired together and held for the whole grab.
- **The background wordmark** (the big "AllMarks" / filter title) plays a continuous **chromatic RGB glitch** (its reserved `'glitch'` variant).
- **The waveform ScrollMeter** (the default theme's audio-waveform motif) **resonates** — its ticks vibrate/swell while held.

On release, everything settles back. The effect is the default theme's digital-terminal aesthetic amplified into one coordinated "the board hums when you hold it" moment — reusing effects that already exist, not inventing a new card visual.

**Why this frame:** three card-edge treatments (RGB trio, halftone, per-card signal-glitch) were all rejected. The grab-wiggle world-shift itself is liked; what was missing was *feedback*. Moving the feedback onto the board's existing signature micro-effects (chrome scramble/glitch — already loved on hover; the sound-wave meter — the theme's soul) is on-brand and low-risk.

**Non-goals (v1):** non-default themes (they already render chrome calm/serif — no digital reaction added there); a one-shot-only jolt (user chose continuous-while-held); grab-velocity-driven intensity; a tuning lab (tune on the board — case B).

## 2. Behavior

- **At rest (no grab):** nothing changes. Every new rule is keyed on the grab state (`[data-grabbing]` / a `.glitchBurst` class / a JS loop that only runs while grabbing). → default board **byte-identical** to before (and, with the card-edge machinery removed, back to the clean pre-halftone board).
- **While grabbing (continuous):**
  - chrome labels: scramble bursts loop on a calm cadence + RGB ghost glitch animates (looping);
  - wordmark: RGB ghost glitch animates (looping);
  - meter: waveform ticks vibrate/swell (looping).
  Intensity is **subtle** and tunable (past attempts skewed loud); continuous but never strobing.
- **On release:** loops stop; text settles to the plain label; glitch/vibration fade out; board returns to rest.
- **Reduced-motion:** inherently safe on two levels — grab-wiggle never engages under `prefers-reduced-motion` (so the grab state is never set), AND the underlying effects already self-gate (`triggerBurst` early-returns; the glitch keyframes have reduced-motion guards). No new animation runs for reduced-motion users.

## 3. Trigger mechanism

- BoardRoot already owns `grabWiggle.grabbing` (from `useGrabWiggle`). While true, set a **global grab flag** on `<html>`: `document.documentElement.dataset.grabbing = ''` (cleared on release / unmount). `<html>` is chosen (like `data-theme-id`) so **any module** can react via `:global(html[data-grabbing]) …` without prop-threading through TopHeader's `actions`.
- **CSS-driven reactions** (chrome glitch, wordmark glitch, meter resonance) read `:global(html[data-grabbing])` — no JS wiring, they just start/stop with the attribute.
- **JS-driven reaction** (the text scramble) needs a signal: `useChromeScramble` observes the global grab flag (a `MutationObserver` on `<html>`'s `data-grabbing`, mirroring the existing `data-theme-id` observer pattern) and, while set, loops `triggerBurst()` on a calm interval; on clear, stops looping and lets the current burst settle.

## 4. Reacting elements — mechanism per element

### 4.1 Chrome menu labels (`ChromeButton`)
- **RGB glitch (CSS):** the button already has `::before`/`::after` ghost copies (`content: attr(data-glitch-text)`) that animate `glitch-shift-a/b` on `:hover`. Add sibling rules `:global(html[data-grabbing]) .btn::before { animation: glitch-shift-a … infinite }` (+ `-b` on `::after`) so the same ghosts loop while grabbing. (The vestigial `.glitchBurst` hook already referenced in the paper block confirms this was the intended extension point; wire it via the grab flag instead.)
- **Text scramble (JS):** `useChromeScramble` loops `triggerBurst()` while the grab flag is set (see §3).
- Paper/other themes already neutralize `.btn` glitch (serif) — so no reaction there, as intended.

### 4.2 Background wordmark (`BoardBackgroundTypography`)
- The `<span>` already carries `data-wordmark-text={text}` (ghost-copy attr) and the host has a `data-variant` hook with a reserved `'glitch'` variant ("chromatic-aberration / RGB flicker"). Add `::before`/`::after` ghost rules (mirroring the chrome glitch language) keyed on `:global(html[data-grabbing])`, gated to the default theme. Only present when TITLE is on (component only mounts then) — that's an accepted secondary channel, not the sole one.

### 4.3 Waveform meter (`ScrollMeter` / its waveform ticks)
- The default meter renders audio-waveform ticks with an existing scroll "swell" + an "audio static" burst. Add a continuous, subtle **resonance** while grabbing: the ticks vibrate/scale vertically (staggered by their index — the bars already expose `--bar-i`), driven by `:global(html[data-grabbing])`. Gated to the waveform variant (default); the paper ruler variant is untouched.

## 5. Removal (delete the card-edge machinery)

Delete all of it — it's unmerged and superseded:
- `components/board/CardGlitch.tsx`, `CardGlitch.module.css`
- `components/board/GlitchFilterDefs.tsx`
- `components/board/BoardDataLayer.tsx`
- `lib/board/edge-glitch.ts`, `edge-glitch.test.ts`
- In `BoardRoot.tsx`: remove the `dataCards` memo, the `<GlitchFilterDefs/>` + `.dataBandClip`/`.dataLayer` render block, and the now-unused imports.
- In `BoardRoot.module.css`: remove the `.dataBandClip` / `.dataLayer` / `edge-flicker` rules + keyframes.

Net effect: the board returns to its clean pre-halftone state, plus the new grab-reaction rules.

## 6. Parameters / tuning (subtle start — case B)

Tunable knobs (CSS vars + a small const), starting subtle:
- scramble loop interval (~700–1000ms between bursts),
- glitch loop cadence (reuse the existing `glitch-shift-a/b` 700ms, `infinite`; possibly slow it),
- wordmark glitch strength (ghost offset/opacity),
- meter resonance amplitude + stagger.
Dial on-device (deploy → grab → adjust), same loop that tuned grab-wiggle.

## 7. Invariants

- **default byte-identical at rest** — every new rule is grab-state-keyed; nothing runs at rest; the removed edge machinery returns the board to its clean state. Verify with Playwright `getComputedStyle` at rest (no grab).
- **reduced-motion safe** (grab never engages; effects self-gate).
- **¥0 / no server / no network.**
- **default theme only** — other themes keep their existing calm chrome (no digital reaction added).
- **Pre-deploy gate:** `rtk tsc && rtk vitest run && rtk pnpm build` green (`tests/lib/channel.test.ts` known-flaky → re-run once). Deploy `--project-name=allmarks --branch=master`.

## 8. Testing

- **Pure logic:** minimal — the reactions are declarative CSS + a scramble loop. If a small pure helper emerges (e.g. a grab-flag hook's guard), unit-test it; otherwise no new unit tests (the removed `edge-glitch.test.ts` drops with its module).
- **At-rest byte-identical:** Playwright `getComputedStyle` — chrome labels show plain text, no ghost animation; grab layers pure translations; no `.dataBandClip` in the DOM anymore.
- **Visual / grab behavior:** on-device on `allmarks.app` (grab uses `setPointerCapture` → not scriptable). Primary acceptance gate; tune from feedback.

## 9. Out of scope / future

- Non-default-theme grab reactions (paper could get an ink-ripple analog later).
- Grab-velocity / distance-scaled intensity.
- A cursor-anchored ripple (Direction B) — parked; can layer on later if the UI reaction alone feels incomplete.
