# サブ2: フラットパターンテーマ＋フラット TUNE 皮 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development でタスク単位に実装。各 Step は checkbox（`- [ ]`）。**実装モデル**＝機械的タスク(1のi18n)は Haiku、芯（globals/ScrollMeter/TUNE/BoardRoot）は Sonnet。統括＝Opus（per-task レビュー＋全ブランチレビュー→merge --no-ff）。
> **設計 spec:** [../specs/2026-07-14-theme-sub2-flat-theme-design.md](../specs/2026-07-14-theme-sub2-flat-theme-design.md)。**親 spec:** [../specs/2026-07-14-theme-scope-principle-design.md](../specs/2026-07-14-theme-scope-principle-design.md) §7 サブ2。
> **ブランチ:** `theme-sub2-flat`（spec は commit 済）。

**Goal:** LP と地続きの白エディトリアルな「Flat」テーマ（`kind:'pattern'`・opt-in）を追加し、その TUNE メニューを音テーマの金属ミキサーとは別の清潔なフラット皮にする。

**Architecture:** 既存テーマ機構（7点契約＋pattern 機構＋sub1 chrome トークン）に**素直に1テーマ足す**。TUNE 皮は `html[data-theme-id="flat"]`-scoped の CSS 上書き（紙が s135 で確立した手段）＝既定/音はバイト同一。メーターは**新 variant `'line'`（静音）**を追加。明色盤面の chrome 文字反転は BoardRoot の既存 `DARK_CHROME_RESET` を colorScheme で gate して完成。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / Web Animations API（motion）/ Playwright + Vitest。

## Global Constraints

- TypeScript `strict`・`any` 禁止（`unknown`＋型ガード）・Return type 明示。
- Vanilla CSS + `.module.css`／トークンは `app/globals.css`。**Tailwind 禁止・Framer Motion 禁止**。
- z-index は `lib/board/constants.ts` の `BOARD_Z_INDEX`（魔法数値禁止）。
- `rtk` 前置（`rtk git`/`rtk tsc`/`rtk vitest run`）。**`--no-verify` 禁止**。Playwright は素の `npx playwright test`。
- **既定テーマ(dotted-notebook)＋音/Grid/紙はバイト同一**。フラットの追加・globals の flat ブロック・scoped CSS 上書きは全て `data-theme-id="flat"` に閉じる（音/紙の金属ミキサーは無変更）。
- 金額は¥表記（本タスクに金額表示は無し）。応答・コメントは日本語可。
- **テーマ名は全15言語で英語のまま**（既存 `dottedNotebook`="Sound Wave" 等が zh/ko でも英語＝機能名/固有名は訳さない方針）。

## File Structure（触るファイルと責務）

| ファイル | 変更 | 責務 |
|---|---|---|
| `lib/board/types.ts` | Modify | `ThemeId` に `'flat'`／`scrollMeterVariant` に `'line'` を追加 |
| `lib/board/theme-registry.ts` | Modify | flat の `ThemeMeta`（DEFAULT は不変） |
| `lib/board/theme-customization.ts` | Modify | flat の CUSTOMIZE 既定（light 色・patternType none） |
| `components/board/themes.module.css` | Modify | `.flat`（pattern 機構に乗る＝transparent のみ） |
| `messages/*.json`×15 | Modify | `board.theme.flat` = "Flat" |
| `app/globals.css` | Modify | `html[data-theme-id="flat"]` トークンブロック |
| `components/board/BoardRoot.tsx` | Modify | `DARK_CHROME_RESET` を colorScheme で gate（明盤面の chrome 反転完成） |
| `lib/board/types.ts`（同上）＋`components/board/ScrollMeter.tsx` | Modify | `'line'` variant の描画分岐＋counter 静止 |
| `components/board/scrollmeter/QuietTrack.tsx`＋`.module.css` | Create | 静音メーターの track |
| `lib/animation/tag-entry/index.ts` | Modify | `case 'fade'`（穏やかな fade-in） |
| `lib/animation/tag-shutdown/index.ts`＋`themes/flat.module.css` | Modify/Create | `case 'fade'`（fade-out クラス） |
| `components/board/FaderColumn.module.css` | Modify | flat-scoped: 金属→細レール＋白丸ハンドル |
| `components/board/TunePresetColumn.module.css` | Modify | flat-scoped: 金属レバー/LED→ドット＋iOS トグル |
| `components/board/TuneTrigger.module.css` | Modify | flat-scoped: 暗ガラス→白パネル＋静音凡例 |
| `lib/board/theme-registry.test.ts` | Modify | flat meta 検証 |
| `tests/e2e/board-theme.spec.ts` | Modify | flat の適用・反転・メーター・TUNE を e2e |

---

### Task 1: フラットテーマの登録（骨＋CUSTOMIZE 既定＋ラベル） 【Haiku 可（機械的）／型は Sonnet 推奨】

**Files:**
- Modify: `lib/board/types.ts`
- Modify: `lib/board/theme-registry.ts`
- Modify: `lib/board/theme-customization.ts`
- Modify: `components/board/themes.module.css`
- Modify: `messages/*.json`（全15言語）
- Test: `lib/board/theme-registry.test.ts`

**Interfaces:**
- Produces: `ThemeId` に `'flat'`／`scrollMeterVariant` union に `'line'`／`THEME_REGISTRY.flat`（`getThemeMeta('flat')`）／`THEME_CUSTOMIZATION_DEFAULTS.flat`。後続 Task はこれらに依存。

