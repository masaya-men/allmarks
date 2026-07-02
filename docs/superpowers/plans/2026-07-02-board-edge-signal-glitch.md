# Board Edge Signal-Glitch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the default theme, while grab-wiggling, card portions that slide into the board's outer edge show a refined "bad reception" signal glitch (chromatic RGB fringing + fine scanlines + faint flicker) instead of the rejected halftone.

**Architecture:** Reuse the session-148 scaffolding unchanged — the board-fixed edge-band clip, the per-card overlay layer that pans in lockstep with the cards, the `data-grabbing` reveal, the `dataCards` rect memo, and the at-rest byte-identical guarantee. Swap ONLY the overlay's content: each card's thumbnail is rendered as an `<img>` with an inline-SVG chromatic-aberration filter (`feColorMatrix` + `feOffset` — pure compositing, no pixel read, so cross-origin images glitch identically), a scanline pseudo-element, and a grab-gated flicker. Delete the halftone files.

**Tech Stack:** TypeScript (strict), React, inline SVG filters, CSS Modules, Vitest.

## Global Constraints

- **Scope: default theme only** — gate on `themeId === DEFAULT_THEME_ID` (`'dotted-notebook'`). Paper/grid excluded.
- **default byte-identical at rest** — edge band is `opacity:0` and draws nothing at rest; added DOM is invisible; **CSS edits are additive only** (no existing rule changed).
- **¥0 / server-untouched**; no network; the `<img>` uses NO `crossOrigin` attribute (the SVG filter needs no pixel read).
- **Reduced-motion**: grab-wiggle never sets `data-grabbing` under reduced-motion (band stays hidden); the flicker animation is ALSO guarded with `@media (prefers-reduced-motion: reduce)`.
- **Start subtle** (agreed): `splitPx` 1.5, scanline period 3px / alpha 0.12, flicker floor 0.9, band 90px, effect opacity 0.85 — tune UP on-device.
- **Pre-deploy gate**: `rtk tsc && rtk vitest run && rtk pnpm build` green (`tests/lib/channel.test.ts` is known-flaky → re-run once). Deploy `--project-name=allmarks --branch=master`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/board/edge-glitch.ts` (new) | PURE: `EdgeGlitchParams` type, `EDGE_GLITCH` defaults, `chromaticDx()`, `edgeGlitchStyleVars()`. No DOM. |
| `lib/board/edge-glitch.test.ts` (new) | Unit tests for the pure helpers. |
| `components/board/GlitchFilterDefs.tsx` (new) | Inline `<svg><filter>` chromatic-aberration def, rendered once. Exports `EDGE_GLITCH_FILTER_ID`. |
| `components/board/CardGlitch.tsx` (new) | One card's overlay: `<img>` at the card rect with the chromatic filter + scanline. |
| `components/board/CardGlitch.module.css` (new) | Overlay geometry, `object-fit`, scanline `::after`. |
| `components/board/BoardDataLayer.tsx` (modify) | Render `CardGlitch` instead of `CardHalftone`. |
| `components/board/BoardRoot.tsx` (modify) | Render `GlitchFilterDefs` (default only); set glitch CSS vars on `.dataBandClip`. `dataCards` + band clip unchanged. |
| `components/board/BoardRoot.module.css` (modify, additive) | Retune the grab-only animation to a flicker; tie reveal opacity to the param. |
| **DELETE**: `lib/board/halftone.ts`, `lib/board/halftone.test.ts`, `lib/board/halftone-canvas.ts`, `components/board/CardHalftone.tsx` | halftone approach dropped. |

---

## Task 1: Edge-glitch pure params + helpers

**Files:**
- Create: `lib/board/edge-glitch.ts`
- Test: `lib/board/edge-glitch.test.ts`

**Interfaces:**
- Produces:
  - `type EdgeGlitchParams = { splitPx:number; scanPeriodPx:number; scanAlpha:number; flickerMin:number; flickerDurSec:number; bandPx:number; maxOpacity:number }`
  - `const EDGE_GLITCH: EdgeGlitchParams`
  - `chromaticDx(splitPx:number): { red:number; cyan:number }`
  - `edgeGlitchStyleVars(p:EdgeGlitchParams): Record<string,string>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/board/edge-glitch.test.ts
