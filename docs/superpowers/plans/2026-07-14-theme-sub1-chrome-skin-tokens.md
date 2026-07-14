# 実装計画 — サブ1: chrome 骨/皮の基盤（テーマスキン・トークン系＋中立フォールバック＋抜けゼロ検査）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development でタスク単位に実装。各 Step は checkbox（`- [ ]`）。**実装モデル＝Sonnet 推奨**（BoardRoot/chrome 芯・バイト維持の判断が要る）。統括＝Opus（per-task レビュー＋全ブランチレビュー→マージ）。
> **親 spec:** [2026-07-14-theme-scope-principle-design.md](../specs/2026-07-14-theme-scope-principle-design.md) §2-2, §7 サブ1。
> **前提事実（調査済み・s196）:** chrome は現状トークン未使用のダークガラス+mono ハードコード。ミキサーは全テーマ共通の既定。右ドロワー(ChromeDrawer)=SETTINGS/THEMES のみ、TUNE=横型ホバー(TuneTrigger 独自)。

## Goal

chrome（メニュー類）が**テーマのスキン・トークンで一貫して着替わる**土台を作る。①chrome スキントークンを `:root` に中立既定で定義②各 chrome の直書き値を `var(--chrome-*, 現行既定)` に置換（**既定テーマは1px も変わらない＝バイト維持**）③音テーマ(dotted-notebook)に「ミキサー皮」トークンブロックを定義（＝ミキサーを音の皮として明示的に格納）④「全テーマ×全 chrome パネルが描画される」抜けゼロ検査を固定。**この計画では新しい皮のビジュアルは作らない**（それはサブ2/3）。ここは"皮を着られる配線"だけ。

## Architecture

- **器は統合しない**（親 spec 2-2）: TUNE=横型ホバー(TuneTrigger)、SETTINGS/THEMES=右ドロワー(ChromeDrawer) のまま。**共通なのは"スキン・トークン"**（`--chrome-*`）で、各器がそれを読む。
- **中立フォールバック = 現行の見た目**: `var(--chrome-panel-surface, rgba(12,12,12,0.94))` のように**第2引数に現行ハードコード値**を置く。テーマが `--chrome-panel-surface` を定義しなければ現行どおり＝**未対応テーマでも崩れない（抜けゼロ）**。
- **皮の適用点は CSS 変数のみ**（この計画では）: JS 分岐（`chromeSkin` variant 等の構造差し替え）はサブ2/3 に回す。ここはトークン配線に限定＝低リスク。
- **音の皮 = dotted-notebook ブロック**: 現状 dotted-notebook は globals に専用ブロックが無い（`:root` 直依存）。ミキサーは既に全テーマ共通の既定なので、**「中立既定＝ミキサー」から「中立既定＝素の中立／音だけミキサートークン」へ寄せる**のは**サブ2 の "フラット中立皮" 実装まで保留**し、本計画は「トークン配線＋現行バイト維持＋音ブロックの器だけ用意」に留める（＝ミキサーの見た目は当面すべてのテーマで現状維持。皮の差し替えはサブ2/3 で1テーマずつ）。

## Global Constraints

- TypeScript `strict`。`any` 禁止。CSS は `.module.css`／トークンは `app/globals.css`。Tailwind/Framer Motion 禁止。
- **既定テーマ(dotted-notebook)選択時の chrome は本計画の前後でバイト同一**（トークン化は第2引数フォールバックが現行値と一致することを保証）。回帰は Playwright computed-style で固定。
- `rtk` 前置・`--no-verify` 禁止。vitest=`rtk vitest run <file>`、Playwright=素の `npx playwright test`。
- z-index は `lib/board/constants.ts` の `BOARD_Z_INDEX`（新規禁止・既存参照）。
- **触らない**（サブ1 スコープ外）: 盤面側 `ScrollMeter`/`RulerTrack`/`CardNode`/`BoardBackgroundTypography`/`decorations/`/`chrome/Paper*`、globals の paper 盤面トークン(fiber/wordmark/plate/wax)、`--paper-panel-*` の**定義削除**（SaveToast/PipStack が消費）。

