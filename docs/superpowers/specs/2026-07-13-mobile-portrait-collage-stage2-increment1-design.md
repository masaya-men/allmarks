# スマホ縦4:5コラージュ 段階2・第1弾（編集チロムの核）設計書

> 対象: スマホ（`isMobile` / `<=640px`）の SHARE コラージュ編集（`sharePhase === 'arrange'`）。
> デスクトップ（>640px）は不変。段階1（縦4:5・出荷済 s192）の上に載る。
> ユーザー承認済み（2026-07-13・おすすめ (a)〜(d) を全承認）。

## 背景

段階1 で「スマホのコラージュ＝縦4:5」の土台が出荷済。段階2 は承認済みモックの「業界水準の編集道具」を段階的に載せる。事実採取（s192）で**大半が既存部品で安く作れ、DB 変更が要るのは複製だけ**と判明。第1弾は**データ変更ゼロ・最も編集アプリらしくなる核**に絞る。

## 確定した設計判断（ユーザー承認済み）

- **(a) 第1弾の範囲** = 選択時ツールバー（**前面/背面・削除**）＋重なり順の純関数＋**取り消し/やり直し**＋**ダブルタップで整列**。
- **(b) ズームは当面スライダーを残す**（＋ダブルタップ整列を追加）。ピンチ＋ダブルタップが100枚で到達性を担保できると実機確認できてからスライダー廃止を検討（第2弾）。
- **(c) 複製は第2弾へ先送り**（`bookmarkId` 単一キーの作り替え＝インスタンスID層が要る。DB 移行は不要だが第1弾を重くしない）。
- **(d) 取り消しは 1 操作＝1 手**（ドラッグ確定・リサイズ確定・回転確定・重なり順変更・削除の各1回で1手戻る）。

## 不変条件

- **デスクトップ（>640px）はバイト同一**: 追加は全て `isMobile` のモバイル経路。新コンポーネントは mobile arrange のみマウント。desktop の `ShareToast`/`handleCreateHostedShare`/dom-to-image は無改変。
- **撮影は編集 state から再描画（段階1・2共通）**: 削除は `collageOrder`/`collagePositions`/`collageRotations` から実際に除く＝撮影にも写らない（正しい）。取り消し/やり直しは編集 state を差し替え＝撮影は現在 state を反映（WYSIWYG）。**ボードズーム（ダブルタップ整列含む）は `stageTransform` のみ変更＝編集専用で画像に無影響**（`renderCollageCanvasToJpeg` は state から描く）。
- **撮影レンダラー `renderCollageCanvasToJpeg` 本体・共有サーバー・OG route・payload は無改変**（段階1 と同じ）。
- チロムは撮影に写さない（`data-no-capture`＝既存の `.outerFrame[data-capturing] [data-no-capture]{visibility:hidden}` を流用）。
- TS strict / `any` 禁止 / return type 明示 / CSS は `.module.css` / **z-index は `BOARD_Z_INDEX`**（新規に `SHARE_ARRANGE_TOOLBAR` を追加）。
- UI 文言は乾いた・世界共通で伝わる英語リテラル（i18n キーにしない・既存モバイルチロムに倣う）。

## アーキテクチャ（分離と再利用）

事実採取（memory `reference_stage2_mobile_collage_factmap`）で確認した既存部品:
- 選択 state `selectedCollageId`（BoardRoot）＋選択枠（`CollageCanvas` の `.selectionFrame`・`data-no-capture`）＝既にある。
- 重なり順 `collageOrder: string[]`（末尾＝最前面）が**画面 z と撮影 z の両方**を駆動。`bringToFront` は既存。カード選択/掴みで既に最前面に来る。
- 編集 state（`collagePositions`/`collageOrder`/`collageRotations`）は全て BoardRoot の in-memory state（IDB 非永続・退出で破棄）。
- ズーム計算（`stage-zoom.ts` の pinch/pan/clamp/`zoomStageToScale`・`IDENTITY_STAGE_TRANSFORM`）と `fitSelectionToScreen`・`mobileBandRect` は全てある。足りないのは**ダブルタップ検知だけ**。
- デスクトップ不変の型＝`MobileArrangeGestures` の `enabled=false -> <>{children}</>`、`CollageCanvas` の `isMobile ? prop : undefined`。

### 追加する部品（各1責務・明確な境界）

1. **`lib/share/collage-layer-order.ts`（純関数・新規）**
   - `sendToBack(order, id): string[]`（`[id, ...order.filter(x=>x!==id)]`）。`bringToFront` は既存（`collage-layout.ts`）を流用。
   - （前へ/後ろへの単一ステップ `bringForward`/`sendBackward` は第1弾では出さない＝YAGNI。前面/背面で足りる。将来足す余地は残す。）

2. **`lib/share/collage-remove.ts`（純関数・新規）**
   - `removeFromCollage(positions, order, rotations, id): { positions, order, rotations }`＝3マップから `id` を除いた新オブジェクトを返す（元は変えない）。

3. **`lib/share/collage-history.ts`（純関数・新規）**
   - `type CollageSnapshot = { readonly positions: CollagePositions; readonly order: readonly string[]; readonly rotations: Readonly<Record<string, number>> }`
   - `snapshotsEqual(a, b): boolean`（no-op を積まない判定＝浅い比較で十分：order 配列一致＋positions/rotations の key/値一致）。
   - `pushSnapshot(stack, snap, max): CollageSnapshot[]`（`MAX_COLLAGE_HISTORY = 40` で古いものから捨てる・`undo-stack.ts` の `pushBounded` 発想を踏襲するが独立モジュール＝既存ボード undo に無干渉）。
   - undo/redo の適用（3つの setState）は BoardRoot 側。stack は BoardRoot state（`collageUndoStack`/`collageRedoStack: CollageSnapshot[]`）。

