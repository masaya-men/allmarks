# ① chrome アニメのテーマ化 ＋ ラベル字体の連動 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** chrome（メニュー）のアニメをテーマごとに載せ替え（音だけスクランブル＋グリッチ／フラット＝下線／他＝静か）、ツイート翻訳をフラットで静音化、絞り込みピルの字体をヘッダーボタンと共通トークンで連動させる。

**Architecture:** `ThemeMeta.chromeMotion`（signature|quiet）を新設し、JS スクランブルをそれでゲート、CSS グリッチを signature テーマ(id)にスコープ。フラットに下線ホバー追加。カード側は quiet テキスト遷移を追加。chrome ラベルは共通 `--chrome-label-*` トークンで駆動。

**Tech Stack:** Next.js / Vanilla CSS Modules + custom properties / React hooks / Playwright e2e / vitest。

## Global Constraints
- **音（dotted-notebook）は挙動バイト同一**（スクランブル/グリッチのスコープ追加後も音では全セレクタ一致）。**唯一の例外＝絞り込みピルの label 字体 harmonize（Task 4・全テーマで揃える＝ユーザー要望・意図的）**。
- 紙・Grid はグリッチ/スクランブルが消える（意図的＝音 only signature）。s199 のフラット可読化・TUNE 線修正は無改変。
- `chromeMotion` は**必須フィールド**（全テーマ宣言＝抜けゼロ）。CSS グリッチのスコープ theme-id 集合 ＝ `chromeMotion==='signature'` の集合、をテストで固定。
- Framer Motion 禁止（WAAPI/CSS のみ）。reduced-motion 既存ニュートライザ維持。commit は `rtk` 前置・body 英語・`--no-verify` 禁止。vitest/playwright は素の `npx`。
- signature テーマ id = `dotted-notebook`（唯一）。

---

### Task 1: `ThemeMeta.chromeMotion` フィールド ＋ ツイート翻訳の quiet 遷移

**Files:**
- Modify: `lib/board/types.ts`（`ThemeMeta`）
- Modify: `lib/board/theme-registry.ts`（4テーマに `chromeMotion`）
- Create: `lib/animation/text-transition/themes/quiet.ts`
- Modify: `lib/animation/text-transition/index.ts`
- Modify: `lib/board/theme-registry.ts`（flat の `motion.text`）
- Test: `lib/board/theme-registry.test.ts`（or 既存 theme テスト）／`lib/animation/text-transition/index.test.ts`（無ければ作成）

**Interfaces:**
- Produces: `ThemeMeta.chromeMotion: 'signature' | 'quiet'`（必須）。`getTextTransition('quiet')` = loadingClass:null/exitClass:null/exitMs:0/playEntry=即 setText。

- [ ] **Step 1: 失敗する unit を書く**（registry）
`lib/board/theme-registry.test.ts` に追記:
```ts
import { getThemeMeta } from './theme-registry'
test('chromeMotion: only dotted-notebook is signature', () => {
  expect(getThemeMeta('dotted-notebook').chromeMotion).toBe('signature')
  expect(getThemeMeta('grid-paper').chromeMotion).toBe('quiet')
  expect(getThemeMeta('paper-atelier').chromeMotion).toBe('quiet')
  expect(getThemeMeta('flat').chromeMotion).toBe('quiet')
})
```
Run: `npx vitest run lib/board/theme-registry.test.ts` → FAIL（型 or 値）。

- [ ] **Step 2: `ThemeMeta` に必須フィールド追加**
`lib/board/types.ts` の `ThemeMeta` に（`scrollMeterVariant` の近く）:
```ts
  /**
   * Chrome (menu) animation language. 'signature' = this theme opts into the
   * scramble + RGB-glitch chrome micro-interactions (Sound Wave's identity);
   * 'quiet' = no scramble/glitch (calm hover only). Required so a new theme
   * must declare it → no theme silently inherits the loud chrome.
   */
  readonly chromeMotion: 'signature' | 'quiet'
```

- [ ] **Step 3: registry に値を入れる**
`lib/board/theme-registry.ts`: dotted-notebook に `chromeMotion: 'signature',`、grid-paper / paper-atelier / flat に `chromeMotion: 'quiet',`。

