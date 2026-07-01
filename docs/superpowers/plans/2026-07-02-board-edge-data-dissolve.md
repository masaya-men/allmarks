# Board Edge Data-Dissolve (Halftone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the default theme, while grab-wiggling, the parts of cards that slide into the board's outer edge dissolve into a "Shapes Over Pixels" halftone (data), snapping back to solid cards on release.

**Architecture:** Each visible card's thumbnail is turned into a halftone canvas ONCE (cached), placed on a data layer that pans in lockstep with the real cards. A board-fixed clip masks that layer to a perimeter band and reveals it only while `data-grabbing`. So card portions entering the edge band show as shapes; nothing recomputes per frame. Cross-origin (unreadable) images fall back to generic neutral shapes.

**Tech Stack:** TypeScript (strict), React, Canvas 2D, Vitest (+ @testing-library/react). Pure cell math is unit-tested; canvas + DOM integration is verified via Playwright (`getComputedStyle`/element presence) + manual on-device (grab uses setPointerCapture → not scriptable).

## Global Constraints

- **Scope: default theme only** — gate on `themeId === 'dotted-notebook'` (`DEFAULT_THEME_ID`). Paper/grid excluded (v1).
- **default byte-identical**: at rest the data layer is `opacity:0` and draws nothing; added DOM is invisible; **no edits to existing `.module.css` rules — additive only**.
- **¥0 / server-untouched**; no network.
- **Reduced-motion**: the effect only shows while `data-grabbing`, which grab-wiggle never sets under reduced-motion — so it's inherently disabled there. Boundary shimmer must also be gated so it never animates under reduced-motion.
- **Look params (from `public/fx-lab.html`, user-tuned)**: resolution 8, sizeMultiplier 1.3, effectOpacity 0.94, bgImageOpacity 0.86, contrast 125, minBrightness 0, maxBrightness 0.66, blendMode 'lighter', 14 shapes.
- **jsdom has no canvas** (`getContext` returns null) → canvas code is NOT unit-testable; isolate pure math and test that.
- **Pre-deploy gate**: `rtk tsc && rtk vitest run && rtk pnpm build` green. Deploy `--project-name=allmarks --branch=master`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/board/halftone.ts` (new) | PURE math: params, brightness, visibility, deterministic shape pick, `computeHalftoneCells`. No DOM. |
| `lib/board/halftone.test.ts` (new) | Unit tests for the pure math. |
| `lib/board/halftone-canvas.ts` (new) | Canvas: `drawShape`, `renderHalftoneToCanvas`, `renderFallbackShapes`, `isImageReadable`. Uses Task 1. |
| `components/board/CardHalftone.tsx` (new) | One card's overlay: builds the halftone canvas from the card img (or fallback), positioned at the card rect. Cached. |
| `components/board/BoardDataLayer.tsx` (new) | The data layer: maps visible cards → `<CardHalftone>` at card positions; panned by BoardRoot. |
| `components/board/BoardRoot.tsx` (modify) | Mount `dataBandClip` (board-fixed, edge-band mask, reveal on grab) → `BoardDataLayer` (cards transform). Default-only. |
| `components/board/BoardRoot.module.css` (modify, additive) | `.dataBandClip` (mask + reveal), `.dataLayer`, boundary shimmer keyframes. |

---

## Task 1: Halftone pure core

**Files:**
- Create: `lib/board/halftone.ts`
- Test: `lib/board/halftone.test.ts`

**Interfaces:**
- Produces:
  - `type HalftoneParams = { resolution:number; sizeMultiplier:number; effectOpacity:number; bgImageOpacity:number; contrast:number; minBrightness:number; maxBrightness:number; blendMode:string }`
  - `const HALFTONE_PARAMS: HalftoneParams`
  - `type HalftoneCell = { x:number; y:number; size:number; r:number; g:number; b:number; shape:number }`
  - `pseudoRandom(x:number,y:number):number`
  - `pickShapeType(col:number,row:number):number`
  - `cellBrightness(r:number,g:number,b:number):number`
  - `isCellVisible(brightness:number, p:Pick<HalftoneParams,'minBrightness'|'maxBrightness'>):boolean`
  - `computeHalftoneCells(pixels:Uint8ClampedArray, gw:number, gh:number, res:number, p:HalftoneParams):HalftoneCell[]`

- [ ] **Step 1: Write the failing test**

```ts
// lib/board/halftone.test.ts
import { describe, it, expect } from 'vitest'
import {
  HALFTONE_PARAMS, pseudoRandom, pickShapeType, cellBrightness, isCellVisible, computeHalftoneCells,
} from './halftone'