## 事実の索引（調査済み・file:line）

- chrome 直書きの実体: `ChromeButton.module.css:2`(font mono),`:7`(color rgba(255,255,255,0.85)); `ChromeDrawer.module.css:8-27`(.panel 面); `TuneTrigger.module.css:201-224`(.drawer 面),`:17`(font); `ExtensionEntry.module.css`(全 mono/rgba); `ThemeModal/ThemePicker/ThemeCustomizeSection.module.css`; `FilterPill.module.css`。
- 死蔵/半死トークン: `--chrome-btn-*`=paper のみ(globals `:595-598`)・消費者ゼロ; `--chrome-text-*`=`:root`(`:354-359`)+paper、消費者は ScrollMeter/PrecisionSlider のみ; `--paper-panel-*`=paper(`:551-557`)、消費者 SaveToast/PipStack。
- 文字反転の未完成: `BoardRoot.tsx:176-199`(`LIGHT_EDGE_CHROME`/`DARK_CHROME_RESET`),`:3222`,`:3356` は `--chrome-btn-*`(死蔵)を注入＝現状ボタンに効かない。`:3354-3355` コメント「header components don't yet share one chrome token — see follow-up」。
- 既存の皮/ゲート前例: `PaperFramePlate`/`PaperWaxSeal` を `meta.decorations===true`(`theme-registry.ts:36`)で `BoardRoot.tsx:3235-3240` に描画; 検査 `components/board/chrome/PaperChrome.gating.test.tsx`。
- 旧 paper 皮の実例（トークンの使い方の参考）: `components/board/_archive/TuneClassicBody.module.css.txt`。
- テスト前例: `lib/board/theme-registry.test.ts`(全テーマループ), `tests/e2e/board-theme.spec.ts`(computed-style poll + localStorage), seed=`tests/e2e/helpers/seed-db.ts`。

---

### Task 1: chrome スキントークンを `:root` に中立既定で定義 【Sonnet】

**Files:** Modify `app/globals.css`

- [ ] **Step 1:** `:root`（既存の `--chrome-text-*` 群 `:354-359` の直後）に、chrome スキンの中立既定トークンを追加。**値は現行ハードコードと厳密一致**させる（バイト維持の要）:

```css
  /* ── chrome skin tokens（テーマが html[data-theme-id] で上書き。未定義＝この中立既定＝現行の見た目）── */
  --chrome-panel-surface: rgba(12, 12, 12, 0.94);   /* = ChromeDrawer .panel 現行 */
  --chrome-panel-border: rgba(255, 255, 255, 0.10); /* ChromeDrawer .panel 現行の border 値に合わせる（Step で現物確認） */
  --chrome-panel-radius: 16px;                       /* ChromeDrawer .panel 現行 */
  --chrome-panel-blur: 18px;                         /* 現行 backdrop-filter blur 値に合わせる */
  --chrome-panel-shadow: /* ChromeDrawer .panel 現行 box-shadow をそのまま */ ;
  --chrome-btn-color: rgba(255, 255, 255, 0.85);     /* = ChromeButton 現行 */
  --chrome-btn-hover: rgba(255, 255, 255, 1);
  --chrome-font: ui-monospace, "SF Mono", Consolas, monospace; /* = 現行 mono */
  --chrome-hover-fx: glitch;                          /* glitch | none（皮が静穏にしたい時 none） */
```

> ⚠️ Step 実装時に `ChromeDrawer.module.css:8-27`・`ChromeButton.module.css:2,7` の**現物の値を読み取り、トークン既定に1文字違わず写す**こと（border/blur/shadow は上のプレースホルダを現物で置換）。

- [ ] **Step 2:** 検証（この時点では消費者ゼロなので挙動不変）:

```bash
rtk tsc && rtk vitest run && pnpm build
```

- [ ] **Step 3:** Commit:

```bash
rtk git add app/globals.css
rtk git commit -m "feat(chrome): define neutral chrome skin tokens in :root (defaults = current hardcoded look)"
```

