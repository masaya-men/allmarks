# 次セッションのゴール — N-58 段階1 の実機確認 → OK なら N-58 段階2（ピンチズーム＋パン）

## ★N-58 段階1 は完了・本番反映（s190・2026-07-12）

スマホの共有を「CREATE で即撮影」から「**ARRANGE で編集段に入る → 指で動かす・大きさ・回す・重なり順 → CREATE で撮影**」の2手に分割。スマホでも PC と同じようにコラージュできる。**N-55（撮影後もシート裏でコラージュが触れる）もスクリムで同時解消**。回転は**ユーザー確定「PC と同じく画像にも反映」**で canvas レンダラーに追加済み。tsc0 / vitest 2296/2296 / build OK / playwright mobile-share 7/7 / opus 全ブランチレビュー Ready to merge（Critical/Important ゼロ）/ `merge --no-ff` / `allmarks.app` デプロイ済。詳細は [TODO.md](TODO.md) s190・[TODO_COMPLETED.md](TODO_COMPLETED.md) s190。

## ★最優先タスク（1）: 実機確認（撮影は実機でしか検証できない）

**ユーザーに以下を依頼（コピペ済み・下記の手順を実機で）。回答＝1行判断で段階2の優先度・倍率・既定表示を調整する。**

```
スマホで https://allmarks.app をハードリロードして:
1. SHARE → 何枚か選ぶ → ARRANGE。明るい帯と「DRAG TO ARRANGE…」のバーが出ますか？
2. 帯の中のカードを指で動かす／四隅をつまんで大きさを変える／上の丸いノブで回す。
   → 操作の感触を教えてください（段階2=ピンチズームは実装確定済。ここでの感想は
      段階2の優先度と、ズーム倍率・既定表示の調整に使います）
3. CREATE → プレビューの画像が「自分が並べたとおり」（回転も含めて）になっていますか？
4. 結果シートが出た後、シートの上の空きでカードが動かないこと（以前は動いた＝N-55）
5. RETRY IMAGE（出た場合）で並べた配置が保たれたまま撮り直されること
```

- **OK** → 段階2（ピンチズーム＋パン）へ。**未対応**なら症状採取 → systematic-debugging。

## ★最優先タスク（2）: N-58 段階2 ピンチズーム＋パン（計画書あり・確定）

- [計画書 2026-07-11-n58-stage2-pinch-zoom-pan.md](superpowers/plans/2026-07-11-n58-stage2-pinch-zoom-pan.md)。方式確定＝**編集中だけ wrapper に CSS transform（scale+translate）を掛け、撮影直前に transform をリセットして撮る**（撮影系 0 行変更）。2本指=ステージ拡縮/パン・1本指=カード操作。**ズーム中はポインタ差分を zoom 倍率で割ってレイアウト座標へ**戻す配線が要る。100 枚は段階2で実用になる。

## ★段階2 でついでに取り込む（s190 opus レビューの deferred minor・いずれも非ブロッカー）

1. **撮影中の BACK で孤児シェアができる** — creating 中は BACK を disable、or `handleMobileCaptureAndCreate` の後半 createHostedShare を「まだ arrange 中か」でガード（[BoardRoot.tsx](../components/board/BoardRoot.tsx) の `handleMobileCaptureAndCreate` / `MobileArrangeBar` の BACK）。
2. **`MobileBandOverlay` の NaN 帯素通り** — `!(band.width > 0) || !(band.height > 0)` に締める（防御のみ）。
3. **回転テストの順序未検証** — `collage-canvas-render.test.ts` の test (f) を `mock.invocationCallOrder` で translate→rotate→translate 順に。
4. **z順切替のコメント** — `BoardRoot.tsx` の canvasCards 構築（`collageOrder` 使用）に「盤面順ではなく collageOrder＝重なり順を焼く」の1行コメント。
5. **（判断が要る・INFORMATIONAL）/s ページの再構成が盤面順** — 共有**画像**は編集どおりだが、`/s` の**ページ**再構成は `buildArrangeShare`＝`selectedInBoardOrder` で盤面順（デスクトップと同一・N-58 の回帰ではない）。編集した並びを /s ページにも載せるかは**ユーザー判断**（載せるなら payload に配置データを足す設計＝別タスク）。

## 実行順（ロードマップ §1・s190 更新版）

**N-56 ✅ → N-58段階1 ✅（今回）** → **N-58段階2（次）** → N-57+59 → N-54 → N-53 → CUTOUT → **TOWER（公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT → 花火: K3 + cyber-space＋プレミアム群

## 絶対に守ること（恒久ルール・継承）

- 撮影は実機でしか検証できない／ボードを変えたら受け取り画面も確認／`fit:'cover'` 固定／`CardsLayer` に `isMobile` 渡さない／デスクトップ >640px は 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ／**vitest は素の `npx vitest run`**・**playwright も素の `npx playwright test`**（`rtk npx` は誤解析）。
- **スマホ SHARE の撮影は canvas 直描画（`renderCollageCanvasToJpeg`）＝dom-to-image に戻さない**。デスクトップ SHARE は dom-to-image のままバイト同一（触らない）。
- **編集した位置/サイズ/回転/重なり順はすべて共有画像に反映される**（z順は `collageOrder`・回転は canvas レンダラー）。この不変条件を壊さない。
- 拡張の一括取り込みは **Task 0（実 DOM 採取）完了まで selector を書かない**（s49 の教訓）。