- [ ] **Step 1: 型を広げる（失敗するテストを先に）** — `lib/board/theme-registry.test.ts` に flat の期待を追加:

```ts
import { THEME_REGISTRY, getThemeMeta, DEFAULT_THEME_ID } from './theme-registry'

describe('flat theme', () => {
  it('is registered as a free, light, pattern theme with the line meter', () => {
    const m = getThemeMeta('flat')
    expect(m.colorScheme).toBe('light')
    expect(m.kind).toBe('pattern')
    expect(m.tier).toBe('free')
    expect(m.scrollMeterVariant).toBe('line')
    expect(m.direction).toBe('vertical')
    expect(m.backgroundClassName).toBe('flat')
    expect(m.labelKey).toBe('board.theme.flat')
    expect(m.motion).toEqual({ entry: 'fade', text: 'default', shutdown: 'fade' })
    expect(m.decorations).toBeUndefined()
  })
  it('does not change the default theme', () => {
    expect(DEFAULT_THEME_ID).toBe('dotted-notebook')
  })
})
```

- [ ] **Step 2: 走らせて失敗を確認** — `rtk vitest run lib/board/theme-registry.test.ts` → FAIL（`'flat'` は ThemeId でない / registry に無い）。

- [ ] **Step 3: 型を追加** — `lib/board/types.ts:3` を:

```ts
export type ThemeId = 'dotted-notebook' | 'grid-paper' | 'paper-atelier' | 'flat'
```

同ファイル `scrollMeterVariant`（`:75`）の union に `'line'` を追加し、コメントも更新:

```ts
  /**
   * ScrollMeter rendering style. 'waveform' = the default sound-wave bars;
   * 'ruler' = the paper-atelier brass ruler; 'line' = the flat theme's quiet
   * editorial line (sparse ticks, static counter). Read by ScrollMeter's
   * `variant` prop (default 'waveform') so omitting it is impossible (required).
   */
  readonly scrollMeterVariant: 'waveform' | 'ruler' | 'line'
```

- [ ] **Step 4: registry に flat を追加** — `lib/board/theme-registry.ts` の `THEME_REGISTRY` に（`paper-atelier` の後ろ）:

```ts
  flat: {
    id: 'flat',
    direction: 'vertical',
    backgroundClassName: 'flat',
    labelKey: 'board.theme.flat',
    colorScheme: 'light',
    tier: 'free',
    kind: 'pattern',
    scrollMeterVariant: 'line',
    motion: { entry: 'fade', text: 'default', shutdown: 'fade' },
  },
```

`DEFAULT_THEME_ID` は**変更しない**。

- [ ] **Step 5: CUSTOMIZE 既定を追加** — `lib/board/theme-customization.ts` の `THEME_CUSTOMIZATION_DEFAULTS` に（`grid-paper` の後ろ）:

```ts
  flat: {
    edgeColor: '#f1efe8',
    boardColor: '#faf9f6',
    patternColor: 'rgba(20, 19, 15, 0.10)',
    patternType: 'none',
    patternSize: 40,
    patternStroke: 1,
    titleColor: 'rgba(20, 19, 15, 0.55)',
  },
```

`THEMES_WITH_PATTERN_CONTROLS`（`:70`）には**入れない**（＝縁+面+タイトル色のみ・格子/ドット等の制御は非表示）。

> ⚠️ CUSTOMIZE の色スウォッチ（`EDGE_SWATCHES` 等）は現状ダーク中心。flat の既定 light 色は「カスタム」チップとして正しく表示される（`ColorRow` の `isCustom` 判定）。**明色スウォッチのプリセット追加は follow-up**（本 Task では触らない＝音/Grid の CUSTOMIZE をバイト同一に保つ）。

- [ ] **Step 6: 背景クラスを追加** — `components/board/themes.module.css` に（`.gridPaper` の並びに）:

```css
.flat {
  background-color: transparent;
}
```

> flat は `kind:'pattern'`＝viewport-anchored `.patternLayer` が盤面色（`--board-color`）とパターン SVG を inline で描く（grid-paper と同機構）。専用描画は不要。

- [ ] **Step 7: 15言語のラベルを追加** — `messages/` の全 JSON（`ar de en es fr it ja ko nl pt ru th tr vi zh`）の `board.theme` オブジェクトに `paperAtelier` の直後へ1行:

```json
      "flat": "Flat",
```

**値は全ロケール "Flat"**（既存 `dottedNotebook`/`gridPaper`/`paperAtelier` が全ロケール英語なのと同じ＝テーマ名は訳さない）。JSON の trailing comma に注意（`paperAtelier` 行に `,` があるか確認し、`flat` を挟む位置で構文を壊さない）。

- [ ] **Step 8: 走らせて緑＋ゲート**:

```bash
rtk vitest run lib/board/theme-registry.test.ts
rtk tsc
```

Expected: registry テスト PASS、tsc 0 エラー（`Record<ThemeId, ThemeMeta>` が flat を強制するので登録漏れは即検出）。i18n の parity テストがあれば `rtk vitest run messages` も緑（全ロケールに flat キー有り）。

- [ ] **Step 9: Commit**:

