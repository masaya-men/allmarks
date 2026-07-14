# Flat chrome 可読性の修復 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フラットテーマで見えなくなっているメニュー（SETTINGS/THEME/CUSTOMIZE/絞り込み/言語/タグ/トースト）の文字と面を、テーマで自動反転する仕組みで一斉に可読化する。

**Architecture:** 新トークン `--chrome-ink-rgb`（暗テーマ=255,255,255／flat=20,19,15）を導入し、chrome 中身の `rgba(255,255,255,A)` を `rgba(var(--chrome-ink-rgb),A)` に置換（=暗テーマは計算結果同一＝バイト同一・flat は各 alpha を保って暗インク反転）。ハードコード暗面パネル（Pattern B）は flat scoped の append-only で白面に反転。

**Tech Stack:** Vanilla CSS Modules + CSS custom properties、Next.js、Playwright e2e、vitest。

## Global Constraints

- **音（dotted-notebook）・紙（paper-atelier）・Grid（grid-paper）はバイト同一**（`--chrome-ink-rgb` :root=`255, 255, 255`＝全 ink 変換が計算結果同値／Pattern B 面反転は `:global(html[data-theme-id="flat"])` scoped の append-only／暗テーマの直書きは無改変）。
- **`--no-verify` 禁止**。commit は `rtk` 前置。commit body は英語（[[reference_wrangler_commit_message]]）。
- **変換しない色**（意図的）: 緑 `#28f100`/`#1c9a00`／glitch `#ff9d3f`・`#50c8ff`／`.cta` の `#1a0e05`／プレビュー用暗チップ `ThemeCustomizeSection .patternSwatch`（`#0e0e11`）・`ThemePicker .preview[data-theme-id]`／既存トークン `--chrome-text-stroke-color`。
- **CSS Modules のスコープ**: `html[data-theme-id="flat"]` に届かせるには `:global(html[data-theme-id="flat"]) .xxx { … }`（既存 TUNE 皮・FaderColumn.module.css 等の型を踏襲）。
- **e2e でのテーマ切替**: `await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'flat'))`（`chrome-skin-tokens.spec.ts` の paper-atelier テストと同型＝CSS カスケードは属性駆動）。
- flat の実値（参照）: `--chrome-panel-surface: rgba(255,255,255,0.97)`・`--chrome-btn-color: rgba(20,19,15,0.9)`（globals.css `html[data-theme-id="flat"]` ブロック内）。flat の暗インク三値 = `20, 19, 15`。

---

### Task 1: 基盤トークン `--chrome-ink-rgb` ＋ SETTINGS ドロワー（ChromeDrawer + ExtensionEntry）

**Files:**
- Modify: `app/globals.css`（`:root` chrome 既定 `:362-370`／`html[data-theme-id="dotted-notebook"]` `:653-663`／`html[data-theme-id="flat"]` `:704-712` 付近）
- Modify: `components/board/ChromeDrawer.module.css`
- Modify: `components/board/ExtensionEntry.module.css`
- Test: `tests/e2e/flat-chrome-legibility.spec.ts`（新規）

**Interfaces:**
- Produces: CSS custom property `--chrome-ink-rgb`（値はカンマ区切り三値。`:root`/dark=`255, 255, 255`、flat=`20, 19, 15`）。後続 Task はこれを `rgba(var(--chrome-ink-rgb), <alpha>)` の形で消費する。

- [ ] **Step 1: 失敗する e2e を書く**（新規ファイル）

