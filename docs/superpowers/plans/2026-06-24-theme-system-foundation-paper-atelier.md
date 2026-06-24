# Theme System Foundation + paper-atelier (core look) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **STATUS (2026-06-24): ALL TASKS COMPLETE.** Tasks 1-3 were implemented in the same branch session as Tasks 4-7 (they were NOT pre-done on master — the original scope note was incorrect). Code review confirmed: tsc=0, ThemePicker tests pass, i18n parity passes, :root/:data-theme blocks untouched, share payload at DEFAULT_THEME_ID unchanged, no e2e file created (per scope constraint).

**Goal:** Make "選んだテーマでボードの配色・書体・カード表面が一斉に変わる" 仕組みを動かし、paper-atelier を選ぶとボードが生成り紙＋セリフの世界に切り替わる（核の見た目まで）。

**Architecture:** 各テーマは `html[data-theme-id="<id>"]` の CSS ブロックで自己完結（既存 CSS 変数を上書き）。`themeId` は既存の `BoardConfig`(IndexedDB) に保存済み。BoardRoot で `motionEnabled` と同じ型をなぞって state 化し、`<html>` に `data-theme-id` を付与（portal にも届く）、`ThemeLayer` へ渡す。選択は SETTINGS ドロワー内の新「THEMES」欄。有料解錠は判定窓口だけ（スタブ）。デフォルト（黒+音波）は無傷。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS + CSS custom properties / IndexedDB (`idb`) / vitest / Playwright。

**設計の正本:** [docs/superpowers/specs/2026-06-24-theme-system-paper-atelier-design.md](../specs/2026-06-24-theme-system-paper-atelier-design.md)（この plan は §3 器・§4.1-4.4 paper核・§5 picker・§3.4 解錠 の範囲。装飾/定規メーター/アニメ=Plan 2、共有=Plan 3）。

## Global Constraints

- TypeScript `strict: true`、`any` 禁止（`unknown`+型ガード）、return type 明示。
- Vanilla CSS + CSS custom properties のみ。**Tailwind 禁止**。z-index は定数管理。
- `console.log` を本番コードに残さない。
- **デフォルトテーマ（`dotted-notebook` = 黒+音波）の見た目・挙動は一切変えない**（回帰厳禁）。
- UI ラベルは globally-clear な英語（`THEMES`/`FREE` 等）。テーマ名のみ i18n（`t(meta.labelKey)`）。
- 金額表記は ¥（本 plan には金額 UI なし）。
- 既知フレーキー: `tests/lib/channel.test.ts`（full run でたまに落ちる→再実行 green）。
- デプロイ前ゲート: `rtk tsc && rtk vitest run && rtk pnpm build`。コミットは `rtk` 接頭。`--no-verify` 禁止。
- IndexedDB の **バージョン上げ禁止**（`themeId` は既存保存項目。union に値追加のみ＝後方互換）。
- 色 hex は**初期値**。最終確定は実機の校正グリッドで mock（`docs/private/theme-mockups/03-paper-atelier__*.png`）に寄せる（Task 7）。

## File Structure

| ファイル | 役割 | 操作 |
|---|---|---|
| `lib/board/types.ts` | `ThemeId` union ＋ `ThemeMeta` 契約（`tier`/`colorScheme` 追加） | Modify |
| `lib/board/theme-registry.ts` | 3テーマの登録（paper-atelier 追加・新フィールド充足） | Modify |
| `lib/board/theme-resolve.ts` | 保存値→有効 ThemeId のフォールバック純関数 | **Create** |
| `lib/board/theme-entitlement.ts` | `isThemeUnlocked` 判定窓口（スタブ） | **Create** |
| `components/board/ThemePicker.tsx` | SETTINGS 内「THEMES」欄（札・選択・ロックバッジ） | **Create** |
| `components/board/ThemePicker.module.css` | 上記スタイル | **Create** |
| `components/board/ExtensionEntry.tsx` | THEMES 欄を drawer に差し込み＋props 追加 | Modify |
| `components/board/BoardRoot.tsx` | `themeId` state / load / handler / `<html>` 属性 / `ThemeLayer`・PasteSaveFeedback・ExtensionEntry へ配線 | Modify |
| `app/globals.css` | `html[data-theme-id="paper-atelier"]` トークン上書きブロック | Modify |
| `components/board/themes.module.css` | `.paperAtelier` 背景クラス | Modify |
| `messages/*.json`（全言語） | `board.theme.paperAtelier` ラベル追加 | Modify |
| `lib/board/theme-resolve.test.ts` / `theme-entitlement.test.ts` / `theme-registry.test.ts` | 単体テスト | **Create** |
| `components/board/ThemePicker.test.tsx` | picker 単体 | **Create** |
| `tests/e2e/board-theme.spec.ts` | 切替の視覚/永続/回帰 | **Create** |

