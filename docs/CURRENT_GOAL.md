# 次セッションのゴール (= セッション 135)

## 今の状態（セッション134で完了・全て本番 `allmarks.app` 反映済み / commit+push 済み）

paper-atelier の対話ブラッシュアップを継続。**5本の並列調査で事実を固めてから**実装した。tsc0 / vitest 1790 / build OK。default(黒+音波)は paper-scoped で byte-identical 維持。

セッション134で shipped:
1. **角の不具合の真因特定＋修正**: y=0でだけ角が四角くなるのは `.canvas::before/::after`（暗い影帯, position:absolute z80）が角丸パネルの上辺のクリップを破る Chromium バグ。**紙テーマで影帯を `display:none`**（`BoardRoot.module.css` 末尾、paper-scoped）。ブラウザで「四角→丸」実測検証済み。（`.canvas`に`will-change`は全画面Lightboxを壊すので不採用。）
2. **インク染み＝ユーザーの本物素材に差し替え**: 自作生成は廃止。マスターシート `12_29_56-Photoroom.png` 4節から切り出し → `ink-splat-1/2/3.png`。
3. **染みを小さく（width 30-76, 旧180-380）＋ループ配置**: `board-decor.ts` が固定1500pxタイルを繰り返す（交互にx反転+回転）→ 下までスクロールしても途切れない（旧 MAX_ITEMS で下が空になっていた）。
4. **カードの英語ワードスタンプ削除**: `paper-decorations.ts` の `stamp` を常時null（rng列は温存）。散布層の accents からもワードスタンプ除外（タグ誤認解消）。
5. **タグ＝マステに手書き文字**（`TagIndicatorStrip.tsx`, `useIsPaperTheme`で紙のみ）: washi-tape PNG上にYomogi/Caveatでタグ名、id由来で安定変種+傾き。
6. **メディアを切らない（contain）＋台紙が見える**（前々回）: `.paperPhoto img` cover→contain、窓背景 `--paper-window-bg`、台紙プールに card-mat-aged 追加。

パララックス・染みの大きさ・washiタグは **user OK**。

## 次にやる（優先順）

### 1. 【最優先・バグ】washiタグのマステが「+ TAG」ボタンに被って操作不能
- **真因（特定済み）**: 紙テーマの `TagIndicatorStrip`（`components/board/TagIndicatorStrip.tsx`、コンテナ `top:4 left:12`、column、`zIndex:90`、ホバー時 `pointerEvents:auto`）が、`+ TAG` ボタン（`components/board/CardsLayer.tsx:1317-1341`、`top:8 left:8 zIndex:40`、ホバーで出る）の真上に重なり、テープがクリックを奪う。
- **直し方の案**: 紙テーマだけ washi strip を +TAG ボタンの**下に逃がす**（例: コンテナ `top` を ~30px に）／または +TAG を別位置に。+TAG が必ずクリックできること＋ washiタグも読めることの両立を実機で確認。
- 触るファイル: `TagIndicatorStrip.tsx`（コンテナ style の paper分岐）。必要なら `CardsLayer.tsx` の +TAG 位置も。

### 2. 【D】カード台紙のバリエーションを増やす（user「囲った全部使う」）
- 現状の台紙プール: `components/board/cards/ImageCard.tsx:227-231` の `['card-mat-1','card-mat-2','card-mat-3','card-mat-aged']`（`pickPaperAsset`で id 安定選択）。
- やること: 枠付き/罫線/方眼/クリップボード/ノート等を切り出して追加。**素材は低解像度（元シート ~1122px）なので sharp で切り出し+upscale**。`lib/board/paper-assets.ts` に id 登録（type union + PAPER_ASSETS true）、PNG を `public/themes/paper-atelier/` に。
- **注意**: 枠の装飾／罫線が写真窓（`--paper-frame-inset: 6% 6% 22% 6%`）と干渉しないか **1種ずつ実機確認**。`deckle-edge-mat` は横長の破れ紙なので `background-size:cover` で縦カードに使うと端が切れる→専用 contain 扱いが要る（汎用プールに入れない）。
- 素材の在り処と切り出しレシピは memory `reference_paper_asset_sources` 参照（マスター = `C:/Users/masay/Downloads/ChatGPT Image 2026年6月25日 12_29_56-Photoroom.png`、節2=CARD&PANEL）。

