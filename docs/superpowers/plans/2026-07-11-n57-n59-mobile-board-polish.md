# N-57 + N-59: スマホ盤面の小物2点（背景タイトル表示／列数・余白の簡易調整） 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to実行。Steps use checkbox (`- [ ]`) syntax.

**Goal:** (N-57) スマホの盤面に背景タイトル（ワードマーク）を出す — 「THEME からカスタマイズできるように見えるのに見えないのはおかしい」の解消。(N-59) スマホの列数（2/3/4）と余白（S/M/L）を MORE パネルから離散選択で変えられるようにする。

**Architecture:** N-57 は [BoardRoot.tsx](../../../components/board/BoardRoot.tsx):3213 の `!isMobile &&` ゲートを外すだけ＋モバイル用の文字サイズ緩和（現行 `clamp(96px,14vw,260px)` の 96px 床は 390px 画面では過大）。N-59 は `MOBILE_LAYOUT` ベタ書き定数（`lib/board/constants.ts:58-69`）を「BoardConfig の新 2 フィールド＋純関数」で上書き可能にする。永続化は既存 `board-config`（IDB `settings` ストアの JSON 塊）＝ **DB バージョン上げ不要**（`roundedCorners` と同じ器・`loadBoardConfig` が欠損キーを既定値で埋める）。

**Tech Stack:** Next.js 14 / TypeScript strict / CSS Modules / vitest / Playwright

## 事実の索引（s186 調査済み）

- N-57 ゲート: `BoardRoot.tsx:3213` `{!isMobile && sharePhase !== 'arrange' && bgTypoMount && (<BoardBackgroundTypography …/>)}`。文字は `deriveBoardBgTypoText`（'AllMarks'／タグ名 ' · ' 連結）、色は `.outerFrame` の `--bg-typo-color`（`resolvedCustom.titleColor` 由来、BoardRoot.tsx:2891）
- 文字サイズ: `BoardBackgroundTypography.module.css:31` `font-size: clamp(96px, 14vw, 260px)`、`max-width:95vw`、`text-wrap:balance`
- **共有画像には写らない**（ゲートに `sharePhase !== 'arrange'` が残る＝撮影は arrange 中。デスクトップも同じ挙動＝プラットフォーム間で一貫。`setShareTitle(null)` も現状維持）
- N-59 の消費地点は 5 箇所: `BoardRoot.tsx:1079`（SIDE_MARGIN）/ `:1083-1084`（COLUMNS+GAP→カード幅）/ `:1089`（GAP）、受け取り側 `SharedBoard.tsx:284-288,557`（**受け取りは触らない**＝閲覧者の既定値のまま）
- BoardConfig の型: `lib/board/types.ts:153-174`／既定値: `lib/storage/board-config.ts:10-18`／保存ハンドラの雛形: `handleToggleRoundedCorners`（`BoardRoot.tsx:2026-2036`・read-modify-write）
- MORE パネルの VIEW 節（モバイル専用・MOTION 行が雛形）: `ExtensionEntry.tsx:227-241`。`{motion && (…)}` ゲート＝BoardRoot が isMobile の時だけ `motion` prop を渡す（`BoardRoot.tsx:3065`）

## Global Constraints

- デスクトップ（>640px）は 1px も変えない。すべて `isMobile` / `@media (max-width:640px)` の内側
- UI 文言は英語（`COLUMNS` / `SPACING` / `S` `M` `L`）。i18n キーは足さない（board chrome は英語リテラル）
- 保存値の既定は**現行値**（3列・gap14・左右16）＝アップグレードしても見た目が 1px も変わらないこと
- IDB スキーマ変更禁止（`board-config` JSON 塊のみ）。DB_VERSION を上げない
- TypeScript strict / return type 明示 / `rtk` 前置 / `--no-verify` 禁止

---

## Part A: N-57 背景タイトルをスマホに出す

### Task A1: ゲート除去＋モバイル文字サイズ 【Haiku 可】