```bash
rtk git add lib/board/types.ts lib/board/theme-registry.ts lib/board/theme-customization.ts components/board/themes.module.css messages lib/board/theme-registry.test.ts
rtk git commit -m "feat(theme): register the flat theme (pattern/light/line meter, default unchanged)"
```

---

### Task 2: globals の flat トークンブロック＋明盤面 chrome 反転の完成 【Sonnet】

**Files:**
- Modify: `app/globals.css`
- Modify: `components/board/BoardRoot.tsx`（`:3356` の `DARK_CHROME_RESET` gate）
- Test: `tests/e2e/board-theme.spec.ts`

**Interfaces:**
- Consumes: Task 1 の `data-theme-id="flat"`。
- Produces: flat が「明るい盤面＋暗インク chrome＋白パネル」で一貫描画される状態。

- [ ] **Step 1: 失敗する e2e を先に** — `tests/e2e/board-theme.spec.ts` に（paper のテストを手本に）:

```ts
test('flat theme applies a light board with dark chrome ink', async ({ page }) => {
  await prepBoard(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'flat'))
  const board = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim().toLowerCase())
  expect(board).toBe('#faf9f6')
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  expect(scheme).toContain('light')
  // panels are a light surface, chrome text is dark ink (paired — the s197 trap)
  const panel = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--chrome-panel-surface').trim())
  expect(panel).toContain('255, 255, 255')
  const btn = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--chrome-btn-color').trim())
  expect(btn).toMatch(/20, 19, 15|24, 22, 20/) // dark ink
})
```

- [ ] **Step 2: 失敗確認** — `npx playwright test tests/e2e/board-theme.spec.ts -g "flat theme applies"` → FAIL（`--bg-dark` は :root 既定の暗値のまま）。

- [ ] **Step 3: flat トークンブロックを追加** — `app/globals.css` の `html[data-theme-id="dotted-notebook"] { ... }` ブロック（`:653-663`）の**直後**に:

```css
/* ── Flat (light editorial) — LP と地続きの白盤面 ──
   opt-in の明テーマ。sub1 chrome トークンをここで初めて視覚的に消費する。
   font は body/chrome を sans(Geist)維持、serif はワードマークのみ（紙のような
   全面 serif 化はしない）。--card-radius は上書きしない＝既定の丸みを継承。 */
html[data-theme-id="flat"] {
  color-scheme: light;

  /* board canvas + card surface */
  --bg-dark: #faf9f6;                 /* board ground (= --lp-bg) */
  --bg-outer: #f1efe8;                /* edge band */
  --card-dark-alt: #ffffff;
  --card-white: #ffffff;
  --card-border-dark: rgba(20, 19, 15, 0.10);

  /* text (destefanis family) */
  --text-primary: #14130f;            /* = --lp-ink */
  --text-body: #2c2a25;
  --text-meta: #6b675e;
  --text-muted: #8a867b;
  --text-signature: #a7a294;
  --color-bg-primary: #faf9f6;
  --color-bg-elevated: #ffffff;
  --color-text-primary: #14130f;
  --color-text-secondary: #57544c;    /* = --lp-ink-soft */
  --color-text-tertiary: #8a867b;

  /* accent — one green, legible as UI ink on light */
  --color-accent-primary: #1c9a00;
  --color-accent-primary-hover: #178400;
  --accent-primary: #1c9a00;

  /* floating chrome TEXT (edge band: wordmark / MOTION / counter) — dark ink */
  --chrome-text-color: rgba(20, 19, 15, 0.92);
  --chrome-text-color-hover: rgba(20, 19, 15, 1);
  --chrome-text-stroke-color: rgba(255, 255, 255, 0.55);
  --chrome-text-stroke-color-hover: rgba(255, 255, 255, 0.7);
  --chrome-text-shadow: 0 1px 2px rgba(20, 19, 15, 0.12);

  /* chrome SKIN panels (sub1 tokens) — quiet white + dark ink, no glitch */
  --chrome-panel-surface: rgba(255, 255, 255, 0.97);
  --chrome-panel-border: rgba(20, 19, 15, 0.10);
  --chrome-panel-radius: 14px;
  --chrome-panel-blur: 8px;
  --chrome-panel-shadow: 0 22px 60px -22px rgba(20, 19, 15, 0.28);
  --chrome-btn-color: rgba(20, 19, 15, 0.9);
  --chrome-btn-hover: rgba(20, 19, 15, 1);
  --chrome-font: var(--font-sans);    /* Geist（flat は --font-sans を上書きしない） */
  --chrome-hover-fx: none;

  /* scroll meter — quiet 'line' variant tokens (QuietTrack が読む) */
  --meter-line-rail: rgba(20, 19, 15, 0.14);
  --meter-line-tick: rgba(20, 19, 15, 0.22);
  --meter-line-thumb: rgba(20, 19, 15, 0.85);
  --meter-line-numeral: rgba(20, 19, 15, 0.5);

  /* big background wordmark — serif ink（既定/音は fallback で不変） */
  --bg-typo-font: var(--font-serif-display), Georgia, 'Times New Roman', serif;
  --bg-typo-color: rgba(20, 19, 15, 0.5);

  /* motion — gentle fade tuning（getEntryAnimation('fade') が読む・§Task4） */
  --flat-fade-duration: 420ms;
  --flat-fade-easing: cubic-bezier(0.16, 1, 0.3, 1);
  --flat-fade-offset-y: 6;
  --flat-fade-stagger-step: 16;
  --flat-fade-stagger-cap: 320;

  /* soft light shadows */
  --shadow-grid-card: 0 2px 8px rgba(20, 19, 15, 0.08);
  --shadow-collage-card: 0 10px 28px rgba(20, 19, 15, 0.12);
}
```

