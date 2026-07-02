# Board Edge Signal-Glitch — Design

**Date:** 2026-07-02 (session 148 続き)
**Status:** approved (brainstorming) — pending spec review
**Supersedes:** the halftone approach in `2026-07-02-board-edge-data-dissolve-design.md` (session 148, rejected on-device as "微妙"). Reuses its board scaffolding.

## 1. Goal & Scope

On the **default theme only**, while the user grab-wiggles the board (left-drag on empty space), the parts of cards that slide into the board's **outer edge band** show a **refined "bad TV reception" signal glitch** — chromatic RGB fringing + fine scanlines + a faint flicker — intensifying toward the very edge and recovering as the card is pulled back. The image degrades into signal noise at the boundary; it does **not** collapse or vanish.

This is the third attempt at an edge treatment (s147 raw glitch trio, s148 halftone — both rejected). The visual language is borrowed from the **first instant** of the existing CRT "tag-shutdown" animation ([lib/animation/tag-shutdown/themes/wave.module.css](../../../lib/animation/tag-shutdown/themes/wave.module.css) `lbebber-green`): the chromatic aberration + scanline + flicker onset. We deliberately **drop** the loud parts of that animation (green #28F100 flash, collapse-to-horizontal-line, shrink-to-dot, vanish).

**Non-goals (v1):** non-default themes; text/placeholder cards without a thumbnail (they simply don't glitch); a standalone tuning lab (user chose to tune directly on the board — case B); tying glitch intensity to grab velocity or a JS per-frame calc.

## 2. Behavior

- **At rest (no grab):** nothing from this feature is visible. The edge band overlay is `opacity:0` and draws nothing → the default board is **byte-identical** to before.
- **While grabbing:** the edge band reveals a per-card glitch overlay. A card portion at the very edge shows full glitch; the effect fades to nothing ~`--edge-band` (90px) inward via the band mask gradient (spatial depth ramp). The overlay pans in lockstep with the real cards, so it stays glued to each card as the world shifts under the grab.
- **On release:** the band's reveal fades out (existing 0.3s opacity transition); cards read solid again. Because the overlay pans with the cards, pulling a card out of the edge already removes its glitch (spatial), and releasing removes the whole band.
- **Reduced-motion:** grab-wiggle never engages under `prefers-reduced-motion` (so the band never reveals), and the flicker animation is additionally guarded with `@media (prefers-reduced-motion: reduce)` as belt-and-braces.

## 3. Architecture

Reuse the session-148 scaffolding wholesale; swap only the overlay's *content* (halftone shapes → CSS/SVG glitch):

- **Band clip + reveal + lockstep pan** — already built in `BoardRoot.tsx` / `BoardRoot.module.css` (`.dataBandClip` mask + `data-grabbing` reveal, `.dataLayer` with the exact cards-wrapper transform). **Unchanged**, except the boundary shimmer animation is replaced/retuned for the glitch (§4.3).
- **`dataCards` memo** — already computes per-visible-card rects (`{src, left, top, width, height}`) from `layout.positions[id]` (`.x/.y/.w/.h`, raw coords), default-theme-gated + viewport-culled. **Unchanged.** `src = item.thumbnail`; cards without a thumbnail are skipped.
- **`BoardDataLayer`** — maps `dataCards` → one overlay component per card. **Unchanged** except it renders `<CardGlitch>` instead of `<CardHalftone>`.
- **New `CardGlitch.tsx`** — replaces `CardHalftone.tsx`. Renders the card's thumbnail as an `<img>` at the card rect with the chromatic-aberration SVG filter applied, a scanline layer on top, and the flicker driven by CSS. **No canvas, no async rasterization, no cache** (it's declarative DOM/CSS; the browser reuses the decoded image).
- **New `GlitchFilterDefs.tsx`** — renders the inline `<svg><filter>` chromatic-aberration definition **once** in the board (default only). All `<CardGlitch>` images reference it via `filter: url(#am-edge-chromatic)`.
- **Removed:** `lib/board/halftone.ts`, `lib/board/halftone.test.ts`, `lib/board/halftone-canvas.ts`, `components/board/CardHalftone.tsx` (halftone-only; the branch is unmerged so this is a clean pivot, not a revert of shipped code).

### CORS

The glitch is pure **rendering compositing** (SVG filter + CSS gradients over an `<img>`); it never reads pixel data. So **cross-origin thumbnails (e.g. X) glitch identically to same-origin ones** — the s148 "readable vs. fallback" split disappears. `<img>` needs no `crossOrigin` attribute for this (and we omit it so no extra CORS preflight is required).

## 4. Glitch Rendering

### 4.1 Chromatic RGB split (SVG filter, CORS-free)

A single inline SVG filter, offset amount from a JS constant `EDGE_GLITCH.splitPx` (interpolated into the `feOffset dx`), so tuning is one number:

```
<filter id="am-edge-chromatic" x="-10%" y="-10%" width="120%" height="120%">
  <feColorMatrix type="matrix"
     values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
  <feOffset in="r" dx="{splitPx}" dy="0" result="ro"/>
  <feColorMatrix type="matrix"
     values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb"/>
  <feOffset in="gb" dx="{-splitPx}" dy="0" result="gbo"/>
  <feBlend in="ro" in2="gbo" mode="screen"/>
</filter>
```

Red channel offset one way, green+blue (cyan) the other, recombined with `screen` → the image is intact where aligned, with red/cyan fringes at contrast edges. Classic chromatic aberration, GPU-composited, no pixel read.

### 4.2 Scanlines

`CardGlitch`'s overlay pseudo-element: `repeating-linear-gradient(0deg, rgba(0,0,0,α) 0 1px, transparent 1px var(--edge-scan-period))`. Fine dark horizontal lines; period + alpha are CSS vars.

### 4.3 Flicker / interference (grab-only, reduced-motion-safe)

Subtle looping opacity oscillation on the glitch layer while `[data-grabbing]`, low amplitude (e.g. 0.9↔1.0). Optionally a faint slow vertical "roll" band (a soft gradient drifting down) — **off by default in v1**, added only if the user wants more life. Replaces the s148 `data-shimmer`. Guarded by `@media (prefers-reduced-motion: reduce) { animation: none }`.

### 4.4 Overlay image geometry

The overlay `<img>` fills the card rect (`width`/`height` from `dataCards`), `object-fit: cover`, matching how `ImageCard` renders the thumbnail, so the glitch copy aligns 1:1 with the real card underneath.

## 5. Parameters (subtle starting values — tune up on-device)

Per the agreed "start subtle" rule (past two attempts skewed loud). Exposed as a JS constant object `EDGE_GLITCH` + CSS custom properties so tuning is a few numbers:

| Param | Start | Meaning |
|-------|-------|---------|
| `splitPx` | **1.5** | chromatic offset (px) each direction; SVG `feOffset dx` |
| `--edge-scan-period` | **3px** | scanline repeat period |
| `--edge-scan-alpha` | **0.12** | scanline darkness |
| `--edge-flicker-min` | **0.9** | flicker opacity floor |
| `--edge-flicker-dur` | **0.5s** | flicker loop period |
| `--edge-band` | **90px** | band depth (existing s148 value) |
| glitch layer max opacity | **~0.85** | overall effect strength while revealed |

## 6. Files

| File | Change |
|------|--------|
| `components/board/CardGlitch.tsx` | **new** — per-card glitch overlay (`<img>` + chromatic filter + scanline + flicker) |
| `components/board/GlitchFilterDefs.tsx` | **new** — the inline SVG chromatic-aberration filter, rendered once (default only) |
| `components/board/BoardDataLayer.tsx` | **modify** — render `CardGlitch` instead of `CardHalftone` |
| `components/board/BoardRoot.tsx` | **modify** — render `GlitchFilterDefs` (default only); `dataCards` memo + band clip unchanged |
| `components/board/BoardRoot.module.css` | **modify (additive)** — glitch layer styles (scanline/flicker vars); retune the grab-only animation |
| `lib/board/edge-glitch.ts` | **new (small)** — `EDGE_GLITCH` params + any pure clamp/helper (unit-testable) |
| `components/board/CardHalftone.tsx`, `lib/board/halftone.ts`, `halftone.test.ts`, `halftone-canvas.ts` | **delete** — halftone approach dropped |

## 7. Invariants

- **default byte-identical at rest** — band `opacity:0`, additive CSS, default-theme gate, overlay draws nothing until grab. Verify with the s148 Playwright at-rest check (clip `opacity:0`, grab layers pure translations).
- **¥0 / server untouched / no network.**
- **default theme only** (`themeId === DEFAULT_THEME_ID` === `'dotted-notebook'`).
- **reduced-motion safe** (band never reveals; flicker guarded).
- **Pre-deploy gate:** `rtk tsc && rtk vitest run && rtk pnpm build` green. Deploy `--project-name=allmarks --branch=master`.

## 8. Testing

- **Pure logic** (`lib/board/edge-glitch.ts`): if a param clamp/helper exists, unit-test it. The glitch itself is declarative CSS/SVG → not meaningfully unit-testable (as with the halftone canvas).
- **At-rest byte-identical**: Playwright `getComputedStyle` (reuse s148 script) — `.dataBandClip` `opacity:0`, grab-layer transforms pure translations.
- **Visual / grab behavior**: on-device on `allmarks.app` (grab uses `setPointerCapture` → not scriptable). This is the primary acceptance gate; tune params from feedback.

## 9. Tuning loop (case B)

Deploy → user hard-reloads `allmarks.app` (default theme, board with card images) → grab-drag toward an edge → feedback on split amount / scanline / flicker / band depth → adjust `EDGE_GLITCH` + CSS vars → redeploy. Same loop that dialed in grab-wiggle. If iterations get painful, consider a `?glitch=` URL-query override for live tuning without redeploy (follows the existing `?bgtypo=` precedent) — **not built in v1**.