`tests/e2e/flat-chrome-legibility.spec.ts`:
```ts
import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors } from './helpers/seed-db'

async function prepFlatBoard(page: Page): Promise<void> {
  await seedDb(page, [...firstRunSuppressors()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'flat'))
}

// `rgba(var(--chrome-ink-rgb), A)` は flat で `rgba(20, 19, 15, A)` に解決される。
// Chromium は computed color を `rgb(20, 19, 15)` / `rgba(20, 19, 15, A)` の形で返す。
function isDarkInk(color: string): boolean {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return false
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return r < 90 && g < 90 && b < 90
}

test('flat: SETTINGS drawer panel is light and its content ink is dark (legible)', async ({ page }) => {
  await prepFlatBoard(page)
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
  const drawer = page.getByTestId('extension-settings-drawer')
  await drawer.waitFor({ state: 'visible', timeout: 10_000 })

  // panel surface = light (flat --chrome-panel-surface)
  const panelBg = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(panelBg).toBe('rgba(255, 255, 255, 0.97)')

  // a .panelCta button (LAYOUT reset) resolves to dark ink, not white
  const resetBtn = page.getByTestId('layout-reset-sizes')
  await resetBtn.waitFor({ state: 'visible', timeout: 10_000 })
  const ctaColor = await resetBtn.evaluate((el) => getComputedStyle(el).color)
  expect(isDarkInk(ctaColor)).toBe(true)
})
```

- [ ] **Step 2: 実行して落ちるのを確認**

Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "SETTINGS drawer"`
Expected: FAIL（`ctaColor` は現状 `rgba(255,255,255,0.82)`＝`isDarkInk` false）。

- [ ] **Step 3: globals.css に `--chrome-ink-rgb` を追加**

`:root` の chrome 既定ブロック（`--chrome-hover-fx: glitch;` の直後、`:370` 付近）に追記:
```css
  --chrome-ink-rgb: 255, 255, 255;   /* chrome 中身インクの基色（暗テーマ=白）。flat が html[data-theme-id="flat"] で 20,19,15 に反転 */
```
`html[data-theme-id="dotted-notebook"]` ブロック（`--chrome-hover-fx: glitch;` の直後、`:662` 付近）にも同値を追記（:root と対で明示・音の所番地）:
```css
  --chrome-ink-rgb: 255, 255, 255;
```
`html[data-theme-id="flat"]` ブロックの chrome SKIN 節（`--chrome-hover-fx: none;` の直後、`:712` 付近）に追記:
```css
  --chrome-ink-rgb: 20, 19, 15;
```

- [ ] **Step 4: ChromeDrawer.module.css を変換**

`components/board/ChromeDrawer.module.css` で以下を置換（`.panel` の `--chrome-btn-color`/`--chrome-panel-*` は**触らない**＝既に正しく反転）:
- `.header`（`:34`）: `border-bottom: 1px solid rgba(255, 255, 255, 0.08);` → `border-bottom: 1px solid rgba(var(--chrome-ink-rgb), 0.08);`
- `.title`（`:41`）: `color: rgba(255, 255, 255, 0.9);` → `color: rgba(var(--chrome-ink-rgb), 0.9);`
- `.closeBtn`（`:52`）: `color: rgba(255, 255, 255, 0.55);` → `color: rgba(var(--chrome-ink-rgb), 0.55);`
- `.closeBtn:hover`（`:55`）: `color: rgba(255, 255, 255, 0.95);` → `rgba(var(--chrome-ink-rgb), 0.95);`／`background: rgba(255, 255, 255, 0.06);` → `rgba(var(--chrome-ink-rgb), 0.06);`
- `.closeBtn:focus-visible`（`:56`）: `outline: 1px dashed rgba(255, 255, 255, 0.5);` → `rgba(var(--chrome-ink-rgb), 0.5);`

`.scrollFade`（`:71`）は**暗グラデ**（`rgba(12,12,12,x)`）＝ink 変換ではなく flat 専用上書き。ファイル末尾（`@keyframes panelIn` の前後どこでも可）に append:
```css
/* Flat: the scroll fade must fade to the LIGHT panel surface, not dark. */
:global(html[data-theme-id="flat"]) .scrollFade {
  background: linear-gradient(to bottom, rgba(250, 249, 246, 0), rgba(250, 249, 246, 0.94));
}
```

- [ ] **Step 5: ExtensionEntry.module.css を変換**

`components/board/ExtensionEntry.module.css` で、**`rgba(255, 255, 255, A)` を全て `rgba(var(--chrome-ink-rgb), A)` に**、**`#fff` を `rgb(var(--chrome-ink-rgb))` に**置換。対象行（grep `rgba(255, 255, 255` で全件・以下は既知の該当）:
`.group + .group`（`:93` border）・`.groupLabel`（`:100`）・`.themePickBtn`（`:114` border, `:116` bg）・`.themePickBtn:hover`（`:121` bg, `:122` border）・`.themePickLabel`（`:129`）・`.themePickBtn:hover .themePickLabel`（`:132` `#fff`）・`.themeCurrent`（`:138`）・`.toggleLabel`（`:154`）・`.panelCta`（`:175` border, `:177` bg, `:178` color）・`.panelCta:hover`（`:183` bg, `:184` border, `:185` `#fff`）・`.layoutNote`（`:207`）・`.backupCaption`（`:221`）・`.backupBtn`（`:238` border, `:240` bg, `:241` color）・`.backupBtn:hover`（`:246` bg, `:247` border, `:248` `#fff`）・`.body`（`:49`）・`.soon`（`:77`）。
**触らない**: `.toggle` の `accent-color: #28f100;`（`:161`）／`.cta` の `#1a0e05`（`:66`）／legacy `.promo`/`.close`（現行 TSX は `.promoInline` を使用＝無害だが、`rgba(255,255,255)` を含むなら同様に変換して可）。

