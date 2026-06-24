# paper-atelier 完全再現（Full Fidelity）設計書

- **日付**: 2026-06-25（セッション 132 後半）
- **状態**: ブレインストーミング中（設計提示 → user レビュー待ち）。承認後に `writing-plans` で実装計画へ。
- **前提**: Plan 1（土台＋核の見た目）/ Plan 2（トークン化＋装飾オーバーレイ＋アニメ）は本番反映済み。**本書はその上に「各面を本物の紙にする」リプレイス設計**。
- **正本モック**: `docs/private/theme-mockups/03-paper-atelier__{board,settings,scrollmeter}.png`
- **素材**: `docs/private/theme-mockups/ASSET-BRIEF.md`（GPT 生成中。生成PNGは `public/themes/paper-atelier/<id>.png`）

---

## 0. なぜこの設計が要るか（Plan 2 の何が足りなかったか）

Plan 2 は **「既存の盤面を紙色に塗り替え、飾りを pointer-events:none で上に重ねた」**＝**スキン**だった。user 評価＝「あのモックと全く同じ質感じゃないと嫌、完全再現には程遠い」。

モックの本質は **「盤面全体が物理的な紙のコラージュ」**：
- カードは**羊皮紙の台紙**で、URLの中身が**印刷写真として嵌め込まれ**、マステ/ピン/クリップ/フォトコーナー/スタンプが**台紙と一体**。
- スクロールメーターは**古びて折れ・かすれた紙帯**の上を**紙片タブ**が滑る。
- ヘッダー/ワードマークは**デジタルな等幅＋RGBグリッチ**のまま浮いている → **セリフ/手書き＋インク演出**であるべき。

→ **各“面”を、本物の紙テクスチャ素材を使って描き直す**のが本書。CSS/SVG の手続き生成では「全く同じ」に届かないため、**ラスター画像素材（GPT生成）を合成**する方式を採る（ASSET-BRIEF.md で確定）。

### 残す土台（Plan 1/2 の正しい部分・捨てない）
- `data-theme-id` カスケード / `html[data-theme-id="paper-atelier"]` 自己完結トークンブロック / `var(--token, default)` による **default 不変担保**。
- 装飾の **決定論割当**（`getCardDecorations(cardId)` FNV-1a+mulberry32）と **pointer-events:none・FLIP非干渉**の作法。
- アニメ登録機構（`getEntryAnimation`/`getShutdownAnimationClass`/`getTextTransition`）と `motion` キー配線、reduced-motion 3層ゲート。
- ScrollMeter の variant 機構（位置ロジック再利用）。

### 置き換える/作り直す部分（本書の中身）
カード表面、スクロールメーターの見た目、ヘッダー書体＋モーション、背景テクスチャ素材、ワードマークのインク質感、MK-1/蝋封 chrome — **すべて“CSS で擬似”から“本物の紙素材を合成”へ**。

---

## 1. ゴール / 非ゴール

### ゴール
1. **モックと同じ素材感**：カード/メーター/背景/chrome の全面が、ASSET-BRIEF の紙素材で構成され、モックの色・質感・こだわりに一致する。
2. **生きたアプリで成立**：動的なカード数・スクロール・実コンテンツに対して、面の**素材品質**が一貫する（静止ポスターと1px同一ではなく、同じ“世界”）。
3. **default(黒+音波) は 1バイトも不変**（最終レビューで証明する Plan 2 の不変条件を維持）。
4. **素材が無くても壊れない**：PNG 未配置時は現状の CSS 見た目に**優雅に degrade**（素材を入れた面から順に“本物”になる）。

### 非ゴール
- 静止ポスターのピクセル完全コピー（生きたアプリでは不可能・不要）。
- 他テーマ（white-sector 等）の実装（素材は同梱したが、実装は別セッション）。
- 共有のテーマ化（Plan 3）。有料解錠の本体（N-06）。

---

## 2. 素材依存と「無くても壊れない」原則（最重要の設計判断）

