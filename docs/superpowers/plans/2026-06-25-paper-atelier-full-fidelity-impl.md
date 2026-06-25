# paper-atelier Full-Fidelity (Asset-Driven) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the paper-atelier theme's CSS/SVG *pseudo* surfaces (Plan 2) with real GPT-generated paper PNG assets — card mats, washi/pin/clip/photo-corner/stamp decorations, the ruler scroll-meter strip + paper thumb, the letterpress wordmark grain, and the MK-1 plate + wax seal — so every face matches the mockup's physical-paper texture, while the default (black + sound-wave) theme stays byte-identical and every face degrades gracefully when its PNG is absent.

**Architecture:** A small TS **asset manifest** (`lib/board/paper-assets.ts`) is the single source of truth for *which* paper PNGs are currently placed under `public/themes/paper-atelier/`. Components consult the manifest to decide "real PNG" vs "fall back to the existing Plan 2 CSS look", deterministically picking variants by `card.id`. Asset URLs are injected into CSS via paper-scoped custom properties (`--asset-*`), so default theme resolves them to `none`/fallback and never sees a paper byte. No new always-on canvas/GPU/backdrop-filter; PNGs are static, shared-decode, and `pointer-events:none`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vanilla CSS + CSS Modules + CSS custom properties, vitest + @testing-library/react (jsdom), sharp (asset slicing, already used), GSAP/Web Animations (existing motion registry). No Tailwind, no Framer Motion.

## Global Constraints

- **default byte-identical**: every paper token/asset URL is defined ONLY under `html[data-theme-id="paper-atelier"]` (globals.css 434–550) and consumed via `var(--token, <default>)`. Default theme (`dotted-notebook`/`grid-paper`) must resolve every paper token to its non-paper fallback. Decorations/plate/seal mount only when `getThemeMeta(themeId).decorations === true` / `themeId === 'paper-atelier'`.
- **graceful degradation**: a face whose PNG is NOT in the manifest renders the current Plan 2 CSS/SVG look. Placing a PNG + manifest entry is what turns a face "real". Missing/404 PNG must never break layout.
- **非干渉 (no interference)**: card outer box (the masonry rect = FLIP origin = the `position:absolute` wrapper in `CardsLayer`, and `CardNode` `.cardNode`) dimensions are never changed. Mats, photo insets, captions live INSIDE `ImageCard`'s `.imageCard` box. Decorations stay siblings of `CardNode` with `pointer-events:none; overflow:visible`. Lightbox FLIP targets the outer box and must stay unaffected.
- **perf**: no always-on canvas/GPU/backdrop-filter (board is fill-rate bound at 4K). PNGs are static, sized small, and shared (same URL = one decode). No per-frame paint added.
- **reduced-motion / motionEnabled**: all motion stays behind the existing 3-layer gate (`prefers-reduced-motion` + `motionEnabled` IDB toggle + context flag). New ink/hover motion respects it.
- **determinism**: mats, decorations, stamps, variant picks are seeded by `card.id` via the existing FNV-1a + mulberry32 in `paper-decorations.ts` — stable across re-render/reorder/reload.
- **i18n**: chrome labels stay ALL-CAPS English; the card caption is the bookmark's own `item.title` (user data, no translation). No new translatable copy is introduced; if any appears, sync all 15 message files.
- **Asset id ↔ file**: assets are staged in `docs/private/theme-mockups/_sliced/` (gitignored) and copied to `public/themes/paper-atelier/<id>.png` (tracked). Authoritative ids: `parchment-bg`, `card-mat-1`,`card-mat-2`,`card-mat-3`,`card-mat-aged`, `washi-tape-1..5`, `push-pin-gold`,`push-pin-green`, `paper-clip`, `photo-corner-1..4`, `stamp-circular`,`stamp-rect`,`stamp-oval`, `wax-seal-a`, `mk1-plate`, `ruler-meter-strip`(+`-2`), `ruler-meter-thumb`(+`-2`), `deckle-edge-mat`, `paper-foxing-overlay`.
- **Pre-deploy gate**: `rtk tsc && rtk vitest run && rtk pnpm build` must pass (known flaky: `tests/lib/channel.test.ts` — re-run once if it alone fails). Deploy via `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true` (ASCII `--commit-message`). Prod = `allmarks.app`.
- **Approved design decisions (spec §6, confirmed in CURRENT_GOAL)**: ① cards DO get a serif signature caption (bookmark `item.title`). ② chrome buttons → Fraunces serif (small-caps feel); hint/notes → Caveat handwriting. ③ paper chrome motion: RGB glitch/scramble REMOVED → gentle ink bleed/fade. ④ meter state-differences (hover lift / drag ink / inertia / end-stop) are a later polish phase; slice 1 = asset swap + basic motion.

---

## File Structure

**New files**
- `lib/board/paper-assets.ts` — asset manifest + helpers (`PAPER_ASSETS`, `hasPaperAsset`, `paperAssetUrl`, `pickPaperAsset`). One responsibility: know what's placed and resolve URLs/variants.
- `lib/board/paper-assets.test.ts` — manifest + helper unit tests.
- `public/themes/paper-atelier/*.png` — the placed assets (copied from `_sliced/`).

**Modified files**
- `app/globals.css` — add `--asset-*` paper-scoped tokens (paper block, ~434–550) + paper chrome font tokens + ink-motion tokens.
- `components/board/themes.module.css` — `.paperAtelier` background: parchment PNG layer.
- `components/board/decorations/paper-decorations.ts` — extend `CardDecorationSet` with deterministic variant indices (tape/mat/stamp/pin).
- `components/board/decorations/PaperCardDecorations.tsx` + `.module.css` — render real PNGs when available, CSS fallback when not.
- `components/board/cards/ImageCard.tsx` + `.module.css` — paper-only internal layout: mat backing + photo inset + serif caption.
- `components/board/scrollmeter/RulerTrack.tsx` + `.module.css` — paper-strip track background + paper-thumb marker.
- `components/board/ChromeButton.tsx` + `.module.css` — paper branch: serif font + ink motion instead of glitch.
- `components/board/BoardBackgroundTypography.module.css` — wordmark grain from real letterpress PNG (when placed).
- `components/board/chrome/PaperFramePlate.module.css` + `components/board/chrome/PaperWaxSeal.tsx`/`.module.css` — back with PNGs when placed, CSS/SVG fallback otherwise.

