# Paper Atelier Theme — Full Reproduction (Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the shipped paper-atelier "core look" into a pixel-faithful full reproduction of the mockups — fiber paper background, card decorations, ruler scroll meter, four signature animations, and the MK-1 / wax-seal / letterpress chrome — without changing the default (black + sound-wave) theme by a single pixel.

**Architecture:** Build on the Plan-1 foundation already in production: `themeId` flows BoardConfig → BoardRoot state → `<html data-theme-id>` cascade → `ThemeLayer`, and each theme is a self-contained `html[data-theme-id="<id>"]` CSS token block. Plan 2 first extends the `ThemeMeta` "7-part contract" with `scrollMeterVariant` / `motion` / `decorations`, then has each subsystem (ScrollMeter, CardsLayer decoration overlay, the three animation registries, board chrome) **read those fields**. All look comes from CSS tokens consumed via `var(--token, <default>)` so the default theme is byte-identical; all new visuals are `pointer-events:none`, reduced-motion-gated, and add **zero per-frame paint** (tiling image + CSS gradients, never canvas / GPU / backdrop-filter).

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Vanilla CSS + CSS Modules · GSAP + WAAPI · IndexedDB · vitest + @testing-library/react · Playwright · Cloudflare Pages.

## Global Constraints

- TypeScript strict; **no `any`** (use `unknown` + type guards); explicit return types; JSDoc on props.
- **Vanilla CSS + CSS Modules only** — no Tailwind. **GSAP only** for JS animation — no Framer Motion. No `console.log` in prod.
- **Default theme is sacred**: every new token is defined ONLY inside `html[data-theme-id="paper-atelier"]` and consumed as `var(--token, <current-literal>)`, so `dotted-notebook` / `grid-paper` stay byte-identical. Adding a *required* `ThemeMeta` field is fine (it force-fills all 3 entries via the `Record<ThemeId, ThemeMeta>` type); adding *visual* default-theme tokens is not.
- **Animation key namespace is decoupled from `ThemeId`**: `'wave'` (default) · `'paper-drift'` · `'paper-fade'` · `'ink-underline'` · `'glitch-crt'`. Consumers resolve via `getThemeMeta(themeId).motion.{entry,text,shutdown}` — never pass a `ThemeId` straight into `getEntryAnimation` (it would hit the `default`/undefined branch).
- **Motion gating is 3-layered and all are required**: the `motionEnabled` board switch + `prefers-reduced-motion` (JS `matchMedia`) + CSS `@media (prefers-reduced-motion: reduce)`. Per-theme CSS-var time values must be **unitless numbers** (Chrome normalizes `Nms` → seconds; `parseFloat` reads `380`, not `0.38`).
- **Visibility is never driven by animation finish** (mounted == visible; WAAPI uses `fill:'none'`).
- **Performance**: the board is composite / fill-rate bound at 4K + high DPR. No always-on canvas, GPU filter, or `backdrop-filter` on the board. Decorations are `pointer-events:none` and must never change a card's box geometry (the Lightbox FLIP origin rect is the CardsLayer wrapper's `getBoundingClientRect`).
- **i18n**: any new **full-sentence** user-facing string is added to **all 15** `messages/*.json` (`ja,en,zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi`) or `messages/all-keys-parity.test.ts` fails (zero-missing / zero-extra / non-empty). ALL-CAPS chrome labels (`THEMES`, `FREE`, `MK-1`, `ARCHIVE`) stay hardcoded by the world-clear-English convention.
- **Tests**: vitest colocated. Pure helpers = bare vitest. Components = `vi.mock('@/lib/i18n/I18nProvider', () => ({ useI18n: () => ({ t: (k) => k }) }))` + `@testing-library/react`.
- **Deploy gate** (CLAUDE.md): `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler whoami` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="<ASCII>"`. Known-flaky: `tests/lib/channel.test.ts` (re-run green). Production URL: `https://allmarks.app`.
- **Calibration**: tune every color hex, texture intensity, drift amplitude, and ruler spacing against `docs/private/theme-mockups/03-paper-atelier__{board,settings,scrollmeter}.png` with an overlaid calibration grid, with a screenshot-approval gate at each stage.

---

## Post-Plan-1 reality (read before touching anything)

The design spec (`docs/superpowers/specs/2026-06-24-theme-system-paper-atelier-design.md`) §9 file-map and §3.3 wiring were written **before** Plan 1 shipped and are **stale**. Ground truth (verified by code survey, file:line below):

**Already shipped in Plan 1 — do NOT re-create:**
- `ThemeId` already includes `'paper-atelier'` (`lib/board/types.ts:3`).
- `THEME_REGISTRY` has the `paper-atelier` entry (`lib/board/theme-registry.ts:20-27`); `theme-entitlement.ts` (`isThemeUnlocked` + `EMPTY_LICENSES`) and `theme-resolve.ts` (`resolveThemeId` fallback) exist.
- `themeId` is fully wired: state seeded no-FOUC (`BoardRoot.tsx:149-156`), hydrated from IDB (`:629`), `<html data-theme-id>` side-effect (`:647-661`), `handleThemeChange` persist (`:1617-1624`), `themeMeta` derived (`:809`).
- The `html[data-theme-id="paper-atelier"]` token block exists (`app/globals.css:434-494`) with palette + `color-scheme:light` + Fraunces fonts + the **already-defined-but-unused** `--accent-gold:#b9924a` (`:463`).
- The SETTINGS **THEMES picker** exists (`components/board/ThemePicker.tsx`, mounted in `ExtensionEntry.tsx:188`) with `data-theme-button`/`data-testid` hooks.

**Genuinely missing — these are the Plan 2 build items:**
- `ThemeMeta` has **no** `scrollMeterVariant` / `motion` / `decorations` fields (`types.ts:53-63`).
- Paper background is flat color + 2 gradients only — **no** fiber texture, stains, or true vignette (`themes.module.css:14-21`); `public/themes/` and a texture generator don't exist.
- ScrollMeter has **no** variant prop; all meter colors are hardcoded (`ScrollMeter.module.css`); no `--meter-*` tokens exist anywhere.
- **No** card decoration layer (`components/board/decorations/` absent); both animation consumers hardcode `getEntryAnimation('wave')` (so paper currently gets the wave animation); `'paper-drift'`/`'ink-underline'`/`'paper-fade'` are referenced nowhere.
- **No** MK-1 plate, wax-seal "A", green "+", or letterpress wordmark treatment (the only `ALLMARKS · MK-1` string is an unrelated TUNE label at `TunePresetColumn.tsx:49`).

**Out of scope (later plans):** share theming (`buildShareData` keeps `DEFAULT_THEME_ID` at `BoardRoot.tsx:1682-1685`) = Plan 3; paid-theme key entry/validation = N-06; themes #1/#5 = same-vessel mass production after this.

---

## Decision defaults & open questions

This plan is written against two defaults the operator should confirm (each is cheap to flip — it only re-touches one task):

1. **Green "+" (§4.7) = decorative wax-seal stamp** (`pointer-events:none`, not a functional save button). Rationale: spec §4.7 lists it under decorative chrome; no save FAB exists today (saving routes through SETTINGS bookmarklet / paste / extension), and a click-dead button is a UX trap. If the operator wants it functional, Task 7 gains a handler + the existing save flow. → **Task 7**.
2. **Per-card captions = none.** The card caption labels in the board mockup ("Interior Study", "Street Market Note", …) are read as poster **sample content**, not live UI — image cards render no title today. If the operator wants a real paper caption band, that's a **new feature** added to Task 4 (a `pointer-events:none` title band per card), not a retheme. → **Task 4**.

Everything else (exact hex, texture grain, drift amplitude, ruler tick spacing) is resolved at the per-stage calibration-grid screenshot gate, not pre-decided.

---

## File Structure

**New files**
- `scripts/generate-paper-texture.mjs` — deterministic SVG paper-fiber generator (exports a pure `buildPaperFiberSvg`); writes `public/themes/paper-atelier/`. — *Task 2*
- `public/themes/paper-atelier/fiber.svg` (+ `stains.svg`) — committed generated tiles. — *Task 2*
- `components/board/scrollmeter/RulerTrack.tsx` (+ `.module.css`) — ruler/tape-measure meter track. — *Task 3*
- `components/board/decorations/paper-decorations.ts` — pure `getCardDecorations(cardId)` deterministic helper. — *Task 4*
- `components/board/decorations/PaperCardDecorations.tsx` (+ `.module.css`) — `pointer-events:none` per-card overlay. — *Task 4*
- `lib/animation/tag-entry/themes/paper.module.css` — paper-drift entry CSS-var tokens. — *Task 5*
- `lib/animation/tag-shutdown/themes/paper.module.css` — `.fade` shutdown class. — *Task 5*
- `lib/animation/text-transition/themes/ink-underline.ts` (+ `.module.css`) — ink-underline text transition. — *Task 6*
- `components/board/chrome/PaperFramePlate.tsx` (+ `.module.css`) — bottom-left "ALLMARKS MK-1 / ARCHIVE" plate. — *Task 7*
- `components/board/chrome/PaperWaxSeal.tsx` (+ `.module.css`) — bottom-right wax "A" seal + decorative "+". — *Task 7*

**Modified files**
- `lib/board/types.ts` — `ThemeMeta` + 3 fields. — *Task 1*
- `lib/board/theme-registry.ts` — fill all 3 entries. — *Task 1*
- `lib/board/constants.ts` — new `BOARD_Z_INDEX` entries (decoration + chrome). — *Tasks 4, 7*
- `app/globals.css` — paper block: `--meter-*`, `--deco-*`, `--paper-fiber-url`, lightbox scrim tokens. — *Tasks 2, 3, 4, 8*
- `components/board/themes.module.css` — `.paperAtelier` fiber + vignette + stains. — *Task 2*
- `components/board/ThemeLayer.tsx` — paper background parallax driver. — *Task 6*
- `components/board/ScrollMeter.tsx` + `.module.css` — `variant` prop + tokenize colors. — *Task 3*
- `components/board/CardsLayer.tsx` — `themeId` prop, decoration mount, `--card-radius` reconcile, motion keys. — *Tasks 4, 5*
- `components/board/BoardBackgroundTypography.tsx` + `.module.css` — `themeId` prop, motion keys, letterpress. — *Tasks 5, 7*
- `components/board/Lightbox.tsx` + `.module.css` — `themeId` prop, ink-underline, paper scrim. — *Tasks 6, 8*
- `components/board/BoardRoot.tsx` — pass `themeId`/`variant` to children; mount chrome. — *Tasks 3, 4, 5, 6, 7*
- `components/board/cards/ImageCard.tsx`, `CardSlideshow.tsx`, `lib/board/use-slideshow-cycle.ts` — paper soft-photo-shuffle cadence. — *Task 6*
- `lib/animation/tag-entry/index.ts`, `tag-shutdown/index.ts`, `text-transition/index.ts` — register paper cases. — *Tasks 5, 6*
- `components/board/ThemePicker.tsx` + `.module.css` — `role="group"` a11y + gentle locked pill. — *Task 8*
- `messages/*.json` (15) — picker group label + unlock-later sentence. — *Task 8*

---

### Task 1: Extend the ThemeMeta 7-part contract (scrollMeterVariant / motion / decorations) + fill registry + fix fixtures

**Files:**
- Modify: `lib/board/types.ts:53-63` (ThemeMeta interface — add the 3 fields)
- Modify: `lib/board/theme-registry.ts:4-27` (fill all 3 registry entries)
- Modify: `lib/board/theme-registry.test.ts:5-26` (extend the contract loop + add explicit paper-atelier asserts)
- Modify: `lib/board/theme-entitlement.test.ts:5-6` (hand-built fixtures)
- Modify: `lib/board/theme-resolve.paid.test.ts:10-13` (vi.mock REG fixtures)
- Modify: `components/board/ThemePicker.test.tsx:14-26` (vi.mock REG fixtures)

**Interfaces:**
- Consumes: nothing (this is the root task — first in the plan).
- Produces (every later task depends on these EXACT names/values, read via `getThemeMeta(themeId).…`):
  - `ThemeMeta.scrollMeterVariant: 'waveform' | 'ruler'` — read by ScrollMeter `variant` prop (Task 3) and BoardRoot wiring (Task 7).
  - `ThemeMeta.motion: { entry: string; text: string; shutdown: string }` — `entry`/`shutdown` consumed by CardsLayer (Task 4/5) + BoardBackgroundTypography (Task 5); `text` consumed by Lightbox→useTweetTranslation (Task 6). Values are animation-key-namespace strings (`'wave'`, `'paper-drift'`, `'paper-fade'`, `'ink-underline'`, `'glitch-crt'`), NOT ThemeIds.
  - `ThemeMeta.decorations?: boolean` — gates `<PaperCardDecorations/>` mount in CardsLayer (Task 4).

> **Visual note (state up-front for the reviewer):** This is a pure types + data + test task. Adding these fields has **ZERO visual effect** on the board until consumers read them — the meter still renders waveform, no decorations mount, motion still resolves to `'wave'` — because Tasks 3/4/5/6/7 are what actually read `getThemeMeta(...).scrollMeterVariant` / `.motion` / `.decorations`. Do not expect any pixel change after this task. The only observable outcomes are: `tsc` compiles, registry tests pass, and the three hand-built fixtures stop breaking `tsc`.

---

#### Sub-task 1a — Extend the `ThemeMeta` interface + fill the registry

- [ ] **Step: Write the failing test** — extend the contract loop in `lib/board/theme-registry.test.ts` and add explicit paper-atelier asserts. Replace the whole `describe` body (current L4-26) with:

```ts
describe('THEME_REGISTRY contract', () => {
  it('every theme fills the contract fields', () => {
    for (const id of listThemeIds()) {
      const m = getThemeMeta(id)
      expect(m.id).toBe(id)
      expect(typeof m.backgroundClassName).toBe('string')
      expect(m.labelKey.startsWith('board.theme.')).toBe(true)
      expect(['free', 'paid']).toContain(m.tier)
      expect(['light', 'dark']).toContain(m.colorScheme)
      // Plan 2 contract fields:
      expect(['waveform', 'ruler']).toContain(m.scrollMeterVariant)
      expect(typeof m.motion.entry).toBe('string')
      expect(typeof m.motion.text).toBe('string')
      expect(typeof m.motion.shutdown).toBe('string')
    }
  })
  it('registers paper-atelier as a free, light theme', () => {
    const m = getThemeMeta('paper-atelier')
    expect(m.colorScheme).toBe('light')
    expect(m.tier).toBe('free')
    expect(m.backgroundClassName).toBe('paperAtelier')
    expect(m.labelKey).toBe('board.theme.paperAtelier')
  })
  it('gives paper-atelier the ruler meter + paper motion set + decorations', () => {
    const m = getThemeMeta('paper-atelier')
    expect(m.scrollMeterVariant).toBe('ruler')
    expect(m.motion.entry).toBe('paper-drift')
    expect(m.motion.text).toBe('ink-underline')
    expect(m.motion.shutdown).toBe('paper-fade')
    expect(m.decorations).toBe(true)
  })
  it('keeps the two dark themes on the waveform meter + wave/glitch motion', () => {
    for (const id of ['dotted-notebook', 'grid-paper'] as const) {
      const m = getThemeMeta(id)
      expect(m.scrollMeterVariant).toBe('waveform')
      expect(m.motion.entry).toBe('wave')
      expect(m.motion.text).toBe('glitch-crt')
      expect(m.motion.shutdown).toBe('wave')
      expect(m.decorations).toBeUndefined()
    }
  })
  it('keeps the default theme dark + free', () => {
    expect(DEFAULT_THEME_ID).toBe('dotted-notebook')
    expect(getThemeMeta('dotted-notebook').colorScheme).toBe('dark')
    expect(getThemeMeta('dotted-notebook').tier).toBe('free')
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run lib/board/theme-registry.test.ts`. Expected: the `gives paper-atelier the ruler meter…` and `keeps the two dark themes…` specs fail (e.g. `expected undefined to be 'ruler'`), and the contract-loop spec fails on `expected undefined to be a string` for `m.motion.entry`. (TypeScript may also already error here — that's fine, it's the same gap.)

- [ ] **Step: Implement — extend the interface.** In `lib/board/types.ts`, replace the `ThemeMeta` type (L53-63) with the version below. Keep `id`/`direction`/`backgroundClassName`/`labelKey`/`colorScheme`/`tier`/`layoutParams` byte-identical; `layoutParams` is a dead field (never set, never read) and stays untouched:

```ts
export type ThemeMeta = {
  readonly id: ThemeId
  readonly direction: ScrollDirection
  readonly backgroundClassName: string
  readonly labelKey: string
  /** Base color scheme — drives color-scheme + which token block applies. */
  readonly colorScheme: 'light' | 'dark'
  /** Entitlement tier. 'free' = always available; 'paid' = needs a license. */
  readonly tier: 'free' | 'paid'
  /**
   * ScrollMeter rendering style. 'waveform' = the default sound-wave bars;
   * 'ruler' = the paper-atelier brass ruler track. Read by ScrollMeter's
   * `variant` prop (default 'waveform') so omitting it is impossible (required).
   */
  readonly scrollMeterVariant: 'waveform' | 'ruler'
  /**
   * Per-theme animation keys (NOT ThemeIds — a decoupled namespace:
   * 'wave' | 'paper-drift' | 'paper-fade' | 'ink-underline' | 'glitch-crt').
   * Consumers resolve via getEntryAnimation/getShutdownAnimationClass/getTextTransition.
   * @property entry    card + background-typography enter animation key
   * @property text     Lightbox tweet-translation text-transition key
   * @property shutdown card + background-typography MOTION-off exit key
   */
  readonly motion: {
    readonly entry: string
    readonly text: string
    readonly shutdown: string
  }
  /**
   * When true, mount the pointer-events:none paper card-decoration overlay
   * (washi tape / pins / photo corners). Only paper-atelier sets it. Optional:
   * absence === no decorations.
   */
  readonly decorations?: boolean
  readonly layoutParams?: ThemeLayoutParams
}
```

- [ ] **Step: Implement — fill the registry.** In `lib/board/theme-registry.ts`, replace the three entries (L4-27) with the version below. The `Record<ThemeId, ThemeMeta>` type makes the now-required `scrollMeterVariant` + `motion` fields a compile error if any entry omits them, so all three are filled to exact CONTRACT values:

```ts
export const THEME_REGISTRY: Record<ThemeId, ThemeMeta> = {
  'dotted-notebook': {
    id: 'dotted-notebook',
    direction: 'vertical',
    backgroundClassName: 'dottedNotebook',
    labelKey: 'board.theme.dottedNotebook',
    colorScheme: 'dark',
    tier: 'free',
    scrollMeterVariant: 'waveform',
    motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' },
  },
  'grid-paper': {
    id: 'grid-paper',
    direction: 'vertical',
    backgroundClassName: 'gridPaper',
    labelKey: 'board.theme.gridPaper',
    colorScheme: 'dark',
    tier: 'free',
    scrollMeterVariant: 'waveform',
    motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' },
  },
  'paper-atelier': {
    id: 'paper-atelier',
    direction: 'vertical',
    backgroundClassName: 'paperAtelier',
    labelKey: 'board.theme.paperAtelier',
    colorScheme: 'light',
    tier: 'free',
    scrollMeterVariant: 'ruler',
    motion: { entry: 'paper-drift', text: 'ink-underline', shutdown: 'paper-fade' },
    decorations: true,
  },
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run lib/board/theme-registry.test.ts`. Expected: all 5 specs pass (contract loop, paper free/light, paper ruler+motion+decorations, dark-themes waveform+wave/glitch, default dark+free).

- [ ] **Step: Commit** — `rtk git add lib/board/types.ts lib/board/theme-registry.ts lib/board/theme-registry.test.ts && rtk git commit -m "feat(theme): add scrollMeterVariant/motion/decorations to ThemeMeta + fill registry"`

---

#### Sub-task 1b — Repair the three hand-built `ThemeMeta` fixtures (so `tsc` is green)

> These fixtures construct `ThemeMeta` objects by hand (not via the registry), so adding the two required fields breaks their `tsc` typecheck. They are separate test files, so 1a's `vitest run` of *only* the registry test won't surface them — `rtk tsc` will. Give each fixture the dark-theme defaults (`scrollMeterVariant: 'waveform'` + `motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' }`); the entitlement/resolve/picker tests don't assert on the new fields, so the values just need to satisfy the type.

- [ ] **Step: Run it, expect FAIL** — `rtk tsc`. Expected: 4 errors across the 3 fixture files, e.g. `Property 'scrollMeterVariant' is missing in type '{ id: ...; ... }' but required in type 'ThemeMeta'.` at `lib/board/theme-entitlement.test.ts:5`, `lib/board/theme-resolve.paid.test.ts:11` and `:12`, `components/board/ThemePicker.test.tsx:16`–`:18`. (The registry + interface from 1a are correct; only the hand-built fixtures lag.)

- [ ] **Step: Implement — fix `theme-entitlement.test.ts`.** Replace L5-6 (the `free` declaration; `paid` spreads `free`, so only `free` needs the fields):

```ts
const free: ThemeMeta = { id: 'paper-atelier', direction: 'vertical', backgroundClassName: 'paperAtelier', labelKey: 'board.theme.paperAtelier', colorScheme: 'light', tier: 'free', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } }
const paid: ThemeMeta = { ...free, id: 'grid-paper', tier: 'paid' }
```

- [ ] **Step: Implement — fix `theme-resolve.paid.test.ts`.** Replace the `REG` object body inside `vi.mock` (L11-12):

```ts
    'free-a': { id: 'free-a', direction: 'vertical', backgroundClassName: 'a', labelKey: 'board.theme.freeA', colorScheme: 'dark', tier: 'free', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
    'paid-x': { id: 'paid-x', direction: 'vertical', backgroundClassName: 'x', labelKey: 'board.theme.paidX', colorScheme: 'light', tier: 'paid', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
```

- [ ] **Step: Implement — fix `ThemePicker.test.tsx`.** Replace the `REG` object body inside `vi.mock('@/lib/board/theme-registry', …)` (L16-18):

```ts
    'free-a': { id: 'free-a', direction: 'vertical', backgroundClassName: 'a', labelKey: 'board.theme.freeA', colorScheme: 'dark', tier: 'free', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
    'free-b': { id: 'free-b', direction: 'vertical', backgroundClassName: 'b', labelKey: 'board.theme.freeB', colorScheme: 'dark', tier: 'free', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
    'paid-x': { id: 'paid-x', direction: 'vertical', backgroundClassName: 'x', labelKey: 'board.theme.paidX', colorScheme: 'light', tier: 'paid', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
```

- [ ] **Step: Run, expect PASS (tsc)** — `rtk tsc`. Expected: zero errors (interface, registry, and all three fixtures now agree).

- [ ] **Step: Run, expect PASS (touched fixture tests)** — `rtk vitest run lib/board/theme-entitlement.test.ts lib/board/theme-resolve.paid.test.ts components/board/ThemePicker.test.tsx`. Expected: all pass unchanged (these specs never assert on the new fields, so behavior is identical — only their inline `ThemeMeta` literals were completed to satisfy the type).

- [ ] **Step: Commit** — `rtk git add lib/board/theme-entitlement.test.ts lib/board/theme-resolve.paid.test.ts components/board/ThemePicker.test.tsx && rtk git commit -m "test(theme): complete hand-built ThemeMeta fixtures with new required fields"`

---

#### Sub-task 1c — Full deploy gate (whole-suite green before the next task builds on this)

- [ ] **Step: Run the full type + test gate** — `rtk tsc && rtk vitest run`. Expected: tsc clean, every vitest spec passes (including `messages/all-keys-parity.test.ts` — this task added NO user-facing sentences, so all 15 locales stay in parity; confirm zero-missing/zero-extra still holds).
- [ ] **Step: Run the build gate** — `rtk pnpm build`. Expected: `next build` completes and emits `out/` (static export). No new pages/components were added, so the route set is unchanged.

> No Playwright / calibration-grid step for Task 1: it changes only types + data + tests, with **zero rendered output**. The first visual + calibration verification arrives in Task 3 (ruler meter) and Task 4 (decorations), which actually consume these fields against `docs/private/theme-mockups/03-paper-atelier__{board,scrollmeter}.png`.

---

### Task 2: Paper background — fiber texture generator + stains + true vignette

**Files:**
- Create: `scripts/generate-paper-texture.mjs`
- Create: `scripts/generate-paper-texture.test.ts`
- Create: `public/themes/paper-atelier/fiber.svg` (generated, committed)
- Modify: `app/globals.css:434-494` (add `--paper-fiber-url` inside the existing `html[data-theme-id="paper-atelier"]` block)
- Modify: `components/board/themes.module.css:14-21` (rewrite `.paperAtelier`)

**Interfaces:**
- Consumes: the `html[data-theme-id="paper-atelier"]` token block (`app/globals.css:434-494`) and the existing `--bg-dark: #efe6d2` (L438) it defines; the `.paperAtelier` background class wired through `ThemeLayer` (`components/board/ThemeLayer.tsx:16` `themeStyles[meta.backgroundClassName]`, registry value `'paperAtelier'` at `lib/board/theme-registry.ts:23`); the mulberry32 PRNG seeding style from `scripts/generate-placeholder-art.mjs:47-55`.
- Produces: a PURE exported `buildPaperFiberSvg(seed: number, opts?: PaperFiberOpts): string` (later regeneration / tests rely on its determinism and signature); the new CSS token `--paper-fiber-url` (paper-only) and the committed tile `/themes/paper-atelier/fiber.svg`. No component-prop or registry surface changes (those are other tasks).

This task is split into **2a** (the pure generator + its committed asset) and **2b** (wiring the asset + stains + vignette into the paper background CSS).

---

#### Task 2a — Fiber texture generator (pure function + committed SVG)

- [ ] **Step: Write the failing test** — create `scripts/generate-paper-texture.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildPaperFiberSvg } from './generate-paper-texture.mjs'

describe('generate-paper-texture / buildPaperFiberSvg', () => {
  it('is deterministic — same seed produces a byte-identical string', () => {
    expect(buildPaperFiberSvg(701)).toBe(buildPaperFiberSvg(701))
  })

  it('produces different output for a different seed', () => {
    expect(buildPaperFiberSvg(701)).not.toBe(buildPaperFiberSvg(702))
  })

  it('emits a tiling SVG with the expected width/height/viewBox', () => {
    const svg = buildPaperFiberSvg(701)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="160" height="160"')
    expect(svg).toContain('viewBox="0 0 160 160"')
  })

  it('emits exactly the requested speckle count (one <circle> per fiber fleck)', () => {
    const svg = buildPaperFiberSvg(701, { speckles: 220 })
    const circles = svg.match(/<circle\b/g) ?? []
    expect(circles.length).toBe(220)
  })

  it('uses ONLY low-alpha ink/cream flecks (no opaque fill on flecks)', () => {
    const svg = buildPaperFiberSvg(701)
    // every circle opacity is < 0.2 so the tile reads as faint grain, never specks of solid color
    const opacities = [...svg.matchAll(/<circle[^>]*opacity="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(opacities.length).toBeGreaterThan(0)
    expect(Math.max(...opacities)).toBeLessThan(0.2)
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run scripts/generate-paper-texture.test.ts`. Expected failure: `Failed to resolve import "./generate-paper-texture.mjs"` (the module does not exist yet).

- [ ] **Step: Implement the generator** — create `scripts/generate-paper-texture.mjs` with the COMPLETE code below. It mirrors `generate-placeholder-art.mjs` exactly: same `mulberry32` `rng(seed)` (L47-55), `node:fs` only (no deps), an `emit()` that `mkdirSync` + `writeFileSync`, and the grain style of N low-opacity circles (L117-130). The pure `buildPaperFiberSvg` is exported for the test; `main()` writes the file and only runs when invoked as a script.

```js
// scripts/generate-paper-texture.mjs
// ──────────────────────────────────────────────────────────────────────────
// Generates the paper-atelier FIBER TILE as a tiny, seamless, repeatable SVG.
// Run once and commit the output:
//
//   node scripts/generate-paper-texture.mjs
//
// Output: public/themes/paper-atelier/fiber.svg
//
// The tile is 160×160 and is meant to be `background-repeat` across the whole
// board canvas. It is ZERO per-frame paint cost: a static raster-able SVG drawn
// once by the compositor, NO canvas / NO GPU filter / NO backdrop-filter (the
// board is fill-rate/composite bound at 4K high-DPR — see CLAUDE.md perf rule).
//
// Look: faint cream + charcoal-ink flecks (paper fibre) over transparent, so it
// layers UNDER the parchment color (`--bg-dark: #efe6d2`) set by the
// .paperAtelier rule. Flecks are sub-pixel-ish and low-alpha so the parchment
// reads as "textured paper", never "speckled".
// ──────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from 'node:fs'

