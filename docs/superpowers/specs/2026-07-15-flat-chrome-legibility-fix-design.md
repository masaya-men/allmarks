# Design — Flat テーマ chrome 可読性の修復（フラット皮を"中身"まで完成させる）

日付: 2026-07-15 / セッション 199
種別: bug-fix 設計（systematic-debugging Phase 1-2 完了 → 実装設計）
親: [2026-07-14-theme-scope-principle-design.md](2026-07-14-theme-scope-principle-design.md)（chrome＝テーマの皮）／サブ2（s198 出荷）の**未完部の補完**
関連掟: s197 fix-1「面を明色にするなら文字も暗インクに（対で）」／[[reference_token_fallback_dead_when_root_defined]]

---

## 1. 症状（実機・ユーザー報告 s199）
フラットテーマで**複数のメニューの中身が見えない**。実機スクショ＝右の SETTINGS ドロワーが**白パネルに白文字＝ほぼ空白**。「いろんな場所」で発生。

## 2. 根本原因（確定・実コード確認済）
s198 のフラット皮は「**パネルの枠**（`--chrome-panel-*`）」と「**ヘッダーのボタン**（`--chrome-btn-color`）」は着せ替えたが、**メニューの"中身"は音テーマの色（白）を直書きしたまま**。2 パターンに割れる:

- **パターンA（白×白）**: トークン駆動パネル（`ChromeDrawer.panel` は `--chrome-panel-surface`/`--chrome-btn-color` で正しく白面＋暗インクに反転）の"中身"が `rgba(255,255,255,A)` を直書き → **白面に白文字**。
  - 引用: `ChromeDrawer.module.css` [:41](../../../components/board/ChromeDrawer.module.css#L41)（`.title` 白）・[:52](../../../components/board/ChromeDrawer.module.css#L52)（`.closeBtn` 白）・[:34](../../../components/board/ChromeDrawer.module.css#L34)（`.header` 白境界）・[:71](../../../components/board/ChromeDrawer.module.css#L71)（`.scrollFade` 暗グラデ＝逆向き）。
  - `ExtensionEntry.module.css`（SETTINGS 中身）[:100](../../../components/board/ExtensionEntry.module.css#L100)/[:129](../../../components/board/ExtensionEntry.module.css#L129)/[:138](../../../components/board/ExtensionEntry.module.css#L138)/[:154](../../../components/board/ExtensionEntry.module.css#L154)/[:178](../../../components/board/ExtensionEntry.module.css#L178)/[:207](../../../components/board/ExtensionEntry.module.css#L207)/[:221](../../../components/board/ExtensionEntry.module.css#L221)/[:241](../../../components/board/ExtensionEntry.module.css#L241)（全部 `rgba(255,255,255,A)`）。
  - `ThemeModal.module.css`（`.groupLabel` 白）・`ThemeCustomizeSection.module.css`（section/groupLabel/resetBtn/rowLabel/customSwatch 全部白）。

- **パターンB（暗×暗／明テーマに暗パネルが浮く）**: ハードコード暗面パネル（`rgba(8,8,10,0.96)` 直書き・`--chrome-panel-surface` 不使用）がフラットでも暗いまま。その行が `var(--chrome-btn-color)` を使うと暗インクに反転して**暗×暗**（＝絞り込みドロップダウン）。他は白文字のまま読めるが**明テーマに暗パネルが浮く**。
  - 対象: `FilterPill.module.css` `.menu`（暗面）＋ `.item`（`var(--chrome-btn-color)` で暗反転）／`LanguageSwitcher.module.css` `.list`／`TagDropPanel.module.css` `.menu`／`triage/TagContextMenu.module.css` `.panel`。

**土台の実値**（globals.css）: `:root` chrome 既定＝暗（[:362-370](../../../app/globals.css#L362)）。flat ブロック＝明（[:669-733](../../../app/globals.css#L669)・既に `--chrome-panel-surface: rgba(255,255,255,0.97)`・`--chrome-btn-color: rgba(20,19,15,0.9)` 等を定義）。

**分類結論＝共通の1トークンでは直らない。** パターンA＝子要素の白ハードコードを暗インクに反転する必要／パターンB＝暗面を白面に反転する必要（逆向き）。**正しく出来ている参照＝TUNE 三点**（`TuneTrigger`/`TunePresetColumn`/`FaderColumn` は `:global(html[data-theme-id="flat"])` ブロックで全反転済）＝**これが全メニューが真似るべき型**。

---

## 3. 修復の設計（根本原因・抜けゼロ）
「1個ずつ塗る」ではなく、**テーマで自動反転する仕組み**にする。

### 3-1. 新トークン `--chrome-ink-rgb`（インクの三値）— パターンAの根治
- `:root`（＝暗テーマ既定・globals.css [:369](../../../app/globals.css#L369) 付近）に追記: `--chrome-ink-rgb: 255, 255, 255;`
- flat ブロック（[:709](../../../app/globals.css#L709) 付近）に追記: `--chrome-ink-rgb: 20, 19, 15;`
- chrome の**文字・境界・淡い白フィル**の `rgba(255, 255, 255, A)` を `rgba(var(--chrome-ink-rgb), A)` に置換。`#fff`/`#ffffff`（hover 最大白）は `rgb(var(--chrome-ink-rgb))`。
- **効果**: 暗テーマは三値＝255,255,255＝**計算結果は従来と完全同一**（音/紙/Grid バイト同一）。flat は三値＝20,19,15＝**各サイトの alpha（濃淡＝階層）を保ったまま暗インクに反転**。
- **対象ファイル**（chrome 中身のみ）: `ChromeDrawer.module.css`・`ExtensionEntry.module.css`・`ThemeModal.module.css`・`ThemeCustomizeSection.module.css`・`FilterPill.module.css`（menu 内の文字/境界/count/section）・`LanguageSwitcher.module.css`・`TagDropPanel.module.css`・`triage/TagContextMenu.module.css`・（トースト群は 3-3）。
- **変換しないもの（意図的な色）**: 緑チェック `#28f100`/`#1c9a00`／glitch ゴースト `#ff9d3f`・`#50c8ff`／`.cta` のオレンジ上の暗文字 `#1a0e05`／**テーマのプレビュー用チップ**（`ThemeCustomizeSection` の `.patternSwatch` `#0e0e11`・`ThemePicker` の `.preview[data-theme-id]` サムネ＝意図的に暗い）／既にトークン化済みの `--chrome-text-stroke-color`（flat で白ストローク＝意図的）。

### 3-2. パターンB パネルのフラット面反転（append-only・flat scoped）
ハードコード暗面をフラットのみ白面へ（暗テーマは直書きのまま＝バイト同一）:
```
:global(html[data-theme-id="flat"]) .menu {
  background: var(--chrome-panel-surface);
  border-color: rgba(var(--chrome-ink-rgb), 0.10);
}
```
対象: `FilterPill.menu`／`LanguageSwitcher.list`／`TagDropPanel.menu`／`TagContextMenu.panel`。面が白になり、3-1 で暗インク化した中身が白面に乗る＝可読。

### 3-3. 暗前提の個別上書き（flat scoped）
- `ChromeDrawer.scrollFade`: フラットは明グラデ（`rgba(250,249,246,0)→rgba(250,249,246,0.94)`）。
- `ThemePicker`: `--color-glass-bg`/`--color-glass-border` が flat 未定義→暗既定に落ちてスウォッチ面/枠が白に埋もれる → flat ブロックで明値定義 or ink-rgb 化。
- **トースト群**（`UndoToast`/`BackupReminder`/`PasteSaveFeedback.panel`/`ShareToast.bar`・`ShareToast.snipAwayHint`）: フラットで白面＋暗インクに（読めるが不揃い＝ユーザー承認済で統一）。

---

## 4. 不変条件（死守）
- **音（dotted-notebook）・紙（paper-atelier）・Grid（grid-paper）＝バイト同一**: `--chrome-ink-rgb` の :root 値＝255,255,255＝全 ink 変換が計算結果同値／パターンB面反転は flat scoped の append-only／暗テーマの直書きは無改変。
- **既存の computed-style byte-identity e2e（音）が緑のまま**。
- **紙は colorScheme:light だが chrome パネルは今も暗面**（:root 継承）＝白文字が見える＝**現状維持**（今回はフラットのみ白面化）。紙の cream 面化はサブ3。
- LightningCSS が `rgba(var(--x), A)` を潰さないこと（var 未解決なので保持されるはず）＝build ゲートで確認。

## 5. テスト（抜けゼロの固定）
- 新規 computed-style / e2e: **flat で主要メニューの文字が暗インク＋面が明色**を assert（SETTINGS ドロワーの `.title`/`.groupLabel`/`.panelCta`／`FilterPill` dropdown `.item`／`ThemeModal .groupLabel`／`LanguageSwitcher .toggle`）。「暗インク×明面＝コントラスト十分」を機械で固定。
- 既存の音バイト同一テストが不変であることを再確認。

## 6. 非対象（この後の別タスク）
- **chrome アニメの静音化**（scramble/glitch をテーマ化＝音のみ signature）＝ユーザー承認済（B 下線）だが**別タスク**。
- **Grid をフラットに統合**（模様オプション化＋独立 Grid 廃止＋移行）＝別タスク。
- **紙の cream chrome 皮**＝サブ3。