4. **`components/board/MobileArrangeTopBar.tsx` ＋ `.module.css`（新規）**
   - mobile arrange の**上部**に固定（`data-no-capture`・`MobileArrangeBar` と同じグラス素材で視覚一致・`position:fixed` を撮影 transform の外にマウント）。z = 新規 `BOARD_Z_INDEX.SHARE_ARRANGE_TOOLBAR`。
   - **常時**: `UNDO` / `REDO`（スタック空なら disabled）。
   - **カード選択中のみ追加表示**: `TO FRONT` / `TO BACK` / `DELETE`（`selectedCollageId != null` で出現）。
   - props（全て BoardRoot から）: `canUndo`/`canRedo`/`onUndo`/`onRedo`/`hasSelection`/`onBringToFront`/`onSendToBack`/`onDelete`。**デスクトップには一切マウントしない**（`isMobile && sharePhase==='arrange'` のみ）。

### BoardRoot 配線（モバイル経路のみ）

- **履歴（確定検知＝開始で捕捉・終了で差分あれば push）**: ARRANGE 入場時（`handleMobileEnterArrange`）に undo/redo スタックを空に初期化。1操作＝1手を実現するため、**連続ジェスチャは「開始時に現在 state のスナップショットを pending ref に捕捉 → 終了時に現在 state と `snapshotsEqual` で比較し、変わっていれば pending を undo に push・redo を空に」** する（＝実際に動いた時だけ1手・逐次 move では積まない）。
  - 連続ジェスチャの開始/終了フック: 1本指の移動・四隅リサイズ・回転ノブ・回転（`bindPointerGesture` の pointerdown/pointerup）と、二本指ピンチ（拡縮＋回転・`MobileArrangeGestures` の pinch start/end）。ピンチは開始時に base snapshot を既に持つ（段階2 gesture model）ので同じ start/end 規則に乗せる。BoardRoot に `pendingHistoryRef: CollageSnapshot | null` と `onEditGestureStart`（pending 捕捉）/`onEditGestureEnd`（差分判定 push）を新設し、モバイル経路のみ配線。
  - **離散操作（TO FRONT/TO BACK/DELETE）は即時**: 実行の直前に変更前 snapshot を undo に push・redo を空に（連続ジェスチャの start/end は通さない）。
- **削除**: `handleDeleteSelectedCollage` = 変更前 snapshot push → `removeFromCollage(...)` の結果を3 setState → 削除 id が `selectedCollageId` なら `setSelectedCollageId(null)`。
- **重なり順**: `handleBringSelectedToFront`/`handleSendSelectedToBack` = 変更前 snapshot push → `setCollageOrder(bringToFront/sendToBack)`。
- **取り消し/やり直し**: `handleCollageUndo` = 現在 snapshot を redo に push → undo から pop → 3 setState で適用（選択は維持 or 消えたカードなら解除）。`handleCollageRedo` は対称。
- **ダブルタップ整列**: `MobileArrangeGestures` にダブルタップ検知を追加（前回タップの時刻＋位置を記憶し、~300ms・小移動の2連タップで `onDoubleTapFit` を発火）。BoardRoot の `handleDoubleTapFit` = `setStageTransform(IDENTITY_STAGE_TRANSFORM)`（＝帯全体が見える＝整列。既存スライダー・2本指ズームは温存し同じ `stageTransform` を共有）。カード上/余白どちらのダブルタップでも整列（第1弾は単純化）。

## テスト

- 単体: `collage-layer-order`（`sendToBack` の順序・未知 id は同一参照）／`collage-remove`（3マップから除去・元不変・未知 id で no-op）／`collage-history`（`snapshotsEqual` の一致/不一致・`pushSnapshot` の bound）。
- コンポーネント: `MobileArrangeTopBar`（未選択＝UNDO/REDO のみ・disabled 状態／選択中＝FRONT/BACK/DELETE 出現／各 onClick 発火）。
- e2e（`tests/e2e/mobile-share.spec.ts` 追記・縦4:5 前提のまま）: カード選択→上部バーに FRONT/BACK/DELETE 出現／DELETE でカード数が減る／UNDO で戻る／REDO でやり直し／ダブルタップで `stageTransform` が identity（scale=1）に戻る。**既存テストは不変**。デスクトップの "desktop SHARE — unchanged" が緑のまま（上部バー不在）。

## スコープ外（第2弾以降）

- **複製**（`bookmarkId` 単一キー→インスタンスID層・in-memory・DB 移行なし）。
- **吸着＋触覚**（位置スナップ＋緑ガイド＋`navigator.vibrate`・回転スナップ `collage-rotate.ts` が手本・ドラッグ choke point は `onMove`→`moveElement`）。
- **ドラッグ削除の演出**（ゴミ箱ゾーン・`elementFromPoint`+`data-*` の TAG モード手法が手本）。第1弾はツールバーの DELETE のみ。
- **前へ/後ろへ の単一ステップ重なり順**（第1弾は前面/背面のみ）。
- **ズームのスライダー廃止**（(b) のとおり当面残す）。
- 上部バーの取り消し/やり直しに演出・触覚を足す磨き。

## 出荷ルール（継承）

デプロイ前に tsc + vitest + build（`assert-share-template OK`）+ playwright 緑／実タッチは実機のみ検証可／`rtk` 前置・`--no-verify` 禁止／vitest・playwright は素の `npx`／機微・競合名は `docs/private/`。