---

## Task 1: Paper asset foundation (manifest + placed PNGs)

Builds the single source of truth for placed assets and the deterministic variant pickers everything else consumes. After this task, no visual change yet — just infrastructure + the files on disk.

**Files:**
- Create: `lib/board/paper-assets.ts`
- Create: `lib/board/paper-assets.test.ts`
- Create: `public/themes/paper-atelier/*.png` (copied from `docs/private/theme-mockups/_sliced/`)

**Interfaces:**
- Produces:
  - `type PaperAssetId` — string union of all authoritative ids (see Global Constraints).
  - `const PAPER_ASSET_BASE = '/themes/paper-atelier'`
  - `const PAPER_ASSETS: Readonly<Record<PaperAssetId, boolean>>` — `true` iff the PNG is placed/usable.
  - `function hasPaperAsset(id: PaperAssetId): boolean`
  - `function paperAssetUrl(id: PaperAssetId): string | null` — `/themes/paper-atelier/<id>.png` when placed, else `null`.
  - `function pickPaperAsset(seedFraction: number, ids: readonly PaperAssetId[]): PaperAssetId | null` — pick the first *placed* id from a candidate list using a 0..1 fraction (deterministic); `null` if none placed.

- [ ] **Step 1: Copy staged PNGs into the public theme dir**

Run (Git Bash):
```bash
cd "/c/Users/masay/Desktop/マイコラージュ"
mkdir -p public/themes/paper-atelier
D="docs/private/theme-mockups/_sliced"
P="public/themes/paper-atelier"
for f in card-mat-1 card-mat-2 card-mat-3 card-mat-aged \
         washi-tape-1 washi-tape-2 washi-tape-3 washi-tape-4 washi-tape-5 \
         push-pin-gold push-pin-green paper-clip \
         photo-corner-1 photo-corner-2 photo-corner-3 photo-corner-4 \
         stamp-circular stamp-rect stamp-oval wax-seal-a mk1-plate \
         ruler-meter-strip ruler-meter-strip-2 ruler-meter-thumb ruler-meter-thumb-2 \
         deckle-edge-mat paper-foxing-overlay; do
  cp "$D/$f.png" "$P/$f.png"
done
ls "$P"
```
Expected: all listed `.png` files present in `public/themes/paper-atelier/` (plus the pre-existing `fiber.svg`). `parchment-bg.png` is intentionally NOT copied yet (pending final slice — Task 2 handles its absence).

- [ ] **Step 2: Write the failing manifest test**

Create `lib/board/paper-assets.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  PAPER_ASSET_BASE,
  PAPER_ASSETS,
  hasPaperAsset,
  paperAssetUrl,
  pickPaperAsset,
} from './paper-assets'

describe('paper-assets manifest', () => {
  it('resolves a placed asset to its public URL', () => {
    expect(hasPaperAsset('card-mat-1')).toBe(true)
    expect(paperAssetUrl('card-mat-1')).toBe(`${PAPER_ASSET_BASE}/card-mat-1.png`)
  })

  it('returns null url for an un-placed asset (parchment-bg pending)', () => {
    expect(hasPaperAsset('parchment-bg')).toBe(false)
    expect(paperAssetUrl('parchment-bg')).toBeNull()
  })

  it('pickPaperAsset is deterministic for a given fraction and skips un-placed ids', () => {
    const ids = ['card-mat-1', 'card-mat-2', 'card-mat-3'] as const
    const a = pickPaperAsset(0.1, ids)
    const b = pickPaperAsset(0.1, ids)
    expect(a).toBe(b)
    expect(ids).toContain(a)
  })

  it('pickPaperAsset returns null when no candidate is placed', () => {
    // parchment-bg is the only un-placed id; a list of only it must yield null
    expect(pickPaperAsset(0.5, ['parchment-bg'])).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/board/paper-assets.test.ts`
Expected: FAIL — `Cannot find module './paper-assets'`.

- [ ] **Step 4: Implement the manifest**

Create `lib/board/paper-assets.ts`:
```typescript
/**
 * Single source of truth for which paper-atelier raster assets are CURRENTLY
 * placed under public/themes/paper-atelier/. Components consult this to decide
 * "use the real PNG" vs "fall back to the Plan 2 CSS/SVG look" (graceful
 * degradation — spec §2). Flip an entry to `true` the moment its <id>.png is
 * committed under public/themes/paper-atelier/.
 *
 * Keep this list in sync with the files on disk; the asset id IS the filename
 * stem (e.g. 'card-mat-1' -> /themes/paper-atelier/card-mat-1.png).
 */
export const PAPER_ASSET_BASE = '/themes/paper-atelier'

export type PaperAssetId =
  | 'parchment-bg'
  | 'card-mat-1' | 'card-mat-2' | 'card-mat-3' | 'card-mat-aged'
  | 'washi-tape-1' | 'washi-tape-2' | 'washi-tape-3' | 'washi-tape-4' | 'washi-tape-5'
  | 'push-pin-gold' | 'push-pin-green' | 'paper-clip'
  | 'photo-corner-1' | 'photo-corner-2' | 'photo-corner-3' | 'photo-corner-4'
  | 'stamp-circular' | 'stamp-rect' | 'stamp-oval'
  | 'wax-seal-a' | 'mk1-plate'
  | 'ruler-meter-strip' | 'ruler-meter-strip-2'
  | 'ruler-meter-thumb' | 'ruler-meter-thumb-2'
  | 'deckle-edge-mat' | 'paper-foxing-overlay'

/** `true` = the PNG is committed and usable. `false` = not placed yet; the
 *  consuming face must degrade to its CSS/SVG fallback. */
export const PAPER_ASSETS: Readonly<Record<PaperAssetId, boolean>> = {
  'parchment-bg': false, // pending final slice (Task 2)
  'card-mat-1': true, 'card-mat-2': true, 'card-mat-3': true, 'card-mat-aged': true,
  'washi-tape-1': true, 'washi-tape-2': true, 'washi-tape-3': true,
  'washi-tape-4': true, 'washi-tape-5': true,
  'push-pin-gold': true, 'push-pin-green': true, 'paper-clip': true,
  'photo-corner-1': true, 'photo-corner-2': true, 'photo-corner-3': true, 'photo-corner-4': true,
  'stamp-circular': true, 'stamp-rect': true, 'stamp-oval': true,
  'wax-seal-a': true, 'mk1-plate': true,
  'ruler-meter-strip': true, 'ruler-meter-strip-2': true,
  'ruler-meter-thumb': true, 'ruler-meter-thumb-2': true,
  'deckle-edge-mat': true, 'paper-foxing-overlay': true,
}

export function hasPaperAsset(id: PaperAssetId): boolean {
  return PAPER_ASSETS[id] === true
}

export function paperAssetUrl(id: PaperAssetId): string | null {
  return hasPaperAsset(id) ? `${PAPER_ASSET_BASE}/${id}.png` : null
}

/**
 * Deterministically pick the asset to use from a candidate list, skipping any
 * not-yet-placed ids. `seedFraction` is a stable 0..1 number (e.g. derived
 * from card.id) so the same card always gets the same variant. Returns null
 * if NONE of the candidates are placed (caller then uses its CSS fallback).
 */
export function pickPaperAsset(
  seedFraction: number,
  ids: readonly PaperAssetId[],
): PaperAssetId | null {
  const placed = ids.filter(hasPaperAsset)
  if (placed.length === 0) return null
  const clamped = Math.max(0, Math.min(0.999999, seedFraction))
  return placed[Math.floor(clamped * placed.length)] ?? placed[0]
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/board/paper-assets.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/masay/Desktop/マイコラージュ"
git add lib/board/paper-assets.ts lib/board/paper-assets.test.ts public/themes/paper-atelier
git commit -m "feat(paper): asset manifest + place paper-atelier PNGs"
```