const TILE = 160 // tile edge in px; small enough to repeat, large enough to hide seams

// Seeded PRNG — same mulberry32 variant as generate-placeholder-art.mjs (L47-55)
// so output is deterministic / reproducible across runs.
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const d1 = (x) => Math.round(x * 10) / 10 // 1-decimal (compact markup)
const d2 = (x) => Math.round(x * 100) / 100 // 2-decimal (alpha precision)

/**
 * Build the inner-markup + <svg> wrapper for the fibre tile.
 *
 * Pure: identical (seed, opts) → identical string. Two ink tones (cream
 * highlight + charcoal ink) scattered as low-alpha circles read as paper fibre.
 *
 * @param {number} seed   PRNG seed (fixed when emitting; varied in tests).
 * @param {{ speckles?: number }} [opts]  speckles = total fleck count.
 * @returns {string} a complete, self-contained <svg> string.
 */
export function buildPaperFiberSvg(seed, opts = {}) {
  const speckles = opts.speckles ?? 320
  const r = rng(seed)
  let flecks = ''
  for (let i = 0; i < speckles; i++) {
    const x = d1(r() * TILE)
    const y = d1(r() * TILE)
    const rad = d1(0.4 + r() * 0.9) // 0.4..1.3 px — fine fibre
    // ~⅓ of flecks are charcoal ink, the rest cream highlight, both very faint.
    const ink = r() < 0.34
    const color = ink ? '#2b2722' /* CHARCOAL */ : '#fffdf6' /* CREAM */
    const alpha = ink ? d2(0.03 + r() * 0.05) /* 0.03..0.08 */ : d2(0.05 + r() * 0.09) /* 0.05..0.14 */
    flecks += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${color}" opacity="${alpha}"/>`
  }
  // Explicit width/height give the SVG an intrinsic size so it rasterises
  // correctly as a CSS background-image; transparent base so the parchment
  // color from .paperAtelier shows through.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">` +
    flecks +
    `</svg>`
  )
}

// Fixed seed → reproducible committed output.
const FIBER_SEED = 701

function main() {
  const dir = 'public/themes/paper-atelier'
  mkdirSync(dir, { recursive: true })
  const svg = buildPaperFiberSvg(FIBER_SEED)
  writeFileSync(`${dir}/fiber.svg`, svg)
  console.log(`wrote ${dir}/fiber.svg (${svg.length} bytes)`)
}

// Only write the file when run directly (`node scripts/generate-paper-texture.mjs`),
// not when imported by the test.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate-paper-texture.mjs')) {
  main()
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run scripts/generate-paper-texture.test.ts`. All 5 tests pass (determinism, seed-variance, svg header, exact speckle count, low-alpha invariant).

- [ ] **Step: Generate + commit the asset** — `node scripts/generate-paper-texture.mjs` (writes `public/themes/paper-atelier/fiber.svg`). Confirm it printed a byte count and that the file exists.

- [ ] **Step: Commit** — `rtk git add scripts/generate-paper-texture.mjs scripts/generate-paper-texture.test.ts public/themes/paper-atelier/fiber.svg && rtk git commit -m "feat(theme): paper-atelier fiber-tile generator + committed fiber.svg"`

---

#### Task 2b — Wire fiber tile + stains + true vignette into the paper background

- [ ] **Step: Write the failing test** — add a CSS-token presence guard so the new token is never silently dropped. Create `scripts/generate-paper-texture.css.test.ts` (colocated, plain vitest reading the source files via `node:fs`):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const globals = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8')
const themes = readFileSync(resolve(__dirname, '../components/board/themes.module.css'), 'utf8')

describe('paper-atelier background wiring', () => {
  it('defines --paper-fiber-url ONLY inside the paper-atelier block, pointing at the committed tile', () => {
    const block = globals.match(/html\[data-theme-id="paper-atelier"\]\s*\{[\s\S]*?\n\}/)
    expect(block, 'paper-atelier block must exist').toBeTruthy()
    expect(block![0]).toContain('--paper-fiber-url:')
    expect(block![0]).toContain('/themes/paper-atelier/fiber.svg')
    // not leaked into the default cascade
    const occurrences = globals.match(/--paper-fiber-url:/g) ?? []
    expect(occurrences.length).toBe(1)
  })

  it('.paperAtelier consumes the fiber url via var() so the DEFAULT theme stays unaffected', () => {
    const rule = themes.match(/\.paperAtelier\s*\{[\s\S]*?\n\}/)
    expect(rule, '.paperAtelier rule must exist').toBeTruthy()
    expect(rule![0]).toContain('var(--paper-fiber-url')
    expect(rule![0]).toContain('background-repeat: repeat')
  })

  it('.paperAtelier adds an inset edge vignette (charcoal at the rim only)', () => {
    const rule = themes.match(/\.paperAtelier\s*\{[\s\S]*?\n\}/)!
    expect(rule[0]).toContain('rgba(43, 39, 34, 0.10)')
    expect(rule[0]).toMatch(/radial-gradient\(\s*ellipse/)
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run scripts/generate-paper-texture.css.test.ts`. Expected failures: `--paper-fiber-url:` not found in the paper block; `.paperAtelier` rule contains neither `var(--paper-fiber-url` nor `background-repeat: repeat` nor the vignette rgba.

- [ ] **Step: Implement — add the token to globals.css** — inside the existing `html[data-theme-id="paper-atelier"]` block, after the `--accent-gold` line (`app/globals.css:463`). Insert:

```css
  /* fibre texture tile — generated once by scripts/generate-paper-texture.mjs,
     consumed by .paperAtelier via var(); paper-only so the default theme is
     byte-identical (.paperAtelier reads var(--paper-fiber-url, none)). */
  --paper-fiber-url: url("/themes/paper-atelier/fiber.svg");
```

The exact anchor to edit (after `--accent-gold: #b9924a; /* GOLD PEEL ... */` on L463, before the `/* floating chrome text ... */` comment on L465):

```css
  --accent-gold: #b9924a;            /* GOLD PEEL (used by paper decorations in Plan 2) */

  /* fibre texture tile — generated once by scripts/generate-paper-texture.mjs,
     consumed by .paperAtelier via var(); paper-only so the default theme is
     byte-identical (.paperAtelier reads var(--paper-fiber-url, none)). */
  --paper-fiber-url: url("/themes/paper-atelier/fiber.svg");

  /* floating chrome text (ScrollMeter counter / buttons) — ink on paper */
```

- [ ] **Step: Implement — rewrite `.paperAtelier`** — replace `components/board/themes.module.css:14-21` (the current flat-color + 2-gradient rule) with the COMPLETE rule below. Layer order top-to-bottom in CSS = front-to-back: highlights first (kept from Plan 1), then off-center stains, then the inset edge vignette, then the fibre tile last so it sits UNDER the colour washes; `--bg-dark` supplies the parchment base. The fibre layer uses `var(--paper-fiber-url, none)` so the DEFAULT theme (which never defines the token) renders `none` and stays byte-identical. The fibre layer is the ONLY one with `background-repeat: repeat` + a fixed `background-size` (the tile edge); all gradient layers `no-repeat / cover`:

```css
.paperAtelier {
  background-color: var(--bg-dark); /* PARCHMENT base */
  /* Plan 2: parchment = colour washes (highlight + stains) + an inset edge
     vignette ON TOP OF a repeating fibre tile. All static — ZERO per-frame
     paint, NO canvas / GPU / backdrop-filter (board is fill-rate bound at 4K). */
  background-image:
    /* top ivory highlight (kept from Plan 1) */
    radial-gradient(120% 90% at 50% 0%, rgba(255, 253, 246, 0.45), transparent 60%),
    /* faint bottom wash (kept from Plan 1) */
    radial-gradient(140% 120% at 50% 100%, rgba(43, 39, 34, 0.06), transparent 55%),
    /* large off-center coffee-ish stains — low alpha, irregular placement */
    radial-gradient(38% 30% at 22% 34%, rgba(140, 110, 64, 0.05), transparent 70%),
    radial-gradient(46% 40% at 78% 68%, rgba(110, 92, 60, 0.045), transparent 72%),
    radial-gradient(30% 26% at 60% 14%, rgba(120, 96, 56, 0.035), transparent 70%),
    /* true inset edge vignette — darkens only the rim, transparent center */
    radial-gradient(ellipse at center, transparent 55%, rgba(43, 39, 34, 0.10) 100%),
    /* fibre tile (under everything) — default theme has no --paper-fiber-url → none */
    var(--paper-fiber-url, none);
  background-repeat:
    no-repeat,
    no-repeat,
    no-repeat,
    no-repeat,
    no-repeat,
    no-repeat,
    repeat;
  background-size:
    auto,
    auto,
    auto,
    auto,
    auto,
    auto,
    160px 160px;
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run scripts/generate-paper-texture.css.test.ts`. All 3 CSS-wiring tests pass.