import { describe, it, expect } from 'vitest'
import { EDGE_GLITCH, chromaticDx, edgeGlitchStyleVars } from './edge-glitch'

describe('EDGE_GLITCH defaults (subtle start)', () => {
  it('carries the agreed subtle starting values', () => {
    expect(EDGE_GLITCH.splitPx).toBe(1.5)
    expect(EDGE_GLITCH.scanPeriodPx).toBe(3)
    expect(EDGE_GLITCH.scanAlpha).toBe(0.12)
    expect(EDGE_GLITCH.flickerMin).toBe(0.9)
    expect(EDGE_GLITCH.bandPx).toBe(90)
    expect(EDGE_GLITCH.maxOpacity).toBe(0.85)
  })
})

describe('chromaticDx', () => {
  it('splits red one way and cyan the other', () => {
    expect(chromaticDx(1.5)).toEqual({ red: 1.5, cyan: -1.5 })
    expect(chromaticDx(0)).toEqual({ red: 0, cyan: -0 })
  })
})

describe('edgeGlitchStyleVars', () => {
  const vars = edgeGlitchStyleVars(EDGE_GLITCH)
  it('maps params to the CSS custom properties CardGlitch/BoardRoot read', () => {
    expect(vars['--edge-scan-period']).toBe('3px')
    expect(vars['--edge-scan-alpha']).toBe('0.12')
    expect(vars['--edge-flicker-min']).toBe('0.9')
    expect(vars['--edge-flicker-dur']).toBe('0.5s')
    expect(vars['--edge-band']).toBe('90px')
    expect(vars['--edge-glitch-opacity']).toBe('0.85')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/edge-glitch.test.ts`
Expected: FAIL — cannot resolve `./edge-glitch`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/board/edge-glitch.ts

/** Tuning for the default-theme edge signal-glitch. Start subtle (agreed); the
 *  values are dialed UP on-device via the deploy → grab → adjust loop. */
export type EdgeGlitchParams = {
  /** chromatic offset in px, applied +/- to red/cyan (SVG feOffset dx). */
  splitPx: number
  /** scanline repeat period (px). */
  scanPeriodPx: number
  /** scanline darkness (0..1). */
  scanAlpha: number
  /** flicker opacity floor (1 = no flicker). */
  flickerMin: number
  /** flicker loop period (seconds). */
  flickerDurSec: number
  /** perimeter band depth (px) — how far in from each edge the glitch reaches. */
  bandPx: number
  /** overall revealed strength while grabbing (0..1). */
  maxOpacity: number
}

export const EDGE_GLITCH: EdgeGlitchParams = {
  splitPx: 1.5,
  scanPeriodPx: 3,
  scanAlpha: 0.12,
  flickerMin: 0.9,
  flickerDurSec: 0.5,
  bandPx: 90,
  maxOpacity: 0.85,
}

/** Red channel offset one way, green+blue (cyan) the other — the two feOffset
 *  dx values that make the chromatic aberration. */
export function chromaticDx(splitPx: number): { red: number; cyan: number } {
  return { red: splitPx, cyan: -splitPx }
}

/** The CSS custom properties the glitch overlay + band clip read. Spread onto
 *  the .dataBandClip element so every descendant (scanline, flicker, reveal)
 *  reads a single source of tuning. */
export function edgeGlitchStyleVars(p: EdgeGlitchParams): Record<string, string> {
  return {
    '--edge-scan-period': `${p.scanPeriodPx}px`,
    '--edge-scan-alpha': `${p.scanAlpha}`,
    '--edge-flicker-min': `${p.flickerMin}`,
    '--edge-flicker-dur': `${p.flickerDurSec}s`,
    '--edge-band': `${p.bandPx}px`,
    '--edge-glitch-opacity': `${p.maxOpacity}`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/edge-glitch.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/edge-glitch.ts lib/board/edge-glitch.test.ts
rtk git commit -m "feat(board): edge-glitch pure params + chromatic/CSS-var helpers"
```

---

## Task 2: Chromatic-aberration SVG filter defs

**Files:**
- Create: `components/board/GlitchFilterDefs.tsx`

**Interfaces:**
- Consumes: `EDGE_GLITCH`, `chromaticDx` from `@/lib/board/edge-glitch`.
- Produces:
  - `const EDGE_GLITCH_FILTER_ID = 'am-edge-chromatic'`
  - `GlitchFilterDefs(): ReactElement` — an off-layout `<svg>` holding one `<filter>`.

**Verification:** SVG filter visual isn't unit-testable; verify with `rtk tsc` and the on-device check in Task 5.

- [ ] **Step 1: Write the implementation**

```tsx
// components/board/GlitchFilterDefs.tsx
'use client'
import { type ReactElement } from 'react'
import { EDGE_GLITCH, chromaticDx } from '@/lib/board/edge-glitch'

/** id referenced by CardGlitch's `filter: url(#…)`. Single source of truth. */
export const EDGE_GLITCH_FILTER_ID = 'am-edge-chromatic'

/** Renders ONCE on the default board. A zero-size, off-layout <svg> holding the
 *  chromatic-aberration filter: split the red channel one way and the cyan
 *  (green+blue) channel the other, then screen them back together — the image
 *  is intact where aligned, with red/cyan fringes at contrast edges. Pure
 *  compositing (no getImageData) → works on cross-origin thumbnails too. */
export function GlitchFilterDefs(): ReactElement {
  const { red, cyan } = chromaticDx(EDGE_GLITCH.splitPx)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id={EDGE_GLITCH_FILTER_ID}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="r"
          />
          <feOffset in="r" dx={red} dy="0" result="ro" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="gb"
          />
          <feOffset in="gb" dx={cyan} dy="0" result="gbo" />
          <feBlend in="ro" in2="gbo" mode="screen" />
        </filter>
      </defs>
    </svg>
  )
}
```

- [ ] **Step 2: Verify compile**

Run: `rtk tsc`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
rtk git add components/board/GlitchFilterDefs.tsx
rtk git commit -m "feat(board): chromatic-aberration SVG filter defs (CORS-free)"
```

---

## Task 3: CardGlitch overlay component

**Files:**
- Create: `components/board/CardGlitch.tsx`
- Create: `components/board/CardGlitch.module.css`

**Interfaces:**
- Consumes: `EDGE_GLITCH_FILTER_ID` from `./GlitchFilterDefs`.
- Produces: `CardGlitch` React component.
  - Props: `{ readonly src:string; readonly width:number; readonly height:number; readonly left:number; readonly top:number }`
  - Renders an absolutely-positioned overlay at `(left,top)` sized `width×height`: an `<img src>` (`object-fit:cover`, chromatic filter via inline `filter: url(#…)`) plus a scanline `::after`. `pointer-events:none`, `aria-hidden`.

**Verification:** DOM/SVG-filter render isn't unit-testable in jsdom; verified in Task 5. `rtk tsc` here.

- [ ] **Step 1: Write the CSS module**

```css
/* components/board/CardGlitch.module.css */
/* One card's edge-glitch overlay. Scanline + object-fit live here; the reveal
   (opacity) and flicker are owned by the band clip in BoardRoot.module.css. The
   --edge-scan-* vars cascade in from .dataBandClip (BoardRoot sets them). */
.overlay {
  position: absolute;
  overflow: hidden;
}
.img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  -webkit-user-select: none;
}
/* fine dark horizontal scanlines over the chromatic image */
.overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, var(--edge-scan-alpha, 0.12)) 0 1px,
    transparent 1px var(--edge-scan-period, 3px)
  );
}
```

- [ ] **Step 2: Write the component**

```tsx
// components/board/CardGlitch.tsx
'use client'
import { type ReactElement } from 'react'
import { EDGE_GLITCH_FILTER_ID } from './GlitchFilterDefs'
import styles from './CardGlitch.module.css'

/** A single card's edge signal-glitch overlay, positioned to sit exactly over
 *  the real card. The chromatic filter is applied inline (id single-sourced
 *  from GlitchFilterDefs); the scanline is in the CSS module; the flicker +
 *  reveal are on the band clip in BoardRoot. No canvas, no cache — the browser
 *  reuses the already-decoded thumbnail. */
export function CardGlitch({
  src,
  width,
  height,
  left,
  top,
}: {
  readonly src: string
  readonly width: number
  readonly height: number
  readonly left: number
  readonly top: number
}): ReactElement {
  return (
    <div
      className={styles.overlay}
      aria-hidden="true"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
      }}
    >
      <img
        className={styles.img}
        src={src}
        alt=""
        draggable={false}
        style={{ filter: `url(#${EDGE_GLITCH_FILTER_ID})` }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify compile**

Run: `rtk tsc`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/CardGlitch.tsx components/board/CardGlitch.module.css
rtk git commit -m "feat(board): CardGlitch overlay (chromatic img + scanlines)"
```

---

## Task 4: Swap the data layer to glitch + wire filter + retune animation + delete halftone

**Files:**
- Modify: `components/board/BoardDataLayer.tsx`
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/BoardRoot.module.css`
- Delete: `components/board/CardHalftone.tsx`, `lib/board/halftone.ts`, `lib/board/halftone.test.ts`, `lib/board/halftone-canvas.ts`

**Interfaces:**
- Consumes: `CardGlitch` (Task 3), `GlitchFilterDefs` + `EDGE_GLITCH_FILTER_ID` (Task 2), `EDGE_GLITCH` + `edgeGlitchStyleVars` (Task 1), existing `DataCardRect`, `dataCards`, `.dataBandClip`/`.dataLayer`, `DEFAULT_THEME_ID`, `grabWiggle`.

- [ ] **Step 1: Point BoardDataLayer at CardGlitch**

Replace the whole file:
```tsx
// components/board/BoardDataLayer.tsx
'use client'
import { type ReactElement } from 'react'
import { CardGlitch } from './CardGlitch'

export type DataCardRect = {
  readonly src: string
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Holds the pre-positioned edge-glitch overlay for each visible card, at the
 *  card's board coordinates. BoardRoot pans this layer in lockstep with the real
 *  cards and clips it to the edge band, so only card portions inside the band
 *  show the "bad reception" glitch. */
export function BoardDataLayer({ cards }: { readonly cards: ReadonlyArray<DataCardRect> }): ReactElement {
  return (
    <>
      {cards.map((c) => (
        <CardGlitch key={`${c.src}:${c.left},${c.top}`} src={c.src} left={c.left} top={c.top} width={c.width} height={c.height} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Import GlitchFilterDefs + params in BoardRoot**

In [components/board/BoardRoot.tsx](../../../components/board/BoardRoot.tsx), the existing import line is:
```ts
import { BoardDataLayer, type DataCardRect } from './BoardDataLayer'
```
Add directly after it:
```ts
import { GlitchFilterDefs } from './GlitchFilterDefs'
import { EDGE_GLITCH, edgeGlitchStyleVars } from '@/lib/board/edge-glitch'
```

- [ ] **Step 3: Set the glitch vars on the band clip + render the filter defs**

Find the existing default-theme band-clip block in BoardRoot's render (added in s148):
```tsx
            {themeId === DEFAULT_THEME_ID && (
              <div
                className={styles.dataBandClip}
                aria-hidden="true"
                data-grabbing={grabWiggle.grabbing ? '' : undefined}
              >
                <div
                  className={styles.dataLayer}
                  style={{
                    transform: `translate3d(calc(${horizontalOffset - viewport.x}px + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), calc(${BOARD_TOP_PAD_PX - viewport.y}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), 0)`,
                  }}
                >
                  <BoardDataLayer cards={dataCards} />
                </div>
              </div>
            )}
```
Replace it with (adds the tuning vars via `style` + renders the filter defs once):
```tsx
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
                      transform: `translate3d(calc(${horizontalOffset - viewport.x}px + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), calc(${BOARD_TOP_PAD_PX - viewport.y}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), 0)`,
                    }}
                  >
                    <BoardDataLayer cards={dataCards} />
                  </div>
                </div>
              </>
            )}
```
(`CSSProperties` is already imported at the top of BoardRoot.tsx — verify the import line `import { ... type CSSProperties } from 'react'` is present; it is.)

- [ ] **Step 4: Retune the grab-only animation in BoardRoot.module.css**

The s148 block ends with the shimmer keyframes. Change the reveal to honour the strength var, and replace `data-shimmer` with the subtler `edge-flicker`. Replace this existing block:
```css
.dataBandClip[data-grabbing] {
  opacity: 1;
}
```
with:
```css
.dataBandClip[data-grabbing] {
  opacity: var(--edge-glitch-opacity, 1);
}
```
Then replace the existing shimmer block:
```css
/* The band shimmers lightly while grabbing ... */
.dataBandClip[data-grabbing] .dataLayer {
  animation: data-shimmer 0.28s steps(3, end) infinite;
}
@keyframes data-shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.86; }
}
@media (prefers-reduced-motion: reduce) {
  .dataBandClip[data-grabbing] .dataLayer {
    animation: none;
  }
}
```
with:
```css
/* A faint flicker while grabbing so the signal reads as "live/unstable". Only
   under [data-grabbing] (grab-wiggle never sets that under reduced-motion), and
   the media guard below is a belt-and-braces stop. Floor + period are tunable
   via the --edge-flicker-* vars set on .dataBandClip. */
