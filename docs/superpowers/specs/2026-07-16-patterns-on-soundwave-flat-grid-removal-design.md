# 模様を Sound Wave / Flat のカスタマイズに統合し、独立 Grid を撤去する（設計）

作成 2026-07-16 / セッション200。ユーザー発案（「Grid を独立テーマにするのをやめ、格子/ドット等を Sound Wave と Flat のカスタマイズに乗せる」）を受けた設計。

## ゴール

- **模様（格子/ドット/斜線/クロス）を Sound Wave と Flat の CUSTOMIZE から選べるようにする**。
- **独立した Grid テーマ（`grid-paper`）を撤去**し、既存ユーザーを **Sound Wave＋グリッド模様**へ安全に移行する（見た目はピクセル同一を保つ）。
- **Flat の色プリセットをユーザー提供の配色に更新**し、開いた瞬間「＋（自由色）」が誤選択される不具合も直す。
- **既定（Sound Wave / Flat / Paper / 音）はバイト同一を死守**（模様は選んだ時だけ出る）。

## 調査で確定した事実（実装の前提）

- 盤面の模様は **単一の `.patternLayer`**（[BoardRoot.tsx:3459-3475](../../../components/board/BoardRoot.tsx#L3459-L3475)）が `resolvedCustom`（boardColor / patternType / patternColor / patternSize / patternStroke）で描く。`themeMeta.kind === 'pattern'` の全テーマ（Sound Wave / grid-paper / Flat）で同じ。
- `backgroundClassName` の `.dottedNotebook` / `.gridPaper` / `.flat` は **すべて `background-color: transparent` の placeholder**（[themes.module.css:7-17](../../../components/board/themes.module.css#L7-L17)）＝グリッドは CSS クラスではなく `.patternLayer` が描いている。→ **grid-paper のグリッド＝Sound Wave に `{boardColor:'#0e0e11', patternType:'grid'}` を入れたものとピクセル同一**。
- 模様を「選べる」かは `THEMES_WITH_PATTERN_CONTROLS`（[theme-customization.ts:79](../../../lib/board/theme-customization.ts#L79)・現在 `grid-paper` のみ）で決まる。盤面側は既に全 pattern テーマを描ける。
- 視差 drift は `gridBgPanY`（`BG_PARALLAX_THEMES`＝`use-paper-parallax.ts:29` に `paper-atelier`,`grid-paper`）由来。patternType='none' の層は画像なし＝drift しても不可視。
- テーマ別カスタマイズは **`BoardConfig.themeCustomizations`**（`Record<ThemeId, ThemeCustomization>`）に保存（[BoardRoot.tsx:880](../../../components/board/BoardRoot.tsx#L880), [:2078](../../../components/board/BoardRoot.tsx#L2078)）。読み込みは [board-config.ts:25 `loadBoardConfig`](../../../lib/storage/board-config.ts#L25)。
- 受け取り（/s）も同じ `resolveThemeCustomization` ＋ `.patternLayer` で描く（[SharedBoard.tsx:473-480](../../../components/share/SharedBoard.tsx#L473-L480)）＝送信者の模様は自動で一致。

## 設計

### 第1部：Sound Wave / Flat に模様コントロールを追加

- `THEMES_WITH_PATTERN_CONTROLS` に `'dotted-notebook'` と `'flat'` を追加（`'grid-paper'` は撤去で消える）。
- `THEME_CUSTOMIZATION_DEFAULTS['dotted-notebook']` / `['flat']` の既定 `patternType` は **'none' のまま**＝**未カスタム時はバイト同一**。
- `use-paper-parallax.ts` の `BG_PARALLAX_THEMES` を `{'paper-atelier','dotted-notebook'}` に（`grid-paper`→`dotted-notebook` 置換）。Sound Wave の既定は模様なし＝drift 不可視＝バイト同一。Flat は drift なし（据え置き）。

### 第2部：盤面の明るさに応じた色プリセット（＋「＋」誤選択の修正・Flat 配色更新）

現状の swatch（`EDGE_SWATCHES` / `BOARD_SWATCHES` / `PATTERN_SWATCHES` / `TITLE_SWATCHES`）は暗い盤面前提の1組のみ。Flat（明るい盤面）だと既定色がプリセットに無く、`isCustom = !swatches.includes(active)` が true → 「＋」が誤選択表示になる。

- **明暗2組の swatch セットにする**。テーマの `colorScheme`（`dark`=Sound Wave / `light`=Flat）で `ThemeCustomizeSection` が使うセットを切替える。
- **各セットの先頭＝そのテーマの既定色**（Sound Wave: `#0a0a0a`/`#0a0a0a`/`rgba(255,255,255,0.18)`/`rgba(255,255,255,0.95)` ／ Flat: `#faf9f6`/`#f1efe8`/`rgba(20,19,15,0.10)`/`rgba(20,19,15,0.55)`）→ 開いた瞬間、既定スウォッチが選択表示（「＋」ではない）。
- **暗い盤面セット＝現行値を維持**（Sound Wave はバイト同一・見た目不変）。
- **明るい盤面（Flat）セット＝ユーザー提供の配色**：
  - **board**: `#ffffff`, `#faf9f6`(既定), `#F0F1BE`(Mint Julep), `#CFF740`(Starship), `#F8F7C8`(Corn Field)
  - **pattern**: `rgba(20,19,15,0.10)`(既定・soft ink), `#749469`(Highland), `#227798`(Jelly Bean), `#FD8AB6`(Tickle Me Pink)（濃さのある色は自由色ピッカーで透過も可）
  - **edge**: 中立（`#f1efe8`(既定)＋白系の明るい枠 数色）
  - **title**: 中立（`rgba(20,19,15,0.55)`(既定)＋インク系 数色）
  - ユーザー意図：ペアは「Mint Julep 盤面 × Highland 模様」のように組で映える想定だが、各行は独立に選べる。edge/title はコントラストの都合で中立。

### 第3部：独立 Grid テーマ（grid-paper）を撤去＋安全移行

- **型/登録から削除**: `types.ts` `ThemeId` から `'grid-paper'`／`theme-registry.ts` の `grid-paper` エントリ／`THEME_CUSTOMIZATION_DEFAULTS['grid-paper']`／`themes.module.css` の `.gridPaper`。
- **移行（`loadBoardConfig` 内・クラッシュ防止の要）**: 読み込んだ config の `themeId === 'grid-paper'` なら：
  1. `themeId` を `'dotted-notebook'` に。
  2. `themeCustomizations['dotted-notebook']` に **grid-paper の見た目**を注入＝ユーザーが grid-paper をカスタムしていればその値（`themeCustomizations['grid-paper']`）を、無ければ移行既定 `{ boardColor:'#0e0e11', patternType:'grid', patternColor:'rgba(255,255,255,0.18)', patternSize:40, patternStroke:1 }`。
  3. `themeCustomizations['grid-paper']` キーは残っていても無害（`getThemeMeta` は通らない）が、掃除で削除してよい。
  - `loadBoardConfig` が themeId の唯一の読取口＝ここで remap すれば `getThemeMeta('grid-paper')`（undefined でクラッシュ）を確実に回避。
  - **エッジケース**（grid-paper と dotted-notebook 両方のカスタムを持つ稀なユーザー）：アクティブは grid-paper だったので、見えていたグリッドを優先し dotted-notebook スロットを上書き（非アクティブな SW カスタムは失う・稀・許容）。spec に明記。
- **共有リンク（validator）**: 未知 themeId は既定にフォールバック（クラッシュ無）。`validate-v2` が `grid-paper` を有効値として持つなら削除し、未知→default のテストを追加/更新。
- **参照更新**: `ScrollMeter.tsx:117`（コメント）／`use-paper-parallax.ts`（第1部で対応）／`BoardRoot.tsx` の grid-paper コメント（163/1135/3454）は説明を一般化。

## バイト同一・不変条件（死守）

1. **音（dotted-notebook）＝バイト同一**：既定 patternType 'none'・暗い swatch セットは現行値維持・BG_PARALLAX 追加は無模様で不可視。
2. **Flat 既定＝不変**：既定 patternType 'none'（模様は選んだ時だけ）。swatch の先頭に既定色を置くのは表示上の話で、既定レンダリングは変えない。
3. **Paper（work テーマ）＝不変**：pattern 対象外（resolvedCustom null）。
4. **grid-paper 利用者＝移行後ピクセル同一**（Sound Wave＋グリッド custom＋drift）。
5. **受け取り/OG＝送信者と一致**（同一 `patternSvgDataUri`・validator 経由）。

## テスト（更新/追加）

- `theme-customization.test.ts`：`THEMES_WITH_PATTERN_CONTROLS` に SW/Flat 追加／明暗 swatch セットの先頭＝既定色／grid-paper 既定の削除。
- `board-config.test.ts`：grid-paper→dotted-notebook 移行（見た目 custom 引継ぎ・両方 custom のエッジケース・非 grid-paper は無変化）。
- `validate-v2.test.ts` / `board-to-share.test.ts` / `SharedBoard.test.tsx` / `ShareMirror.test.tsx`：grid-paper 有効値の削除・未知→default。
- `theme-registry.test.ts` / `theme-entitlement.test.ts`：4→3 テーマ。
- `chrome-theme-coverage.test.tsx`：全テーマ列挙が grid-paper 抜きで通る／SW・Flat で CUSTOMIZE に模様コントロールが出る。
- `ThemePicker.test.tsx`：（mock registry のため grid-paper 参照なし・要確認）。
- `use-paper-parallax.test.tsx`：BG_PARALLAX_THEMES の入替。
- `ExtensionEntry.motion.test.tsx` / `PaperChrome.gating.test.tsx` / `MobileSaveButton.module.css`：grid-paper 参照の除去/更新。
- **e2e `board-b0.spec.ts:149`**：`data-theme-button="grid-paper"` クリックを別テーマ（例：flat か paper-atelier）に差し替え、または「SW＋グリッド custom」経路に。
- **15言語 `board.theme.gridPaper` ラベル**：未使用化。削除は 15 ファイル波及＝**残す**（parity 維持・無害）。ThemePicker は registry 由来なので描画に出ない。
- ゲート：`rtk tsc` 0 ／ `npx vitest run` 全緑 ／ `pnpm build` ／ 主要 e2e ／ デスクトップ 1489 と Flat の実機目視（ユーザー）。

## スコープ外（今回やらない）

- Flat の模様に視差 drift を付ける（据え置き・要望が出たら）。
- 暗い盤面（Sound Wave）に明るい色プリセットを足す（Sound Wave は暗い世界のまま）。
- 有料テーマ/K3・支援導線（別トラック・保留中）。

## 手順

写経できる計画（writing-plans）に落とし、密結合（型削除→全参照更新→テスト）ゆえ**1つの整合した変更として順に実装**（並列 subagent は tsc 破綻を招くため不採用）。実装後：tsc/vitest/build/e2e → opus 全ブランチレビュー → ゲート → デプロイ → ユーザー実機（Flat の面白い配色＋移行の確認）。