- [ ] **Step 6: e2e を実行して通す**

Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "SETTINGS drawer"`
Expected: PASS（`panelBg`=`rgba(255,255,255,0.97)`／`ctaColor`=`rgba(20,19,15,0.82)`＝dark）。

- [ ] **Step 7: 既存バイト同一 e2e が緑を確認（音の退行なし）**

Run: `npx playwright test tests/e2e/chrome-skin-tokens.spec.ts`
Expected: 全 PASS（既存の音/紙のアサーションは `--chrome-btn-color`・fontFamily 駆動＝今回の ink 変換の影響外）。

- [ ] **Step 8: Commit**

```bash
rtk git add app/globals.css components/board/ChromeDrawer.module.css components/board/ExtensionEntry.module.css tests/e2e/flat-chrome-legibility.spec.ts
rtk git commit -m "fix(flat): legible SETTINGS drawer via --chrome-ink-rgb token"
```

---

### Task 2: THEME モーダル ＋ CUSTOMIZE ＋ ThemePicker スウォッチ

**Files:**
- Modify: `components/board/ThemeModal.module.css`
- Modify: `components/board/ThemeCustomizeSection.module.css`
- Modify: `components/board/ThemePicker.module.css`
- Test: `tests/e2e/flat-chrome-legibility.spec.ts`（append）

**Interfaces:**
- Consumes: `--chrome-ink-rgb`（Task 1）。

- [ ] **Step 1: 失敗する e2e を append**

`tests/e2e/flat-chrome-legibility.spec.ts` に追記（`isDarkInk`/`prepFlatBoard` は再利用）:
```ts
test('flat: THEME modal group labels + customize row labels are dark ink', async ({ page }) => {
  await prepFlatBoard(page)
  await page.getByTestId('extension-settings').click()
  await page.getByTestId('open-theme-modal').click()
  const modal = page.getByTestId('theme-modal')
  await modal.waitFor({ state: 'visible', timeout: 10_000 })
  // modal panel is the light flat surface
  const bg = await modal.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBe('rgba(255, 255, 255, 0.97)')
  // a group label (PATTERN THEMES / WORKS) resolves dark
  const label = modal.locator('[class*="groupLabel"]').first()
  const labelColor = await label.evaluate((el) => getComputedStyle(el).color)
  expect(isDarkInk(labelColor)).toBe(true)
})
```

- [ ] **Step 2: 実行して落ちるのを確認**

Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "THEME modal"`
Expected: FAIL（`groupLabel` は現状 `rgba(255,255,255,0.42)`）。

