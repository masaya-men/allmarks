# 次セッションのゴール (= セッション 143)

## 今の状態（セッション142で完了・allmarks.app 反映済・GitHub push 済）

Paper テーマの台紙リデザイン（N-13）をユーザー対話で完遂 ＋ ドラッグ並べ替えの重大バグを発見・修正。全て本番反映・**tsc0 / vitest1819 / build OK**・default(黒+音波) 無傷（全変更 paper-scoped か paper-gate）。今セッション 10 コミット。

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

## 次にやる（セッション143）= ユーザー実機確認の集約
1. **ドラッグの軽さ**（memoize 後）を確認。まだ重ければ `computeVirtualOrder` の窓化最適化（545枚を毎回 simulateLayout している O(N²) を、ドラッグ位置近傍の候補indexだけに絞る）
2. **並び順 = 新しいものが上**になったか（V3 リロード後の実機確認）
3. **N-12 ライトボックス開閉アニメ**の実機確認（写真だけ額縁から抜ける/戻る・default LB 無変更）＝ session141 から持ち越し（未確認）
4. 余力で **N-09 影強度** / **N-10 共有テキストカードの紙パリティ**（ShareMirror に graph/notepad 描画）

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **台紙系・装飾は実描画(playwright repro)を見てからデプロイ**（推測で直さない＝今セッションの教訓。白い下地を3回出した）
- board のドラッグ/カードクリックは playwright 不可（setPointerCapture）→ 実機確認に頼る。paper 再現は IDB `settings/board-config` に `themeId:'paper-atelier'`
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語、簡潔に
