# 次セッションのゴール (= セッション 136)

## 今の状態（セッション135で完了・全て本番 `allmarks.app` 反映済み / commit+push 済み）

paper-atelier ブラッシュアップ継続。3タスク実装・本番反映。tsc0 / vitest1790 / build OK。default(黒+音波)は byte-identical（全変更 paper-scoped、各 CSS は numstat deleted=0 の純追記で実証）。

セッション135 で shipped:
1. **washi×+TAG バグ修正**: paper の `TagIndicatorStrip` を z90→15（装飾z11 の上・全chrome の下）＋top:4→32。+TAG クリック奪取を解消、popover(z70)衝突も同時防止。Playwright 実測済。
2. **カード台紙 +2**: マスター節2 から CCL 自動検出 → `card-mat-lined`(罫線)/`card-mat-grid`(方眼) を切り出し+upscale、`ImageCard.tsx:227` プールに追加。
3. **パネル羊皮紙化（もれなくテーマ追従）**: globals に共有トークン `--paper-panel-*` 追加 → TUNE/SETTINGS/言語/タグ追加pop の各 .module.css に paper-scoped で羊皮紙背景＋墨文字（機能アクセント温存）。**別ルート /save** に pre-paint テーマスクリプト注入＋SaveToast 羊皮紙化。4パネル+/save を Playwright 実測（bg=rgb(241,231,207)+墨）。

## 次にやる（優先順）

### 1. 【最優先】user の実機目視フィードバックを反映
- allmarks.app ハードリロード → Paper Atelier で: ①washiタグ下の **+TAG が押せるか** ②**罫線/方眼の新台紙**の見え（cover+大写真なので余白＋caption帯に控えめ。物足りなければ inset を緩める/台紙をもっと見せる検討）③**TUNE/SETTINGS/言語/タグ追加pop/保存窓** の羊皮紙パネルの色味・可読性（`--paper-panel-surface #f1e7cf` 等トークンで一括調整可）。
- 出た指摘を 1 つずつ反映（feedback_one_thing_at_a_time）。

### 2. 【②の残り】枠付きカード/クリップボード台紙 + 16:08 フレームセットの使い道を決める
- **背景**: `.paperCard` は `background-size: cover`。カードのアスペクトは写真ごとに変わるので、**強い矩形フレーム素材は cover で切れて壊れる**（deckle-edge と同じ罠）。だから session135 では cover で生きる無地系(罫線/方眼)のみ追加した。
- user が今日(6/25)生成した **16:08 の古紙フレームセット(1)**（`ChatGPT Image 2026年6月25日 16_08_56 (1).png`、高解像度・専用・3枠）の使い道を user と決める:
  - (a) 専用「**枠付きカード**」モード = picked mat が枠系のとき `data-paper-mat-frame` を立て CSS で `background-size: 100% 100%`（単純な矩形枠なら歪み許容）か、枠PNGを写真の上に重ねるオーバーレイ層
  - (b) パネル枠の装飾（今のパネルは無地羊皮紙。枠を足すか）
- master 節2 の framed/clipboard/folder piece も同様（要 contain or overlay）。
- **16:08 バッチは5テーマ分のフレーム**（(1)古紙=paper / (2)SF白メカ / (3)暗緑端末 / (4)celestial紺金 / (5)リキッドグラス）＝**将来テーマの素材準備**。paper 以外は今は対象外。

### 3. その後（paper が固まったら）
- Plan 3 = **共有のテーマ化**（spec §6、A盤面+B OGサムネを paper でも）／ #1 white-sector・#5 celestial-atlas を同型量産（16:08 (4) celestial フレーム素材あり）。

## 守ること（毎回）
- default(黒+音波)は **byte-identical**。全 paper 変更は paper-scoped（`:global(html[data-theme-id='paper-atelier'])` か `useIsPaperTheme` か paper-only 分岐）。各 CSS は**末尾に純追記**（numstat deleted=0 を保つ）。
- deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy は `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="ASCII"`。応答は日本語。視覚は user 直接確認。
- **4K perf watch**: 散布層＋装飾PNG＋scatter で fill-rate 負荷。重ければ密度/サイズ下げる。
- 既知フレーキー: `tests/lib/channel.test.ts`（単独では緑）。

## 主要ファイル（今回の追加/変更）
- バグ: `components/board/TagIndicatorStrip.tsx`（paper 分岐 z15/top32）
- 台紙: `lib/board/paper-assets.ts`（`card-mat-lined`/`card-mat-grid` 登録）/ `components/board/cards/ImageCard.tsx:227`（プール）/ `public/themes/paper-atelier/card-mat-{lined,grid}.png`
- パネル: `app/globals.css`（`--paper-panel-*` トークン、chrome-text 群の直後）/ `TuneTrigger.module.css` / `TunePresetColumn.module.css` / `ExtensionEntry.module.css` / `ThemePicker.module.css` / `LanguageSwitcher.module.css` / `TagAddPopover/TagAddPopover.module.css`
- 保存窓: `app/save/layout.tsx`（pre-paint テーマスクリプト＋テーマ連動bg）/ `components/bookmarklet/SaveToast.module.css`（paper stage）
- 素材源: `C:/Users/masay/Downloads/ChatGPT Image 2026年6月25日 12_29_56-Photoroom.png`（マスター, 透明背景, 1122×1402, 節2=CARD&PANEL）/ 16:08 フレームセット5枚（将来テーマ）。memory `reference_paper_asset_sources` も参照。

## 実機検証レシピ（playwright）
dev: `pnpm dev`（:3000）。viewport `1489×679` dpr2。`/board` を 2.5s 待ち → IDB seed（store `settings` に `{key:'board-config',config:{themeId:'paper-atelier',displayMode:'visual',activeFilter:{kind:'all'},motionEnabled:true,bgTypoEnabled:true,frameRatio:{kind:'preset',presetId:'free'}}}` ＋ localStorage `allmarks-theme-id='paper-atelier'` ＋ `bookmarks` に thumbnail付きダミー）→ reload 4s。DB名 `booklage-db`。パネルは testid: `tune-trigger`/`tune-drawer`、`extension-settings`/`[aria-label="AllMarks settings"]`、`language-switcher-toggle`、card hover→`card-add-tag-button`。スクリプトは**プロジェクト直下**に書いて `node ./_x.mjs` → 実行後削除。台紙の特定 mat 強制は id を FNV-1a でブルートフォース（プール6種 index4=lined/5=grid）。