- [ ] **Step: Run the deploy gate (no regressions)** — `rtk tsc && rtk vitest run && rtk pnpm build`. tsc clean (CSS changes don't touch types but the new `.mjs`/`.test.ts` must not break), all vitest pass, `out/` built (`pnpm build` — `rtk next build` does NOT static-export per memory). Confirm `out/themes/paper-atelier/fiber.svg` was copied into the export.

- [ ] **Step: Playwright getComputedStyle verification** — write `/tmp` Playwright script (user viewport per their environment: `viewport: { width: 1489, height: 679 }`, `deviceScaleFactor: 2.58`) that loads the board, switches to the paper-atelier theme (SETTINGS → THEMES picker shipped Plan 1), and asserts the background actually applied:

```js
// /tmp/verify-paper-bg.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1489, height: 679 }, deviceScaleFactor: 2.58 })
await page.goto('http://localhost:3000/board')
// activate paper-atelier (set the cascade attribute the way BoardRoot does)
await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'paper-atelier'))
const bg = await page.evaluate(() => {
  const el = document.querySelector('[class*="paperAtelier"]')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { image: cs.backgroundImage, repeat: cs.backgroundRepeat, color: cs.backgroundColor }
})
console.log(JSON.stringify(bg, null, 2))
// expect: image contains url("...fiber.svg") AND multiple gradient(...) entries;
// repeat ends with "repeat"; color == rgb(239, 230, 210) (=#efe6d2 parchment)
await browser.close()
```

Run `rtk pnpm dev` in the background first, then `node /tmp/verify-paper-bg.mjs`. Confirm `image` contains both `fiber.svg` and the `radial-gradient` layers, `repeat` ends in `repeat`, and `color` is `rgb(239, 230, 210)`.

- [ ] **Step: Calibration-grid screenshot vs the mockup** — extend the script to overlay a calibration grid and screenshot, then compare against the board mockup background:

```js
await page.addStyleTag({ content: `
  body::after { content:''; position:fixed; inset:0; pointer-events:none; z-index:99999;
    background-image:
      repeating-linear-gradient(to right, rgba(0,0,0,.18) 0 1px, transparent 1px 80px),
      repeating-linear-gradient(to bottom, rgba(0,0,0,.18) 0 1px, transparent 1px 80px); }
`})
await page.screenshot({ path: '/tmp/paper-bg-calibrated.png', fullPage: false })
```

Open `/tmp/paper-bg-calibrated.png` and `docs/private/theme-mockups/03-paper-atelier__board.png` side by side. Verify against the mockup: the parchment hue matches `#efe6d2`, the fibre grain is visible but subtle (paper, not noise), stains read as faint warm patches (not blobs), and the edge vignette darkens only the rim. Adjust the stain/vignette alpha literals in `.paperAtelier` and/or the `speckles`/alpha ranges in `buildPaperFiberSvg` (re-run `node scripts/generate-paper-texture.mjs` and re-commit `fiber.svg`) until it matches. **Get per-stage user approval of this screenshot before finalizing** (UI changes require user sign-off per `.claude/rules/ui-design.md`).

- [ ] **Step: Commit** — `rtk git add app/globals.css components/board/themes.module.css scripts/generate-paper-texture.css.test.ts public/themes/paper-atelier/fiber.svg && rtk git commit -m "feat(theme): layer paper fiber tile + stains + inset vignette under .paperAtelier"` (include `fiber.svg` again only if calibration regenerated it).

---

### Task 3: ScrollMeter — tokenize colors + ruler/tape-measure variant (RulerTrack) wired to both call sites

**Files:**
- Modify: `components/board/ScrollMeter.tsx:82-114` (Props — add `variant`), `components/board/ScrollMeter.tsx:152-167` (destructure + `variantRef`), `components/board/ScrollMeter.tsx:399-422` (gate per-tick height writes), `components/board/ScrollMeter.tsx:339-379` (expose `centerTickIdx` to a marker via ref), `components/board/ScrollMeter.tsx:549-607` (JSX — branch waveform vs RulerTrack, add `data-meter-variant`)
- Modify: `components/board/ScrollMeter.module.css:41` (font token), `:78` (`.meterDim`), `:186` (`.baseline`), `:198` (`.tick`), `:211-212` (`.hoverLine`), `:157-160` (`.track` — add ruler height accommodation) — tokenize to `--meter-*` with var-fallback = current literal
- Create: `components/board/scrollmeter/RulerTrack.tsx`
- Create: `components/board/scrollmeter/RulerTrack.module.css`
- Modify: `components/board/BoardRoot.tsx:2237-2246` (pass `variant={themeMeta.scrollMeterVariant}`; `themeMeta` at L809)
- Modify: `components/share/SharedBoard.tsx:511-518` (pass `variant` from `getThemeMeta(themeId).scrollMeterVariant`; `themeId` at L381) + add `getThemeMeta` import
- Modify: `app/globals.css:434-494` (add `--meter-ruler-*` ruler colors inside the paper block)
- Test: `components/board/ScrollMeter.test.tsx:1-91` (add ruler-variant + variant-default cases; keep the 3 existing green)
- Test: `components/board/scrollmeter/RulerTrack.test.tsx` (NEW — pure render + a11y)

**Interfaces:**
- **Consumes (from Task 1/2):** `ThemeMeta.scrollMeterVariant: 'waveform' | 'ruler'` (lib/board/types.ts); `getThemeMeta(themeId).scrollMeterVariant` resolving to `'waveform'` for `dotted-notebook`/`grid-paper` and `'ruler'` for `paper-atelier` (lib/board/theme-registry.ts). CSS tokens `--meter-ruler-marker` (`#b9924a`), `--meter-ruler-numeral` (`#2b2722`), `--meter-ruler-rule` (`rgba(43,39,34,0.45)`) defined in the paper block.
- **Produces (later tasks rely on):** `ScrollMeter` now accepts `readonly variant?: 'waveform' | 'ruler'` (default `'waveform'`). `RulerTrack` component at `components/board/scrollmeter/RulerTrack.tsx` with signature `RulerTrack({ markerRef }: { readonly markerRef: RefObject<HTMLDivElement> }): ReactElement`. New `--meter-*` tokens consumable elsewhere with default = current literal.

---

#### Sub-task 3a: Tokenize ScrollMeter colors (waveform stays byte-identical)

This is a pure refactor — no visual change on the default theme. Tokens default to the exact current literal via `var(--token, <literal>)`, so the rendered bytes are unchanged for `dotted-notebook`/`grid-paper`. The paper theme overrides come in 3c.

- [ ] **Step: Write the failing test** — assert the meter still renders 150 ticks AND the new tokens are referenced (we can't assert computed colors in jsdom, so assert the *structure* survives and add a token-presence check via reading the CSS module source). Add to `components/board/ScrollMeter.test.tsx`:

```tsx
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('ScrollMeter color tokenization (waveform default unchanged)', () => {
  const css = readFileSync(
    resolve(__dirname, 'ScrollMeter.module.css'),
    'utf8',
  )

  it('drives baseline/tick/hoverLine/meterDim colors through --meter-* tokens with the current literal as the var() fallback', () => {
    // baseline default literal preserved as the fallback
    expect(css).toContain('var(--meter-baseline-color, rgba(255, 255, 255, 0.18))')
    expect(css).toContain('var(--meter-tick-color, rgba(255, 255, 255, 0.55))')
    expect(css).toContain('var(--meter-hover-line-color, rgba(255, 255, 255, 0.5))')
    expect(css).toContain('var(--meter-hover-line-shadow, rgba(255, 255, 255, 0.3))')
    expect(css).toContain('var(--meter-dim-color, rgba(255, 255, 255, 0.6))')
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/ScrollMeter.test.tsx -t "drives baseline"`. Expected failure: `expected '… background: rgba(255, 255, 255, 0.18); …' to contain 'var(--meter-baseline-color, rgba(255, 255, 255, 0.18))'` (the raw literals are still hardcoded).

- [ ] **Step: Implement** — edit `components/board/ScrollMeter.module.css`. Replace the five hardcoded color literals with token + literal-fallback (and tokenize the counter font to `--font-mono` with the current stack as fallback so default Geist-Mono renders and paper inherits the paper `--font-mono`).

`.meterCounter` font (L41):
```css
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace);
```

`.meterDim` (L77-79):
```css
.meterDim {
  color: var(--meter-dim-color, rgba(255, 255, 255, 0.6));
}
```

`.baseline` background (L186):
```css
  background: var(--meter-baseline-color, rgba(255, 255, 255, 0.18));
```

`.tick` background (L198):
```css
  background: var(--meter-tick-color, rgba(255, 255, 255, 0.55));
```

`.hoverLine` background + box-shadow (L211-212):
```css
  background: var(--meter-hover-line-color, rgba(255, 255, 255, 0.5));
  box-shadow: 0 0 4px var(--meter-hover-line-shadow, rgba(255, 255, 255, 0.3));
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/ScrollMeter.test.tsx`. All 4 (3 existing + 1 new) pass.

- [ ] **Step: Playwright getComputedStyle regression — default theme byte-identical** — write `/tmp/meter-default-color.spec.ts` that loads `/board` (default `dotted-notebook`), waits for `[data-testid="scroll-meter"]`, and reads computed colors:
```ts
const baselineColor = await page.evaluate(() =>
  getComputedStyle(document.querySelector('[data-testid="scroll-meter"] > div')!).backgroundColor)
// expect 'rgb(255, 255, 255)' with alpha — i.e. rgba(255,255,255,0.18) → "rgba(255, 255, 255, 0.18)"
```
Confirm `.baseline` resolves to `rgba(255, 255, 255, 0.18)`, `.tick` to `rgba(255, 255, 255, 0.55)` — proving the fallback path keeps the default unchanged. Record the exact strings in the PR notes.

- [ ] **Step: Commit** — `rtk git add components/board/ScrollMeter.module.css components/board/ScrollMeter.test.tsx && rtk git commit -m "refactor(meter): tokenize ScrollMeter colors to --meter-* with literal var() fallbacks"`

---

#### Sub-task 3b: Add the `variant` prop + RulerTrack (paper ruler) + per-tick gating

- [ ] **Step: Write the failing test (RulerTrack pure render)** — create `components/board/scrollmeter/RulerTrack.test.tsx`:

```tsx
import { createRef } from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RulerTrack } from './RulerTrack'

describe('RulerTrack', () => {
  it('renders aria-hidden ruler ticks + numerals + a brass marker bound to markerRef', () => {
    const markerRef = createRef<HTMLDivElement>()
    const { getByTestId, queryAllByTestId } = render(<RulerTrack markerRef={markerRef} />)
    const root = getByTestId('ruler-track')
    expect(root.getAttribute('aria-hidden')).toBe('true')
    // major ruler ticks (every 10 units across 0..100) → at least the numerals
    expect(queryAllByTestId('ruler-numeral').length).toBeGreaterThan(0)
    // marker element is wired to the forwarded ref so the parent rAF can position it
    expect(markerRef.current).not.toBeNull()
    expect(markerRef.current?.getAttribute('data-testid')).toBe('ruler-marker')
  })

  it('marks every child pointer-events:none (decorative, never steals scrub)', () => {
    const markerRef = createRef<HTMLDivElement>()
    const { getByTestId } = render(<RulerTrack markerRef={markerRef} />)
    const root = getByTestId('ruler-track')
    // inline style guard on the marker (CSS module pointer-events not computed in jsdom)
    expect((getByTestId('ruler-marker') as HTMLElement).style.pointerEvents).toBe('none')
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/scrollmeter/RulerTrack.test.tsx`. Expected failure: `Cannot find module './RulerTrack'`.

- [ ] **Step: Implement RulerTrack CSS module** — create `components/board/scrollmeter/RulerTrack.module.css`. A tape-measure: major ticks every 10 units (taller) with a Geist-Mono numeral above, minor ticks every 2 units (short), a thin top rule, and a brass triangular marker the parent positions by `left %`. All decorative.

```css
/* Paper "ruler / tape-measure" meter track. Static — only the brass marker
   is repositioned each frame by the parent rAF (via the forwarded markerRef).
   Lives only on the paper-atelier theme (rendered when variant === 'ruler').
   Every element is pointer-events:none; the parent .track keeps the real
   scrub hit-area. Colors come from the paper-block --meter-ruler-* tokens
   defined in globals.css; a neutral fallback keeps it visible off-theme. */

.rail {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* The horizontal rule the ruler ticks hang from (top edge of the tape). */
.rule {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4px;
  height: 1px;
  background: var(--meter-ruler-rule, rgba(43, 39, 34, 0.45));
  pointer-events: none;
}

/* Minor tick (every 2 units): short vertical line rising from the rule. */
.minorTick {
  position: absolute;
  bottom: 5px;
  width: 1px;
  height: 4px;
  background: var(--meter-ruler-rule, rgba(43, 39, 34, 0.45));
  transform: translateX(-0.5px);
  pointer-events: none;
}

/* Major tick (every 10 units): taller, full-ink. */
.majorTick {
  position: absolute;
  bottom: 5px;
  width: 1px;
  height: 9px;
  background: var(--meter-ruler-numeral, #2b2722);
  transform: translateX(-0.5px);
  pointer-events: none;
}

/* Numeral above each major tick — Geist Mono, charcoal ink. */
.numeral {
  position: absolute;
  bottom: 15px;
  transform: translateX(-50%);
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 8px;
  line-height: 1;
  letter-spacing: 0.06em;
  color: var(--meter-ruler-numeral, #2b2722);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

/* Brass position marker: a downward-pointing triangle riding the rule.
   The parent rAF sets `left: <pct>%` each frame from centerTickIdx. */
.marker {
  position: absolute;
  bottom: 2px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid var(--meter-ruler-marker, #b9924a);
  transform: translateX(-50%);
  pointer-events: none;
  filter: drop-shadow(0 1px 1px rgba(43, 39, 34, 0.25));
  will-change: left;
}
```

- [ ] **Step: Implement RulerTrack component** — create `components/board/scrollmeter/RulerTrack.tsx`:

```tsx
'use client'

import { useMemo, type ReactElement, type RefObject } from 'react'
import styles from './RulerTrack.module.css'

/** Number of ruler units shown across the full track width (0..100, a
 *  percentage scale — the meter is a fraction-of-content readout, not a
 *  count). Major ticks every 10, minor ticks every 2. Decoupled from the
 *  waveform's TICK_COUNT (150): the ruler is a tape-measure, not 150 lines. */
const RULER_UNITS = 100
const MAJOR_STEP = 10
const MINOR_STEP = 2

type Props = {
  /** Forwarded ref to the brass marker triangle. The parent ScrollMeter rAF
   *  loop sets `marker.style.left = '<pct>%'` each frame from centerTickIdx,
   *  so RulerTrack itself stays static (no per-frame React renders). */
  readonly markerRef: RefObject<HTMLDivElement>
}

/**
 * Static tape-measure ruler for the paper-atelier theme. Renders major /
 * minor ruler ticks with Geist-Mono numerals and a brass marker. Purely
 * decorative — every child is pointer-events:none so the parent `.track`
 * keeps the real scrub hit-area. The only animated element is the marker,
 * positioned by the parent rAF via `markerRef`.
 */
export function RulerTrack({ markerRef }: Props): ReactElement {
  // Precompute tick positions once. Major when divisible by MAJOR_STEP,
  // otherwise minor when divisible by MINOR_STEP.
  const ticks = useMemo(
    () =>
      Array.from({ length: RULER_UNITS / MINOR_STEP + 1 }, (_, idx) => {
        const unit = idx * MINOR_STEP
        return { unit, isMajor: unit % MAJOR_STEP === 0 }
      }),
    [],
  )

  return (
    <div className={styles.rail} data-testid="ruler-track" aria-hidden="true">
      <div className={styles.rule} />
      {ticks.map(({ unit, isMajor }) => {
        const leftPct = (unit / RULER_UNITS) * 100
        return isMajor ? (
          <div key={unit}>
            <span
              className={styles.numeral}
              data-testid="ruler-numeral"
              style={{ left: `${leftPct}%` }}
            >
              {unit}
            </span>
            <div className={styles.majorTick} style={{ left: `${leftPct}%` }} />
          </div>
        ) : (
          <div
            key={unit}
            className={styles.minorTick}
            style={{ left: `${leftPct}%` }}
          />
        )
      })}
      <div
        ref={markerRef}
        className={styles.marker}
        data-testid="ruler-marker"
        style={{ left: '0%', pointerEvents: 'none' }}
      />
    </div>
  )
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/scrollmeter/RulerTrack.test.tsx`. Both pass.

- [ ] **Step: Write the failing test (ScrollMeter variant branch)** — add to `components/board/ScrollMeter.test.tsx`:

```tsx
describe('ScrollMeter variant prop', () => {
  it('defaults to waveform (150 ticks, no ruler) when variant is omitted', () => {
    const { getByTestId, queryByTestId } = render(
      <ScrollMeter mode="board" n1={1} n2={12} total={234} swellFraction={0} onScrub={() => {}} />,
    )
    const track = getByTestId('scroll-meter')
    expect(track.getAttribute('data-meter-variant')).toBe('waveform')
    expect(queryByTestId('ruler-track')).toBeNull()
    const ticks = Array.from(track.children).filter((el) => (el as HTMLElement).style.left)
    expect(ticks).toHaveLength(150)
  })

  it('renders RulerTrack and NO 150 waveform ticks when variant="ruler"', () => {
    const { getByTestId, queryAllByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={12} total={234}
        swellFraction={0} onScrub={() => {}} variant="ruler"
      />,
    )
    const track = getByTestId('scroll-meter')
    expect(track.getAttribute('data-meter-variant')).toBe('ruler')
    expect(getByTestId('ruler-track')).toBeTruthy()
    // the waveform .tick elements (1px lines with inline left) must NOT be 150
    const waveformTicks = Array.from(track.children).filter(
      (el) => (el as HTMLElement).style.left,
    )
    expect(waveformTicks).not.toHaveLength(150)
    // ruler still surfaces numerals
    expect(queryAllByTestId('ruler-numeral').length).toBeGreaterThan(0)
  })

  it('keeps the onScrub 0..1 pointer-down contract in ruler variant', () => {
    const onScrub = vi.fn()
    const { getByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={12} total={234}
        swellFraction={0} onScrub={onScrub} variant="ruler"
      />,
    )
    const track = getByTestId('scroll-meter')
    track.getBoundingClientRect = (): DOMRect => ({
      x: 0, y: 0, width: 200, height: 28, top: 0, right: 200, bottom: 28, left: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 })
    expect(track.getAttribute('data-dragging')).toBe('true')
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/ScrollMeter.test.tsx -t "variant prop"`. Expected failure: `expected null to be 'waveform'` (no `data-meter-variant` attr yet) and `RulerTrack` is not imported/rendered.

- [ ] **Step: Implement — add the prop + variantRef + markerRef** in `components/board/ScrollMeter.tsx`.

Add to `Props` (after `onScrub`, end of the type at L113):
```tsx
  /** Which meter face to render. 'waveform' = the default sound-wave ticks
   *  (dotted-notebook / grid-paper). 'ruler' = the paper-atelier tape-measure
   *  (RulerTrack). The 0..1 swellFraction-in / onScrub-out contract and the
   *  counter readout are identical across both faces. */
  readonly variant?: 'waveform' | 'ruler'
```

Add the import (top of file, after the styles import L12):
```tsx
import { RulerTrack } from './scrollmeter/RulerTrack'
```

Destructure `variant` with default in the component signature params (the destructure block ending at L151-152). Change:
```tsx
  swellFraction,
  onScrub,
}: Props): ReactElement {
```
to:
```tsx
  swellFraction,
  onScrub,
  variant = 'waveform',
}: Props): ReactElement {
```

Add the `variantRef` mirror + a `rulerMarkerRef` alongside the existing ref mirrors (after L167, the `onScrubRef` effect):
```tsx
  // Mirror variant into a ref so the single []-deps rAF loop can branch on
  // it each frame without restarting. Same idiom as modeRef/swellFractionRef.
  const variantRef = useRef<'waveform' | 'ruler'>(variant)
  useEffect(() => { variantRef.current = variant }, [variant])

  // Brass marker for the ruler variant — positioned by the rAF loop via
  // left %, mirroring how the waveform's swell rides centerTickIdx.
  const rulerMarkerRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step: Implement — gate the per-tick waveform writes + position the ruler marker** in the rAF loop (L399-422). The `centerTickIdx` is already resolved above (L339-379) for both modes; we reuse it. Replace the `for` loop block (L399-422) with a variant gate that *either* writes waveform tick heights *or* positions the brass marker:

```tsx
      const isRuler = variantRef.current === 'ruler'
      if (!isRuler) {
        for (let i = 0; i < TICK_COUNT; i++) {
          const el = tickRefs.current[i]
          if (!el) continue

          const w1 = Math.sin(t * 0.6 + i * 0.08) * 0.45
          const w2 = Math.sin(t * 1.7 + i * 0.31) * 0.30
          const w3 = Math.sin(t * 4.2 + i * 0.93) * 0.15
          const norm = (w1 + w2 + w3 + 0.9) / 1.8 // → 0..1-ish
          const baseH = 2 + norm * 8

          const dist = i - centerTickIdx
          const swell = 1
            + swellGain * Math.exp(-(dist * dist) / (2 * swellSigma * swellSigma))

          let h = baseH * swell
          if (isInteracting) {
            if (Math.random() < 0.10) {
              h = 1
            } else {
              h = h * (0.40 + Math.random() * 1.25)
            }
          }
          el.style.height = `${Math.max(1, h).toFixed(1)}px`
        }
      } else {
        // Ruler: no per-tick height writes; just slide the brass marker to the
        // centerTickIdx position (same 0..1 mapping, expressed as left %).
        const marker = rulerMarkerRef.current
        if (marker) {
          const pct = (centerTickIdx / (TICK_COUNT - 1)) * 100
          marker.style.left = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`
        }
      }
```

(Leave `swellSigma`/`swellGain`/`isInteracting`/`reducedMotion` declarations at L392-398 untouched — they sit just above this block and are referenced inside the waveform branch.)

- [ ] **Step: Implement — branch the JSX track body + add `data-meter-variant`** in `components/board/ScrollMeter.tsx`. On the `.track` div (L591-593 area), add the attribute; then branch the children. Replace the track JSX (L577-607) with:

```tsx
        <div
          ref={trackRef}
          className={styles.track}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          role="slider"
          aria-label={mode === 'lightbox' ? 'Card position' : 'Scroll position'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={swellPct}
          data-testid="scroll-meter"
          data-mode={mode}
          data-meter-variant={variant}
          data-dragging={isDragging || undefined}
        >
          {variant === 'ruler' ? (
            <RulerTrack markerRef={rulerMarkerRef} />
          ) : (
            <>
              <div className={styles.baseline} aria-hidden="true" />
              {ticks.map((i) => (
                <div
                  key={i}
                  ref={(el): void => { if (el) tickRefs.current[i] = el }}
                  className={styles.tick}
                  style={{ left: `${(i / (TICK_COUNT - 1)) * 100}%` }}
                />
              ))}
              {hoverPct !== null && !isDragging && (
                <div className={styles.hoverLine} aria-hidden="true" style={{ left: `${hoverPct}%` }} />
              )}
            </>
          )}
        </div>
```

(The hover line is intentionally waveform-only — the ruler's brass marker is its position indicator; keeping `hoverPct` out of the ruler matches the existing "lightbox advances by click, doesn't need a hover indicator" rationale at L204-205. The `ticks`/`tickRefs` are simply not rendered in ruler mode, so the gated `!isRuler` loop's `tickRefs.current[i]` lookups return `undefined` and `continue` — no crash.)

- [ ] **Step: Grow `.track` vertical room for the ruler without affecting waveform** — the ruler needs space for numerals above the rule. Numerals sit at `bottom: 15px` and font 8px, so the rule region needs ~28px. The waveform's 18px ticks are vertically centered; growing the box height would shift them. Keep the waveform untouched by giving the ruler track its own min-height via the variant attribute. Add to `components/board/ScrollMeter.module.css` after `.track[data-dragging]` (L176):

```css
/* Ruler variant needs vertical room for the numerals above the rule; the
   waveform keeps its 18px box untouched (numerals would otherwise be clipped
   or push the waveform ticks off-center). */
.track[data-meter-variant='ruler'] {
  height: 28px;
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/ScrollMeter.test.tsx components/board/scrollmeter/RulerTrack.test.tsx`. All pass (3 existing + tokenization + 3 variant + 2 RulerTrack).

- [ ] **Step: Type + full suite gate** — `rtk tsc && rtk vitest run`. No errors (note: `variant` optional means BoardRoot/SharedBoard still compile before they pass it).

- [ ] **Step: Commit** — `rtk git add components/board/ScrollMeter.tsx components/board/ScrollMeter.module.css components/board/ScrollMeter.test.tsx components/board/scrollmeter/RulerTrack.tsx components/board/scrollmeter/RulerTrack.module.css components/board/scrollmeter/RulerTrack.test.tsx && rtk git commit -m "feat(meter): add ruler variant + RulerTrack (paper tape-measure) behind variant prop"`

---

#### Sub-task 3c: Paper ruler tokens + wire both call sites

- [ ] **Step: Write the failing test (registry drives the right variant)** — this proves the wiring contract end-to-end without a browser. Add to `components/board/ScrollMeter.test.tsx`:

```tsx
import { getThemeMeta } from '@/lib/board/theme-registry'

describe('ScrollMeter variant is registry-driven', () => {
  it('renders the ruler face when fed the paper-atelier registry variant', () => {
    const variant = getThemeMeta('paper-atelier').scrollMeterVariant
    expect(variant).toBe('ruler')
    const { getByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={1} total={1}
        swellFraction={0} onScrub={() => {}} variant={variant}
      />,
    )
    expect(getByTestId('ruler-track')).toBeTruthy()
  })

  it('renders the waveform face when fed a dark-theme registry variant', () => {
    const variant = getThemeMeta('dotted-notebook').scrollMeterVariant
    expect(variant).toBe('waveform')
    const { getByTestId, queryByTestId } = render(
      <ScrollMeter
        mode="board" n1={1} n2={1} total={1}
        swellFraction={0} onScrub={() => {}} variant={variant}
      />,
    )
    expect(getByTestId('scroll-meter').getAttribute('data-meter-variant')).toBe('waveform')
    expect(queryByTestId('ruler-track')).toBeNull()
  })
})
```

- [ ] **Step: Run it, expect PASS already (if Task 1/2 shipped) or FAIL on undefined** — `rtk vitest run components/board/ScrollMeter.test.tsx -t "registry-driven"`. If Task 1/2 added `scrollMeterVariant` to the registry, these PASS immediately (the prop already works from 3b). If the field is missing, it FAILS with `expected undefined to be 'ruler'` — confirm Task 1/2 is merged first. (This test guards the cross-task contract.)

- [ ] **Step: Implement — add paper ruler color tokens** in `app/globals.css`, inside the existing `html[data-theme-id="paper-atelier"]` block. Insert after the `--accent-gold` line (L463), keeping the ALL-CAPS palette comment style:

```css
  /* scroll meter (paper "ruler" variant — RulerTrack) */
  --meter-ruler-marker: #b9924a;            /* GOLD PEEL brass marker */
  --meter-ruler-numeral: #2b2722;           /* CHARCOAL ruler numerals + major ticks */
  --meter-ruler-rule: rgba(43, 39, 34, 0.45); /* faint ink rule + minor ticks */
```

(The waveform `--meter-*` tokens from 3a are NOT redefined here — paper uses the ruler face, so `--meter-baseline-color` etc. never apply. Leaving them undefined means their literal fallbacks stay inert on paper, which is correct.)

- [ ] **Step: Implement — wire BoardRoot call site** in `components/board/BoardRoot.tsx`. `themeMeta` is already derived at L809. Pass the variant (L2238-2245):

```tsx
          <ScrollMeter
            mode={meterMode}
            n1={meterN1}
            n2={meterN2}
            total={filteredItems.length}
            swellFraction={meterSwellFraction}
            onScrub={handleMeterScrub}
            variant={themeMeta.scrollMeterVariant}
          />
```

- [ ] **Step: Implement — wire SharedBoard call site** in `components/share/SharedBoard.tsx`. Add the `getThemeMeta` import (alongside the existing `DEFAULT_THEME_ID` import from `@/lib/board/theme-registry`):

```tsx
import { DEFAULT_THEME_ID, getThemeMeta } from '@/lib/board/theme-registry'
```

(If `DEFAULT_THEME_ID` is imported on its own line, merge them; confirm the existing import path — `themeId` resolves at L381 via `data.theme ?? DEFAULT_THEME_ID`.) Then pass the variant (L511-518):

```tsx
        <ScrollMeter
          mode="board"
          n1={1}
          n2={visibleCards.length}
          total={visibleCards.length}
          swellFraction={swell}
          onScrub={handleMeterScrub}
          variant={getThemeMeta(themeId).scrollMeterVariant}
        />
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/ScrollMeter.test.tsx` (all registry-driven + variant + tokenization tests green) then `rtk tsc` (both call sites now type-check against the optional prop).

- [ ] **Step: Playwright getComputedStyle — paper ruler renders with brass marker + ink numerals** — write `/tmp/meter-ruler-paper.spec.ts`: load `/board`, open SETTINGS → THEMES, pick paper-atelier, wait for `html[data-theme-id="paper-atelier"]`, then:
```ts
const variant = await page.getAttribute('[data-testid="scroll-meter"]', 'data-meter-variant')
// expect 'ruler'
const markerColor = await page.evaluate(() =>
  getComputedStyle(document.querySelector('[data-testid="ruler-marker"]')!).borderTopColor)
// expect 'rgb(185, 146, 74)'  (= #b9924a)
const numeralColor = await page.evaluate(() =>
  getComputedStyle(document.querySelector('[data-testid="ruler-numeral"]')!).color)
// expect 'rgb(43, 39, 34)'  (= #2b2722)
const markerEvents = await page.evaluate(() =>
  getComputedStyle(document.querySelector('[data-testid="ruler-marker"]')!).pointerEvents)
// expect 'none'
```
Confirm all four. Then drag-scrub the track and assert `onScrub` still drives scroll (marker `left` % changes across frames).

- [ ] **Step: Calibration-grid against the mockup** — overlay `docs/private/theme-mockups/03-paper-atelier__scrollmeter.png` with a calibration grid and compare the live paper ruler (marker brass tone, numeral ink weight, tick spacing, rule opacity, vertical placement vs `bottom:24px`). Capture a side-by-side screenshot to `/tmp/ruler-calibration.png`. Stop for per-stage user approval of the brass hue / numeral size / tick density before finalizing; adjust `--meter-ruler-*` values or `RULER_UNITS`/`MAJOR_STEP`/font-size only if the user requests.

- [ ] **Step: Deploy gate** — `rtk tsc && rtk vitest run && rtk pnpm build`. All green, `out/` produced.

- [ ] **Step: Commit** — `rtk git add app/globals.css components/board/BoardRoot.tsx components/share/SharedBoard.tsx components/board/ScrollMeter.test.tsx && rtk git commit -m "feat(meter): add paper ruler color tokens + wire variant at both ScrollMeter call sites"`

---

### Task 4: Per-card decoration overlay (washi / pin / clip / photo-corner / stamp) — deterministic, non-interactive; thread themeId into CardsLayer

**Files:**
- Create: `components/board/decorations/paper-decorations.ts`
- Create: `components/board/decorations/paper-decorations.test.ts`
- Create: `components/board/decorations/PaperCardDecorations.tsx`
- Create: `components/board/decorations/PaperCardDecorations.module.css`
- Create: `components/board/decorations/PaperCardDecorations.test.tsx`
- Modify: `lib/board/constants.ts:53-74` (add `CARD_DECORATION` to `BOARD_Z_INDEX`)
- Modify: `app/globals.css` paper block (`html[data-theme-id="paper-atelier"]` L434-494; add `--deco-*` tokens)
- Modify: `components/board/CardsLayer.tsx` — props type L211-369, destructure L370, import line near L15/L23-24, per-card map `--card-radius` hardcode L1054 + mount inside shutdown wrapper L1063-1088
- Modify: `components/board/BoardRoot.tsx:2151` (pass `themeId` to `<CardsLayer>`)
- Test (Playwright, manual run): screenshot vs mockup + reorder/lightbox gesture survival

**Interfaces:**
- Consumes (from CONTRACT / Task 1): `ThemeMeta.decorations?: boolean` (types.ts), `getThemeMeta(themeId)` (theme-registry.ts), `--deco-washi-a/-b/-c`, `--deco-pin`, `--deco-clip`, `--deco-stamp-ink`, `--deco-photo-corner`, `--card-radius` (paper 3px), `--accent-gold`, `--color-accent-primary`. Consumes from BoardRoot: `themeId: ThemeId` state (already wired Plan 1, derived alongside `themeMeta` at L809).
- Produces (Task 5 reuses): `themeId: ThemeId` is now a `CardsLayerProps` field and `const meta = getThemeMeta(themeId)` exists inside `CardsLayer`. Produces: `getCardDecorations(cardId: string): CardDecorationSet` (pure, deterministic) and `<PaperCardDecorations cardId={...} />` (aria-hidden, pointer-events:none overlay).

---

This task is split into **4a** (pure deterministic decoration model), **4b** (overlay component + CSS + tokens), and **4c** (thread `themeId` into `CardsLayer` + mount + fix `--card-radius` hardcode). Each is independently testable.

---

#### Task 4a — Pure deterministic decoration model `getCardDecorations`

- [ ] **Step: Write the failing test** — `components/board/decorations/paper-decorations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getCardDecorations } from './paper-decorations'

describe('getCardDecorations', () => {
  it('is deterministic — same id yields a deep-equal set', () => {
    const a = getCardDecorations('bookmark-abc')
    const b = getCardDecorations('bookmark-abc')
    expect(a).toEqual(b)
    // returns a fresh object each call (no shared mutable reference)
    expect(a).not.toBe(b)
  })

  it('generally differs across ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const serialized = ids.map((id) => JSON.stringify(getCardDecorations(id)))
    const unique = new Set(serialized)
    // not all 10 collapse to one identical set
    expect(unique.size).toBeGreaterThan(1)
  })

  it('produces only valid, in-range fields', () => {
    for (const id of ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']) {
      const d = getCardDecorations(id)
      // photo corners: subset of the 4 known corners, unique
      const corners = new Set(d.photoCorners)
      expect(corners.size).toBe(d.photoCorners.length)
      for (const c of d.photoCorners) {
        expect(['tl', 'tr', 'bl', 'br']).toContain(c)
      }
      // washi: 0..2 pieces, each with a known tint + bounded angle + edge
      expect(d.washi.length).toBeGreaterThanOrEqual(0)
      expect(d.washi.length).toBeLessThanOrEqual(2)
      for (const w of d.washi) {
        expect(['a', 'b', 'c']).toContain(w.tint)
        expect(['top', 'right', 'bottom', 'left']).toContain(w.edge)
        expect(w.angleDeg).toBeGreaterThanOrEqual(-14)
        expect(w.angleDeg).toBeLessThanOrEqual(14)
        expect(w.offsetPct).toBeGreaterThanOrEqual(8)
        expect(w.offsetPct).toBeLessThanOrEqual(80)
      }
      // fastener: never both pin AND clip
      expect(!(d.pin && d.clip)).toBe(true)
      // stamp: null or a known variant + corner + bounded angle
      if (d.stamp) {
        expect(['ARCHIVE', 'REAL', 'RATED']).toContain(d.stamp.label)
        expect(['tl', 'tr', 'bl', 'br']).toContain(d.stamp.corner)
        expect(d.stamp.angleDeg).toBeGreaterThanOrEqual(-18)
        expect(d.stamp.angleDeg).toBeLessThanOrEqual(18)
      }
    }
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/decorations/paper-decorations.test.ts`. Expected: `Failed to resolve import "./paper-decorations"` (module does not exist yet).

- [ ] **Step: Implement** — create `components/board/decorations/paper-decorations.ts`. The mulberry32 seeding is copied verbatim in style from `scripts/generate-placeholder-art.mjs` L47-55, with a string→int hash (FNV-1a) so a `cardId` string seeds it:

```ts
/**
 * Pure, deterministic per-card decoration model for the paper-atelier theme.
 *
 * Same `cardId` always returns a deep-equal set, so a card's tape/pin/stamp
 * never reshuffle between renders (no flicker on reorder / lightbox close).
 * The generator is a string-seeded mulberry32 PRNG — same variant as the
 * approved placeholder-art mockup (scripts/generate-placeholder-art.mjs L47-55).
 *
 * Everything here is presentational metadata only; it never affects card box
 * geometry or hit-testing (consumed by a pointer-events:none overlay).
 */

export type DecoCorner = 'tl' | 'tr' | 'bl' | 'br'
export type WashiTint = 'a' | 'b' | 'c'
export type WashiEdge = 'top' | 'right' | 'bottom' | 'left'
export type StampLabel = 'ARCHIVE' | 'REAL' | 'RATED'

export type WashiPiece = {
  /** Which --deco-washi-{a|b|c} tint token to paint with. */
  readonly tint: WashiTint
  /** Which card edge the tape straddles. */
  readonly edge: WashiEdge
  /** Rotation of the tape strip, degrees (hand-torn look). */
  readonly angleDeg: number
  /** Position along the edge, 0..100 (% of that edge's free span). */
  readonly offsetPct: number
}

export type DecoStamp = {
  readonly label: StampLabel
  readonly corner: DecoCorner
  readonly angleDeg: number
}

export type CardDecorationSet = {
  /** Photo-album corner holders. Subset of the 4 corners (often a diagonal pair). */
  readonly photoCorners: ReadonlyArray<DecoCorner>
  /** 0..2 washi-tape strips. */
  readonly washi: ReadonlyArray<WashiPiece>
  /** Top-edge push-pin (mutually exclusive with `clip`). */
  readonly pin: boolean
  /** Top-edge bulldog clip (mutually exclusive with `pin`). */
  readonly clip: boolean
  /** Optional archival rubber stamp, or null. */
  readonly stamp: DecoStamp | null
}

/** mulberry32 — same variant as the approved mockup generator. */
function mulberry32(seed: number): () => number {
  let s = seed
  return (): number => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 32-bit string hash → stable integer seed for a cardId. */
function hashStringToSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const ALL_CORNERS: ReadonlyArray<DecoCorner> = ['tl', 'tr', 'bl', 'br']
const TINTS: ReadonlyArray<WashiTint> = ['a', 'b', 'c']
const EDGES: ReadonlyArray<WashiEdge> = ['top', 'right', 'bottom', 'left']
const STAMP_LABELS: ReadonlyArray<StampLabel> = ['ARCHIVE', 'REAL', 'RATED']

/** Pick one element of `arr` using rng in [0,1). */
function pick<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)] as T
}

/** Map rng to an integer in [min,max] inclusive. */
function intRange(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Map rng to a 1-decimal float in [min,max]. */
function floatRange(rng: () => number, min: number, max: number): number {
  return Math.round((min + rng() * (max - min)) * 10) / 10
}

/**
 * Returns the deterministic decoration set for a card.
 * @param cardId Stable bookmark id (CardNode data-card-id / it.bookmarkId).
 */
export function getCardDecorations(cardId: string): CardDecorationSet {
  const rng = mulberry32(hashStringToSeed(cardId))

  // --- Photo corners: 0, 1 (single accent), or 2 (diagonal pair). ---
  const photoCorners: DecoCorner[] = []
  const cornerRoll = rng()
  if (cornerRoll < 0.45) {
    // diagonal pair — pick one diagonal, attach both ends
    if (rng() < 0.5) {
      photoCorners.push('tl', 'br')
    } else {
      photoCorners.push('tr', 'bl')
    }
  } else if (cornerRoll < 0.7) {
    photoCorners.push(pick(rng, ALL_CORNERS))
  }
  // else: none

  // --- Washi tape: 0..2 strips, each on a distinct edge. ---
  const washiCount = (() => {
    const r = rng()
    if (r < 0.4) return 0
    if (r < 0.85) return 1
    return 2
  })()
  const usedEdges = new Set<WashiEdge>()
  const washi: WashiPiece[] = []
  for (let i = 0; i < washiCount; i++) {
    // choose an unused edge (top/bottom favoured for the "taped to wall" look)
    let edge = pick(rng, EDGES)
    let guard = 0
    while (usedEdges.has(edge) && guard < 6) {
      edge = pick(rng, EDGES)
      guard++
    }
    if (usedEdges.has(edge)) continue
    usedEdges.add(edge)
    washi.push({
      tint: pick(rng, TINTS),
      edge,
      angleDeg: floatRange(rng, -14, 14),
      offsetPct: floatRange(rng, 8, 80),
    })
  }

  // --- Fastener: pin XOR clip, biased toward "nothing" so it stays calm. ---
  const fastenerRoll = rng()
  const pin = fastenerRoll < 0.18
  const clip = !pin && fastenerRoll < 0.3

  // --- Stamp: rare archival rubber stamp in a corner. ---
  let stamp: DecoStamp | null = null
  if (rng() < 0.28) {
    stamp = {
      label: pick(rng, STAMP_LABELS),
      corner: pick(rng, ALL_CORNERS),
      angleDeg: floatRange(rng, -18, 18),
    }
  }

  return { photoCorners, washi, pin, clip, stamp }
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/decorations/paper-decorations.test.ts`. All three cases green. Note: `intRange` is exported-by-use only if referenced; it is unused here — remove it before committing to avoid a `noUnusedLocals` TS error (delete the `intRange` helper; only `floatRange`, `pick`, `mulberry32`, `hashStringToSeed` are used). Re-run after removal.

- [ ] **Step: Commit** — `rtk git add components/board/decorations/paper-decorations.ts components/board/decorations/paper-decorations.test.ts && rtk git commit -m "feat(theme): deterministic per-card paper decoration model (washi/pin/clip/corner/stamp)"`

---

#### Task 4b — `PaperCardDecorations` overlay component + CSS + paper tokens

- [ ] **Step: Add the paper decoration tokens** — in `app/globals.css`, inside the existing `html[data-theme-id="paper-atelier"] { ... }` block (L434-494), append after the existing palette tokens. Reuse `--accent-gold` (brass) and `--color-accent-primary` (FOREST) per CONTRACT; match the ALL-CAPS palette comment style:

```css
  /* --- PAPER DECORATIONS (per-card overlay, pointer-events:none) --- */
  --deco-washi-a: rgba(201, 178, 122, 0.42);   /* PALE STRAW translucent tape */
  --deco-washi-b: rgba(143, 168, 142, 0.38);   /* SAGE translucent tape */
  --deco-washi-c: rgba(196, 160, 150, 0.40);   /* DUSTY ROSE translucent tape */
  --deco-pin: var(--color-accent-primary);     /* FOREST push-pin head */
  --deco-clip: #6f6a60;                         /* WARM GRAY bulldog clip */
  --deco-stamp-ink: rgba(140, 60, 48, 0.62);   /* OXIDE RED rubber-stamp ink */
  --deco-photo-corner: rgba(43, 39, 34, 0.55); /* CHARCOAL album corner */
```

- [ ] **Step: Write the failing component test** — `components/board/decorations/PaperCardDecorations.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PaperCardDecorations } from './PaperCardDecorations'

describe('PaperCardDecorations', () => {
  it('renders an aria-hidden, pointer-events:none overlay', () => {
    const { container } = render(<PaperCardDecorations cardId="seed-1" />)
    const overlay = container.firstElementChild as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    // class-based assertion (jsdom does not compute pointer-events from CSS modules)
    expect(overlay.className.length).toBeGreaterThan(0)
  })

  it('is deterministic — same id renders identical markup', () => {
    const a = render(<PaperCardDecorations cardId="seed-X" />)
    const b = render(<PaperCardDecorations cardId="seed-X" />)
    expect(a.container.innerHTML).toBe(b.container.innerHTML)
  })

  it('renders decoration nodes consistent with the model', () => {
    // 'has-stamp' picked so the set is non-empty in practice; the overlay
    // should mount at least one decoration descendant for a typical id.
    const { container } = render(<PaperCardDecorations cardId="bookmark-rich-42" />)
    const overlay = container.firstElementChild as HTMLElement
    expect(overlay.querySelectorAll('[data-deco]').length).toBeGreaterThanOrEqual(0)
    // every decoration node is marked decorative
    overlay.querySelectorAll('[data-deco]').forEach((n) => {
      expect(n.getAttribute('aria-hidden')).not.toBe('false')
    })
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/decorations/PaperCardDecorations.test.tsx`. Expected: `Failed to resolve import "./PaperCardDecorations"`.

- [ ] **Step: Implement the CSS module** — `components/board/decorations/PaperCardDecorations.module.css`. The overlay fills the CardsLayer wrapper (so tape/pins can overhang — the wrapper has no `overflow:hidden`, unlike `.imageCard` / CardNode `.inner`). All children are `pointer-events:none`:

```css
/* Per-card paper decoration overlay. Fills the CardsLayer wrapper (NOT the
   clipped ImageCard), so overhanging tape / pins are visible. Strictly
   decorative: never receives pointer events, never changes layout. */
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* tape/pins overhang the card box by design; do not clip */
  overflow: visible;
}

.overlay * {
  pointer-events: none;
}

/* --- Photo-album corners (match the rendered card radius) --- */
.photoCorner {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 0 solid var(--deco-photo-corner, rgba(43, 39, 34, 0.55));
}
.photoCornerTl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; border-top-left-radius: var(--card-radius, 3px); }
.photoCornerTr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; border-top-right-radius: var(--card-radius, 3px); }
.photoCornerBl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; border-bottom-left-radius: var(--card-radius, 3px); }
.photoCornerBr { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; border-bottom-right-radius: var(--card-radius, 3px); }

/* --- Washi tape --- */
.washi {
  position: absolute;
  width: 76px;
  height: 22px;
  border-radius: 1px;
  opacity: 0.92;
  /* hand-torn jagged ends */
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 4px, #000 calc(100% - 4px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 4px, #000 calc(100% - 4px), transparent 100%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
.washiTintA { background: var(--deco-washi-a, rgba(201, 178, 122, 0.42)); }
.washiTintB { background: var(--deco-washi-b, rgba(143, 168, 142, 0.38)); }
.washiTintC { background: var(--deco-washi-c, rgba(196, 160, 150, 0.40)); }
.washiTop { top: -11px; }
.washiBottom { bottom: -11px; }
.washiLeft { left: -27px; transform-origin: center; }
.washiRight { right: -27px; transform-origin: center; }

/* --- Push-pin --- */
.pin {
  position: absolute;
  top: -7px;
  left: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffffff80, transparent 55%), var(--deco-pin, #2f4a37);
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.25);
}

/* --- Bulldog clip --- */
.clip {
  position: absolute;
  top: -9px;
  left: 50%;
  width: 26px;
  height: 12px;
  margin-left: -13px;
  border-radius: 2px 2px 1px 1px;
  background: linear-gradient(180deg, #9a948a, var(--deco-clip, #6f6a60));
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.22);
}

/* --- Rubber stamp --- */
.stamp {
  position: absolute;
  padding: 3px 6px;
  font-family: var(--font-mono, 'Geist Mono', monospace);
  font-size: 9px;
  letter-spacing: 0.14em;
  font-weight: 700;
  color: var(--deco-stamp-ink, rgba(140, 60, 48, 0.62));
  border: 1.5px solid var(--deco-stamp-ink, rgba(140, 60, 48, 0.62));
  border-radius: 2px;
  /* faded ink */
  opacity: 0.85;
}
.stampTl { top: 6px; left: 6px; }
.stampTr { top: 6px; right: 6px; }
.stampBl { bottom: 6px; left: 6px; }
.stampBr { bottom: 6px; right: 6px; }

@media (prefers-reduced-motion: reduce) {
  /* decorations are static — nothing to disable, listed for invariant parity */
  .overlay { }
}
```

- [ ] **Step: Implement the component** — `components/board/decorations/PaperCardDecorations.tsx`. It calls the pure `getCardDecorations` and renders the set. `aria-hidden`, every node tagged `data-deco`. Inline `transform` carries the per-piece angle/offset (deterministic from the model, so SSR/CSR markup matches):

```tsx
import type { ReactElement } from 'react'
import {
  getCardDecorations,
  type DecoCorner,
  type WashiPiece,
  type WashiEdge,
} from './paper-decorations'
import styles from './PaperCardDecorations.module.css'

/**
 * Decorative, non-interactive paper overlay for a single board card.
 *
 * Mounts only on themes with `decorations: true` (paper-atelier). The set is
 * deterministic per `cardId`, so tape/pins/stamps never reshuffle between
 * renders. Strictly presentational: `aria-hidden`, pointer-events:none, and it
 * lives in the CardsLayer wrapper (outside the card's overflow clip) so it can
 * NOT affect hit-testing, the Lightbox FLIP origin rect, or card box geometry.
 */
export function PaperCardDecorations({
  cardId,
}: {
  /** Stable bookmark id used as the deterministic seed (CardNode data-card-id). */
  readonly cardId: string
}): ReactElement {
  const set = getCardDecorations(cardId)

  return (
    <div className={styles.overlay} aria-hidden="true">
      {set.photoCorners.map((c) => (
        <span key={`pc-${c}`} data-deco="photo-corner" className={cornerClass(c)} />
      ))}

      {set.washi.map((w, i) => (
        <span
          key={`washi-${i}`}
          data-deco="washi"
          className={washiClass(w)}
          style={washiStyle(w)}
        />
      ))}

      {set.pin && <span data-deco="pin" className={styles.pin} />}
      {set.clip && <span data-deco="clip" className={styles.clip} />}

      {set.stamp && (
        <span
          data-deco="stamp"
          className={`${styles.stamp} ${stampCornerClass(set.stamp.corner)}`}
          style={{ transform: `rotate(${set.stamp.angleDeg}deg)` }}
        >
          {set.stamp.label}
        </span>
      )}
    </div>
  )
}

function cornerClass(c: DecoCorner): string {
  switch (c) {
    case 'tl':
      return `${styles.photoCorner} ${styles.photoCornerTl}`
    case 'tr':
      return `${styles.photoCorner} ${styles.photoCornerTr}`
    case 'bl':
      return `${styles.photoCorner} ${styles.photoCornerBl}`
    case 'br':
      return `${styles.photoCorner} ${styles.photoCornerBr}`
  }
}

function stampCornerClass(c: DecoCorner): string {
  switch (c) {
    case 'tl':
      return styles.stampTl
    case 'tr':
      return styles.stampTr
    case 'bl':
      return styles.stampBl
    case 'br':
      return styles.stampBr
  }
}

function washiClass(w: WashiPiece): string {
  const tint =
    w.tint === 'a' ? styles.washiTintA : w.tint === 'b' ? styles.washiTintB : styles.washiTintC
  return `${styles.washi} ${tint} ${edgeClass(w.edge)}`
}

function edgeClass(edge: WashiEdge): string {
  switch (edge) {
    case 'top':
      return styles.washiTop
    case 'bottom':
      return styles.washiBottom
    case 'left':
      return styles.washiLeft
    case 'right':
      return styles.washiRight
  }
}

function washiStyle(w: WashiPiece): Readonly<{ transform: string; left?: string; top?: string }> {
  // top/bottom strips slide horizontally; left/right strips slide vertically.
  if (w.edge === 'top' || w.edge === 'bottom') {
    return { left: `${w.offsetPct}%`, transform: `translateX(-50%) rotate(${w.angleDeg}deg)` }
  }
  return { top: `${w.offsetPct}%`, transform: `translateY(-50%) rotate(${w.angleDeg + 90}deg)` }
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/decorations/PaperCardDecorations.test.tsx`. All three cases green (aria-hidden, deterministic markup, decorative nodes).

- [ ] **Step: Verify tokens exist in the compiled paper block (Playwright getComputedStyle)** — write `/tmp/verify-deco-tokens.mjs` (run via the playwright-skill against `pnpm dev`): set `document.documentElement.dataset.themeId = 'paper-atelier'`, then `getComputedStyle(document.documentElement).getPropertyValue('--deco-washi-a')` etc. Assert all 7 `--deco-*` tokens are non-empty, and `--card-radius` resolves to `3px`. Expected: every token returns a value.

- [ ] **Step: Commit** — `rtk git add components/board/decorations/PaperCardDecorations.tsx components/board/decorations/PaperCardDecorations.module.css components/board/decorations/PaperCardDecorations.test.tsx app/globals.css && rtk git commit -m "feat(theme): paper card decoration overlay component + --deco-* tokens"`

---

#### Task 4c — Thread `themeId` into `CardsLayer`, mount decorations, fix `--card-radius` hardcode

- [ ] **Step: Add `CARD_DECORATION` to the z-index scale** — in `lib/board/constants.ts:53-74`, insert between `CARDS: 10` and `EMPTY_STATE: 12`. It must sit ABOVE the thumbnail but BELOW interactive chrome (resize handle z30, media z50), and is always rendered pointer-events:none:

```ts
export const BOARD_Z_INDEX = {
  THEME_BG: 0,
  FRAME_MASK: 5,
  CARDS: 10,
  CARD_DECORATION: 11,  // paper-atelier per-card overlay (pointer-events:none, above thumbnail, below interactive chrome)
  EMPTY_STATE: 12,
  FRAME_BORDER: 15,
  // ...unchanged
```

(The overlay sits inside each card wrapper, so this constant documents intent; apply it as the overlay's `z-index` via the CSS module by adding `z-index: var(--deco-z, 11)` — but since the overlay is already painted after `<CardNode>` in DOM order within the wrapper, the explicit value is belt-and-suspenders. Add `z-index: 11;` to `.overlay` in `PaperCardDecorations.module.css` and reference this constant in the JSDoc.)

- [ ] **Step: Write the failing CardsLayer mount test** — `components/board/decorations/PaperCardDecorations.mount.test.tsx`. This proves the gate: decorations mount only when `getThemeMeta(themeId).decorations === true`. Mock the registry so the test is hermetic:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { getThemeMeta } from '@/lib/board/theme-registry'
import { PaperCardDecorations } from './PaperCardDecorations'

// A tiny harness mirroring the CardsLayer gate: mount decorations iff
// meta.decorations === true. This documents the exact predicate CardsLayer uses.
function Harness({ themeId, cardId }: { readonly themeId: 'dotted-notebook' | 'paper-atelier'; readonly cardId: string }): ReactElement {
  const meta = getThemeMeta(themeId)
  return (
    <div data-testid="wrapper">
      <div>card body</div>
      {meta.decorations === true && <PaperCardDecorations cardId={cardId} />}
    </div>
  )
}

describe('CardsLayer decoration gate', () => {
  it('mounts NO decoration DOM on the default (decorations falsy) theme', () => {
    const { container } = render(<Harness themeId="dotted-notebook" cardId="c1" />)
    expect(container.querySelectorAll('[data-deco]').length).toBe(0)
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('mounts the decoration overlay on the paper-atelier theme', () => {
    const { container } = render(<Harness themeId="paper-atelier" cardId="c1" />)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
```

(This test depends on Task 1 having added `decorations: true` to the `paper-atelier` registry entry. If Task 1 is not yet merged, the test fails at `meta.decorations === true` returning false for paper — which is the correct red.)

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/decorations/PaperCardDecorations.mount.test.tsx`. Expected (pre-Task-1): the paper case fails because `decorations` is undefined. Post-Task-1, both pass — re-run after confirming Task 1 is in.

- [ ] **Step: Add imports to CardsLayer** — in `components/board/CardsLayer.tsx`, extend the existing type import at L15 and add the registry + component + ThemeId imports near the other `@/lib/board` imports:

```ts
import type { CardPosition, DisplayMode, ThemeId } from '@/lib/board/types'
import { getThemeMeta } from '@/lib/board/theme-registry'
import { PaperCardDecorations } from '@/components/board/decorations/PaperCardDecorations'
```

(Verify `ThemeId` is exported from `@/lib/board/types`; it is the type used in `theme-registry.ts:1`. Place `getThemeMeta`/`PaperCardDecorations` imports adjacent to the existing `getShutdownAnimationClass` import at L23-24 to keep grouping idiomatic.)

- [ ] **Step: Add `themeId` to `CardsLayerProps`** — in the `CardsLayerProps` type (starts L211), add the field with JSDoc:

```ts
  /** Active board theme id. Drives per-card decorations (meta.decorations)
   *  and, from Task 5, the entry/shutdown motion keys. */
  readonly themeId: ThemeId
```

- [ ] **Step: Destructure `themeId` and derive `meta`** — in the component signature destructure (ends L370 with `}: CardsLayerProps): ReactNode {`), add `themeId,` to the destructured props. Then immediately after `const rootRef = useRef<HTMLDivElement>(null)` (L371), add:

```ts
  const meta = getThemeMeta(themeId)
```

- [ ] **Step: Pass `themeId` from BoardRoot** — in `components/board/BoardRoot.tsx`, in the `<CardsLayer>` render (opens L2151), add the prop. `themeId` state is already in scope (Plan 1; `themeMeta` derived L809). Insert near the top of the prop list, e.g. right after `items={filteredItems}` (L2152):

```tsx
                themeId={themeId}
```

- [ ] **Step: Run typecheck, expect PASS** — `rtk tsc`. The new required `themeId` prop is now supplied by the only call site (BoardRoot L2151); no other caller exists. Expected: clean.

- [ ] **Step: Fix the `--card-radius` hardcode (paper 3px print corner)** — in `components/board/CardsLayer.tsx`, the per-card wrapper inline style at L1054 hardcodes `['--card-radius' as string]: '20px'`, which overrides paper's 3px token. Drive it from the resolved theme so paper renders the print corner while the default stays 20px. Replace L1054:

```ts
              ['--card-radius' as string]: meta.colorScheme === 'light' ? '3px' : '20px',
```

Rationale: only the paper-atelier theme is `colorScheme: 'light'` (registry L25), and its `--card-radius` token is 3px; the two dark themes keep 20px. This keeps the DEFAULT theme byte-identical (still `20px`) and makes the photo-corner decorations (which read `var(--card-radius, 3px)`) match the rendered corner. (Do NOT read the CSS var at runtime — the inline value must be deterministic for SSR. Tying it to `colorScheme` is the simplest stable mapping; if a future light theme needs 20px, switch to a `meta.cardRadiusPx` field, but that is out of scope here.)

- [ ] **Step: Mount `<PaperCardDecorations>` inside the shutdown wrapper** — in `components/board/CardsLayer.tsx`, the shutdown wrapper opens L1063 (`<div className={shutdownClass} ...>`) and contains `<CardNode>` (L1068-1088) then the receiver overlay (L1089+). Add the decorations as a pointer-events:none sibling of `<CardNode>`, immediately after the `</CardNode>` close (L1088), gated on `meta.decorations`:

```tsx
            </CardNode>
            {meta.decorations === true && (
              <PaperCardDecorations cardId={it.bookmarkId} />
            )}
```

(Seed = `it.bookmarkId`, which is the same value carried on the wrapper as `data-bookmark-id` L1019 and on `CardNode` as `data-card-id` L40 — the CONTRACT-specified seed. The overlay's `.overlay` is `position:absolute; inset:0`, so it fills the shutdown wrapper which is `position:absolute; inset:0` of the card box; tape/pins overhang via `overflow:visible` and the wrapper itself has no clip.)

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/decorations/` (all three decoration test files) and `rtk tsc`. Expected: green.

- [ ] **Step: Playwright — decorations present on paper, absent on default, and DO NOT absorb gestures** — via playwright-skill against `pnpm dev` at the developer viewport (`viewport: { width: 1489, height: 679 }`, `deviceScaleFactor: 2.58` — user's real screen, state this basis): (1) switch theme to paper-atelier via SETTINGS → THEMES; assert `document.querySelectorAll('[data-deco]').length > 0`. (2) Switch to dotted-notebook; assert `[data-deco]` count is 0. (3) Reorder-drag a card: since `board card click is blocked by setPointerCapture` (memory: `reference_board_card_click_pointer_capture`), assert non-interference structurally instead — `getComputedStyle(decoOverlay).pointerEvents === 'none'` and `elementFromPoint(cardCenterX, cardCenterY)` returns the card wrapper / CardNode, NOT a `[data-deco]` node. (4) Open the Lightbox on a paper card and confirm it opens (FLIP origin = CardsLayer wrapper rect at `use-card-reorder-drag.ts:220` is unaffected because the overlay is `inset:0` and adds no box). Expected: all assertions pass.

- [ ] **Step: Calibration-grid screenshot vs mockup** — overlay a calibration grid (per the user's calibration-grid method) on `docs/private/theme-mockups/03-paper-atelier__board.png` and on a live paper-board screenshot. Compare washi tint hues, photo-corner darkness, stamp ink color, pin/clip placement against the mockup cards. Capture per-stage screenshots to `/tmp` and present for user approval BEFORE committing visual values. Adjust the `--deco-*` token values in the paper block (Task 4b) only — never the default theme. Expected: user sign-off on the decoration look.

- [ ] **Step: Full deploy gate** — `rtk tsc && rtk vitest run && rtk pnpm build`. Expected: tsc clean, all vitest green (incl. `messages/all-keys-parity.test.ts` — no new user-facing sentences were added, so parity is untouched), `pnpm build` produces `out/`.

- [ ] **Step: Commit** — `rtk git add lib/board/constants.ts components/board/CardsLayer.tsx components/board/BoardRoot.tsx components/board/decorations/ && rtk git commit -m "feat(theme): thread themeId into CardsLayer, mount paper decorations, fix --card-radius hardcode"`

---

**Notes for the executing engineer:**
- The mount test (`PaperCardDecorations.mount.test.tsx`) assumes Task 1 added `decorations: true` to the `paper-atelier` registry entry (`lib/board/theme-registry.ts:20-27`) and `decorations?: boolean` to `ThemeMeta` (`lib/board/types.ts:53-63`). If Task 1 is not yet merged, that single test stays red on the paper case — that is expected and correct; do not weaken the test, complete Task 1 first.
- No i18n changes: the only added user-facing strings are the stamp labels `ARCHIVE`/`REAL`/`RATED`, which are ALL-CAPS world-clear-English chrome labels (CONTRACT: intentionally hardcoded, not full sentences) — so `messages/*.json` and the parity test are untouched.
- Non-interference is guaranteed by construction: the overlay is `position:absolute; inset:0; pointer-events:none` with no intrinsic size, so the CardsLayer wrapper's `getBoundingClientRect` (the Lightbox FLIP origin at `use-card-reorder-drag.ts:220`) is identical with or without it; `ImageCard` has no `.media` element, and the FLIP scene only redraws the thumbnail URL on a WebGL plane (never clones card DOM), so board decorations correctly vanish with the `visibility:hidden` source (CardsLayer L1052) and reappear on close.

---

### Task 5: Signature motion #1 — pinned-card drift (entry) + paper-fade (shutdown); thread themeId into card + wordmark consumers

**Files:**
- Create: `lib/animation/tag-entry/themes/paper.module.css`
- Create: `lib/animation/tag-shutdown/themes/paper.module.css`
- Modify: `lib/animation/tag-entry/index.ts:3` (add side-effect import), `:39-119` (add `case 'paper-drift'` above `default`)
- Modify: `lib/animation/tag-shutdown/index.ts:1` (add import), `:12-19` (add `case 'paper-fade'` above `default`)
- Modify: `components/board/CardsLayer.tsx:381` (`getEntryAnimation('wave')` → `getEntryAnimation(meta.motion.entry)`), `:1004` (`getShutdownAnimationClass('wave')` → `getShutdownAnimationClass(meta.motion.shutdown)`)
- Modify: `components/board/BoardBackgroundTypography.tsx:83-98` (add `themeId` prop), `:136` (entry → `getThemeMeta(themeId).motion.entry`), `:147` (shutdown → `.motion.shutdown`)
- Modify: `components/board/BoardRoot.tsx:2130` (pass `themeId` to `<BoardBackgroundTypography>`)
- Test: `tests/lib/animation/tag-entry/index.test.ts` (NEW), `tests/lib/animation/tag-shutdown/index.test.ts` (extend)

**Interfaces:**
- Consumes (from Task 4): `CardsLayer` has prop `readonly themeId: ThemeId`, imports `getThemeMeta`, and derives `const meta = getThemeMeta(themeId)` in its body before L381. From Contract: `ThemeMeta.motion: { readonly entry: string; readonly text: string; readonly shutdown: string }`; registry values `paper-atelier.motion = { entry:'paper-drift', text:'ink-underline', shutdown:'paper-fade' }`, default themes `motion = { entry:'wave', text:'glitch-crt', shutdown:'wave' }`. `getThemeMeta(id: ThemeId): ThemeMeta` from `lib/board/theme-registry.ts:32`.
- Produces (later tasks rely on): `getEntryAnimation('paper-drift')` returns an `EntryAnimation` config (`{ keyframes, options:{ fill:'none', … }, staggerStepMs, staggerCapMs }`); `getShutdownAnimationClass('paper-fade')` returns the `.fade` CSS-module class string. The `'wave'`/`undefined` fallback contract is preserved (Task 6's `getTextTransition('ink-underline')` is separate and out of scope here). `BoardBackgroundTypography` now has `readonly themeId: ThemeId` in its `Props`.

This task is split into **5a** (animation registry: entry/shutdown paper keys, pure-unit TDD) and **5b** (thread `themeId` through the two consumers + BoardRoot, plus the Playwright visual check). 5b depends on Task 4 having added the `themeId` prop + `meta` to CardsLayer.

---

#### Task 5a — Register `paper-drift` entry + `paper-fade` shutdown (pure, TDD)

- [ ] **Step: Write the failing test (entry)** — create `tests/lib/animation/tag-entry/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getEntryAnimation } from '@/lib/animation/tag-entry'

describe('getEntryAnimation', () => {
  it('wave テーマで CRT bootup config が返る (= fill:none / keyframes あり)', () => {
    const a = getEntryAnimation('wave')
    expect(a).toBeDefined()
    expect(a?.keyframes.length).toBeGreaterThan(0)
    expect(a?.options.fill).toBe('none')
    expect(typeof a?.staggerStepMs).toBe('number')
    expect(typeof a?.staggerCapMs).toBe('number')
  })

  it('paper-drift テーマで穏やかな drift config が返る (= fill:none、 緑 flash 無し)', () => {
    const a = getEntryAnimation('paper-drift')
    expect(a).toBeDefined()
    expect(a?.keyframes.length).toBeGreaterThan(0)
    expect(a?.options.fill).toBe('none')
    // paper drift は緑 flash / glitch を一切持たない (= 落ち着いた紙の演出)
    const serialized = JSON.stringify(a?.keyframes)
    expect(serialized).not.toContain('#28F100')
    expect(serialized.toLowerCase()).not.toContain('5aefff') // glitch cyan
  })

  it('未対応テーマ key では undefined フォールバック (= フォールバック契約維持)', () => {
    expect(getEntryAnimation('forest')).toBeUndefined()
    expect(getEntryAnimation('glitch-crt')).toBeUndefined()
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run tests/lib/animation/tag-entry/index.test.ts`. Expect FAIL on the `paper-drift` case: `expected undefined to be defined` (the `case 'paper-drift'` does not exist yet; the `wave` and `forest` cases pass).

- [ ] **Step: Implement the paper entry CSS tokens** — create `lib/animation/tag-entry/themes/paper.module.css` (mirror `wave.module.css` shape; UNITLESS time numbers per the session-74 trap):
```css
/* PAPER-ATELIER テーマ用 carded entry effect (= 絞り込み解除 / filter 切替時に
   復活してくるカードのためのアニメ)。 紙の世界観: ピン留めした写真が
   そっと差し込まれるような穏やかな drift。 WAVE の CRT bootup とは別言語で、
   緑 flash / glitch / 強い scale を一切持たない。 触る数値は :root の CSS
   変数経由のみ。 実発火は WAAPI 経由 (= CardsLayer の useEffect)、 この file は
   CSS 変数を export するためだけに存在する (= wave と同じ pattern)。 */

/* 時間系の値 (duration / stagger) は単位を付けない (= 数値リテラル)。
   理由: Chrome は custom property の `Nms` を `(N/1000)s` に正規化するため、
   getComputedStyle 経由で parseFloat すると 800ms → 0.8 になる (= 1000 倍
   小さい値を WAAPI に渡してしまう) 罠 (session 74) の回避。 単位なしの数値で
   書けば parseFloat が期待通り N を返す。 コメントに単位を明記して読者を助ける。 */
:root {
  /* board は合成 (fill-rate) 律速なので amplitude は極小に保つ:
     - duration 520ms: wave 380ms より遅い (= 紙は「ふわり」 と静かに置かれる)
     - ease-out: 入ってくる要素の標準 (Material decelerate)
     - drift 6px / blur 無し / scale 無し (= 合成負荷を上げない) */
  --paper-drift-duration: 520; /* ms */
  --paper-drift-easing: cubic-bezier(0.16, 1, 0.3, 1); /* gentle ease-out */
  --paper-drift-offset-y: 6; /* px、 下から差し込まれる量 (極小) */
  --paper-drift-tilt: 0.6; /* deg、 紙が落ち着くときの微傾き */
  --paper-drift-stagger-step: 22; /* ms、 wave より遅め (= 静かに 1 枚ずつ) */
  --paper-drift-stagger-cap: 420; /* ms */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --paper-drift-duration: 200;
    --paper-drift-offset-y: 0;
    --paper-drift-tilt: 0;
  }
}
```

- [ ] **Step: Implement the `paper-drift` case** in `lib/animation/tag-entry/index.ts`. Add the side-effect import directly under L3, then insert `case 'paper-drift'` ABOVE the `default` (never touch the `default: return undefined`). Add the import:
```ts
// WAVE テーマの CSS variables を side-effect で :root に注入するため、
// theme module を 1 つ import する (= shutdown と同じ pattern)。
import './themes/wave.module.css'
// PAPER-ATELIER テーマの CSS variables を side-effect で :root に注入する。
import './themes/paper.module.css'
```
Then insert this case between the end of `case 'wave'` (after its closing `}` at L116) and `default:` at L117:
```ts
    case 'paper-drift': {
      // PAPER-ATELIER entry: ピン留め写真が下からそっと差し込まれる穏やかな
      // drift。 wave のような緑 flash / CRT glitch / 強 scale は一切使わない
      // (= 紙の世界観 + board が合成律速なので amplitude を極小に保つ)。
      // 数値は paper.module.css の :root から読む (= wave と同じ思想)。
      const duration = readCssVar('--paper-drift-duration', 520)
      const easing = readCssVarRaw('--paper-drift-easing', 'cubic-bezier(0.16, 1, 0.3, 1)')
      const offsetY = readCssVar('--paper-drift-offset-y', 6)
      const tilt = readCssVar('--paper-drift-tilt', 0.6)
      const staggerStepMs = readCssVar('--paper-drift-stagger-step', 22)
      const staggerCapMs = readCssVar('--paper-drift-stagger-cap', 420)
      // 0   : 少し下 + 微傾き + 透明 (まだ「置かれていない」 紙)
      // 0.6 : ほぼ定位置、 不透明に近づく (= 紙が机に触れる)
      // 1.0 : 通常表示 (= 全部 reset、 fill:none で最終状態を保持しない)
      return {
        keyframes: [
          {
            offset: 0,
            transform: `translateY(${offsetY}px) rotate(${tilt}deg)`,
            opacity: '0',
          },
          {
            offset: 0.6,
            transform: `translateY(${offsetY * 0.18}px) rotate(${tilt * 0.3}deg)`,
            opacity: '0.92',
          },
          {
            offset: 1,
            transform: 'translateY(0) rotate(0deg)',
            opacity: '1',
          },
        ],
        options: { duration, easing, fill: 'none' },
        staggerStepMs,
        staggerCapMs,
      }
    }
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run tests/lib/animation/tag-entry/index.test.ts`. All three cases pass: `wave` config present, `paper-drift` config present with no `#28F100`/`5aefff`, `forest`/`glitch-crt` → undefined.

- [ ] **Step: Extend the shutdown test (failing)** — append a `paper-fade` case to `tests/lib/animation/tag-shutdown/index.test.ts`:
```ts
  it('paper-fade テーマで紙 dissolve の CSS class が返る', () => {
    const c = getShutdownAnimationClass('paper-fade')
    expect(typeof c).toBe('string')
    expect(c).toBeTruthy()
  })

  it('paper-fade と wave は別 class (= テーマごとに別 module)', () => {
    expect(getShutdownAnimationClass('paper-fade')).not.toBe(
      getShutdownAnimationClass('wave'),
    )
  })
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run tests/lib/animation/tag-shutdown/index.test.ts`. Expect FAIL on `paper-fade`: `expected undefined to be a string` (no `case 'paper-fade'` yet; `wave`/`forest` cases still pass).

- [ ] **Step: Implement the paper shutdown CSS** — create `lib/animation/tag-shutdown/themes/paper.module.css` (mirror `wave.module.css`; a soft ink/paper dissolve, no green flash/glitch). Use a `s`-unit duration here (this file's values feed CSS `animation` directly, NOT WAAPI/parseFloat — matching the existing `wave.module.css` which uses `0.55s`):
```css
/* PAPER-ATELIER テーマ用 shutdown effect (= 絞り込みから外れたカードが
   消えるときのアニメ)。 紙の世界観: インクが滲んで紙が裏返り、 そっと
   フェードする。 wave のような緑 flash / CRT scanline / glitch は一切無し。
   spec: docs/superpowers/specs/2026-05-25-tagging-design.md §「アニメ層設計」。
   触る数値は :root の CSS 変数経由のみ。 */

:root {
  --paper-fade-duration: 0.46s;
  --paper-fade-easing: cubic-bezier(0.4, 0, 0.6, 1);
  --paper-fade-lift-y: -4px; /* わずかに浮いてから消える */
  --paper-fade-tilt: -1.2deg; /* 紙がめくれる微傾き */
  --paper-fade-blur: 1.5px; /* インクが滲む程度の微 blur (極小、 合成負荷配慮) */
}

/* 適用対象: [data-tagged-out="true"] のカードのみ。
   通常状態 / 該当カード / ボード背景には一切影響させない。 */
.fade {
  animation: paper-dissolve var(--paper-fade-duration) var(--paper-fade-easing) forwards;
  transform-origin: 50% 40%;
  position: relative;
}

@keyframes paper-dissolve {
  0% {
    transform: translateY(0) rotate(0deg);
    filter: blur(0);
    opacity: 1;
  }
  45% {
    transform: translateY(var(--paper-fade-lift-y)) rotate(calc(var(--paper-fade-tilt) * 0.4));
    filter: blur(calc(var(--paper-fade-blur) * 0.4));
    opacity: 0.78;
  }
  100% {
    transform: translateY(calc(var(--paper-fade-lift-y) * 2)) rotate(var(--paper-fade-tilt)) scale(0.985);
    filter: blur(var(--paper-fade-blur));
    opacity: 0;
  }
}

/* prefers-reduced-motion: 視覚過敏 user 配慮、 単純フェードに置換 (blur/tilt 除去) */
@media (prefers-reduced-motion: reduce) {
  .fade {
    animation: paper-fade-simple var(--paper-fade-duration) ease-out forwards;
  }
  @keyframes paper-fade-simple {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(0); }
  }
}
```

- [ ] **Step: Implement the `paper-fade` case** in `lib/animation/tag-shutdown/index.ts`. Add the import under L1 and the case ABOVE `default` (never change the `default: return undefined`):
```ts
import waveStyles from './themes/wave.module.css'
import paperStyles from './themes/paper.module.css'
```
```ts
  switch (theme) {
    case 'wave':
      return waveStyles.shutdown
    case 'paper-fade':
      return paperStyles.fade
    default:
      return undefined
  }
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run tests/lib/animation/tag-shutdown/index.test.ts`. All cases pass (`paper-fade` returns a truthy string distinct from `wave`; `forest` → undefined).

- [ ] **Step: Commit** — `rtk git add lib/animation/tag-entry/themes/paper.module.css lib/animation/tag-entry/index.ts lib/animation/tag-shutdown/themes/paper.module.css lib/animation/tag-shutdown/index.ts tests/lib/animation/tag-entry/index.test.ts tests/lib/animation/tag-shutdown/index.test.ts && rtk git commit -m "feat(theme): register paper-drift entry + paper-fade shutdown animations (Plan 2 motion #1)"`

---

#### Task 5b — Thread `themeId`/`meta.motion` through the two consumers + BoardRoot

> Prerequisite from Task 4: `CardsLayer` already has `readonly themeId: ThemeId` in `CardsLayerProps`, imports `getThemeMeta` from `@/lib/board/theme-registry`, and `BoardRoot` already passes `themeId={themeId}` to `<CardsLayer>` (render L2151). If `getThemeMeta` is not yet imported in CardsLayer, add `import { getThemeMeta } from '@/lib/board/theme-registry'` alongside the existing imports.

- [ ] **Step: Write the failing test (BoardBackgroundTypography honors themeId)** — create/extend `tests/components/board/BoardBackgroundTypography.test.tsx`. We can't assert the WAAPI keyframes directly in jsdom, so assert the component accepts `themeId` and resolves the paper shutdown class onto the wordmark when `closing` (string-class presence is the testable contract). Mock i18n + the registry-derived motion key:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { BoardBackgroundTypography } from '@/components/board/BoardBackgroundTypography'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

const tags = [{ id: 't1', name: 'Inspo' }] as never

describe('BoardBackgroundTypography themeId wiring', () => {
  it('paper-atelier + closing で paper-fade の shutdown class が wordmark に乗る', () => {
    const paperFadeClass = getShutdownAnimationClass('paper-fade')
    const { getByTestId } = render(
      <BoardBackgroundTypography
        activeFilter={{ kind: 'tag', tagIds: ['t1'] } as never}
        tags={tags}
        themeId="paper-atelier"
        closing
      />,
    )
    const span = getByTestId('board-bg-typography').querySelector('span')
    expect(span?.className).toContain(paperFadeClass as string)
  })

  it('default テーマ + closing では wave の shutdown class が乗る (= 既存挙動維持)', () => {
    const waveClass = getShutdownAnimationClass('wave')
    const { getByTestId } = render(
      <BoardBackgroundTypography
        activeFilter={{ kind: 'tag', tagIds: ['t1'] } as never}
        tags={tags}
        themeId="dotted-notebook"
        closing
      />,
    )
    const span = getByTestId('board-bg-typography').querySelector('span')
    expect(span?.className).toContain(waveClass as string)
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run tests/components/board/BoardBackgroundTypography.test.tsx`. Expect a TS/runtime FAIL: `themeId` is not a declared prop yet (TS2322 under `rtk tsc`, and at runtime the hardcoded `'wave'` makes the paper-atelier case render the wave class, so the first assertion fails: `expected '<wave class>' to contain '<paper-fade class>'`).

- [ ] **Step: Implement — add `themeId` to `BoardBackgroundTypography` Props + use `getThemeMeta`.** Edit `components/board/BoardBackgroundTypography.tsx`. First add the import near the top (alongside the existing animation imports):
```ts
import type { ThemeId } from '@/lib/board/types'
import { getThemeMeta } from '@/lib/board/theme-registry'
```
Add the prop to the `Props` type (after `closing` at L97):
```ts
  /** The active board theme id. Selects which entry/shutdown motion the wordmark
   *  plays — the wordmark mirrors the card CRT/paper effects so the whole board
   *  speaks one motion language. paper-atelier → paper-drift / paper-fade;
   *  default themes → wave. */
  readonly themeId: ThemeId
```
Add `themeId` to the destructured params (in the `function BoardBackgroundTypography({ … })` signature, L108-114):
```ts
export function BoardBackgroundTypography({
  activeFilter,
  tags,
  variant = 'static',
  playEntry = false,
  closing = false,
  themeId,
}: Props): ReactElement | null {
```
Replace the hardcoded entry key at L136. Inside the mount `useEffect`, change `const a = getEntryAnimation('wave')` to read the theme's entry key (the registry call is cheap and pure; keep it inside the effect so the empty deps array stays valid and lint-clean):
```ts
    const a = getEntryAnimation(getThemeMeta(themeId).motion.entry)
    if (a) el.animate(a.keyframes, { ...a.options, fill: 'none' })
```
Replace the hardcoded shutdown key at L147:
```ts
  const shutdownClass = closing ? getShutdownAnimationClass(getThemeMeta(themeId).motion.shutdown) : undefined
```

- [ ] **Step: Implement — BoardRoot passes `themeId` to the wordmark.** Edit `components/board/BoardRoot.tsx` at the `<BoardBackgroundTypography` JSX (opens L2130). Add the prop:
```tsx
              <BoardBackgroundTypography
                themeId={themeId}
```
(`themeId` state already exists at L149; leave the other existing props on that element unchanged.)

- [ ] **Step: Run, expect PASS** — `rtk vitest run tests/components/board/BoardBackgroundTypography.test.tsx`. Both cases pass: paper-atelier renders the `paper-fade` class, dotted-notebook renders the `wave` class.

- [ ] **Step: Implement — CardsLayer entry consumer.** Edit `components/board/CardsLayer.tsx`. Task 4 added `const meta = getThemeMeta(themeId)` in the component body; if it is not present, add it immediately after `const rootRef = useRef<HTMLDivElement>(null)` (L371):
```ts
  const meta = getThemeMeta(themeId)
```
Replace L381 inside the entry `useEffect` (the `[entryAnimCycle]`-deps effect). `meta` is a stable, cheap value; reference it directly:
```ts
    const entryAnim = getEntryAnimation(meta.motion.entry)
```
Leave the reduced-motion gate (L383-395) and the `[data-tagged-out='false']` target selection (L385) exactly as-is — they are motion-key-agnostic. If lint flags `meta` as a missing dep on the `[entryAnimCycle]` effect, add `meta.motion.entry` to the deps array (it only changes when `themeId` changes, which already remounts the relevant cycle).

- [ ] **Step: Implement — CardsLayer shutdown consumer.** Replace L1004:
```ts
        const shutdownClass = taggedOut ? getShutdownAnimationClass(meta.motion.shutdown) : undefined
```

- [ ] **Step: Run, expect PASS (full suite + tsc)** — `rtk tsc && rtk vitest run tests/lib/animation tests/components/board/BoardBackgroundTypography.test.tsx`. tsc clean (themeId now declared on both consumers); all animation + wordmark tests green. The `'wave'`/`undefined` fallback for the other themes is intact (default-theme registry entries still resolve to `motion.entry==='wave'` / `motion.shutdown==='wave'`).

- [ ] **Step: Commit** — `rtk git add components/board/BoardBackgroundTypography.tsx components/board/CardsLayer.tsx components/board/BoardRoot.tsx tests/components/board/BoardBackgroundTypography.test.tsx && rtk git commit -m "feat(theme): thread themeId into card + wordmark motion consumers (paper-drift/paper-fade)"`

---

#### Task 5c — Visual verification (Playwright getComputedStyle + calibration grid)

> jsdom cannot assert that cards actually drift or that motion stops under reduced-motion. These steps verify the runtime behavior on a real Chromium and calibrate against the mockup.

- [ ] **Step: Build + serve** — `rtk pnpm build` then serve `out/` (e.g. `npx -y wrangler@latest pages dev out --port 8788`). The dev server must be running for the Playwright steps. Open `http://localhost:8788/board`, set the theme to paper-atelier via SETTINGS → THEMES, and add ≥4 bookmarks so there are multiple cards.

- [ ] **Step: Playwright — drift runs when motion is enabled.** Use the playwright-skill. Write a script to `/tmp` that, with the paper-atelier board loaded and `motionEnabled=true`, triggers an entry cycle (toggle a tag filter off then on so cards re-enter), and asserts a non-identity transform appears mid-animation on a `[data-tagged-out='false']` card:
```js
// captured during the entry window (poll a few frames after the filter toggle)
const t = await page.evaluate(() => {
  const el = document.querySelector('[data-tagged-out="false"]')
  return el ? getComputedStyle(el).transform : null
})
// must be a matrix with a vertical translate (translateY) at some frame,
// i.e. NOT exactly 'none' / identity matrix during the drift.
expect(t).not.toBe('none')
```
Expected: at least one polled frame shows a `matrix(...)` with a non-zero translateY (the 6px drift), then settles to identity (`fill:'none'`).

- [ ] **Step: Playwright — drift is static under reduced-motion AND under motionEnabled=false.** Launch Chromium with `reducedMotion: 'reduce'`, reload the paper board, toggle the filter, and assert cards show NO drift transform (only opacity fade) — sample several frames, transform stays identity/`none`. Then separately, with normal motion but the board's MOTION toggle OFF (`motionEnabled=false`), confirm no entry animation runs (cards appear without drift). Both gates must independently suppress the drift (the 3-layer invariant).
```js
// reduced-motion run: every sampled frame's translateY component is 0
const samples = await collectTransformsOverWindow('[data-tagged-out="false"]')
expect(samples.every(isIdentityOrOpacityOnly)).toBe(true)
```

- [ ] **Step: Playwright — paper-fade on shutdown, no green flash.** Toggle a filter so a non-matching card drops out (`data-tagged-out='true'`); assert the card gains the `.fade` class (not the wave `.shutdown` class) and that no frame shows the `#28F100`/`background: rgb(40, 241, 0)` green CRT flash. Confirm it dissolves (opacity→0, slight blur) rather than collapsing to a green line.

- [ ] **Step: Calibration grid against the mockup.** Overlay a calibration grid on a screenshot of the paper-atelier board mid-entry and compare the drift feel + timing against `docs/private/theme-mockups/03-paper-atelier__board.png` (the pinned-photo placement). Confirm the drift amplitude reads as "a photo settling onto paper," not a CRT pop, and that it is subtle enough not to drop frames at 4K high-DPR. Capture the screenshot for per-stage user approval before closing the task.

- [ ] **Step: Deploy gate** — `rtk tsc && rtk vitest run && rtk pnpm build`. All green; then deploy per CLAUDE.md (`npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message "paper motion #1"`) and ask the user to hard-reload `allmarks.app`, switch to paper-atelier, and confirm the card/wordmark drift + fade feel right.

Notes for the executing engineer:
- The entry/shutdown run on the INNER wrapper (the same element wave used: CardsLayer's `[data-tagged-out]` inner div at the `getShutdownAnimationClass` call site L1004, and the wordmark `<span>` at BoardBackgroundTypography L157-162) — NOT the FLIP-measured outer wrapper. Do not move the class/animate target, or the lightbox morph + reorder drag will jitter (the FLIP origin rect is the CardsLayer wrapper `getBoundingClientRect`, `use-card-reorder-drag.ts:220`).
- All paper time values that feed WAAPI via `readCssVar` (entry, `lib/animation/tag-entry/themes/paper.module.css`) MUST stay unitless numbers; values that feed CSS `animation` directly (shutdown, `lib/animation/tag-shutdown/themes/paper.module.css`) keep their `s`/`px`/`deg` units, exactly mirroring the existing wave split.
- No new user-facing sentences are introduced in this task, so no `messages/*.json` changes and `messages/all-keys-parity.test.ts` is unaffected.

---

### Task 6: Signature motion #2 — ink-underline text transition (Lightbox) + soft photo shuffle (paper cadence) + paper background parallax

**Files:**
- Create: `lib/animation/text-transition/themes/ink-underline.ts`
- Create: `lib/animation/text-transition/themes/ink-underline.module.css`
- Create: `lib/animation/text-transition/ink-underline.test.ts`
- Modify: `lib/animation/text-transition/index.ts:45-52` (add `case 'ink-underline'`)
- Modify: `lib/board/use-tweet-translation.ts:36-44` (no signature change — already accepts `themeId?`)
- Modify: `components/board/Lightbox.tsx:370-406` (add `themeId` to `Props`), `:408` (destructure), `:1343-1351` (pass `themeId` to `<TweetColumns>`), `:1784-1800` (add `themeId` to `TweetColumns` param type), `:1809` (pass `themeId: getThemeMeta(themeId).motion.text`)
- Modify: `components/board/BoardRoot.tsx:2256-2269` (pass `themeId` to `<Lightbox>`)
- Create: `lib/board/paper-soft-shuffle.ts` (pure selector helper)
- Create: `lib/board/paper-soft-shuffle.test.ts`
- Modify: `components/board/cards/ImageCard.tsx:21-25` (add `softShuffle` prop), `:29` (destructure), `:67-82` (calmer cadence), `:154-167` (crossfade vs hard-cut layer class)
- Modify: `components/board/cards/ImageCard.module.css:12-32` (add `.thumbSoft` crossfade variant)
- Modify: `components/board/CardsLayer.tsx:1073-1087` (pass `softShuffle` derived from `meta.decorations`/themeId via `getThemeMeta`)
- Create: `components/board/PaperParallaxLayer.tsx` (gentle 0.85x bg parallax)
- Create: `components/board/use-paper-parallax.ts` (gate logic, pure-ish hook returning the parallax factor)
- Create: `components/board/use-paper-parallax.test.tsx`
- Modify: `components/board/BoardRoot.tsx:2100-2115` (apply parallax offset to the bg-wrapper transform)

**Interfaces:**
- Consumes (from earlier tasks):
  - `ThemeMeta.motion: { entry, text, shutdown }` and `ThemeMeta.decorations?: boolean` (Task 1 added to `lib/board/types.ts`).
  - Registry values (Task 2): `paper-atelier` → `motion.text === 'ink-underline'`, `decorations === true`; `dotted-notebook`/`grid-paper` → `motion.text === 'glitch-crt'`, no `decorations`.
  - `getShutdownAnimationClass('paper-fade')` and `getEntryAnimation('paper-drift')` (Task 5 added the `'paper-fade'`/`'paper-drift'` cases + their `themes/*.module.css` to `lib/animation/tag-shutdown/index.ts` and `lib/animation/tag-entry/index.ts`). If Task 5 has not yet shipped those cases, this task FAILS its `getTextTransition('ink-underline')` smoke test (exit/entry would be empty) — do Task 5 first.
  - `ThemeId` type from `lib/board/types.ts`; `getThemeMeta` from `lib/board/theme-registry.ts`.
  - `themeId` state in `BoardRoot` (Plan 1, already wired; `themeMeta` derived at `BoardRoot.tsx:809`).
  - CardsLayer already passes `autoCycle={motionEnabled}` (`CardsLayer.tsx:1083`) and `ambientOn` (`:1084`) to each card; `ambientOn = motionEnabled && !sourceCardId && !reduceMotion && !isScrolling` (`:721`).
- Produces (later tasks rely on):
  - `createInkUnderlineTransition(): TextTransition` (export from `themes/ink-underline.ts`).
  - `getTextTransition('ink-underline')` now resolves to it (registry reachable for any consumer).
  - `selectPaperSoftShuffle({ softShuffle, ambientOn }): { crossfade: boolean; cadenceMs: number }` (pure, from `lib/board/paper-soft-shuffle.ts`).
  - `usePaperParallax({ themeId, motionEnabled, viewportY }): number` (the bg translate-Y factor, 0 when gated off).

---

#### Subtask 6a — ink-underline text transition (Lightbox)

- [ ] **Step: Write the failing test** — create `lib/animation/text-transition/ink-underline.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getTextTransition } from './index'

describe('getTextTransition — ink-underline', () => {
  it('ink-underline returns a full descriptor (loadingClass/exitClass/exitMs/playEntry)', () => {
    const t = getTextTransition('ink-underline')
    expect(typeof t.exitMs).toBe('number')
    expect(t.exitMs).toBeGreaterThan(0)
    expect(typeof t.playEntry).toBe('function')
    // loadingClass is the CSS-module underline-draw class (a non-empty string)
    expect(typeof t.loadingClass).toBe('string')
    expect((t.loadingClass ?? '').length).toBeGreaterThan(0)
  })

  it("'default' and 'glitch-crt' still resolve to the glitch transition", () => {
    expect(getTextTransition('default').exitMs).toBe(getTextTransition('glitch-crt').exitMs)
    // ink-underline must NOT collide with glitch's exit timing (distinct cadence)
    expect(getTextTransition('ink-underline').exitMs).not.toBe(getTextTransition('default').exitMs)
  })

  it('unknown theme still falls back to glitch (default), not ink-underline', () => {
    expect(getTextTransition('nope').exitMs).toBe(getTextTransition('default').exitMs)
  })

  it('playEntry with reducedMotion=true settles to finalText immediately and returns a cancel fn', () => {
    const t = getTextTransition('ink-underline')
    let shown = ''
    const cancel = t.playEntry({ el: null, finalText: 'Hola', setText: (s) => { shown = s }, reducedMotion: true })
    expect(shown).toBe('Hola')
    expect(typeof cancel).toBe('function')
    expect(() => cancel()).not.toThrow()
  })

  it('playEntry with el=null (non-reduced) still settles text without throwing', () => {
    const t = getTextTransition('ink-underline')
    let shown = ''
    const cancel = t.playEntry({ el: null, finalText: 'Bonjour', setText: (s) => { shown = s }, reducedMotion: false })
    expect(shown).toBe('Bonjour')
    cancel()
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run lib/animation/text-transition/ink-underline.test.ts`. Expected failure: `getTextTransition('ink-underline')` currently hits the `default` branch (`index.ts:49-50`) so it returns the glitch transition — the `exitMs` "not equal to default" assertion fails (they're equal at 550), and `createInkUnderlineTransition` does not exist yet (the module import inside `index.ts` will not exist once added). It fails on the distinct-cadence assertion.

- [ ] **Step: Implement the CSS** — create `lib/animation/text-transition/ink-underline.module.css` (mirrors `glitch-crt.module.css:12-37`; loading = an underline that draws left→right under the body text, evoking ink being laid down; numbers are unitless-time via `:root` vars per the wave-css convention only where a custom-prop drives WAAPI — here the loading is pure CSS so seconds are fine):
```css
/* PAPER-ATELIER tweet-translate transition = ink-underline.
 *
 * Reuses AllMarks の paper motion 言語:
 *  - loading indicator = 本文の下に「インクが引かれていく」 underline draw
 *    (= scaleX 0→1 を左から、 ペン先が走るような ease-out。 glitch の
 *     「じじっ」 と違い、 静かで紙的)
 *  - exit / entry は JS 側で tag-shutdown('paper-fade') / tag-entry('paper-drift')
 *    を流用するので、 ここには loading の下線だけ置く。
 *
 * 数値を触るのは :root の CSS 変数経由のみ。 */

:root {
  --tweet-ink-underline-color: var(--color-accent-primary, #2f4a37); /* FOREST */
  --tweet-ink-underline-thickness: 2px;
  --tweet-ink-underline-period: 1.6s;
}

.loading {
  position: relative;
}

/* The draw lives on a pseudo so it never affects the body's box geometry
   (= no reflow, FLIP-safe). Repeats while loading: draw in, hold, fade out. */
.loading::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -0.12em;
  height: var(--tweet-ink-underline-thickness);
  background: var(--tweet-ink-underline-color);
  transform-origin: left center;
  transform: scaleX(0);
  opacity: 0;
  pointer-events: none;
  animation: tweetInkUnderlineDraw var(--tweet-ink-underline-period) ease-out infinite;
  will-change: transform, opacity;
}

@keyframes tweetInkUnderlineDraw {
  0%   { transform: scaleX(0);   opacity: 0; }
  12%  { transform: scaleX(0);   opacity: 1; }
  62%  { transform: scaleX(1);   opacity: 1; }
  86%  { transform: scaleX(1);   opacity: 0.85; }
  100% { transform: scaleX(1);   opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .loading::after { animation: none; opacity: 0; }
}
```

- [ ] **Step: Implement the transition module** — create `lib/animation/text-transition/themes/ink-underline.ts` (mirrors `glitch-crt.ts:78-113`; REUSES `getShutdownAnimationClass('paper-fade')` for exit and `getEntryAnimation('paper-drift')` for the boot, exactly as glitch reuses `'wave'` at `glitch-crt.ts:81/89`; reuses the shared scramble helpers so the entry "settles" with paper-quiet cadence; reduced-motion gate inside `playEntry`):
```ts
import { getEntryAnimation } from '@/lib/animation/tag-entry'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'
import {
  pickScrambleIndices, buildSubsetSchedule, computeSubsetFrame,
} from './glitch-crt'
import styles from './ink-underline.module.css'
import type { TextTransition, PlayEntryArgs } from '../index'

// paper-fade shutdown ('paper-fade' tag-shutdown) と揃える exit 窓。glitch の
// 550ms より少し長く取り、 紙的にゆっくり退場させてから差し替える。
const EXIT_MS = 620
// paper-drift entry が settle するまでの窓。tag-entry('paper-drift') の duration
// より少し長く取り、 静かに着地させる。
const ENTRY_MS = 560
// 訳文の何割の文字を「軽く」スクランブルするか (glitch と同じ控えめ 10%)。
const SCRAMBLE_FRACTION = 0.1

/**
 * paper-atelier 用のテキスト遷移。
 * - loading: 本文下に「インクが引かれていく」 underline (CSS class)。
 * - exit: paper-fade shutdown を流用 (静かに紙が暗転)。
 * - entry: paper-drift boot を流用 + 1 割の軽スクランブルで着地。
 * - reduced-motion / el=null は即 setText(final)。
 */
export function createInkUnderlineTransition(): TextTransition {
  return {
    loadingClass: styles.loading ?? null,
    exitClass: getShutdownAnimationClass('paper-fade') ?? null,
    exitMs: EXIT_MS,
    playEntry({ el, finalText, setText, reducedMotion }: PlayEntryArgs): () => void {
      if (reducedMotion || !el) {
        setText(finalText)
        return () => {}
      }
      // paper-drift boot-up (= ムードボードのタイトル登場と同じ紙の漂い entry)。
      const a = getEntryAnimation('paper-drift')
      if (a) el.animate(a.keyframes, { ...a.options, fill: 'none' })
      // 全文の SCRAMBLE_FRACTION 割だけ軽くスクランブルしながら着地。
      const schedule = buildSubsetSchedule(pickScrambleIndices(finalText, SCRAMBLE_FRACTION), ENTRY_MS)
      let raf = 0
      let cancelled = false
      const start = performance.now()
      const tick = (): void => {
        if (cancelled) return
        const elapsed = performance.now() - start
        if (elapsed >= ENTRY_MS) {
          setText(finalText)
          return
        }
        setText(computeSubsetFrame(finalText, elapsed, schedule))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return (): void => {
        cancelled = true
        if (raf) cancelAnimationFrame(raf)
      }
    },
  }
}
```

- [ ] **Step: Wire the registry** — edit `lib/animation/text-transition/index.ts`. Add the import at top (after line 1) and the case ABOVE `default` (`index.ts:46-51`):
```ts
import { createGlitchCrtTransition } from './themes/glitch-crt'
import { createInkUnderlineTransition } from './themes/ink-underline'
```
and:
```ts
export function getTextTransition(theme: string): TextTransition {
  switch (theme) {
    case 'ink-underline':
      return createInkUnderlineTransition()
    case 'glitch-crt':
    case 'default':
    default:
      return createGlitchCrtTransition()
  }
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run lib/animation/text-transition/ink-underline.test.ts` (all 5 green) AND `rtk vitest run lib/animation/text-transition/glitch-crt.test.ts` (the existing glitch suite still green — the `default`/`glitch-crt` path is unchanged).

- [ ] **Step: Commit** — `git add lib/animation/text-transition/ && git commit -m "feat(theme): ink-underline text transition for paper-atelier (reuses paper-fade/paper-drift)"`.

- [ ] **Step: Write the failing reachability test (Lightbox prop threading)** — the Lightbox `themeId` prop is not asserted by the existing translation suite. Add a focused unit at `lib/board/use-tweet-translation.test.tsx` (it already mocks `getTextTransition` — extend it to prove `themeId` is forwarded into the memoized call). Append this `describe` to the existing file:
```tsx
import { getTextTransition as realGetTextTransition } from '@/lib/animation/text-transition'

describe('useTweetTranslation — themeId forwarding', () => {
  it('passes themeId straight through to getTextTransition (memoized by themeId)', async () => {
    // The module-level vi.mock above replaces getTextTransition with a spy-able fn.
    const spy = vi.mocked(realGetTextTransition as unknown as (k: string) => unknown)
    const { rerender } = renderHook(
      ({ k }: { k: string }) => useTweetTranslation({ originalText: 'Hola', themeId: k }),
      { initialProps: { k: 'ink-underline' } },
    )
    await waitFor(() => expect(spy).toHaveBeenCalledWith('ink-underline'))
    rerender({ k: 'glitch-crt' })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('glitch-crt'))
  })
})
```
> Note for the engineer: the existing `vi.mock('@/lib/animation/text-transition', ...)` at `use-tweet-translation.test.tsx:11-21` returns a plain factory, not a `vi.fn`. Change that mock to `getTextTransition: vi.fn((/* theme */) => ({ ... same descriptor ... }))` so `toHaveBeenCalledWith` works, AND add `import { renderHook }` (already imported). Keep the returned descriptor identical to the current one so the other 7 tests in that file stay green.

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run lib/board/use-tweet-translation.test.tsx -t "themeId forwarding"`. Expected failure: today `useTweetTranslation` IS already capable of receiving `themeId` (`use-tweet-translation.ts:36-44`), so this passes at the hook level — BUT the Lightbox never SUPPLIES it. The real reachability gap is in the component tree, so this test is the safety net; if it passes immediately, that confirms the hook side is sound and the remaining work is purely Lightbox/BoardRoot prop threading (next steps). (If the mock wasn't converted to `vi.fn`, it fails with "spy.mock is undefined".)

- [ ] **Step: Implement Lightbox prop threading** — edit `components/board/Lightbox.tsx`:
  1. Add the import near the other `lib/board` imports at the top of the file:
  ```ts
  import { getThemeMeta } from '@/lib/board/theme-registry'
  import type { ThemeId } from '@/lib/board/types'
  ```
  (If `ThemeId` is already imported there, do not duplicate.)
  2. Add to `Props` (after `persistMediaSlots`, `Lightbox.tsx:405`):
  ```ts
    /** Active board theme. Drives the body-text translate transition flavor
     *  (paper-atelier → ink-underline; default themes → glitch-crt) via
     *  getThemeMeta(themeId).motion.text. */
    readonly themeId: ThemeId
  ```
  3. Destructure it at `Lightbox.tsx:408`:
  ```ts
  export function Lightbox({ item, originRect, sourceCardId, onClose, onSourceShouldShow, nav, persistMediaSlots, themeId }: Props): ReactElement | null {
  ```
  4. Pass it into `<TweetColumns>` (`Lightbox.tsx:1343-1351`), adding the `themeId` line:
  ```tsx
            <TweetColumns
              mediaRef={mediaRef}
              textRef={textRef}
              view={view}
              meta={tweetMeta}
              slots={tweetSlots}
              slotIdx={tweetSlotIdx}
              onJump={setTweetSlotIdx}
              themeId={themeId}
            />
  ```
  5. Add `themeId` to the `TweetColumns` param type (`Lightbox.tsx:1792-1800`):
  ```ts
  }: {
    readonly mediaRef: React.Ref<HTMLDivElement>
    readonly textRef: React.Ref<HTMLDivElement>
    readonly view: LightboxItem
    readonly meta: TweetMeta | null
    readonly slots: readonly MediaSlot[]
    readonly slotIdx: number
    readonly onJump: (idx: number) => void
    /** Active board theme — selects the body-text translate transition. */
    readonly themeId: ThemeId
  }): ReactNode {
  ```
  and add `themeId` to the destructured params at `Lightbox.tsx:1784-1791`:
  ```ts
  function TweetColumns({
    mediaRef,
    textRef,
    view,
    meta,
    slots,
    slotIdx,
    onJump,
    themeId,
  }: {
  ```
  6. Use it at the hook call (`Lightbox.tsx:1809`):
  ```ts
  const tr = useTweetTranslation({ originalText, themeId: getThemeMeta(themeId).motion.text })
  ```

- [ ] **Step: Implement BoardRoot pass-through** — edit `components/board/BoardRoot.tsx:2256-2269`, add `themeId={themeId}` to the `<Lightbox>` element:
```tsx
        <Lightbox
          item={lightboxItem}
          originRect={lightboxOriginRect}
          sourceCardId={lightboxSourceItemId}
          onSourceShouldShow={handleLightboxSourceShouldShow}
          onClose={handleLightboxClose}
          themeId={themeId}
          nav={lightboxItem ? {
            currentIndex: lightboxIndex,
            total: lightboxNavItems.length,
            onNav: handleLightboxNav,
            onJump: handleLightboxJump,
          } : undefined}
          persistMediaSlots={persistMediaSlots}
        />
```
> `themeId` is the BoardRoot state already wired in Plan 1 (used at `BoardRoot.tsx:809` to derive `themeMeta`, and passed to `<ThemeLayer themeId={themeId}>` at `:2110-2111`). DO NOT touch `buildShareData`/`DEFAULT_THEME_ID` (`BoardRoot.tsx:1682-1685`) — share theming is Plan 3.

- [ ] **Step: Run, expect PASS** — `rtk vitest run lib/board/use-tweet-translation.test.tsx` (all green incl. the new themeId-forwarding test) AND `rtk tsc` (the new required `themeId` prop on `Lightbox` forces BoardRoot to supply it; tsc fails loudly if any other `<Lightbox>` call site exists — search confirms BoardRoot is the only one).

- [ ] **Step: Commit** — `git add components/board/Lightbox.tsx components/board/BoardRoot.tsx lib/board/use-tweet-translation.test.tsx && git commit -m "feat(theme): thread themeId into Lightbox so paper uses ink-underline translate transition"`.

- [ ] **Step: Playwright getComputedStyle verification** — write `/tmp/verify-ink-underline.mjs` (Playwright): launch the dev server (auto-detect), open the board, switch to paper-atelier via SETTINGS → THEMES (Plan 1 picker), open a foreign-language tweet card in the Lightbox, click the Translate button, and within the loading window assert the body `<p class*="tweetBody">::after` exists with a non-`none` `animation-name`. Concretely:
```js
const after = await page.$eval('p[class*="tweetBody"]', (el) =>
  getComputedStyle(el, '::after').animationName)
console.log('ink-underline animationName =', after) // expect a hashed 'tweetInkUnderlineDraw...' name, NOT 'none'
```
Then switch back to dotted-notebook and assert the SAME selector's `::after` `animation-name` is `none` (glitch theme uses `.loading` text-shadow pulse on the element itself, not the `::after` underline). Use viewport `{ width: 1489, height: 679 }`, `deviceScaleFactor: 2.58` (developer's real screen) and log which baseline.

- [ ] **Step: Calibration-grid step** — screenshot the Lightbox mid-translate on paper-atelier, overlay the calibration grid, and compare the underline color/thickness/position against `docs/private/theme-mockups/03-paper-atelier__board.png` (and `…__scrollmeter.png` for the brass/forest palette reference). Confirm `--tweet-ink-underline-color` reads as FOREST `#2f4a37` (not the default-theme green). Request per-stage screenshot approval from the user before proceeding.

---

#### Subtask 6b — soft photo shuffle (paper crossfade + calmer cadence)

- [ ] **Step: Write the failing test** — create `lib/board/paper-soft-shuffle.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { selectPaperSoftShuffle, PAPER_SHUFFLE_CADENCE_MS, DEFAULT_SHUFFLE_CADENCE_MS } from './paper-soft-shuffle'

describe('selectPaperSoftShuffle', () => {
  it('paper + ambient on → crossfade with the calmer paper cadence', () => {
    const r = selectPaperSoftShuffle({ softShuffle: true, ambientOn: true })
    expect(r.crossfade).toBe(true)
    expect(r.cadenceMs).toBe(PAPER_SHUFFLE_CADENCE_MS)
    expect(PAPER_SHUFFLE_CADENCE_MS).toBeGreaterThan(DEFAULT_SHUFFLE_CADENCE_MS) // calmer = slower
  })

  it('non-paper theme → hard cut, default cadence (default theme unchanged)', () => {
    const r = selectPaperSoftShuffle({ softShuffle: false, ambientOn: true })
    expect(r.crossfade).toBe(false)
    expect(r.cadenceMs).toBe(DEFAULT_SHUFFLE_CADENCE_MS)
  })

  it('ambient off (motion disabled / reduced / scrolling) → no crossfade even on paper', () => {
    const r = selectPaperSoftShuffle({ softShuffle: true, ambientOn: false })
    expect(r.crossfade).toBe(false)
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run lib/board/paper-soft-shuffle.test.ts`. Expected failure: `Cannot find module './paper-soft-shuffle'`.

- [ ] **Step: Implement the pure selector** — create `lib/board/paper-soft-shuffle.ts`:
```ts
/** ImageCard の多枚切替の振る舞いを theme + ambient gate から選ぶ純関数。
 *  default テーマは従来どおりハードカット (crossfade=false)、 paper-atelier は
 *  柔らかいクロスフェード + ゆっくりした cadence。 ambientOn=false (motion off /
 *  reduced-motion / scroll 中) のときは paper でもクロスフェードしない (静止)。 */

/** ImageCard.tsx の既定 cycleMs (= 現行のハードカット間隔の基準値)。 */
export const DEFAULT_SHUFFLE_CADENCE_MS = 2200
/** paper の落ち着いた間隔 (= 紙のムードボードらしくゆっくり入れ替わる)。 */
export const PAPER_SHUFFLE_CADENCE_MS = 5200

export type SoftShuffleInput = {
  /** この theme が soft-shuffle (= paper) か。getThemeMeta(themeId).decorations 由来。 */
  readonly softShuffle: boolean
  /** 周囲アニメ許可 (motionEnabled && !sourceCardId && !reduceMotion && !isScrolling)。 */
  readonly ambientOn: boolean
}

export type SoftShuffleResult = {
  /** true = opacity クロスフェード、 false = src ハードカット (従来)。 */
  readonly crossfade: boolean
  /** 画像 1 枚あたりの表示間隔 (ms)。 */
  readonly cadenceMs: number
}

export function selectPaperSoftShuffle({ softShuffle, ambientOn }: SoftShuffleInput): SoftShuffleResult {
  const usePaper = softShuffle && ambientOn
  return {
    crossfade: usePaper,
    cadenceMs: usePaper ? PAPER_SHUFFLE_CADENCE_MS : DEFAULT_SHUFFLE_CADENCE_MS,
  }
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run lib/board/paper-soft-shuffle.test.ts` (3 green).

- [ ] **Step: Commit** — `git add lib/board/paper-soft-shuffle.ts lib/board/paper-soft-shuffle.test.ts && git commit -m "feat(theme): pure selector for paper soft-shuffle cadence/crossfade"`.

- [ ] **Step: Implement ImageCard crossfade + cadence** — edit `components/board/cards/ImageCard.tsx`. (a) Add the prop to the `Props` type (after `cycleMs`, `ImageCard.tsx:24`):
```ts
  /** When true, multi-image swap cross-fades (paper soft-shuffle) instead of
   *  a hard src cut. Default false keeps the existing hard-cut behavior. */
  readonly softShuffle?: boolean
```
(b) Destructure it with a default at `ImageCard.tsx:29`:
```ts
export function ImageCard({ item, persistMeasuredAspect, reportIntrinsicHeight, cardWidth, cardHeight, displayMode, autoCycle = false, cycleMs = 2200, softShuffle = false }: Props): ReactNode {
```
(c) Apply the soft layer class on each slot `<img>`. The `.thumb` rule already cross-fades opacity (`ImageCard.module.css:24-28`: `opacity:0` default, `[data-active='true']{opacity:1}` with an opacity transition). The DEFAULT theme today reads as a "hard cut" only because its swap-duration token is short; to keep default byte-identical and make paper a true slow crossfade, add a `.thumbSoft` modifier that overrides the transition duration to a calm value. At the `<img>` in `ImageCard.tsx:155-167`, change `className={thumbClass}` to compose the soft variant:
```tsx
        slots.map((slot, i) => (
          <img
            key={slot.url}
            ref={i === 0 ? imgRef : undefined}
            className={softShuffle ? `${thumbClass} ${styles.thumbSoft}` : thumbClass}
            src={slot.url}
            alt={item.title}
            draggable={false}
            loading="lazy"
            data-active={i === imageIdx ? 'true' : undefined}
            onError={handleImgError}
          />
        ))
```
(d) Calmer cadence: the auto-cycle effect at `ImageCard.tsx:67-82` computes its random band from `cycleMs`. Since CardsLayer will pass the paper cadence in via `cycleMs` (next step), the effect needs no math change — but make the random band tighter for paper so the slow rhythm stays slow (avoid the `*0.6 … *1.8` spread snapping back to a fast interval). Replace the band lines `ImageCard.tsx:71-74`:
```ts
    // Per-card random interval band so cards never tick in lockstep. Paper
    // (softShuffle) uses a tighter band around the calm cadence so the slow
    // rhythm reads as deliberate, not occasionally-snappy.
    const minMs = softShuffle ? cycleMs * 0.85 : cycleMs * 0.6
    const maxMs = softShuffle ? cycleMs * 1.25 : cycleMs * 1.8
```
and add `softShuffle` to that effect's dep array (`ImageCard.tsx:82`):
```ts
  }, [autoCycle, hasMultiple, slots.length, cycleMs, softShuffle])
```

- [ ] **Step: Implement the `.thumbSoft` CSS** — edit `components/board/cards/ImageCard.module.css`, add after the `.thumb[data-active='true']` rule (`ImageCard.module.css:30-32`):
```css
/* Paper soft-shuffle: slow, gentle opacity crossfade between photo layers
   (the default theme keeps the fast --card-hover-swap-duration token). The
   paper token falls back to a calm 900ms when undefined so non-paper builds
   are unaffected. */
.thumbSoft {
  transition:
    opacity var(--paper-shuffle-fade-duration, 900ms) ease-in-out,
    filter var(--card-hover-swap-duration) var(--card-hover-swap-easing);
}
```
> The `--paper-shuffle-fade-duration` token is defined ONLY inside `html[data-theme-id="paper-atelier"] { ... }` (globals.css L434-494, owned by Task 2's token block — add it there if Task 2 didn't: `--paper-shuffle-fade-duration: 900ms;`). The `var(…, 900ms)` fallback keeps default themes byte-identical.

- [ ] **Step: Implement CardsLayer threading** — edit `components/board/CardsLayer.tsx`. The card render at `:1073-1087` invokes `<Card … autoCycle={motionEnabled} ambientOn={ambientOn} />`. CardsLayer must know whether this theme soft-shuffles. Per the CONTRACT, Task 4 adds `readonly themeId: ThemeId` to CardsLayer props and `const meta = getThemeMeta(themeId)` inside. Reuse that `meta`. Add the soft-shuffle derivation near the existing `ambientOn` derivation (`CardsLayer.tsx:721`):
```ts
  // Paper soft-shuffle vs default hard-cut. meta.decorations === true marks the
  // paper-atelier theme (only theme with decorations); ambientOn already folds
  // motionEnabled + !reduceMotion + !isScrolling + !sourceCardId.
  const softShuffleSel = selectPaperSoftShuffle({ softShuffle: meta.decorations === true, ambientOn })
```
(add the import at the top of CardsLayer: `import { selectPaperSoftShuffle } from '@/lib/board/paper-soft-shuffle'`). Then pass it into the card at `CardsLayer.tsx:1076-1086`:
```tsx
                  <Card
                    item={it}
                    persistMeasuredAspect={persistMeasuredAspect}
                    reportIntrinsicHeight={reportIntrinsicHeight}
                    cardWidth={p.w}
                    cardHeight={p.h}
                    displayMode={it.displayMode ?? displayMode}
                    autoCycle={motionEnabled}
                    ambientOn={ambientOn}
                    softShuffle={softShuffleSel.crossfade}
                    cycleMs={softShuffleSel.cadenceMs}
                  />
```
> `pickCard(it)` returns one of the card components; `ImageCard` now accepts `softShuffle`/`cycleMs`. Other card types ignore unknown props at the JSX level, but tsc-strict will reject passing props a component's type doesn't declare. If `pickCard`'s union of card components doesn't all accept `softShuffle?`/`cycleMs?`, gate the spread: only `ImageCard` and `PlaceholderCard` paths use these. Verify which components `pickCard` returns (read `CardsLayer.tsx` `pickCard`); if the union is heterogeneous, build a `cardExtraProps` object `{ softShuffle: softShuffleSel.crossfade, cycleMs: softShuffleSel.cadenceMs }` and pass only to image-type cards (mirror however Task 4 already conditionally passes `autoCycle`/`ambientOn`). Do NOT use `any`/`@ts-ignore`.

- [ ] **Step: Run, expect PASS** — `rtk tsc` (clean) AND `rtk vitest run lib/board/paper-soft-shuffle.test.ts components/board` (no regressions; the existing ImageCard multi-image-dot test, if any, still green — `softShuffle` defaults false so behavior is identical for default themes).

- [ ] **Step: Commit** — `git add components/board/cards/ImageCard.tsx components/board/cards/ImageCard.module.css components/board/CardsLayer.tsx app/globals.css && git commit -m "feat(theme): paper soft photo shuffle (slow crossfade + calm cadence), default theme unchanged"`.

- [ ] **Step: Playwright getComputedStyle verification** — `/tmp/verify-soft-shuffle.mjs`: on paper-atelier, find a multi-photo image card (`[data-testid] img[class*="thumbSoft"]`), assert `getComputedStyle(img).transitionDuration` includes `0.9s` (or the paper token value) — i.e. the slow paper fade is applied. Switch to dotted-notebook and assert the same card's `<img>` has NO `thumbSoft` class and `transitionDuration` equals the default `--card-hover-swap-duration`. Confirm both `<img>` layers stack (`position:absolute; inset:0`) so the swap is a crossfade not a reflow. Use viewport `{ width: 1489, height: 679 }`, `deviceScaleFactor: 2.58`.

- [ ] **Step: Calibration-grid step** — record a short screencast (or 3 stepped screenshots) of a multi-photo card swapping on paper-atelier; confirm the dissolve is gentle (no flash, no hard cut) and the cadence matches the calm rhythm of `docs/private/theme-mockups/03-paper-atelier__board.png` mood. Request user approval.

---

#### Subtask 6c — paper background parallax (0.85x, gated)

- [ ] **Step: Write the failing test** — create `components/board/use-paper-parallax.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePaperParallax } from './use-paper-parallax'

function mockReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? reduced : false,
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
}

describe('usePaperParallax', () => {
  beforeEach(() => mockReducedMotion(false))
  afterEach(() => vi.unstubAllGlobals())

  it('enabled only for paper-atelier: returns a fractional offset of viewportY', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', motionEnabled: true, viewportY: 1000 }))
    // 0.85x content pan → bg lags by 15% of scroll (positive lag offset).
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeCloseTo(1000 * 0.15, 5)
  })

  it('disabled for non-paper themes → 0 (no parallax)', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'dotted-notebook', motionEnabled: true, viewportY: 1000 }))
    expect(result.current).toBe(0)
  })

  it('disabled when motionEnabled=false → 0', () => {
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', motionEnabled: false, viewportY: 1000 }))
    expect(result.current).toBe(0)
  })

  it('disabled under prefers-reduced-motion → 0', () => {
    mockReducedMotion(true)
    const { result } = renderHook(() =>
      usePaperParallax({ themeId: 'paper-atelier', motionEnabled: true, viewportY: 1000 }))
    expect(result.current).toBe(0)
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/use-paper-parallax.test.tsx`. Expected: `Cannot find module './use-paper-parallax'`.

- [ ] **Step: Implement the hook** — create `components/board/use-paper-parallax.ts` (NOT the GSAP ScrollTrigger `use-parallax-layer.ts` — that one is LP/Hero scroll-driven; the board pans via React state `viewport.y` at `BoardRoot.tsx:2105`, so we drive parallax from that value, not ScrollTrigger). The board moves the bg 1:1 today (`translate3d(${-viewport.x}px, ${-viewport.y}px,0)`, `BoardRoot.tsx:2105`); parallax = make the paper bg move at `PAPER_PARALLAX_FACTOR` (0.85x), i.e. ADD back `(1 - 0.85) * viewport.y = 0.15 * viewport.y` to the bg's translateY so it lags content:
```ts
'use client'
import { useEffect, useState } from 'react'
import type { ThemeId } from '@/lib/board/types'

/** paper bg を content より 0.85x で動かす (= 0.15x ぶん遅れる) ための
 *  translateY 補正量を返す。 paper-atelier 以外 / motion off / reduced-motion
 *  では 0 (= 視差なし、 従来どおり bg は content と 1:1)。 */
export const PAPER_PARALLAX_FACTOR = 0.85
const LAG = 1 - PAPER_PARALLAX_FACTOR // 0.15

export type PaperParallaxInput = {
  readonly themeId: ThemeId
  readonly motionEnabled: boolean
  /** BoardRoot の viewport.y (= 縦スクロール量 px)。 */
  readonly viewportY: number
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 視差の translateY 補正 (px)。0 = 視差なし。 */
export function usePaperParallax({ themeId, motionEnabled, viewportY }: PaperParallaxInput): number {
  const [reduced, setReduced] = useState(false)
  // matchMedia を JS で監視 (CSS @media と二重に gate する layer のうちの JS 側)。
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])

  const gatedOff = themeId !== 'paper-atelier' || !motionEnabled || reduced || prefersReducedMotion()
  if (gatedOff) return 0
  return viewportY * LAG
}
```
> Reduced-motion is gated THREE ways per the invariants: (1) JS `matchMedia` here, (2) the CSS layer (next step — the parallax transform is applied via inline style, so we also add a CSS `@media (prefers-reduced-motion: reduce)` guard that neutralizes the will-change in the bg wrapper), (3) `motionEnabled` board state. Visibility is never animation-driven — the bg is always mounted; only its transform offset changes.

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/use-paper-parallax.test.tsx` (4 green). Note the test asserts the PURE return value; the JS-`matchMedia` effect runs once and the synchronous `prefersReducedMotion()` re-check also gates, so the reduced-motion case returns 0 even before the effect's `setReduced` settles.

- [ ] **Step: Commit** — `git add components/board/use-paper-parallax.ts components/board/use-paper-parallax.test.tsx && git commit -m "feat(theme): gated paper background parallax hook (0.85x, paper-only, reduced-motion safe)"`.

- [ ] **Step: Implement BoardRoot wiring** — edit `components/board/BoardRoot.tsx`. (a) Add the import near the other board imports: `import { usePaperParallax } from './use-paper-parallax'`. (b) Derive the offset near `themeMeta` (`BoardRoot.tsx:809`):
```ts
  const paperParallaxY = usePaperParallax({ themeId, motionEnabled, viewportY: viewport.y })
```
(c) Apply it to the bg wrapper's transform at `BoardRoot.tsx:2100-2108`. The existing wrapper does `translate3d(${-viewport.x}px, ${-viewport.y}px, 0)` (1:1 pan, `:2105`); ADD the lag so the bg moves at 0.85x. DO NOT add a second transform layer fighting the existing one — just adjust the Y term of the SAME transform:
```tsx
            {/* Background — full canvas coverage, follows scroll. Paper-atelier
                lags the vertical pan by paperParallaxY (0.85x) for a gentle
                depth read; every other theme keeps the exact 1:1 pan
                (paperParallaxY is 0 unless paper + motion + not reduced). */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate3d(${-viewport.x}px, ${-viewport.y + paperParallaxY}px, 0)`,
                willChange: 'transform',
                pointerEvents: 'none',
              }}
            >
              <ThemeLayer
                themeId={themeId}
                totalWidth={contentWidth}
                totalHeight={contentHeight}
              />
            </div>
```
> Rationale (FOCUS warning honored): the bg wrapper ALREADY owns `translate3d`+`will-change` (a containing block). We do NOT introduce a competing transform or a `<PaperParallaxLayer>` sub-wrapper that would fight it — we offset the existing transform's Y by a fraction (`paperParallaxY = 0.15 * viewport.y`), which yields net `-viewport.y * 0.85`. When gated off, `paperParallaxY===0` → byte-identical 1:1 pan as today. (The `PaperParallaxLayer.tsx` file listed in Files is therefore NOT created — the in-place transform offset is the cleaner approach that respects the existing containing block. If a future task needs an independent layer, it can be added then; flagging here that the in-place offset is the deliberate decision.)

- [ ] **Step: Run, expect PASS** — `rtk tsc` (clean — `paperParallaxY` is a `number`) AND `rtk vitest run components/board/use-paper-parallax.test.tsx` (still green).

- [ ] **Step: Commit** — `git add components/board/BoardRoot.tsx && git commit -m "feat(theme): apply gated paper bg parallax to board bg-wrapper transform"`.

- [ ] **Step: Playwright verification** — `/tmp/verify-paper-parallax.mjs`: on paper-atelier with motion ON, read the bg wrapper's `transform` matrix at `viewport.y = 0`, then scroll the board down by ~1000px (drive the same scroll path the board uses) and re-read. Assert the bg's translateY moved by ~`-850px` (0.85x of 1000), NOT `-1000px`. Then switch to dotted-notebook, repeat, and assert it moved by exactly `-1000px` (1:1, no parallax). Then toggle MOTION off on paper and assert it returns to 1:1 (`-1000px`). Use viewport `{ width: 1489, height: 679 }`, `deviceScaleFactor: 2.58`; also run once at `{ width: 1920, height: 1080 }`, `deviceScaleFactor: 2` (majority screen) and state which baseline each result is from.

- [ ] **Step: Calibration / motion-feel step** — visually confirm on paper-atelier that the paper texture drifts slightly slower than the cards (a calm depth cue, not distracting); confirm OS-level "reduce motion" (set via `page.emulateMedia({ reducedMotion: 'reduce' })`) drops it to 1:1. Cross-check the bg texture tile against `docs/private/theme-mockups/03-paper-atelier__board.png` so the parallax doesn't reveal a tiling seam at the offset extreme. Request user approval before wrap-up.

---

#### Final gate (whole Task 6)

- [ ] **Step: Full deploy gate** — `rtk tsc && rtk vitest run && rtk pnpm build`. All three must pass. No new user-facing sentences were added (ink-underline reuses existing `board.lightbox.translate`/`showOriginal`/`translationFailed` keys; soft-shuffle and parallax add no UI text), so `messages/all-keys-parity.test.ts` is unaffected — confirm it is still green in the `vitest run` output rather than assuming.

- [ ] **Step: Confirm no scope bleed** — verify (`rtk git diff --stat`) the diff touches ONLY the files in this task's **Files** list (minus the deliberately-skipped `PaperParallaxLayer.tsx`), and that `buildShareData`/`DEFAULT_THEME_ID` (`BoardRoot.tsx:1682-1685`) and the default-theme token block in `globals.css` are untouched (Plan 3 / default-byte-identical invariants).

- [ ] **Step: Final commit + deploy** — `git add -A && git commit -m "feat(theme): paper signature motion #2 — ink-underline + soft shuffle + bg parallax"` then deploy per CLAUDE.md: `rtk pnpm build && npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="paper signature motion 2"`. Announce to the user to hard-reload `allmarks.app`, switch to paper-atelier, and check (a) translating a foreign tweet draws the ink underline, (b) multi-photo cards dissolve gently, (c) the paper texture drifts slightly behind the cards on scroll.

---

**Reviewer notes / interface fidelity flags:**
- 6a `createInkUnderlineTransition` is a structural mirror of `createGlitchCrtTransition` (`glitch-crt.ts:78-113`); it reuses the SAME scramble helpers (`pickScrambleIndices`/`buildSubsetSchedule`/`computeSubsetFrame`) and swaps only the reused entry/shutdown keys (`'paper-drift'`/`'paper-fade'` instead of `'wave'`) and the loading CSS class — so the cross-task `getEntryAnimation`/`getShutdownAnimationClass` namespace contract is honored exactly.
- The Lightbox `useTweetTranslation` call is inside the inner `TweetColumns` component (`Lightbox.tsx:1784`, hook at `:1809`), NOT the top-level `Lightbox` — `themeId` is threaded Lightbox-prop → TweetColumns-prop → `getThemeMeta(themeId).motion.text` to reach it. This is the verified call path (only one `<TweetColumns>` render site, `Lightbox.tsx:1343`).
- 6c intentionally does NOT use `lib/scroll/use-parallax-layer.ts` (ScrollTrigger, LP-only) and does NOT create a competing transform wrapper — it offsets the EXISTING bg-wrapper `translate3d` Y term (`BoardRoot.tsx:2105`) by `0.15 * viewport.y`, respecting the FOCUS warning about the existing `translate3d`+`will-change` containing block. The `PaperParallaxLayer.tsx` filename from the Files list is deliberately NOT created; flagged above.

---

### Task 7: Board chrome §4.7 — letterpress/ink-texture wordmark + MK-1 frame plate + wax "A" seal + decorative "+" stamp

**Files:**
- Modify: `app/globals.css:434-494` (add letterpress + chrome tokens inside the existing `html[data-theme-id="paper-atelier"]` block)
- Modify: `components/board/BoardBackgroundTypography.module.css:24-60` (paper-only `.text` letterpress/kasure treatment via `:global(html[data-theme-id="paper-atelier"]) .text`)
- Modify: `lib/board/constants.ts:53-74` (new `BOARD_Z_INDEX` entries `PAPER_CHROME`)
- Create: `components/board/chrome/PaperFramePlate.tsx`
- Create: `components/board/chrome/PaperFramePlate.module.css`
- Create: `components/board/chrome/PaperWaxSeal.tsx`
- Create: `components/board/chrome/PaperWaxSeal.module.css`
- Modify: `components/board/BoardRoot.tsx:1969-1975` (mount both chrome pieces as `pointer-events:none` siblings under `styles.outerFrame`, gated `themeId==='paper-atelier'`, `hidden={!!lightboxItemId}`)
- Test: `components/board/chrome/PaperFramePlate.test.tsx`
- Test: `components/board/chrome/PaperWaxSeal.test.tsx`

**Interfaces:**
- Consumes (from earlier tasks / contract): the existing `html[data-theme-id="paper-atelier"]` token block + tokens `--accent-gold` (`#b9924a` GOLD PEEL, `globals.css:463`), `--color-accent-primary` (`#2f4a37` FOREST, `globals.css:460`), `--card-white` (`#fffdf6`, L441), `--card-dark-alt` (`#f7f1e3` IVORY, L440), `--text-primary` (`#2b2722` CHARCOAL, L446), `--font-serif-display` (Fraunces, the `--bg-typo-font` source L474), `--font-mono` (`globals.css:218`, untouched on paper), `--font-handwriting` (Caveat); Task 2's generated fiber/grain tile token `--paper-fiber-url` (defined in the paper block by Task 2 — letterpress reuses it as the kasure mask source). `themeId: ThemeId` + `themeMeta` already in BoardRoot scope (`themeId` state L149, `themeMeta = getThemeMeta(themeId)` L809). `lightboxItemId` (drives chrome fade, already used at BoardRoot L1975/1987).
- Produces (later tasks rely on nothing structural from this task — it is leaf chrome): `BOARD_Z_INDEX.PAPER_CHROME` (lib/board/constants.ts), `PaperFramePlate` + `PaperWaxSeal` components (only mounted by BoardRoot), and a paper-only letterpress treatment on `.text`. No exported signature is consumed downstream.

> Reviewer note: split into **7a** (letterpress wordmark — CSS-only, no new component), **7b** (MK-1 plate + wax seal + "+" stamp components), **7c** (BoardRoot wiring + gating + fade). Same heading family.

---

#### Task 7a — Letterpress / kasure / ink-grain treatment on the big background wordmark (paper-only, static)

- [ ] **Step: Add the letterpress tokens to the paper block.** In `app/globals.css`, inside the existing `html[data-theme-id="paper-atelier"] { ... }` block (insert immediately after the wordmark tokens at L475, before the header-chrome-button comment at L477), add — match the ALL-CAPS palette comment style:

```css
  /* big background wordmark — STATIC letterpress/kasure treatment (Plan 2 §4.7).
     Paper-only: consumed in BoardBackgroundTypography.module.css via the scoped
     :global selector, so the DEFAULT (dotted/grid) wordmark stays flat ink.
     --wordmark-grain-url reuses Task 2's generated paper-fiber tile so the ink
     looks pressed into the same fibre as the canvas. UNITLESS time values are
     irrelevant here (no animation) but opacities/spreads stay literal. */
  --wordmark-ink-color: rgba(43, 39, 34, 0.92);     /* CHARCOAL ink, slightly deeper than flat */
  --wordmark-grain-url: var(--paper-fiber-url);      /* reuse Task 2 fibre tile */
  --wordmark-grain-opacity: 0.16;                    /* kasure dropout strength */
  --wordmark-emboss-light: rgba(255, 253, 246, 0.45); /* IVORY top highlight (letterpress lift) */
  --wordmark-emboss-shadow: rgba(43, 39, 34, 0.30);   /* CHARCOAL bottom debossed edge */
```

- [ ] **Step: Write the failing test (token presence — pure string assert).** Create `app/globals.paper-wordmark.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
const paperBlock = (() => {
  const start = css.indexOf('html[data-theme-id="paper-atelier"]')
  const open = css.indexOf('{', start)
  // naive brace match is enough — the block has no nested braces in this file
  const close = css.indexOf('}', open)
  return css.slice(open, close)
})()

describe('paper-atelier letterpress wordmark tokens', () => {
  it('defines all five wordmark letterpress tokens inside the paper block', () => {
    expect(paperBlock).toContain('--wordmark-ink-color:')
    expect(paperBlock).toContain('--wordmark-grain-url:')
    expect(paperBlock).toContain('--wordmark-grain-opacity:')
    expect(paperBlock).toContain('--wordmark-emboss-light:')
    expect(paperBlock).toContain('--wordmark-emboss-shadow:')
  })
  it('reuses Task 2 paper-fiber tile (no separate download)', () => {
    expect(paperBlock).toContain('--wordmark-grain-url: var(--paper-fiber-url)')
  })
})
```

> Naive single-`}` match works only because the paper block currently has no nested `{}`. If a later edit nests braces, swap to a depth-counting matcher. Stated here so the reviewer doesn't trust it blindly.

- [ ] **Step: Run it, expect FAIL.** `rtk vitest run app/globals.paper-wordmark.test.ts -t "five wordmark letterpress tokens"` → fails (tokens not added yet, e.g. `expected '…' to contain '--wordmark-ink-color:'`). If you added the tokens already in the previous step, this passes — that is acceptable for a pure-CSS-token unit (write-test-after is allowed when the assertion is a static presence check the implementation step necessarily produces). Prefer adding the test BEFORE the token edit to keep the red→green rhythm.

- [ ] **Step: Implement the scoped letterpress CSS.** In `components/board/BoardBackgroundTypography.module.css`, replace the reserved-slots comment block (L54-60) with the real paper-only treatment. The selector uses `:global(...)` because `data-theme-id` lives on `<html>` (outside this module's scoped class), exactly mirroring how Plan 1 reaches the wordmark via global tokens. Static, no z-index, reduced-motion-safe (no animation at all), `background-clip:text` for the kasure + a `text-shadow` letterpress emboss that degrades gracefully when `background-clip:text` is unsupported:

```css
/* ─── Variants ────────────────────────────────────────────────────────────
 *
 * Adding a new variant is purely additive: declare keyframes / transforms
 * below, no host-component refactor required. 'static' = plain motionless
 * wordmark (current default). */
.host[data-variant='static'] .text {
  /* no-op — matches the shared declaration above */
}

/* ─── Paper-atelier letterpress (Plan 2 §4.7) ──────────────────────────────
 * Paper-ONLY, STATIC, reduced-motion-safe (no animation), no positive z-index.
 * The :global() reach is required: data-theme-id lives on <html>, outside this
 * module's local scope. The DEFAULT (dotted/grid) wordmark never matches this
 * selector, so it stays the flat Plan-1 ink — byte-identical.
 *
 * Treatment = (1) a debossed letterpress emboss via dual text-shadow (a light
 * top-lift + a dark bottom edge), plus (2) a kasure/ink-dropout: the generated
 * paper-fibre tile is masked over the glyphs so the ink reads as pressed into
 * fibre with micro-gaps, like a worn print block. No filter/backdrop-filter
 * (board is fill-rate bound at 4K) — mask-image on a text-clipped pseudo only. */
:global(html[data-theme-id='paper-atelier']) .text {
  color: var(--wordmark-ink-color, rgba(43, 39, 34, 0.92));
  /* letterpress emboss: top IVORY lift + bottom CHARCOAL debossed edge */
  text-shadow:
    0 1px 0 var(--wordmark-emboss-light, rgba(255, 253, 246, 0.45)),
    0 -1px 0 var(--wordmark-emboss-shadow, rgba(43, 39, 34, 0.30));
  position: relative;
}

/* Kasure ink-dropout: clip the fibre tile to the glyph shapes and overlay it
 * at low opacity so ink shows micro-gaps. ::after inherits the parent's text
 * geometry via position:absolute inset:0 + the SAME font properties, then
 * paints the tile only where the text is (background-clip:text). aria-hidden
 * is irrelevant (pseudo). pointer-events stay off (host is pointer-events:none).
 * If background-clip:text is unsupported the ::after simply paints nothing
 * visible (transparent fill) — the emboss text-shadow above is the floor. */
:global(html[data-theme-id='paper-atelier']) .text::after {
  content: attr(data-wordmark-text);
  position: absolute;
  inset: 0;
  /* match the glyph layout exactly so the clip aligns 1:1 */
  font: inherit;
  letter-spacing: inherit;
  text-align: inherit;
  white-space: inherit;
  text-wrap: inherit;
  max-width: inherit;
  pointer-events: none;
  /* paint the fibre tile, clip to the text, lift to a low kasure opacity */
  background-image: var(--wordmark-grain-url, none);
  background-size: 220px 220px;
  background-repeat: repeat;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  opacity: var(--wordmark-grain-opacity, 0.16);
  mix-blend-mode: multiply;
}

@media (prefers-reduced-motion: reduce) {
  /* No animation exists here, but declare the no-op block so the static-only
     intent is explicit and a future motion variant can't silently leak in. */
  :global(html[data-theme-id='paper-atelier']) .text { /* static — unchanged */ }
}

/* Reserved selector slots for future variants. Empty for now.
.host[data-variant='dvd-bounce'] .text { ... }
.host[data-variant='glitch'] .text { ... }
.host[data-variant='multi'] .text { ... }
.host[data-variant='marquee'] .text { ... }
.host[data-variant='card-wind'] .text { ... }
*/
```

- [ ] **Step: Provide the kasure clone text to the pseudo (so `::after { content: attr(...) }` has the wordmark string).** In `components/board/BoardBackgroundTypography.tsx`, add a `data-wordmark-text` attribute carrying the resolved `text` onto the `<span>`. Replace the JSX `<span>` (L157-162) with:

```tsx
      <span
        ref={textRef}
        className={shutdownClass ? `${styles.text} ${shutdownClass}` : styles.text}
        data-wordmark-text={text}
      >
        {text}
      </span>
```

(`data-wordmark-text` is consumed only by the paper `::after`; on default themes the pseudo never renders so the attribute is inert. Do NOT change visibility logic, the entry/shutdown effects, or the `if (!text) return null` guard.)

- [ ] **Step: Run, expect PASS.** `rtk vitest run app/globals.paper-wordmark.test.ts` → all green.

- [ ] **Step: Playwright getComputedStyle verification (paper applies, default unaffected).** Write `C:\Users\masay\AppData\Local\Temp\claude\c--Users-masay-Desktop--------\44eacd72-79cc-4465-bbc4-55d33b324ff1\scratchpad\verify-wordmark.mjs` using the playwright-skill harness. Launch the dev board at the developer viewport (`viewport: { width: 1489, height: 679 }`, `deviceScaleFactor: 2.58` — the user's real screen), set `document.documentElement.setAttribute('data-theme-id','paper-atelier')`, then:
  - assert `getComputedStyle(span).textShadow` is NON-empty (emboss present) and contains two layers;
  - assert `getComputedStyle(span, '::after').backgroundClip` (or `webkitBackgroundClip`) is `'text'`;
  - switch back to `data-theme-id="dotted-notebook"` and assert `getComputedStyle(span).textShadow === 'none'` (default wordmark is flat — Plan 1 byte-identical).
  Print the three values. Expected: paper has a 2-layer shadow + `text` clip; default has `none`.

- [ ] **Step: Calibration-grid screenshot vs mockup.** With the same Playwright session on `data-theme-id="paper-atelier"`, overlay a 48px calibration grid (`document.body.insertAdjacentHTML` a `position:fixed; inset:0; background-image: repeating-linear-gradient(...)` div) and screenshot the wordmark region full-res. Save to scratchpad, then compare side-by-side against `docs/private/theme-mockups/03-paper-atelier__board.png`. Confirm the wordmark reads as pressed ink (kasure gaps + emboss) not flat. STOP and get user approval of the texture before committing 7a.

- [ ] **Step: Commit.** `rtk git add app/globals.css app/globals.paper-wordmark.test.ts components/board/BoardBackgroundTypography.module.css components/board/BoardBackgroundTypography.tsx && rtk git commit -m "feat(theme): paper-atelier letterpress/kasure wordmark (static, paper-only)"`

---

#### Task 7b — MK-1 frame plate + wax "A" seal + decorative "+" stamp components

- [ ] **Step: Add the chrome z-index entry.** In `lib/board/constants.ts`, add to `BOARD_Z_INDEX` (insert right after `FRAME_BORDER: 15,` at L58) a comment + entry — paper chrome sits just above the frame border and well below the toolbar so it never overlaps interactive chrome:

```ts
  FRAME_BORDER: 15,
  PAPER_CHROME: 16,  // Paper-atelier decorative frame plate + wax seal (pointer-events:none, below TOOLBAR:110)
```

- [ ] **Step: Add the chrome-token block to globals.css.** In `app/globals.css`, inside the paper block, immediately after the letterpress tokens you added in 7a (before the header-chrome-button comment at L477), add:

```css
  /* paper chrome — MK-1 plate + wax "A" seal + decorative "+" stamp (Plan 2 §4.7) */
  --plate-bg: var(--card-dark-alt);          /* IVORY plate face */
  --plate-edge: rgba(43, 39, 34, 0.22);      /* CHARCOAL engraved edge */
  --plate-text: rgba(43, 39, 34, 0.82);      /* CHARCOAL engraved label */
  --plate-rule: var(--accent-gold);          /* GOLD PEEL hairline divider */
  --wax-fill: var(--color-accent-primary);   /* FOREST wax body */
  --wax-rim: rgba(43, 39, 34, 0.35);         /* debossed wax rim */
  --wax-letter: rgba(255, 253, 246, 0.92);   /* IVORY pressed "A" */
  --stamp-ink: var(--accent-gold);           /* GOLD PEEL decorative "+" */
```

- [ ] **Step: Write the failing test for PaperFramePlate.** Create `components/board/chrome/PaperFramePlate.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaperFramePlate } from './PaperFramePlate'

describe('PaperFramePlate', () => {
  it('renders with the disambiguated data-testid (not collidable with TUNE MK-1 label)', () => {
    render(<PaperFramePlate hidden={false} />)
    expect(screen.getByTestId('paper-frame-plate')).toBeTruthy()
  })

  it('shows the engraved MK-1 / ARCHIVE technical labels', () => {
    render(<PaperFramePlate hidden={false} />)
    const plate = screen.getByTestId('paper-frame-plate')
    expect(plate.textContent).toContain('ALLMARKS MK-1')
    expect(plate.textContent).toContain('ARCHIVE')
  })

  it('is aria-hidden and not interactive (no button/link role)', () => {
    render(<PaperFramePlate hidden={false} />)
    const plate = screen.getByTestId('paper-frame-plate')
    expect(plate.getAttribute('aria-hidden')).toBe('true')
    expect(plate.querySelector('button')).toBeNull()
    expect(plate.querySelector('a')).toBeNull()
    expect(plate.querySelector('[role="button"]')).toBeNull()
  })

  it('reflects the hidden flag via a data attribute (chrome fade mirror)', () => {
    const { rerender } = render(<PaperFramePlate hidden={false} />)
    expect(screen.getByTestId('paper-frame-plate').getAttribute('data-hidden')).toBe('false')
    rerender(<PaperFramePlate hidden />)
    expect(screen.getByTestId('paper-frame-plate').getAttribute('data-hidden')).toBe('true')
  })
})
```

- [ ] **Step: Run it, expect FAIL.** `rtk vitest run components/board/chrome/PaperFramePlate.test.tsx` → fails with module-not-found for `./PaperFramePlate`.

- [ ] **Step: Implement PaperFramePlate.tsx.** Create `components/board/chrome/PaperFramePlate.tsx`:

```tsx
'use client'

import type { ReactElement } from 'react'
import styles from './PaperFramePlate.module.css'

/**
 * Decorative "ALLMARKS MK-1 / ARCHIVE" engraved plate pinned to the board's
 * bottom-left margin — paper-atelier chrome only (Plan 2 §4.7). It is pure
 * decoration: aria-hidden, pointer-events:none, no role, no handlers. Mounted
 * by BoardRoot ONLY when themeId === 'paper-atelier', as a sibling of
 * <BoardChrome/>. Fades with the rest of the chrome while the Lightbox is open
 * (the parent passes `hidden`, mirroring BoardChrome's hidden prop).
 *
 * The ALL-CAPS technical labels (ALLMARKS MK-1 / ARCHIVE) are intentionally
 * hardcoded world-clear English — no i18n sentence is involved. The maker label
 * uses --font-mono (untouched on paper) so it reads as an engraved spec plate.
 *
 * NOTE: the visually-similar 'ALLMARKS · MK-1' string in TunePresetColumn.tsx
 * (L48-50) is an UNRELATED TUNE column maker label with its own getByText test.
 * This component is identified ONLY by data-testid="paper-frame-plate" to avoid
 * a text collision.
 */
export function PaperFramePlate({ hidden }: {
  /** Mirror of BoardChrome's hidden prop — true while the Lightbox is open, so
   *  the plate fades out with the rest of the chrome. */
  readonly hidden: boolean
}): ReactElement {
  return (
    <div
      className={hidden ? `${styles.plate} ${styles.hidden}` : styles.plate}
      data-testid="paper-frame-plate"
      data-hidden={hidden ? 'true' : 'false'}
      aria-hidden="true"
    >
      <span className={styles.title}>ALLMARKS&nbsp;MK-1</span>
      <span className={styles.rule} />
      <span className={styles.sub}>ARCHIVE</span>
    </div>
  )
}
```

- [ ] **Step: Implement PaperFramePlate.module.css.** Create `components/board/chrome/PaperFramePlate.module.css`. No animation (static engraved plate); fade is opacity transition only (reduced-motion-safe — opacity fade is a chrome state change, gated by the same `transition` the other chrome uses, and harmless under reduced motion):

```css
/* "ALLMARKS MK-1 / ARCHIVE" engraved plate — bottom-left board margin.
 * Paper-atelier chrome only (mounted gated by BoardRoot). pointer-events:none,
 * static, sits at BOARD_Z_INDEX.PAPER_CHROME (16) — above the frame border,
 * far below the toolbar (110). Engraved look = IVORY face + CHARCOAL edge +
 * GOLD PEEL hairline rule, mono spec text. */
.plate {
  position: absolute;
  left: calc(var(--canvas-margin, 48px) + 12px);
  bottom: calc(var(--canvas-margin, 48px) * 0.32);
  z-index: 16; /* = BOARD_Z_INDEX.PAPER_CHROME */
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 11px;
  pointer-events: none;
  user-select: none;
  background: var(--plate-bg, #f7f1e3);
  border: 1px solid var(--plate-edge, rgba(43, 39, 34, 0.22));
  border-radius: 2px;
  box-shadow:
    inset 0 1px 0 rgba(255, 253, 246, 0.6),
    inset 0 -1px 0 rgba(43, 39, 34, 0.12),
    0 1px 3px rgba(43, 39, 34, 0.14);
  transition: opacity 0.25s ease;
}

.hidden {
  opacity: 0;
}

.title {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--plate-text, rgba(43, 39, 34, 0.82));
}

.rule {
  width: 1px;
  align-self: stretch;
  margin: 1px 0;
  background: var(--plate-rule, #b9924a);
  opacity: 0.7;
}

.sub {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.22em;
  color: var(--plate-text, rgba(43, 39, 34, 0.82));
  opacity: 0.78;
}

@media (max-width: 720px) {
  .plate {
    left: var(--canvas-margin, 48px);
  }
}
```

- [ ] **Step: Run, expect PASS (plate).** `rtk vitest run components/board/chrome/PaperFramePlate.test.tsx` → green.

- [ ] **Step: Write the failing test for PaperWaxSeal.** Create `components/board/chrome/PaperWaxSeal.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaperWaxSeal } from './PaperWaxSeal'

describe('PaperWaxSeal', () => {
  it('renders with the disambiguated data-testid', () => {
    render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-seal')).toBeTruthy()
  })

  it('presses an "A" letter into the wax (the AllMarks monogram)', () => {
    render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-seal').textContent).toContain('A')
  })

  it('renders the decorative "+" stamp', () => {
    render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-stamp')).toBeTruthy()
  })

  it('the "+" stamp is DECORATIVE — not a button, no role, no onClick handler', () => {
    render(<PaperWaxSeal hidden={false} />)
    const stamp = screen.getByTestId('paper-wax-stamp')
    expect(stamp.tagName.toLowerCase()).not.toBe('button')
    expect(stamp.getAttribute('role')).toBeNull()
    expect(stamp.closest('button')).toBeNull()
    expect(stamp.closest('a')).toBeNull()
  })

  it('is aria-hidden and fully non-interactive (no buttons/links anywhere)', () => {
    render(<PaperWaxSeal hidden={false} />)
    const seal = screen.getByTestId('paper-wax-seal')
    expect(seal.getAttribute('aria-hidden')).toBe('true')
    expect(seal.querySelector('button')).toBeNull()
    expect(seal.querySelector('a')).toBeNull()
    expect(seal.querySelector('[role="button"]')).toBeNull()
  })

  it('reflects the hidden flag via a data attribute (chrome fade mirror)', () => {
    const { rerender } = render(<PaperWaxSeal hidden={false} />)
    expect(screen.getByTestId('paper-wax-seal').getAttribute('data-hidden')).toBe('false')
    rerender(<PaperWaxSeal hidden />)
    expect(screen.getByTestId('paper-wax-seal').getAttribute('data-hidden')).toBe('true')
  })
})
```

- [ ] **Step: Run it, expect FAIL.** `rtk vitest run components/board/chrome/PaperWaxSeal.test.tsx` → fails (module not found).

- [ ] **Step: Implement PaperWaxSeal.tsx.** Create `components/board/chrome/PaperWaxSeal.tsx`. The seal is an SVG circle (FOREST wax) with a pressed IVORY "A" monogram; the decorative "+" is a sibling stamp (GOLD PEEL), explicitly NOT a button (DECISION DEFAULT: the green "+" is a decorative wax stamp, not a functional save button):

```tsx
'use client'

import type { ReactElement } from 'react'
import styles from './PaperWaxSeal.module.css'

/**
 * Decorative wax "A" seal + a decorative "+" stamp pinned to the board's
 * bottom-right margin — paper-atelier chrome only (Plan 2 §4.7).
 *
 * DECISION DEFAULT (flagged in the plan): the green "+" is a DECORATIVE
 * wax-pressed stamp, NOT a functional save button. It therefore has no onClick,
 * no role, is not a <button>/<a>, and is pointer-events:none like the rest of
 * this chrome. Per-card captions are intentionally absent elsewhere; this seal
 * is the only branded flourish in the bottom-right.
 *
 * The seal body is FOREST wax (--color-accent-primary) with a debossed rim and
 * an IVORY pressed "A" (the AllMarks monogram — A-motif logo, NOT M/X). The "+"
 * is GOLD PEEL (--accent-gold). All ALL-CAPS / single-glyph marks are
 * world-clear and need no i18n.
 *
 * Mounted by BoardRoot ONLY when themeId === 'paper-atelier'. Fades with the
 * chrome while the Lightbox is open via the `hidden` prop (mirrors BoardChrome).
 */
export function PaperWaxSeal({ hidden }: {
  /** Mirror of BoardChrome's hidden prop — true while the Lightbox is open. */
  readonly hidden: boolean
}): ReactElement {
  return (
    <div
      className={hidden ? `${styles.wrap} ${styles.hidden}` : styles.wrap}
      data-testid="paper-wax-seal"
      data-hidden={hidden ? 'true' : 'false'}
      aria-hidden="true"
    >
      {/* decorative "+" stamp — NOT a button, NOT a save action */}
      <span className={styles.stamp} data-testid="paper-wax-stamp">+</span>
      {/* wax "A" seal */}
      <svg
        className={styles.seal}
        viewBox="0 0 64 64"
        width="64"
        height="64"
        role="presentation"
        focusable="false"
      >
        {/* irregular wax blob — a circle with subtle drips, FOREST fill */}
        <circle cx="32" cy="32" r="27" className={styles.wax} />
        <circle cx="32" cy="32" r="27" className={styles.waxRim} />
        {/* pressed monogram "A" — IVORY, debossed look via the rim stroke */}
        <text
          x="32"
          y="42"
          textAnchor="middle"
          className={styles.monogram}
        >
          A
        </text>
      </svg>
    </div>
  )
}
```

- [ ] **Step: Implement PaperWaxSeal.module.css.** Create `components/board/chrome/PaperWaxSeal.module.css`. Static, pointer-events:none, fade-only opacity transition:

```css
/* Wax "A" seal + decorative "+" stamp — bottom-right board margin.
 * Paper-atelier chrome only. pointer-events:none, static, z-index =
 * BOARD_Z_INDEX.PAPER_CHROME (16). The "+" is decorative (no handler). */
.wrap {
  position: absolute;
  right: calc(var(--canvas-margin, 48px) + 12px);
  bottom: calc(var(--canvas-margin, 48px) * 0.22);
  z-index: 16; /* = BOARD_Z_INDEX.PAPER_CHROME */
  display: inline-flex;
  align-items: center;
  gap: 14px;
  pointer-events: none;
  user-select: none;
  transition: opacity 0.25s ease;
}

.hidden {
  opacity: 0;
}

/* decorative GOLD PEEL "+" stamp — slightly rotated, hand-pressed feel */
.stamp {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: var(--stamp-ink, #b9924a);
  transform: rotate(-8deg);
  opacity: 0.85;
  text-shadow: 0 1px 1px rgba(43, 39, 34, 0.18);
}

.seal {
  display: block;
  filter: none; /* board is fill-rate bound — NO drop-shadow filter */
  transform: rotate(6deg);
}

/* FOREST wax body with a soft debossed look (inner highlight via the rim) */
.wax {
  fill: var(--wax-fill, #2f4a37);
}

/* debossed rim — a darker stroke just inside the edge so the wax reads pressed */
.waxRim {
  fill: none;
  stroke: var(--wax-rim, rgba(43, 39, 34, 0.35));
  stroke-width: 2.5;
}

/* IVORY pressed monogram "A" — the AllMarks A-motif */
.monogram {
  font-family: var(--font-serif-display, Georgia, serif);
  font-size: 34px;
  font-weight: 700;
  fill: var(--wax-letter, rgba(255, 253, 246, 0.92));
  letter-spacing: 0;
}
```

> `box-shadow`/`text-shadow` are paint-cheap and static; the FOCUS/contract bans only always-on `filter`/`backdrop-filter` and animated GPU work — `.seal { filter: none }` is explicit so no one adds a drop-shadow filter later. The chrome is two tiny static nodes in the margin, not over the cards, so there is no 4K composite cost.

- [ ] **Step: Run, expect PASS (seal).** `rtk vitest run components/board/chrome/PaperWaxSeal.test.tsx` → green.

- [ ] **Step: Commit.** `rtk git add lib/board/constants.ts app/globals.css components/board/chrome/PaperFramePlate.tsx components/board/chrome/PaperFramePlate.module.css components/board/chrome/PaperFramePlate.test.tsx components/board/chrome/PaperWaxSeal.tsx components/board/chrome/PaperWaxSeal.module.css components/board/chrome/PaperWaxSeal.test.tsx && rtk git commit -m "feat(theme): paper-atelier MK-1 plate + wax A seal + decorative + stamp"`

---

#### Task 7c — Wire the chrome into BoardRoot, gated on paper-atelier, fading with the Lightbox

- [ ] **Step: Write the failing gating test.** Create `components/board/chrome/PaperChrome.gating.test.tsx`. This proves the gate logic in isolation (BoardRoot is too heavy to mount in vitest — it pulls IndexedDB/GSAP). We test a tiny pure gate predicate plus that the components only render when told to:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ThemeId } from '@/lib/board/types'
import { getThemeMeta } from '@/lib/board/theme-registry'
import { PaperFramePlate } from './PaperFramePlate'
import { PaperWaxSeal } from './PaperWaxSeal'

/** The exact gate BoardRoot uses: chrome shows only when the theme opts into
 *  decorations. Mirrors meta.decorations === true (paper-atelier only). */
function showsPaperChrome(themeId: ThemeId): boolean {
  return getThemeMeta(themeId).decorations === true
}

describe('paper chrome gating', () => {
  it('only paper-atelier opts into the decorative chrome', () => {
    expect(showsPaperChrome('paper-atelier')).toBe(true)
    expect(showsPaperChrome('dotted-notebook')).toBe(false)
    expect(showsPaperChrome('grid-paper')).toBe(false)
  })

  it('renders nothing for non-paper themes when the gate is false (simulated)', () => {
    const themeId: ThemeId = 'dotted-notebook'
    render(
      <>{showsPaperChrome(themeId) ? <><PaperFramePlate hidden={false} /><PaperWaxSeal hidden={false} /></> : null}</>,
    )
    expect(screen.queryByTestId('paper-frame-plate')).toBeNull()
    expect(screen.queryByTestId('paper-wax-seal')).toBeNull()
  })

  it('renders both chrome pieces for paper-atelier', () => {
    const themeId: ThemeId = 'paper-atelier'
    render(
      <>{showsPaperChrome(themeId) ? <><PaperFramePlate hidden={false} /><PaperWaxSeal hidden={false} /></> : null}</>,
    )
    expect(screen.getByTestId('paper-frame-plate')).toBeTruthy()
    expect(screen.getByTestId('paper-wax-seal')).toBeTruthy()
  })
})
```

> This relies on `ThemeMeta.decorations` and `decorations: true` on paper-atelier in the registry — both are introduced by the SHARED CONTRACT (registry Task / Task 1). If `decorations` is not yet on the registry when 7c runs, gate on `themeId === 'paper-atelier'` instead (the FOCUS allows either); keep the predicate as the single source of truth and update BoardRoot to match.

- [ ] **Step: Run it, expect FAIL.** `rtk vitest run components/board/chrome/PaperChrome.gating.test.tsx -t "only paper-atelier opts"` → if `decorations` is already in the registry it passes (acceptable; this case asserts existing contract data). The render cases fail until the components are importable — but 7b already created them, so the realistic failure here is only if 7c runs before 7b. Run after 7b; expect this whole file GREEN except it will be RED if you wrote it before importing the real components. (If you want a true red: temporarily rename a testid expectation, confirm fail, revert.)

- [ ] **Step: Implement — import the chrome in BoardRoot.** In `components/board/BoardRoot.tsx`, add to the chrome imports (next to the existing `BoardChrome` import) :

```tsx
import { PaperFramePlate } from './chrome/PaperFramePlate'
import { PaperWaxSeal } from './chrome/PaperWaxSeal'
```

- [ ] **Step: Implement — mount the chrome as siblings of BoardChrome.** In `components/board/BoardRoot.tsx`, directly after `<BoardChrome hidden={!!lightboxItemId} />` (L1975), insert the gated paper chrome. Gate on `themeMeta.decorations` (already derived at L809 as `themeMeta = getThemeMeta(themeId)`); both pieces mirror BoardChrome's `hidden={!!lightboxItemId}` so they fade with the rest of the chrome when the Lightbox opens:

```tsx
      <BoardChrome hidden={!!lightboxItemId} />
      {/* Paper-atelier decorative chrome (Plan 2 §4.7) — MK-1 plate (bottom-left)
          + wax "A" seal & decorative "+" stamp (bottom-right). pointer-events:none
          siblings of BoardChrome, gated on the theme opting into decorations, and
          faded with the chrome while the Lightbox is open (mirrors BoardChrome). */}
      {themeMeta.decorations === true && (
        <>
          <PaperFramePlate hidden={!!lightboxItemId} />
          <PaperWaxSeal hidden={!!lightboxItemId} />
        </>
      )}
```

> If the registry `decorations` field is not yet merged when you run 7c, substitute `{themeId === 'paper-atelier' && (` for the gate and keep everything else identical. Do NOT touch `buildShareData`'s `DEFAULT_THEME_ID` (BoardRoot L1682-1685) — share theming is Plan 3, out of scope.

- [ ] **Step: Run, expect PASS.** `rtk vitest run components/board/chrome/PaperChrome.gating.test.tsx` → green.

- [ ] **Step: Typecheck the wiring.** `rtk tsc` → no errors (confirms `themeMeta.decorations` is a known field and the new imports resolve). Expected: clean. If `decorations` errors as unknown, the registry contract task has not landed — coordinate, do not invent the field here.

- [ ] **Step: Playwright end-to-end gating + fade verification.** Write `…/scratchpad/verify-paper-chrome.mjs`. Launch the dev board at the developer viewport (`1489×679`, `deviceScaleFactor: 2.58`). Steps:
  1. On the default theme (`dotted-notebook`), assert `page.locator('[data-testid="paper-frame-plate"]')` and `[data-testid="paper-wax-seal"]` have count `0` (chrome absent off-paper).
  2. Switch to paper-atelier (via SETTINGS THEMES picker shipped in Plan 1, or set `data-theme-id` + the React state if reachable — prefer the real picker so the gate runs). Assert both testids now have count `1`.
  3. Assert `getComputedStyle(plate).pointerEvents === 'none'` and the same for the seal and the `[data-testid="paper-wax-stamp"]`.
  4. Open the Lightbox (click a card), assert `getComputedStyle(plate).opacity` transitions toward `0` (read `data-hidden="true"` and computed opacity < 0.1 after the 250ms transition).
  Print every assertion result.

- [ ] **Step: Calibration-grid screenshot vs mockups.** With the Playwright session on paper-atelier (Lightbox closed), overlay the 48px calibration grid and capture two full-res crops: bottom-left (plate) and bottom-right (seal + "+"). Save to scratchpad and compare against `docs/private/theme-mockups/03-paper-atelier__board.png` (and `…__settings.png` if the chrome is visible there). Verify plate position/size/engraving and the wax seal FOREST + IVORY "A" + GOLD "+" match the mockup. STOP for user approval before committing.

- [ ] **Step: Full deploy gate.** `rtk tsc && rtk vitest run && rtk pnpm build` → all pass (the parity test `messages/all-keys-parity.test.ts` stays green because this task adds NO new i18n sentences — all chrome labels are ALL-CAPS world-clear; the wax "A"/"+" are single glyphs). Confirm `out/` is produced.

- [ ] **Step: Commit.** `rtk git add components/board/BoardRoot.tsx components/board/chrome/PaperChrome.gating.test.tsx && rtk git commit -m "feat(theme): mount paper-atelier chrome (plate + wax seal) gated on decorations, fades with Lightbox"`

---

### Task 8: Plan-2 deferred minors + final calibration, e2e, full verification & deploy

This task closes the four deferred-minor items, re-enables the skipped e2e, runs the whole-board calibration pass against the mockups, and ships. Split into **8a** (deferred minors + their unit tests), **8b** (e2e un-skip + extend), and **8c** (final calibration grid pass + full verify + deploy).

---

#### Task 8a: Deferred minors — lightbox light scrim, picker `role=group`, gentle locked-pill

**Files:**
- Modify: `components/board/Lightbox.module.css:13-36` (tokenize `.backdrop` background) and `app/globals.css:434-494` (add `--lightbox-backdrop` override inside the paper block; default lives at `app/globals.css:376`)
- Modify: `components/board/ThemePicker.tsx:23-53` (add `role="group"` + `aria-label`; gentle locked pill)
- Modify: `components/board/ThemePicker.module.css:11,17` (gentle amber locked-pill styling)
- Modify: all 15 `messages/{ja,en,zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi}.json` (add `board.theme.pickerGroupLabel` + `board.theme.unlockLater`)
- Test: `components/board/ThemePicker.test.tsx` (add `role=group` + gentle-copy assertions), `messages/all-keys-parity.test.ts` (auto-covers new keys), `app/globals.css` paper scrim verified via Playwright computed-style step (visual)

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime — paper block tokens established in Task 1 (`app/globals.css:434-494`), `--accent-gold #b9924a` (`app/globals.css:463`), `useI18n().t` (already imported `ThemePicker.tsx:7,22`).
- Produces: i18n keys `board.theme.pickerGroupLabel` and `board.theme.unlockLater` (full sentences in all 15 locales); `--lightbox-backdrop` paper override. No code signatures other tasks depend on.

Steps:

- [ ] **Step: Write the failing test (picker role=group)** — append to `components/board/ThemePicker.test.tsx` inside the existing `describe('ThemePicker', …)`:
```tsx
  it('wraps the swatches in a labelled group for screen readers', () => {
    render(<ThemePicker themeId={'free-a' as ThemeId} onThemeChange={() => {}} />)
    const group = screen.getByRole('group')
    expect(group).toBeTruthy()
    // aria-label is the raw i18n KEY because the mock t() echoes the key
    expect(group.getAttribute('aria-label')).toBe('board.theme.pickerGroupLabel')
  })
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/ThemePicker.test.tsx -t "labelled group"` → expect `TestingLibraryElementError: Unable to find an accessible element with the role "group"` (the `.grid` div at `ThemePicker.tsx:26` has no role yet).

- [ ] **Step: Implement (role=group on the grid)** — in `components/board/ThemePicker.tsx`, replace the grid open tag at L26 (`<div className={styles.grid}>`) with:
```tsx
      <div className={styles.grid} role="group" aria-label={t('board.theme.pickerGroupLabel')}>
```
(`t` is already destructured at `ThemePicker.tsx:22`; nothing else changes here.)

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/ThemePicker.test.tsx -t "labelled group"` → 1 passed. (Parity test will fail until the key exists in all locales — added below.)

- [ ] **Step: Write the failing test (gentle locked pill)** — replace the existing locked-path test body in `components/board/ThemePicker.test.tsx` (the `it('locks a paid theme without a license: …')` block) so it asserts the new gentle copy instead of the bare `LOCKED` badge:
```tsx
  it('locks a paid theme gently: disabled, no error tone, kind unlock copy, no callback', () => {
    const onChange = vi.fn()
    render(<ThemePicker themeId={'free-a' as ThemeId} onThemeChange={onChange} licenses={new Set()} />)
    const paid = screen.getByTestId('theme-button-paid-x')
    expect(paid.hasAttribute('disabled')).toBe(true)
    // gentle affordance: kind "unlock later" sentence (raw key via mock t), amber pill class present
    expect(paid.querySelector('[data-locked-pill]')).toBeTruthy()
    expect(paid.textContent).toContain('board.theme.unlockLater')
    // it must NOT use error vocabulary
    expect(paid.textContent).not.toContain('LOCKED')
    expect(paid.textContent).not.toContain('ERROR')
    fireEvent.click(paid)
    expect(onChange).not.toHaveBeenCalled()
  })
```
Note: the test mock REG (`ThemePicker.test.tsx:15-19`) provides `paid-x` (tier `'paid'`) — that is the locked fixture; `paper-atelier` is free so it never shows the pill in prod.

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run components/board/ThemePicker.test.tsx -t "locks a paid theme gently"` → expect failure on `expect(paid.querySelector('[data-locked-pill]')).toBeTruthy()` returning `null` (and `textContent` still contains `LOCKED`).

- [ ] **Step: Implement (gentle locked pill in ThemePicker)** — in `components/board/ThemePicker.tsx`, replace the badge line at L47 (`<span className={styles.badge}>{unlocked ? 'FREE' : 'LOCKED'}</span>`) with a branch that keeps the ALL-CAPS `FREE` label for unlocked themes and shows a kind amber pill for locked ones:
```tsx
              {unlocked ? (
                <span className={styles.badge}>FREE</span>
              ) : (
                <span className={styles.lockedPill} data-locked-pill aria-hidden="false">
                  {t('board.theme.unlockLater')}
                </span>
              )}
```
The `disabled={!unlocked}` and no-op `onClick` guard at `ThemePicker.tsx:40-43` stay exactly as-is (still disabled, still no callback).

- [ ] **Step: Implement (amber pill style)** — in `components/board/ThemePicker.module.css`, after the existing `.badge` rule (L17) add a kind, non-error amber pill (⚠ amber tone, NOT red). It reuses `--accent-gold #b9924a` so it harmonizes with the paper world while reading as warm/amber everywhere:
```css
.lockedPill {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  line-height: 1.25;
  text-align: center;
  padding: 3px 6px;
  border-radius: 999px;
  /* AMBER, kind — never red/error. Soft fill + warm border. */
  color: var(--accent-gold, #b9924a);
  background: color-mix(in srgb, var(--accent-gold, #b9924a) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-gold, #b9924a) 38%, transparent);
}
```

- [ ] **Step: Run, expect PASS** — `rtk vitest run components/board/ThemePicker.test.tsx -t "locks a paid theme gently"` → 1 passed. Also re-run the unchanged unlocked test: `rtk vitest run components/board/ThemePicker.test.tsx -t "unlocks a paid theme"` → still passes (`FREE` branch intact).

- [ ] **Step: Add the two i18n keys to en.json** — in `messages/en.json`, inside the existing `board.theme` object (key starts at `messages/en.json:36`), add:
```json
      "pickerGroupLabel": "Choose a board theme.",
      "unlockLater": "Unlocks later — stay tuned.",
```

- [ ] **Step: Add the two keys to the other 14 locales** — add the same two keys under `board.theme` in each file with these translations (keep keys ASCII, values localized):
  - `ja.json`: `"pickerGroupLabel": "ボードのテーマを選びます。"`, `"unlockLater": "あとで使えるようになります。お楽しみに。"`
  - `zh.json`: `"pickerGroupLabel": "选择一个画板主题。"`, `"unlockLater": "稍后即可解锁，敬请期待。"`
  - `ko.json`: `"pickerGroupLabel": "보드 테마를 선택하세요."`, `"unlockLater": "곧 사용할 수 있어요. 기대해 주세요."`
  - `es.json`: `"pickerGroupLabel": "Elige un tema de tablero."`, `"unlockLater": "Se desbloqueará más adelante. No te lo pierdas."`
  - `fr.json`: `"pickerGroupLabel": "Choisissez un thème de tableau."`, `"unlockLater": "Bientôt disponible. Restez à l'écoute."`
  - `de.json`: `"pickerGroupLabel": "Wähle ein Board-Thema."`, `"unlockLater": "Bald freigeschaltet. Bleib dran."`
  - `pt.json`: `"pickerGroupLabel": "Escolha um tema de quadro."`, `"unlockLater": "Disponível em breve. Fique de olho."`
  - `it.json`: `"pickerGroupLabel": "Scegli un tema per la bacheca."`, `"unlockLater": "Si sblocca più avanti. Resta sintonizzato."`
  - `nl.json`: `"pickerGroupLabel": "Kies een bordthema."`, `"unlockLater": "Binnenkort beschikbaar. Houd het in de gaten."`
  - `tr.json`: `"pickerGroupLabel": "Bir pano teması seçin."`, `"unlockLater": "Yakında açılacak. Takipte kalın."`
  - `ru.json`: `"pickerGroupLabel": "Выберите тему доски."`, `"unlockLater": "Откроется позже. Следите за обновлениями."`
  - `ar.json`: `"pickerGroupLabel": "اختر سمة للوحة."`, `"unlockLater": "سيتم فتحها لاحقًا. ترقّبوا."`
  - `th.json`: `"pickerGroupLabel": "เลือกธีมของบอร์ด"`, `"unlockLater": "จะปลดล็อกในภายหลัง โปรดติดตาม"`
  - `vi.json`: `"pickerGroupLabel": "Chọn một chủ đề bảng."`, `"unlockLater": "Sẽ mở khóa sau. Hãy chờ nhé."`

- [ ] **Step: Run i18n parity, expect PASS** — `rtk vitest run messages/all-keys-parity.test.ts` → passes (zero-missing / zero-extra / non-empty across all 15; the two new keys are present everywhere).

- [ ] **Step: Write the failing test (paper lightbox scrim token)** — the scrim color is visual, so assert the TOKEN exists in the paper block via a string test. Create `app/globals.paper-scrim.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('paper-atelier lightbox scrim', () => {
  const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
  const paperBlock = css.slice(css.indexOf('html[data-theme-id="paper-atelier"]'))
    .slice(0, css.slice(css.indexOf('html[data-theme-id="paper-atelier"]')).indexOf('}') + 1)

  it('overrides --lightbox-backdrop to a pale parchment scrim (not the dark default)', () => {
    expect(paperBlock).toContain('--lightbox-backdrop:')
    // pale parchment: must NOT reuse the dark rgba(0, 0, 0, ...) default
    const match = paperBlock.match(/--lightbox-backdrop:\s*([^;]+);/)
    expect(match).toBeTruthy()
    expect(match![1]).not.toContain('0, 0, 0')
  })
})
```

- [ ] **Step: Run it, expect FAIL** — `rtk vitest run app/globals.paper-scrim.test.ts` → expect `expect(paperBlock).toContain('--lightbox-backdrop:')` to fail (the paper block at `app/globals.css:434-494` defines no `--lightbox-backdrop`).

- [ ] **Step: Implement (pale paper scrim override)** — first tokenize the consumer: confirm `.backdrop` already reads `background: var(--lightbox-backdrop)` at `components/board/Lightbox.module.css:22` (it does — no edit needed) and the default `--lightbox-backdrop: rgba(0, 0, 0, 0.5)` lives at `app/globals.css:376` (unchanged). Then add the paper override inside the paper block. Insert just before the closing `}` at `app/globals.css:494`, after the shadow tokens (L492-493):
```css

  /* lightbox scrim — PALE PARCHMENT behind enlarged media (NOT the dark default).
     Portals inherit because data-theme-id lives on <html>, so the body-level
     lightbox portal still resolves this var. */
  --lightbox-backdrop: rgba(43, 39, 34, 0.34);   /* CHARCOAL ink @ low alpha over PARCHMENT */
```
The existing `backdrop-filter: blur(var(--lightbox-backdrop-blur))` at `Lightbox.module.css:33` is left as-is (no per-theme change — Plan 2 only tints the scrim color).

- [ ] **Step: Run, expect PASS** — `rtk vitest run app/globals.paper-scrim.test.ts` → 1 passed.

- [ ] **Step: Commit 8a** — `rtk git add components/board/ThemePicker.tsx components/board/ThemePicker.module.css components/board/ThemePicker.test.tsx components/board/Lightbox.module.css app/globals.css app/globals.paper-scrim.test.ts messages/*.json && rtk git commit -m "feat(theme): paper-atelier deferred minors — pale lightbox scrim, picker role=group, gentle amber locked-pill (i18n x15)"`

---

#### Task 8b: Re-enable + extend the theme-switch e2e

**Files:**
- Modify: `tests/e2e/board-b0.spec.ts:138-142` (un-skip + extend the `theme switch toggles background` test)

**Interfaces:**
- Consumes: `[data-theme-button='grid-paper']` / `[data-theme-button='paper-atelier']` from `ThemePicker.tsx:36`; the hover-open drawer wrapper `[data-testid='extension-settings-wrap']` (`ExtensionEntry.tsx:159`); `[data-theme-id='paper-atelier']` on `<html>` (Task 1 cascade); `data-meter-variant='ruler'` on the ScrollMeter `.track` (Task 2); a decoration testid from `PaperCardDecorations` (Task 3 — `data-testid='paper-card-decorations'`).
- Produces: nothing — this is the integration gate only.

Steps:

- [ ] **Step: Confirm the drawer is hover-open** — re-read `components/board/ExtensionEntry.tsx:159-167`: the picker lives inside `[data-testid='extension-settings-wrap']` which reveals `[data-testid='extension-settings']` on hover. The current skipped test (`tests/e2e/board-b0.spec.ts:139-142`) clicks the button directly without opening the drawer, which is why it was skipped. The fix is a `.hover()` on the wrap before clicking.

- [ ] **Step: Confirm the decoration testid** — verify Task 3 shipped `data-testid='paper-card-decorations'` on the `PaperCardDecorations` overlay root (`components/board/decorations/PaperCardDecorations.tsx`). If Task 3 used a different testid, use that exact value in the assertion below instead. (Decorations only mount when `getThemeMeta(themeId).decorations === true`, i.e. paper-atelier — Task 4 wiring in `CardsLayer.tsx`.)

- [ ] **Step: Implement (un-skip + extend)** — replace the entire skipped block at `tests/e2e/board-b0.spec.ts:138-142` with:
```ts
  test('theme switch toggles background, ruler meter and decorations', async ({ page }) => {
    // The THEMES picker lives inside the hover-open SETTINGS drawer; reveal it first.
    const drawer = page.locator('[data-testid="extension-settings-wrap"]')
    await drawer.hover()
    await expect(page.locator('[data-testid="extension-settings"]')).toBeVisible()

    // 1) switch to grid-paper → <html data-theme-id="grid-paper">
    await page.locator('[data-theme-button="grid-paper"]').click()
    await expect(page.locator('html[data-theme-id="grid-paper"]')).toHaveCount(1)

    // 2) switch to paper-atelier (re-reveal the drawer in case hover dropped)
    await drawer.hover()
    await expect(page.locator('[data-testid="extension-settings"]')).toBeVisible()
    await page.locator('[data-theme-button="paper-atelier"]').click()
    await expect(page.locator('html[data-theme-id="paper-atelier"]')).toHaveCount(1)

    // paper-atelier uses the RULER scroll meter (Task 2 sets data-meter-variant on .track)
    await expect(page.locator('[data-meter-variant="ruler"]')).toHaveCount(1)

    // paper-atelier mounts pointer-events:none card decorations (Task 3/4)
    await expect(page.locator('[data-testid="paper-card-decorations"]').first()).toBeAttached()
  })
```

- [ ] **Step: Run the single e2e, expect PASS** — `rtk playwright test tests/e2e/board-b0.spec.ts -g "theme switch toggles background, ruler meter and decorations"`. Expect green. If `data-theme-id` lands on `<html>` AND ScrollMeter exposes `data-meter-variant` AND decorations mount, all four assertions pass.

- [ ] **Step: If FAIL on the hover, debug ONE thing** — if the drawer doesn't open under headless hover, switch the reveal to `await drawer.dispatchEvent('pointerenter')` then `await drawer.dispatchEvent('mouseenter')` (CSS hover drawers respond to either); do NOT pile on speculative fixes — change one selector/event at a time and re-run.

- [ ] **Step: Run the full e2e file, expect no regressions** — `rtk playwright test tests/e2e/board-b0.spec.ts` → the reorder test (L102-136) and the two intentionally-skipped tests (`card drag updates its position` L146, plus any others) behave as before; only the theme test flipped from skip→pass.

- [ ] **Step: Commit 8b** — `rtk git add tests/e2e/board-b0.spec.ts && rtk git commit -m "test(e2e): un-skip theme switch — assert html data-theme-id, ruler meter, paper decorations via hover-open drawer"`

---

#### Task 8c: Final calibration grid pass + full verify + deploy

**Files:**
- Create (scratch, NOT committed): `C:\Users\masay\AppData\Local\Temp\claude\…\scratchpad\paper-calibration.mjs` (Playwright calibration-grid screenshot script)
- Modify (token nudges, calibration-driven): `app/globals.css:434-494` (paper tokens), `components/board/scrollmeter/RulerTrack.module.css` (ruler spacing), `lib/animation/tag-entry/themes/paper-drift.module.css` (drift amplitude), `components/board/decorations/PaperCardDecorations.module.css` (decoration tints)
- Modify (docs): `docs/CURRENT_GOAL.md`, `docs/TODO_COMPLETED.md`, `docs/private/dashboard.html`
- Reference (mockups, read-only): `docs/private/theme-mockups/03-paper-atelier__board.png`, `…__settings.png`, `…__scrollmeter.png`

**Interfaces:**
- Consumes: every paper token/animation/decoration shipped in Tasks 1-7. Produces: the shipped, deployed Plan-2 paper theme. No code signatures.

Steps:

- [ ] **Step: Verify the paper lightbox scrim in the PORTAL via computed style** — write a Playwright check (it cannot be a vitest assertion — the scrim only resolves in the real portal). In the scratchpad script, after switching to paper-atelier and opening a card into the lightbox, read the portal backdrop:
```js
// inside the calibration script
const scrim = await page.locator('.backdrop, [class*="backdrop"]').first().evaluate(
  (el) => getComputedStyle(el).backgroundColor,
)
console.log('paper lightbox scrim =', scrim)
// EXPECT a pale parchment-tinted color (rgba around 43,39,34 @ ~0.34), NOT rgb(0,0,0)/rgba(0,0,0,...)
if (scrim.startsWith('rgb(0, 0, 0') || scrim === 'rgba(0, 0, 0, 0.5)') {
  throw new Error('paper scrim still dark — token not reaching portal')
}
```
Run it; confirm the logged color is the parchment tint (proves the `<html>` cascade reaches the body-level portal). This is the visual verification the unit test cannot do.

- [ ] **Step: Write the calibration-grid script** — create the scratchpad Playwright script that loads the paper board and SETTINGS, overlays a calibration grid, and screenshots the three views. Run with the user's own viewport (per global env: `width:1489, height:679, deviceScaleFactor:2.58`) so the operator compares against the user's real screen:
```js
import { chromium } from 'playwright'

const OUT = process.env.CALIB_OUT // scratchpad dir
const grid = `
  (() => {
    const o = document.createElement('div');
    o.id = '__calib_grid';
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;background-image:linear-gradient(rgba(255,0,0,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,0,0,.18) 1px,transparent 1px);background-size:24px 24px;';
    document.body.appendChild(o);
  })()
`

const browser = await chromium.launch()
const page = await browser.newContext({
  viewport: { width: 1489, height: 679 },
  deviceScaleFactor: 2.58,
}).then((c) => c.newPage())

await page.goto('http://localhost:3000/board')
await page.locator('[data-theme-id]').first().waitFor({ timeout: 15000 })
// switch to paper via the hover drawer
await page.locator('[data-testid="extension-settings-wrap"]').hover()
await page.locator('[data-theme-button="paper-atelier"]').click()
await page.waitForTimeout(600)

// board + grid
await page.evaluate(grid)
await page.screenshot({ path: `${OUT}/calib-board.png`, fullPage: false })
await page.evaluate(() => document.getElementById('__calib_grid')?.remove())

// settings drawer + grid
await page.locator('[data-testid="extension-settings-wrap"]').hover()
await page.waitForTimeout(300)
await page.evaluate(grid)
await page.screenshot({ path: `${OUT}/calib-settings.png` })
await page.evaluate(() => document.getElementById('__calib_grid')?.remove())

// scrollmeter region (ruler) — screenshot the meter track only
await page.locator('[data-meter-variant="ruler"]').screenshot({ path: `${OUT}/calib-scrollmeter.png` })

await browser.close()
```

- [ ] **Step: Run the dev server + calibration script** — start `pnpm dev` (background), then `CALIB_OUT="<scratchpad>" node <scratchpad>/paper-calibration.mjs`. Produces `calib-board.png`, `calib-settings.png`, `calib-scrollmeter.png`.

- [ ] **Step: Operator visual comparison (per-stage approval)** — Read each `calib-*.png` and the matching mockup side by side and present the diff to the user for approval before any token change:
  - `calib-board.png` ↔ `docs/private/theme-mockups/03-paper-atelier__board.png`
  - `calib-settings.png` ↔ `docs/private/theme-mockups/03-paper-atelier__settings.png`
  - `calib-scrollmeter.png` ↔ `docs/private/theme-mockups/03-paper-atelier__scrollmeter.png`
  Per `.claude/rules/ui-design.md`: state current → propose nudge → get approval → apply.

- [ ] **Step: Tune the exact tokens to match the mockup** — adjust ONLY these, calibration-driven, in this order (one stage, one screenshot, one approval each):
  - **Color hex** (`app/globals.css:434-494`): `--bg-dark` PARCHMENT, `--card-dark-alt` IVORY, `--text-primary` CHARCOAL ink, `--meter-ruler-marker #b9924a` brass, `--meter-ruler-numeral`, `--meter-ruler-rule`, `--lightbox-backdrop` scrim alpha, and decoration tints `--deco-washi-a/-b/-c`, `--deco-pin`, `--deco-clip`, `--deco-stamp-ink`, `--deco-photo-corner`.
  - **Texture intensity**: `--paper-fiber-url` tile opacity/contrast (regenerate the tile if too strong/weak) — keep it a small TILING image only (no canvas/backdrop-filter per the fill-rate invariant).
  - **Drift amplitude**: the `paper-drift` entry keyframe translate/rotate values in `lib/animation/tag-entry/themes/paper-drift.module.css` (keep CSS-var time values UNITLESS per the wave.module.css L7-12 invariant).
  - **Ruler spacing**: tick gap / numeral cadence in `components/board/scrollmeter/RulerTrack.module.css` so spacing matches `03-paper-atelier__scrollmeter.png`.

- [ ] **Step: Re-run the calibration script after each nudge** — re-screenshot and re-compare per stage until the operator approves each of board/settings/scrollmeter. Do NOT batch all nudges blind.

- [ ] **Step: Run the full type + unit gate** — `rtk tsc && rtk vitest run`. Expect tsc clean (strict, no `any`) and all unit/parity tests green. If `tests/lib/channel.test.ts` fails, it is the KNOWN-FLAKY suite — re-run it alone once: `rtk vitest run tests/lib/channel.test.ts` and confirm green before proceeding.

- [ ] **Step: Run the production build gate** — `rtk pnpm build` (NOT `rtk next build` — it doesn't static-export). Confirm `out/` is produced with no build errors.

- [ ] **Step: Confirm deploy auth** — `npx wrangler whoami`. Confirm it reports the authenticated account; if not, stop and tell the user to re-auth (do not guess credentials).

- [ ] **Step: PAUSE — 3 risks before deploy** — before the irreversible outward action, state the 3 risks: (1) deploying to the wrong branch makes a preview URL, not `allmarks.app` — `--branch=master` is mandatory; (2) a non-ASCII git body makes wrangler reject — use `--commit-message` with ASCII; (3) shipping a half-calibrated paper theme is user-visible — confirm all three calibration stages were approved. Get a go.

- [ ] **Step: Commit calibration + docs** — `rtk git add app/globals.css components/board/scrollmeter/RulerTrack.module.css lib/animation/tag-entry/themes/paper-drift.module.css components/board/decorations/PaperCardDecorations.module.css docs/CURRENT_GOAL.md docs/TODO_COMPLETED.md docs/private/dashboard.html && rtk git commit -m "feat(theme): final paper-atelier calibration to mockup + docs (Plan 2 complete)"` (Note: `docs/private/dashboard.html` is gitignored under `docs/private/*` except its README — it will be skipped by git silently; update the file regardless for the user's local dashboard, then commit only the tracked docs. Adjust the add list to `docs/CURRENT_GOAL.md docs/TODO_COMPLETED.md` plus the code paths if git reports the dashboard as ignored.)

- [ ] **Step: Deploy to production** — `rtk pnpm build` (re-run to ensure `out/` matches the just-committed tree), then:
```bash
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="ship plan-2 paper-atelier full fidelity"
```
(`--branch=master` mandatory → `allmarks.app`; ASCII `--commit-message` avoids the Japanese-body reject.)

- [ ] **Step: Tell the user to verify** — instruct: "hard-reload `https://allmarks.app`, open SETTINGS → THEMES, pick paper-atelier, confirm parchment board + ruler meter + decorations + pale lightbox scrim." Do NOT hand them the preview `*.allmarks.pages.dev` URL (their IndexedDB bookmarks are per-origin; the preview origin shows an empty board).

- [ ] **Step: Update handoff docs (final state)** — in `docs/CURRENT_GOAL.md` set the next goal to **Plan 3 (share theming)**; append the Plan-2 completion narrative to `docs/TODO_COMPLETED.md`; reflect all shipped Plan-2 items as ✅ in `docs/private/dashboard.html` and overwrite its "今のゴール" hero strip with Plan 3. (Confirm `docs/CURRENT_GOAL.md` + `docs/TODO_COMPLETED.md` are committed in the calibration commit above.)

- [ ] **Step: Verify the deploy is live (final gate)** — `rtk curl -sI https://allmarks.app | head -5` returns 200, and optionally re-run the e2e against prod if configured. Confirm Plan 2 is shipped and `allmarks.app` serves the new build before closing the session.

Relevant absolute paths verified during drafting: `c:\Users\masay\Desktop\マイコラージュ\components\board\ThemePicker.tsx` (grid div L26, badge L47, no-op onClick L41-43), `…\components\board\ThemePicker.test.tsx` (mock REG with `paid-x` fixture L15-19, existing locked test replaced), `…\components\board\Lightbox.module.css` (`.backdrop` already reads `var(--lightbox-backdrop)` at L22), `…\app\globals.css` (default `--lightbox-backdrop: rgba(0,0,0,0.5)` at L376; paper block L434-494, insert scrim before closing brace at L494), `…\tests\e2e\board-b0.spec.ts` (skipped theme test L138-142; drawer wrapper testid is `extension-settings-wrap` per `…\components\board\ExtensionEntry.tsx:159`), `…\messages\en.json` (`board.theme` object opens L36).

---
