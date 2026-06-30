# 次セッションのゴール (= セッション 143)

## 今の状態（セッション142で完了・allmarks.app 反映済・GitHub push 済）

Paper テーマの台紙リデザイン（N-13）をユーザー対話で完遂 ＋ ドラッグ並べ替えの重大バグを発見・修正 ＋ ドラッグ重さの最適化 ＋ **収益化モデル(A)をブレストで確定**。全て本番反映・**tsc0 / vitest1821 / build OK**・default(黒+音波) 無傷。今セッション 13 コミット。**ユーザー実機確認済: 並び順=新しいものが上になった（V3 OK）／白い下地・破れ角の破綻も解消**。PCクラッシュ復旧も完了。

### 台紙リデザイン（N-13、1コミット=1確認で進行）
- **②写真は台紙に直接 cover**（白い窓下地 `--paper-window-bg` 撤去、見切れOK）
- **①台紙を高解像9種に刷新** — ユーザーが Figma「60+ Free Vintage Paper Textures」マスターシート（`C:/Users/masay/Downloads/...png`, 9156×29860）から番号ピッカーで選定（5,15,17,28,32,33,35,41,52）→ 高解像で切り出し1100px JPEG（`card-mat-s*`）。低解像/壊れた旧 mat（1/2/3/aged/lined/grid）はプール除外。共有定数 `IMAGE_CARD_BACKING_POOL`（lib/board/paper-assets.ts）を board(ImageCard) と share(ShareMirror) で同期
- **方眼/ノートのシートを画像カードにも使用**（全URL、ユーザー要望）。`card-paper-graph/notepad` を `background-size:100% 100%` 全面表示、写真は窓に乗る＝「ノートに写真を貼った」見た目
- **白い下地3連バグを修正**: (a) シート透明部(破れ端/穴)の裏の ivory 2層(.imageCard/.paperCard 背景)を transparent (b) 矩形 1px ボーダーの幽霊枠を `border-color:transparent` (c) 破れシートの影を矩形 box-shadow→アルファ追従 drop-shadow。全て **実描画(playwright repro)+ 実CSS grep で検証**
- **破れシートでは写真コーナーを抑制**（矩形角に固定→破れ角で浮く破綻）。`paperCardHasTornBacking()`（cards/index.ts、ImageCard と同じ seed+プールで判定）

### ドラッグ並べ替えの重大バグ修正（既存バグ・今回発見）
- **真因**: `computeVirtualOrder`(use-card-reorder-drag.ts) が **ASC** ソートなのに盤面表示は **DESC**（新しい順, use-board-data.ts:270）。掴むとプレビューが逆順化→振動、ドロップで並びが逆向きに保存されていた → **DESC に統一**（回帰テスト use-card-reorder-drag.test.ts 2本追加）
- **重さ**: paper 装飾(PaperCardDecorations)が毎フレーム全カード再描画 → **`React.memo` + tornBacking を useMemo Map 化**で軽量化
- **並び順の復元**: 逆転保存された並びを **`orderIndexRepairV3`（一度きり）** で savedAt 降順に再ソート＝新しいものが上。非破壊（orderIndex のみ・再導出可、削除/スキーマ変更なし）。V2 と同じ仕組みを flagKey でパラメータ化
- **ドラッグの重さ最適化**: `computeVirtualOrder` を O(N²)→ほぼ O(N·48) に。挿入候補を直前ベスト位置の近傍（半径48）に窓化＋作業配列使い回し＋窓端で全探索フォールバック（結果は同一）。`lastBestIndexRef` で追跡。テスト2本追加（計4本）。**ユーザー体感の最終確認は次回**（まだ重ければ完全 O(N) 化）

### 収益化モデル(A) 確定（ブレスト済・正本は docs/private/、commit しない）
- **正本**: `docs/private/2026-06-30-monetization-model-design.md`（gitignored・機微）。memory `project_monetization_model` にも要約。
- 目標 月20-30万・継続課金・本気。**現状0人/プレローンチ**＝収入の本当のレバーは集客。
- モデル: サポーター型ブレンド／デフォルト＋**Paper は無料の看板**／有料は**プレミアム2-3本＋今後**を月額（**¥500/¥1,500 の2階層**）／**署名キー・サーバー無し・no-account 解錠**／決済は Patreon or FANBOX（Bで確定）。

## 次にやる（セッション143）= 最優先 (B) 集客/ローンチ計画
1. **(B) 集客/ローンチ計画のブレスト**（＝「生計を立てる」の本丸）。0人→1万人規模へ: テーマ完成→ツイートの出し方／Product Hunt／作品としての見せ方／無料 Paper の共有画像を拡散の起爆剤に 等。決済プラットフォーム(Patreon/FANBOX)もここで確定。
2. その後 **(C) 実装**: 署名ライセンスキー解錠＋有料テーマ gating＋プレミアムテーマ2-3本制作（writing-plans へ）。
3. **ドラッグの軽さ**の体感最終確認（窓化後）。まだ重ければ完全 O(N) 化。
4. 持ち越し: **N-12 ライトボックス開閉アニメ**実機確認（s141から）／余力で **N-09 影強度** / **N-10 共有テキストカード紙パリティ**。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **台紙系・装飾は実描画(playwright repro)を見てからデプロイ**（推測で直さない＝今セッションの教訓。白い下地を3回出した）
- board のドラッグ/カードクリックは playwright 不可（setPointerCapture）→ 実機確認に頼る。paper 再現は IDB `settings/board-config` に `themeId:'paper-atelier'`
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語、簡潔に
