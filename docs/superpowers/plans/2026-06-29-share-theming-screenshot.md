# Share Theming via Screenshot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the share preview, the OG thumbnail image, and the receiver page `/s/<id>` all carry the sender's active theme + per-theme customization, by screenshotting the bounded, visible-only themed preview with `dom-to-image-more` (the user's "just screenshot the visible area" idea, proven in the 2026-06-29 spike).

**Architecture:** The share payload (`ShareDataV2`) gains a `custom` field; the sender forwards the real `themeId` + resolved customization instead of the current `DEFAULT_THEME_ID` placeholder. The OG image is produced by `dom-to-image` over a hidden, **visible-only** themed copy of `ShareMirror` (bounded ⇒ avoids the 2026 full-board memory explosion), then JPEG-compressed and uploaded exactly as today. The receiver page applies the theme by setting `data-theme-id` on `<html>` (reusing the board's own globals.css + patternLayer cascade). Pattern fidelity uses a **single-layer SVG** background so dom-to-image renders it faithfully.

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS + CSS custom properties / `dom-to-image-more@3.7.2` (already a dependency) / Zod (share validation) / vitest / Playwright.

**Design spec (source of truth):** [docs/superpowers/specs/2026-06-29-share-theming-screenshot-design.md](../specs/2026-06-29-share-theming-screenshot-design.md)

## Global Constraints

- **default (Sound Wave = `dotted-notebook`) live board is byte-identical** — all changes are share/capture-scoped; never touch the board's default patternLayer CSS or globals.css default tokens.
- **¥0** — client-side image generation only; no server render, no new Cloudflare binding. `functions/api/share/*` is untouched.
- **TypeScript strict**, no `any` (use `unknown` + guards), explicit return types, Zod for all external payloads.
- **No `--no-verify`** on commits (CLAUDE.md). Deploy gate before any deploy: `rtk tsc && rtk vitest run && rtk pnpm build`.
- **DB / wire symbols frozen**: `DB_NAME='booklage-db'`, `ThemeId` values (`dotted-notebook` / `grid-paper` / `paper-atelier`), `data-mirror-card-id`, CSS module class names.
- **UI English** stays globally-clear; no new user-facing sentences in this plan (no i18n keys added).
- Known-flaky `tests/lib/channel.test.ts` (passes on re-run) — ignore a lone failure there.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/share/types-v2.ts` | `ShareDataV2` gains `custom?: ShareCustomization` | Modify |
| `lib/share/validate-v2.ts` | Zod schema + sanitize for `custom` | Modify |
| `lib/share/board-to-share.ts` | `BuildShareArgs.custom` → payload | Modify |
| `lib/board/theme-customization.ts` | `patternSvgDataUri()` single-layer pattern helper | Modify |
| `components/board/BoardRoot.tsx` | send real `themeId` + `custom` (L1786) | Modify |
| `components/share/ShareMirror.tsx` | accept `themeId`+`custom`, paint theme | Modify |
| `components/share/SenderShareModal.tsx` | visible-only capture node + dom-to-image + fallback | Modify |
| `lib/share/render-share-image.ts` | `dom-to-image` → JPEG-under-target | **Create** |
| `components/share/SharedBoard.tsx` | `<html data-theme-id>` + patternLayer on `/s/` | Modify |

Order: **Task 1 → 2 → 3 → 4 → 5 → 6** (data layer first; receiver page in Task 4 is an early visible win; OG image in Task 6 is last).

---

## Task 1: Share payload carries `custom`

**Files:**
- Modify: `lib/share/types-v2.ts` (add `ShareCustomization` + `ShareDataV2.custom`)
- Modify: `lib/share/validate-v2.ts` (schema + sanitize)
- Modify: `lib/share/board-to-share.ts` (`BuildShareArgs.custom` → output)
- Test: `lib/share/validate-v2.test.ts` (extend existing) + `lib/share/board-to-share.test.ts` (extend existing)

**Interfaces:**
- Produces: `ShareCustomization` (6 required fields), `ShareDataV2.custom?: ShareCustomization`, `BuildShareArgs.custom?: ShareCustomization`.
- Consumes: `PatternType` from `@/lib/board/types`.

- [ ] **Step 1: Add the `ShareCustomization` type + field to `types-v2.ts`**

In `lib/share/types-v2.ts`, after the `ThemeId` import add `PatternType`, and define the type above `ShareDataV2`:

```ts
import type { ThemeId, PatternType } from '@/lib/board/types'

/** Sender's resolved per-theme customization (the effective values they saw —
 *  edge/board/pattern colour, pattern style + density, title colour). Carried so
 *  the receiver + the OG image reproduce the exact look. All 6 fields required
 *  because the sender always sends the fully-resolved set (= ResolvedThemeCustomization). */
export type ShareCustomization = {
  readonly edgeColor: string
  readonly boardColor: string
  readonly patternColor: string
  readonly patternType: PatternType
  readonly patternSize: number
  readonly titleColor: string
}
```

Then add the field to `ShareDataV2` (after `theme?: ThemeId` on line 55):

```ts
  readonly theme?: ThemeId
  /** Sender's resolved customization for `theme` (pattern themes only; absent for
   *  fixed 'work' themes like Paper, and for old shares — receiver falls back to
   *  theme defaults). */
  readonly custom?: ShareCustomization
```

- [ ] **Step 2: Write the failing validator test**

Add to `lib/share/validate-v2.test.ts`:

```ts
it('accepts a valid custom block and round-trips it', () => {
  const input = {
    v: 2, createdAt: 1, cards: [{ u: 'https://x.com/a', t: 'a', ty: 'tweet', cw: 200, a: 1 }],
    theme: 'grid-paper',
    custom: { edgeColor: '#0a0a0a', boardColor: '#0e0e11', patternColor: 'rgba(255,255,255,0.18)', patternType: 'grid', patternSize: 40, titleColor: '#fff' },
  }
  const r = parseShareDataV2(input)
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.data.custom?.patternType).toBe('grid')
})

