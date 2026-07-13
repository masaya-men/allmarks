# 次セッションのゴール — スマホ縦4:5 段階1 の実機確認 → OK なら段階2（業界水準チロム）の詳細計画

## ★出荷済（s192・2026-07-13）: スマホのコラージュ＝縦4:5 段階1（土台）を本番反映

縦4:5 段階1 を subagent-driven（Task 1〜4＝安価モデル中心＋各レビュー＋opus 全ブランチレビュー Ready=YES・Critical/Important ゼロ）で完遂。tsc0 / vitest 282ファイル2341緑 / build OK（assert-share-template OK）/ playwright mobile-share 11/11 / `merge --no-ff` 808e2ad1 / `allmarks.app` デプロイ済。

- モバイルのコラージュ編集（帯）・撮影・保存が**縦4:5（1080×1350）**に。プレビュー＆ネイティブ共有は縦画像（`capturedImageUrl`）。
- リンクカード用 1.91:1 は**縦画像を中央レターボックスで自動併産**してホスト（`letterboxImageToAspect`・サーバー/OG/payload 無改変＝ホストOGは1.91:1のまま＝メタ正当）。
- デスクトップ >640px はバイト同一。`renderCollageCanvasToJpeg` 本体無改変。
- 計画 `docs/superpowers/plans/2026-07-13-mobile-portrait-collage-stage1.md`・設計 `docs/superpowers/specs/2026-07-13-mobile-portrait-collage-redesign-design.md`。

## ★最優先＝段階1 の実機確認（実タッチ・実際の共有カードの見えは実機のみ）

スマホで `https://allmarks.app` をハードリロードして:
1. SHARE → 全選択 → ARRANGE。編集エリアが「**縦長（4:5）**」になっているか（横長の帯ではなく）。
2. 縦のまま並べる・大きさ・回す。CREATE。
3. 出てくる**プレビュー画像が「縦」**か。保存/共有すると縦画像か。
4. できたリンクを PC の X やチャット等に貼ると、**カードは横長(1.91:1)で、その中央に縦コラージュが載っている**か。
5. **100枚でも破綻しない**か。

- **OK** → 段階2 へ。**気になる点**（縦の見え・レターボックスの余白色・帯の高さ）→ その1点をブレスト→調整して再デプロイ。

## ★OK後＝段階2（業界水準の編集チロム）の詳細計画を書いて実装

段階1 の縦4:5 の上に載せる。**着手前に superpowers:brainstorming**（勝手に設計しない）。設計概要は spec §段階2:
- 選択時コンテキストツールバー（前面/背面・削除・`data-no-capture`）／重なり順操作（`collageOrder` に対する `bringForward`/`sendBackward`/`sendToBack`）／スナップ＋触覚（`navigator.vibrate`）／ドラッグ削除／取り消し・やり直し（`collagePositions`/`collageRotations`/`collageOrder` のスナップショット履歴）／上部バー再設計＋**ズームはスライダー廃止→ピンチ＋ダブルタップfit**（100枚到達性を担保）。
- **要設計論点**（詳細計画時に詰める）: 複製の instance-id 問題（同一 `bookmarkId` キー衝突＝段階2初回は複製を外す or 別設計）／undo/redo の履歴粒度／ズームのスライダー廃止と100枚到達性の両立。

## バックログ（後で・ユーザー要望）

- **PC（デスクトップ）のコラージュが業界水準かの調査**（四隅リサイズ・ホバー回転ノブ・レイヤー・整列を業界水準と比較して差分を洗う。競合名は tracked docs に書かない＝`docs/private/` へ）。

## 絶対に守ること（恒久ルール・継承）

- スマホ SHARE の撮影は canvas 直描画（`renderCollageCanvasToJpeg`）＝dom-to-image に戻さない。デスクトップ SHARE は dom-to-image のままバイト同一。
- **縦4:5 の二本立てを崩さない**: `capturedImageUrl`＝縦（プレビュー＆ネイティブ共有）／ホスト `thumb`＝1.91:1 レターボックス（リンクカード）。レターボックス失敗時は `thumb: undefined`＝リンクは作る。
- 編集した位置/サイズ/回転/重なり順は完成画像に反映（z順=`collageOrder`）。
- デスクトップ >640px は 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微・競合名は `docs/private/`／vitest・playwright は素の `npx`（`rtk npx` は誤解析）。
- 新しい操作系・見た目は着手前に superpowers:brainstorming。
