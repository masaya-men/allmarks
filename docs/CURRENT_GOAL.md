# 次セッションのゴール — スマホのアレンジUX作り直しを「計画どおり実装 → デプロイ」まで

## ★このセッション（s193）でやったこと

1. **段階1（縦4:5）＋段階2第1弾（編集チロム）を出荷・本番反映**（`allmarks.app`）。
2. その後、実機スクショを受けて**スマホのアレンジ体験を作り直す設計＋計画を完成**（コードは未実装）。段階1/2第1弾の一部（4:5・上部バー）を revert・置換する内容。

## ★次セッション最優先＝作り直しの実装（subagent-driven → デプロイ）

- **ブランチ**: `mobile-arrange-ux-redesign`（spec＋plan コミット済み・master にもマージ済み）。ここで実装を続ける。
- **計画書（完全・6タスク）**: `docs/superpowers/plans/2026-07-13-mobile-arrange-ux-redesign.md`
- **設計書**: `docs/superpowers/specs/2026-07-13-mobile-arrange-ux-redesign-design.md`
- **進め方**: subagent-driven-development（各タスクレビュー＋opus 全ブランチレビュー）→ 全体ゲート → `merge --no-ff` → `allmarks.app` デプロイ → docs 更新 → 実機確認依頼。
- **モデル割当**: T1(9:16定数) haiku／T2(トースト15言語) haiku／T3(ドック＋トースト部品) sonnet／T4(BoardRoot配線) sonnet／T5(PCホバー×) sonnet／T6(e2e＋ゲート) sonnet／最終 opus。

### 作り直しの中身（ユーザー承認済み・実装の要点）
- **指＝カード**（タップ選択／1本指移動／2本指＝選択カード拡縮回転）。**2本指ボードズームは温存**（`MobileArrangeGestures` 無改変）。
- **ボードズーム＝専用ドックの −／⤢(fit)／＋ ボタン**。
- **チロムを1つの `MobileArrangeDock` に集約＝画面最大**（`MobileArrangeTopBar`＋単体スライダー＋`MobileArrangeBar` を置換・上部バーと説明文は廃止）。取消/やり直し＝矢印アイコンのみ。
- **DELETE＝共有画像から外すだけ**（`buildArrangeShare`＝リンクのURLは無改変・ブックマークも無傷）。**外すたびに母国語トースト**（`board.collageRemoveToast`・15言語）＋UNDO。**モバイル＋PC 両方**（PC はカードにホバー×＝承認済みの意図的なデスクトップ変更）。
- **シェア画像＝9:16 縦**（`SHARE_PORTRAIT_ASPECT` を 1080×1920 に・定数1箇所で撮影/帯/レターボックス元が追従）。リンクカードは1.91:1中央帯（割り切り）。サーバー/OG 無改変。
- **流用（無改変）**: ジェスチャー・取消/やり直しの中身・純関数（`sendToBack`/`removeFromCollage`/`collage-history`）。

## ★実装後＝実機確認（作り直し版をまとめて）

`allmarks.app` ハードリロード → SHARE → 全選択 → ARRANGE:
1. 画面がほぼコラージュ＋下に細い専用ドック（↺↻／− ⤢ ＋／BACK／CREATE）だけか。
2. カードをタップ→前面へ/背面へ/🗑 が出る。1本指移動・2本指拡縮回転。
3. −／＋ でボード拡縮、⤢ で全体表示。
4. 🗑 で画像から外れ、母国語トースト「画像から外しました…」＋UNDO で戻る。
5. CREATE の画像が 9:16 縦でスマホを埋める形か。リンクは横長中央に縦帯か。
6. PC でカードにマウス→× で画像から外せる（リンクは減らない）か。

OK → 段階2の残り（複製[instanceID]・吸着＋触覚・ドラッグ削除演出）の詳細計画へ。

## 言語方針（s124＋s193 確定・恒久）
1単語の標準アクション（UNDO/CREATE 等）＝英語 or アイコン／**説明を含む文＝母国語（i18n・15言語）**。

## 絶対に守ること（恒久・継承）
- スマホ撮影は canvas 直描画（`renderCollageCanvasToJpeg`）。デスクトップ撮影は dom-to-image。
- **DELETE は画像だけ**（`buildArrangeShare` 無改変＝リンク＝選んだ全URL）。撮影は state ベース・ボードズームは `stageTransform` のみ＝画像無影響。
- デスクトップは PC 削除の追加を除き 1px 不変／`rtk` 前置・`--no-verify` 禁止／機微・競合名は `docs/private/`／vitest・playwright は素の `npx`。
- 新しい操作系・見た目は着手前に superpowers:brainstorming。