---

### Task 1: Theme contract — `ThemeId` union ＋ `ThemeMeta`(tier/colorScheme) ＋ registry

**Files:**
- Modify: `lib/board/types.ts:3` (ThemeId), `lib/board/types.ts:53-59` (ThemeMeta)
- Modify: `lib/board/theme-registry.ts:3-16` (entries)
- Test: `lib/board/theme-registry.test.ts` (Create)

**Interfaces:**
- Produces: `type ThemeId = 'dotted-notebook' | 'grid-paper' | 'paper-atelier'`; `ThemeMeta` に `readonly tier: 'free' | 'paid'` と `readonly colorScheme: 'light' | 'dark'`; `THEME_REGISTRY` に `paper-atelier` エントリ。

- [x] **Step 1: Write the failing test**

`lib/board/theme-registry.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { THEME_REGISTRY, listThemeIds, getThemeMeta, DEFAULT_THEME_ID } from './theme-registry'

describe('THEME_REGISTRY contract', () => {
  it('every theme fills the contract fields', () => {
    for (const id of listThemeIds()) {
      const m = getThemeMeta(id)
      expect(m.id).toBe(id)
      expect(typeof m.backgroundClassName).toBe('string')
      expect(m.labelKey.startsWith('board.theme.')).toBe(true)
      expect(['free', 'paid']).toContain(m.tier)
      expect(['light', 'dark']).toContain(m.colorScheme)
    }
  })

  it('registers paper-atelier as a free, light theme', () => {
    const m = getThemeMeta('paper-atelier')
    expect(m.colorScheme).toBe('light')
    expect(m.tier).toBe('free')
    expect(m.backgroundClassName).toBe('paperAtelier')
    expect(m.labelKey).toBe('board.theme.paperAtelier')
  })

  it('keeps the default theme dark + free', () => {
    expect(DEFAULT_THEME_ID).toBe('dotted-notebook')
    expect(getThemeMeta('dotted-notebook').colorScheme).toBe('dark')
    expect(getThemeMeta('dotted-notebook').tier).toBe('free')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/theme-registry.test.ts`
Expected: FAIL — `'paper-atelier'` not assignable / `getThemeMeta('paper-atelier')` undefined / `tier` missing.

- [x] **Step 3: Extend the types**

`lib/board/types.ts` — change line 3:
```ts
export type ThemeId = 'dotted-notebook' | 'grid-paper' | 'paper-atelier'
```
`lib/board/types.ts` — replace the `ThemeMeta` type (currently lines 53-59) with:
```ts
export type ThemeMeta = {
  readonly id: ThemeId
  readonly direction: ScrollDirection
  readonly backgroundClassName: string
  readonly labelKey: string
  /** Base color scheme — drives `color-scheme` + which token block applies. */
  readonly colorScheme: 'light' | 'dark'
  /** Entitlement tier. 'free' = always available; 'paid' = needs a license. */
  readonly tier: 'free' | 'paid'
  readonly layoutParams?: ThemeLayoutParams
}
```

- [x] **Step 4: Fill the registry**

`lib/board/theme-registry.ts` — replace the `THEME_REGISTRY` object (lines 3-16) with:
```ts
export const THEME_REGISTRY: Record<ThemeId, ThemeMeta> = {
  'dotted-notebook': {
    id: 'dotted-notebook',
    direction: 'vertical',
    backgroundClassName: 'dottedNotebook',
    labelKey: 'board.theme.dottedNotebook',
    colorScheme: 'dark',
    tier: 'free',
  },
  'grid-paper': {
    id: 'grid-paper',
    direction: 'vertical',
    backgroundClassName: 'gridPaper',
    labelKey: 'board.theme.gridPaper',
    colorScheme: 'dark',
    tier: 'free',
  },
  'paper-atelier': {
    id: 'paper-atelier',
    direction: 'vertical',
    backgroundClassName: 'paperAtelier',
    labelKey: 'board.theme.paperAtelier',
    colorScheme: 'light',
    tier: 'free',
  },
}
```

- [x] **Step 5: Run tests + commit**