- 各紙素材は `public/themes/paper-atelier/<id>.png`。CSS から `var(--asset-<id>, none)` 等で参照する。**トークンに URL を入れるのは paper ブロックのみ**＝default は `none` に解決され不変。
- **graceful degradation**: 素材が未配置の面は、Plan 2 の CSS 表現（生成り色・CSS グラデ）に**そのまま fallback**。つまり「背景タイルだけ先に入れる」「カード台紙だけ入れる」など**面ごと・素材ごとに段階的に本物化**できる。実装も「素材を受け取れる器」を先に作り、素材到着で差し替え。
- **画像AIの揺れに備える**: 「継ぎ目なしタイル」「完全透過」「色番号一致」は一発で出ないことがある。器側は (a) タイルの継ぎ目が出ても目立ちにくい合成（low-contrast・ぼかし境界）、(b) 透過前提だが不透明落ちでも致命傷にしない z-order、で**素材品質のブレを吸収**する。素材が惜しければプロンプト微修正で再生成。

---

## 3. 面ごとの設計

### 3.1 背景（`parchment-bg-tile`）
- **現状(Plan 2)**: 生成 SVG グレイン＋CSS グラデ＋インセット・ヴィネット。
- **本物化**: `.paperAtelier` の `background-image` を **`parchment-bg-tile` の継ぎ目なしタイル**（`background-repeat: repeat`、適切な `background-size`）に差し替え＋既存の CSS ヴィネット/減光を**上に**合成（素材は低コントラスト指定なのでヴィネットは CSS 側が正解）。パララックス 0.85x（Plan 2）はそのまま。
- **統合点**: `components/board/themes.module.css` `.paperAtelier`、`app/globals.css` paper ブロックに `--paper-fiber-url`（既存）→ 実 PNG を指す。
- **perf**: タイル1枚を repeat（4K でも安価）。常時 canvas/GPU フィルタ無し（Plan 2 の不変条件維持）。

### 3.2 カード（最重要・一番効く）＝ 羊皮紙の台紙＋印刷写真インセット＋セリフ署名＋飾り一体
これが Plan 2 で最も足りなかった面。**カード表面そのものを paper 用に作り直す**。

- **台紙**: カード背景を `card-mat-stock`（象牙紙、2-3種を `card.id` で決定論選択）にする。角丸は写真プリント風の小さめ（`--card-radius` paper=3px、Plan 2 で colorScheme 分岐済み）。warm-gray ヘアライン枠＋柔らかい紙影。
- **印刷写真インセット**: サムネ/画像を**台紙の中に少し内側で**配置（mat の余白＝小さなパディング）。写真は「紙に貼った/印刷した」風に、極薄の内側影 or `photo-mounting-corner`（四隅、`card.id` で有無）で**マウント**して見せる。
  - **ライブ埋め込み（再生中の動画/ツイート等）**は紙にできない＝**台紙の額縁の中に普通に表示**（世界観は額縁で担保）。盤面は基本サムネ表示（Plan 2 の Tier 方針）なので、ほとんどのカードは「印刷写真」として成立。
- **セリフ署名（キャプション）**: モックのカードは下にタイトル（"Interior Study" 等）がある。**bookmark の `item.title` を、台紙の下帯にセリフ（Fraunces）＋墨インク（CHARCOAL #151515）で印字**。※Plan 2 では「キャプション無し」を既定にしたが、**完全再現では台紙＋署名がセットなので採用**（→ §6 決定事項①で確認）。
- **飾り一体化**: 既存の `PaperCardDecorations`（マステ/ピン/クリップ/スタンプ）を、CSS グラデの擬似から **実素材 PNG（`washi-tape-strips`/`push-pin`/`paper-clip`/`rubber-ink-stamps`）に差し替え**。決定論割当・pointer-events:none・台紙からはみ出してよい（CardsLayer ラッパに mount 済の Plan 2 構造を流用）。
- **非干渉（厳守）**: カードの外箱（masonry 矩形＝FLIP origin）の寸法は変えない。台紙・額縁・署名は**箱の内側のレイアウト**で完結。装飾は箱の外にはみ出すが pointer-events:none。Lightbox FLIP は箱 rect 基準なので不変。
- **統合点**: `components/board/cards/ImageCard.tsx`（+ .module.css）に **paper 用の内部レイアウト分岐**（台紙＋インセット＋署名）。default テーマは現状の full-bleed サムネのまま（分岐は paper のときだけ）。`CardNode`/`CardsLayer` は既存流用。
- **perf**: 台紙テクスチャは小さめ PNG をカード幅に伸ばす（または subtle tile）。50枚で重くならないよう、装飾/台紙は**画像1枚を共有**（同じ URL は1回デコード）。