describe('cellBrightness', () => {
  it('is 0 for black and ~1 for white', () => {
    expect(cellBrightness(0, 0, 0)).toBe(0)
    expect(cellBrightness(255, 255, 255)).toBeCloseTo(1, 5)
  })
  it('uses Rec.601 luma weights', () => {
    expect(cellBrightness(255, 0, 0)).toBeCloseTo(0.299, 3)
  })
})

describe('isCellVisible', () => {
  it('passes inside [min,max], rejects outside', () => {
    const p = { minBrightness: 0, maxBrightness: 0.66 }
    expect(isCellVisible(0.5, p)).toBe(true)
    expect(isCellVisible(0.66, p)).toBe(true)
    expect(isCellVisible(0.8, p)).toBe(false)
  })
})

describe('pseudoRandom / pickShapeType', () => {
  it('pseudoRandom is deterministic and in [0,1)', () => {
    const a = pseudoRandom(3, 7)
    expect(a).toBe(pseudoRandom(3, 7))
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
  })
  it('pickShapeType is an integer in 0..13, deterministic per cell', () => {
    const s = pickShapeType(5, 9)
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(13)
    expect(pickShapeType(5, 9)).toBe(s)
  })
})

describe('computeHalftoneCells', () => {
  // 2x1 grid: cell 0 = mid-grey (visible), cell 1 = white (brightness 1 > max → skipped)
  const px = new Uint8ClampedArray([120, 120, 120, 255, 255, 255, 255, 255])
  const cells = computeHalftoneCells(px, 2, 1, 8, HALFTONE_PARAMS)

  it('emits a cell only for the in-range pixel', () => {
    expect(cells).toHaveLength(1)
  })
  it('positions the cell at the grid centre and carries source colour', () => {
    const c = cells[0]
    expect(c.x).toBe(0 * 8 + 4)
    expect(c.y).toBe(0 * 8 + 4)
    expect([c.r, c.g, c.b]).toEqual([120, 120, 120])
  })
  it('sizes the cell by brightness*res*sizeMultiplier', () => {
    const b = 120 / 255 // ~0.4706 (grey → luma == value)
    expect(cells[0].size).toBeCloseTo(b * 8 * HALFTONE_PARAMS.sizeMultiplier, 5)
  })
  it('drops cells whose computed size is <= 0.5px', () => {
    const dark = new Uint8ClampedArray([4, 4, 4, 255]) // b≈0.0157 → size≈0.16 → dropped
    expect(computeHalftoneCells(dark, 1, 1, 8, HALFTONE_PARAMS)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/halftone.test.ts`
Expected: FAIL — cannot resolve `./halftone`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/board/halftone.ts

/** Tuning for the "Shapes Over Pixels" halftone. Defaults are the values the
 *  user dialed in via public/fx-lab.html. */
export type HalftoneParams = {
  resolution: number
  sizeMultiplier: number
  effectOpacity: number
  bgImageOpacity: number
  contrast: number
  minBrightness: number
  maxBrightness: number
  blendMode: string
}

export const HALFTONE_PARAMS: HalftoneParams = {
  resolution: 8,
  sizeMultiplier: 1.3,
  effectOpacity: 0.94,
  bgImageOpacity: 0.86,
  contrast: 125,
  minBrightness: 0,
  maxBrightness: 0.66,
  blendMode: 'lighter',
}

/** One shape to draw: centre, size, source colour, and which of the 14 shapes. */
export type HalftoneCell = {
  x: number
  y: number
  size: number
  r: number
  g: number
  b: number
  shape: number
}

/** Stable hash in [0,1) keyed on grid coords (from the reference pen). */
export function pseudoRandom(x: number, y: number): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
}

/** Deterministic shape id 0..13 for a grid cell. */
export function pickShapeType(col: number, row: number): number {
  return Math.floor(pseudoRandom(col, row) * 14)
}

/** Rec.601 relative luminance in [0,1]. */
export function cellBrightness(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Whether a cell's brightness is within the drawn band. */
export function isCellVisible(
  brightness: number,
  p: Pick<HalftoneParams, 'minBrightness' | 'maxBrightness'>,
): boolean {
  return brightness >= p.minBrightness && brightness <= p.maxBrightness
}

/** Turn a downsampled RGBA buffer (gw×gh, one pixel per grid cell) into the list
 *  of shapes to draw at full resolution. Pure — no canvas. */
export function computeHalftoneCells(
  pixels: Uint8ClampedArray,
  gw: number,
  gh: number,
  res: number,
  p: HalftoneParams,
): HalftoneCell[] {
  const cells: HalftoneCell[] = []
  for (let row = 0; row < gh; row++) {
    const y = row * res + res / 2
    for (let col = 0; col < gw; col++) {
      const i = (row * gw + col) * 4
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const brightness = cellBrightness(r, g, b)
      if (!isCellVisible(brightness, p)) continue
      const size = brightness * res * p.sizeMultiplier
      if (size <= 0.5) continue
      cells.push({ x: col * res + res / 2, y, size, r, g, b, shape: pickShapeType(col, row) })
    }
  }
  return cells
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/halftone.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/halftone.ts lib/board/halftone.test.ts
rtk git commit -m "feat(board): halftone pure core (cells/brightness/shape pick)"
```

---

## Task 2: Canvas renderer + readability probe

**Files:**
- Create: `lib/board/halftone-canvas.ts`

**Interfaces:**
- Consumes: `HALFTONE_PARAMS`, `HalftoneParams`, `computeHalftoneCells`, `HalftoneCell` from `./halftone`.
- Produces:
  - `isImageReadable(img: HTMLImageElement): boolean`
  - `drawShape(ctx: CanvasRenderingContext2D, type: number, x: number, y: number, size: number): void`
  - `renderHalftoneToCanvas(source: CanvasImageSource, w: number, h: number, params?: HalftoneParams): HTMLCanvasElement`
  - `renderFallbackShapes(w: number, h: number, params?: HalftoneParams, tint?: string): HTMLCanvasElement`

**Verification:** jsdom has no canvas, so no unit test. Verify with `rtk tsc` here; visual correctness is covered by the integrated Playwright + manual checks in Task 6 (and the algorithm already matches the validated `public/fx-lab.html`).

- [ ] **Step 1: Write the implementation**

```ts
// lib/board/halftone-canvas.ts
import { HALFTONE_PARAMS, computeHalftoneCells, type HalftoneParams } from './halftone'

/** True if the image's pixels can be read (same-origin or CORS-approved). A
 *  cross-origin image without CORS taints the canvas and getImageData throws. */
export function isImageReadable(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    const x = c.getContext('2d')
    if (!x) return false
    x.drawImage(img, 0, 0, 1, 1)
    x.getImageData(0, 0, 1, 1)
    return true
  } catch {
    return false
  }
}

function definePolygon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sides: number): void {
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
}
function defineStar(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, pts: number): void {
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = (Math.PI * i) / pts - Math.PI / 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
}

/** The 14 primitives from the reference pen. */
export function drawShape(ctx: CanvasRenderingContext2D, type: number, x: number, y: number, size: number): void {
  ctx.beginPath()
  const h = size / 2
  const q = size / 4
  switch (type) {
    case 0: ctx.arc(x, y, h, 0, Math.PI * 2); break
    case 1: ctx.rect(x - h, y - h, size, size); break
    case 2: ctx.moveTo(x, y - h); ctx.lineTo(x + h, y + h); ctx.lineTo(x - h, y + h); break
    case 3: ctx.moveTo(x - h, y - h); ctx.lineTo(x + h, y - h); ctx.lineTo(x, y + h); break
    case 4: ctx.rect(x - h, y - q, size, h); break
    case 5: ctx.rect(x - q, y - h, h, size); break
    case 6: ctx.moveTo(x, y - h); ctx.lineTo(x + h, y); ctx.lineTo(x, y + h); ctx.lineTo(x - h, y); break
    case 7: definePolygon(ctx, x, y, h, 5); break
    case 8: definePolygon(ctx, x, y, h, 6); break
    case 9: definePolygon(ctx, x, y, h, 8); break
    case 10: defineStar(ctx, x, y, h, h / 2.5, 5); break
    case 11: { const t = size / 6; ctx.rect(x - t, y - h, t * 2, size); ctx.rect(x - h, y - t, size, t * 2); break }
    case 12: ctx.arc(x, y, h, Math.PI, 0); ctx.closePath(); break
    case 13: ctx.arc(x, y, h, 0, Math.PI * 2); ctx.arc(x, y, h / 2, 0, Math.PI * 2, true); break
  }
  ctx.fill()
}

/** Render a source image/canvas as the halftone (faint original + shapes) into a
 *  fresh w×h canvas. Mirrors public/fx-lab.html. */
export function renderHalftoneToCanvas(
  source: CanvasImageSource,
  w: number,
  h: number,
  params: HalftoneParams = HALFTONE_PARAMS,
): HTMLCanvasElement {
  const res = Math.max(3, params.resolution | 0)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // faint original underneath (only where the band later reveals it)
  ctx.globalAlpha = params.bgImageOpacity
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = 1

  const gw = Math.ceil(canvas.width / res)
  const gh = Math.ceil(canvas.height / res)
  const off = document.createElement('canvas')
  off.width = gw
  off.height = gh
  const offctx = off.getContext('2d', { willReadFrequently: true })
  if (!offctx) return canvas
  offctx.filter = `contrast(${params.contrast}%)`
  offctx.drawImage(source, 0, 0, gw, gh)
  offctx.filter = 'none'
  const cells = computeHalftoneCells(offctx.getImageData(0, 0, gw, gh).data, gw, gh, res, params)

  ctx.globalAlpha = params.effectOpacity
  ctx.globalCompositeOperation = params.blendMode as GlobalCompositeOperation
  for (const c of cells) {
    ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`
    drawShape(ctx, c.shape, c.x, c.y, c.size)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  return canvas
}

/** For unreadable (cross-origin) images: a generic neutral shape field driven by
 *  a deterministic pseudo-brightness so it still reads as "dissolving to data". */
export function renderFallbackShapes(
  w: number,
  h: number,
  params: HalftoneParams = HALFTONE_PARAMS,
  tint = '210,245,255',
): HTMLCanvasElement {
  const res = Math.max(3, params.resolution | 0)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const gw = Math.ceil(canvas.width / res)
  const gh = Math.ceil(canvas.height / res)
  // Synthesize a downsampled buffer of neutral pixels at a deterministic pseudo
  // brightness per cell, then reuse the same cell math for identical feel.
  const px = new Uint8ClampedArray(gw * gh * 4)
  for (let row = 0; row < gh; row++) {
    for (let col = 0; col < gw; col++) {
      const b = 40 + Math.floor(120 * Math.abs(Math.sin(col * 1.7 + row * 2.3)))
      const i = (row * gw + col) * 4
      px[i] = b; px[i + 1] = b; px[i + 2] = b; px[i + 3] = 255
    }
  }
  const cells = computeHalftoneCells(px, gw, gh, res, params)
  ctx.globalAlpha = params.effectOpacity
  ctx.globalCompositeOperation = params.blendMode as GlobalCompositeOperation
  const [tr, tg, tb] = tint.split(',')
  for (const c of cells) {
    const k = (c.r / 255) // 0..1 pseudo-brightness → modulate tint alpha
    ctx.fillStyle = `rgba(${tr},${tg},${tb},${0.5 + 0.5 * k})`
    drawShape(ctx, c.shape, c.x, c.y, c.size)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  return canvas
}
```

- [ ] **Step 2: Verify compile**

Run: `rtk tsc`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
rtk git add lib/board/halftone-canvas.ts
rtk git commit -m "feat(board): halftone canvas renderer + CORS readability probe"
```

---

## Task 3: CardHalftone overlay component

**Files:**
- Create: `components/board/CardHalftone.tsx`

**Interfaces:**
- Consumes: `renderHalftoneToCanvas`, `renderFallbackShapes`, `isImageReadable` from `@/lib/board/halftone-canvas`.
- Produces: `CardHalftone` React component.
  - Props: `{ readonly src: string; readonly width: number; readonly height: number; readonly left: number; readonly top: number }`
  - Renders an absolutely-positioned `<img>` (the generated halftone canvas → dataURL) at `(left, top)` sized `width×height`, `pointer-events:none`, `aria-hidden`. Generates ONCE per `(src,width,height)` and caches the dataURL in a module `Map`.

**Verification:** React canvas gen isn't unit-testable in jsdom; verified in Task 6 integration (element appears; on-device the shapes show). `rtk tsc` here.

- [ ] **Step 1: Write the implementation**

```tsx
// components/board/CardHalftone.tsx
'use client'
import { useEffect, useState, type ReactElement } from 'react'
import { renderHalftoneToCanvas, renderFallbackShapes, isImageReadable } from '@/lib/board/halftone-canvas'

// Cache generated halftones by source + rounded size so a card is only ever
// rasterized once (re-used across re-renders and grabs).
const CACHE = new Map<string, string>()

function keyOf(src: string, w: number, h: number): string {
  return `${src}@${Math.round(w)}x${Math.round(h)}`
}

/** A single card's pre-rendered halftone, positioned to overlay the real card.
 *  Generates lazily (once) after the source image loads; falls back to generic
 *  neutral shapes for cross-origin images whose pixels can't be read. */
export function CardHalftone({
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
}): ReactElement | null {
  const [url, setUrl] = useState<string | null>(() => CACHE.get(keyOf(src, width, height)) ?? null)

  useEffect(() => {
    const k = keyOf(src, width, height)
    const cached = CACHE.get(k)
    if (cached) { setUrl(cached); return }
    if (width < 2 || height < 2) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = (): void => {
      if (cancelled) return
      const canvas = isImageReadable(img)
        ? renderHalftoneToCanvas(img, width, height)
        : renderFallbackShapes(width, height)
      const out = canvas.toDataURL('image/png')
      CACHE.set(k, out)
      if (!cancelled) setUrl(out)
    }
    img.onerror = (): void => {
      if (cancelled) return
      const out = renderFallbackShapes(width, height).toDataURL('image/png')
      CACHE.set(k, out)
      if (!cancelled) setUrl(out)
    }
    img.src = src
    return (): void => { cancelled = true }
  }, [src, width, height])

  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}
```

- [ ] **Step 2: Verify compile**

Run: `rtk tsc`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
rtk git add components/board/CardHalftone.tsx
rtk git commit -m "feat(board): CardHalftone overlay (cached per-card halftone)"
```

---

## Task 4: BoardDataLayer (visible cards → overlays)

**Files:**
- Create: `components/board/BoardDataLayer.tsx`

**Interfaces:**
- Consumes: `CardHalftone`; the same layout inputs BoardRoot already computes (`layout.positions`, `filteredItems`, `viewport`, `cardWidthPx`/custom widths, `itemSkylineHeight`).
- Produces: `BoardDataLayer` component.
  - Props: `{ readonly cards: ReadonlyArray<{ src: string; left: number; top: number; width: number; height: number }> }`
  - Renders one `<CardHalftone>` per card. Pure presentational (BoardRoot computes the rects so this stays testable-by-inspection and BoardRoot owns the single source of layout truth).

**Verification:** `rtk tsc`; behaviour verified in Task 6.

- [ ] **Step 1: Write the implementation**

```tsx
// components/board/BoardDataLayer.tsx
'use client'
import { type ReactElement } from 'react'
import { CardHalftone } from './CardHalftone'

export type DataCardRect = {
  readonly src: string
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Holds the pre-rendered halftone overlay for each visible card, at the card's
 *  board coordinates. BoardRoot pans this layer in lockstep with the real cards
 *  and clips it to the edge band, so only card portions inside the band show. */
export function BoardDataLayer({ cards }: { readonly cards: ReadonlyArray<DataCardRect> }): ReactElement {
  return (
    <>
      {cards.map((c) => (
        <CardHalftone key={`${c.src}:${c.left},${c.top}`} src={c.src} left={c.left} top={c.top} width={c.width} height={c.height} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Verify compile + commit**

Run: `rtk tsc`
Expected: 0 errors.

```bash
rtk git add components/board/BoardDataLayer.tsx
rtk git commit -m "feat(board): BoardDataLayer maps visible cards to halftone overlays"
```

---

## Task 5: Wire the band clip + data layer into BoardRoot (default only)

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/BoardRoot.module.css` (additive)

**Interfaces:**
- Consumes: `BoardDataLayer`, `DataCardRect`; existing `grabWiggle`, `themeId`, `DEFAULT_THEME_ID`, `filteredItems`, `layout.positions`, `viewport`, `horizontalOffset`, `BOARD_TOP_PAD_PX`, `GRAB_LAYER_WEIGHTS`, per-card widths, `itemSkylineHeight`.

Notes on existing values (verified):
- Cards wrapper transform ([BoardRoot.tsx](../../../components/board/BoardRoot.tsx) cards layer): `translate3d(calc(${horizontalOffset - viewport.x}px + var(--grab-x,0px) * ${GRAB_LAYER_WEIGHTS.cards}), calc(${BOARD_TOP_PAD_PX - viewport.y}px + var(--grab-y,0px) * ${GRAB_LAYER_WEIGHTS.cards}), 0)`.
- `data-grabbing` is NOT currently on `.canvas` (it was removed). Re-add it — it gates the reveal.
- Card thumbnail src: derive from each item's stored thumbnail (`item.thumbnailUrl ?? item.imageUrl`); skip items with no image in v1 (they simply don't dissolve).

- [ ] **Step 1: Add imports + re-add `data-grabbing`**

Add near the other board imports:
```ts
import { BoardDataLayer, type DataCardRect } from './BoardDataLayer'
```
On the `.canvas` element, re-add the grab flag (used only by the new CSS):
```tsx
        data-grabbing={grabWiggle.grabbing ? '' : undefined}
```

- [ ] **Step 2: Build the visible-card rect list (default theme only)**

Add near the other memos (after `layout` is available). Use the SAME rect math the cards use so overlays align 1:1:
```ts
  // Pre-rendered halftone overlays only exist on the default theme, and only for
  // cards that (a) are within the viewport-cull window and (b) have a thumbnail.
  const dataCards = useMemo<ReadonlyArray<DataCardRect>>(() => {
    if (themeId !== DEFAULT_THEME_ID) return []
    const out: DataCardRect[] = []
    for (const item of filteredItems) {
      const pos = layout.positions.get(item.bookmarkId)
      if (!pos) continue
      const src = item.thumbnailUrl ?? item.imageUrl
      if (!src) continue
      const width = pos.width
      const height = pos.height
      // cull to a viewport buffer so we don't rasterize the whole board
      const cardTop = BOARD_TOP_PAD_PX + pos.y - viewport.y
      if (cardTop + height < -200 || cardTop > viewport.h + 200) continue
      out.push({ src, left: horizontalOffset + pos.x, top: BOARD_TOP_PAD_PX + pos.y, width, height })
    }
    return out
  }, [themeId, filteredItems, layout.positions, viewport.y, viewport.h, horizontalOffset])
```
(If `layout.positions` entries don't carry `width`/`height`, use the same width source the cards layer uses — the resolved per-card width — and `itemSkylineHeight(item, width)` for height. Match the cards layer exactly; do not invent new numbers.)

- [ ] **Step 3: Render the band clip + data layer (default only), inside `.canvas`**

Place this as a child of `.canvas`, AFTER `canvasWrap` in DOM so it sits above the cards but below the top chrome (z from CSS). It must pan with the same transform as the cards wrapper:
```tsx
        {themeId === DEFAULT_THEME_ID && (
          <div className={styles.dataBandClip} aria-hidden="true">
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

- [ ] **Step 4: Add CSS (additive) to BoardRoot.module.css**

```css
/* Default-theme "edge data-dissolve": card portions that slide into the board's
   outer edge show as a pre-rendered halftone (data). The clip is board-fixed and
   masks everything except a soft perimeter band; the inner dataLayer pans with
   the cards. Revealed only while grabbing → default board byte-identical at rest.
   The band depth is --edge-band (default 90px). */
.dataBandClip {
  position: absolute;
  inset: 0;
  border-radius: var(--canvas-radius);
  pointer-events: none;
  z-index: 84; /* above cards, below the top/bottom scrims (80? keep under chrome 110) */
  opacity: 0;
  transition: opacity 0.3s ease;
  --edge-band: 90px;
  /* opaque only within --edge-band of each side, soft falloff inward */
  -webkit-mask:
    linear-gradient(to right, #000 0, transparent var(--edge-band)),
    linear-gradient(to left, #000 0, transparent var(--edge-band)),
    linear-gradient(to bottom, #000 0, transparent var(--edge-band)),
    linear-gradient(to top, #000 0, transparent var(--edge-band));
  -webkit-mask-composite: source-over;
  mask:
    linear-gradient(to right, #000 0, transparent var(--edge-band)),
    linear-gradient(to left, #000 0, transparent var(--edge-band)),
    linear-gradient(to bottom, #000 0, transparent var(--edge-band)),
    linear-gradient(to top, #000 0, transparent var(--edge-band));
  mask-composite: add;
}
.canvas[data-grabbing] .dataBandClip {
  opacity: 1;
}
.dataLayer {
  position: absolute;
  inset: 0;
  will-change: transform;
}
```

- [ ] **Step 5: Verify compile + tests + build**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0; vitest green (`channel.test.ts` may be flaky → re-run once); build writes `out/`.

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/BoardRoot.module.css
rtk git commit -m "feat(board): edge data-dissolve band clip + data layer (default theme)"
```

---

## Task 6: Boundary shimmer, verify byte-identical, deploy, manual tune

**Files:**
- Modify: `components/board/BoardRoot.module.css` (additive — shimmer)

- [ ] **Step 1: Add a light boundary shimmer (grab-only, reduced-motion-safe)**

```css
/* The outermost sliver of the band shimmers lightly while grabbing so the
   boundary "agitates" as the data churns. Only runs under [data-grabbing];
   grab-wiggle never sets that under reduced-motion, so this stays still there. */
.canvas[data-grabbing] .dataLayer {
  animation: data-shimmer 0.28s steps(3, end) infinite;
}
@keyframes data-shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.86; }
}
```

- [ ] **Step 2: At-rest byte-identical check (Playwright)**

Serve the build; on the **default** board with no interaction, assert via `getComputedStyle`:
- `.dataBandClip` has `opacity: 0` (invisible at rest).
- the three grab layers' transforms are still pure translations (matches the existing grab-wiggle at-rest check).
Expected: at rest nothing from this feature is visible → default byte-identical. Note the grab drag itself is not scriptable (setPointerCapture); the dissolve is verified manually in Step 4.

- [ ] **Step 3: Deploy**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 4: User manual verification on allmarks.app (default theme, needs cards)**

Ask the user to hard-reload, ensure the default theme + a board with card images, then grab-drag empty space toward an edge and confirm:
- card portions sliding into the edge band show the halftone shapes; centre of board unaffected.
- releasing snaps back to solid cards.
- cross-origin thumbnails (e.g. X) show generic neutral shapes (fallback), readable ones (e.g. YouTube) show coloured shapes.
- boundary shimmers lightly; nothing at rest.
Collect feedback on `--edge-band` depth, `HALFTONE_PARAMS`, shimmer — tune in `lib/board/halftone.ts` / the CSS.

- [ ] **Step 5: Update session docs + commit**

Update `docs/TODO.md`, `docs/TODO_COMPLETED.md`, `docs/CURRENT_GOAL.md`; commit.

---

## Self-Review (author checklist — completed)

- **Spec coverage**: §1 scope/behaviour → Tasks 5–6; §2 params → Task 1 `HALFTONE_PARAMS`; §3.1 layers → Task 5; §3.2 generation + readability + fallback → Tasks 2–3; §3.3 boundary shimmer → Task 6; §3.4 perf (cache/cull) → Task 3 cache + Task 5 cull; §4 constraints (reduced-motion/byte-identical/CORS/theme gate) → Tasks 5–6 + gates; §5 tests → Task 1 unit + Task 6 playwright/manual; §6 out-of-scope → not built (documented).
- **Placeholder scan**: none — full code in every code step. The one conditional ("if positions lack width/height, use the cards' width source + itemSkylineHeight") names the exact existing helpers to use, not a vague TODO.
- **Type consistency**: `HalftoneParams`/`HALFTONE_PARAMS`/`computeHalftoneCells`/`HalftoneCell` consistent across Tasks 1–2; `DataCardRect` defined in Task 4, consumed in Task 5; `CardHalftone` props match Task 4 usage; `isImageReadable`/`renderHalftoneToCanvas`/`renderFallbackShapes` names consistent Tasks 2–3.
- **Testability honesty**: canvas/DOM isn't unit-testable in jsdom (documented); pure core is fully tested (Task 1); integration via Playwright + manual (Task 6).
- **byte-identical**: at-rest `.dataBandClip opacity:0`, additive CSS only, default-theme gate; verified Task 6 Step 2.