---

### Task 2: ChromeDrawer と ChromeButton をトークン参照に置換（バイト維持） 【Sonnet】

**Files:** Modify `components/board/ChromeDrawer.module.css`, `components/board/ChromeButton.module.css`

- [ ] **Step 1（失敗するテストを先に）:** `tests/e2e/chrome-skin-tokens.spec.ts` を新規作成。既定テーマ(dotted-notebook)で ChromeDrawer(SETTINGS を開く testid `extension-settings`→`extension-settings-drawer`)と ChromeButton の computed style を採取し、**トークン化前後で同値**を assert（バイト維持の回帰網）。seed=`seed-db.ts`。まず現行値をハードコードで期待値に置く（Task2 実装で var 化しても同値になるはず）。

```bash
npx playwright test tests/e2e/chrome-skin-tokens.spec.ts   # まず現行で緑（基準値の確定）
```

- [ ] **Step 2:** `ChromeDrawer.module.css:8-27` の `.panel` の background/border/border-radius/backdrop-filter/box-shadow/color を `var(--chrome-panel-*, 現行値)` / `var(--chrome-btn-color, ...)` に置換。`ChromeButton.module.css:2`(font-family→`var(--chrome-font, ...)`),`:7`(color→`var(--chrome-btn-color, ...)`)。**第2引数＝現行値**。
- [ ] **Step 3:** 再実行して**同値のまま緑**（＝バイト維持）を確認:

```bash
npx playwright test tests/e2e/chrome-skin-tokens.spec.ts
rtk tsc && rtk vitest run && pnpm build
```

- [ ] **Step 4:** Commit:

```bash
rtk git add components/board/ChromeDrawer.module.css components/board/ChromeButton.module.css tests/e2e/chrome-skin-tokens.spec.ts
rtk git commit -m "refactor(chrome): ChromeDrawer/ChromeButton read skin tokens (byte-identical fallback)"
```

---

### Task 3: 残り chrome の直書きをトークン化（ExtensionEntry / ThemeModal / ThemePicker / FilterPill / TuneTrigger 面） 【Sonnet】

**Files:** Modify 各 `.module.css`（`ExtensionEntry` / `ThemeModal` / `ThemePicker` / `ThemeCustomizeSection` / `FilterPill` / `TuneTrigger`）

- [ ] **Step 1:** 各モジュールの panel 面・ボタン面・font-family を Task1 のトークンに置換（第2引数＝現行値）。**注意**: `ThemePicker.module.css:16-27` は「paper serif の漏れ止め」で sans を明示 pin している＝この防御は**残す**（`--chrome-font` 導入後も未対応テーマで mono/sans が漏れないことを担保）。TuneTrigger は `.drawer` 面(`:201-224`)のみトークン化（**FaderColumn/TunePresetColumn の金属色＝ミキサー皮はサブ2/3 まで触らない**＝音の皮として現状維持）。
- [ ] **Step 2:** Step1 の e2e を各 chrome パネルにも拡張（THEMES=`open-theme-modal`→`theme-modal`、FilterPill、TUNE ホバー展開）＝全パネルでバイト維持を固定。
- [ ] **Step 3:** 検証:

```bash
npx playwright test tests/e2e/chrome-skin-tokens.spec.ts
rtk tsc && rtk vitest run && pnpm build
```

- [ ] **Step 4:** Commit `refactor(chrome): tokenize remaining chrome panels (byte-identical fallback)`.

---

### Task 4: 縁バンドの文字反転を実際に効くよう接続（既存バグの回収） 【Sonnet】

**Files:** Modify `components/board/BoardRoot.tsx`（176-199, 3222, 3356）

