# 次セッションのゴール — N-58 段階2（スマホのコラージュ編集の操作系）を「再ブレスト → 実装」

## ★N-58 段階1 は完了・実機確認済（s190・2026-07-12）

スマホの共有を「ARRANGE で編集段に入る → 動かす・大きさ・回す・重なり順 → CREATE で撮影」の2手に分割。**ユーザー実機確認済＝「画像、編集したとおりに出た」**（回転も反映）。N-55 も解消。`allmarks.app` デプロイ済。詳細 [TODO.md](TODO.md) s190・[TODO_COMPLETED.md](TODO_COMPLETED.md) s190・memory `project_n58_stage2_gesture_model`。

## ★最優先＝N-58 段階2 の操作系を「再ブレスト」してから実装（superpowers:brainstorming 必須）

段階1 の実機で、ユーザーが**段階2の操作モデルを提案**（＝旧計画 `2026-07-11-n58-stage2-pinch-zoom-pan.md` の「1本指=カード／2本指=ステージ」とは別モデル）。**旧計画はそのまま実行しない**（計画書の頭に ⚠️ バナー差し込み済）。

**ユーザーの実機フィードバック（正本）:**
1. **常時表示の回転ノブが「出っぱなしで操作しづらい」** — 現状のスマホ編集の弱点。
2. **スマホの標準操作（Canva 等）にしたい**＝**カードを1回タップで選択 → その選択カードを「ピンチで拡縮」「二本指で回転」**。四隅リサイズ＋常時ノブはスマホでは廃止方向。
3. **ボード自体の拡縮ができない**（今できない）＝ステージのズーム/パンも要る。

**ブレストで詰める設計論点:**
- ① 「選択カードのピンチ＝カード変形」と「ステージ全体のピンチズーム/パン」をどう両立するか（例: カード選択中は2本指=カード変形／非選択時は2本指=ステージ、等）。
- ② タップ選択の選択枠 UI（どのカードが選択中か）。
- ③ ドラッグ移動の扱い（選択後にドラッグ=移動？）。
- ④ 常時ノブの廃止と二本指回転への置換（**回転自体は残す**＝スマホでも表現を削らない。memory `feedback_mobile_must_express_too`）。
- ⑤ 100枚時のステージズーム（旧計画の倍率1〜6・撮影直前 transform リセットの土台は流用できる）。

**不変（段階1で確定・崩さない）:** 撮影系は段階1のまま（編集中だけ transform、撮影直前にリセット）／デスクトップ >640px は不変／回転は canvas レンダラーが既に画像へ反映済／z順は `collageOrder`・回転は中心まわり。

## 段階2 でついでに取り込む（s190 opus レビューの deferred minor・非ブロッカー）

1. 撮影中の BACK で孤児 /s シェアができる（creating 中 BACK を disable、or 撮影後に「まだ arrange 中か」でガード）。
2. `MobileBandOverlay` の NaN 帯を `!(band.width > 0) || !(band.height > 0)` に締める。
3. 回転テスト(f) を `mock.invocationCallOrder` で translate→rotate→translate 順に。
4. `BoardRoot` の canvasCards 構築（`collageOrder`）に「盤面順でなく重なり順を焼く」1行コメント。
5. **（判断要・INFORMATIONAL）** 共有**画像**は編集どおりだが `/s` **ページ**再構成は盤面順（`buildArrangeShare`＝`selectedInBoardOrder`・デスクトップと同一・N-58 の回帰ではない）。/s ページにも編集配置を載せるかは**ユーザー判断**（載せるなら payload に配置データを足す別タスク）。

## 実行順（ロードマップ・s190 更新版）

**N-56 ✅ → N-58段階1 ✅（実機確認済）** → **N-58段階2（次・再ブレスト）** → N-57+59 → N-54 → N-53 → CUTOUT → **TOWER（公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT → 花火: K3 + cyber-space＋プレミアム群

## 絶対に守ること（恒久ルール・継承）

- 撮影は実機でしか検証できない／ボードを変えたら受け取り画面も確認／`fit:'cover'` 固定／`CardsLayer` に `isMobile` 渡さない／デスクトップ >640px は 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ／**vitest は素の `npx vitest run`**・**playwright も素の `npx playwright test`**（`rtk npx` は誤解析）。
- **スマホ SHARE の撮影は canvas 直描画（`renderCollageCanvasToJpeg`）＝dom-to-image に戻さない**。デスクトップ SHARE は dom-to-image のままバイト同一。
- **編集した位置/サイズ/回転/重なり順はすべて共有画像に反映**（z順=`collageOrder`・回転=レンダラー）。この不変条件を壊さない。
- 新しい操作系は着手前に **superpowers:brainstorming**（勝手に設計しない）。