> ⚠️ lightbox scrim（`--lightbox-backdrop`）は**上書きしない**（親 spec §3＝ライトボックスは暗背景固定・テーマ非依存）。`--font-sans`/`--font-mono` も上書きしない（Lightbox/PiP/ポップは sans のまま）。

- [ ] **Step 4: 明盤面の chrome 反転を完成（BoardRoot）** — `components/board/BoardRoot.tsx:3356` の `.canvas` の style を、**盤面が暗いときだけ**リセットするよう gate。現状:

```tsx
        style={resolvedCustom && isLightColor(resolvedCustom.edgeColor) ? DARK_CHROME_RESET : undefined}
```

を:

```tsx
        // DARK_CHROME_RESET は「暗い盤面＋明るい縁」用（内側 header/card を白インクに戻す）。
        // flat のような LIGHT 盤面ではリセットすると header が白インク×明盤面で消える —
        // 明盤面テーマは flat ブロックの暗 chrome トークンをそのまま継承させる。
        style={
          resolvedCustom &&
          isLightColor(resolvedCustom.edgeColor) &&
          themeMeta.colorScheme === 'dark'
            ? DARK_CHROME_RESET
            : undefined
        }
```

に置換。`:3354-3355` の follow-up コメント（"a *light* BOARD colour would also make the header faint … see follow-up"）は解消したので削除して上のコメントに差し替える。`themeMeta` は同スコープで既に使用（`:3235`）＝新規 import 不要。

> これで flat は: `.outerFrame`＝`LIGHT_EDGE_CHROME`（明色縁→暗インク）✓／`.canvas`＝リセットしない→flat の暗 chrome を継承✓／panels＝白面＋暗インク✓。音（dark）は `colorScheme==='dark'` で従来どおりリセット＝不変。

- [ ] **Step 5: 走らせて緑＋既定不変を確認**:

```bash
npx playwright test tests/e2e/board-theme.spec.ts
rtk tsc && rtk vitest run && pnpm build
```

Expected: 新 flat テスト PASS、`default theme is unchanged`（`--bg-dark`=`#0a0a0a`）PASS、`paper-atelier tokens apply` PASS。既存 `chrome-theme-coverage.test.tsx`（sub1 の抜けゼロ検査・全テーマループ）も flat を含めて PASS（皮を着ても全パネル描画）。

- [ ] **Step 6: Commit**:

```bash
rtk git add app/globals.css components/board/BoardRoot.tsx tests/e2e/board-theme.spec.ts
rtk git commit -m "feat(theme): flat token block + light-board chrome inversion (gate DARK_CHROME_RESET on dark scheme)"
```

---

### Task 3: 静音メーター variant `'line'`＋QuietTrack 【Sonnet】

**Files:**
- Create: `components/board/scrollmeter/QuietTrack.tsx`, `components/board/scrollmeter/QuietTrack.module.css`
- Modify: `components/board/ScrollMeter.tsx`
- Test: `components/board/ScrollMeter.test.tsx`（既存に追記）＋e2e

**Interfaces:**
- Consumes: Task1 の `scrollMeterVariant:'line'`。`ScrollMeter` の `variant` prop（既存）。
- Produces: `QuietTrack`（`markerRef` を受けて left% を親 rAF が書く）。

- [ ] **Step 1: QuietTrack を作る** — `components/board/scrollmeter/QuietTrack.tsx`:

```tsx
'use client'

import { useMemo, type ReactElement, type RefObject } from 'react'
import styles from './QuietTrack.module.css'

/** Sparse ruler for the flat theme — an editorial "quiet line": a hairline
 *  baseline, a few faint ticks, and a simple bar marker. No paper assets, no
 *  scramble. Every child is pointer-events:none so the parent `.track` keeps
 *  the real scrub hit-area; only the marker is repositioned each frame by the
 *  parent rAF via `markerRef` (same contract as RulerTrack). */
const UNITS = 100
const STEP = 10

type Props = {
  readonly markerRef: RefObject<HTMLDivElement | null>
}

export function QuietTrack({ markerRef }: Props): ReactElement {
  const ticks = useMemo(
    () => Array.from({ length: UNITS / STEP + 1 }, (_, i) => i * STEP),
    [],
  )
  return (
    <div className={styles.rail} data-testid="quiet-track" aria-hidden="true">
      <div className={styles.baseline} />
      {ticks.map((u) => (
        <div key={u} className={styles.tick} style={{ left: `${u}%` }} />
      ))}
      <div className={styles.markerTrack}>
        <div ref={markerRef} className={styles.marker} data-testid="quiet-marker" style={{ left: '0%' }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: QuietTrack の CSS** — `components/board/scrollmeter/QuietTrack.module.css`:

```css
/* Flat "quiet line" meter track. Static except the bar marker (parent rAF sets
   marker.style.left each frame). Colors from --meter-line-* (flat block); a
   neutral fallback keeps it visible off-theme. */
.rail { position: absolute; inset: 0; pointer-events: none; }