- [ ] **Step 3: ThemeModal.module.css を変換**

`.groupLabel`（`:12`）: `color: rgba(255, 255, 255, 0.42);` → `color: rgba(var(--chrome-ink-rgb), 0.42);`
（他に `rgba(255,255,255` があれば同様に変換。grep で確認。）

- [ ] **Step 4: ThemeCustomizeSection.module.css を変換**

`rgba(255, 255, 255, A)` を全て `rgba(var(--chrome-ink-rgb), A)` に。既知該当: `.section`（`:4` border-top）・`.groupLabel`（`:19`）・`.resetBtn`（`:25` color, `:27` border）・`.rowLabel`（`:48`）・`.customSwatch`（`:80` border, `:86` color）・`.colorSwatch`（`:62` border）。
**触らない**: `.patternSwatch`（`:116` `background:#0e0e11`＝プレビュー用暗チップ＝意図的に暗いまま）・`.slider` の accent（緑）。

- [ ] **Step 5: ThemePicker.module.css のスウォッチ面を flat 専用に**

`.swatch`（`:7-8`）は `--color-glass-bg`/`--color-glass-border`（flat 未定義→暗既定に落ちて白に埋もれる）。ファイル末尾に append:
```css
/* Flat: glass tokens are undefined here (inherit the dark :root defaults),
   so give the swatch a faint dark-ink surface/outline that reads on white. */
:global(html[data-theme-id="flat"]) .swatch {
  background: rgba(var(--chrome-ink-rgb), 0.03);
  border-color: rgba(var(--chrome-ink-rgb), 0.14);
}
```
（`.preview[data-theme-id=...]` のサムネ背景は**触らない**＝意図的なテーマ見本。）

- [ ] **Step 6: e2e を実行して通す**

Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "THEME modal"`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/ThemeModal.module.css components/board/ThemeCustomizeSection.module.css components/board/ThemePicker.module.css tests/e2e/flat-chrome-legibility.spec.ts
rtk git commit -m "fix(flat): legible THEME modal + customize + picker swatches"
```

---

### Task 3: Pattern B ドロップダウン（FilterPill / LanguageSwitcher / TagDropPanel / TagContextMenu）

**Files:**
- Modify: `components/board/FilterPill.module.css`
- Modify: `components/board/LanguageSwitcher.module.css`
- Modify: `components/board/TagDropPanel.module.css`
- Modify: `components/triage/TagContextMenu.module.css`
- Test: `tests/e2e/flat-chrome-legibility.spec.ts`（append）

**Interfaces:**
- Consumes: `--chrome-ink-rgb`（Task 1）、`--chrome-panel-surface`（既存トークン・flat=`rgba(255,255,255,0.97)`）。

- [ ] **Step 1: 失敗する e2e を append**

```ts
test('flat: FilterPill dropdown is a light panel with dark ink rows (fixes dark-on-dark)', async ({ page }) => {
  await prepFlatBoard(page)
  const pill = page.getByTestId('filter-pill')
  await pill.scrollIntoViewIfNeeded()
  await pill.click()
  const menu = page.getByTestId('filter-pill-menu')
  await expect(menu).toHaveAttribute('data-open', 'true')
  // menu surface flipped to the light flat panel
  const menuBg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(menuBg).toBe('rgba(255, 255, 255, 0.97)')
  // a non-active row (switch off ALL first) resolves to dark ink on the light panel
  await menu.getByRole('button', { name: /TRASH/ }).click()
  await pill.click()
  await expect(menu).toHaveAttribute('data-open', 'true')
  const allRow = menu.getByRole('button', { name: /^ALL/ })
  const rowColor = await allRow.evaluate((el) => getComputedStyle(el).color)
  expect(isDarkInk(rowColor)).toBe(true)
})
```