---

## Task 2: Background — real parchment tile (graceful, asset pending)

Make the board background consume a real parchment tile when placed, while keeping the current fiber.svg + gradient look as the live fallback (the parchment PNG isn't sliced yet). This task only wires the *vessel*; flipping `parchment-bg` to `true` later turns it real.

**Files:**
- Modify: `app/globals.css` (paper block, near line 473 `--paper-fiber-url`)
- Modify: `components/board/themes.module.css` (`.paperAtelier`, lines 14–43)
- Test: `app/globals.paper-bg.test.ts` (new, string-level CSS assertion)

**Interfaces:**
- Consumes: `paperAssetUrl('parchment-bg')` semantics (token defined only when placed).
- Produces: a `--asset-parchment-bg` token convention used by `.paperAtelier`.

- [ ] **Step 1: Write the failing CSS-contract test**

Create `app/globals.paper-bg.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
const themes = readFileSync(
  resolve(__dirname, '../components/board/themes.module.css'),
  'utf8',
)

describe('paper background asset wiring', () => {
  it('paper block declares --asset-parchment-bg only inside the paper scope', () => {
    const paperBlock = css.slice(css.indexOf('data-theme-id="paper-atelier"'))
    expect(paperBlock).toContain('--asset-parchment-bg')
  })

  it('.paperAtelier composites the parchment asset with a fiber fallback', () => {
    // The asset layer must use a var fallback so default theme = none and a
    // missing token keeps the existing fiber tile.
    expect(themes).toMatch(/var\(--asset-parchment-bg,\s*var\(--paper-fiber-url, none\)\)/)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/globals.paper-bg.test.ts`
Expected: FAIL (tokens not present yet).

- [ ] **Step 3: Add the parchment asset token (paper scope only)**

In `app/globals.css`, inside the `html[data-theme-id="paper-atelier"]` block, next to `--paper-fiber-url` (~line 473), add:
```css
  /* Real parchment tile (Task 2). Defined here = paper-only; default theme
     never sees it. Until parchment-bg.png is placed + flipped in
     lib/board/paper-assets.ts, leave this as `none` so the fiber.svg fallback
     below stays the live look (graceful degrade). When the PNG lands, set:
       --asset-parchment-bg: url("/themes/paper-atelier/parchment-bg.png");
     and choose a background-size that tiles seamlessly at 100%. */
  --asset-parchment-bg: none;
```

- [ ] **Step 4: Point `.paperAtelier` at the asset with a fiber fallback**

In `components/board/themes.module.css`, in `.paperAtelier`, change the final background-image layer from:
```css
    var(--paper-fiber-url, none);
```
to:
```css
    /* parchment PNG when placed; otherwise the generated fibre tile (Task 2) */
    var(--asset-parchment-bg, var(--paper-fiber-url, none));
```
Leave the 6 gradient/vignette layers and `background-repeat: repeat;` unchanged. Keep `background-size` last value `160px 160px` (correct for fiber.svg; revisit when the parchment PNG's true tile size is known).

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run app/globals.paper-bg.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/board/themes.module.css app/globals.paper-bg.test.ts
git commit -m "feat(paper): wire parchment bg asset token with fiber fallback"
```

---

## Task 3: Decorations — real PNGs (washi / pin / clip / photo-corner / stamp)

Swap the CSS-gradient decorations for the staged PNGs, keeping the CSS look as fallback. Extend the deterministic set with variant indices so the manifest can pick among the 5 tapes / 2 pins / 4 corners / 3 stamp frames.

**Files:**
- Modify: `components/board/decorations/paper-decorations.ts`
- Modify: `components/board/decorations/PaperCardDecorations.tsx`
- Modify: `components/board/decorations/PaperCardDecorations.module.css`
- Test: `components/board/decorations/paper-decorations.test.ts` (extend), `components/board/decorations/PaperCardDecorations.test.tsx` (extend)

**Interfaces:**
- Consumes: `pickPaperAsset`, `paperAssetUrl`, `PaperAssetId` from Task 1; existing `getCardDecorations(cardId)`.
- Produces: extended `CardDecorationSet` with `washi[i].assetSeed: number` (0..1), `pin: { variant: 'gold'|'green' } | null` (replaces `pin: boolean`), `stamp.assetSeed: number`. `photoCorners` unchanged (corner enum → `photo-corner-N` mapping done in the component).

> NOTE: changing `pin: boolean` → object is a breaking shape change consumed only by `PaperCardDecorations.tsx`; update both together in this task.

- [ ] **Step 1: Write failing tests for the extended decoration shape**

In `components/board/decorations/paper-decorations.test.ts` add:
```typescript
import { getCardDecorations } from './paper-decorations'

it('washi pieces carry a stable 0..1 assetSeed', () => {
  const set = getCardDecorations('seed-card-xyz')
  for (const w of set.washi) {
    expect(typeof w.assetSeed).toBe('number')
    expect(w.assetSeed).toBeGreaterThanOrEqual(0)
    expect(w.assetSeed).toBeLessThan(1)
  }
  // determinism
  const again = getCardDecorations('seed-card-xyz')
  expect(again.washi.map((w) => w.assetSeed)).toEqual(set.washi.map((w) => w.assetSeed))
})

it('pin (when present) names a color variant', () => {
  // find a card id that produces a pin, then assert the variant union
  let found: ReturnType<typeof getCardDecorations>['pin'] = null
  for (let i = 0; i < 200 && !found; i++) found = getCardDecorations(`pin-probe-${i}`).pin
  expect(found === null || found.variant === 'gold' || found.variant === 'green').toBe(true)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/decorations/paper-decorations.test.ts`
Expected: FAIL (`assetSeed` undefined; `pin` is boolean).

- [ ] **Step 3: Extend the decoration types + generator**

In `components/board/decorations/paper-decorations.ts`:
- Add `assetSeed: number` to `WashiPiece` (a fresh `rng()` value 0..1).
- Add `assetSeed: number` to `DecoStamp`.
- Change `CardDecorationSet.pin` from `boolean` to `{ readonly variant: 'gold' | 'green' } | null` and `clip` stays `boolean`.
- In `getCardDecorations`: when building each washi piece, set `assetSeed: rng()`. For the fastener, when the pin branch fires, set `pin = { variant: rng() < 0.5 ? 'gold' : 'green' }` (else `pin = null`). For the stamp, add `assetSeed: rng()`.

Keep all existing probabilities and the existing rng() call order *before* the new calls within each piece so prior tests that assert counts/positions still hold; append the new `rng()` reads at the end of each piece's construction.

- [ ] **Step 4: Run to verify decoration-shape tests pass**

Run: `npx vitest run components/board/decorations/paper-decorations.test.ts`
Expected: PASS.

- [ ] **Step 5: Write a failing component test for real-PNG rendering**

In `components/board/decorations/PaperCardDecorations.test.tsx` add:
```typescript
it('renders washi/pin/clip/photo-corner/stamp with a background-image url when assets are placed', () => {
  // pick an id known to produce several decorations; assert at least one node
  // carries an inline backgroundImage referencing /themes/paper-atelier/
  const { container } = render(<PaperCardDecorations cardId="render-probe-1" />)
  const withImg = Array.from(container.querySelectorAll<HTMLElement>('[data-deco]'))
    .some((el) => (el.style.backgroundImage || '').includes('/themes/paper-atelier/'))
  expect(withImg).toBe(true)
})
```
(If `render-probe-1` happens to produce no decorations, loop over a few ids inside the test until one yields a `[data-deco]` node, then assert.)

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run components/board/decorations/PaperCardDecorations.test.tsx`
Expected: FAIL (no inline backgroundImage yet).

- [ ] **Step 7: Render real PNGs in the component (with CSS fallback)**

In `components/board/decorations/PaperCardDecorations.tsx`, for each decoration set inline `style.backgroundImage` from the manifest, falling back to `undefined` (so the existing CSS class art shows) when the manifest has no asset:
```tsx
import { paperAssetUrl, pickPaperAsset } from '@/lib/board/paper-assets'

// helper inside the component module:
const bg = (url: string | null): string | undefined => (url ? `url("${url}")` : undefined)

// washi (deterministic among the 5 tapes via assetSeed):
{set.washi.map((w, i) => {
  const id = pickPaperAsset(w.assetSeed, [
    'washi-tape-1','washi-tape-2','washi-tape-3','washi-tape-4','washi-tape-5',
  ])
  return (
    <span
      key={`washi-${i}`}
      data-deco="washi"
      data-asset={id ? 'true' : undefined}
      className={washiClass(w)}
      style={{ ...washiStyle(w), backgroundImage: bg(id ? paperAssetUrl(id) : null) }}
    />
  )
})}

// pin (color variant → gold/green png):
{set.pin && (
  <span
    data-deco="pin"
    data-asset={hasPin ? 'true' : undefined}
    className={styles.pin}
    style={{ backgroundImage: bg(paperAssetUrl(set.pin.variant === 'gold' ? 'push-pin-gold' : 'push-pin-green')) }}
  />
)}

// clip:
{set.clip && (
  <span data-deco="clip" data-asset className={styles.clip}
    style={{ backgroundImage: bg(paperAssetUrl('paper-clip')) }} />
)}

// photo corners (enum tl/tr/bl/br -> photo-corner-1..4):
{set.photoCorners.map((c) => {
  const idx = { tl: 1, tr: 2, br: 3, bl: 4 }[c]
  return (
    <span key={`pc-${c}`} data-deco="photo-corner" className={cornerClass(c)}
      style={{ backgroundImage: bg(paperAssetUrl(`photo-corner-${idx}` as const)) }} />
  )
})}

// stamp (frame png + the word typeset on top as before):
{set.stamp && (() => {
  const id = pickPaperAsset(set.stamp.assetSeed, ['stamp-circular','stamp-rect','stamp-oval'])
  return (
    <span data-deco="stamp" data-asset={id ? 'true' : undefined}
      className={`${styles.stamp} ${stampCornerClass(set.stamp.corner)}`}
      style={{ transform: `rotate(${set.stamp.angleDeg}deg)`, backgroundImage: bg(id ? paperAssetUrl(id) : null) }}>
      {set.stamp.label}
    </span>
  )
})()}
```
Adjust `hasPin` to `Boolean(paperAssetUrl(...))`. Keep `aria-hidden`, `data-testid`, `pointer-events:none` exactly as before.

- [ ] **Step 8: Make CSS use the PNG when `data-asset` is set, else keep the gradient**

In `components/board/decorations/PaperCardDecorations.module.css`, for each decoration add a `[data-asset='true']` modifier that (a) sets `background-size: contain; background-repeat: no-repeat; background-position: center;` (b) removes the CSS-only paint that the PNG already bakes (the gradient `background` color, `mask-image` torn ends on washi, the radial-gradient on pin, the metallic gradient on clip, the border on photo-corner/stamp). The inline `backgroundImage` from Step 7 supplies the picture; these modifiers stop the CSS art from showing through. Example for washi:
```css
.washi[data-asset='true'] {
  background-color: transparent;
  -webkit-mask-image: none;
  mask-image: none;
  box-shadow: none; /* contact shadow is baked into the PNG */
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
.pin[data-asset='true'],
.clip[data-asset='true'] {
  background: none; /* override gradient; inline backgroundImage wins */
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.photoCorner[data-asset='true'],
.stamp[data-asset='true'] {
  border: none;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
```
For `.stamp[data-asset='true']`, keep the text (the word) legible: the frame PNG is the picture, the `{label}` text renders centered over it — leave the `color`/`font` rules intact and ensure the text isn't clipped (add `display:flex; align-items:center; justify-content:center;` if needed).

- [ ] **Step 9: Run decoration tests**

Run: `npx vitest run components/board/decorations`
Expected: PASS (extended shape + render-with-image + existing determinism/aria tests).

- [ ] **Step 10: Commit**

```bash
git add components/board/decorations
git commit -m "feat(paper): back card decorations with real PNGs, CSS fallback retained"
```

---

## Task 4: Card face — mat backing + photo inset + serif caption (paper only)

The highest-impact face. Give paper-theme cards a real ivory mat (deterministic among `card-mat-1..3`), inset the thumbnail like a mounted print, and print the bookmark title as a serif ink signature under it. All inside `ImageCard`'s box — the outer FLIP box is untouched.

**Files:**
- Modify: `components/board/cards/ImageCard.tsx`
- Modify: `components/board/cards/ImageCard.module.css`
- Test: `components/board/cards/ImageCard.test.tsx` (extend)

**Interfaces:**
- Consumes: `pickPaperAsset`/`paperAssetUrl` (Task 1); `getThemeMeta` for colorScheme; `item.title`, `item.thumbnail`, `item.mediaSlots`.
- Produces: a `paper` prop on `ImageCard` (`readonly paper?: boolean`) set by `CardsLayer` from `meta.decorations === true` (the paper gate). Default false = current full-bleed behavior unchanged.

- [ ] **Step 1: Write a failing test for the paper card layout**

In `components/board/cards/ImageCard.test.tsx` add:
```typescript
it('paper mode wraps the thumbnail in a mat and prints a serif caption', () => {
  const item = makeItem({ title: 'Interior Study', thumbnail: 'https://x/t.jpg' })
  const { container, getByText } = render(<ImageCard item={item} paper cardWidth={240} cardHeight={300} />)
  // mat backing present
  expect(container.querySelector('[data-paper-mat]')).not.toBeNull()
  // caption shows the bookmark title
  expect(getByText('Interior Study')).toBeTruthy()
})

it('default (non-paper) mode renders the full-bleed thumbnail with no mat/caption', () => {
  const item = makeItem({ title: 'X', thumbnail: 'https://x/t.jpg' })
  const { container, queryByText } = render(<ImageCard item={item} cardWidth={240} cardHeight={300} />)
  expect(container.querySelector('[data-paper-mat]')).toBeNull()
  expect(queryByText('X')).toBeNull()
})
```
(Use the file's existing `makeItem`/item factory; mirror its current test setup.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/cards/ImageCard.test.tsx`
Expected: FAIL (no `paper` prop / no `[data-paper-mat]` / caption absent).

- [ ] **Step 3: Add the `paper` branch to ImageCard**

In `components/board/cards/ImageCard.tsx`:
- Add `readonly paper?: boolean` to props (default `false`).
- When `paper === true`, render the existing image/slots tree INSIDE a mat structure:
```tsx
// pick a deterministic mat for this card
const matId = paper
  ? pickPaperAsset(seedFractionFromId(item.bookmarkId), ['card-mat-1','card-mat-2','card-mat-3'])
  : null
const matUrl = matId ? paperAssetUrl(matId) : null

return paper ? (
  <div
    className={styles.paperCard}
    data-paper-mat="true"
    style={matUrl ? { backgroundImage: `url("${matUrl}")` } : undefined}
  >
    <div className={styles.paperPhoto}>
      {/* existing slots / thumbnail / placeholder JSX, unchanged */}
      {renderThumbContent()}
    </div>
    {item.title && <div className={styles.paperCaption}>{item.title}</div>}
  </div>
) : (
  <div className={styles.imageCard}>
    {renderThumbContent()}
  </div>
)
```
Factor the current image/slots/placeholder/dots/tint JSX into a `renderThumbContent()` local (no behavior change) so both branches share it. Add a tiny `seedFractionFromId` helper (FNV-1a over the id → /2^32) OR import the existing hash from `paper-decorations.ts` if it's exported; if not, inline a 6-line FNV-1a. Keep `data-active`, `onError`, multi-image dots, reel tint exactly as today.

- [ ] **Step 4: Pass the `paper` flag from CardsLayer**

In `components/board/CardsLayer.tsx`, where `<Card ... />` is rendered inside `CardNode` (the `item={it}` call), add `paper={meta.decorations === true}`. (`meta` is already in scope from `getThemeMeta(themeId)`.) No other CardsLayer change.

- [ ] **Step 5: Style the mat / photo inset / caption (paper only)**

In `components/board/cards/ImageCard.module.css` add:
```css
/* Paper-atelier card face: ivory mat, inset mounted photo, serif caption.
   Only rendered when ImageCard receives paper. Lives entirely inside the
   card box — the outer FLIP wrapper is untouched. */
.paperCard {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--card-dark-alt, #f7f1e3); /* fallback ivory if mat png absent */
  background-size: cover;
  background-position: center;
  border-radius: var(--card-radius, 3px);
  /* warm-gray hairline + soft paper shadow are on the outer wrapper already;
     keep the mat flush. */
  overflow: hidden;
  padding: 6%;            /* the mat margin around the print */
  gap: 5%;
}
.paperPhoto {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  /* mounted-print look: faint inner shadow so the photo sits IN the mat */
  box-shadow: inset 0 0 0 1px rgba(43, 39, 34, 0.10), 0 1px 2px rgba(43, 39, 34, 0.14);
}
.paperPhoto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.paperCaption {
  flex: 0 0 auto;
  font-family: var(--font-serif-display, Georgia, serif);
  font-size: clamp(10px, 1.1vw, 14px);
  line-height: 1.2;
  color: var(--text-primary, #2b2722);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```
Clamp the caption so extreme card sizes (free-resize) never overflow the box (非干渉 / free-size spec). The existing `.thumb`/`.thumbSoft` rules still apply to the imgs inside `.paperPhoto` (they're `position:absolute; inset:0`), so the soft-shuffle crossfade keeps working.

- [ ] **Step 6: Run card tests**

Run: `npx vitest run components/board/cards/ImageCard.test.tsx`
Expected: PASS (paper layout + default unchanged).

- [ ] **Step 7: Verify no interference on the outer box (static check)**

Run: `npx vitest run components/board/cards components/board/decorations`
Expected: PASS. Manually confirm `CardsLayer` wrapper styles (`width/height/transform`) and `CardNode` are unchanged in the diff.

- [ ] **Step 8: Commit**

```bash
git add components/board/cards components/board/CardsLayer.tsx
git commit -m "feat(paper): card mat + mounted photo inset + serif caption"
```

---

## Task 5: Scroll meter — paper ruler strip + paper thumb

Replace RulerTrack's CSS rule line + brass triangle with the real worn-paper ruler strip (ticks baked in — fine, the track is a fixed 360px so no stretch distortion) and the paper-scrap thumb. Keep the exact position logic (the parent rAF sets `marker.style.left`).

**Files:**
- Modify: `components/board/scrollmeter/RulerTrack.tsx`
- Modify: `components/board/scrollmeter/RulerTrack.module.css`
- Test: `components/board/ScrollMeter.test.tsx` (extend)

**Interfaces:**
- Consumes: `paperAssetUrl('ruler-meter-strip')`, `paperAssetUrl('ruler-meter-thumb')`.
- Produces: no signature change — `RulerTrack({ markerRef })` unchanged; `markerRef` still drives `style.left`.

- [ ] **Step 1: Write a failing test for the paper-strip background + image thumb**

In `components/board/ScrollMeter.test.tsx` add:
```typescript
it('ruler track uses the paper strip + thumb assets when placed', () => {
  const { getByTestId } = render(
    <ScrollMeter mode="board" n1={1} n2={1} total={1} swellFraction={0} onScrub={() => {}} variant="ruler" />,
  )
  const rail = getByTestId('ruler-track')
  // strip background applied somewhere on the rail
  expect(rail.getAttribute('data-asset')).toBe('true')
  const marker = getByTestId('ruler-marker')
  expect((marker.style.backgroundImage || '')).toContain('/themes/paper-atelier/ruler-meter-thumb')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/ScrollMeter.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Apply the strip + thumb assets in RulerTrack**

In `components/board/scrollmeter/RulerTrack.tsx`:
- Compute `const stripUrl = paperAssetUrl('ruler-meter-strip')` and `const thumbUrl = paperAssetUrl('ruler-meter-thumb')`.
- On the `.rail` root: `data-asset={stripUrl ? 'true' : undefined}` and, when present, `style={{ backgroundImage: 'url("'+stripUrl+'")' }}`.
- When `stripUrl` is present, do NOT render the CSS `.rule`/tick/numeral children (the strip's baked ticks replace them); when absent, render them as today. Guard with `{!stripUrl && (<>...existing ticks/rule/numerals...</>)}`.
- On the `.marker` element, when `thumbUrl` present add `style={{ left:'0%', pointerEvents:'none', backgroundImage:'url("'+thumbUrl+'")' }}` and `data-asset="true"`; the parent rAF still overwrites `style.left` each frame (it only sets `left`, not `backgroundImage`, so the image persists).

- [ ] **Step 4: Style the paper strip + thumb**

In `components/board/scrollmeter/RulerTrack.module.css`:
```css
.rail[data-asset='true'] {
  background-size: 100% 100%;   /* fixed 360px track, strip stretched to fit */
  background-repeat: no-repeat;
  background-position: center;
}
.marker[data-asset='true'] {
  /* drop the CSS triangle; the paper-scrap PNG is the thumb */
  width: 18px;
  height: 22px;
  border: none;            /* remove triangle borders */
  background-color: transparent;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transform: translateX(-50%);
  filter: drop-shadow(0 1px 1px rgba(43, 39, 34, 0.22));
  bottom: 2px;
}
```
Keep the existing `.marker` (triangle) rules for the no-asset fallback. Consider bumping `.track[data-meter-variant='ruler']` height in `ScrollMeter.module.css` from `28px` to ~`34px` so the strip's ~5.8:1 proportions read better against the 360px width (per the aspect note); confirm visually.

- [ ] **Step 5: Run meter tests**

Run: `npx vitest run components/board/ScrollMeter.test.tsx`
Expected: PASS (new asset test + existing ruler-variant test).

- [ ] **Step 6: Commit**

```bash
git add components/board/scrollmeter components/board/ScrollMeter.module.css components/board/ScrollMeter.test.tsx
git commit -m "feat(paper): ruler meter paper strip + paper-scrap thumb"
```

---

## Task 6: Chrome typography + ink motion (serif buttons, no glitch)

On paper only, render header chrome buttons in Fraunces serif and replace the RGB chromatic-glitch hover with a gentle ink-bleed/fade. Default theme keeps the mono + glitch exactly.

**Files:**
- Modify: `components/board/ChromeButton.tsx`
- Modify: `components/board/ChromeButton.module.css`
- Modify: `app/globals.css` (paper block: chrome font + ink-motion tokens)
- Test: `components/board/ChromeButton.test.tsx` (new or extend)

**Interfaces:**
- Consumes: active theme id (ChromeButton currently has no theme awareness — read it the same way the wordmark CSS does, via the `html[data-theme-id='paper-atelier']` cascade, i.e. CSS-only branch; no new prop needed).
- Produces: paper-scoped CSS that overrides font-family + disables glitch keyframes + adds an ink-fade.

- [ ] **Step 1: Write a failing CSS-contract test**

Create `components/board/ChromeButton.paper.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const css = readFileSync(resolve(__dirname, 'ChromeButton.module.css'), 'utf8')

describe('paper chrome button styling', () => {
  it('paper scope overrides the button font to the serif token', () => {
    expect(css).toMatch(/data-theme-id='paper-atelier'[^]*\.btn[^]*var\(--font-serif-display/)
  })
  it('paper scope disables the RGB glitch animation', () => {
    expect(css).toMatch(/data-theme-id='paper-atelier'[^]*animation:\s*none/)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/ChromeButton.paper.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add paper-scoped chrome button CSS**

In `components/board/ChromeButton.module.css` append:
```css
/* Paper-atelier: serif ink lettering, no digital glitch. The scramble JS
   still runs but the visible font is serif and the RGB ghost keyframes are
   neutralized so chrome reads as printed type, not a terminal. */
:global(html[data-theme-id='paper-atelier']) .btn {
  font-family: var(--font-serif-display, Georgia, 'Times New Roman', serif);
  text-transform: uppercase;        /* small-caps feel via caps + tracking */
  letter-spacing: 0.06em;
}
:global(html[data-theme-id='paper-atelier']) .btn:hover::before,
:global(html[data-theme-id='paper-atelier']) .btn:hover::after,
:global(html[data-theme-id='paper-atelier']) .btn.glitchBurst::before,
:global(html[data-theme-id='paper-atelier']) .btn.glitchBurst::after {
  animation: none;
  opacity: 0;                        /* no RGB ghosts on paper */
}
/* gentle ink bleed on hover: a soft darken + 1px settle, motion-gated */
:global(html[data-theme-id='paper-atelier']) .btn:hover {
  color: var(--chrome-btn-color-hover, rgba(43, 39, 34, 1));
  transition: color 160ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  :global(html[data-theme-id='paper-atelier']) .btn:hover { transition: none; }
}
```
> The idle scramble (`useChromeScramble`) keeps swapping characters; since the design wants "穏やかなインク", consider disabling the scramble on paper too — see Step 4. The CSS above is enough to kill the *RGB glitch*; the character scramble is JS.

- [ ] **Step 4: Disable the character scramble on paper (JS branch)**

In `components/board/ChromeButton.tsx`, read whether paper is active (e.g. `const paper = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme-id') === 'paper-atelier'`) and, when paper, render the raw `label` instead of the scrambled `display`, and skip wiring `triggerBurst` on hover. Keep the default path identical. (If ChromeButton already receives theme context via a hook/prop, prefer that over reading the DOM.) This makes paper chrome calm; the serif + ink-fade carry the motion.

- [ ] **Step 5: Add Caveat handwriting for hint/notes (if any chrome hints exist on paper)**

If board hint text (e.g. "Drag to edge") renders through a shared component, add a paper-scoped rule giving it `font-family: var(--font-handwriting, cursive)` (Caveat is already loaded as `--font-handwriting`). If no such hint currently renders on the board, skip and note it.

- [ ] **Step 6: Run chrome tests**

Run: `npx vitest run components/board/ChromeButton.paper.test.ts components/board/ChromeButton`
Expected: PASS. Run the full suite once to ensure the scramble branch didn't break default ChromeButton tests: `npx vitest run components/board/ChromeButton`.

- [ ] **Step 7: Commit**

```bash
git add components/board/ChromeButton.tsx components/board/ChromeButton.module.css components/board/ChromeButton.paper.test.ts app/globals.css
git commit -m "feat(paper): serif chrome buttons + ink motion (no RGB glitch)"
```

---

## Task 7: Wordmark letterpress + MK-1 plate + wax seal PNGs

Finish the chrome: feed the background wordmark its broken-ink grain from a real letterpress PNG when placed (fall back to fiber.svg grain), and back the MK-1 plate + wax seal with their PNGs (fall back to current CSS/SVG).

**Files:**
- Modify: `app/globals.css` (paper block: `--wordmark-grain-url`, plate/seal asset tokens)
- Modify: `components/board/BoardBackgroundTypography.module.css`
- Modify: `components/board/chrome/PaperFramePlate.tsx` + `.module.css`
- Modify: `components/board/chrome/PaperWaxSeal.tsx` + `.module.css`
- Test: `components/board/chrome/PaperFramePlate.test.tsx` / `PaperWaxSeal.test.tsx` (new, small)

**Interfaces:**
- Consumes: `paperAssetUrl('mk1-plate')`, `paperAssetUrl('wax-seal-a')`; a future `letterpress-ink-grain` asset (NOT yet generated — wire the token, leave it `none`).
- Produces: `--asset-mk1-plate`, `--asset-wax-seal`, `--asset-letterpress-grain` tokens (paper scope only).

- [ ] **Step 1: Wire the letterpress grain token (asset pending)**

In `app/globals.css` paper block, change `--wordmark-grain-url: var(--paper-fiber-url);` to:
```css
  /* letterpress broken-ink grain for the wordmark. Real asset pending
     (letterpress-ink-grain.png not generated yet); fall back to the fibre
     tile so the wordmark keeps its current kasure look. */
  --asset-letterpress-grain: none;
  --wordmark-grain-url: var(--asset-letterpress-grain, var(--paper-fiber-url));
```
No `BoardBackgroundTypography.module.css` change needed (it already reads `--wordmark-grain-url`); confirm the `::after` grain rule still resolves. (When the PNG lands: set `--asset-letterpress-grain: url(".../letterpress-ink-grain.png")` and tune `background-size`/`--wordmark-grain-opacity`.)

- [ ] **Step 2: Write failing tests for plate + seal asset backing**

Create `components/board/chrome/PaperFramePlate.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PaperFramePlate } from './PaperFramePlate'

describe('PaperFramePlate', () => {
  it('applies the mk1-plate PNG as background when placed and keeps the text', () => {
    const { container, getByText } = render(<PaperFramePlate hidden={false} />)
    const plate = container.querySelector('[data-paper-plate]') as HTMLElement
    expect(plate.style.backgroundImage).toContain('/themes/paper-atelier/mk1-plate')
    expect(getByText('ALLMARKS MK-1')).toBeTruthy()  // text still typeset on top
  })
})
```
Create `components/board/chrome/PaperWaxSeal.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PaperWaxSeal } from './PaperWaxSeal'

describe('PaperWaxSeal', () => {
  it('renders the wax-seal PNG when placed (img/background), falls back to SVG otherwise', () => {
    const { container } = render(<PaperWaxSeal hidden={false} />)
    const sealImg = container.querySelector('[data-paper-seal]') as HTMLElement
    expect(sealImg.style.backgroundImage).toContain('/themes/paper-atelier/wax-seal-a')
  })
})
```
(Check each component's real prop names — `hidden` is used per the map; adjust if the actual prop differs.)

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run components/board/chrome`
Expected: FAIL (no `data-paper-plate` / `data-paper-seal` + backgroundImage).

- [ ] **Step 4: Back the plate with its PNG (text stays typeset on top)**

In `components/board/chrome/PaperFramePlate.tsx`, add a `data-paper-plate` attribute and, when `paperAssetUrl('mk1-plate')` is non-null, set the wrapper `style.backgroundImage` to it (and in `.module.css`, a `[data-paper-plate][style*='background-image']`-style modifier — or a `data-asset='true'` flag — that drops the CSS `background`/`border`/`box-shadow` the PNG bakes, sets `background-size:100% 100%`). The `ALLMARKS MK-1` / `ARCHIVE` spans + gold rule stay rendered ON TOP (text-free plate PNG per ASSET-BRIEF), keeping i18n/crispness.

- [ ] **Step 5: Back the wax seal with its PNG (SVG fallback)**

In `components/board/chrome/PaperWaxSeal.tsx`, when `paperAssetUrl('wax-seal-a')` is non-null, render a `<span data-paper-seal style={{ backgroundImage: ... }} className={styles.sealImg} />` in place of the inline `<svg>` seal; when null, keep the existing SVG. Keep the rotated `+` stamp glyph as-is (it's the decorative save stamp). Add `.sealImg { width:64px; height:64px; background-size:contain; background-repeat:no-repeat; background-position:center; }` to the module CSS. Preserve `pointer-events:none`, the `.hidden` fade, and `aria-hidden`.

- [ ] **Step 6: Run chrome tests**

Run: `npx vitest run components/board/chrome`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css components/board/BoardBackgroundTypography.module.css components/board/chrome
git commit -m "feat(paper): wordmark grain token + MK-1 plate & wax seal PNGs"
```

---

## Task 8: Full verification, default-invariance proof, deploy

**Files:**
- Test/verify only; no new source.

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full unit suite**

Run: `npx vitest run`
Expected: PASS. If only `tests/lib/channel.test.ts` fails, re-run it alone (`npx vitest run tests/lib/channel.test.ts`) — it's known-flaky.

- [ ] **Step 3: Default byte-identical guard (manual + grep)**

Confirm no paper asset URL or `--asset-*` token leaks outside the paper scope:
```bash
git diff --stat
rg -n "themes/paper-atelier|--asset-" app/globals.css components | rg -v "paper-atelier'\)|data-theme-id=\"paper-atelier\"|data-theme-id='paper-atelier'"
```
Expected: every `--asset-*` definition sits under the paper scope; component reads are gated by `paper`/`data-asset`/`variant==='ruler'`/`meta.decorations`. Spot-check by toggling to a default theme in the app — board must look identical to pre-change.

- [ ] **Step 4: Production build**

Run: `rtk pnpm build`
Expected: `out/` generated, no build errors.

- [ ] **Step 5: Deploy to production**

Run:
```bash
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="paper-atelier full-fidelity assets"
```
Then tell the user to hard-reload `allmarks.app`, switch to the paper-atelier theme, and verify each face (background, cards, meter, chrome, wordmark, plate/seal). Visual calibration (which ruler/thumb/wax variant, mat tint, caption size, vignette strength) is the user's call — iterate by adjusting tokens / manifest picks and re-deploying.

- [ ] **Step 6: Update session docs + final commit**

Update `docs/TODO_COMPLETED.md` (narrative), `docs/TODO.md` (state), `docs/CURRENT_GOAL.md` (next: parchment-bg + letterpress-grain assets, meter state-difference polish, variant calibration). Then:
```bash
git add docs
git commit -m "docs(session): paper-atelier full-fidelity assets shipped"
```

---

## Self-Review

**1. Spec coverage** (design doc §3 faces):
- §3.1 background → Task 2 ✅
- §3.2 cards (mat + inset + caption + decoration assets) → Task 4 (mat/inset/caption) + Task 3 (decoration PNGs) ✅
- §3.3 meter → Task 5 ✅
- §3.4 chrome typography + motion → Task 6 ✅
- §3.5 wordmark + MK-1 + wax seal → Task 7 ✅
- §3.6 Lightbox → already done in Plan 2 (pale scrim token); framing is optional polish, deferred (noted, not a task) ✅
- §4 invariants → Global Constraints + Task 8 Step 3 proof ✅
- §6 decisions ①–④ → baked into Tasks 4 (①caption), 6 (②③ serif+ink), 5 (④ meter polish deferred) ✅
- §2 graceful degrade → manifest (`PAPER_ASSETS` booleans) + `var(--token, fallback)` throughout ✅

**2. Placeholder scan:** No "TBD/handle edge cases/similar to Task N". The two genuinely-pending assets (`parchment-bg`, `letterpress-ink-grain`) are wired as `none` tokens with explicit "flip when placed" instructions — that's a real implemented fallback, not a placeholder.

**3. Type consistency:** `PaperAssetId`, `hasPaperAsset`, `paperAssetUrl`, `pickPaperAsset` defined in Task 1 and consumed identically in Tasks 3–7. `CardDecorationSet.pin` shape change (boolean → `{variant} | null`) is made and consumed in the same task (3). `ImageCard` `paper` prop defined in Task 4 and passed from CardsLayer in the same task. `RulerTrack({markerRef})` signature unchanged. Meter `variant` flow unchanged.

**Known gaps surfaced (not blockers — graceful degrade covers them):**
- `parchment-bg.png` not yet sliced → background stays fiber.svg until placed.
- `letterpress-ink-grain.png` not yet generated → wordmark keeps fiber-grain kasure until placed.
- `stitch-print-strip` (tentative) → not used; out of scope.
- Stamp PNGs are empty frames → the word is typeset on top (consistent with ASSET-BRIEF "typeset live"); if the user prefers baked-word stamps, regenerate later.
- Variant calibration (ruler v1/v2, thumb v1/v2, wax color, mat tint) → user-driven visual choice post-deploy.