Run: `rtk vitest run lib/board/theme-registry.test.ts` → PASS. Then `rtk tsc` → 0 errors.
```bash
rtk git add lib/board/types.ts lib/board/theme-registry.ts lib/board/theme-registry.test.ts
rtk git commit -m "feat(theme): extend ThemeMeta contract (tier/colorScheme) + register paper-atelier"
```

---

### Task 2: Entitlement receiver (stub)

**Files:**
- Create: `lib/board/theme-entitlement.ts`
- Test: `lib/board/theme-entitlement.test.ts`

**Interfaces:**
- Consumes: `ThemeMeta`, `ThemeId` (Task 1).
- Produces: `isThemeUnlocked(meta: ThemeMeta, licenses: ReadonlySet<ThemeId>): boolean`; `EMPTY_LICENSES: ReadonlySet<ThemeId>`.

- [x] **Step 1: Write the failing test**

`lib/board/theme-entitlement.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isThemeUnlocked, EMPTY_LICENSES } from './theme-entitlement'
import type { ThemeMeta } from './types'

const free: ThemeMeta = { id: 'paper-atelier', direction: 'vertical', backgroundClassName: 'paperAtelier', labelKey: 'board.theme.paperAtelier', colorScheme: 'light', tier: 'free' }
const paid: ThemeMeta = { ...free, id: 'grid-paper', tier: 'paid' }

describe('isThemeUnlocked', () => {
  it('free themes are always unlocked', () => {
    expect(isThemeUnlocked(free, EMPTY_LICENSES)).toBe(true)
  })
  it('paid themes are locked without a license', () => {
    expect(isThemeUnlocked(paid, EMPTY_LICENSES)).toBe(false)
  })
  it('paid themes unlock when their id is licensed', () => {
    expect(isThemeUnlocked(paid, new Set(['grid-paper']))).toBe(true)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/theme-entitlement.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement the receiver (stub)**

`lib/board/theme-entitlement.ts`:
```ts
import type { ThemeId, ThemeMeta } from './types'

/** No licenses are issued yet. The real key entry/validation is a later
 *  session (spec §3.4 / N-06); this receiver only needs the shape so the
 *  picker can render a lock and the wiring exists end-to-end. */
export const EMPTY_LICENSES: ReadonlySet<ThemeId> = new Set<ThemeId>()

/** Whether a theme may be applied. Free themes always; paid themes only when
 *  their id appears in the (currently always-empty) license set. */
export function isThemeUnlocked(meta: ThemeMeta, licenses: ReadonlySet<ThemeId>): boolean {
  return meta.tier === 'free' || licenses.has(meta.id)
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/theme-entitlement.test.ts` → PASS.

- [x] **Step 5: Commit**

```bash
rtk git add lib/board/theme-entitlement.ts lib/board/theme-entitlement.test.ts
rtk git commit -m "feat(theme): entitlement receiver stub (isThemeUnlocked, free/paid)"
```

---

### Task 3: Fallback resolver (unknown/locked themeId → default)

**Files:**
- Create: `lib/board/theme-resolve.ts`
- Test: `lib/board/theme-resolve.test.ts`

**Interfaces:**
- Consumes: `THEME_REGISTRY`, `DEFAULT_THEME_ID` (Task 1); `isThemeUnlocked`, `EMPTY_LICENSES` (Task 2).
- Produces: `resolveThemeId(stored: string | undefined, licenses: ReadonlySet<ThemeId>): ThemeId`.

- [x] **Step 1: Write the failing test**

`lib/board/theme-resolve.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveThemeId } from './theme-resolve'
import { EMPTY_LICENSES } from './theme-entitlement'