- [ ] **Step 2: 実行して落ちるのを確認**

Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "FilterPill dropdown"`
Expected: FAIL（`menuBg` は現状 `rgba(8, 8, 10, 0.96)`）。

- [ ] **Step 3: FilterPill.module.css**

(a) menu 内のハードコード白（`rgba(255,255,255,A)`）を `rgba(var(--chrome-ink-rgb),A)` に。既知該当: `.itemCount`（`:292`）・`.sectionHeader`（`:463`）・`.sortToggle`（`:490`）・`.separator`（`:104`）・`.tagDot` border（`:395`）・`.renameInput`（`:421` `#fff` → `rgb(var(--chrome-ink-rgb))`）。`.item`（`:268` `var(--chrome-btn-color)`）と `.pill`（`:18`）は**触らない**（既にトークン駆動）。緑ドットは触らない。
(b) ファイル末尾に flat 専用の面反転を append:
```css
/* Flat: re-skin the dropdown surface to the light panel so the token-driven
   dark-ink rows read (fixes dark-ink-on-dark-glass = invisible). */
:global(html[data-theme-id="flat"]) .menu {
  background: var(--chrome-panel-surface);
  border-color: rgba(var(--chrome-ink-rgb), 0.10);
}
```

- [ ] **Step 4: LanguageSwitcher.module.css**

(a) `.toggle`（`:25` `color: rgba(255,255,255,0.85);`）→ `color: var(--chrome-btn-color, rgba(255, 255, 255, 0.85));`（ヘッダーボタンと同じ＝flat で暗インク）。`.option`（`:114`）等の menu 内白 → `rgba(var(--chrome-ink-rgb),A)`。`.check`（緑）は触らない。
(b) ファイル末尾に append:
```css
:global(html[data-theme-id="flat"]) .list {
  background: var(--chrome-panel-surface);
  border-color: rgba(var(--chrome-ink-rgb), 0.10);
}
```

- [ ] **Step 5: TagDropPanel.module.css**

menu 内白 → `rgba(var(--chrome-ink-rgb),A)`（既知: `.tagItem`/`.newRow`（`:85`）・`.sectionHead`（`:142`）・`.count`（`:45`）・`.tagCount`（`:191`）・`.empty`（`:243`）。緑は触らない）。ファイル末尾に append:
```css
:global(html[data-theme-id="flat"]) .menu {
  background: var(--chrome-panel-surface);
  border-color: rgba(var(--chrome-ink-rgb), 0.10);
}
```

- [ ] **Step 6: triage/TagContextMenu.module.css**

`.panel`（`:11` `background: rgba(8,8,10,0.96)`）と行の白 → 同型。行の白を `rgba(var(--chrome-ink-rgb),A)` に、末尾に append:
```css
:global(html[data-theme-id="flat"]) .panel {
  background: var(--chrome-panel-surface);
  border-color: rgba(var(--chrome-ink-rgb), 0.10);
}
```

