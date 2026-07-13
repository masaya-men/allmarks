# 次セッションのゴール — スマホ縦4:5（段階1＋段階2第1弾）の実機確認 → OK なら段階2 第2弾の詳細計画

## ★出荷済（s193・2026-07-13）: スマホ縦4:5 段階2・第1弾（編集チロムの核）を本番反映

段階1（縦4:5 土台）に続けて、同一セッションで段階2・第1弾まで subagent-driven で完遂・デプロイ済（`allmarks.app`・merge 1ff07486）。tsc0 / vitest 286ファイル2357 / build OK / playwright 15/15 / opus 全ブランチレビュー Ready=YES。

**段階2 第1弾＝縦4:5 の上に載せた編集道具の核**（データ変更ゼロ・in-memory）:
- **選択時ツールバー**（上部・`data-no-capture`）: カード選択で **TO FRONT / TO BACK / DELETE**。常時 **UNDO / REDO**。撮影中(~1-2秒)は上部バー非表示（編集不可）。
- **取り消し/やり直し**（1操作=1手・退場で破棄）。
- **余白ダブルタップで整列**（ボードズームを1倍に戻す・既存スライダー/2本指ズームは温存）。
- 計画 `docs/superpowers/plans/2026-07-13-mobile-portrait-collage-stage2-increment1.md`・設計 `docs/superpowers/specs/2026-07-13-mobile-portrait-collage-stage2-increment1-design.md`。

## ★最優先＝実機確認（段階1＋段階2第1弾をまとめて。実タッチ・共有カードは実機のみ）

スマホで `https://allmarks.app` をハードリロードして:

**段階1（縦4:5）**
1. SHARE → 全選択 → ARRANGE。編集エリアが**縦長(4:5)**か。並べて CREATE → **縦のプレビュー画像**か。
2. リンクを PC の X 等に貼ると、カードは横長(1.91:1)で中央に縦コラージュが載るか。100枚で破綻しないか。

**段階2 第1弾（編集道具）**
3. ARRANGE で上部に **UNDO / REDO** が出ているか。
4. カードを1つタップ → 上部に **TO FRONT / TO BACK / DELETE** が出るか。TO BACK で後ろへ・TO FRONT で最前面へ来るか。
5. **DELETE** でカードが消え、**UNDO** で戻り、**REDO** でまた消えるか。指1本で動かした後・2本指で拡縮/回転した後の **UNDO** も効くか。
6. 指2本 or スライダーでズーム → **余白を素早く2回タップ** → 全体表示に戻るか。
7. CREATE で作った画像に編集結果（重なり順・削除）が反映され、UNDO/REDO/上部バーは**写らない**か。

- **OK** → 段階2 第2弾へ。**気になる点**（見た目・操作感）→ その1点をブレスト→調整して再デプロイ。

## ★OK後＝段階2 第2弾の詳細計画（着手前に superpowers:brainstorming）

第1弾の上に載せる（設計概要は spec §段階2 / §スコープ外）:
- **複製**（`bookmarkId` 単一キー→**インスタンスID層**が要る＝positions/order/rotations/render key/capture の5箇所を貫く・in-memory・DB移行なし）。
- **吸着＋触覚**（位置スナップ＋緑ガイド＋`navigator.vibrate`・回転スナップ `collage-rotate.ts` が手本・ドラッグ choke point は `onMove`→`moveElement`）。
- **ドラッグ削除の演出**（ゴミ箱ゾーン・TAG モードの `elementFromPoint`+`data-*` が手本）。
- **前へ/後ろへ の単一ステップ**重なり順（第1弾は前面/背面のみ）。
- **ズームのスライダー廃止**（ピンチ＋ダブルタップ整列が100枚で到達性を担保できると実機確認できてから）。
- 事実マップ: memory `reference_stage2_mobile_collage_factmap`（何が既存/再利用/新規か）。

## バックログ（後で・ユーザー要望）

- **PC（デスクトップ）のコラージュが業界水準かの調査**（四隅リサイズ・ホバー回転ノブ・レイヤー・整列を業界水準と比較。競合名は `docs/private/` へ）。

## 絶対に守ること（恒久ルール・継承）

- スマホ SHARE の撮影は canvas 直描画（`renderCollageCanvasToJpeg`）＝dom-to-image に戻さない。デスクトップ SHARE は dom-to-image のままバイト同一。
- **縦4:5 の二本立てを崩さない**: `capturedImageUrl`＝縦（プレビュー＆ネイティブ共有）／ホスト `thumb`＝1.91:1 レターボックス（リンクカード）。
- 編集した位置/サイズ/回転/重なり順は完成画像に反映（z順=`collageOrder`）。削除は3マップから実除去。取り消し/やり直しは編集 state 差し替え。ボードズーム（ダブルタップ整列含む）は `stageTransform` のみ＝画像無影響。
- デスクトップ >640px は 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微・競合名は `docs/private/`／vitest・playwright は素の `npx`。
- 新しい操作系・見た目は着手前に superpowers:brainstorming（勝手に設計しない）。