.dataBandClip[data-grabbing] .dataLayer {
  animation: edge-flicker var(--edge-flicker-dur, 0.5s) steps(2, end) infinite;
}
@keyframes edge-flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: var(--edge-flicker-min, 0.9); }
}
@media (prefers-reduced-motion: reduce) {
  .dataBandClip[data-grabbing] .dataLayer {
    animation: none;
  }
}
```

- [ ] **Step 5: Delete the halftone files**

```bash
rtk git rm components/board/CardHalftone.tsx lib/board/halftone.ts lib/board/halftone.test.ts lib/board/halftone-canvas.ts
```

- [ ] **Step 6: Verify compile + tests + build**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0; vitest green minus the known-flaky `channel.test.ts` (re-run once); the removed halftone tests are gone and `edge-glitch.test.ts` is green; build writes `out/`.

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/BoardDataLayer.tsx components/board/BoardRoot.tsx components/board/BoardRoot.module.css
rtk git commit -m "feat(board): edge signal-glitch replaces halftone (default theme)"
```

---

## Task 5: At-rest byte-identical check, deploy, on-device tune

**Files:** none (verification + deploy + tuning).

- [ ] **Step 1: At-rest byte-identical check (Playwright)**

Reuse the s148 approach: serve `out/`, load the default `/board`, assert via `getComputedStyle` that:
- `.dataBandClip` has `opacity: 0` at rest (invisible → byte-identical).
- the grab layers' transforms are pure translations (matches the grab-wiggle at-rest check).