### 3.3 スクロールメーター ＝ 古紙帯＋紙片タブ（`meter-paper-strip` / `meter-paper-thumb`）
- **現状(Plan 2)**: `RulerTrack`＝綺麗な CSS 目盛り＋真鍮三角マーカー。**綺麗すぎ**。
- **本物化**: RulerTrack の見た目を **`meter-paper-strip`（折れ/かすれ/ステッチ印刷の紙帯）を背景にし、目盛り/数字は素材に印刷済 or その上に薄く CSS で重ねる**。マーカー（thumb）を **`meter-paper-thumb`（紙片タブ）画像**に差し替え（`wax-seal-a` の小型 emboss を載せても良い）。
- **位置ロジックは Plan 2 のまま**（swellFraction 0..1 in / onScrub 0..1 out / centerTickIdx → thumb の left%）。**見た目だけ素材化**。
- **モックの実測値に合わせる**: Track #F3ECE2 / Guide #D6CCC0 / Thumb #E9BFD2 / Ink #333333 / Accent #A78953、寸法 track~12px / thumb~32px / 横バー高~10px / thumb最小幅~48px、モーション hover120ms ease-out / ドラッグ中リニア / 慣性300-600ms / エンドストップ120ms。
- **状態差（02 セクション）**: hover でタブが浮く影／ドラッグ中インク濃度up／慣性で減速／エンドストップで優しく止まる — **磨きフェーズ**として段階実装（slice 1 は素材化＋基本動作）。
- **統合点**: `components/board/scrollmeter/RulerTrack.tsx`(+css)。両呼び出し口（BoardRoot/SharedBoard）配線済。

### 3.4 ヘッダー/chrome 書体＋モーション ＝ セリフ/手書き＋インク演出
- **現状(Plan 2)**: ヘッダーボタン（TITLE/TUNE/SETTINGS/MANAGE TAGS/POP OUT/SHARE）は **Geist Mono＋アイドル scramble＋RGB クロマチック・グリッチ**のまま＝デジタルで紙世界に浮く。
- **本物化（書体）**: paper のとき chrome ボタンの書体を **セリフ（Fraunces、スモールキャップス気味）**へ。注記/ヒント系（"Drag to edge" 等）は **手書き（Caveat、既読込）**。MK-1 プレートの技術文字は等幅維持可。※欧文なので楷書そのものは不可、狙い＝活字/手書きの温かみをセリフ＋手書きで再現。
- **本物化（モーション）**: paper のとき chrome の **RGB グリッチ/scramble を廃止 → インクのにじみ/にじみ立ち上げ or 穏やかなフェード**に差し替え。`ChromeButton` のアニメをテーマ別に出し分け（共有コンポーネントなので paper 分岐を足す）。
- **統合点**: `components/board/ChromeButton.tsx`（テーマ別アニメ/書体トークン）、`app/globals.css` paper ブロック（chrome 書体トークン `--chrome-btn-*` は既存、書体追加）。
- **MOTION トグル・ScrollMeter カウンタ等**の chrome テキストも paper では同方針（既存 `--chrome-text-*` トークン経由）。

### 3.5 ワードマーク（`letterpress-grain-overlay`）＋ 装飾 chrome（`mk1-plate` / `wax-seal-a`）
- **ワードマーク（背景の大 "AllMarks"）**: Plan 2 はフラット墨＋簡易 mask。**`letterpress-grain-overlay` を mask/blend で重ね、活版のかすれ・インクのり・粒状を本物化**（静的・reduced-motion 安全・per-frame paint 無し）。`BoardBackgroundTypography` の paper-scoped `.text` 処理を素材ベースに。
- **MK-1 プレート（左下）/ 蝋封「A」（右下）**: Plan 2 の自作 SVG/CSS を **`mk1-plate` / `wax-seal-a` の実素材 PNG に差し替え**（pointer-events:none・decorations ゲート・Lightbox でフェード、Plan 2 の mount 構造流用）。緑「+」は **装飾スタンプのまま**（非機能、Plan 2 決定維持）。

