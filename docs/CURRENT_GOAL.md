# 次セッションのゴール (= セッション 134)

## 今の状態（セッション133で完了）
paper-atelier をサブエージェント駆動で本番反映（8タスク）→ その後 **対話ブラッシュアップ7本**を直接 master で実装・各回デプロイ。本番 `allmarks.app`、全 commit/push 済み。tsc0 / vitest 1790 / build OK。default(黒+音波)は byte-identical 維持。

ブラッシュアップ済み（session133）:
1. カードの立体感（層状ドロップシャドウ＋羊皮紙の縁）
2. 額縁内再生（再生オーバーレイを `--paper-frame-inset` で羊皮紙の写真窓に収める）＋ chrome3点(FilterPill/TUNE/言語)を paper化 ＋ キャプション手書き(Yomogi)
3. 写真コーナーの向き（1枚をCSS回転）＋ メーターハンドルを帯内に収める ＋ FilterPill/TUNE の常時スクランブル停止（共通フック `useIsPaperTheme`）
4. 装飾を豪華に（本物の文字スタンプ7・アイコンスタンプ12・蝋封・washi+4・金A封蝋）= シート9/10から26点
5. 本物の羊皮紙背景（固定backdrop）
6. 市松バグ修正（クリーン羊皮紙へ）＋ 紙の上に紙（角丸パネル＋外側面）
7. **3層パララックス完成**: 下=固定羊皮紙(0x) / 中=汚れ・金罫・蝋封を散らし0.7xでスクロール(`BoardDecorLayer`/`lib/board/board-decor.ts`) / 上=カード1x

## 次にやる（user 要望キュー）
1. **パララックスのブラッシュアップ**（density/大きさ/透明度/速度の調整、インク染み等の素材追加、配置の前後関係）← user 次の主目的
2. **ライトボックスの羊皮紙化**（user「必ず」。FLIPモーフが絡む単独タスク。Lightbox.tsxはmediaのみFLIP拡大＋clone host z300 → 羊皮紙台紙を拡大ビューにも描く）
3. **メーター刷新**（高品質ルーラー `ruler-meter-strip-3` 配置済・未使用 ／ 走らせるサムを紙タブ/クリップに）
4. **装飾追加**（ラベル付きクリップ NOTE/IDEA・紙タブ・バナー等。シート在庫あり）
5. **外側の面**を本素材に（今はクリーン羊皮紙の仮置き）／ 背景variant選択（parchment-bg / -plain / -frame）

## 守ること
- 本番 `allmarks.app`。default(黒+音波)は **byte-identical** 維持。自由リサイズ壊さない。装飾/署名は pointer-events:none・極端サイズでクランプ。
- **保留素材トークンは `none` でなく `initial`**（var フォールバックの罠）。素材未配置の面は CSS/旧表現に graceful degrade。
- 偽透明（焼き込み市松）に注意：sharp で alpha 実測＋目視。画像は不透明/透明を必ず確認。
- deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`、`--branch=master --commit-message`(ASCII)。応答は日本語。視覚は user 直接確認。
- **4K perf watch（最重要・新規）**: パララックス層＋カード装飾PNG多数＋scatter img で fill-rate 負荷増。常時 canvas/GPU/backdrop-filter 禁止は維持。重さを感じたら scatter 数/装飾率を下げる。
- 既存フォローアップ: e2e シード v9→16、useTweetTranslation 引数リネーム。既知フレーキー channel.test。

## 主要ファイル（paper 関連）
- 素材マニフェスト: `lib/board/paper-assets.ts`（true/false で配置管理、`pickPaperAsset`）
- 背景/パネル: `app/globals.css`(paper block) / `components/board/themes.module.css`(.paperAtelier) / `BoardRoot.module.css`(.canvas/.outerFrame paper) / `components/board/themes.module.css`
- 中間層: `lib/board/board-decor.ts` + `components/board/BoardDecorLayer.tsx` + `use-paper-parallax.ts`(factor) + BoardRoot 配線
- カード: `cards/ImageCard.tsx`(.paperCard/Photo/Caption) / `decorations/paper-decorations.ts` + `PaperCardDecorations.tsx`
- メーター: `scrollmeter/RulerTrack.tsx`
- chrome: `ChromeButton`/`FilterPill`/`TuneTrigger`/`LanguageSwitcher`(.module.css paper rules) + `chrome/PaperWaxSeal`/`PaperFramePlate`
- 配置済み未使用素材: `ruler-meter-strip-3`(番号ルーラー)、`parchment-bg-plain`/`-frame`、deckle-edge-mat 等