it('sanitize drops a malformed custom instead of rejecting the whole payload', () => {
  const input = {
    v: 2, createdAt: 1, cards: [{ u: 'https://x.com/a', t: 'a', ty: 'tweet', cw: 200, a: 1 }],
    theme: 'grid-paper',
    custom: { patternType: 'not-a-pattern', patternSize: 99999 }, // invalid
  }
  const r = sanitizeShareDataV2(input)
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.data.custom).toBeUndefined()
})
```

- [ ] **Step 3: Run, expect FAIL**

Run: `rtk vitest run lib/share/validate-v2.test.ts`
Expected: FAIL (custom is rejected as unknown key / not coerced).

- [ ] **Step 4: Add the Zod schema + sanitize**

In `lib/share/validate-v2.ts`, add a `customSchema` above `shareDataSchema` and reference it in the object; then sanitize in `sanitizeShareDataV2`:

```ts
const customSchema = z.object({
  edgeColor: z.string().max(64),
  boardColor: z.string().max(64),
  patternColor: z.string().max(64),
  patternType: z.enum(['none', 'grid', 'diagonal', 'dots', 'crosshatch']),
  patternSize: z.number().min(8).max(200),
  titleColor: z.string().max(64),
})
```

Add to `shareDataSchema` (after the `theme:` line):

```ts
  custom: customSchema.optional(),
```

In `sanitizeShareDataV2`, before `return parseShareDataV2(next)`, drop an invalid custom so a tampered field doesn't sink the whole share:

```ts
  // Drop a malformed custom rather than failing the payload (theme still applies
  // its defaults). A well-formed custom passes through to the strict parse.
  if (next.custom !== undefined && !customSchema.safeParse(next.custom).success) {
    next.custom = undefined
  }
```

- [ ] **Step 5: Run, expect PASS**

Run: `rtk vitest run lib/share/validate-v2.test.ts`
Expected: PASS.

- [ ] **Step 6: Thread `custom` through `board-to-share.ts`**

Add to `BuildShareArgs` (after `defaultWidth?`):

```ts
  /** Sender's resolved customization for the active theme (pattern themes only). */
  readonly custom?: ShareCustomization
```

Import the type at top: `import { ..., type ShareCustomization } from './types-v2'`. In the `return` of `buildShareDataFromBoard`, after the `theme` spread:

```ts
    ...(args.themeId ? { theme: args.themeId } : {}),
    ...(args.custom ? { custom: args.custom } : {}),