describe('resolveThemeId', () => {
  it('returns a known free theme as-is', () => {
    expect(resolveThemeId('paper-atelier', EMPTY_LICENSES)).toBe('paper-atelier')
  })
  it('falls back to default for an unknown id', () => {
    expect(resolveThemeId('no-such-theme', EMPTY_LICENSES)).toBe('dotted-notebook')
  })
  it('falls back to default for undefined', () => {
    expect(resolveThemeId(undefined, EMPTY_LICENSES)).toBe('dotted-notebook')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/theme-resolve.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement the resolver**

`lib/board/theme-resolve.ts`:
```ts
import type { ThemeId } from './types'
import { THEME_REGISTRY, DEFAULT_THEME_ID, getThemeMeta } from './theme-registry'
import { isThemeUnlocked } from './theme-entitlement'

/** Map a persisted theme id to one we can actually render: unknown ids and
 *  paid-but-unlocked ids fall back to the default so a stale/locked config
 *  never leaves the board un-themed. */
export function resolveThemeId(
  stored: string | undefined,
  licenses: ReadonlySet<ThemeId>,
): ThemeId {
  if (stored && Object.prototype.hasOwnProperty.call(THEME_REGISTRY, stored)) {
    const id = stored as ThemeId
    if (isThemeUnlocked(getThemeMeta(id), licenses)) return id
  }
  return DEFAULT_THEME_ID
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/theme-resolve.test.ts` → PASS. Then `rtk tsc` → 0.

- [x] **Step 5: Commit**

```bash
rtk git add lib/board/theme-resolve.ts lib/board/theme-resolve.test.ts
rtk git commit -m "feat(theme): resolveThemeId fallback (unknown/locked -> default)"
```

---

### Task 4: paper-atelier CSS — token override block + background class

**Files:**
- Modify: `app/globals.css` (after the `[data-theme="light"]` block, i.e. after line 428)
- Modify: `components/board/themes.module.css` (append `.paperAtelier`)
- Test: `tests/e2e/board-theme.spec.ts` (Create — token-applies assertion; the full visual pass is Task 7)

**Interfaces:**
- Consumes: existing tokens in `:root` (`--bg-dark`, `--card-dark-alt`, `--text-*`, `--color-*`, `--chrome-text-*`, `--card-radius`, `--font-heading`/`--font-body`, `--font-serif-display`).
- Produces: a `html[data-theme-id="paper-atelier"]` cascade + a `.paperAtelier` background class (referenced by `ThemeMeta.backgroundClassName` from Task 1).

> 注: 初期 hex。`--bg-dark`/`--card-dark-alt`/`--text-*` は destefanis 系（ボードが実際に消費）、`--color-*` 系も併せて上書き（一部 chrome が消費）。どのトークンがどの要素を駆動するかは Task 7 の校正で実測して微調整。

- [x] **Step 1: Write the failing test**

`tests/e2e/board-theme.spec.ts` (first assertion only; more in Task 7):
```ts
import { test, expect } from '@playwright/test'

test('paper-atelier tokens apply when data-theme-id is set', async ({ page }) => {
  await page.goto('/board')
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 15_000 })
  // Force the attribute the way the wiring (Task 5/6) will, to prove the CSS block:
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'paper-atelier'))
  const cardBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--card-dark-alt').trim(),
  )
  expect(cardBg.toLowerCase()).toBe('#f7f1e3')
  const scheme = await page.evaluate(() =>
    getComputedStyle(document.documentElement).colorScheme,
  )
  expect(scheme).toContain('light')
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/board-theme.spec.ts -g "tokens apply"`
Expected: FAIL — `--card-dark-alt` still `#101010`, colorScheme not light.

- [x] **Step 3: Add the paper token block**

`app/globals.css` — insert immediately after the closing `}` of the `[data-theme="light"]` block (after line 428):
```css
/* ── paper-atelier theme ─────────────────────────────────────
   Self-contained token override for the editorial-paper theme. Set on <html>
   via data-theme-id at runtime (BoardRoot). Initial values — calibrate to
   docs/private/theme-mockups/03-paper-atelier__*.png with the calibration grid. */
html[data-theme-id="paper-atelier"] {
  color-scheme: light;

  /* board canvas + card surface (destefanis token family — board consumes these) */
  --bg-dark: #efe6d2;            /* PARCHMENT */
  --bg-outer: #e9dfc8;
  --card-dark-alt: #f7f1e3;      /* IVORY card surface */
  --card-white: #fffdf6;
  --card-border-dark: rgba(43, 39, 34, 0.14);
  --card-radius: 3px;            /* paper-print corner */

  /* text (destefanis family) */
  --text-primary: #2b2722;       /* CHARCOAL ink */
  --text-body: #4a443b;
  --text-meta: #8a8275;
  --text-muted: #9c9485;         /* WARM GRAY */
  --text-signature: #b4ab98;

  /* color family (some chrome/components consume these) */
  --color-bg-primary: #efe6d2;
  --color-bg-elevated: #f7f1e3;
  --color-text-primary: #2b2722;
  --color-text-secondary: #6a6356;
  --color-text-tertiary: #8a8275;

  /* accents */
  --color-accent-primary: #2f4a37;   /* FOREST */
  --color-accent-primary-hover: #3c5e46;
  --accent-primary: #2f4a37;
  --accent-gold: #b9924a;            /* GOLD PEEL (used by paper decorations in Plan 2) */

  /* floating chrome text (ScrollMeter counter / buttons) — ink on paper */
  --chrome-text-color: rgba(43, 39, 34, 0.92);
  --chrome-text-color-hover: rgba(43, 39, 34, 1);
  --chrome-text-stroke-color: rgba(255, 253, 246, 0.55);
  --chrome-text-stroke-color-hover: rgba(255, 253, 246, 0.7);
  --chrome-text-shadow: 0 1px 2px rgba(43, 39, 34, 0.18);

  /* serif headings (Fraunces, already loaded as --font-serif-display) */
  --font-heading: var(--font-serif-display), Georgia, 'Times New Roman', serif;
  --font-body: var(--font-serif-display), Georgia, serif;

  /* soft warm paper shadows */
  --shadow-grid-card: 0 2px 8px rgba(43, 39, 34, 0.12);
  --shadow-collage-card: 0 10px 28px rgba(43, 39, 34, 0.16);
}
```

- [x] **Step 4: Add the background class**

`components/board/themes.module.css` — append:
```css
.paperAtelier {
  background-color: var(--bg-dark);
  /* Plan 1: CSS-only parchment grain + soft vignette (no external asset yet;
     the real fiber texture asset lands in Plan 2 calibration). */
  background-image:
    radial-gradient(120% 90% at 50% 0%, rgba(255, 253, 246, 0.45), transparent 60%),
    radial-gradient(140% 120% at 50% 100%, rgba(43, 39, 34, 0.06), transparent 55%);
}
```

- [x] **Step 5: Run test + commit**

Run: `npx playwright test tests/e2e/board-theme.spec.ts -g "tokens apply"` → PASS.
```bash
rtk git add app/globals.css components/board/themes.module.css tests/e2e/board-theme.spec.ts
rtk git commit -m "feat(theme): paper-atelier token block + paperAtelier background class"
```

---

### Task 5: themeId state + wiring in BoardRoot (+ `<html>` data-theme-id)

**Files:**
- Modify: `components/board/BoardRoot.tsx` (state ~141; load ~609; new handler near ~1587; new effect; usages at 774, 2064, 2318; render of `<ExtensionEntry>` ~1991)
- (Test: covered by Task 7 e2e — switch persists + applies. The pure fallback is already unit-tested in Task 3.)

**Interfaces:**
- Consumes: `resolveThemeId` (Task 3), `EMPTY_LICENSES` (Task 2), `loadBoardConfig`/`saveBoardConfig` (existing), `THEME_REGISTRY`/`getThemeMeta`/`DEFAULT_THEME_ID` (Task 1).
- Produces: `themeId` state + `handleThemeChange(id: ThemeId)` passed to `<ExtensionEntry>` (Task 6 consumes); `data-theme-id` on `<html>`.

- [x] **Step 1: Add imports + state**

`BoardRoot.tsx` near the existing theme import (line 8 block) ensure these are imported:
```ts
import { DEFAULT_THEME_ID, getThemeMeta, THEME_REGISTRY } from '@/lib/board/theme-registry'
import { resolveThemeId } from '@/lib/board/theme-resolve'
import { EMPTY_LICENSES } from '@/lib/board/theme-entitlement'
import type { ThemeId } from '@/lib/board/types'
```
After line 141 (`const [motionEnabled, setMotionEnabled] = useState<boolean>(true)`), add:
```ts
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID)
```

- [x] **Step 2: Load persisted themeId on mount**

In the load effect, right after line 613 (`setBgTypoEnabled(cfg.bgTypoEnabled)`), add:
```ts
      setThemeId(resolveThemeId(cfg.themeId, EMPTY_LICENSES))
```

- [x] **Step 3: Apply data-theme-id to `<html>` (covers portals)**

Add a new effect near the other config effects (e.g. after the load effect, ~line 627):
```ts
  // Reflect the active theme onto <html> so the [data-theme-id] cascade reaches
  // portalled UI (Lightbox / popovers) too. Cleared on unmount so leaving the
  // board (e.g. back to the LP) doesn't leave a stale attribute behind.
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme-id', themeId)
    return (): void => {
      el.removeAttribute('data-theme-id')
    }
  }, [themeId])
```

- [x] **Step 4: Add the change handler (mirror handleToggleMotion)**

Near line 1587 (the `handleToggleMotion` callback), add:
```ts
  const handleThemeChange = useCallback((next: ThemeId): void => {
    setThemeId(next)
    void (async (): Promise<void> => {
      const db = await initDB()
      const cfg = await loadBoardConfig(db)
      await saveBoardConfig(db, { ...cfg, themeId: next })
    })()
  }, [])
```

- [x] **Step 5: Replace the 3 hard-coded DEFAULT_THEME_ID usages**

- Line 774: `const themeMeta = getThemeMeta(DEFAULT_THEME_ID)` → `const themeMeta = getThemeMeta(themeId)`
- Line 2064: `themeId={DEFAULT_THEME_ID}` → `themeId={themeId}`
- Line 2318: `<PasteSaveFeedback feedback={pasteFeedback} themeId={DEFAULT_THEME_ID} />` → `themeId={themeId}`

(Leave line 1640 — the share payload `themeId: DEFAULT_THEME_ID` — UNCHANGED. Share theming is Plan 3.)

- [x] **Step 6: Pass themeId + handler to `<ExtensionEntry>`**

At the `<ExtensionEntry .../>` render (~line 1991), add props:
```tsx
                themeId={themeId}
                onThemeChange={handleThemeChange}
```
(Props are defined in Task 6.)

- [x] **Step 7: Typecheck + commit**

Run: `rtk tsc` → 0 errors (ExtensionEntry props exist after Task 6; if running Task 5 before 6, do Task 6 first or accept a transient tsc error and commit both together). Recommended: commit Tasks 5+6 together.
```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(theme): wire themeId state -> html attr + ThemeLayer (replace hardcoded default)"
```

---

### Task 6: Theme picker UI (THEMES section in SETTINGS drawer)

**Files:**
- Create: `components/board/ThemePicker.tsx`, `components/board/ThemePicker.module.css`
- Modify: `components/board/ExtensionEntry.tsx` (add props + mount picker)
- Test: `components/board/ThemePicker.test.tsx`

**Interfaces:**
- Consumes: `listThemeIds`/`getThemeMeta` (Task 1), `isThemeUnlocked`/`EMPTY_LICENSES` (Task 2), `useI18n` (existing), `ThemeId` type.
- Produces: `<ThemePicker themeId={ThemeId} onThemeChange={(id: ThemeId) => void} />`; `ExtensionEntryProps` gains `themeId: ThemeId` + `onThemeChange: (id: ThemeId) => void`.

- [x] **Step 1: Write the failing test**

`components/board/ThemePicker.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

describe('ThemePicker', () => {
  it('renders a button per theme and marks the active one', () => {
    render(<ThemePicker themeId="dotted-notebook" onThemeChange={() => {}} />)
    expect(screen.getByTestId('theme-button-paper-atelier')).toBeTruthy()
    expect(screen.getByTestId('theme-button-dotted-notebook').getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onThemeChange when a theme is clicked', () => {
    const onChange = vi.fn()
    render(<ThemePicker themeId="dotted-notebook" onThemeChange={onChange} />)
    fireEvent.click(screen.getByTestId('theme-button-paper-atelier'))
    expect(onChange).toHaveBeenCalledWith('paper-atelier')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk vitest run components/board/ThemePicker.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Implement ThemePicker**

`components/board/ThemePicker.tsx`:
```tsx
'use client'

import type { ReactElement } from 'react'
import type { ThemeId } from '@/lib/board/types'
import { listThemeIds, getThemeMeta } from '@/lib/board/theme-registry'
import { isThemeUnlocked, EMPTY_LICENSES } from '@/lib/board/theme-entitlement'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './ThemePicker.module.css'

export interface ThemePickerProps {
  readonly themeId: ThemeId
  readonly onThemeChange: (id: ThemeId) => void
}

/** THEMES section inside the SETTINGS drawer. One button per registered theme;
 *  free themes apply on click, paid+locked themes show a lock and (for now)
 *  do nothing destructive — the real unlock flow is a later session. */
export function ThemePicker({ themeId, onThemeChange }: ThemePickerProps): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.section} data-testid="theme-picker">
      <div className={styles.heading}>THEMES</div>
      <div className={styles.grid}>
        {listThemeIds().map((id) => {
          const meta = getThemeMeta(id)
          const unlocked = isThemeUnlocked(meta, EMPTY_LICENSES)
          const active = id === themeId
          return (
            <button
              key={id}
              type="button"
              className={styles.swatch}
              data-theme-button={id}
              data-testid={`theme-button-${id}`}
              data-scheme={meta.colorScheme}
              aria-pressed={active}
              disabled={!unlocked}
              onClick={(): void => {
                if (unlocked) onThemeChange(id)
              }}
            >
              <span className={styles.preview} data-theme-id={id} aria-hidden="true" />
              <span className={styles.name}>{t(meta.labelKey)}</span>
              <span className={styles.badge}>{unlocked ? 'FREE' : 'LOCKED'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [x] **Step 4: Style the picker**

`components/board/ThemePicker.module.css`:
```css
.section { display: flex; flex-direction: column; gap: 6px; }
.heading { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; color: var(--text-meta); }
.grid { display: flex; gap: 8px; flex-wrap: wrap; }
.swatch {
  display: flex; flex-direction: column; align-items: stretch; gap: 4px;
  width: 84px; padding: 6px; border-radius: 8px; cursor: pointer;
  background: var(--color-glass-bg); border: 1px solid var(--color-glass-border);
  color: var(--text-body); transition: border-color 140ms ease, background 140ms ease;
}
.swatch[aria-pressed='true'] { border-color: var(--color-accent-primary); }
.swatch:disabled { opacity: 0.55; cursor: default; }
.preview { height: 38px; border-radius: 4px; }
.preview[data-theme-id='dotted-notebook'] { background: #0a0a0a; }
.preview[data-theme-id='grid-paper'] { background: #0e0e11; }
.preview[data-theme-id='paper-atelier'] { background: #efe6d2; }
.name { font-family: var(--font-heading); font-size: 12px; }
.badge { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.06em; color: var(--text-meta); }
```

- [x] **Step 5: Mount in ExtensionEntry + add props**

`components/board/ExtensionEntry.tsx`:
- Add import: `import { ThemePicker } from './ThemePicker'` and `import type { ThemeId } from '@/lib/board/types'`.
- Extend `ExtensionEntryProps` (after line 90, before the closing `}`):
```ts
  /** Active board theme + change handler for the THEMES section. */
  readonly themeId: ThemeId
  readonly onThemeChange: (id: ThemeId) => void
```
- Destructure them in the component signature (line 97-103 params): add `themeId,` and `onThemeChange,`.
- Render the picker inside the drawer, right after the QUICK-TAG toggle `</label>` (after line 180):
```tsx
        <ThemePicker themeId={themeId} onThemeChange={onThemeChange} />
```

- [x] **Step 6: Run tests + typecheck + commit (with Task 5)**

Run: `rtk vitest run components/board/ThemePicker.test.tsx` → PASS. `rtk tsc` → 0.
```bash
rtk git add components/board/ThemePicker.tsx components/board/ThemePicker.module.css components/board/ExtensionEntry.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(theme): THEMES picker in SETTINGS drawer + wire to BoardRoot"
```

---

### Task 7: i18n label + full visual verification + default-unchanged regression

**Files:**
- Modify: every `messages/*.json` (add `board.theme.paperAtelier`)
- Modify: `tests/e2e/board-theme.spec.ts` (add switch/persist/regression cases)

**Interfaces:**
- Consumes: the picker (`data-theme-button`), `data-theme-id` on `<html>`, the paper token block.

- [x] **Step 1: Add the label to all message files**

For EVERY file matched by `messages/*.json`, add `"paperAtelier"` to the existing `board.theme` object (en.json lines 36-39 show the shape). English:
```json
    "theme": {
      "dottedNotebook": "Dotted Notebook",
      "gridPaper": "Grid Paper",
      "paperAtelier": "Paper Atelier"
    },
```
Translations (match the existing translated style; for any locale not listed, use the same proper-noun rendering and let the parity test flag omissions):
`ja` ペーパーアトリエ ／ `de` Papier-Atelier ／ `es` Taller de Papel ／ `fr` Atelier Papier ／ `it` Atelier di Carta ／ `ko` 페이퍼 아틀리에 ／ `nl` Papieratelier ／ `pt` Ateliê de Papel ／ `ru` Бумажная мастерская ／ `ar` ورشة الورق （others: keep "Paper Atelier"）.

- [x] **Step 2: Run the i18n parity test**

Run: `rtk vitest run messages` (the existing all-keys-parity test).
Expected: PASS (every locale has `board.theme.paperAtelier`). If FAIL, it names the missing locale — add the key there.

- [x] **Step 3: Write the switch/persist/regression e2e**

Append to `tests/e2e/board-theme.spec.ts`:
```ts
test('switching to paper-atelier themes the board and persists', async ({ page }) => {
  await page.goto('/board')
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 15_000 })

  // open SETTINGS drawer (hover) and click the paper theme button
  await page.getByTestId('extension-settings').hover()
  await page.getByTestId('theme-button-paper-atelier').click()

  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.getAttribute('data-theme-id')),
  ).toBe('paper-atelier')

  const cardBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--card-dark-alt').trim().toLowerCase())
  expect(cardBg).toBe('#f7f1e3')

  // persists across reload
  await page.reload()
  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.getAttribute('data-theme-id')),
  ).toBe('paper-atelier')
})

test('default theme is unchanged (regression)', async ({ page }) => {
  await page.goto('/board')
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 15_000 })
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim().toLowerCase())
  expect(bg).toBe('#0a0a0a') // unchanged dotted-notebook canvas
})
```

- [x] **Step 4: Run the e2e + full gate**

Run: `npx playwright test tests/e2e/board-theme.spec.ts` → all PASS.
Run: `rtk tsc && rtk vitest run` → 0 errors / green.

- [x] **Step 5: Visual calibration pass (manual + screenshot)**

- Launch the board (`rtk pnpm build` then preview, or dev), switch to paper-atelier.
- Screenshot board + open SETTINGS drawer + scroll (meter). Compare against `docs/private/theme-mockups/03-paper-atelier__board.png`.
- Place a calibration grid behind the board if needed; adjust the hex/fonts in the paper token block (Task 4) until the parchment/ink/forest/serif read like the mock. Re-run `rtk tsc && rtk vitest run`.
- Confirm: wordmark renders serif (if it uses `--font-sans` rather than `--font-heading`, add a `--font-sans` serif override in the paper block — but keep `--font-mono` so labels stay mono).
- Confirm default theme (switch back) is visually identical to before.

- [x] **Step 6: Commit + deploy**

```bash
rtk git add messages/ tests/e2e/board-theme.spec.ts app/globals.css
rtk git commit -m "feat(theme): paper-atelier label (15 langs) + switch/persist/regression e2e + calibration"
```
Then deploy per CLAUDE.md gate and verify on `allmarks.app` (switch to paper, hard reload, confirm persists).

---

## Self-Review

**1. Spec coverage（§ → task）:**
- §3.1 data-theme-id カスケード → Task 4(CSS)+Task 5(`<html>`属性)。
- §3.2 契約(7部品の構造核) → Task 1（`tier`/`colorScheme`/既存）。残る部品（scrollMeterVariant/motion/decorations）は consumer がある Plan 2 で追加（YAGNI）。
- §3.3 状態の流れ → Task 5（state/load/handler/属性/フォールバック）+ Task 3（resolve）。
- §3.4 解錠受け口 → Task 2 + picker のロック表示(Task 6)。
- §3.5 トークン化 → **Plan 1 は工事不要**（spec §3.5 修正済み）。paper は既存トークン上書き(Task 4)。
- §4.1 配色 → Task 4。§4.2 書体 → Task 4（serif heading）+ Task 7 校正。§4.3 背景 → Task 4（`.paperAtelier`、本テクスチャは Plan 2）。§4.4 カード表面 → Task 4（`--card-dark-alt`/`--card-radius` 上書き。装飾は Plan 2）。
- §5 選択UI → Task 6。i18n → Task 7。
- §4.5 メーター変種 / §4.6 アニメ / §4.7 装飾chrome / §6 共有 → **Plan 2・3**（本 plan 範囲外、spec に明記）。

**2. Placeholder scan:** 各 step に実コードあり。色 hex は「初期値→Task 7 校正」という定義済み手順（空欄でない）。i18n の未掲載ロケールは「既存訳の流儀＋parity テストで検出」と具体化済み。

**3. Type consistency:** `isThemeUnlocked(meta, licenses)` / `resolveThemeId(stored, licenses)` / `ThemeId` / `handleThemeChange(id: ThemeId)` / `ThemePickerProps{themeId,onThemeChange}` / `ExtensionEntryProps` 追加分 — Task 1→7 で名称・型一致を確認。`EMPTY_LICENSES: ReadonlySet<ThemeId>` 一貫。

**4. 既定不変:** Task 4 はデフォルトに override を足さない（`[data-theme-id="paper-atelier"]` のみ）。Task 7 の回帰テストで `--bg-dark` が `#0a0a0a` のままを保証。