**Files:**
- Modify: `components/board/BoardRoot.tsx`（:3213 の 1 箇所）
- Modify: `components/board/BoardBackgroundTypography.module.css`

- [ ] **Step 1: ゲートを外す**

`BoardRoot.tsx:3213` の

```tsx
      {!isMobile && sharePhase !== 'arrange' && bgTypoMount && (
```

を

```tsx
      {sharePhase !== 'arrange' && bgTypoMount && (
```

に変更（`isMobile` への参照はこの行から消えるだけ。他は不変）。

- [ ] **Step 2: モバイルの文字サイズ床を下げる**

`BoardBackgroundTypography.module.css` の `.text` ブロックの後に追加:

```css
/* N-57: スマホは 96px 床が画面幅(390px)に対して過大なので床と天井を下げる。
   14vw の連続スケールは共通のまま（390px → 54.6px ≒ 2〜3 語で 1〜2 行）。
   デスクトップ（>640px）はこのブロックに一切触られない。 */
@media (max-width: 640px) {
  .text {
    font-size: clamp(40px, 14vw, 96px);
  }
}
```

- [ ] **Step 3: 検証（Playwright 実測＋回帰）**

```bash
rtk tsc && rtk vitest run && pnpm build
```

Playwright（`playwright-skill` の一時スクリプトで可）:
1. 390×844・IDB preseed（`tests/e2e/mobile-share.spec.ts` の `seedBoard` を流用）で `/board` を開き、`.host`（BoardBackgroundTypography のルート）が可視・textContent が `AllMarks` であること、`getComputedStyle(...).fontSize` が `54.6px` 近辺であることを実測。スクショ保存。
2. 1489×679 デスクトップのスクショで従来と同見え（このタスクの変更は media query 内＋モバイル専用ゲート解除のみ）。

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/BoardBackgroundTypography.module.css
rtk git commit -m "feat(board): show the background wordmark on mobile (N-57)"
```

**ユーザー確認事項（デプロイ後・実機）**: 文字の大きさの好み（40〜96px クランプは提案値）。THEME → CUSTOMIZE の TITLE 色変更が反映されて見えること。**共有画像にタイトルは写らない**（デスクトップと同じ）ことの了解。

---

## Part B: N-59 列数・余白の簡易調整

### Task B1: プリセットの純関数と BoardConfig 拡張 【Haiku 可】

**Files:**
- Create: `lib/board/mobile-layout-presets.ts`
- Test: `lib/board/mobile-layout-presets.test.ts`
- Modify: `lib/board/types.ts`（BoardConfig に 2 フィールド）
- Modify: `lib/storage/board-config.ts`（DEFAULT_BOARD_CONFIG に既定値）

**Interfaces:**
- Produces:
  - `type MobileColumns = 2 | 3 | 4`
  - `type MobileGapPreset = 'small' | 'medium' | 'large'`
  - `mobileLayoutValues(gap: MobileGapPreset): { readonly gapPx: number; readonly sideMarginPx: number }`
  - `BoardConfig` 追加: `readonly mobileColumns: MobileColumns` / `readonly mobileGap: MobileGapPreset`

- [ ] **Step 1: Write the failing test**

`lib/board/mobile-layout-presets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MOBILE_LAYOUT } from './constants'
import { mobileLayoutValues } from './mobile-layout-presets'

describe('mobileLayoutValues', () => {
  it('medium equals the shipped MOBILE_LAYOUT values (upgrade changes nothing)', () => {
    expect(mobileLayoutValues('medium')).toEqual({
      gapPx: MOBILE_LAYOUT.GAP_PX,          // 14
      sideMarginPx: MOBILE_LAYOUT.SIDE_MARGIN_PX, // 16
    })
  })

  it('small tightens both, large loosens both', () => {
    expect(mobileLayoutValues('small')).toEqual({ gapPx: 8, sideMarginPx: 12 })
    expect(mobileLayoutValues('large')).toEqual({ gapPx: 22, sideMarginPx: 24 })
  })
})
```

- [ ] **Step 2: Run（FAIL 確認）**

```bash
rtk npx vitest run lib/board/mobile-layout-presets.test.ts
```

- [ ] **Step 3: Implement**

`lib/board/mobile-layout-presets.ts`:

```ts
// lib/board/mobile-layout-presets.ts
// N-59: スマホの列数・余白は連続スライダーでなく離散プリセット（迷わない・
// 指で確実）。'medium' は出荷時の MOBILE_LAYOUT と同値 = 既存ユーザーの見た目を
// 1px も変えないアップグレード安全弁。