### 3.6 Lightbox
- **スクリム**: paper は淡色（Plan 2 で `--lightbox-backdrop` トークン化＋上書き済）。維持。
- **額縁**: 拡大時の media を **羊皮紙の額縁**で囲む（任意・磨き）。slice 1 はスクリム淡色＋既存 FLIP 維持で可。

---

## 4. 横断不変条件（Plan 2 から継続・厳守）
- **default byte-identical**: 全 paper 素材/トークンは paper ブロック限定＋`var(--token, default)`。素材 URL も paper のみ。
- **非干渉**: 装飾・額縁・署名は箱の外箱寸法（FLIP origin）を変えない。装飾は pointer-events:none。
- **perf**: 常時 canvas/GPU/backdrop-filter 無し。素材は tile/共有デコードで軽量。4K 合成律速に負荷を足さない。
- **reduced-motion / motionEnabled**: 全モーション（ドリフト/パララックス/インク演出/メーター状態差）は3層ゲート。
- **決定論**: 台紙・装飾・スタンプは `card.id` シードで安定（毎 render 不変）。
- **i18n**: 新規の文章 UI が出たら15言語同期（chrome ラベルは ALL-CAPS 据え置き、署名はデータの title なので翻訳不要）。

---

## 5. テスト＆検証
- **素材ロード fallback**: 素材未配置時に paper が Plan 2 CSS 見た目に degrade すること（壊れない）を確認（存在/非存在の両方）。
- **default 不変**: paper トークン/素材が default に漏れないこと（CSS スコープ・var fallback テスト）。
- **非干渉**: 台紙＋インセット＋装飾でドラッグ/リサイズ/Lightbox FLIP が不変（箱 rect 不変の静的確認＋可能なら実機）。
- **決定論**: 台紙/装飾割当が `card.id` で安定（純関数テスト）。
- **視覚**: user が `allmarks.app` で実機確認（スクショ撮影は私が手を割かない方針＝[[feedback_user_self_verifies_visuals]]）。素材投入→デプロイ→user 校正フィードバック→トークン/配置微調整の反復。
- deploy 前ゲート: `rtk tsc && rtk vitest run && rtk pnpm build`。既知フレーキー channel.test。

---

## 6. user に判断してほしい点（設計の確定前に）
1. **カードの署名（キャプション）**: 完全再現として、台紙の下に **bookmark の title をセリフ墨で印字**する（モック準拠）。Plan 2 の「キャプション無し」を**反転**して採用、でOK？（無し希望なら台紙＋写真だけにする）
2. **ヘッダー書体**: chrome ボタンを **セリフ（Fraunces）スモールキャップス**、注記は**手書き（Caveat）**に。これでOK？（等幅のまま残したい要素があれば指定）
3. **ヘッダーのモーション**: 既存の **RGBグリッチ/scramble を paper では廃止 → 穏やかなインク演出**に。OK？
4. **メーターの状態差（hover/ドラッグ/慣性/エンドストップ）**: slice 1 は「素材化＋基本動作」、凝った状態差は磨きフェーズで段階追加、でOK？

---

## 7. 実装の段取り（writing-plans で計画化する単位の目安）
各面「器を素材対応に → 素材到着で差し替え → 校正」。素材が一番効くカードを軸に：
1. 素材ロード基盤＋fallback（`public/themes/paper-atelier/` 参照のトークン/ヘルパ、未配置 degrade）。
2. 背景タイル本物化。
3. **カード本物化**（台紙＋インセット＋署名＋装飾素材化）＝最大の山。
4. メーター本物化（紙帯＋紙片タブ）。
5. chrome 書体＋モーション（セリフ/手書き＋インク演出）。
6. ワードマーク活版＋MK-1/蝋封 素材化。
7. 全体 校正（モック比、user フィードバックでトークン/配置を寄せる）。
8. tsc/vitest/build → デプロイ → user 実機校正反復。

> 各段は「素材が無くても壊れない」ので、**素材が揃った面から順に本番反映**できる（user の素材生成と非同期で進む）。