.baseline {
  position: absolute; left: 0; right: 0; bottom: 7px; height: 1px;
  background: var(--meter-line-rail, rgba(255, 255, 255, 0.18));
}
.tick {
  position: absolute; bottom: 6px; width: 1px; height: 4px;
  background: var(--meter-line-tick, rgba(255, 255, 255, 0.28));
  transform: translateX(-0.5px);
}
.markerTrack { position: absolute; top: 0; bottom: 0; left: 15px; right: 15px; pointer-events: none; }
.marker {
  position: absolute; bottom: 3px; width: 30px; height: 9px; border-radius: 3px;
  background: var(--meter-line-thumb, rgba(255, 255, 255, 0.85));
  transform: translateX(-50%); pointer-events: none; will-change: left;
}
```

- [ ] **Step 3: ScrollMeter に 'line' を配線** — `components/board/ScrollMeter.tsx`:

(a) import 追加（`import { RulerTrack } ...` の下）:

```tsx
import { QuietTrack } from './scrollmeter/QuietTrack'
```

(b) rAF ループの `const isRuler = variantRef.current === 'ruler'`（`:426`）を、静音判定に一般化:

```tsx
      const isRuler = variantRef.current === 'ruler'
      const isQuiet = isRuler || variantRef.current === 'line'