import { MOBILE_LAYOUT } from './constants'

export type MobileColumns = 2 | 3 | 4

export type MobileGapPreset = 'small' | 'medium' | 'large'

export function mobileLayoutValues(gap: MobileGapPreset): {
  readonly gapPx: number
  readonly sideMarginPx: number
} {
  switch (gap) {
    case 'small':
      return { gapPx: 8, sideMarginPx: 12 }
    case 'medium':
      return { gapPx: MOBILE_LAYOUT.GAP_PX, sideMarginPx: MOBILE_LAYOUT.SIDE_MARGIN_PX }
    case 'large':
      return { gapPx: 22, sideMarginPx: 24 }
  }
}
```

`lib/board/types.ts` — `BoardConfig` の `roundedCorners` の後に追加（import: `import type { MobileColumns, MobileGapPreset } from './mobile-layout-presets'`）:

```ts
  /** スマホ盤面の列数（N-59）。表示時 override のみ・デスクトップ非影響。 */
  readonly mobileColumns: MobileColumns
  /** スマホ盤面の余白プリセット（N-59）。'medium' = 出荷時と同値。 */
  readonly mobileGap: MobileGapPreset
```

`lib/storage/board-config.ts` — `DEFAULT_BOARD_CONFIG` に追加:

```ts
  mobileColumns: 3,
  mobileGap: 'medium',
```

- [ ] **Step 4: Run to verify（型崩れが波及しないこと）**

```bash
rtk npx vitest run lib/board/mobile-layout-presets.test.ts
rtk tsc
```

※ `tsc` で `DEFAULT_BOARD_CONFIG` 以外に BoardConfig を丸ごと構築している箇所（テスト内のリテラル等）がエラーになったら、その箇所にも 2 フィールドを足す（既定値と同値で）。

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/mobile-layout-presets.ts lib/board/mobile-layout-presets.test.ts lib/board/types.ts lib/storage/board-config.ts
rtk git commit -m "feat(board): mobile column/gap presets in BoardConfig (N-59)"
```

### Task B2: MORE パネルに COLUMNS / SPACING の行を追加 【Haiku 可】

**Files:**
- Modify: `components/board/ExtensionEntry.tsx`
- Modify: `components/board/ExtensionEntry.module.css`
- Test: `components/board/ExtensionEntry.test.tsx`（存在すれば追記。無ければ新規は不要＝B3 の e2e が担保）

**Interfaces:**
- Produces: `ExtensionEntry` の新 prop（`motion` と同様に**モバイル時のみ** BoardRoot が渡す）:

```ts
  /** N-59: スマホの列数・余白プリセット。モバイル時のみ渡される（VIEW 節に描画）。 */
  readonly mobileLayout?: {
    readonly columns: MobileColumns
    readonly onColumns: (c: MobileColumns) => void
    readonly gap: MobileGapPreset
    readonly onGap: (g: MobileGapPreset) => void
  }
```

- [ ] **Step 1: VIEW 節に 2 行追加**

`ExtensionEntry.tsx:227-241` の VIEW 節を拡張（ゲートを `{(motion || mobileLayout) && (` に変え、MOTION の label は `{motion && (…)}` で包む）。MOTION 行の下に:

```tsx
            {mobileLayout && (
              <>
                <div className={styles.segmentedRow}>
                  <span className={styles.toggleLabel}>COLUMNS</span>
                  <div className={styles.segments} role="group" aria-label="Columns">
                    {([2, 3, 4] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={styles.segmentBtn}
                        data-active={mobileLayout.columns === c ? 'true' : 'false'}
                        onClick={(): void => mobileLayout.onColumns(c)}
                        data-testid={`mobile-columns-${c}`}
                      >{c}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.segmentedRow}>
                  <span className={styles.toggleLabel}>SPACING</span>
                  <div className={styles.segments} role="group" aria-label="Spacing">
                    {(['small', 'medium', 'large'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={styles.segmentBtn}
                        data-active={mobileLayout.gap === g ? 'true' : 'false'}
                        onClick={(): void => mobileLayout.onGap(g)}
                        data-testid={`mobile-gap-${g}`}
                      >{g === 'small' ? 'S' : g === 'medium' ? 'M' : 'L'}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
```

import 追加: `import type { MobileColumns, MobileGapPreset } from '@/lib/board/mobile-layout-presets'`

- [ ] **Step 2: CSS**

`ExtensionEntry.module.css` に追記（`.toggleRow` の隣。既存の `.toggleRow`/`.toggleLabel` のフォント・行高の値を**読んで揃える**こと）:

```css
/* N-59: 離散プリセットの行（COLUMNS 2/3/4・SPACING S/M/L）。 */
.segmentedRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
}

.segments {
  display: flex;
  gap: 6px;
}

.segmentBtn {
  min-width: 44px;
  min-height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.segmentBtn[data-active='true'] {
  border-color: rgba(255, 255, 255, 0.85);
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 3: Commit**

```bash
rtk git add components/board/ExtensionEntry.tsx components/board/ExtensionEntry.module.css
rtk git commit -m "feat(board): COLUMNS / SPACING preset rows in the MORE panel (N-59)"
```

### Task B3: BoardRoot 配線（state・保存・レイアウト適用）＋e2e 【Sonnet 推奨】

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Create: `tests/e2e/mobile-layout.spec.ts`

- [ ] **Step 1: state + hydrate**

`roundedCorners` の useState（BoardRoot.tsx:278 近辺）の隣に:

```ts
  const [mobileColumns, setMobileColumns] = useState<MobileColumns>(3)
  const [mobileGap, setMobileGap] = useState<MobileGapPreset>('medium')
```

IDB 反映（`setRoundedCorners(cfg.roundedCorners)`（:805-810 近辺）の隣）:

```ts
        setMobileColumns(cfg.mobileColumns)
        setMobileGap(cfg.mobileGap)
```

import: `import { mobileLayoutValues, type MobileColumns, type MobileGapPreset } from '@/lib/board/mobile-layout-presets'`

- [ ] **Step 2: 保存ハンドラ（`handleToggleRoundedCorners`（:2026-2036）の写し）**

```ts
  const handleSetMobileColumns = useCallback((c: MobileColumns): void => {
    setMobileColumns(c)
    void (async (): Promise<void> => {
      const db = await initDB()
      const cfg = await loadBoardConfig(db)
      await saveBoardConfig(db, { ...cfg, mobileColumns: c })
    })()
  }, [])

  const handleSetMobileGap = useCallback((g: MobileGapPreset): void => {
    setMobileGap(g)
    void (async (): Promise<void> => {
      const db = await initDB()
      const cfg = await loadBoardConfig(db)
      await saveBoardConfig(db, { ...cfg, mobileGap: g })
    })()
  }, [])
