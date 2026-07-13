# スマホのアレンジ体験 作り直し（チロム最小化＋操作系刷新＋9:16）＋PC 削除追加 設計書

> 対象: スマホ（`isMobile` / `<=640px`）の SHARE アレンジ（`sharePhase === 'arrange'`）の作り直し。
> ＋ デスクトップ（>640px）に「共有画像から外す（削除）」を新規追加（**ユーザー承認済みの意図的変更**）。
> 実機フィードバック（s193 スクショ）を受けたユーザー主導の再設計。段階1（縦4:5）＋段階2第1弾（編集チロム）の上に載り、その一部を差し替える。

## 背景（実機で分かった問題）

s193 実機スクショで、スマホのアレンジ画面は **常時のチロムが画面を食いすぎ**（上部 UNDO/REDO 帯＋単体スライダー＋説明文＋BACK＋CREATE＋Safari 自身のバー）でコラージュが画面半分に潰れていた。加えて **操作が「カードのズーム」か「ボードのズーム」か分かりにくい**（同じ2本指が選択有無で別の意味・100枚の密ボードでは“空きスペースで2本指”が成立せず必ずカードに当たる）。ユーザー主導で「画面を最大に使い、カード操作とボード操作を明確に分ける」方向に作り直す。

## 確定した設計判断（ユーザー承認済み）

- **D1 指＝カード専用**: タップ＝選択／1本指＝移動／**2本指＝選択カードの拡縮＋回転**。**「2本指＝ボードズーム」は廃止**（密ボードで必ずカードに触るため）。
- **D2 ボードのズームは指でやらない → 専用ボトムナビのボタン**（−／＋／全体表示(fit)）。
- **D3 チロムを下の細いバーに集約＝画面最大**: 上部 UNDO/REDO 帯・単体スライダー・常時説明文は**廃止**。アレンジに入ると下を専用ナビに差し替える。
- **D4 取消/やり直し＝業界標準の曲がった矢印アイコンのみ**（文字を添えない）。
- **D5 DELETE＝共有“画像の見た目”から外すだけ**。リンクの URL 集合（`buildArrangeShare`＝選択で確定した全URL）とブックマーク本体は**無傷**。**モバイル＋PC 両方**に用意。
  - **D5-a 外すたびに毎回、非ブロッキングのトーストで確認**（「画像から外しました — リンクには全URLが残っています ・ 元に戻す」）。＝「これは自由なコラージュ（見た目づくり）の操作で、送る中身は減らない」を毎回伝える。任意で隅に小さな常設一言も可。
- **D6 モバイルのシェア画像＝9:16 縦**（スマホ画面をほぼ埋める）。リンクカードは 1.91:1 のまま（9:16 を中央にレターボックス＝細い縦帯・割り切り）。サーバー・OG route・payload は無改変。PC のシェア画像は従来どおり（9:16 化はモバイルのみ）。

## モデル（レイヤーの分離＝ユーザーの言葉で確定）

- **選ぶ段階** ＝「送りたい URL を決める」→ **リンクの中身**（`selectedIds`／`buildArrangeShare`）。ここで確定、以後変えない。
- **並べる段階（コラージュ）** ＝「共有画像の見た目を整える」→ 移動・拡縮・回転・**外す**は全て**画像の見た目だけ**（`collageOrder`/`collagePositions`/`collageRotations`＝in-memory・退場で破棄）。
- ＝ **画像＝キュレーションした絵／リンク＝選んだ全URL**。両者は別レイヤー。DELETE は画像レイヤーのみ。

## 不変条件

- **リンクの payload（`buildArrangeShare`＝`selectedInBoardOrder(items, selectedIds)`）は無改変**。DELETE は画像だけ＝ここには効かせない（＝ユーザー確定の正しい挙動）。
- **共有サーバー・OG route・payload は無改変**（段階1 と同じ・ホストOG は 1.91:1 のまま・`assert-share-template` 通過）。9:16 化は `SHARE_PORTRAIT_ASPECT` 定数＋帯＋レターボックス元画像のみ。`renderCollageCanvasToJpeg` 本体は無改変（アスペクト非依存）。
- **撮影は state ベース**（`collageOrder`/positions/rotations から再描画）。外したカードは3マップから除かれるので画像から消える（DOM からも消える＝PC の dom-to-image にも反映）。ボードズーム（fit 含む）は `stageTransform` のみ＝画像無影響。
- **デスクトップは、PC 削除の追加を除いてバイト同一**（PC 削除は承認済みの意図的変更）。desktop の `handleCreateHostedShare`/`captureCollageShareImage`(dom-to-image)/`ShareToast` の撮影ロジックは無改変。
- TS strict / `any` 禁止 / return type 明示 / CSS は `.module.css` / z-index は `BOARD_Z_INDEX`。UI 文言は乾いた世界共通の英語（DELETE のトースト等）。
- 段階2第1弾の**取消/やり直しの中身・純関数（`sendToBack`/`removeFromCollage`/`collage-history`）・履歴ハンドラは流用**。変えるのは“チロムの置き方・ジェスチャー・比率・削除のPC追加・トースト”。

## 変更点

### 1. 比率 9:16（モバイルのシェア画像）
- `SHARE_PORTRAIT_ASPECT`: `1080×1350` → **`1080×1920`**（9:16）。
- `mobileCollagePortraitBandRect` は 9:16 帯を返す（既存の一般化 `collageBandRect` にアスペクトを渡すだけ）。
- 撮影 `renderCollageCanvasToJpeg({ width:1080, height:1920 })`。レターボックス元画像が 9:16 になる（リンクカード＝1.91:1 中央に 9:16＝細い縦帯）。サーバー/OG 無改変。
- e2e のプレビュー寸法・帯高を 9:16 に更新。

