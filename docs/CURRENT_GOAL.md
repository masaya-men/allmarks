# 次セッションのゴール — 実機確認（②④中心）→ ⑤Pinterest(N-28) or 公開

## まず最初に（ユーザーへの確認）
- **s183 後半で PC盤面＋共有の磨き4点を出荷・本番反映済み**（実機確認待ち）:
  - **① テキストカードのフェード**：PC の醜いスクロールバー→両端フェード＋バー非表示（端まで行くとその側のフェードが解ける）
  - **② 共有受け取り画面**：スマホで3列に（1列化を解消）＋PCのメーターを今の位置に
  - **③ SHARE「作成中」表示**：撮影中に消えていた進捗を body に出して完了までずっと表示
  - **④ TUNEスナップ**：中央寄せ無し・左詰め維持・**今の列数のまま**左右マージン一致値に吸着（5列→4列に飛ばない）＋範囲で緑マークが光る
- **実機で確認してほしいこと**（Playwright 不可・実機のみ）:
  1. **②** スマホで共有リンク（`/s/...`）を開く→3列で並ぶ・カードのタップで開く/×で消える・メーターの位置
  2. **④** TUNE で W/G を動かす→離すと今の列数のまま左右が揃う（列数が変わらない）・範囲に入ると緑マークが光る
  3. **①** テキストカードのスクロールが両端フェードで自然か
  4. **③** 100枚シェアで CREATE→「CREATING YOUR LINK…」がずっと見えるか
- 束B（スマホ保存）も実機OK済み。**束A＋束B＝スマホで閲覧＋保存が揃った＝公開日宣言できる状態**。

## 次セッションでやること
0. **★最優先＝(N-46) 共有受け取り画面のスマホ・スクロール不全（必須改善・s183 実機FB）**: 100件共有→スマホ（プライベートウィンドウ）で開くと**3列にはなったがスクロールがさくさく動かない**。受け取り側がスムーズに見られないのは致命的ストレス。**原因未断定・要 systematic-debugging**。本命候補＝s183(N-43)で受け取り側に**幅（3列）だけ**移植し、本物盤面の**モバイル用ネイティブスクロール**（s179/s180 の `.mobileScrollContainer` overflow-y:auto ＋ カードの `touch-action:none→pan-y` 緩和）を**移植していない**→指がカードに落ちて縦スクロールが殺される s180 と同じ症状が受け取り側で再発の疑い。別候補＝画像多数のデコードジャンク。**受け取り側にモバイルスクロール機構を移植→実機確認**（合成イベント不可＝実機のみ、`reference_native_scroll_touch_action_playwright`／`reference_share_receiver_reuses_board`／s179/s180 narrative）。
1. **⑤ Pinterest 保存ボタン連動（N-28・優先度高・ユーザー確定）**: 拡張で Pinterest 自身の「保存」ボタン押下→AllMarks にも自動保存（X like / YouTube like と同じ per-site 方式）。**s49 で一度作って実機で動かず外した所**＝まず**実機で保存ボタンの実 DOM をダンプして本当の属性を特定**する1手から（note.js/vimeo.js が s49 でやった手法）。code は git history に生存。他の拡張修正（N-25 タグ0件・N-29 設定導線）と**束ねて1回でストア再審査**。
   - ※Pinterest の URL を通常保存するのは今でも動く（Pin ページの OGP 完備）。未対応は「Pinterest のボタン連動」だけ。
2. **or 公開関連**（束C 13言語・規約正文条項 / 公開素材 / 束E 総仕上げ）。
3. **N-45 掃除**（任意）: 旧 SHARE e2e 3本が消えた `share-composer` testid を参照＝フル e2e で赤（本ブランチ由来でない既存腐り）。削除 or 書き直し。

## s183 後半の実装の在り処（次セッションが触るとき用）
- **④** 純関数 `lib/board/fill-snap.ts`（`currentColumnCount`/`fillValueAtColumns`/`snapToFillAtCurrentColumns`）＋`components/board/FaderColumn.tsx`（単一候補マーク＋`data-in-range` 光る）。
- **①** `components/board/cards/PlaceholderCard.tsx`（`computeTagScrollEdge` 流用・`data-scroll-edge`）＋`.module.css`。
- **②** `components/share/SharedBoard.tsx`（`useIsMobile`＋`MOBILE_LAYOUT` 幅導出・メーターを `frame.frameBottomChrome`）。
- **③** `components/board/ShareCreatingIndicator.tsx`（body portal・`BOARD_Z_INDEX.SHARE_CREATING`）＋`BoardRoot.tsx`。
- 正本 [spec](superpowers/specs/2026-07-09-board-share-polish-batch-design.md) / [plan](superpowers/plans/2026-07-09-board-share-polish-batch.md)。

## 直近のリリース段取り（参考・`docs/private/2026-07-08-release-runway-plan.md`）
束A スマホ閲覧（完了）→ 束B スマホ保存（完了・実機OK）→ **公開日宣言可** → 束C 13言語＋規約 → 束D 公開素材 → 束E 総仕上げ・公開。拡張の Pinterest(⑤/N-28) は並行の別枠。