```

(c) 波形の per-tick 高さ書き込みガード `if (!isRuler)`（`:427`）→ `if (!isQuiet)`。
(d) marker 位置更新の `else`（ruler 分岐 `:452-460`）を `isQuiet` で発火するよう変更（line も同じ `rulerMarkerRef` を使う）:

```tsx
      if (!isQuiet) {
        for (let i = 0; i < TICK_COUNT; i++) { /* …既存の波形高さ計算… */ }
      } else {
        // ruler / line: no per-tick height; slide the marker to centerTickIdx.
        const marker = rulerMarkerRef.current
        if (marker) {
          const pct = (centerTickIdx / (TICK_COUNT - 1)) * 100
          marker.style.left = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`
        }
      }
```

(e) counter の静止ゲート `if (isRuler)`（`writeDigit` 内 `:495`）→ `if (isQuiet)`（line も数字をスクランブルさせず settled 値を出す）:

```tsx
        if (isQuiet) {
          node.textContent = pad4(settled)
          return
        }
```

(f) render 分岐（`:654-671`）を3分岐に:

```tsx
          {variant === 'ruler' ? (
            <RulerTrack markerRef={rulerMarkerRef} />
          ) : variant === 'line' ? (
            <QuietTrack markerRef={rulerMarkerRef} />
          ) : (
            <>
              <div className={styles.baseline} aria-hidden="true" />
              {ticks.map((i) => ( /* …既存の波形 tick… */ ))}
              {hoverPct !== null && !isDragging && (
                <div className={styles.hoverLine} aria-hidden="true" style={{ left: `${hoverPct}%` }} />
              )}
            </>
          )}
```

- [ ] **Step 4: 単体テストを追加** — `components/board/ScrollMeter.test.tsx` に:

```tsx
it('line variant renders QuietTrack and does not scramble the counter', () => {
  render(<ScrollMeter mode="board" n1={1} n2={9} total={410} swellFraction={0.2} onScrub={() => {}} variant="line" />)
  expect(screen.getByTestId('quiet-track')).toBeInTheDocument()
  // total renders as the settled value immediately (no scramble churn on line).
  expect(screen.getByTestId('scroll-meter')).toHaveAttribute('data-meter-variant', 'line')
})
```

- [ ] **Step 5: 検証**:

```bash
rtk vitest run components/board/ScrollMeter.test.tsx
rtk tsc && pnpm build
```

- [ ] **Step 6: Commit**:

```bash
rtk git add components/board/scrollmeter/QuietTrack.tsx components/board/scrollmeter/QuietTrack.module.css components/board/ScrollMeter.tsx components/board/ScrollMeter.test.tsx
rtk git commit -m "feat(meter): quiet 'line' variant (QuietTrack) for the flat theme"
```

---

### Task 4: 静かな motion `'fade'` 【Sonnet】

**Files:**
- Modify: `lib/animation/tag-entry/index.ts`
- Modify: `lib/animation/tag-shutdown/index.ts`
- Create: `lib/animation/tag-shutdown/themes/flat.module.css`
- Test: `lib/animation/tag-entry` / `tag-shutdown` の既存テスト or 新規

**Interfaces:**
- Consumes: Task1 の motion `{ entry:'fade', text:'default', shutdown:'fade' }`。
- Produces: `getEntryAnimation('fade')`→定義／`getShutdownAnimationClass('fade')`→クラス。

- [ ] **Step 1: 失敗するテストを先に** — `lib/animation/tag-entry/index.test.ts`（無ければ新規）:

```ts
import { getEntryAnimation } from './index'
import { getShutdownAnimationClass } from '../tag-shutdown/index'

it('fade entry returns a gentle opacity+translateY keyframe set', () => {
  const a = getEntryAnimation('fade')
  expect(a).toBeDefined()
  expect(a!.keyframes[0].opacity).toBe('0')
  expect(a!.keyframes[a!.keyframes.length - 1].opacity).toBe('1')
})
it('fade shutdown returns a class', () => {
  expect(getShutdownAnimationClass('fade')).toBeTruthy()
})
```

- [ ] **Step 2: 失敗確認** — `rtk vitest run lib/animation/tag-entry` → FAIL（`'fade'` は default→undefined）。

- [ ] **Step 3: entry に fade を追加** — `lib/animation/tag-entry/index.ts` の `case 'paper-drift'` の後、`default` の前に:

```ts
    case 'fade': {
      // FLAT theme entry: a calm opacity fade with a tiny lift. No colour flash,
      // no glitch, minimal amplitude (light editorial + 4K fill-rate budget).
      // Values read from the flat block --flat-fade-* with safe fallbacks.
      const duration = readCssVar('--flat-fade-duration', 420)
      const easing = readCssVarRaw('--flat-fade-easing', 'cubic-bezier(0.16, 1, 0.3, 1)')
      const offsetY = readCssVar('--flat-fade-offset-y', 6)
      const staggerStepMs = readCssVar('--flat-fade-stagger-step', 16)
      const staggerCapMs = readCssVar('--flat-fade-stagger-cap', 320)
      return {
        keyframes: [
          { offset: 0, transform: `translateY(${offsetY}px)`, opacity: '0' },
          { offset: 1, transform: 'translateY(0)', opacity: '1' },
        ],
        options: { duration, easing, fill: 'none' },
        staggerStepMs,
        staggerCapMs,
      }
    }
```

- [ ] **Step 4: shutdown の fade クラスを作る** — `lib/animation/tag-shutdown/themes/flat.module.css`:

```css
/* FLAT theme MOTION-off shutdown: a calm fade-out (mirror of the fade entry). */
.fade {
  animation: flat-fade-out 320ms cubic-bezier(0.4, 0, 1, 1) forwards;
}
@keyframes flat-fade-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(4px); }
}
```

`lib/animation/tag-shutdown/index.ts` を:

```ts
import waveStyles from './themes/wave.module.css'
import paperStyles from './themes/paper.module.css'
import flatStyles from './themes/flat.module.css'

export type SupportedTheme = 'wave' | 'paper-fade' | 'fade'

export function getShutdownAnimationClass(theme: string): string | undefined {
  switch (theme) {
    case 'wave':
      return waveStyles.shutdown
    case 'paper-fade':
      return paperStyles.fade
    case 'fade':
      return flatStyles.fade
    default:
      return undefined
  }
}
```

（entry 側 `SupportedTheme` にも `'fade'` を足す＝`'wave' | 'paper-drift' | 'fade'`。）

- [ ] **Step 5: 検証**:

```bash
rtk vitest run lib/animation
rtk tsc && pnpm build
```

- [ ] **Step 6: Commit**:

```bash
rtk git add lib/animation/tag-entry/index.ts lib/animation/tag-shutdown/index.ts lib/animation/tag-shutdown/themes/flat.module.css lib/animation/tag-entry/index.test.ts
rtk git commit -m "feat(motion): gentle 'fade' entry/shutdown for the flat theme"
```

---

### Task 5: TUNE のフラット皮（scoped CSS 上書き） 【Sonnet】

**Files:**
- Modify: `components/board/FaderColumn.module.css`
- Modify: `components/board/TunePresetColumn.module.css`
- Modify: `components/board/TuneTrigger.module.css`
- Test: `tests/e2e/board-theme.spec.ts`

**Interfaces:**
- Consumes: Task1/2（flat 選択で `data-theme-id="flat"`＋白パネルトークン）。
- Produces: TUNE を開いた時のフラット見た目。**全て `:global(html[data-theme-id="flat"])` scoped＝音/紙/Grid はバイト同一**。

> 手段の掟: 各 `.module.css` の末尾に flat-scoped ブロックを**追記**する。既存ルールは1文字も変えない（既定バイト同一）。CSS Modules のローカルクラス名を `:global()` 内で参照する時は `:global(html[data-theme-id="flat"]) .localClass` の形（前半 global・後半ローカル）。

- [ ] **Step 1: FaderColumn を再皮** — `components/board/FaderColumn.module.css` の末尾に:

```css
/* ── Flat theme skin: thin rail + flat round handle, no metal / grip / 42-tick ── */
:global(html[data-theme-id="flat"]) .track {
  width: 3px;
  background: rgba(20, 19, 15, 0.14);
  box-shadow: none;
  border-radius: 2px;
}
:global(html[data-theme-id="flat"]) .handle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(20, 19, 15, 0.20);
  box-shadow: 0 2px 6px -1px rgba(20, 19, 15, 0.3);
}
:global(html[data-theme-id="flat"]) .handle::before { display: none; }         /* grip ridges off */
:global(html[data-theme-id="flat"]) .handle::after {                            /* index line → center dot */
  left: 50%;
  right: auto;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(20, 19, 15, 0.9);
  box-shadow: none;
  transform: translate(-50%, -50%);
}
:global(html[data-theme-id="flat"]) .ruler .tick { display: none; }             /* hide the 42-tick radio ruler */
:global(html[data-theme-id="flat"]) .defaultMark { background: rgba(20, 19, 15, 0.35); box-shadow: none; }
:global(html[data-theme-id="flat"]) .label { color: rgba(20, 19, 15, 0.55); }
/* fillMark green stays (§spec: そろえ点の緑は明背景でも見える) — no override */
```

- [ ] **Step 2: TunePresetColumn を再皮** — `components/board/TunePresetColumn.module.css` の末尾に:

```css
/* ── Flat theme skin: dot-selected preset rows + iOS toggle for CORNERS ── */
/* status LED → simple dot */
:global(html[data-theme-id="flat"]) .led {
  background: transparent;
  border: 1.5px solid rgba(20, 19, 15, 0.35);
  box-shadow: none;
}
:global(html[data-theme-id="flat"]) .ledOn {
  background: #28f100;
  border-color: #1c9a00;
  box-shadow: 0 0 0 3px rgba(40, 241, 0, 0.14);
}
/* preset rows: hide the metal lever (the dot carries selection); tint the active row */
:global(html[data-theme-id="flat"]) .presetRow .lever { display: none; }
:global(html[data-theme-id="flat"]) .presetRow:has(.ledOn) {
  background: rgba(20, 19, 15, 0.05);
  border-radius: 9px;
}
:global(html[data-theme-id="flat"]) .label { color: rgba(20, 19, 15, 0.78); }
:global(html[data-theme-id="flat"]) .maker { display: none; }
:global(html[data-theme-id="flat"]) .cornerState { color: rgba(20, 19, 15, 0.4); }
:global(html[data-theme-id="flat"]) .cornerStateOn { color: #1c9a00; }
/* CORNERS row: turn the lever cell into an iOS toggle */
:global(html[data-theme-id="flat"]) .cornersRow { border-top-color: rgba(20, 19, 15, 0.10); }
:global(html[data-theme-id="flat"]) .cornersRow .lever {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(20, 19, 15, 0.16);
  border: none;
  box-shadow: none;
}
:global(html[data-theme-id="flat"]) .cornersRow .lever::before,
:global(html[data-theme-id="flat"]) .cornersRow .lever::after { display: none; }
:global(html[data-theme-id="flat"]) .cornersRow .lever .handle {
  display: block;
  left: 2px;
  right: auto;
  top: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}
:global(html[data-theme-id="flat"]) .cornersRow .lever.leverDown { background: #28f100; }
:global(html[data-theme-id="flat"]) .cornersRow .lever.leverDown .handle { top: 2px; left: 18px; }
:global(html[data-theme-id="flat"]) .cornersRow .lever.leverDown .handle::before { display: none; }
```

> `.presetRow:has(.ledOn)` は `:has()`（modern Chromium/Safari で可・本アプリのターゲット）。効かない環境でもドット(ledOn)が選択を示すので機能は落ちない。

- [ ] **Step 3: TuneTrigger を再皮** — `components/board/TuneTrigger.module.css` の末尾に:

```css
/* ── Flat theme skin: white drawer, hairline divider, quiet ops legend ── */
:global(html[data-theme-id="flat"]) .drawer {
  background: var(--chrome-panel-surface, rgba(255, 255, 255, 0.97));
  border: 1px solid var(--chrome-panel-border, rgba(20, 19, 15, 0.10));
  border-radius: var(--chrome-panel-radius, 14px);
  backdrop-filter: blur(var(--chrome-panel-blur, 8px));
  -webkit-backdrop-filter: blur(var(--chrome-panel-blur, 8px));
}
:global(html[data-theme-id="flat"]) .drawer[data-open='true'] {
  box-shadow: var(--chrome-panel-shadow, 0 22px 60px -22px rgba(20, 19, 15, 0.28));
}
:global(html[data-theme-id="flat"]) .drawerDivider {
  background: var(--chrome-panel-border, rgba(20, 19, 15, 0.10));
  box-shadow: none;
}
/* readout numbers on the trigger button → ink on light */
:global(html[data-theme-id="flat"]) .cell.num { color: #1c9a00; }
:global(html[data-theme-id="flat"]) .cell.dim { color: rgba(20, 19, 15, 0.3); }
:global(html[data-theme-id="flat"]) .cell.reset { color: rgba(20, 19, 15, 0.85); }
:global(html[data-theme-id="flat"]) .cell.reset.resetIdle { color: rgba(20, 19, 15, 0.35); }
/* ops legend → quiet muted hints (no domed LEDs) */
:global(html[data-theme-id="flat"]) .opsLegend { border-top-color: rgba(20, 19, 15, 0.10); }
:global(html[data-theme-id="flat"]) .led {
  background-color: rgba(20, 19, 15, 0.3);
  background-image: none;
  box-shadow: none;
  width: 5px;
  height: 5px;
}
:global(html[data-theme-id="flat"]) .opsText { color: rgba(20, 19, 15, 0.5); }
```

> 注: `.trigger` の RGB glitch（hover/grab）は sound の言語。flat の `--chrome-hover-fx: none` は将来 JS 皮で参照する布石（本 Task では `.trigger::before/::after` の glitch は据え置き＝ボタン文字色は明色縁反転で暗インクになるので大枠 OK）。glitch が気になれば follow-up で flat-scoped に抑制。

- [ ] **Step 4: e2e で TUNE 皮を固定** — `tests/e2e/board-theme.spec.ts` に:

```ts
test('flat TUNE drawer wears the white flat skin', async ({ page }) => {
  await prepBoard(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'flat'))
  // hover-open the TUNE drawer
  await page.getByTestId('tune-wrap').hover()
  const drawer = page.getByTestId('tune-drawer')
  await expect.poll(async () =>
    drawer.evaluate((el) => getComputedStyle(el).backgroundColor)
  , { timeout: 5000 }).toMatch(/255, 255, 255/)
})
```

> ⚠️ TUNE は hover 開閉（clickでは開かない・[TuneTrigger.tsx](../../../components/board/TuneTrigger.tsx) `handleMouseEnter`）。Playwright の `hover()` で `data-open='true'` になる。開閉アニメ(max-height 0.5s)後に背景を測るため `expect.poll`。

- [ ] **Step 5: 検証（音/紙が不変なことも）**:

```bash
npx playwright test tests/e2e/board-theme.spec.ts
rtk tsc && rtk vitest run && pnpm build
```

Expected: flat TUNE テスト PASS。`default theme is unchanged`＋`paper-atelier tokens apply` PASS（scoped ゆえ無影響）。

- [ ] **Step 6: Commit**:

```bash
rtk git add components/board/FaderColumn.module.css components/board/TunePresetColumn.module.css components/board/TuneTrigger.module.css tests/e2e/board-theme.spec.ts
rtk git commit -m "feat(tune): flat-scoped TUNE skin (thin faders, dot presets, iOS corners, quiet legend)"
```

---

### Task 6: 全ゲート＋ドキュメント＋デプロイ 【Sonnet】

**Files:** docs のみ変更（+ 検証）。

- [ ] **Step 1: 全ゲート**:

```bash
rtk tsc && rtk vitest run && pnpm build
npx playwright test tests/e2e/board-theme.spec.ts tests/e2e/chrome-skin-tokens.spec.ts
```

Expected: tsc0／vitest 全緑（flat registry/customization/ScrollMeter/motion）／build OK／e2e 緑（flat 適用・反転・メーター・TUNE＋既定バイト同一）。

- [ ] **Step 2: 親 spec とロードマップを更新** — `docs/superpowers/specs/2026-07-14-theme-scope-principle-design.md` §7 の「★実装状況」に「サブ2 出荷済（flat theme + flat TUNE skin）」を追記。`docs/TODO.md` 現在の状態と `docs/CURRENT_GOAL.md` を次（サブ3 Grid/紙の TUNE 皮 or C2）に更新。

- [ ] **Step 3: Commit**:

```bash
rtk git add docs
rtk git commit -m "docs(sub2): flat theme shipped — update spec status, TODO, CURRENT_GOAL"
```

- [ ] **Step 4: merge --no-ff → デプロイ** — 統括 Opus の全ブランチレビュー Ready 後:

```bash
rtk git checkout master && rtk git merge --no-ff theme-sub2-flat
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 5: 実機確認を依頼** — ユーザーに「`allmarks.app` をハードリロード → SETTINGS → THEMES → **Flat** を選ぶ → 盤面が白エディトリアルになり、TUNE を開くと白い清潔なパネル（金属ミキサーでない）／メーターは下の帯で静かな目盛り／数字は静止」を確認してもらう。既定（Sound Wave）に戻すと従来どおり暗い金属ミキサーであることも。

---

## Self-Review

**1. Spec coverage（設計 spec §3 の各ピース → タスク対応）:**
- A テーマ登録（7点契約）→ Task 1（types/registry/customization/themes.css/i18n）✓
- B CUSTOMIZE 既定 → Task 1 Step5 ✓（明色スウォッチ追加は spec §8 どおり follow-up と明記）
- C chrome スキン（sub1 トークン設定＋TUNE 内部 scoped 上書き）→ Task 2（globals）＋Task 5（TUNE）✓
- D 明色縁 chrome 反転（旧 Task 4）→ Task 2 Step4（`DARK_CHROME_RESET` を colorScheme で gate）✓
- E 静音メーター `'line'` → Task 3 ✓
- F motion `'fade'` → Task 4 ✓
- G 背景ワードマーク（serif ink）→ Task 2 の flat ブロック（`--bg-typo-font`/`--bg-typo-color`）✓
- H i18n ラベル → Task 1 Step7 ✓
- I テスト → 各 Task のテスト＋Task 6 ゲート ✓

**2. Placeholder scan:** 各 Step にコード実体あり（"TBD/後で" なし）。「visual tuning at review」の余地はあるが CSS 実体は全て記載＝実装可能。i18n の15ファイル列挙済。

**3. Type consistency:** `ThemeId`+'flat'／`scrollMeterVariant`+'line'（Task1）は Task2/3 が参照。`getEntryAnimation('fade')`/`getShutdownAnimationClass('fade')`（Task4）は registry の `motion.{entry,shutdown}`='fade'（Task1）と一致。`QuietTrack`（Task3）の `markerRef` prop は `RulerTrack` と同契約。`themeMeta.colorScheme`（Task2 の gate）は既存フィールド。整合。

**既知の限界（spec §7/§8 に整合・非ブロッキング）:**
- flat の CUSTOMIZE でユーザーが**暗い縁色**を手選択すると縁帯 chrome が暗×暗になりうる（`isLightColor`=false で `LIGHT_EDGE_CHROME` 不発）。deliberate・可逆・RESET 有り。対称の「暗縁→明 chrome」反転は follow-up。
- 明色スウォッチのプリセット追加＝follow-up（本 plan は共有スウォッチを触らず音/Grid をバイト同一に保つ）。
- 受け取り画面(/s/)のフラット化＝サブ5。SHARE 画像(dom-to-image)は実 DOM を撮るのでフラット盤面がそのまま写る（明背景のコントラストは実機で確認）。