### 3. 【F】パネル背景の羊皮紙化（user「もれなくテーマ追従」承認済み）
- 対象パネル（紙テーマのとき背景を羊皮紙＋インク文字に）:
  - 板内: **TUNE**（`TuneTrigger.module.css` + `TunePresetColumn.module.css`）／**SETTINGS ドロワー**（場所未特定、要調査）／**言語切替**（`LanguageSwitcher.module.css`）／**タグ追加ポップ**（`components/board/TagAddPopover/`）
  - 別ページ: **保存窓 `app/save/`**（拡張/ブックマークレットの保存タグ窓）← **別ルートなのでテーマ伝達の仕組みから**。`(app)/layout` の pre-paint インラインスクリプト（localStorage `allmarks-theme-id` → `<html data-theme-id>`）を参考に、`app/save` でも同様に data-theme-id を立てる。
- session133 は文字をインク化しただけ（`TuneTrigger`/`LanguageSwitcher` に一部 paper rule あり）。今回は **パネルの背景そのもの**を羊皮紙に。各 `.module.css` に `:global(html[data-theme-id='paper-atelier'])` スコープで背景画像（`--asset-parchment-*` か card-mat 系）＋インク文字。各パネルを実機で1つずつ確認。

## 守ること（毎回）
- default(黒+音波)は **byte-identical**。全 paper 変更は paper-scoped（`:global(html[data-theme-id='paper-atelier'])` か `useIsPaperTheme` か paper-only 描画分岐）。
- deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy は `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="ASCII"`。応答は日本語。視覚は user 直接確認。
- **4K perf watch**: 散布層＋装飾PNG＋scatter で fill-rate 負荷。重ければ密度/サイズ下げる。
- 既知フレーキー: `tests/lib/channel.test.ts`（単独では緑）。

## 主要ファイル（paper 関連 / 今回の追加）
- パララックス: `lib/board/board-decor.ts`（タイル+カテゴリ）/ `BoardDecorLayer.tsx`（`scatterHeight`）/ `use-paper-parallax.ts`（bg 0.15）/ `BoardRoot.tsx`（`DECOR_PARALLAX_FACTOR=0.30`、scatterHeight算出 ~L2163、layers ~L2120/2150/2188）
- 角修正: `BoardRoot.module.css`（`.canvas::before/::after` を paper で display:none）
- カード: `cards/ImageCard.tsx`（台紙プール）/ `cards/ImageCard.module.css`（.paperPhoto contain + 窓背景）/ `decorations/paper-decorations.ts`（stamp無効化）/ `decorations/PaperCardDecorations.tsx`
- タグ: `components/board/TagIndicatorStrip.tsx`（paper=washi+手書き、`useIsPaperTheme`）
- 素材: `lib/board/paper-assets.ts`（マニフェスト）/ `public/themes/paper-atelier/*.png`
- chrome: `TuneTrigger`/`TunePresetColumn`/`LanguageSwitcher`/`TagAddPopover` の .module.css、`app/save/`
- トークン: `app/globals.css` paper ブロック（`--paper-window-bg`, `--paper-frame-inset`, `--asset-parchment-bg/-outer`, `--canvas-radius:14px`）

## 実機検証レシピ（playwright）
dev: `pnpm dev`（:3000）。viewport `1489×679` dpr2。`/board` を開き 2.5s 待ち → IDB seed（store `settings` に `{key:'board-config',config:{themeId:'paper-atelier',displayMode:'visual',activeFilter:{kind:'all'},motionEnabled:true,bgTypoEnabled:true,frameRatio:{kind:'preset',presetId:'free'}}}` ＋ `bookmarks` に thumbnail付きダミー、タグ確認は `tags` store にレコード＋bookmark.tags）→ reload 4s。スクリプトは**プロジェクト直下に書いて** `node ./_x.mjs`（playwright解決のため）→ 実行後削除。DB名 `booklage-db`。
