# 次セッションのゴール — スマホのアレンジUX作り直しの「実機確認」→ OK なら段階2の残りへ

## ★このセッション（s194）でやったこと＝作り直しを実装・本番反映（自走）

`mobile-arrange-ux-redesign` ブランチで subagent-driven-development（6タスク・安価モデル中心：T1/T2 haiku・T3〜T6 sonnet＋各タスクレビュー＋**opus 全ブランチレビュー Ready to merge=YES・Critical/Important ゼロ**）→ ゲート → `merge --no-ff`（master `2a6b10dd`）→ `allmarks.app` デプロイ済 → docs 更新。

- tsc0 / **vitest 287ファイル 2360** / build OK（assert-share-template OK）/ **playwright mobile-share 19/19**。
- 入れたもの: ①9:16縦（`SHARE_PORTRAIT_ASPECT` 1080×1920・定数1箇所）②削除トースト i18n `board.collageRemoveToast`（15言語）③`MobileArrangeDock`（チロム集約：↺↻／−⤢＋／BACK／CREATE＋選択時に TO FRONT/TO BACK/🗑）＋`MobileArrangeToast`（母国語トースト＋UNDO・body portal・z=`SHARE_REMOVE_TOAST` 404）④BoardRoot 配線（旧 TopBar+Bar+スライダー撤去・ボードズームボタン・削除トースト・撮影中は編集不可 gating）⑤PC ホバー×削除（`collage-remove-<id>`・承認済みの意図的デスクトップ変更）⑥e2e。
- 不変条件（opus 実コード検証）: **リンク payload（`buildArrangeShare`）無改変＝DELETE は画像だけ**（e2e が実 POST body で全URL残存を検証・モバイル＋PC 両方）／撮影 state ベース／ジェスチャー無改変／デスクトップは PC 削除以外バイト同一／9:16 定数1箇所（ホストOGは1.91:1のまま）。

## ★次セッション最優先＝実機確認（作り直し版をまとめて）

`allmarks.app` を**ハードリロード**（ブランチ preview URL は使わない）→ SHARE → 全選択 → ARRANGE:
1. 画面がほぼコラージュ＋下に細い専用ドック（↺↻／−⤢＋／BACK／CREATE）だけになっているか。
2. カードをタップ→上に 前面へ/背面へ/🗑 が出る。1本指移動・2本指で拡縮回転できるか。
3. −／＋ でボードが拡縮、⤢ で全体表示に戻るか。
4. 🗑 で画像から外れ、母国語トースト「画像から外しました…」が出て、UNDO で戻るか。
5. CREATE の画像が縦長(9:16)でスマホを埋める形か。貼ったリンクのカードは横長中央に縦帯か。
6. PC でも SHARE→並べる→カードにマウス→× が出て、押すと画像から外れる（リンクは減らない）か。

## ★OK だったら → 段階2の残りの詳細計画（着手前に superpowers:brainstorming）

複製（instanceID・in-memory・DB移行なし）／位置スナップ＋触覚（`navigator.vibrate`）／ドラッグ削除の演出／重なり順の単一ステップ（前へ/後ろへ）。

## 既知の残（opus が defer 判定・非ブロッキング・実機で気になれば拾う）
- トーストが連続削除で「毎回」再アニメしない（同一インスタンスが残る＝nonce key 化で解決可能）。
- ドックの↺ とトーストの UNDO が両方 `handleCollageUndo`＝4秒以内に両方押すと二重 undo で1つ前の編集まで戻り得る（空スタック guard で有界・低確率）。
- 旧 `MobileArrangeTopBar`/`MobileArrangeBar`/`MobileZoomSlider`＋3テストが未使用で残存（tree-shake 済・後日まとめて削除）。
- PC ×は 24×24px（≥32px 方針より小さいが、回転ノブ等の兄弟デスクトップ affordance と同格・マウス専用）。

## 言語方針（s124＋s193 確定・恒久）
1単語の標準アクション（UNDO/CREATE 等）＝英語 or アイコン／**説明を含む文＝母国語（i18n・15言語）**。

## 絶対に守ること（恒久・継承）
- スマホ撮影は canvas 直描画（`renderCollageCanvasToJpeg`）。デスクトップ撮影は dom-to-image。
- **DELETE は画像だけ**（`buildArrangeShare` 無改変）。撮影は state ベース・ボードズームは `stageTransform` のみ。
- デプロイは `--project-name=allmarks --branch=master`。ユーザーは常に `allmarks.app` で確認。
- `rtk` 前置・`--no-verify` 禁止／機微・競合名は `docs/private/`／vitest・playwright は素の `npx`。
- 新しい操作系・見た目は着手前に superpowers:brainstorming。