- [ ] **Step 4: quiet テキスト遷移を作る**
`lib/animation/text-transition/themes/quiet.ts`（新規）:
```ts
import type { TextTransition } from '../index'

/** Quiet text transition: no loading glitch, no CRT exit — the flat/still
 *  world just swaps the text (a plain, immediate set; entry is a no-op so the
 *  translated text simply appears). */
export function createQuietTransition(): TextTransition {
  return {
    loadingClass: null,
    exitClass: null,
    exitMs: 0,
    playEntry: ({ el, finalText, setText }) => {
      setText(finalText)
      return () => {}
    },
  }
}
```

- [ ] **Step 5: `getTextTransition` に case 追加 ＋ flat を quiet に**
`lib/animation/text-transition/index.ts`: import 追加＋
```ts
    case 'quiet':
      return createQuietTransition()
```
（`ink-underline` の case の隣）。
`lib/board/theme-registry.ts`: flat の `motion` を `{ entry: 'fade', text: 'quiet', shutdown: 'fade' }` に（text のみ `default`→`quiet`）。

- [ ] **Step 6: quiet 遷移の unit**
`lib/animation/text-transition/index.test.ts`（無ければ作成）:
```ts
import { getTextTransition } from './index'
test('quiet transition has no loading/exit glitch', () => {
  const t = getTextTransition('quiet')
  expect(t.loadingClass).toBeNull()
  expect(t.exitClass).toBeNull()
})
test('default still falls through to glitch-crt (dark themes unchanged)', () => {
  expect(getTextTransition('glitch-crt').loadingClass).not.toBeNull()
})
```

- [ ] **Step 7: 実行して緑 ＋ 既存 vitest 影響なし**
Run: `npx vitest run lib/board lib/animation/text-transition` → 全緑。
Run: `rtk tsc` → 0 errors（`chromeMotion` 必須化で registry 4件が埋まっていること）。

- [ ] **Step 8: Commit**
```bash
rtk git add lib/board/types.ts lib/board/theme-registry.ts lib/animation/text-transition/ lib/board/theme-registry.test.ts
rtk git commit -m "feat(theme): chromeMotion field + quiet tweet-translate transition for flat"
```

---

### Task 2: スクランブルのゲート（共通テーマ信号 ＋ 2実装）

**Files:**
- Create: `lib/board/use-chrome-motion.ts`（現テーマの signature 判定を共有）
- Modify: `lib/board/use-idle-scramble.ts`（`useChromeScramble` をゲート）
- Modify: `components/board/TuneTrigger.tsx`（独自スクランブルをゲート）
- Test: `lib/board/use-idle-scramble.test.ts`（無ければ作成）

**Interfaces:**
- Consumes: `ThemeMeta.chromeMotion`（Task 1）。
- Produces: `useSignatureChromeMotion(): boolean`（現 `<html data-theme-id>` が signature なら true・テーマ変更に追従）。

- [ ] **Step 1: 共有フックを書く**
`lib/board/use-chrome-motion.ts`:
```ts
'use client'
import { useSyncExternalStore } from 'react'
import { getThemeMeta } from './theme-registry'
import type { ThemeId } from './types'

function readSignature(): boolean {
  if (typeof document === 'undefined') return false
  const id = document.documentElement.getAttribute('data-theme-id') as ThemeId | null
  if (!id) return false
  const meta = (getThemeMeta as (i: ThemeId) => { chromeMotion?: string } | undefined)(id)
  return meta?.chromeMotion === 'signature'
}

function subscribe(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-id'] })
  return () => obs.disconnect()
}

/** True when the current board theme opts into signature chrome motion
 *  (scramble + glitch). Reacts to live theme switches via the html attribute. */
export function useSignatureChromeMotion(): boolean {
  return useSyncExternalStore(subscribe, readSignature, () => false)
}
```