### 2. モバイルのジェスチャー＝カード専用（`MobileArrangeGestures`）
- **「2本指＝ステージ（ボード）ズーム」分岐を削除**。2本指は常に**選択カードの拡縮＋回転**（`onSelectedPinch`）。選択が無ければ 2本指は no-op。
- 1本指＝カード移動 or 余白タップ＝選択解除（現状維持）。余白ダブルタップの整列は**ナビの「全体表示」ボタンに置換**（ジェスチャーからは外す＝`onDoubleTapFit` 経路は廃止 or 未使用）。
- ボードズーム/パンは**ジェスチャーからは行わない**（＝`onTransformChange` はナビのボタン由来のみ）。

### 3. 専用アレンジボトムナビ（新規・モバイル）
アレンジ進入時に下チロムを1つに集約（＝`MobileArrangeTopBar`＋単体 `MobileZoomSlider`＋説明文＋`MobileArrangeBar` を置換）。新コンポーネント（仮 `MobileArrangeDock`）:
- **常時の細い1段**（下から2段目・`data-no-capture`）: 左に `↺`(undo) `↻`(redo)＝**アイコンのみ**／中央に `−` `＋` `全体`(fit) のボードズーム／右に `BACK`。
- **一番下**: 大きな緑 `CREATE`（主アクション・撮影中は `CREATING…` で無効）。
- **カード選択中だけ出る細い段**（常時段の上に重なる・`data-no-capture`）: `前面へ` `背面へ` `画像から外す`。
- ボードズームの状態は `stageTransform.scale`（既存）。`−`/`＋` は `zoomStageToScale`（既存純関数）で選択カード中心 or 画面中心を pivot に段階ズーム、`全体` は `IDENTITY_STAGE_TRANSFORM`。
- 上部バー・単体スライダー・常時説明文は**マウントしない**。コラージュは残り全面。

### 4. DELETE のトースト（D5-a・モバイル＋PC 共通の考え方）
- 外した瞬間、非ブロッキングの小トースト（body portal・`data-no-capture`・自動で数秒後に消える）: **"Removed from the image — your link still has every URL" ＋ "UNDO"**。
- UNDO は既存の `handleCollageUndo`（または直近1手を戻す）に接続＝「消えてない」を毎回体感。
- 任意: アレンジ画面の隅に小さな常設一言（"Arrange freely — this only shapes the image; your link keeps every URL"）。まずはトーストのみで出荷し、常設一言は要否を実機で判断。

### 5. PC（デスクトップ）に「画像から外す」を追加
- `CollageCanvas`（`!touchMode`＝デスクトップ）で、カードに**ホバーで小さな「×」（remove）を表示**（既存のリサイズハンドル/回転ノブと同じホバー流儀・`data-no-capture`）。クリックでそのカード id を3マップから除去（`removeFromCollage` 流用）。
- 削除ハンドラを id 引数で汎用化（`handleRemoveCollageCard(id)`）＝モバイルは選択カード id、PC は「×」のカード id。既存 `handleDeleteSelectedCollage` はこれを呼ぶ薄いラッパに。
- PC でも外したカードは撮影画像から消える（`if(!p) return null` で DOM から消え dom-to-image に反映）。**リンクの payload は不変**（同じモデル）。PC でもトーストを出す。
- ＝これは「デスクトップ 1px 不変」の**承認済み例外**。撮影ロジック本体は無改変（追加は `×` ボタンと削除配線のみ）。

## テスト

- 単体: 既存の純関数テストは流用。9:16 の帯・レターボックス寸法（`mobile-band`/`letterbox`）を更新。ボードズーム純関数（`zoomStageToScale`）は既存。
- コンポーネント: `MobileArrangeDock`（未選択＝undo/redo/zoom/back/create のみ／選択中＝前面/背面/外す が出る／各 onClick 発火／アイコンのみ undo/redo）。
- e2e `tests/e2e/mobile-share.spec.ts`:
  - チロム: 上部バーが**無い**／専用ドックが出る／`−`/`＋`/`全体` でボードズーム（`mobile-arrange-stage` scale 変化・fit で 1）。
  - ジェスチャー: 2本指がボードを動かさない（カード選択時＝カード拡縮／非選択時＝何も起きない）。1本指移動は従来どおり。
  - DELETE: カードを外す → 撮影カード数が減る（画像から消える）／**`buildArrangeShare` の payload は選択数のまま**（リンクは減らない）を検証／トースト表示／UNDO で戻る。
  - 9:16: プレビュー/撮影が 1080×1920。
  - デスクトップ: ホバー×で外せる／撮影から消える／payload 不変。上部バー・ドックはモバイル専用（desktop に無い）。

## スコープ外（後日・要ブレスト）

- 複製（instanceID・in-memory・DB移行なし）／位置スナップ＋触覚（`navigator.vibrate`）／ドラッグ削除の演出／重なり順の単一ステップ（前へ/後ろへ）。
- 9:16 とは別アスペクト選択 UI（4:5/1:1 等の切替）。段階1 は 4:5 だったが本設計で 9:16 に一本化。
- リンクカードを 9:16 から別途“程よく切り出す”案（今回は 1.91:1 中央帯で割り切り）。

## 出荷ルール（継承）

デプロイ前に tsc + vitest + build（`assert-share-template OK`）+ playwright 緑／実タッチは実機のみ検証可／`rtk` 前置・`--no-verify` 禁止／vitest・playwright は素の `npx`／機微・競合名は `docs/private/`。