```

- [ ] **Step 3: レイアウト計算 3 箇所を state 駆動に**

1. `:1079`: `const layoutSidePaddingPx = isMobile ? mobileLayoutValues(mobileGap).sideMarginPx : BOARD_INNER.SIDE_PADDING_PX`
2. `:1083-1084`（`mobileCardWidth` の useMemo 内）: `const cols = mobileColumns` / `const gap = mobileLayoutValues(mobileGap).gapPx` を使い `(effectiveLayoutWidth - (cols - 1) * gap) / cols`。**useMemo の依存配列に `mobileColumns` / `mobileGap` を追加**
3. `:1089`: `const layoutCardGapPx = isMobile ? mobileLayoutValues(mobileGap).gapPx : cardGapPx`

`MOBILE_LAYOUT` の直接参照がこの 3 箇所から消えること（`CANVAS_MARGIN_PX` と受け取り側 SharedBoard の参照は**残す**）。

- [ ] **Step 4: ExtensionEntry へ prop（`motion` を渡している :3065 近辺）**

```tsx
            mobileLayout={isMobile ? {
              columns: mobileColumns,
              onColumns: handleSetMobileColumns,
              gap: mobileGap,
              onGap: handleSetMobileGap,
            } : undefined}
```

- [ ] **Step 5: e2e**

`tests/e2e/mobile-layout.spec.ts`（`seedBoard`・viewport 390×844 は `tests/e2e/mobile-share.spec.ts:21-62,74` の流儀をコピー）:

```ts
test('COLUMNS preset changes the card width and survives a reload', async ({ page }) => {
  await seedBoard(page)
  const widthAt = async (): Promise<number> => {
    const box = await page.locator('[data-card-id]').first().boundingBox()
    return box?.width ?? 0
  }
  const w3 = await widthAt() // 3列: (390-32-2*14)/3 ≈ 110
  await page.getByTestId('mobile-nav-settings').tap()   // MORE（testid は BoardMobileNav.tsx で確認・違えば合わせる）
  await page.getByTestId('mobile-columns-2').tap()
  await page.keyboard.press('Escape')                   // ドロワーを閉じる（閉じ方は ExtensionEntry の作法に合わせる）
  const w2 = await widthAt() // 2列: (390-32-14)/2 = 172
  expect(w2).toBeGreaterThan(w3 * 1.4)
  await page.reload()
  await page.locator('[data-card-id]').first().waitFor()
  expect(await widthAt()).toBeCloseTo(w2, 0)
})
```

※ MORE タブの testid とドロワーの閉じ方は実装を読んで合わせる（`BoardMobileNav.tsx:133-142` / `ChromeDrawer`）。

- [ ] **Step 6: 検証一式 → Commit**

```bash
rtk tsc && rtk vitest run && pnpm build
npx playwright test tests/e2e/mobile-layout.spec.ts tests/e2e/mobile-share.spec.ts
rtk git add components/board/BoardRoot.tsx tests/e2e/mobile-layout.spec.ts
rtk git commit -m "feat(board): wire mobile COLUMNS/SPACING presets to layout + IDB (N-59)"
```

---

## 仕上げ（Part A+B 共通）

- [ ] デプロイ: `pnpm build && npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- [ ] ユーザー実機確認: ①ワードマークの見え・大きさの好み ②COLUMNS 2/3/4 と SPACING S/M/L の効き・リロード永続 ③デスクトップ 1489 が従来どおり
- [ ] **受け取り画面（/s/<id>）を必ず確認**（恒久ルール）: この計画は受け取り側を触らないが、目視で崩れがないこと
- [ ] TODO.md 更新（N-57 / N-59 を完了へ、ユーザー判断待ち事項を記録）

## Self-Review 済みの注意点

- N-59 の既定値（3 / medium）は出荷時と同値 → 既存ユーザーの盤面は**アップグレード後も 1px も変わらない**（B1 のテストが `MOBILE_LAYOUT` との同値を固定）。
- 受け取り画面（SharedBoard）は意図的に定数のまま＝送信者の好みを閲覧者に強制しない。将来共有データに載せたくなったら別議論（スキーマ変更を伴う）。
- N-57 で `bgTypoEnabled`（SETTINGS の既存トグル）が OFF のユーザーはスマホでも出ない — 正しい挙動（同じスイッチが両方を制御）。
- 4 列 + large の組み合わせでカード幅 ≈ (390−48−66)/4 ≈ 69px — 成立はするが窮屈。プリセットの組を制限するかはユーザーの実機の感想を聞いてから。