Script (run from project root so it resolves the local `playwright`):
```js
// _at-rest-check.mjs — serve out/, load /board, read computed styles
import { chromium } from 'playwright'
import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { extname, join } from 'path'
const ROOT = process.argv[2]; const PORT = 4599
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon' }
async function resolve(p){ for (const c of [p, p+'.html', join(p,'index.html')]) { try { const s = await stat(c); if (s.isFile()) return c } catch {} } return null }
const server = createServer(async (req,res)=>{ try { const url = decodeURIComponent(req.url.split('?')[0]); const file = await resolve(join(ROOT, url==='/'?'/index.html':url)); if(!file){res.writeHead(404);res.end('nf');return} res.writeHead(200,{'content-type':MIME[extname(file)]??'application/octet-stream'}); res.end(await readFile(file)) } catch(e){ res.writeHead(500); res.end(String(e)) } })
await new Promise((r)=>server.listen(PORT,r))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport:{width:1489,height:679}, deviceScaleFactor:2 })
await page.goto(`http://localhost:${PORT}/board`, { waitUntil:'networkidle' })
await page.waitForTimeout(1500)
const result = await page.evaluate(()=>{ const clip=document.querySelector('[class*="dataBandClip"]'); const inter=document.querySelector('[data-interaction-layer]'); return { themeId:document.documentElement.getAttribute('data-theme-id'), clipPresent:!!clip, clipOpacity: clip?getComputedStyle(clip).opacity:'NONE', layerTransforms: inter?[...inter.children].map((c)=>getComputedStyle(c).transform).filter((t)=>t&&t!=='none'):[] } })
console.log(JSON.stringify(result,null,2))
await browser.close(); server.close()
```
Run:
```bash
rtk pnpm build
cp <scratchpad>/_at-rest-check.mjs ./_at-rest-check.mjs
node ./_at-rest-check.mjs "$(pwd)/out"; rm -f ./_at-rest-check.mjs
```
Expected: `themeId: "dotted-notebook"`, `clipOpacity: "0"`, layer transforms are `matrix(1,0,0,1,…)` pure translations. → default byte-identical. (Grab drag isn't scriptable — `setPointerCapture` — so the glitch itself is verified manually in Step 3.)

- [ ] **Step 2: Deploy**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 3: User manual verification on allmarks.app (default theme, needs card images)**

Ask the user to hard-reload, ensure the default theme + a board with card thumbnails, then grab-drag empty space toward an edge and confirm:
- card portions sliding into the edge band show a subtle chromatic fringe + scanlines (a "bad reception" look); the centre is unaffected.
- both X (cross-origin) and YouTube (same-origin) thumbnails glitch identically (no fallback split).
- pulling back / releasing recovers the solid card; nothing shows at rest.
- the flicker is faint, not strobing.
Collect feedback and tune `EDGE_GLITCH` in `lib/board/edge-glitch.ts` (split up for more fringe, scan period/alpha for scanline density, flicker floor/dur, band depth, max opacity). Redeploy per feedback.

- [ ] **Step 4: Update session docs + commit**

Update `docs/TODO.md`, `docs/TODO_COMPLETED.md`, `docs/CURRENT_GOAL.md`; commit.

---

## Self-Review (author checklist — completed)

- **Spec coverage**: §1 goal/scope → Tasks 4–5 (default gate, edge band reuse); §2 behaviour (at-rest / grabbing / release / reduced-motion) → Task 4 CSS + reused s148 clip; §3 architecture (reuse scaffolding, swap content, CORS-free, remove halftone) → Task 4; §4.1 chromatic SVG → Task 2; §4.2 scanline → Task 3 CSS; §4.3 flicker → Task 4 CSS; §4.4 geometry (object-fit cover) → Task 3; §5 params → Task 1 `EDGE_GLITCH` + Task 4 var wiring; §6 files → all tasks; §7 invariants → Global Constraints + Task 5 checks; §8 testing → Task 1 unit + Task 5 playwright/manual.
- **Placeholder scan**: none — full code in every code step; deletions listed explicitly; the Playwright script is inline in full.
- **Type consistency**: `EdgeGlitchParams`/`EDGE_GLITCH`/`chromaticDx`/`edgeGlitchStyleVars` consistent Tasks 1↔2↔4; `EDGE_GLITCH_FILTER_ID` defined Task 2, consumed Task 3; `DataCardRect` kept in BoardDataLayer (Task 1-swap) and consumed unchanged by BoardRoot's existing `dataCards`; `CardGlitch` props match BoardDataLayer usage.
- **byte-identical**: at-rest `.dataBandClip opacity:0`, additive CSS, default gate; verified Task 5 Step 1.
- **CSS var flow**: `edgeGlitchStyleVars` sets `--edge-*` on `.dataBandClip`; scanline (`CardGlitch.module.css`) and flicker/reveal (`BoardRoot.module.css`) read them via `var(...)` with in-CSS fallbacks so a missing var never breaks rendering.
```