- [ ] **Step 2: 失敗する unit（quiet テーマでスクランブルしない）**
`lib/board/use-idle-scramble.test.ts`（renderHook + fake timers）: `data-theme-id="flat"` を html に設定 → `useChromeScramble('TITLE')` の `display` が `'TITLE'` のまま（タイマー進めても wobble しない）。`data-theme-id="dotted-notebook"` では wobble しうる（display が一時的に変わる or triggerBurst で変化）。
Run: `npx vitest run lib/board/use-idle-scramble.test.ts` → FAIL。

- [ ] **Step 3: `useChromeScramble` をゲート**
`lib/board/use-idle-scramble.ts`: `useSignatureChromeMotion()` を呼び、**false の間は idle wobble を起動しない＋`triggerBurst` を no-op＋`display` は常にラベル**。既存の reduced-motion 早期 return と同じ位置でゲート（signature でない or reduced-motion → 素のラベル）。テーマが signature に変わったら（フック再評価で）通常動作に復帰。

- [ ] **Step 4: `TuneTrigger` の独自スクランブルをゲート**
`components/board/TuneTrigger.tsx`: 同じく `useSignatureChromeMotion()` で idle スクランブルを起動しない（quiet 時はラベル固定）。既存 `data-grabbing` churn は音のみ（現状維持）。

- [ ] **Step 5: 実行して緑**
Run: `npx vitest run lib/board/use-idle-scramble.test.ts` → PASS。
Run: `rtk tsc` → 0。

- [ ] **Step 6: Commit**
```bash
rtk git add lib/board/use-chrome-motion.ts lib/board/use-idle-scramble.ts components/board/TuneTrigger.tsx lib/board/use-idle-scramble.test.ts
rtk git commit -m "feat(chrome): gate label scramble to signature themes only"
```

---

### Task 3: グリッチを音にスコープ ＋ フラットの下線ホバー(B)

**Files:**
- Modify: `components/board/ChromeButton.module.css`
- Modify: `components/board/FilterPill.module.css`
- Modify: `components/board/TuneTrigger.module.css`
- Modify: `components/board/ScrollMeter.module.css`
- Modify: `components/board/LanguageSwitcher.module.css`
- Test: `tests/e2e/flat-chrome-legibility.spec.ts`（append）／`tests/e2e/chrome-skin-tokens.spec.ts` は不変で緑

**Interfaces:** Consumes: `--chrome-ink-rgb`（既存・下線色に使用可）。