```

- [ ] **Step 7: Write + run the board-to-share test**

Add to `lib/share/board-to-share.test.ts`:

```ts
it('includes custom when provided, omits it when not', () => {
  const base = { items: [], tags: [], filter: null, now: 1 }
  const custom = { edgeColor: '#0a0a0a', boardColor: '#0e0e11', patternColor: 'rgba(255,255,255,0.18)', patternType: 'grid' as const, patternSize: 40, titleColor: '#fff' }
  expect(buildShareDataFromBoard({ ...base, themeId: 'grid-paper', custom }).custom).toEqual(custom)
  expect(buildShareDataFromBoard({ ...base }).custom).toBeUndefined()
})
```

Run: `rtk vitest run lib/share/board-to-share.test.ts` → PASS.

- [ ] **Step 8: tsc + commit**

Run: `rtk tsc` → clean.

```bash
rtk git add lib/share/types-v2.ts lib/share/validate-v2.ts lib/share/board-to-share.ts lib/share/validate-v2.test.ts lib/share/board-to-share.test.ts
rtk git commit -m "feat(share): carry theme customization in ShareDataV2"
```

---

## Task 2: Send the real `themeId` + `custom` from BoardRoot

**Files:**
- Modify: `components/board/BoardRoot.tsx` (`buildShareData`, ~L1762-1794)

**Interfaces:**
- Consumes: `buildShareDataFromBoard` `themeId`/`custom` args (Task 1); `themeId` state + `resolvedCustom` (already at `BoardRoot.tsx:1700-1703`).
- Produces: share payloads that reflect the live board.

- [ ] **Step 1: Replace the DEFAULT_THEME_ID placeholder**

In `buildShareData` ([BoardRoot.tsx:1783-1786](../../../components/board/BoardRoot.tsx#L1783)), replace:

```ts
      // Share theming is Plan 3 — until then a shared board renders the default
      // theme. Forward DEFAULT_THEME_ID as a deliberate placeholder; the live
      // themeId state is intentionally NOT used here yet.
      themeId: DEFAULT_THEME_ID,
```

with:

```ts
      // Carry the live theme + its resolved customization so the shared board +
      // OG image reproduce what the sender sees. resolvedCustom is null for fixed
      // 'work' themes (Paper) — then themeId alone reproduces the look.
      themeId,
      custom: resolvedCustom ?? undefined,
```

- [ ] **Step 2: Extend the useCallback deps**

Change the dependency array (L1794) to include the new reads:

```ts
  }, [lightboxNavItems, tags, activeFilter, customWidths, cardWidthPx, cardGapPx, themeId, resolvedCustom])
```

- [ ] **Step 3: tsc + a focused assertion**

`resolvedCustom` is typed `ResolvedThemeCustomization | null` which is structurally `ShareCustomization | null` — `tsc` confirms the shapes match (both are the same 6 fields). If `DEFAULT_THEME_ID` is now unused in the file, leave its import (used elsewhere) — `tsc` will flag a truly unused import.

Run: `rtk tsc` → clean.

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(share): send live themeId + customization (drop placeholder)"
```

---

## Task 3: Single-layer pattern SVG helper

**Files:**
- Modify: `lib/board/theme-customization.ts` (add `patternSvgDataUri`)
- Test: `lib/board/theme-customization.test.ts` (extend existing, or create)

**Interfaces:**
- Produces: `patternSvgDataUri(c: { patternType: PatternType; patternColor: string; patternSize: number }): string` — a `data:image/svg+xml,...` URL tiling at `patternSize`px, or `''` for `patternType: 'none'`.
- Consumes: `PatternType`.

**Why:** the spike proved dom-to-image drops one direction of stacked CSS gradients (the Grid horizontal lines). A single SVG image renders faithfully in BOTH the browser and dom-to-image (same mechanism that made the Paper PNG perfect). Used by the preview + capture (Tasks 5/6) so both match.

- [ ] **Step 1: Write the failing test**

Add to `lib/board/theme-customization.test.ts`:

```ts
import { patternSvgDataUri } from './theme-customization'

describe('patternSvgDataUri', () => {
  it('returns empty for none', () => {
    expect(patternSvgDataUri({ patternType: 'none', patternColor: '#fff', patternSize: 40 })).toBe('')
  })
  it('encodes a tiling svg data-uri for grid', () => {
    const u = patternSvgDataUri({ patternType: 'grid', patternColor: 'rgba(255,255,255,0.18)', patternSize: 40 })
    expect(u.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(u)).toContain('width=\'40\'')
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `rtk vitest run lib/board/theme-customization.test.ts` → FAIL (`patternSvgDataUri` undefined).

- [ ] **Step 3: Implement the helper**

Append to `lib/board/theme-customization.ts`:

```ts
/** Build a single-layer tiling SVG (data-URI) for a pattern. Used by the share
 *  preview + OG capture so dom-to-image renders the pattern faithfully (it drops
 *  one direction of stacked CSS gradients — see 2026-06-29 spike). Mirrors
 *  themes.module.css `.patternLayer[data-pattern]` geometry. `none` → ''. */