- [ ] **Step 7: e2e を実行して通す + 既存 FilterPill バイト同一を再確認**

Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "FilterPill dropdown"`
Expected: PASS。
Run: `npx playwright test tests/e2e/chrome-skin-tokens.spec.ts -g "FilterPill"`
Expected: 全 PASS（音/紙の `.item` 色・fontFamily は不変）。

- [ ] **Step 8: Commit**

```bash
rtk git add components/board/FilterPill.module.css components/board/LanguageSwitcher.module.css components/board/TagDropPanel.module.css components/triage/TagContextMenu.module.css tests/e2e/flat-chrome-legibility.spec.ts
rtk git commit -m "fix(flat): re-skin dropdown panels light + dark-ink rows"
```

---

### Task 4: トースト群のフラット皮（統一・ユーザー承認済）

**Files:**
- Modify: `components/board/UndoToast.module.css`
- Modify: `components/board/BackupReminder.module.css`
- Modify: `components/board/PasteSaveFeedback.module.css`
- Modify: `components/board/ShareToast.module.css`

**Interfaces:**
- Consumes: `--chrome-ink-rgb`、`--chrome-panel-surface`。

- [ ] **Step 1: 各トーストに flat 専用の面＋インク上書きを append**

各ファイル末尾に、そのトーストのルート要素セレクタ（`.toast` / `.panel` / `.bar`）に対して:
```css
/* Flat: light surface + dark ink so the toast belongs to the flat world. */
:global(html[data-theme-id="flat"]) .toast {
  background: var(--chrome-panel-surface);
  color: rgba(var(--chrome-ink-rgb), 0.9);
  border: 1px solid rgba(var(--chrome-ink-rgb), 0.10);
}
```
- `UndoToast.module.css`: セレクタ `.toast`。内部の白文字（`:24` 付近）も `rgba(var(--chrome-ink-rgb),A)` に。
- `BackupReminder.module.css`: `.toast`（`:10` bg・`:11` `#f2f2f2` 文字）→ 上書き＋文字を `rgba(var(--chrome-ink-rgb),0.9)`。
- `PasteSaveFeedback.module.css`: `.panel`（`:23` bg・`:35` 白ラベル）→ 上書き。amber の `.pill` は**触らない**（意味色）。
- `ShareToast.module.css`: `.bar`（`:25` bg）→ 上書き。`.status`/`.hint`/`.textBtn`（`:37/:43/:66`）と `.snipAwayHint`（`:152`）の白 → `rgba(var(--chrome-ink-rgb),A)`。

**注意**: 緑/amber/赤の意味色（成功・警告）は**触らない**。

- [ ] **Step 2: tsc + build で壊れないことを確認**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0 errors／build 成功（LightningCSS が `rgba(var(--chrome-ink-rgb), A)` を保持することの確認も兼ねる）。

- [ ] **Step 3: Commit**

```bash
rtk git add components/board/UndoToast.module.css components/board/BackupReminder.module.css components/board/PasteSaveFeedback.module.css components/board/ShareToast.module.css
rtk git commit -m "fix(flat): light toast skins for the flat theme"
```

---

## Verification & Invariants（全 Task 後・subagent-driven の最終ゲート）

- [ ] `rtk tsc` → 0 errors
- [ ] `npx vitest run` → 全緑（新規落ちなし）
- [ ] `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts tests/e2e/chrome-skin-tokens.spec.ts tests/e2e/board-theme.spec.ts` → 全 PASS（**新規＝flat 可読 / 既存＝音・紙バイト同一**）
- [ ] `rtk pnpm build` → 成功
- [ ] **バイト同一の独立確認**: `git diff` で「暗テーマの直書き値が変わっていない」＝全変換が `rgba(255,255,255,A)`→`rgba(var(--chrome-ink-rgb),A)`（:root 三値=255,255,255＝計算同値）／Pattern B/トースト/scrollFade は全て `:global(html[data-theme-id="flat"])` scoped の append であることを確認。
- [ ] opus 全ブランチレビュー: (1) 音/紙/Grid バイト同一（ink :root=255,255,255・flat scoped の append-only）(2) flat の全メニューが暗インク×明面 (3) 意図的な色（緑/amber/glitch/プレビュー暗チップ）が無改変。

## Self-Review（記録）
- **Spec coverage**: §3-1 ink トークン=Task1／§3-2 Pattern B 面反転=Task3／§3-3 scrollFade=Task1・ThemePicker=Task2・トースト=Task4／§5 テスト=各 Task の e2e + Verification。全カバー。
- **Placeholder scan**: 変換対象は「grep `rgba(255, 255, 255` 全件 − 例外リスト」の明示レシピ＋既知行番号＝実行可能。
- **Type consistency**: トークン名 `--chrome-ink-rgb`（三値・カンマ区切り）を全 Task で `rgba(var(--chrome-ink-rgb), A)` 形で一貫消費。`--chrome-panel-surface` は既存名。