- [ ] **Step 1: 失敗する e2e を append**
`tests/e2e/flat-chrome-legibility.spec.ts`:
```ts
test('flat: chrome buttons have NO glitch ghost and DO show an underline on hover', async ({ page }) => {
  await prepFlatBoard(page)
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  await btn.hover()
  // ::before glitch ghost must be invisible on flat (scoped to signature theme)
  const ghostOpacity = await btn.evaluate((el) => getComputedStyle(el, '::before').opacity)
  expect(ghostOpacity).toBe('0')
  // underline (::after) must be present + scaled in on hover
  const underlineTransform = await btn.evaluate((el) => getComputedStyle(el, '::after').transform)
  expect(underlineTransform === 'none' ? 'scaleX(0)' : underlineTransform).not.toBe('matrix(0, 0, 0, 1, 0, 0)')
})
test('sound wave: chrome button glitch ghost fires on hover (signature unchanged)', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  // default theme is dotted-notebook — do NOT switch away
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  await btn.hover()
  const ghostColor = await btn.evaluate((el) => getComputedStyle(el, '::before').color)
  // orange ghost #ff9d3f
  expect(ghostColor).toBe('rgb(255, 157, 63)')
})
```
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "glitch|underline"` → FAIL。

- [ ] **Step 2: グリッチを signature テーマにスコープ（5ファイル）**
各ファイルの hover グリッチ発火セレクタ（`:hover::before/::after` のグリッチ animation を付ける規則）を `:global(html[data-theme-id="dotted-notebook"])` プレフィックスでスコープ。**@keyframes 定義と grab-loop（`html[data-grabbing]`）は無改変**。対象規則:
  - `ChromeButton.module.css`: `.btn:hover::before`（44）/`.btn:hover::after`（49）。
  - `FilterPill.module.css`: `.pill:hover .label::before/::after`（63/68 付近）＋ `.pill:hover .count::…`（132 付近）。
  - `TuneTrigger.module.css`: `.trigger[aria-expanded='false']:hover::before/::after`（63/68）＋ `.trigger:hover .numGroup::before/::after`（96/101）。
  - `ScrollMeter.module.css`: `.meterCounter:hover::…` ＋ `.meterCounter.glitchBurst::…`（92-102 付近）。
  - `LanguageSwitcher.module.css`: `.toggle:hover .code::…` ＋ `.option:hover .label::…`（69-78 付近・`lang-glitch`）。
  例（ChromeButton）:
  ```css
  :global(html[data-theme-id="dotted-notebook"]) .btn:hover::before { color:#ff9d3f; animation: glitch-shift-a 700ms steps(7,end); }
  :global(html[data-theme-id="dotted-notebook"]) .btn:hover::after  { color:#50c8ff; animation: glitch-shift-b 700ms steps(7,end); }
  ```
  reduced-motion のニュートライザは対応セレクタに追従（同様にスコープ or 汎用のまま可＝animation:none は無害）。

- [ ] **Step 3: フラットの下線ホバー(B) を ChromeButton に追加**
`ChromeButton.module.css` 末尾に append（`.btn` は position:relative 済）:
```css
/* Flat: quiet underline on hover instead of the sound-world RGB glitch.
   ::after is free here because the glitch ghost is scoped to the signature
   theme (Task 3). Draw a 1.5px ink underline from the left. */
:global(html[data-theme-id="flat"]) .btn::after {
  content: "";
  position: absolute;
  left: 12px; right: 12px; bottom: 5px;
  height: 1.5px;
  background: rgba(var(--chrome-ink-rgb), 0.9);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.24s cubic-bezier(0.2, 0.7, 0.2, 1);
  opacity: 1;
}
:global(html[data-theme-id="flat"]) .btn:hover::after { transform: scaleX(1); }
@media (prefers-reduced-motion: reduce) {
  :global(html[data-theme-id="flat"]) .btn::after { transition: none; }
}
```
（ワードマークも `ChromeButton` 経由なら自動で下線が付く。もしワードマークが別要素なら同型を後続で。まず ChromeButton で検証。）

- [ ] **Step 4: 実行して緑 ＋ 音バイト同一を再確認**
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts` → 全 PASS（新2本含む）。
Run: `npx playwright test tests/e2e/chrome-skin-tokens.spec.ts` → 全 PASS（音の chrome は byte-id・グリッチのスコープ追加は音で一致ゆえ不変）。

- [ ] **Step 5: Commit**
```bash
rtk git add components/board/ChromeButton.module.css components/board/FilterPill.module.css components/board/TuneTrigger.module.css components/board/ScrollMeter.module.css components/board/LanguageSwitcher.module.css tests/e2e/flat-chrome-legibility.spec.ts
rtk git commit -m "feat(chrome): scope glitch to signature theme; flat gets quiet underline hover"
```

---

### Task 4: chrome ラベル字体の共通トークン ＋ 絞り込みピル harmonize

**Files:**
- Modify: `app/globals.css`（`:root` に `--chrome-label-*`）
- Modify: `components/board/ChromeButton.module.css`
- Modify: `components/board/FilterPill.module.css`
- Modify: `components/board/TuneTrigger.module.css`
- Test: `tests/e2e/flat-chrome-legibility.spec.ts`（append）

**Interfaces:** Produces: `--chrome-label-size`/`--chrome-label-tracking`/`--chrome-label-weight`（:root）。

- [ ] **Step 1: 失敗する e2e を append**
```ts
test('flat: filter pill label typography matches the header buttons (linked)', async ({ page }) => {
  await prepFlatBoard(page)
  const btn = page.getByTestId('extension-settings')
  const pillLabel = page.getByTestId('filter-pill').locator('[class*="label"]').first()
  const read = (l) => l.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { family: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize, tracking: cs.letterSpacing }
  })
  const b = await read(btn); const p = await read(pillLabel)
  expect(p.family).toBe(b.family)
  expect(p.weight).toBe(b.weight)
  expect(p.size).toBe(b.size)
  expect(p.tracking).toBe(b.tracking)
})
```
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "typography matches"` → FAIL（weight 500 vs 400・size 12 vs 11・tracking 0.04 vs 0.10）。

- [ ] **Step 2: 共通トークンを :root に追加**
`app/globals.css :root`（chrome 既定ブロック付近）:
```css
  --chrome-label-size: 11px;
  --chrome-label-tracking: 0.1em;
  --chrome-label-weight: 400;
```

- [ ] **Step 3: ChromeButton `.btn` をトークン駆動（バイト同一）**
`.btn`: `font-size: var(--chrome-label-size);`／`letter-spacing: var(--chrome-label-tracking);`／`font-weight: var(--chrome-label-weight);`（現 11px/0.10em/実質400＝計算同値）。

- [ ] **Step 4: FilterPill をトークン駆動（harmonize）**
`.pill`（15-17）と `.label`（38-46）と `.count`: bespoke（`.label` の weight 500/size 12px/tracking 0.04em）を撤去し、`font-size: var(--chrome-label-size)`／`letter-spacing: var(--chrome-label-tracking)`／`font-weight: var(--chrome-label-weight)` に。`font-variant-numeric: tabular-nums`（`.label`/`.count`）と case（内容駆動）は維持。`.count` も同じ size/weight/tracking に揃える。

- [ ] **Step 5: TuneTrigger `.trigger` をトークン駆動（バイト同一）**
`.trigger`（16-21）: `font-size: var(--chrome-label-size)`／`letter-spacing: var(--chrome-label-tracking)`／`font-weight: var(--chrome-label-weight)`（現 11px/0.10em/実質400）。

- [ ] **Step 6: 実行して緑**
Run: `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts -g "typography matches"` → PASS。
Run: `rtk tsc && npx playwright test tests/e2e/chrome-skin-tokens.spec.ts` → tsc0／音の chrome-skin テスト緑（`.btn`/`.trigger` は計算同値・chrome-skin は color/fontFamily を見る）。

- [ ] **Step 7: Commit**
```bash
rtk git add app/globals.css components/board/ChromeButton.module.css components/board/FilterPill.module.css components/board/TuneTrigger.module.css tests/e2e/flat-chrome-legibility.spec.ts
rtk git commit -m "feat(chrome): shared --chrome-label typography tokens; harmonize filter pill"
```

---

## Verification & Invariants（全 Task 後・最終ゲート）
- [ ] `rtk tsc` 0 ／ `npx vitest run` 全緑 ／ `rtk pnpm build` 成功
- [ ] `npx playwright test tests/e2e/flat-chrome-legibility.spec.ts tests/e2e/chrome-skin-tokens.spec.ts tests/e2e/board-theme.spec.ts` 全 PASS
- [ ] 音（dotted-notebook）: グリッチ発火・スクランブル動作・カードアニメ不変（**例外＝ピル label 字体 harmonize は意図的**）
- [ ] フラット: グリッチ/スクランブル無し・下線出る・ツイート翻訳 quiet・ピル字体=ボタン一致
- [ ] `chromeMotion` 必須（全テーマ宣言）／CSS グリッチのスコープ id = signature 集合
- [ ] opus 全ブランチレビュー: (1)音バイト同一（ピル字体例外を明記）(2)quiet テーマで chrome アニメ皆無 (3)signature ゲートの網羅（scramble 全消費者・glitch 全5ファイル）(4)ピル字体の連動（トークン単一源）

## Self-Review
- Spec coverage: 3-A=Task1(field)+Task2(scramble)+Task3(glitch)／3-B=Task3(underline)／3-C=Task1(quiet)／3-D=Task4(tokens)。全カバー。
- Placeholder: グリッチスコープは「対象規則に `:global(html[data-theme-id="dotted-notebook"])` を前置」の明示レシピ＋行番号。
- Type consistency: `chromeMotion`（Task1）→ `useSignatureChromeMotion`（Task2）／`--chrome-label-*`（Task4）を一貫使用。