export function patternSvgDataUri(c: {
  readonly patternType: PatternType
  readonly patternColor: string
  readonly patternSize: number
}): string {
  const s = c.patternSize
  const col = c.patternColor
  let body: string
  switch (c.patternType) {
    case 'none':
      return ''
    case 'grid':
      // line on the right + bottom edge so the tile repeats into a full grid
      body = `<path d='M${s} 0V${s}M0 ${s}H${s}' stroke='${col}' stroke-width='1' fill='none'/>`
      break
    case 'dots':
      body = `<circle cx='${s / 2}' cy='${s / 2}' r='1.4' fill='${col}'/>`
      break
    case 'diagonal':
      // 45° line through the tile; tiling continues the stripe
      body = `<path d='M0 ${s}L${s} 0' stroke='${col}' stroke-width='1' fill='none'/>`
      break
    case 'crosshatch':
      body = `<path d='M0 ${s}L${s} 0M0 0L${s} ${s}' stroke='${col}' stroke-width='1' fill='none'/>`
      break
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>${body}</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
```

- [ ] **Step 4: Run, expect PASS** — `rtk vitest run lib/board/theme-customization.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/theme-customization.ts lib/board/theme-customization.test.ts
rtk git commit -m "feat(share): single-layer pattern SVG helper (dom-to-image fidelity)"
```

---

## Task 4: Apply theme on the receiver page `/s/<id>`

**Files:**
- Modify: `components/share/SharedBoard.tsx` (theme application; ~L379-397 + the render tree)
- Test: `components/share/SharedBoard.test.tsx` (create — outside-click-free, jsdom)

**Interfaces:**
- Consumes: `data.theme` + `data.custom` (Task 1); `resolveThemeCustomization` / `patternSvgDataUri` (Task 3); the board's `themeStyles.patternLayer` class (`components/board/themes.module.css`) + globals.css `html[data-theme-id=...]` blocks.
- Produces: a themed interactive shared board.

- [ ] **Step 1: Set `data-theme-id` on `<html>` (replicate the board's own effect)**

`SharedBoard` is a `'use client'` component. Add an effect mirroring [BoardRoot.tsx:705-719](../../../components/board/BoardRoot.tsx#L705) (place it with the other hooks, NOT after the early returns):

```ts
useEffect((): (() => void) => {
  if (typeof document === 'undefined') return (): void => undefined
  const el = document.documentElement
  const tid = state.kind === 'ready' ? (state.data.theme ?? DEFAULT_THEME_ID) : DEFAULT_THEME_ID
  el.setAttribute('data-theme-id', tid)
  return (): void => { el.removeAttribute('data-theme-id') }
}, [state])
```

This makes globals.css theme blocks (Paper parchment, fonts, colour-scheme — they target `html[data-theme-id=...] .canvas/.outerFrame`) apply to the reused `frame.canvas` / `frame.outerFrame` automatically.

- [ ] **Step 2: Render the patternLayer for pattern themes**

In the ready render, compute the resolved customization and inject the pattern layer inside the dark canvas. Just before `<TopHeader ...>` inside `<div className={frame.canvas}>` (L420), add:

```tsx
{(() => {
  const rc = resolveThemeCustomization(themeId, data.custom)
  if (!rc) return null // 'work' theme (Paper) — globals.css blocks handle it
  return (
    <div
      aria-hidden="true"
      className={themeStyles.patternLayer}
      data-pattern={rc.patternType}
      style={{
        backgroundColor: rc.boardColor,
        backgroundImage: patternSvgDataUri(rc) ? `url("${patternSvgDataUri(rc)}")` : undefined,
        backgroundSize: `${rc.patternSize}px ${rc.patternSize}px`,
      } as CSSProperties}
    />
  )
})()}
```

Imports to add at top of `SharedBoard.tsx`:

```ts
import { useEffect, type CSSProperties } from 'react' // merge with existing react import
import { resolveThemeCustomization, patternSvgDataUri } from '@/lib/board/theme-customization'
import themeStyles from '@/components/board/themes.module.css'
```

> Note: `data.custom` is the sender's resolved values, so `resolveThemeCustomization` returns them verbatim (override beats default). For Paper, `data.custom` is absent and `rc` is null → globals.css handles it.

- [ ] **Step 3: Leave the existing `data-theme={themeId}` div as-is**

It is harmless (an unused attribute) and some test reads it. Do NOT remove it in this task to keep the diff minimal; theme application now comes from `<html>` (Step 1) + patternLayer (Step 2).

- [ ] **Step 4: Write the test**

Create `components/share/SharedBoard.test.tsx`. Mock the heavy children (CardsLayer, ScrollMeter, TopHeader, Lightbox) to stubs and the i18n provider, render a `ready` state with `theme: 'grid-paper'` + a custom, assert `<html>` gets `data-theme-id="grid-paper"` and a `[data-pattern="grid"]` element is present. (Follow the stub-children pattern from `components/board/ThemeModal.test.tsx`.)

```tsx
it('applies data-theme-id to <html> and renders the pattern layer for a pattern theme', async () => {
  renderReady({ theme: 'grid-paper', custom: { edgeColor: '#0a0a0a', boardColor: '#0e0e11', patternColor: 'rgba(255,255,255,0.18)', patternType: 'grid', patternSize: 40, titleColor: '#fff' } })
  expect(document.documentElement.getAttribute('data-theme-id')).toBe('grid-paper')
  expect(document.querySelector('[data-pattern="grid"]')).not.toBeNull()
})
```

(`renderReady` is a local helper that mounts `SharedBoard` with a stubbed-fetch `ready` state; if wiring a full ready state is heavy, instead assert the pure pieces: a thin exported `receiverPatternStyle(themeId, custom)` returning the style object, unit-tested directly. Prefer the component test if the existing fetch mock makes it cheap; otherwise extract + test the pure helper.)

- [ ] **Step 5: Run tests + tsc** — `rtk vitest run components/share/SharedBoard.test.tsx` → PASS; `rtk tsc` → clean.

- [ ] **Step 6: Visual check (Playwright, real prod-like)**

Write a throwaway `_x.mjs` in project root (delete after): dev server, create a share from a Grid-themed board, open `/s/<id>`, assert `getComputedStyle(document.documentElement).getAttribute` / the canvas background shows the grid. (Recipe: viewport 1489×679 dpr2, DB `booklage-db`.) Confirm visually, then `rm _x.mjs`.

- [ ] **Step 7: Commit**

```bash
rtk git add components/share/SharedBoard.tsx components/share/SharedBoard.test.tsx
rtk git commit -m "feat(share): apply theme + pattern on the receiver page /s/"
```

---

## Task 5: Theme the ShareMirror preview

**Files:**
- Modify: `components/share/ShareMirror.tsx` (accept `themeId` + `custom`, paint theme)
- Modify: `components/share/SenderShareModal.tsx` (pass `themeId` + `custom` through)
- Modify: `components/board/BoardRoot.tsx` (pass `themeId` + `resolvedCustom` to `<SenderShareModal>`)
- Test: `components/share/ShareMirror.test.tsx` (create)

**Interfaces:**
- Consumes: `patternSvgDataUri` + `ResolvedThemeCustomization` (Task 3); `ThemeId`.
- Produces: `ShareMirror` props `themeId: ThemeId` + `custom: ShareCustomization | null`; a themed preview DOM whose `[data-testid="mirror-frame"]` is the capture target for Task 6.

- [ ] **Step 1: Add theme props to `ShareMirror`**

Add to `ShareMirror`'s `Props` (after `frameRef?`):

```ts
  /** Active theme id — drives the replica's surfaces. */
  readonly themeId: ThemeId
  /** Resolved customization for pattern themes; null for fixed 'work' themes. */
  readonly custom: ShareCustomization | null
```

Import: `import type { ThemeId } from '@/lib/board/types'` and `import type { ShareCustomization } from '@/lib/share/types-v2'` and `import { patternSvgDataUri } from '@/lib/board/theme-customization'`.

- [ ] **Step 2: Compute themed surface styles**

Inside the component body, derive style objects:

```ts
const PARCHMENT = "url('/themes/paper-atelier/parchment-bg.png')"
const isPaper = themeId === 'paper-atelier'
const edgeStyle: CSSProperties = isPaper
  ? { backgroundColor: '#e9dfc8', backgroundImage: PARCHMENT, backgroundSize: 'cover' }
  : { backgroundColor: custom?.edgeColor ?? '#0a0a0a' }
const boardStyle: CSSProperties = isPaper
  ? { backgroundColor: '#efe6d2', backgroundImage: PARCHMENT, backgroundSize: 'cover' }
  : {
      backgroundColor: custom?.boardColor ?? '#0a0a0a',
      backgroundImage: custom && patternSvgDataUri(custom) ? `url("${patternSvgDataUri(custom)}")` : undefined,
      backgroundSize: custom ? `${custom.patternSize}px ${custom.patternSize}px` : undefined,
    }
const titleColor = isPaper ? 'rgba(43,39,34,0.85)' : (custom?.titleColor ?? 'rgba(255,255,255,0.95)')
const titleFont = isPaper ? 'Georgia, serif' : undefined
```

- [ ] **Step 3: Apply them to the replica surfaces**

- On `.outerBand` div: merge `style={{ ...edgeStyle, transformOrigin:'0 0', transform:`scale(${scale})`, width: bgFullScreenWidth, height: bgFullScreenHeight }}`.
- On `.canvasReplica` div: add `style={boardStyle}`.
- On the `.bgTypoText` span: add `color: titleColor, fontFamily: titleFont` to its style.
- Brand strips (`.wordmark` / `.caption` / `.tagStrip`): set `color: titleColor` so they stay legible on the themed surface.

(These are inline-style additions; the `.module.css` files are not edited, keeping default byte-identical.)

- [ ] **Step 4: Thread the props through SenderShareModal**

Add `themeId: ThemeId` + `custom: ShareCustomization | null` to `SenderShareModal`'s `Props`, and pass them to `<ShareMirror ... themeId={themeId} custom={custom} />`. In `BoardRoot.tsx`, on the `<SenderShareModal>` element, pass `themeId={themeId}` and `custom={resolvedCustom}` — `resolvedCustom` is typed `ResolvedThemeCustomization | null`, structurally the `ShareCustomization | null` the prop expects (same 6 fields), so no `?? undefined` coercion. (Both the preview `ShareMirror` and the Task 6 capture `ShareMirror` receive the same `themeId` + `custom`.)

- [ ] **Step 5: Write the test**

Create `components/share/ShareMirror.test.tsx`: render with `themeId='grid-paper'` + a grid custom; assert the `mirror-canvas-replica` testid element's inline `backgroundColor` is the boardColor and a pattern `backgroundImage` is set; render with `themeId='paper-atelier'` + `custom={null}`; assert the parchment URL is in the replica's `backgroundImage`.

```tsx
it('paints the board colour + pattern for a pattern theme', () => {
  render(<ShareMirror {...baseProps} themeId={'grid-paper'} custom={gridCustom} />)
  const rep = screen.getByTestId('mirror-canvas-replica') as HTMLElement
  expect(rep.style.backgroundColor).not.toBe('')
  expect(rep.style.backgroundImage).toContain('svg')
})
it('paints parchment for the paper theme', () => {
  render(<ShareMirror {...baseProps} themeId={'paper-atelier'} custom={null} />)
  const rep = screen.getByTestId('mirror-canvas-replica') as HTMLElement
  expect(rep.style.backgroundImage).toContain('parchment-bg.png')
})
```

- [ ] **Step 6: Run tests + tsc** — `rtk vitest run components/share/ShareMirror.test.tsx` → PASS; `rtk tsc` → clean.

- [ ] **Step 7: Visual check + commit**

Open the SHARE modal on a Grid + a Paper board (dev), confirm the preview shows the theme. Then:

```bash
rtk git add components/share/ShareMirror.tsx components/share/SenderShareModal.tsx components/board/BoardRoot.tsx components/share/ShareMirror.test.tsx
rtk git commit -m "feat(share): theme the ShareMirror preview (pattern + paper)"
```

---

## Task 6: Screenshot the visible-only themed preview into the OG image

**Files:**
- Create: `lib/share/render-share-image.ts` (dom-to-image → JPEG-under-target)
- Modify: `components/share/SenderShareModal.tsx` (hidden visible-only capture node; use new renderer; fallback)
- Test: `lib/share/render-share-image.test.ts` (the pure size-bounding helper)

**Interfaces:**
- Consumes: themed `ShareMirror` (Task 5); `dom-to-image-more` (dynamic import).
- Produces: `renderShareImage(node: HTMLElement, opts): Promise<string | null>` → base64 JPEG data URL `<= targetBytes`, or `null` on failure (caller falls back to `captureMirrorToWebP`).

- [ ] **Step 1: Create the renderer with a failing test for the size loop**

Create `lib/share/render-share-image.ts`:

```ts
// Renders a DOM node to a JPEG data URL under a byte budget via dom-to-image-more.
// dom-to-image is loaded lazily (it ships a wasm-free but sizeable bundle; only
// the share flow needs it). Returns null on any failure so the caller can fall
// back to the legacy canvas draw — sharing must never break.

export type RenderShareImageOpts = {
  readonly width: number
  readonly height: number
  readonly targetBytes: number
  readonly startQuality: number
  readonly minQuality: number
}

/** Pure: pick the first quality whose encoded size fits, else the smallest.
 *  `encode(q)` returns the dataURL at quality q (async). Exported for testing. */
export async function jpegUnderTarget(
  encode: (quality: number) => Promise<string | null>,
  targetBytes: number,
  startQuality: number,
  minQuality: number,
): Promise<string | null> {
  const STEP = 0.1
  let q = startQuality
  let last: string | null = null
  while (q >= minQuality - 1e-9) {
    const url = await encode(q)
    if (!url) return last
    last = url
    if (dataUrlBytes(url) <= targetBytes) return url
    q -= STEP
  }
  return last
}

function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - pad
}

export async function renderShareImage(node: HTMLElement, opts: RenderShareImageOpts): Promise<string | null> {
  try {
    const mod = await import('dom-to-image-more')
    const domtoimage = (mod as { default?: unknown }).default ?? mod
    const toJpeg = (domtoimage as { toJpeg: (n: HTMLElement, o: Record<string, unknown>) => Promise<string> }).toJpeg
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready
    return await jpegUnderTarget(
      (quality) => toJpeg(node, { width: opts.width, height: opts.height, quality, cacheBust: true }).catch(() => null),
      opts.targetBytes, opts.startQuality, opts.minQuality,
    )
  } catch {
    return null
  }
}
```

Test `lib/share/render-share-image.test.ts`:

```ts
import { jpegUnderTarget } from './render-share-image'
it('returns the first quality that fits the byte budget', async () => {
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(4000)   // ~3KB
  const small = 'data:image/jpeg;base64,' + 'A'.repeat(400)  // ~300B
  const out = await jpegUnderTarget((q) => Promise.resolve(q >= 0.8 ? big : small), 1024, 0.9, 0.4)
  expect(out).toBe(small)
})
it('returns the smallest when nothing fits', async () => {
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(4000)
  const out = await jpegUnderTarget(() => Promise.resolve(big), 10, 0.9, 0.7)
  expect(out).toBe(big)
})
```

- [ ] **Step 2: Run, expect FAIL then implement then PASS**

Run: `rtk vitest run lib/share/render-share-image.test.ts`
Expected: FAIL first (module/function missing) → after Step 1's file is saved, PASS.

- [ ] **Step 3: Build the hidden visible-only capture node in SenderShareModal**

In `SenderShareModal`, add a hidden, fixed 1200×628 mount that renders a SECOND `ShareMirror` with **only the visible items**, used solely for capture. Compute visible items from the same props the preview already receives:

```ts
const captureRef = useRef<HTMLDivElement | null>(null)
// Cards whose skyline rect intersects the band currently shown in the 1.91:1
// preview. Only these enter the capture DOM ⇒ the captured subtree is ~10-20
// cards, never the full board — this is what avoids the 2026 dom-to-image
// memory explosion (which pre-fetched EVERY card's image).
const visibleItems = useMemo(() => {
  const band = viewportHeight
  return items.filter((it) => {
    const p = positions.find((q) => q.id === it.id)
    return p != null && p.y + p.h > scrollY - 8 && p.y < scrollY + band + 8
  })
}, [items, positions, scrollY, viewportHeight])
```

Render (hidden, off the visual flow, but laid out so dom-to-image can measure it):

```tsx
<div style={{ position: 'fixed', left: '-99999px', top: 0, width: 1200, height: 628, pointerEvents: 'none' }} aria-hidden ref={captureRef}>
  <ShareMirror
    items={visibleItems}
    positions={positions}
    bgViewportWidth={bgViewportWidth}
    bgCanvasWidth={bgCanvasWidth}
    activeTagNames={activeTagNames}
    totalBoardCount={totalBoardCount}
    sharedCardCount={sharedCardCount}
    scrollY={scrollY}
    contentHeight={contentHeight}
    viewportHeight={viewportHeight}
    bgTypoText={bgTypoEnabled ? bgTypoText : ''}
    themeId={themeId}
    custom={custom}
  />
</div>
```

- [ ] **Step 4: Swap the capture call (with fallback)**

In `handleShareConfirm`, replace the `captureMirrorToWebP({...})` call's result with: try the new renderer over the capture node's `[data-testid="mirror-frame"]`, fall back to the legacy canvas on null.

```ts
const captureFrame = captureRef.current?.querySelector<HTMLElement>('[data-testid="mirror-frame"]') ?? null
let thumbDataUrl: string | null = null
if (captureFrame) {
  thumbDataUrl = await renderShareImage(captureFrame, { width: 1200, height: 628, targetBytes: 180 * 1024, startQuality: 0.82, minQuality: 0.4 })
}
// Fallback: the legacy hand-drawn canvas (never let sharing break).
if (!thumbDataUrl) {
  thumbDataUrl = await captureMirrorToWebP({ mirrorFrame: captureFrame, items: visibleItems.map((it) => ({ url: it.url, title: it.title, thumbnailUrl: it.thumbnailUrl })), sharedCardCount: share.cards.length, activeTagNames, totalBoardCount, bgTypoText: bgTypoEnabled ? bgTypoText : '', width: 1200, height: 628, targetBytes: 180 * 1024, startQuality: 0.82, minQuality: 0.4 })
}
```

Import `renderShareImage` at top. Keep the `captureMirrorToWebP` import (now the fallback).

- [ ] **Step 5: tsc + unit tests**

Run: `rtk tsc` → clean. `rtk vitest run lib/share/render-share-image.test.ts` → PASS. (dom-to-image itself isn't unit-tested under jsdom — it's exercised in Step 6's Playwright check, mirroring how `capture-mirror` was validated.)

- [ ] **Step 6: Visual check on real prod build (the decisive gate)**

`rtk pnpm build`, deploy to a preview, then on `allmarks.app`: Grid board → SHARE → SHARE NOW → open the resulting `/s/<id>/og` image and confirm the OG shows the grid theme; repeat for Paper (parchment must show). Also confirm a Twitter-thumbnail card falls back to a placeholder (not a crash). Compare the **default** (Sound Wave) share image to the pre-change one — it must look equivalent or better.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/share/render-share-image.ts lib/share/render-share-image.test.ts components/share/SenderShareModal.tsx
rtk git commit -m "feat(share): themed OG image via dom-to-image of the visible preview"
```

---

## Final Integration & Deploy

- [ ] **Full gate:** `rtk tsc && rtk vitest run && rtk pnpm build` — all green (note `assert-share-template` still passes).
- [ ] **Cross-theme prod smoke:** create + open shares for all 3 themes (Sound Wave default, Grid customized, Paper); verify preview = OG image = receiver page each carry the theme; default share equivalent to before.
- [ ] **Cross-browser note:** dom-to-image uses SVG `<foreignObject>`; verify on Safari if reachable. If Safari blanks, the Task 6 fallback (legacy canvas) already covers it — log the limitation in `docs/TODO.md` rather than blocking.
- [ ] **Deploy:** `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="share theming via screenshot"`.
- [ ] **Handoff docs:** append the completion narrative to `docs/TODO_COMPLETED.md`; set `docs/CURRENT_GOAL.md` to the next item (⑥ マステ/ピン配置 など).

---

## Self-Review (checked against the spec)

- **Spec §5① (payload)** → Task 1. **§5② (preview + visible-only)** → Tasks 5 + 6 Step 3. **§5③ (renderer + fallback)** → Task 6. **§5④ (receiver)** → Task 4. **§5⑤ (single-layer pattern)** → Task 3, used in Tasks 4/5. ✓ All spec sections map to a task.
- **§6 error handling**: dom-to-image fail → fallback (T6 S4); CORS → placeholder (inherited from ShareMirror's `onError`); fonts → `document.fonts.ready` (render-share-image); large boards → visible-only (T6 S3). ✓
- **§7 default byte-identical**: live board untouched; `.module.css` not edited (inline styles only); default share image verified equivalent (T6 S6). ✓
- **Type consistency**: `ShareCustomization` (T1) == shape of `ResolvedThemeCustomization` (existing) — `resolvedCustom ?? undefined` passes to `custom` in T2/T5; `patternSvgDataUri` signature identical across T3/T4/T5; `renderShareImage`/`jpegUnderTarget` names consistent T6. ✓
- **No placeholders**: every step has concrete code/commands. ✓
- **Naming**: `data-mirror-card-id`, `mirror-frame`, `mirror-canvas-replica` test ids reused verbatim from `ShareMirror.tsx`. ✓