- [ ] **Step 1:** `LIGHT_EDGE_CHROME`/`DARK_CHROME_RESET`(`:176-199`) が注入するのは死蔵 `--chrome-btn-*`。Task1 で `:root` に生かしたので、**ライト edge のテーマ（将来のフラット/紙）で chrome 文字が黒インクに反転する**よう、注入トークンを実消費される `--chrome-btn-color`/`--chrome-text-*` に揃える。`:3354-3355` の follow-up コメントを解消。
- [ ] **Step 2:** e2e に「ライト colorScheme のテーマ選択時、chrome ボタンの色が反転する」ケースを追加（paper-atelier で computed color を採取）。既定ダークテーマは不変を維持。
- [ ] **Step 3:** 検証＋Commit `fix(chrome): light-edge chrome inversion now drives live tokens (was dead --chrome-btn-*)`.

---

### Task 5: 音テーマ(dotted-notebook)の chrome ブロックの器を用意 【Sonnet】

**Files:** Modify `app/globals.css`

- [ ] **Step 1:** `html[data-theme-id="dotted-notebook"] { ... }` ブロックを globals に新設（現状無い）。**中身は当面 `:root` 既定と同値**（＝音は現行どおり）だが、「音の皮はここに書く」という所番地を確定させる。コメントで「音（Sound Wave）テーマの chrome 皮＝ミキサー。サブ2 でフラット中立が入ったら、ミキサー固有トークンはこのブロックへ集約」と明記。
- [ ] **Step 2:** 検証（挙動不変）＋Commit `chore(chrome): reserve dotted-notebook chrome skin block (sound = mixer skin home)`.

---

### Task 6: 「全テーマ×全 chrome パネル描画」抜けゼロ検査 【Sonnet】

**Files:** Create `components/board/chrome-theme-coverage.test.tsx`

- [ ] **Step 1:** `theme-registry.test.ts` の全テーマループ＋`PaperChrome.gating.test.tsx` の render パターンを合成。`listThemeIds()` × 各 chrome パネル（ChromeDrawer 系は `isOpen` 強制 true でレンダ／TUNE は展開状態）を jsdom で render し、`document.documentElement.setAttribute('data-theme-id', id)` の下で**各 testid が必ず存在**することを assert（皮未定義テーマでも中立で描画＝抜けゼロ）。

```bash
rtk vitest run components/board/chrome-theme-coverage.test.tsx
```

- [ ] **Step 2:** Commit `test(chrome): every theme renders every chrome panel (no-gap guard)`.

---

### Task 7: ゲート一式＋ドキュメント更新 【Sonnet】

- [ ] **Step 1:** 全ゲート:

```bash
rtk tsc && rtk vitest run && pnpm build
npx playwright test tests/e2e/chrome-skin-tokens.spec.ts tests/e2e/board-theme.spec.ts
```

- [ ] **Step 2:** `lib/board/use-is-paper-theme.ts:12` の stale doc コメント（chrome を挙げている）を現状に更新 or 汎用 `useThemeId()` へ一般化（皮の JS 分岐用の下地）。
- [ ] **Step 3:** 親 spec §7 サブ1 に「完了・後続（サブ2 フラット皮／サブ3 Grid・紙皮）が読むトークン一覧」を追記。TODO.md 現在の状態を更新。
- [ ] **Step 4:** Commit → デプロイ（CLAUDE.md 手順）→ 実機で既定テーマの chrome が不変かユーザー確認依頼。

## Self-Review 済みの注意点（実装者へ）

- **バイト維持が最優先**: トークン第2引数は現物を1文字違わず。回帰は computed-style e2e で固定。既定テーマの見た目が変わったら失敗。
- **TUNE を右ドロワーに統合しない**（s172 でユーザーが横型を選好・親 spec 2-2）。TuneTrigger の器は不変、面のトークン化のみ。
- **ミキサーの見た目差し替えはこの計画に含めない**（サブ2/3）。ここは配線のみ＝低リスク。リテラル `#28F100`(FaderColumn `:88-93`) 等の音皮固有色は触らない。
- **CSS Modules の @keyframes 重複**（glitch-shift-a/b が ChromeButton と TuneTrigger に別定義）＝皮を別ファイルに移さないので今回は不問。
- **`--paper-panel-*` の定義削除禁止**（SaveToast/PipStack 消費）。
