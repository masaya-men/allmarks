# 開発ToDo (AllMarks — 旧 Booklage、 2026-05-16 コード rebrand 済)

> 完了済みタスク → [TODO_COMPLETED.md](./TODO_COMPLETED.md)
> アイデア・将来構想・代替案 → `docs/private/IDEAS.md` (非公開、 gitignored)
> 今このセッションのゴール → `docs/CURRENT_GOAL.md` (5〜10 行のみ、 毎回最初に読む)

このファイルは **アクティブな backlog のみ**。 narrative や ✅ 完了は TODO_COMPLETED.md に移動する。

---

## ドメイン allmarks.app (= ✅ 2026-06-16 取得 + リブランド移行 完了)

**session 102 (2026-06-16): リブランド移行 完了。本番 = `https://allmarks.app`。** 新 `allmarks` Pages プロジェクト + カスタムドメイン Active(SSL有効)。旧 `booklage.pages.dev` は `/* → allmarks.app/:splat 301` 転送シェル(古い共有リンクも生存)。KV/R2 は wrangler.toml の同 ID 引き継ぎ。user 本人の 545件(タグ22)は EXPORT/IMPORT で移行済。拡張も allmarks.app 保存先(v0.1.18)で実機確認済。GitHub repo は `masaya-men/allmarks` に rename。

- **deploy は `--project-name=allmarks --branch=master`**(CLAUDE.md 更新済)。本番 URL は `.env.production`(tracked)の `NEXT_PUBLIC_APP_URL=https://allmarks.app` 由来 → `SITE_URL`(lib/constants.ts)経由で sitemap/robots/OG に反映
- **永久に維持**(変えるとデータ/互換破壊): `DB_NAME='booklage-db'`、bookmarklet 内部 ID、拡張の `booklage:*` メッセージ型、CSS クラス名等の不可視符号
- **公開前の残り片付け = 実質ゼロ(session129 で実態確認)**: 暫定 EXPORT/IMPORT 撤去は**不要**(B5/session124 で設定の正式バックアップ機能として配線済＝撤去は機能破壊)、`chrome-extension/` は**不在**(本物は `extension/`)、残るは `EXTENSION_STORE_URL` 投入のみ＝Chrome審査通過後に1行(外部待ち)
- 詳細プラン: `docs/superpowers/plans/2026-06-16-allmarks-rebrand-migration.md`

---

## 現在の状態 (次セッションはここから読む)

### 直近の状態 (セッション 193 追補 — ★スマホのアレンジUX作り直しを設計＋計画完成／次セッションで実装→デプロイ)

**同一セッションで、段階1/2第1弾を出荷後、実機スクショを受けて「スマホのアレンジ体験の作り直し」を設計＋計画まで（コードは未実装）。** ユーザー主導で操作系・チロム・比率を再設計。段階1(4:5)・段階2第1弾(上部バー)の一部を revert・置換する。

- **問題（実機）**: 常時チロム（上部UNDO/REDO帯＋単体スライダー＋説明文＋BACK＋CREATE＋Safariバー）が画面を食いすぎ／2本指のカードズームとボードズームの区別が不明瞭／密ボードで“空きスペースで2本指”が成立しない。
- **作り直し（承認済み）**: ①指＝カード（タップ選択/1本指移動/2本指=選択カード拡縮回転）②ボードズーム＝**専用ドックの −/⤢/＋ ボタン**（2本指ボードズームは温存＝ジェスチャー無改変）③チロムを1つの `MobileArrangeDock` に集約＝画面最大（上部バー・単体スライダー・説明文廃止・取消/やり直しは矢印アイコンのみ）④**DELETE＝共有画像から外すだけ**（リンクのURL＝`buildArrangeShare` 無改変・ブックマークも無傷）＋**外すたび母国語トースト**（15言語）＋UNDO・**PC にもホバー×で追加**⑤**画像＝9:16 縦**（`SHARE_PORTRAIT_ASPECT` 1080×1920・定数1箇所）。
- **モデルの核（ユーザーの言葉で確定）**: 画像＝見た目づくり（コラージュ）／リンク＝選んだ全URL。両者は別レイヤー、DELETE は画像だけ。
- **言語方針（s124＋s193 確定）**: 1単語アクション＝英語orアイコン／説明文＝母国語（i18n・15言語）。
- 設計書 `docs/superpowers/specs/2026-07-13-mobile-arrange-ux-redesign-design.md`・計画 `docs/superpowers/plans/2026-07-13-mobile-arrange-ux-redesign.md`（完全・6タスク）。
- **★次セッション＝実装（`mobile-arrange-ux-redesign` ブランチで subagent-driven）→ ゲート → デプロイ → 実機確認**。手順は [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **既知の残（段階2第1弾から繰越・非ブロッキング）**: 16ms未満連打UNDO/REDOのstale ref（人間の操作では非現実的）／`lastBlankTap` の稀な誤整列（無害）。

### 直近の状態 (セッション 193 — ★スマホ縦4:5 段階2・第1弾（編集チロムの核）を出荷・本番反映／次は実機確認→段階2 第2弾)

**同一セッションで段階1に続けて段階2・第1弾まで自走。ユーザーは「おすすめで全部進めてOK・後でまとめて確認」。** superpowers:brainstorming（事実採取＋選択肢提案・ユーザーが (a)〜(d) 全承認）→ writing-plans → subagent-driven-development（Task 1〜7＝安価モデル中心[T1〜4 haiku・T5〜7 sonnet]＋各タスクレビュー＋**opus 全ブランチレビュー Ready to merge=YES**）。tsc0 / **vitest 286ファイル2357** / build OK（assert-share-template OK）/ playwright mobile-share **15/15**（既存10＋新規5）/ `merge --no-ff` 1ff07486 / `allmarks.app` デプロイ済。

- **狙い**＝縦4:5 の上に「業界水準の編集道具の核」を載せる。**選択時ツールバー（前面/背面・削除）＋取り消し/やり直し（1操作=1手）＋余白ダブルタップで整列**。データ変更ゼロ（in-memory・IDB 非永続）。
- **確定判断（ユーザー承認）**: (a) 第1弾＝この4機能／(b) ズームスライダーは当面**残す**＋ダブルタップ整列を追加／(c) **複製は第2弾へ先送り**（`bookmarkId` 単一キー→インスタンスID層が要る・DB移行は不要）／(d) 取り消しは1操作=1手。
- **入れたもの**（計画 Task 1〜7）: ①`collage-layer-order.ts`（`sendToBack`＝`bringToFront` の対称）②`collage-remove.ts`（3マップから不変除去）③`collage-history.ts`（`CollageSnapshot`/`snapshotsEqual`＝**値比較**/`pushSnapshot`・上限40）④`MobileArrangeTopBar`＋z-index `SHARE_ARRANGE_TOOLBAR`（UNDO/REDO常時・選択中は TO FRONT/TO BACK/DELETE・`data-no-capture`）⑤`CollageCanvas`/`MobileArrangeGestures` に任意フック（移動/ピンチの開始・終了・余白ダブルタップ）⑥BoardRoot 配線（履歴 state/ref・各ハンドラ・上部バーのマウント）⑦e2e。
- **★per-task レビューで Critical を1件捕捉＋修正**（opus）: `handleSelectedPinchStart` で `handleCollageGestureStart()` を `collageArbiter.cancelActive()` の**前**に置くと、arbiter の同期ドラッグ終了がピンチ用 pending を消費→**2本指ピンチが undo に積まれない**。修正＝順序入替（cancelActive を先に）。e2e にピンチ→undo の回帰テストを追加済。**計画 Step 5-1 の「1行目に」指示が誤り**（コードは修正済・下記で計画doc注記）。
- **不変条件は死守**（opus が実コード直読で検証）: デスクトップ(>640px) **バイト同一**（新 prop は `isMobile ? x : undefined`・`enabled=false` で wrapper 無し・回転ノブ経路は `onEnd` 無し・`ShareToast`/`handleCreateHostedShare`/`handleMobileCaptureAndCreate` 無改変）／**撮影は state ベース**（削除＝3マップから実除去で撮影にも消える・取り消し/やり直しは編集 state 差し替え・ボードズーム/ダブルタップ整列は `stageTransform` のみ＝画像無影響）／`renderCollageCanvasToJpeg`・サーバー・OG 無改変。
- **最終レビューの Minor#3 を出荷前に修正**（opus 提案）: 撮影中(~1-2秒 `creating`)も上部バーが押せた→上部バーを `shareCreateState==='idle'` のみ表示に（撮影中は編集不可・下部バーは CREATING… 表示で据え置き）。再ゲート緑。
- **★次セッション最優先＝実機確認**（段階1＋段階2第1弾をまとめて）。手順は [CURRENT_GOAL.md](CURRENT_GOAL.md)。OK → **段階2 第2弾**（複製[instanceID]・吸着＋触覚・ドラッグ削除の演出・前へ/後ろへ単一ステップ・ズームのスライダー廃止検討）の詳細計画。
- **既知の残（非ブロッキング・opus が defer 判定）**: ①16ms未満の連打 UNDO/REDO で ref が stale（人間のタップでは非現実的・データ損失なし・将来 hold-to-repeat 追加時は関数型 setState 化）②`lastBlankTap` が割り込みジェスチャで消えず稀に誤整列（無害＝ズームが1に戻るだけ）。

### 直近の状態 (セッション 192 — ★スマホのコラージュ＝縦4:5 段階1（土台）を出荷・本番反映／次は実機確認→段階2の詳細計画)

**実行フェーズ。縦4:5 段階1 を計画書どおり subagent-driven-development で完遂・本番反映済**（Task 1〜4＝安価モデル中心[T1/T2 haiku・T3/T4 sonnet]＋各タスクレビュー＋**opus 全ブランチレビュー Ready to merge=YES・Critical/Important ゼロ**）。tsc0 / **vitest 282ファイル 2341 全緑** / build OK（assert-share-template OK＝OGメタ1200/630 無改変）/ playwright mobile-share **11/11** / `merge --no-ff` 808e2ad1 / `allmarks.app` デプロイ済。

- **狙い**＝スマホの SHARE コラージュを**縦 4:5 ネイティブ**に。編集エリア（帯）・自動配置・撮影・保存を縦4:5（1080×1350）へ。リンクカード用 1.91:1 は**縦画像を中央レターボックスで自動併産**（サーバー・OG route・payload 無改変＝ホストOGは1.91:1のまま＝メタは正しい）。見た目のチロムは現状のまま（プレミアム化は段階2）。
- **入れたもの**（計画書 Task 1〜4）: ①`lib/share/mobile-band.ts`＝帯計算をアスペクト引数で一般化（`collageBandRect`）＋`SHARE_PORTRAIT_ASPECT{1080,1350}`＋`mobileCollagePortraitBandRect`（縦4:5帯）。既存 `mobileCollageBandRect` は `collageBandRect(...,1200,630)` に委譲＝後方互換。②`lib/share/letterbox.ts`（新規）＝`containFitRect`（純関数・contain-fit中央配置）＋`letterboxImageToAspect`（縦画像を1.91:1ボード色canvasの中央に描いてJPEG併産・失敗/SSRはnull）。③`BoardRoot.tsx` モバイル撮影経路＝`handleMobileEnterArrange` を縦帯に／`handleMobileCaptureAndCreate` を縦撮影(1080×1350)＋リンクカード併産（**`capturedImageUrl`＝縦のまま＝プレビュー＆ネイティブ共有／ホスト`thumb`＝1.91:1レターボックス**の二本立て）。④`MobileShareResult.module.css` プレビューを 4:5。
- **不変条件は死守**（opus が実コード直読で検証）: デスクトップ(>640px) **バイト同一**（変更は全て isMobile 経路・`handleCreateHostedShare`/dom-to-image/`ShareToast`/`buildArrangeShare` 無改変・diff に不在）／**共有サーバー・OG route・payload 無改変**（ホストOGは1.91:1のまま＝`og:image:width/height=1200/630` 正当・`assert-share-template` 通過）／**`renderCollageCanvasToJpeg` 本体無改変**（縦帯4:5＋縦w/h を渡すだけ＝`mapBandToOutput` の x/y スケール等しく無歪み）／WYSIWYG（z順=`collageOrder`・回転）維持／レターボックス失敗→`thumb: undefined`＝リンクは作る（メタが嘘にならない・ネイティブ共有は縦で成立）。
- **e2e は縦前提に更新**（Task 4）: 帯高 `vw*(1350/1080)`・プレビュー寸法 1080×1350・SEED_COUNT 28→16（縦帯で行分割が変わる＝4行×4＝全行が両端到達・厳密性維持の再校正であって弱体化ではない・レビュアーが packer 実演で独立検証）。黒帯ピクセル検査は寸法非依存で温存。
- **★次セッション最優先＝実機確認**（下・[CURRENT_GOAL.md](CURRENT_GOAL.md)）。OK → **段階2（業界水準の編集チロム）の詳細計画**を書いて実装（選択時ツールバー・レイヤー操作・スナップ+触覚・ドラッグ削除・undo/redo・ズームはスライダー廃止→ピンチ+ダブルタップfit）。設計概要は spec §段階2。
- **既知の残（非ブロッキング・opus が defer 判定）**: ①撮影パンくずの診断値が landscape 基準のまま（`mobileCaptureScale(band.width)` は1200基準・`||630`/`||1200` フォールバック＝**診断専用でレンダラーに渡らない＝挙動無影響**・計画が「診断デフォルトは触らない」と明示）②レターボックス出力にバイト上限なし（フラット余白は高圧縮＝サーバー上限300KB内に余裕で収まる・実害なし）。

### 直近の状態 (セッション 191 追補2 — ★スマホのコラージュ＝縦4:5 ネイティブ再設計を決定・設計書＋段階1計画を作成／次は段階1を安価モデルで実装)

**コード変更なし（設計・計画のみ）。** 実機で「機能は動くがスマホ最適化に見えない／縦が普通では」とユーザー。業界水準を調査（Explore＋WebSearch）→ 縦4:5の目標モックを作成・ユーザー承認 → 現行の撮影→ホスティング→OGパイプラインを事実採取 → **設計書＋段階1計画**を作成。

- **方針(A)確定**: モバイルのコラージュ＝**縦 4:5 が主役**（保存＆縦向き共有）。**リンクカード用 1.91:1 は縦画像を中央レターボックスで自動併産**（サーバー・OG route・payload 無改変＝ホストOGは1.91:1のまま）。段階1＝土台（縦の形と出力・チロムは現状）／段階2＝業界水準チロム（選択時ツールバー・レイヤー・スナップ+触覚・ドラッグ削除・undo/redo・ズームはスライダー廃止→ピンチ+ダブルタップfit）。
- **鍵**: `renderCollageCanvasToJpeg` は出力w/hを引数で受けるアスペクト非依存＝縦帯(4:5)＋縦w/h(1080×1350)を渡すだけ。縦帯→縦出力は `mapBandToOutput` の x/y スケールが等しく無歪み。1.91:1 は `letterboxImageToAspect` で併産。
- 設計書 `docs/superpowers/specs/2026-07-13-mobile-portrait-collage-redesign-design.md`・計画 `docs/superpowers/plans/2026-07-13-mobile-portrait-collage-stage1.md`（完全コード・4タスク）・目標モック https://claude.ai/code/artifact/c624f258-08b7-4694-8cb0-39c610c9f476。
- **★次＝段階1を安価モデルで実装**（Claude が subagent-driven で指揮）。手順は [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **バックログ（ユーザー要望・後で）**: PC（デスクトップ）のコラージュが業界水準かの調査（競合名は `docs/private/` へ）。

### 直近の状態 (セッション 191 — ★N-58 段階2 スマホのコラージュ編集の操作系を再設計・出荷・本番反映／縦4:5再設計へ発展)

**再ブレスト → 実装まで自走。superpowers:brainstorming で操作モデルを作り直し → writing-plans → subagent-driven-development（Task 1〜6＋各タスクレビュー＋opus 全ブランチレビュー MERGE READINESS=YES・Critical/Important ゼロ）。** tsc0 / **vitest 2326/2326** / build OK（assert-share-template OK）/ playwright mobile-share **10/10**（7 段階1 + 3 新規）/ `merge --no-ff` f6497904 / `allmarks.app` デプロイ済。spec `docs/superpowers/specs/2026-07-12-n58-stage2-mobile-gesture-model-design.md`・plan `docs/superpowers/plans/2026-07-12-n58-stage2-mobile-gesture-model.md`。

- **狙い**＝スマホのコラージュ編集を「標準的なマルチタッチ」に。段階1 実機でユーザーが提案した操作モデルを、旧計画（1本指=カード/2本指=ステージ）を捨てて再設計。
- **操作モデル（selection-gated・ユーザー承認）**: カードを**1回タップ＝選択**（白枠）。**選択中は2本指＝そのカードを拡縮＋回転**（中心軸・drift-free 絶対計算）。**非選択（余白タップで解除）で2本指＝ボードのズーム/パン**（1〜6倍）。1本指＝カード移動 or 余白パン。**常時回転ノブと四隅リサイズはスマホで廃止**（回転は2本指へ移設＝表現は削らない）。
- **★不変（ユーザー確認済）＝ボードのズームは編集専用で共有画像に一切影響しない**。スマホの撮影は `renderCollageCanvasToJpeg`（canvas 直描画）で state（位置/サイズ/回転/重なり順）＋band から再描画＝編集画面の CSS transform を見ない。だから旧計画が心配した「撮影直前リセット」は不要。
- **入れたもの**: ①`lib/share/stage-zoom.ts`（純関数＝clamp/pinch/pan＋2本目の指でカード操作を止める調停役）。②`scaleElementFromCenter`（中心軸スケール純関数）。③`MobileArrangeGestures`（多点タッチ担当ラッパー＝2本指を選択有無で仕分け・1本指はカードへ素通し・enabled=false でデスクトップは wrapper 無し）。④`CollageCanvas` に選択枠/倍率(pointerScale)/touchMode でハンドル非表示/調停役。⑤`BoardRoot` 配線（selectedCollageId/stageTransform・base スナップショット・enter/exit/reselect リセット）。⑥s190 deferred minor #1(撮影中 BACK 無効)/#2(帯 NaN ガード)/#3(回転呼び出し順テスト)/#4(collageOrder コメント) を同梱。
- **不変条件は死守**（opus が実コード直読で検証）: デスクトップ(>640px) **バイト同一**（新 prop は全て isMobile のみ・`ShareToast`/`handleCreateHostedShare`/`handleMobileCaptureAndCreate` 無改変・diff に不在）／WYSIWYG（編集した位置/サイズ/回転/z順が画像に到達）／drift-free ピンチ（base ref スナップショット・stale closure なし）／fixed のバー/シートは transform ラッパーの外。
- **★同セッション追補＝ボードズーム・スライダーを追加・出荷（実機確認で判明した穴を塞いだ）**。実機で「機能は全部OK。ただし**100枚だと帯がカードで埋まり余白が無い→選択解除できない→2本指ボードズームに入れない**」とユーザー報告。再ブレスト→(A)確定＝**画面下部の ARRANGE バー最上段に見えるズーム・スライダー**を常設（選択と無関係にいつでも効く）。**拡大は選択カード中心**（無選択は画面中心）＝パンがほぼ要らない。既存2本指ズームは残し同期。純関数 `zoomStageToScale`（pivot 中心ズーム・`clampStageTransform` 再利用）＋ `MobileZoomSlider`（controlled・data-no-capture）＋ `MobileArrangeBar` 任意 `zoom` prop ＋ BoardRoot `handleZoomSliderChange`（関数型 setState で pivot を prev から計算）。**ボードズームは編集専用で画像に無影響／デスクトップ不変**を維持。subagent-driven（T1〜3＋各レビュー＋opus 全ブランチレビュー MERGE READINESS=YES）。tsc0 / vitest 2334 / playwright 11/11 / `merge --no-ff` c374ff1f / デプロイ済。spec `docs/superpowers/specs/2026-07-13-n58-mobile-zoom-slider-design.md`・plan `docs/superpowers/plans/2026-07-13-n58-mobile-zoom-slider.md`。感触調整は `STAGE_ZOOM_MAX`/`PAN_SLOP_PX` に加え、スライダーの効きは線形マッピング（`MobileZoomSlider.tsx`）。
- **★次セッション最優先＝実機確認**（実タッチのピンチ/回転・スライダーの感触は実機のみ）。`allmarks.app` をハードリロード → SHARE → 全選択 → ARRANGE →（手順は下・**スライダーで100枚でもズームできるかも確認**）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
  - OK → **N-57+59（スマホ盤面の小物）** へ（ロードマップ次点）。
  - 気になる点（ズーム上限/追従/選択の感触）→ `STAGE_ZOOM_MAX`（stage-zoom.ts）/ `PAN_SLOP_PX`（MobileArrangeGestures.tsx）を1箇所調整して再デプロイ。
- **既知の残（非ブロッキング・opus が defer 判定）**: `isOnCard` が `collage-el-` testid にカップリング（将来 `data-collage-card` 化が最有力の掃除）／`scaleElementFromCenter` の maxCardWidth<MIN・h===0 は実呼び出し元が作らない／3本目の指はピンチ中に握らない。**INFORMATIONAL（ユーザー判断・別タスク）**: `/s` **ページ**再構成は盤面順（`buildArrangeShare`）＝**共有画像は編集どおり**・N-58 の回帰ではない。/s ページにも編集配置を載せるかは要望次第で payload 拡張の別タスク。

### 直近の状態 (セッション 190 — ★N-58 段階1 スマホのコラージュ編集を出荷・✅実機確認済／N-55 同時解消／次は段階2 の操作系を再設計)

**実行フェーズ。N-58 段階1 を計画書どおり subagent-driven-development で完遂・本番反映済**（Task 1〜4＋各タスクレビュー＋**opus 全ブランチレビュー Ready to merge・Critical/Important ゼロ**）。tsc0 / **vitest 2296/2296** / build OK（assert-share-template OK）/ playwright mobile-share **7/7** / `merge --no-ff` / `allmarks.app` デプロイ済。

- **狙い**＝スマホの共有を「CREATE で即撮影」から「**ARRANGE で編集段に入る→指で動かす/大きさ/回す/重なり順→CREATE で撮影**」の2手に分割。スマホでも PC と同じようにコラージュできる（s185「並べる段は出さない」をユーザーが実機体験で撤回した件）。**N-55（撮影成功後もシート裏でコラージュが触れる）もスクリムで同時解消**。
- **入れたもの**（計画書 Task 1〜4・ただし Task 3 は N-56 が canvas 直描画で完成済のため実関数分割に適合）: ①`MobileBandOverlay`（撮影される中央 1.91:1 の帯を減光で示すガイド・`data-no-capture`・z=`SHARE_BAND_OVERLAY:96`）。②`MobileArrangeBar`（編集段の下部バー・BACK/CREATE・`MobileShareResult` と同素材＝視覚一致）。③**canvas レンダラーにカード回転を追加**（`renderCollageCanvasToJpeg` が各カード中心まわりに `rotate`＝CSS の `rotate(deg)` と一致）＝**ユーザー確定「PC と同じく回転も画像に反映」**。④`BoardRoot handleMobileCreateShare` を `handleMobileEnterArrange`（配置して止まる・撮影しない）＋`handleMobileCaptureAndCreate`（**編集後の state=collagePositions/collageOrder/collageRotations から**撮影）に二分割・N-55 スクリム（`SHARE_RESULT_SCRIM:399`）・選択バー CREATE→ARRANGE（testid 不変）・`CollageCanvas` root の `touch-action:none`（余白からの指ドラッグが盤面スクロールに化けない）。
- **不変条件は死守**（opus が呼び出し元を直読で検証）: デスクトップ(>640px) SHARE **バイト同一**（`handleCreateHostedShare`/`ShareToast`/dom-to-image は無改変・diff に不在）／撮影失敗でもリンクは必ず作る（レンダラー失敗→null→`thumb ?? undefined`）／撮影機構は N-56 のまま（`fit:'cover'`・帯・`mobileCaptureScale`・2フレーム待ち・パンくず）／**編集した位置/サイズ/回転/重なり順がすべて画像に到達**（z順は `collageOrder`・回転は中心まわり・stale closure なし）。
- **✅実機確認済（2026-07-12・ユーザー「画像、編集したとおりに出た」＝回転も反映）＝N-58 段階1 完了。**
- **★次セッション＝N-58 段階2 の操作系を「再ブレスト → 実装」**。段階1 実機でユーザーが**段階2の操作モデルを提案**（旧計画 `2026-07-11-n58-stage2-pinch-zoom-pan.md` の「1本指=カード/2本指=ステージ」とは別）。**旧計画はそのまま実行しない**（計画書頭に ⚠️ バナー差し込み済）。正本フィードバック＝①常時回転ノブが出っぱなしで操作しづらい②スマホ標準（Canva 等）＝**カードをタップ選択→ピンチで拡縮・二本指で回転**・四隅リサイズ+常時ノブは廃止方向③ボード自体の拡縮も要る。**回転は残す**（表現を削らない）。着手前に superpowers:brainstorming。手順・deferred minor は [CURRENT_GOAL.md](CURRENT_GOAL.md)、方針は memory `project_n58_stage2_gesture_model`。
- **既知の残（任意・非ブロッキング・opus 指摘＝段階2で opportunistically 取り込む）**: ①撮影中に BACK を押すと放棄した /s シェアが1件できる（クラッシュではない・BACK を creating 中 disable するか撮影後にガード）②`MobileBandOverlay` の NaN 帯素通り（呼び出し元が NaN を作らない＝防御のみ）③回転テストは呼び出し確認で translate→rotate→translate 順序は未検証④**/s ページの再構成は盤面順**（`buildArrangeShare`＝`selectedInBoardOrder`。**共有画像は編集どおり**・デスクトップと同一挙動＝N-58 の回帰ではない・不変条件は「画像」に scoped）⑤z順切替の意図を示す1行コメント追加（将来の refactor 予防）。

### 直近の状態 (セッション 189 — ★N-56 スマホ共有画像を「canvas 直描画」に移行・出荷・✅実機確認済（写真が出た）／次は N-58 段階1)

**✅実機確認済（2026-07-12・ユーザー報告「100枚のプレビューに写真が出た」）＝N-56 完了。** iOS の dom-to-image foreignObject 制限を canvas 直描画で回避できた。**次セッションは N-58 段階1（スマホのコラージュ編集）**。任意の微調整（角丸 per-card 化・パターン背景・ツイート/動画カードの描画）は要望が出たら。

**実行フェーズ。N-56 続き（canvas 直描画レンダラー）を計画書どおり subagent-driven-development で完遂・本番反映済**（Task 1〜4＋各タスクレビュー＋**opus 全ブランチレビュー Ready to merge・Critical/Important ゼロ**）。tsc0 / **vitest 2291/2291** / build OK（assert-share-template OK）/ `merge --no-ff 9c40a6a2` / `allmarks.app` デプロイ済。

- **狙い**＝実機で確定した「iOS Safari は dom-to-image（SVG foreignObject）内の `<img>` を描けない（枚数非依存でプレビューが暗い）」を根治。**スマホの撮影を DOM スクショ→canvas 直描画（`drawImage`）へ全面移行**。デスクトップは dom-to-image のまま**バイト同一**。
- **入れたもの**（計画書 Task 1〜4）: ①`capture-mirror.ts` の描画 primitives 6個を `export`（ロジック不変）。②`collage-canvas-render.ts` に純関数 `coverRect`（cover-fit 切り出し）＋`mapBandToOutput`（band 座標→1200×630 写像・TDD 数値検証）。③同ファイルに `renderCollageCanvasToJpeg`＝**DOM を読まず配置データから直接 canvas に描く**本体（全体 try/catch→null で絶対 throw しない／画像は**1枚ずつ**読み込み＝100枚でも OOM しない／cover-fit／角丸クリップ／写真は同一オリジン proxy 経由でロード＝汚染回避／placeholder+scrim+タイトル／`allmarks.app` 焼き込み）。④`BoardRoot.tsx handleMobileCreateShare` を canvas レンダラーに配線（`chosen`＋`collagePositions`＋`band` から描く・s188.2 の縮小 Map は撤去・**パンくず write/clear は安全網で温存**・角丸は median カード幅×スケールで一律・テーマの flat 角も追従）。
- **不変条件は死守**（opus レビュアーが呼び出し元を直読して検証）: デスクトップ SHARE **バイト同一**（`handleCreateHostedShare`/`capture-collage.ts`/dom-to-image 経路は無改変・diff に不在・`capture-mirror` の diff は export 追加のみ）／撮影失敗でもリンクは必ず作る（レンダラー失敗時 null→`thumb ?? undefined`）／画像は同一オリジン proxy 経由（canvas taint 回避）／出力 1200×630 cover。
- **描画ループの自動テストを追加**（opus レビュー指摘）: mock 2d context で①逐次ロード（Promise.all 退行を検出）②proxy はサムネのみ③画面外スキップ④placeholder 分岐⑤ループ内 throw→null、を実測。従来「canvas 不可で早期 return」しか通っていなかった見せかけテストを是正。
- **★次セッション最優先＝実機で「写真が出るか」を1回確認**。iPhone Safari を閉じて開き直し → `allmarks.app` → SHARE → SELECT ALL → CREATE → プレビューに**写真入りの画像**が出れば N-56 完了🎉。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
  - **出た** → N-56 完了 → **N-58 段階1** へ。見た目の微調整（パターン背景の再現・余白・文字サイズ）は必要なら次で。
  - **出ない** → スクショで症状採取 → systematic-debugging（proxy 取得失敗 / canvas taint / 配置ズレ / **SVG placeholder が iOS で空描画**＝写真カードは raster なので無関係）。
- **既知の残（任意・非ブロッキング）**: ①カード単位 try/catch なし＝1枚の予期せぬ例外で全体 null（リンクは作る）②角丸は per-card でなく median 一律③ツイート/動画カードは簡略描画（写真 or placeholder のみ）④cover-fit の stretch-fallback と img.onerror→placeholder はテスト未網羅。

### 直近の状態 (セッション 188 — ★N-56 スマホ共有画像の「診断可視化＋倍率フォールバック＋真っ白検出」を出荷・本番反映／次は実機で診断行を1回読む)

**実行フェーズ開始。N-56（★★ローンチブロッカー）を計画書どおり subagent-driven-development で完遂・本番反映済**（Task 1〜5＝Sonnet 中心・各タスクレビュー＋**opus 全ブランチレビュー READY TO MERGE・Critical/Important ゼロ**）。tsc0 / **vitest 2262/2262** / build OK（assert-share-template OK）/ playwright mobile-share **5/5**（"desktop SHARE — unchanged" 含む）/ `merge --no-ff`・`allmarks.app` デプロイ済。

- **狙い**＝スマホの撮影失敗が**静かに成功に見える**のを止める。今まで失敗は 13 箇所で `null` に握り潰され、結果シートは無言で LINK READY を出していた。
- **入れたもの**（計画書 Task 1〜5）: ①`lib/share/uniform-image.ts`＝真っ白（一様色）出力の検出器。②`render-share-image.ts`＝失敗理由の持ち帰り口 `onError` ＋ `document.fonts.ready` を3秒で見切り。③`capture-collage.ts`＝`captureCollageShareImageDetailed`（段階別診断 no-frame/timeout/render/decode/blank/normalize ＋倍率フォールバック連鎖 ＋`formatCaptureAttempts`）。旧 `captureCollageShareImage` は薄いラッパで**デスクトップ挙動はバイト同一**。④`MobileShareResult.tsx`＝**NO IMAGE — LINK ONLY** の琥珀警告枠＋RETRY IMAGE＋**1行診断文字列**（コピペ可）＋リンク作成失敗時の理由行。⑤`BoardRoot.tsx`＝モバイル撮影を Detailed＋`fallbackScales:[1]`＋`rejectUniform:true` に配線。**デスクトップ `handleCreateHostedShare` は無改変**。
- **不変条件は死守**（レビュアーが呼び出し元・パイプラインを読んで検証）: デスクトップ SHARE バイト同一／撮影失敗でもリンクは必ず作る（`captureCollageShareImageDetailed` は絶対 throw しない）／`fit:'cover'` 固定。
- **★次セッション最優先＝実機で診断行を1回読む**（下の N-56 backlog に手順と真因→恒久対応 F1/F2/F3/F4 の対応表）。ユーザーに iPhone で `allmarks.app` → SHARE → SELECT ALL → CREATE を頼み、黄枠 or プレビュー下の灰色英数字の**1行**を報告してもらう→真因確定→恒久対応を1つ選んで実装。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 187 — ★計画セッション第2弾: Fable で s186 新規4件＋αの計画書5本・コード変更なし)

**コード変更ゼロ（計画のみ）**。並行 Explore で実コードを行番号採取→安価モデル写経粒度（s185/s186 基準）の計画書を作成:

- **(N-58 段階2)** [ピンチズーム＋パン](superpowers/plans/2026-07-11-n58-stage2-pinch-zoom-pan.md) — 2本指=ステージ・1本指=カード。調査で「回転は角度計算なので無修正・移動とリサイズだけ倍率で割る」を確定。撮影直前に transform リセット＝撮影系 0 行変更
- **(BULK-IMPORT 第1弾)** [X ブクマ＋YouTube LL/WL](superpowers/plans/2026-07-11-bulk-import-x-youtube.md) — **Task 0=ログイン済みブラウザの実 DOM 採取（ユーザー協働）を掟として先頭に**（s49 教訓）。収穫→古い順に直列保存（250ms 間隔=レート制御）＋進捗パネル＋中断再開。`dispatchBulkSave`（演出なし・結果を返す）を新設・アプリ側 0 行変更
- **(CUTOUT MVP)** [なげなわ切り抜きコラージュ](superpowers/plans/2026-07-11-cutout-collage-mvp.md) — 散文相談で確定: **コラージュ側のみ・形はブクマ本体に永続（DB bump 不要）・適用は `cutoutClipPath` 1関数＝将来ボードにも1行で広げられる**。専用オーバーレイでなぞる。撮影が clip-path を焼けるかが実機最重要確認
- **(SHADER-THEME)** 元ツイートの技術を事実確認 → **インテリアマッピング**（FH4 の窓と同じ・板1枚で3D の部屋を錯覚）と判明し、動くモック（WebGL・Artifact）を2往復で磨いてユーザー承認。**A=[cyber-space](superpowers/plans/2026-07-12-shader-theme-a-cyber-space.md)（純背景・計画のみ・実装は花火で）／B=[TOWER](superpowers/plans/2026-07-12-shader-theme-b-tower.md)（★超高層の全窓=カード・ユーザー確定「公開までに実装」）**。B が共通土台（raw WebGL runtime）を先に作る取り決め
- **第5項目（ユーザー要望）**: 非公開の方針メモを照合・改訂（`docs/private/2026-07-12-monetization-recheck-s187.md`。新機能の位置づけ・公開前必須事項の現状・実行順提案）
- **ロードマップ更新済み**（新規5計画を差し込み・TOWER=公開前はユーザー確定、CUTOUT/BULK-IMPORT の時期は提案）。**次=実行フェーズ・N-56 から**。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)

### 直近の状態 (セッション 186 — ★計画セッション: Fable で残タスク全棚卸し＋詳細計画書5本＋見取り図を作成・コード変更なし)

**コード変更ゼロ（計画のみ）**。並行調査エージェント4本で N-56/N-58/N-54/N-53 の実コードを行番号つきで全網羅→**安価モデルがそのまま写経できる粒度**（s185 基準・実コード/実テスト/実コマンド埋め込み済み）の計画書を作成:

- **見取り図（正本ロードマップ）**: [2026-07-11-s186-remaining-work-roadmap.md](superpowers/plans/2026-07-11-s186-remaining-work-roadmap.md) — 全残タスクの分類・セッション割り・モデル割り当て
- **(N-56)★★** [診断可視化＋倍率フォールバック](superpowers/plans/2026-07-11-n56-mobile-share-image-fix.md) — 調査で**失敗の握り潰し13箇所・ログゼロ・UI無表示**を確定。倍率3.08→canvas 約1200×2597 が最有力容疑。診断行を画面に出し実機1回で真因特定できる設計
- **(N-58)★** [スマホのコラージュ編集・段階1](superpowers/plans/2026-07-11-n58-mobile-collage-editing.md) — CREATE を「ARRANGE で止まる→編集→CREATE」に二分割。CollageCanvas は既に編集フル装備＝新規は帯ガイド＋編集バーの2部品のみ。**N-55 もスクリムで同時解消**。段階2（ピンチズーム）は実機の感触を見てから
- **(N-57)+(N-59)** [スマホ盤面の小物2点](superpowers/plans/2026-07-11-n57-n59-mobile-board-polish.md) — ゲート1行＋文字サイズ緩和／列数2/3/4・余白S/M/L を MORE パネルに（board-config 器で DB bump 不要）
- **(N-54)** [盤面パターンの SVG 統一](superpowers/plans/2026-07-11-n54-pattern-svg-unification.md) — 交点の二重合成を根治＋dom-to-image のグラデ片方向落ちも同時解消
- **(N-53)** [e2e 修理](superpowers/plans/2026-07-11-n53-e2e-repair.md) — 病巣3つ特定済み（v9 固定 seed／偽 readiness＝プリペイント script／dev サーバーに networkidle）。**版数を固定しない共有 seed ヘルパー**へ集約
- **★調査での発見**: (N-45) は commit `ac0b35da` で**実は完了済み**（下の記載を訂正済み）。(N-07) は N-53 に吸収。
- **★同セッション後半＝ユーザー回答＋新発案を反映**: N-56 の症状確定＝**(a) プレビュー不生成・iPhone Safari・4枚でも発生**（→計画書 Task 0 記入済み・最有力は WebKit の dom-to-image 失敗 or 高倍率 canvas）。**N-58 の最終ゴール確定＝100枚上限＋ピンチズーム**（段階2 を確定に格上げ・計画書更新済み）。新アイデア3件（切り抜きコラージュ／シェーダーテーマ／一括取り込み）は実現性調査つきで IDEAS.md s186 節へ。
- **★次 = s187 も計画セッション（ユーザー確定）**: Fable で **s186 新規4件**（N-58 段階2 ピンチズーム／拡張一括取り込み第1弾／切り抜きコラージュ MVP／シェーダーテーマ）の計画書を書き切る。**計画完了までは実装・並行作業をしない**。実行フェーズは計画完成後に N-56（★★ブロッカー・Task 0 回答済み）から。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 185 — ★N-49 スマホから SHARE できるようにした・本番反映／ミッションの根幹が開通)

**サブエージェント駆動9タスク＋各レビュー＋opus 全ブランチレビュー（READY TO MERGE・Critical/Important ゼロ）**。tsc0 / vitest **2246**（+31）/ クリーンビルド / `merge --no-ff b9c43511` / `allmarks.app` デプロイ済。詳細は上の N-49 と [spec](superpowers/specs/2026-07-10-mobile-share-bottom-nav-design.md)。

- **ボトムナビ再設計**＝`TAG / THEME / SHARE / CORNERS / MORE`（MOTION は MORE パネルへ）。スマホは**選ぶ→CREATE の2手**で共有リンクと 1200×630 の画像ができる。
- **黒帯を消した方法が肝**＝画面外にレプリカを組まず、**画面に内接する中央の 1.91:1 の帯**に自動配置して `.outerFrame` を `fit:'cover'` で撮る。`computeCoverRect` は中央を切るので帯と一致する。背景・パターン・カードは全部本物＝**盤面と共有リンクが食い違う余地がない**。
- **レビューが設計の穴を2つ潰した**: ①横長画面で帯≠切り出し ②**`fit:'cover'` を誰も固定していなかった**（`contain` に戻しても全テスト緑だった）→ 黒帯検出テストを追加。
- **★e2e の実態が判明（N-53 を書き換え）**: 「board-b0 の6本」ではなく **master 単体で 58本中 30本が落ちる**（本ブランチと同数＝新規混入ゼロを A/B 実測）。`Test timeout` 20件・`VersionError` 13件。**回帰検出網が半分死んでいる**。
- **★実機確認の残**: ①選択モードの指スクロール ②`SHARE` の OS シートで X / Instagram / LINE が画像とリンクをどう拾うか ③画像の文字が読めるか ④タブレットの回転ノブ。
- **★次**: N-54（グリッド交点が濃くなる）→ N-51 の残り（スマホに背景タイトル）→ N-50（タブレットの作法）。掃除として N-53。

### 直近の状態 (セッション 184 — ★スマホ/タブレットの致命傷を5件連続で出荷・全て本番反映)

**N-46 実機OK（ユーザー確認済「完璧に直ってました」）。以降 N-47 / N-48 / N-51 / N-52 を同セッションで出荷**（各: tsc0 / vitest 2215 / e2e / `allmarks.app` デプロイ済）。掃除 N-45 も完了（フル e2e 19 passed）。

- **確立した規則＝「大きさは入力で決める。並べ方は幅で決める」**（Apple HIG 44pt / Material 48dp は入力基準・Google は `isTablet` 型のレイアウト分岐を明確に非推奨）。**このアプリにタブレット用レイアウトは存在せず、744〜1180px は PC と同一描画**＝主要操作が全て 27px（→ N-50）。
- **★実機確認の残**: ① N-48 受け取りの下部 IMPORT バー（スマホ・タブレット）② N-51 スマホ盤面の左右16px/すき間14px の見え ③ N-52 THEMES→CUSTOMIZE の THICKNESS スライダー。
- **★次の宿題**: **N-49（スマホから SHARE できない＝ミッションの根幹）** ／ N-50 タブレットの作法 ／ N-51 の残り（スマホ盤面に背景タイトルを出すか）／ N-53 e2e 腐り。

### 直近の状態 (セッション 184 前半 — N-46 共有受け取りのスマホ・スクロール不全を根治)

**systematic-debugging で真因を確定→最小修正→本番反映**（tsc0 / vitest 2201 / e2e 6本 / `merge --no-ff` 8d4495c0 / `allmarks.app` デプロイ済）。

- **真因＝カードの `touch-action:none` の緩め忘れ**。`SharedBoard` が `CardsLayer` に `isMobile` を渡さない→`data-lock-card-scroll` が付かない→`.cardNode` が `none` のまま→3列密グリッドで指が必ずカードに落ち、ブラウザのネイティブ縦スクロールが打ち消される（**s180 と同一のバグが受け取り側だけ未修正**）。
- **実測で確定**（実 Chromium・390×844・ビルド済 out/）: 受け取り `.cardNode`=`none` / lock属性 **0-of-100**、本物盤面=`pan-y` / **51-of-51**。修正後は受け取りも `pan-y` **100-of-100**、盤面は不変。
- **`isMobile` 直渡しは不可**（`hoverActive = !isMobile && …` で `×`・タグピルが消える）→ 属性のみ駆動する専用 prop **`lockCardScroll`** を新設。`.scroller` も本物の `.mobileScrollContainer` に整合。**`setPointerCapture` は仕様上スクロールを止めないので温存**（W3C Pointer Events 3）。
- **CDP `Input.synthesizeScrollGesture` は実スクロールを再現できないと確定**（既知の正解=盤面すら動かず）＝ネイティブ触りスクロールは**実機のみ**検証可、を追認。
- **★実機確認の残**: ①受け取りが実際に滑るか ②100枚全マウント由来の残ジャンク ③スクロール中の `×`／タグピルの一瞬の点灯。**新規 (N-47)**: タブレット（>640px の触り端末）は未対応のまま＝ユーザー判断待ち。

### 直近の状態 (セッション 183 後半 — ★PC盤面＋共有の磨き4点(①②③④)を出荷・本番反映／次は⑤Pinterest(N-28)or 公開)

**束B（スマホ保存）実機OK後にユーザーが挙げた5件を調査・整理→①②③④を実装・本番反映**（⑤Pinterest=N-28 は来週）。サブエージェント駆動6タスク＋各レビュー＋opus 全ブランチレビュー READY TO MERGE。tsc0 / vitest 2198 / build OK / e2e 4本 / `merge --no-ff`・`allmarks.app` デプロイ済。

- **① テキストカードのフェード**（N-42✅）: PC の醜いネイティブスクロールバー→両端フェード＋バー完全非表示（既存 `computeTagScrollEdge` 流用・4状態）。ライトボックスの大文字カードにも波及（意図どおり）。
- **② 共有受け取り画面**（N-43✅）: 再発明でなく本物の `CardsLayer`/`ScrollMeter` は既に再利用済＝抜けていた2つを移植（スマホ3列の幅上書き＝1列解消／メーターを今の枠下帯へ＝PC古配置解消）。`CardsLayer` に isMobile は渡さず＝受け取りタップ path 不変。
- **③ SHARE「作成中」表示**（N-44✅）: 撮影中に `data-capturing` で消えていた進捗を、body への portal「CREATING YOUR LINK…」で撮影〜完了までずっと表示（撮影に写らない）。
- **④ TUNE マージンスナップ**（N-27✅）: 中央寄せせず左詰め維持・**今の列数のまま**左右マージン一致値に吸着（5列→4列に飛ばない）＋範囲で緑マークが光る＋画面px基準の吸着。純関数 `snapToFillAtCurrentColumns`。
- **★実機確認の残**: ②スマホ受け取りの3列/タップ開閉/×削除・メーター位置（Playwright 不可＝実機のみ）、④スナップの効き/範囲UIの見え、①フェード帯上のスクロール、③作成中表示。
- **★次セッション**: ⑤ **Pinterest 保存ボタン連動（N-28・優先度高）**＝実 DOM ダンプ診断から。他の拡張修正(N-25/N-29)と束ねて1回で再審査。or 公開関連。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 183 — ★スマホ・タブレット保存=束B を出荷・本番反映／次は実機確認→公開日宣言 or 束C)

**このセッションの成果（本番反映済・実機確認待ち）**: スマホ/タブレットの**保存導線を新設**（束B）。中心＝**賢い「+」ボタン**（右下フローティング・全タッチ端末＝`pointer: coarse`）: タップ→コピー済み URL を自動保存、読めない時だけ**下から出る入力シート**。加えて **Android 共有メニュー受け口**（`?shared=true` を起動時に読み保存→クエリ除去）。iOS/iPad は Apple 仕様で共有メニュー不可＝「+」が本命。**マウスのデスクトップには「+」を出さない＝byte-identical**。

- 3入口（+・シート・Android 共有）は `normalizeToUrl`（`https://`補完＋検証・裸単語は「.」必須でシート送り）→ `useSaveUrl`（保存の芯）→ 既存 `ingestPastedUrl`（重複排除/OGP/保存）に集約。`useUrlPasteSave` は芯を使う薄いラッパ化＝**PC 貼り付け＆ PiP は挙動不変**。テーマは CSS 変数＋`[data-theme-id]` で着せ替え可能（将来 `saveButtonVariant` 縫い代のみ予約）。
- 新規: `lib/board/{paste-url(normalizeToUrl),use-save-url,use-is-touch-device}.ts`、`components/board/MobileSave{Button,Sheet}.tsx`、i18n `board.saveInvalidHint`×15、`tests/e2e/mobile-save.spec.ts`。**検証**: tsc0 / vitest 2188 / build OK / e2e 5本 / opus 全ブランチレビュー READY TO MERGE。`merge --no-ff` で master 反映・`allmarks.app` デプロイ済。
- **★次セッション**: (1) **実機確認**（スマホ/タブレットで「+」保存・iOS のペースト確認1回・Android 共有メニュー）(2) 実機OKなら**公開日宣言可**→ 束C（13言語仕上げ＋規約正文条項）or 残りのモバイル磨き。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。deferred: B3 ホーム追加案内 / iPhone ショートカット / タブレット盤面最適化。

### 直近の状態 (セッション 182 — ★スマホ閲覧を一通り完成・全て実機OK／次はスマホ保存=束B)

**このセッションの成果（全て実機OK・本番反映済）**: 文字カード22px根治／ツイート対応（動画・複数画像ドット・翻訳）／リグレッション3件根治（ツイートメディアの大きすぎ・ボードのテキストカードスクロール等）／スマホで角丸ON/OFF（CORNERS）／スマホのタグ付け（下部の横スクロールタグ帯・タップ付与）。→ **スマホ閲覧（束A相当）は一区切り。次は束B スマホ保存**（[CURRENT_GOAL.md](CURRENT_GOAL.md)）。

- **(A) 文字カード 22px を根治・本番反映済**（実機確認待ち）: s181 は `!view.thumbnail`(サムネ無し) 経路だけ 22px 化していたが、**サムネ持ちで小さい/失敗するカードは `LightboxImageWithFallback`→`LargePlaceholderCardScaler` の zoom 拡大経路**を通り未修正だった（＝ユーザーの「変わってない」）。**直し方**：`LargePlaceholderCardScaler` をモバイルだけ zoom せず `.mobileTextMain`(22px, `--text-primary`) を直描画に集約＝**サムネ無し経路もサムネ失敗 fallback 経路も1箇所で捕捉**。s181 の暫定分岐と dead `shouldRenderLargePlaceholderCard` は撤去。デスクトップ不変。**Playwright(390px)で両経路 font=22px 実測**。
- **(B) ツイート対応を実装・本番反映済**（①動画 ②複数画像ドット ③翻訳、実機確認待ち）: 新規 `MobileTweetLightbox`（Lightbox.tsx 内）が `useTweetTranslation` を1回呼んで **main/caption に共有**し、既存の承認済み部品 `TweetMedia`/`LightboxImageDots`/`TweetText` を `MobileLightbox` シェルに載せ替え。
  - **①動画**: `TweetVideoEmbed` に `fullBleed`（没入ステージは横に文字カラムが無いので、デスクトップの 60vw キャップでなくアスペクトで viewport 充填）。再生ディスクをタップ→inline 再生は変わらず。
  - **②複数画像ドット**: `LightboxImageDots` に `mobile`＝メディア下部に**オーバーレイ**（デスクトップは `.media` 下にぶら下げ＝`.main` では画面外）。モバイルは左右スワイプ=カード送りなので**画像切替はドットタップ**。
  - **③翻訳**: `TweetTranslateControls` 抽出。写真動画ツイート=本文+トグルはキャプション画面。**文字ツイート=本文(22px)+トグルをカード画面に同居**（読む画面で翻訳・ユーザー決定）＝caption は著者+出典（`TweetText hideToggle`）。翻訳は `playEntry(el=null)` で**アニメ無しの即差し替え**。
  - **検証**: tsc0 / vitest2172（1件 flaky BroadcastChannel は単体で緑）/ build OK / **Playwright(390px) で ②ドット2＋main画像＋文字ツイート22px＋ページエラー0** を実測。①動画・③翻訳の実動作は X syndication/翻訳 API 依存＝**実機のみ検証可**。
- **★同セッション後半：実機フィードバック3件を根治・本番反映**（systematic-debugging＋Playwright 実測で原因確定）:
  - **(1)(2) ツイートメディアが大きすぎ・上スワイプで見切れる**: 新ツイート経路が `100vh` 制約だったが、他のライトボックスメディアは `--lightbox-media-max-h`（モバイル＝`100dvh - 76px`）を使う。実機の `100vh` はブラウザツールバー分を含む→はみ出し。`.main img/video` と fullBleed video wrapper を `--lightbox-media-max-h` に統一。**実測: 縦長写真ツイートが 281×844(端接触)→256×768(上下38px余白)＝通常画像カードと一致**。非ツイートは不変。
  - **(3) ボードでテキストカード上スクロール不能**: `PlaceholderCard` の `.titleScroll`(`[data-card-scroll]`) が `touch-action:none`（s180 由来）でネイティブ board pan も殺していた（s179 の意図＝「指スワイプでボードをパン」の逆）。`overflow:hidden` で内部スクロールは既に無効なので `touch-action:pan-y` に（board へフォールスルー）。**実測: hit chain が none→pan-y**。
  - **(新規要望) スマホでカード角丸 ON/OFF**: デスクトップは TUNE ドロワーだがモバイルに TUNE 無し→**ボトムナビに CORNERS タブ追加**（MOTION と MORE の間、同 `roundedCorners`/`handleToggleRoundedCorners`・IDB 永続）。アイコンが角丸⇔角ばりで状態表示。**実測: タップで `--card-radius` 14.4px⇔0px・リロード永続**。
- **★同セッション：スマホのタグ付けを実装・本番反映**（未着手だったもの）: デスクトップは「カードをタグ行へ**ドラッグ**」だがスマホはドラッグ＝スクロールなので不適→**タップ式**に。ユーザー記憶の「下部で横スクロールのタグ帯」＋Triage「tag chip 下部並べ」決定に合わせて設計・承認。
  - 新規 `BoardMobileTagBar`（画面下部・横スクロールのタグチップ帯・FilterPill 語彙）。TAG→タグモードで**ボトムナビを隠し帯を出す**。カードをタップで選択→**タグチップをタップで選択カード全部に付与**（緑フラッシュ）。「+ NEW TAG」で作成＋付与。選択は残し連続タグ付け可。DONE で退出。
  - `CardsLayer`: **モバイルのタグモードは pointer capture しない**（capture するとネイティブ board scroll が死に、デスクトップのタグドラッグが誤発火）。`onPointerDown` は bail（ドラッグ＝ネイティブスクロール）、`onClick`（native）で選択トグル。デスクトップのドラッグ付与と SHARE 選択は不変。
  - `BoardRoot`: `tagMode` で desktop=既存 `TagDropPanel`／mobile=`BoardMobileTagBar`。`handleAssignTagToSelection` は既存 `assignTagToCards`（additive）流用。spec `docs/superpowers/specs/2026-07-09-mobile-tagging-bottom-bar-design.md`。
  - **検証**: tsc0 / vitest2172 / build OK / **Playwright(390px) で 帯表示＋ナビ非表示・タップ選択でカウント更新・+NEW TAG 作成＋付与・既存チップ付与・DONE 退出** を実測（IDB の tags 反映を確認）。※横スクロールの感触・実機タッチのタップ／スクロール共存は**実機のみ**。学び: Next dev のインジケータが左下ナビに重なる→テストは dispatchEvent 駆動（本番にインジケータ無し）。
- **★次セッション**: (1) **実機で再確認**（ツイートメディア収まり・ボードのテキストカードスクロール・CORNERS・**スマホのタグ付け帯**）(2) その後 **スマホ保存（束B）** or 残りのモバイル磨き（ピンチリサイズ等）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 180 — ★スマホスクロール修正（✅実機OK）＋スマホ専用ライトボックス（没入型）を実装・実機フィードバック6ラウンドで大幅磨き込み／次はキャプション実機確認＆ツイート対応)

- **① スマホのネイティブスクロール修正（✅実機OK）**: カード `.cardNode` の `touch-action:none` をモバイル時だけ `pan-y` に緩めて解決（`[data-lock-card-scroll]` スコープ、③維持、デスクトップ不変）。ユーザー実機で上下スワイプ確認済。
- **② スマホ専用ライトボックス（没入型）を新規実装 → ユーザー実機フィードバック6ラウンドで磨き込み・全て本番反映**。最終形:
  - 開閉 = **transform ベースのモーフ**（カード⇄全画面。クローン方式は点滅＋reflowカクツキだったので `.main` 直接 transform-scale に。Apple風）。**開閉モーフ・backdrop フェードは元々 frameRef ゲートでモバイル全 bail していた**のを mediaRef 起点に修正（＝開くが無アニメ・背景が暗くならなかった真因）。
  - 左右スワイプ = 前後送り。**強フリックで複数枚を慣性減速**（瞬間速度＋最新 onNav 参照。古い onNav を握って進まないバグ修正）。
  - 上スワイプ = **キャプション2画面**（カード超縮小して上、キャプション下から連結。背景はPC同様「ぼかし backdrop の上に透明」。黒シート廃止＝`LightboxInfoSheet` 削除）。下スワイプ = 戻る/閉じる。✕廃止。縦長画像はシート域を見越したサイズ。
  - 新規: `MobileLightbox.tsx`／`use-lightbox-swipe.ts`／`lightbox-swipe.ts`(16test)／`lightbox-nav-types.ts`。`Lightbox.tsx` は `isMobile` 分岐＝**デスクトップ回帰ゼロ**（tsc0/vitest2172/build OK）。
- **s181 追加修正**（ユーザー実機OK）: キャプションを**縦2画面ページャー**に（カードは縮小せず上へスクロールアウト、キャプションはカードと同じ**中央**に。gsap を y(px) 統一で「上スワイプで出ない」バグ解消）。
- **★次セッション（ユーザー確定）**: (A)**文字カードの文字サイズ = キャプション 22px**（s181で半分だけ修正、実機で未変化。原因＝サムネ持ち文字カードは `LargePlaceholderCardScaler` の zoom 拡大経路を通り未修正。直し方は同 Scaler をモバイルで zoom せず 22px 直描画に）。(B)**ツイート対応**（①動画再生 ②複数画像ドット ③翻訳トグル）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。


- **原因を確定**（コード追跡で検証）: [CardNode.module.css:12](../components/board/CardNode.module.css#L12) `.cardNode { touch-action: none }` が**常時**適用され、カードは `width/height:100%` で枠を埋める。密グリッドのモバイルでは指が必ずカードに落ち、`.mobileScrollContainer`（`touch-action:pan-y`）のネイティブ縦スクロールが `none` にキャンセルされていた。**唯一の塞ぎ元**（ResizeHandle/CardCornerActions は [CardsLayer.tsx:1587](../components/board/CardsLayer.tsx#L1587) `!isMobile` ゲート＝モバイル未描画。`CardsLayer.module.css` は touch-action 未設定）。
- **修正**: `.cardNode` を **`[data-lock-card-scroll="true"]` 祖先スコープで `pan-y` に緩めた**（[CardNode.module.css](../components/board/CardNode.module.css)、CSS Modules の `:global()`）。この属性は `isMobile` の時だけ CardsLayer が各カードに付与（③の text-scroll ロックと同じスコープ）。**デスクトップは属性なし＝`none` のまま**＝並べ替えドラッグ無傷（回帰ゼロ）。内部 `[data-card-scroll]`（.titleScroll）は globals.css の `none` を維持＝③温存。
- **検証**: tsc 0 / vitest 2154 全緑 / `pnpm build` OK。ただし tsc/vitest は touch-action 挙動自体は検証不能（ビルド健全性のみ）。**実際のスクロールは実機のみで確認可**（Playwright は JS scrollTop で touch-action すり抜け＝memory `reference_native_scroll_touch_action_playwright`）。本番反映済、**ユーザーの実機確認待ち**。

### 直近の状態 (セッション 179 — スマホスクロールを慣性→跳ね返り→本物のネイティブスクロールへ転換／★実機でスクロール不能・次で touch-action 修正)

- **当初 (a) JS慣性を実装**（`momentum-scroll.ts`・業界標準値 τ=325/POWER0.8/rubberband0.15、22テスト）→ ①慣性減速 ②上部タップで先頭 ③テキストカード内部スクロール停止 ④端の跳ね返り を順に出荷。だが**ユーザー実機で「スクロールがストレス・カードにタップ取られる・途中でビヨン」**＝(a)方式の限界。
- **方針転換 (b)：スマホだけブラウザ標準の overflow スクロールに載せ替え**（ユーザー承認）。CardsLayer の自前パン/慣性/跳ね返り撤去・カードタップを native click に／BoardRoot に `.mobileScrollContainer`(overflow-y:auto)+spacer、scroll→viewport.y 同期(`handleMobileScroll`＝モバイル唯一の writer)／InteractionLayer touch-action モバイル pan-y／②・深リンク(`handleScrollMeterJump`)を `scrollTo` 化。**全て isMobile 分岐でデスクトップ回帰ゼロ**。`momentum-scroll.ts` 削除。tsc0/vitest2154/ビルドOK。**Playwright実測でデスクトップ回帰ゼロ＋モバイル scrollTop=400でカード400px移動**を確認して本番反映。
- **★だが実機でスクロール全く効かず**。**原因確定的**＝カード自体 [CardNode.module.css:12](../components/board/CardNode.module.css#L12) `touch-action:none` の緩め忘れ（密グリッドで指が必ずカードに落ち塞がれる）。**Playwright は JS scroll で touch-action すり抜け＝実機のみで露見**。次セッションで touch-action を `pan-y` に緩めれば直る見込み。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 178 — ★スマホ盤面の土台＋操作系を出荷・本番反映済／次はスマホ専用ライトボックス)

- **モバイル盤面を全面的にスマホ仕様に**（ユーザー方針＝計画書の「上部chrome整理」案を破棄して**全画面・ボトムナビ**に転換）。全部 `MOBILE_BP_PX=640` / `@media(max-width:640px)` ゲート＝**デスクトップは1pxも変わらない**（1489回帰スクショ確認済）。tsc0 / vitest 2154 全緑 / ビルドOK / 本番 `allmarks.app` 反映済（4回デプロイ）。
  - **外枠なし全画面・3列密グリッド（gap6）**（`MOBILE_LAYOUT` in [lib/board/constants.ts](../lib/board/constants.ts)、表示時 override のみ・保存値は不変）。左上 AllMarks ワードマーク・右上 FILTER ピル（タップで下開き・外側タップ/Escでのみ閉じる）・**ボトムナビ** `BoardMobileNav`（TAG/THEME/MOTION/MORE⋯、既存フローに配線）。背景巨大ワードマーク・ScrollMeter・言語ボタンはモバイル非表示。
  - **タッチ操作**＝タップ=Lightbox / **ドラッグ=盤面スクロール（カード上からでも）** / 並べ替え・リサイズハンドル・hover操作系はモバイル非表示（`handleMobilePointerDown` in [CardsLayer.tsx](../components/board/CardsLayer.tsx)、`onPanY`でパン・window listenerで再レンダー耐性）。絞り込み開時のカードタップは閉じるだけ。
  - 学び: **CDP合成タッチは1ドラッグ=pointermove1回**しか配信しない→swipe/滑らかさは実機のみ。詳細 memory `project_mobile_board_direction`、narrative は TODO_COMPLETED s178。
- **次＝スマホ専用ライトボックス**（中央大表示／キャプション下部peek→上スライド／縦スワイプで前後）→ その後 スマホ専用タグ付け → ピンチリサイズ。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 177 — リリース滑走路の統合実行計画を作成・実装は次セッションから)

- **コード変更なし（計画セッション）**。方針相談 → リリースまでの統合実行計画を **`docs/private/2026-07-08-release-runway-plan.md`**（非公開）に作成。束A スマホ閲覧 → 束B スマホ保存 → 束C 13言語仕上げ＋規約正文条項 → 束D 公開素材 → 束E 総仕上げ・公開、の5束・8〜10セッション想定。
- 計画の土台に**実コード調査2本**を実施済み（結果は計画書に焼き込み済・行番号付き）: ①モバイル対応の現状（viewport meta あり／LP レスポンシブ済／列計算は幅追従だが既定値がデスクトップ用／**スマホの保存経路は実質ゼロ**＝ブックマークレット導線はドラッグ前提・share_target は manifest 宣言のみで受け側なし）②i18n 全対象の棚卸し（15 locale × 403キー＋自前マップ2つ／parity テスト6本あり・placeholder 検査なし／**規約に正文条項なし**／ar は RTL 未対応）。
- 保存経路の再利用入口も確定: `ingestPastedUrl`（[lib/board/paste-ingest.ts](../lib/board/paste-ingest.ts)）＋既存 OGP プロキシ（[functions/api/ogp.ts](../functions/api/ogp.ts)）＝新設 URL 入力欄からそのまま呼べる。
- 方針まわりの記録は `docs/private/IDEAS.md` #5 の s177 節（機微につき tracked に書かない）。
- **次＝束A（スマホ閲覧）から実行**。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 176 — ★SHARE 自動画像化 出荷：手動スクショ撤廃・自動撮影で「①選ぶ②並べる③作る」の1ボタン化)

- **手動スクショを完全撤廃**。CREATE 1ボタンで、本物のアレンジ画面（CollageCanvas）を dom-to-image でそのまま自動撮影 → 1200×630 → 既存 R2／`/og/<id>.jpg` に接続 → LINK READY（COPY LINK / SAVE IMAGE / POST TO X）。
- **要（クロスオリジン汚染回避）＝同一オリジン画像 proxy `functions/api/img.ts`**（新規、`ogp.ts` の `isBlockedHost` 再利用・raster allowlist・16MB上限・リダイレクト再検証・immutable+nosniff）。撮影時だけ dom-to-image の clone の `<img src>` を `/api/img?u=` に差し替え（`render-share-image` の `rewriteImageSrc`／ライブ DOM 無改変）。取得失敗カードはアレンジ時点で既に文字カード化されているので新規劣化ゼロ。
- **検証＝本番まで完了**：tsc0／vitest 全緑／build OK。ローカル＋**本番 allmarks.app デプロイ済**。`/api/img` 本番 edge 実測（CDN=200画像／SSRF=400／SVG=415／dead=404）＋ **本番 Playwright で ARRANGE→CREATE→LINK READY、6/6 本物写真の WYSIWYG を目視**。学び：CF は Worker の 5xx を自前エラーページに差し替える→upstream 失敗は 404 で返す。一部 website は CF edge IP を 403 で弾く（rare・placeholder フォールバック）。
- 新規 `lib/share/proxy-image.ts`／`capture-collage.ts`、`ShareToast`・`BoardRoot` 簡素化。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s176 ／ `docs/private/IDEAS.md`「SHARE 自動画像化」§ s176。
- **s176 追補（ユーザーFB反映・本番OK）**: 共有画像を**本物のボード枠込み**に（外枠 `.outerFrame` を撮影、撮影時だけ右上メニュー等の操作クロームを `data-capturing`/`data-no-capture` で隠す、左上ロゴ＋枠は残す、`fit:contain` レターボックス）。カードは**ボードの端まで移動・拡大でき、枠でクリップ**（root を `clip-path: inset(--canvas-margin round --canvas-radius)`、クランプは撤去）。

### 直近の状態 (セッション 175 — ★SHARE 自動画像化の「実測」完了＝方向A（自動化全振り）確定・実装は次セッション)

- **全 722 ブクマ（削除56除く）をサーバー側 fetch して実測**（ユーザーのバックアップ JSON・非コミット）。各カードの表示画像URL（`mediaSlots[0].url`→`photos[0]`→`thumbnail`、YouTubeは i.ytimg 導出）をブラウザ相当UAで取得。
- **結果：写真で撮れる 652（90.3%）／取得失敗 8（1.1%）／元から文字カード 62（8.6%）**。画像持ち 660 中 **652（98.8%）成功**。ホストの82%は公開CDN（pbs.twimg 514・i.ytimg 30）で盤石。
- **失敗8件は全て「今の手動スクショでも既に壊れて写らない」もの**（404で画像消滅3／framer 400×2／og:imageがmp4 1／HTML 1／一時429 1）→ **自動化が原因の新規劣化はゼロ**。hotlink 403は corpus に0件（Referer回収も不要）。
- **実撮り検証**：同一オリジン proxy 経由で dom-to-image → 代表9枚すべて本物どおりに焼けた（tweet3・YouTube1・website5、`http://`含む）。汚染・空白ゼロ。
- **判断＝方向A（自動化全振り）確定**（ゴール基準「文字化 0〜わずか→全振り」に合致）。次セッションで proxy 構築＋SHARE 1ボタン化。
- 測定ノート `docs/private/2026-07-08-share-autocapture-measurement.md` ／ 証拠画像 `2026-07-08-share-autocapture-proof.png` ／ 実装メモは `docs/private/IDEAS.md`「SHARE 自動画像化」§。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 174 — ★#8 共有画像の一時保管「画像＋リンクで SNS 投稿・X でも確実に画像表示」出荷／#6 ライトボックス自動再生は見送り)

- **#6 見送り**（ユーザー合意）：ライトボックス自動再生は要否低。看板の「動画は終了で次へ」が5種中2種しかきれいに作れない（残りは時間切れ代替）＝一番高コストな部分が一番不確実。再挑戦は静止スライドショーの軽版から。
- **#8 完遂・本番反映済**（tsc0 / **vitest 全緑** / クリーンビルド＋assert-share-template OK）。ユーザー発案の流れ「自分でスクショ→貼付→共有リンク作成→X投稿/コピー」＋**LoPo(lopoly.app) の X 実証レシピ**を移植。
  - **なぜ手動スクショ**：盤面カードは外部オリジン画像を crossOrigin 無しで読む＝自動撮影はクロスオリジン汚染で真っ白（s169 が手動に倒した理由）。ユーザー自身のスクショは同一オリジンで汚染ゼロ。
  - **X 確実表示の土台（新規サーバー）**：OG 画像を **`/api/` の外の静的風 URL `/og/<id>.jpg`** から **リダイレクトせず 200 直接**配信（`functions/og/[id].ts`・R2 SHARE_OG・ミス時 og.png を 200・immutable）＋`patch-share-html` を新 URL に向け直し＋作成直後にキャッシュ温め。保管路(create.ts)・R2/KV は無改造。旧 `/api/share/<id>/og` は後方互換で残置。`twitter:card=summary_large_image` は成功ページに既存。
  - **クライアント**：`normalize-shot`(1200×630 JPEG)・`create-hosted-share`(作成+温め)・`share-actions`(intent+WebShare)・`ShareToast` 3状態（PASTE/DROP→CREATE LINK→LINK READY+POST TO X）・BoardRoot 配線(paste/drop/file→正規化→作成→アクション)。**スマホ Web Share は後日まとめて対応**（ヘルパー温存）。
  - **本番実測**：`.jpg` ルーティング preview 先行確認(scar 無し)→デプロイ→API 直投で `/og/<id>.jpg`=200 image/jpeg・`/s` メタ正・**Playwright 本番 E2E で貼付→CREATE→LINK READY 全 OK**(実共有 `WziUuM`)。
  - **残る手動確認のみ**：X に実際に貼って大画像カードが出るか（クローラー相手で自動不可）。
  - 正本 [spec](superpowers/specs/2026-07-08-share-hosted-image-og-x-reliable-design.md) / [plan](superpowers/plans/2026-07-08-share-hosted-image-og-x-reliable.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s174。
- **既知の非対応（任意・後日）**：スマホのワンタップ Web Share（画像添付投稿）。ヘルパー(`dataUrlToFile`/`canWebShareFiles`)実装・テスト済で、スマホ本格対応セッションで UI 配線するだけ。

### 直近の状態 (セッション 173 — ★#2 TUNE 刷新セット完了：角丸 ON/OFF トグル＋幅/ギャップの余白スナップを出荷)

- **#2 の残り2点を実装・本番反映済**（tsc0 / **vitest 2097/0**（+20）/ クリーンビルド / e2e 3本 PASS）。
- **(#1) 角丸 ON/OFF トグルを TUNE に同居**：TUNE ドロワー左列（プリセット下・破線区切り）に mixer 風スイッチ `CORNERS ROUND/SQUARE`（LED＋レバー、プリセット行と同じ視覚言語）。OFF で全カード角ゼロ、ON で従来の size-aware 角丸（`min(20, 幅×0.12)px`）。**ライトボックスも per-card `--card-radius` を継承して追従**。`BoardConfig.roundedCorners`（既定 true）で IDB 永続（`motionEnabled`/`bgTypoEnabled` と同じ器）。配線＝CardsLayer の per-card `--card-radius` に `!roundedCorners ? '0px' : …`。受信側 SharedBoard もローカルビュー設定として同トグルを配線。
- **(#4) カード幅/ギャップの「左右余白が揃う所」スナップ**：盤面は skyline で左詰め＝端数が右端だけに帯として残る（左右不揃い）。純関数 `lib/board/fill-snap.ts`（`fillCandidates`/`snapToFill`・10テスト）で `N×幅 + (N−1)×ギャップ = 盤面幅` の値を算出。W/G フェーダーに**緑の目印**（`.fillMark`）を描画し、**離した瞬間**その近く（±10px）なら吸着。**ドラッグ中は自由・Shift 微調整中は無効**（precision モード尊重）。`containerWidth`(effectiveLayoutWidth) と他軸値を BoardRoot→TuneTrigger→FaderColumn へ配線。
- 検証：Playwright e2e（`tests/e2e/tune-corners-and-snap.spec.ts`）で①角丸トグルが `--card-radius` を 20px⇔0px に切替②リロード後も square 永続③目印描画、を実測。スクショで丸⇔四角＋緑目印を目視。**フェーダー吸着は Playwright 駆動不可（setPointerCapture）→ 純関数＋fireEvent 単体テストで担保**。
- **同セッションで実機フィードバック2件も修正・本番反映・実機OK**：①角丸OFF時のライトボックス復帰で角が丸まる（radius ミラーの削除タイミングをモーフ完了後のみに分離）②再生中動画クリック→移行時の一瞬音（モーフのクローン `<video>` を muted 化。cloneNode は muted プロパティを引き継がない）。詳細は [TODO_COMPLETED.md](./TODO_COMPLETED.md) s173 追記。**#2 TUNE 刷新セットは完了。**
- **残（任意の磨き）**：CORNERS の操作感、スナップ吸着の強さ（±10px）、緑目印の視認性。
- **既知の非対応（任意）**：角丸 OFF は SHARE のコラージュ/共有画像には未追従（CollageCanvas は `var(--card-radius,20px)` フォールバック）。必要ならユーザー判断で追加。

### 直近の状態 (セッション 172 — ★#2 TUNE 復刻：s163 の横並び（横アコーディオン）TUNE を復活・本番反映済 deploy `4a0e1653`)

- **横並び TUNE を復活**（commit `92a9ec0`・tsc0 / **vitest 2077/0** / クリーンビルドOK・`allmarks.app` 反映済）。右縦ドロワー版（`d2fca70`）→ **b317fa2 の hover 開閉・横アコーディオン**（プリセット列｜彫り込み区切り｜W/G フェーダー＋操作凡例）へ差し替え。正本は `components/board/_archive/TuneClassicBody.*`。Playwright（/board・デフォルト WAVE）で hover→319×310 パネル展開・プリセット5・W/G フェーダー・区切り・凡例5行を実測。
- **★重要な事実訂正（plan/README の誤り）**：復刻手順が言う「TunePresetColumn.module.css の**横並び用48行**」は、実体は全部 **paper（羊皮紙）テーマの色上書き**で、レイアウトとは無関係。しかも消したのは `d2fca70` ではなく**別の意図的コミット `489caf7`「全メニュー中立化」**（s163 ユーザー合意：テーマは盤面だけに乗せ、メニューはどのテーマでも中立ダーク）。→ **48行は戻していない**。TUNE も paper 分岐（`useIsPaperTheme`）と paper CSS ブロックを除いて**中立（WAVE デフォルト見た目）で統一**した。
- **未決（ユーザー判断待ち）**：CURRENT_GOAL の「TUNE をテーマ追従に／タグ絞り込みも追従要否」は s163 中立化と正面衝突する。TUNE だけ追従にすると他メニュー（SETTINGS/THEMES/SHARE/絞り込み）と**ちぐはぐ**。→ やるなら**全メニュー一括**で別セッション（案C）。今回は横並び復活のみ（案A）で確定。
- **残りの TUNE 刷新セット（未着手）**：(#1) 角丸 ON/OFF トグルを TUNE に同居／(#4) カード幅・ギャップ調整で盤面左右端の余白が揃う所でスナップ。
- **ユーザー実機目視の残**：横並び TUNE の hover 開閉が自然か・盤面上での位置（TUNE ラベル直下に展開）・フェーダー/プリセットの操作感。

### 直近の状態 (セッション 169 — ★SHARE 手動スクショの仕上げ＋COPY LINK（画像再構成なし）出荷・master マージ済・本番反映済／opus 全ブランチレビュー「READY TO MERGE」)

- **4点を実装完了**（merge `--no-ff`・tsc0 / **vitest 2072/0** / クリーンビルドOK・`allmarks.app` 反映済 deploy `b6c16360`）。brainstorm→調査（getDisplayMedia/Web Share/永続許可）→spec→plan→**サブエージェント駆動8タスク＋各レビュー＋opus 全ブランチレビュー（READY TO MERGE）**。
  - **① メーター重なり解消**：配置(arrange)中はスクロールメーター(z400)を隠す（SHARING バー z116 の上に潜る件・ユーザー最初の指摘）。純関数 `shouldShowScrollMeter`（[lib/board/scroll-meter-visibility.ts](../lib/board/scroll-meter-visibility.ts)）。
  - **② 撮り方1行・OS判定**：`detectSharePlatform`/`pickScreenshotHint`（[lib/share/screenshot-hint.ts](../lib/share/screenshot-hint.ts)）で Windows/Mac/スマホ の該当1行だけ。ShareToast は `hint` prop 化。
  - **③ COPY LINK（画像再構成なし）**：配置トーストに追加。選択(`selectedIds`)から盤面順・`filter:null` で `/s` ペイロードを組み、**thumb 無しで** `createShare` → URL コピー。`copyShareLink`（[lib/share/copy-share-link.ts](../lib/share/copy-share-link.ts)・DI・**`captureMirrorToWebP`/`renderShareImage` を呼ばない**）。サーバー：create.ts の thumb を任意化（無ければ R2 put スキップ）＋og.ts を既定カード `/og.png` に 302 フォールバック（KV 実在時のみ・genuinely-missing は 404 維持）。`patch-share-html.ts` 無変更。
  - **④ 撮影ガイド**：配置に入るとパネル縁（`.canvas`）が一瞬だけ緑グロー→フェード（`box-shadow`/animation のみ・**レイアウト不変**・スクショに写らない）。
  - **方式決定の根拠（調査で裏取り）**：モバイルは `getDisplayMedia` 全滅（caniuse）・canvas系は全ライブラリがクロスオリジン汚染で撮れない・PC の getDisplayMedia も毎回許可が仕様で必須 → **全環境で手動スクショ＋URL併記**が業界水準。**レプリカ再構成は完全排除**（ユーザー決定・バグの温床）。
  - **全ブランチレビュー**：跨ぎ seam 3点（thumb-less create→KV→既定OG／選択は selectedIds 由来で全件化しない／既存 SHARE 無回帰）すべて ✅。Minor 1件（`buildShare` throw で凍結）は**その場で堅牢化**（try/catch＋テスト・fix commit）。
  - 正本 [spec](superpowers/specs/2026-07-07-share-manual-screenshot-polish-and-copy-link-design.md) / [plan](superpowers/plans/2026-07-07-share-manual-screenshot-polish-and-copy-link.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s169。
- **ユーザー実機目視の残**：メーター重なり消失・COPY LINK 動作（LINK COPIED→貼付で `/s/<id>`→開くと本物ボード）・撮り方1行が Windows 版・撮影ガイドが自然でスクショに写らないか。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **次（セッション170）＝ フラット化 サブ②（白フラット default テーマ・モック確認してから）**。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 168 — ★アレンジのコラージュを「盤面全体を端まで埋める」justified rows に作り替え・本番反映済／ユーザー未解決フィードバック解消)

- **アレンジ自動配置を justified rows（写真ギャラリー方式）に全面書き換え完了**（commit `feat(share): justified-rows fill`＋`fix(share): fill the whole board panel`・tsc0 / **vitest 2054/0** / build OK・`allmarks.app` 反映済 deploy `c9b6f562`）。brainstorm→spec→plan→インライン TDD＋敵対的コードレビュー→Playwright 実測。
  - 方針（ユーザー合意・平易な相談で確定）：**カードは縦横比だけ見て各行を横いっぱいに揃え、行数を選んで盤面の高さも埋める／盤面での大小（customWidth）は完全無視／上限＝盤面既定サイズ268px／隙間はカード高さに比例（盤面の 97:268 比）**。少数カードは中央寄せ（巨大化させない）、多数は端までびっしり。配置後の移動/拡大/回転は従来どおり（＝自動は「良い初期状態」）。
  - 純関数 `fitSelectionToScreen`（[lib/share/collage-layout.ts](../lib/share/collage-layout.ts)）を skyline＋一律縮小 から justified rows に差し替え（第3引数 `gap` → `opts?: FitOptions`・`COLLAGE_GAP_PX` 撤去）。行高は閉形、目標行高 H は**密スキャン**で「収まる中で最大総高」を選ぶ。
  - **L字余白の主因は2つ（実装中に判明・両方修正）**：①`handleEnterArrange` の rect が CANVAS_MARGIN を**二重控除**して縦横とも約96px小さかった（`viewport` は既に内側キャンバス clientW/H＝window−96 なのに更に `-2m`）。純関数はその小さい rect を100%充填していた＝右+下の帯。②`fitSelectionToScreen` の**二分探索が非単調な totalHeight(H) の谷にはまり下埋め不足**（per-row cap＋行分割の離散性）→ H 密スキャンに変更（**敵対的コードレビュー subagent が発見**・最悪 ⅔ 空きを実証）。加えて縦残余を行間へ配分（平均行高で頭打ち）。
  - **Playwright 実測（1920×1080 / 1489×679 / 2560×1080・100枚）＝ content が safe rect を幅・高さとも 1.000 充填・画面外0・ヘッダー/バー非重複**。旧 masonry は幅0.89/高さ0.77 だった。
  - **学び**：Next 増分キャッシュで**見た目検証時に stale JS が出る**（out/ 再ビルドしても古い chunk）→ 見た目検証前は `rm -rf .next out` でクリーンビルド必須。
  - 正本 [spec](superpowers/specs/2026-07-06-share-arrange-justified-fill-design.md) / [plan](superpowers/plans/2026-07-06-share-arrange-justified-fill.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s168。
- **次（セッション169）＝ SHARE フェーズ3（COPY LINK・親 plan Task8-10）or フラット化 サブ②（白フラット default）**。ユーザー実機目視の残＝アレンジの移動/リサイズ/回転が新配置でも自然か・少数カードの中央寄せ。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 167 — ★N-40「アレンジで多数カードが出ない」根治＋N-41 回転ノブ刷新・master マージ済・本番反映済／opus 全ブランチレビュー「Ready to merge」)

- **N-40 根治＝SHARE アレンジを「1画面に最大サイズで自動配置」に**（merge `b42c2fe`・tsc0 / **vitest 2051/0** / build OK・`allmarks.app` 反映済 deploy `77a0f06a`）。brainstorm→spec→plan→**サブエージェント駆動4タスク＋各レビュー＋opus 全ブランチレビュー（Ready to merge）**。
  - 新純関数 `fitSelectionToScreen`（[lib/share/collage-layout.ts](../lib/share/collage-layout.ts)）＝選択カードを skyline で詰め、**安全領域に収まる最大倍率を二分探索して全体を一律縮小**（倍率上限1＝数枚は盤面と同じ大きさ）。倍率は座標に焼き込み＝移動/リサイズ/回転はそのまま。定数 `ARRANGE_SAFE_INSET`（上80/下120/左右24）で上部クロム・下部 SHARING バー回避（s165 の「上に潜る」cosmetic も同時解消）。`handleEnterArrange` を WYSIWYG 盤面座標→フィットシードに差し替え。
  - **Playwright 実測で二次バグ発見→修正**（TDD の価値）：`packAt` が gap を倍率で縮めておらず、100枚×小画面（本番 gap 既定 97.21）で倍率が 1px 下限まで**崩壊→全カード不可視**。`gap*scale` に修正（commit `2a8c633`）。再検証で 1920×1080/1489×679 × 40/100 枚すべて**画面外0・崩壊なし**。回帰テストは実本番値で RED→GREEN 実証。
  - **N-41＝回転ノブを Canva/Figma 風の円形回転アイコン**に刷新（[CollageCanvas.tsx](../components/board/CollageCanvas.tsx)/`.module.css`・見た目のみ・`collage-rotate.ts` の角度ロジック不変・testid/hover 維持）。
  - 正本 [spec](superpowers/specs/2026-07-06-share-arrange-fit-to-screen-design.md) / [plan](superpowers/plans/2026-07-06-share-arrange-fit-to-screen.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s167。
- **ユーザー実機目視の残（Playwright 不可のジェスチャ/見た目）**：少数/多数選択の収まり、移動/リサイズ/回転、回転ノブ新デザインの見た目。**非ブロッキング磨き**：多数選択時に小カードが角丸で「楕円/ピル」に見える件（ユーザー判断）。
- **同セッション後半＝実機ブラッシュアップ2ラウンド出荷（ユーザーOK / deploy `d486acd7`）**：①回転ノブを線の先端(上)に（Figma/Canva）②紙装飾を**各カード幅に比例**（`--card-w`・盤面本体でもリサイズ追従）③アレンジを**盤面パネル(`.canvas`＝ウィンドウ−48)内**に収める④コラージュのギャップ16px（隙間解消）。**回転ノブ・装飾はユーザーOK**。
- **★ただし未解決の最優先フィードバック（s167末）＝アレンジが「盤面全体を埋めていない」**：100枚全選択で**右の縦帯と下の帯が大きく空く**（L字余白）。ユーザー要求＝「その空白が最小になるよう盤面全体に詰めろ」。gap の話ではなく**矩形を充填していない**こと（現行 masonry＋一律縮小は端がギザギザで埋めきれない）。→ **次セッション最優先＝justified rows 等の“矩形を埋める”レイアウトに作り替え**。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **次（セッション168）＝上記「盤面を埋める詰め方」→ その後 SHARE フェーズ3（COPY LINK）or フラット化 サブ②**。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 166 — ★SHARE 作り直しフェーズ2＝タイトル 出荷・本番反映済／サブエージェント駆動＋opus 全ブランチレビューで Important 1件摘出→修正)

- **SHARE 作り直しフェーズ2＝編集できるコラージュ見出し（タイトル）完遂**（HEAD `1c07630`・tsc0 / **vitest 2026/0** / build OK・`allmarks.app` 反映済）。arrange 段で TITLE トグルで出し入れする**背景の大きな見出し**を、その場インライン編集＋掴んでドラッグ移動＋隅で拡縮できる要素にした（**既定でカードの後ろ**＝背景見出し）。
  - 純ロジック `lib/share/share-title.ts`（`ShareTitleConfig{enabled,text,size,x,y}`・`defaultShareTitleConfig`/`resolveTitleText`/`setTitleSize`(clamp 24..800)/`moveTitle`・TDD）。新規 `ShareTitleElement.tsx`＝背景ワードマークの見た目 `.text` を CSS import で流用・**`BoardBackgroundTypography.tsx` は不変**（「mounted==visible・状態なし」信頼契約維持）・uncontrolled contentEditable（focus 中は imperative に textContent 更新＝caret 飛び回避）・可視性は純状態関数・クリック/ドラッグは距離閾値で切替・隅ドラッグ→フォントサイズ。CollageCanvas は optional `title` prop でタイトル層（z:auto＝カードの正 z より後ろ・`.root` は isolation:isolate）。BoardRoot は `shareTitle` state を `handleEnterArrange` で seed・`handleExitShareMode` で破棄。
  - 進め方＝**サブエージェント駆動**（Task ごとに実装者→レビュー→修正・モデルは純ロジック=haiku/コンポーネント=sonnet/配線=sonnet）＋**opus 全ブランチレビュー**。
  - **タスクレビューで Important 1件（Task7）**：TITLE トグルの sync effect が off→on で全編集を破棄→ブリーフ準拠の単純ミラーに修正（編集保持）。
  - **opus 全ブランチレビューで跨ぎ seam を1件摘出→修正**：arrange 中の TITLE トグルが**IDB 永続の `handleToggleBgTypo` を呼び、コラージュだけタイトル無しにすると DONE 後も盤面ワードマークが恒久的に消える**（spec §10「タイトル設定は React state のみ・永続なし」違反）→ arrange 中はトグルを ephemeral な `shareTitle.enabled` だけに向ける（`handleToggleShareTitle`）＋sync effect 撤去（`handleEnterArrange` の seed で入口の enabled は継承）。併せて編集中スクショの caret focus ring を `outline:none` 抑制。再レビュー＝MERGE YES。
  - **Playwright 実測（out/ ローカル＝デプロイ成果物）**：arrange で `share-title-element`=1（タイトル1つだけ）・`board-bg-typography`=0（元ワードマーク非描画＝二重タイトルなし）・title text="AllMarks"・z タイトル auto/カード 10（後ろ）・`[data-bookmark-id]`=0（グリッド隠れ）・collage-el 6。スクショ目視も正。
  - **automation 未検証＝ジェスチャ全般**（`setPointerCapture` で合成ポインタ不可）：インライン編集／ドラッグ移動／隅リサイズ／TITLE トグルの ephemeral（DONE 後に盤面ワードマークが元のままか）＝**ユーザー実機目視**。
- **同セッション後半＝実機フィードバックを多数反映・出荷**（ユーザーOK・commit `d02b922`/`df8637b`/`383f0b91`）：①リサイズの不連続ジャンプ根治（`resize-math.ts` 対角投影・盤面もコラージュも projection）②**アレンジをボードグリッドの WYSIWYG スナップショット化**（実座標を実測原点でそのまま・Playwright Δ0）③paper 装飾（テープ/画鋲）もコラージュに＋**コラージュ限定の自由回転**（回転ハンドル・15°スナップ・`collage-rotate.ts`）。narrative は [TODO_COMPLETED.md](./TODO_COMPLETED.md) s166 追記1-3。
- **次（セッション167）最優先＝N-40「SHARE アレンジで多数カードが出ない」を設計し直す**（根本原因確定・brainstorm 必須・ユーザーの一時 Share タグ案＋業界標準の pan/zoom キャンバスを評価）→ その後 N-41 回転ノブ刷新 → SHARE フェーズ3（COPY LINK・plan Task8-10）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 165 — ★SHARE 作り直しフェーズ1 出荷・本番反映済／サブエージェント駆動＋opus 全ブランチレビューで Critical 1件摘出→修正)

- **SHARE 作り直しフェーズ1（Task1-4）完遂**（HEAD `214e9a8`・tsc0 / **vitest 2016/0** / build OK・`allmarks.app` 反映済）。**窓を出さない二段モード**：ヘッダー SHARE → 第1段「選ぶ」（s157 選択流用・下部バー primary を **ARRANGE** にリラベル）→ 第2段「並べる」（**選択カードだけを空きテーマ背景の自由配置キャンバスに**・掴んでドラッグ移動/隅リサイズ/掴んで最前面）＋下部 **SHARING… トースト**（RESELECT/DONE）→ ユーザーが範囲選択スクショ → DONE/CANCEL/Esc で**グリッド復帰・一時状態破棄**（IDB 非永続）。**旧 SHARE 右ドロワー撤去**（`SenderShareModal` は open=false で温存＝フェーズ3 で裏ヘルパー化）。
  - 純ロジックは `lib/share/collage-layout.ts`（seed/move/resize/bringToFront・TDD）に切り出し。描画 `CollageCanvas.tsx`（`setPointerCapture` ジェスチャは薄いラッパ・`bindPointerGesture` で共通化）＋`ShareToast.tsx`（z `BOARD_Z_INDEX.SHARE_TOAST:116`）。BoardRoot は `selectMode:boolean` を **`sharePhase:'select'|'arrange'|null`** に一般化。
  - 進め方＝**サブエージェント駆動**（Task ごとに実装者→2段レビュー→修正ループ・モデルは純ロジック=haiku/統合=sonnet/BoardRoot=opus）＋**opus 全ブランチレビュー**。
  - **全ブランチレビューで Critical 1件摘出→修正**（タスク単位レビューでは見えない seam）：arrange 中も背後の**実盤面グリッドが透明キャンバス越しに見えていた**（spec §1.3「選んだカードだけを空きキャンバスに出す」違反・スクショに写り込む）→ `sharePhase==='arrange'` 時に **CardsLayer を非描画**（テーマ背景層は残す）＋CollageCanvas に専用 z 層 `SHARE_CANVAS:95`＋`isolation:isolate`（端の暗幕焼き込み防止）＋ヒント全角括弧→ASCII。**修正後 Playwright 実測**（seed→SHARE→SELECT ALL→ARRANGE で `[data-bookmark-id]`=0＝グリッド消滅・collage 6枚・DONE で復帰を確認）。
  - **automation 未検証＝オンボーディング SHARE beat の完走**（`setPointerCapture` 選択タップは合成ポインタ不可＋オンボ全走が複雑）＝コード経路は2レビュアーが健全と追跡済み・**ユーザー実機目視で確認**。
  - **本番目視の残（ユーザー）**：arrange のドラッグ移動/隅リサイズ/掴んで最前面／RESELECT で選択維持／DONE でグリッド復帰／**オンボーディング完走**。cosmetic：初期 seed カードが上部クロム裏に少し潜る（BOARD_TOP_PAD 未適用・ドラッグで下げられる・defer）。
- **次（セッション166）＝ SHARE フェーズ2＝タイトル**（plan Task5-7・`ShareTitleConfig` で背景ワードマークを編集/ドラッグ/サイズ/出し入れ・既定でカード後ろ）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。



- **① SHARE 作り直し（N-34/36/37/38 統合）＝ spec＋plan 完成・実装待ち**。確定：**(b) 併記**（SHARE=スクショ主役／`/s` は「COPY LINK」任意アクション）・**(a) 一時状態**（自由配置はモード中だけ・抜けるとグリッド復帰）・**A案 二段**（窓を出さずモード突入→選ぶ→並べる→範囲選択スクショ）・**タイトル今回実装**（背景ワードマークを `ShareTitleConfig` で駆動・編集/ドラッグ/サイズ/出し入れ）。実コード発見＝`/s` サーバー route は thumb 必須→COPY LINK は裏で thumb 生成するヘッドレス版に縮小。**spec** [2026-07-06-share-collage-screenshot-rebuild-design.md](superpowers/specs/2026-07-06-share-collage-screenshot-rebuild-design.md)／**plan** [2026-07-06-share-collage-screenshot-rebuild.md](superpowers/plans/2026-07-06-share-collage-screenshot-rebuild.md)（10タスク3フェーズ）。
- **② TUNE 横並び保管 完了**（commit）：`b317fa2` の横並び TuneTrigger を `components/board/_archive/TuneClassicBody.{tsx,module.css}.txt`＋README にビルド非結合（`.txt`）で保管。tsc 緑で非結合確認。IDEAS.md「TUNE 中身デザインの保管＋フラット化」の保管ステップ達成、フラット作り替えは今後。
- **次（セッション165）＝ SHARE 実装フェーズ1**（plan Task 1〜4・サブエージェント駆動）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 163 — ★フラット化 サブ①「メニュー中立化＋右ドロワー統一」出荷・master マージ済・本番反映済)

- **フラット化 サブ① 完遂**（merge `e5aceb0` `--no-ff`・tsc0 / **vitest2008** / build OK・`allmarks.app` 反映済・**盤面はテーマ可変のまま無変更／メニューは意図的に中立化**）。brainstorm→サブ① [spec](superpowers/specs/2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md)→[plan](superpowers/plans/2026-07-05-flat-sub1-menu-neutrality-right-drawer.md)→**サブエージェント駆動7タスク＋各レビュー＋opus 全ブランチレビュー（要修正1件を修正）**。
  - **共通右ドロワー基盤 `ChromeDrawer`** 新設（右ドック~400px・非ブロッキング・Esc/外側クリック/×閉じ・**body portal で z-405**）。**TUNE・SETTINGS・SHARE・THEMES を統一**（全クリック開き＝TUNE/SETTINGS の hover 廃止／SHARE は中央モーダル→右ドロワー~400px リフロー・書き出し隠しノード無傷）。`BoardRoot` に単一 `activeDrawer`（同時1枚）。
  - **絞り込み・カード＋タグ**は据え置き（中立化のみ）。**全メニュー中立化**＝paper chrome（scoped CSS・`--paper-panel-*`/`--chrome-*`・`useIsPaperTheme`）を全メニューから除去＋serif 漏れ防止に mono pin。`--paper-panel-*` 定義は温存（PiP/SaveToast）。`DEFAULT_THEME_ID` 不変（白 default は②）。正味 **約1000行削減**。
  - **opus 全ブランチレビューの要修正1件を修正**：TUNE/SETTINGS のドロワーが `TopHeader`（z-110 の重なり文脈）内で描画され設計 z-405 に届かず ScrollMeter(400)/オンボ幕(210) の下に潜っていた → **ChromeDrawer overlay を body へ portal**（4パネル全部が root で z-405）。狭い画面＋オンボ settings beat で実機確認済。
  - **本番目視の残**：シェア窓の実カードリフロー／TUNE 縦レイアウト／ドロワーがヘッダートリガーを覆う点（×/Esc/外側で閉じる）。
  - **follow-up（非ブロッキング）**：N-07 e2e seed 版数ズレでセレクタ更新は未実行検証／SharedBoard の TUNE・SHARE 同時開き得る／ThemePicker 残色トークンは②送り。
- **次（セッション164）＝サブ② 白フラット default テーマ**（新テーマ追加＋`DEFAULT_THEME_ID` 差し替え・モックで確認してから）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 162 — Mac実機バグ2件＋N-30出荷・本番反映済／★フラット化の方向性を確定＝次はサブ①から)

- **フルスクリーン保存の改善（N-39＋派生）出荷**（commit `a3d53ed`）：Mac-Chrome はフルスクリーン中に `window.open` を別タブ化する仕様 → `/save` が自分の（大きい）ビューポートで「タブとして開かれた」と検知し、①PopOut あり=最短クローズ ②PopOut 無し初回=中央カードで案内（フルスクリーン説明＋回避法：フルスクリーン解除/PopOut/拡張）③以降=静かに「Saved」→約1.3秒で自動クローズ。フルスクリーン時のみタグ付け省略。**「シークレットでタグ窓が別タブ」も同原因で解消**。純関数 `planSaveWindow`＋`isOpenedAsTab`（テスト）。
- **保存カードの15言語化出荷**（commit `ccae0f1`）：`/save` は I18nProvider 外なので `localStorage['allmarks-locale']` を読み自己完結の15言語コピー（`lib/bookmarklet/save-fullscreen-copy.ts`）。en/ja 確定・他13は Claude 初回訳＝**ローンチ前ネイティブレビュー対象**。Playwright で日本語表示実測OK。
- **N-30 PopOut「+ TAG」をカード外へ出荷**（commit `eab12f1`）：カード左上の重ね → **PopOut 窓上部中央の読みやすいピル**（`PipStack .addTagPill`）。PipCard から撤去・`pip-add-tag-button` testid 維持・/pip-tune にも表示。Playwright 実測OK。
- **★フラット化の方向性を確定**（親 spec [2026-07-05-flat-theme-and-theme-boundary-design.md](superpowers/specs/2026-07-05-flat-theme-and-theme-boundary-design.md)・commit `1212d1f`）：白フラットを新default／音波は温存／テーマは盤面5項目だけ／全メニュー中立＋大パネル右ドロワー統一（例外なし）／角丸トグル＋N-35／N-33 はサブ④／N-27 は切離し。**サブ①（テーマ境界＋メニュー中立化＋右スライド統一）から次セッションで実装**。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。
- **端末間同期の1日スパイク完了＝緑**（結果 `docs/private/IDEAS.md` (SYNC)）：Dropbox＝ブラウザ完結・refresh token 有りで最有力／Google Drive＝`drive.file` なら審査ほぼ不要。サーバーレスのまま案B成立。
- **学び**：Mac-Chrome のフルスクリーンは `window.open` を別タブ化（Chrome 仕様）＝コードのバグでない。ユーザーが「機能を正式名で呼べ」（PopOut を「相棒窓」と呼んで叱責＝memory `feedback_use_real_feature_names`）。

### 直近の状態 (セッション 161 — ③バックアップの法的守り A〜D 出荷・本番反映済・opus 全ブランチレビュー「READY」)

- **③ バックアップの法的守り A〜D 完遂**（merge `bb168f5`・`--no-ff`・tsc0 / **vitest1970** / build OK・`allmarks.app` 反映済・default 盤面 byte-identical）。brainstorm→spec→plan→**サブエージェント駆動7タスク＋各2段レビュー＋opus 全ブランチレビュー（READY TO MERGE）**。
  - **A 利用規約**：§3 に「データは端末内のみ・**控えを取る責任は利用者**・端末変更/ブラウザ消去/故障/更新での消失は復元不可」を15言語追記。**本番 /terms で live 確認済**（"keeping your own backups is your responsibility" / "cannot be recovered"）。
  - **B 初回「データの住処」カード**：オンボ finale 後（既存ユーザーは初回ロード）に一度だけ・**淡々調（ポエム排除・ユーザー要望）**・「GOT IT」で了解時刻 `data-home-ack` を記録＝二度と出ない。
  - **C SETTINGS 表示**：`BackupStatus`＝「Last backup: N days ago / never」を SAVING グループに常駐。
  - **D 定期リマインド**：`shouldShowBackupReminder`＝**新規15件＋前回控えから30日＋dismissから30日**が揃った時だけ1回・×(LATER)で `backup-nudge-dismissed-at` 記録。EXPORT で `last-backup-at` 更新＝自然沈黙（まめな人には出ない）。
  - EXPORT を共有ヘルパ `lib/board/export-backup.ts` に集約し SETTINGS ボタン／リマインド両方が最終バックアップ時刻を記録。純関数 `lib/storage/backup-reminder.ts`（13テスト）。正本 [spec](superpowers/specs/2026-07-04-backup-legal-safeguard-design.md) / [plan](superpowers/plans/2026-07-04-backup-legal-safeguard.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s161。
- **⚠ 公開前ゲート**：バックアップ機能の**13言語（en/ja以外）翻訳、特に Terms 法的条項は未レビュー**（Claude のたたき台）。ワイドローンチ前に**ネイティブ＋法務レビュー**必須。
- **先送り（next）**：**E＝DB更新前の控え促し**（不可逆スキーマ変更の直前に自動 EXPORT 促し・spec §3）／**複数端末同期（案B＝ユーザー自身のクラウド、課金候補）**は専用セッションで brainstorm（骨子 `docs/private/IDEAS.md` (SYNC) 節）。
- **学び**：`BoardItem` は `savedAt` 非保持（raw `BookmarkRecord` のみ）→ D は effect 内 `db.getAll('bookmarks')`＋`!isDeleted` で件数算出。vitest4 は `vi.fn<[..],..>()` 2引数ジェネリックが tsc で落ちる（`vi.fn<Fn>()`）。
- **次（セッション162・2026-07-06 月〜）＝★ スマホ本格対応（最優先・s161 ユーザー指示）**＋見せ用の共有ボード作成（ローンチ告知の素材）。その後 ① 自動画像 → ② カラーハント。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)・下記「★★ 最優先: スマホ本格対応」。

### 直近の状態 (セッション 160 — N-23 動画Lightbox「がくっと」修正・実機OK／拡張 v0.1.24 審査通過・ストアURLは既に配線済)

- **N-23 完遂（実機確認OK・本番反映済・commit `d05cc48`）**: YouTube 動画カード→Lightbox 移行で絵が「がくっと縮む」を根治。真因＝板は maxresdefault(16:9)/object-fit:cover、Lightbox poster は hqdefault(4:3)/contain（`.media img{contain}` が `.embedPoster{cover}` を詳細度で上書き）で**別サムネ**→ clone が 888幅に育った後、handoff で 667幅にレターボックス縮小＋低解像化。**Playwright 実測で確定**（板=cover/全幅、LB=contain/黒帯）。修正＝①`YouTubeEmbed` の poster を板と同じ maxres→hq→mq→0 の onError 鎖に（`item.thumbnail` 無視）②`.media img[class*="embedPoster"]{object-fit:cover}` で cover 復元（`.imageBox` 写真は無傷）。**新規リグレッションでなく既存の潜在不一致**（コメント自身が「YouTube はレターボックス不一致が一瞬見える」と自認していた）。tsc0/vitest実質全緑/build OK。memory `reference_lightbox_youtube_poster_parity` 記録。
- **拡張 Chrome ウェブストア v0.1.24 審査通過**（N-20 add-new-tag 入り）。**`EXTENSION_STORE_URL` は v0.1.21 時点(commit `108e198`)で既に投入・本番点灯済**（拡張ID `gefnpf…` はバージョン非依存で固定・`chromewebstore.google.com/detail/allmarks/gefnpf…` は HTTP200 実確認）→ **URL投入は追加作業ゼロ**、ストアが自動で v0.1.24 を配信。TODO/release-blocker の「URL投入が残作業」は**古い記述だった**（下記 release blocker #2 訂正済）。
- **次（セッション161）＝本命バックログ ③バックアップの法的守り**（利用規約明記＋初回説明＋定期リマインド＋危険操作前警告＋文面たたき台）→ ①自動画像 → ②カラーハント。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 159 — 拡張 N-20 完遂＋新規タグ作成／オンボ PopOut ペースト／高解像度は revert／次＝動画Lightbox「がくっと」修正)

- **拡張 N-20 完遂＋機能追加**：クイックタグ帯を「**+ add tag** ハンドル＋ホバー1列ドロワー」に刷新（上だけ2列を根治）＋フォント一致＋**スクロール末尾でフェード消滅**修正。さらに「**+ add tag クリックで新規タグ作成**」を web+拡張の往復で新設（`booklage:add-new-tag`・find-or-create は `applyNewQuickTag` 流用）。**敵対的レビュー2件で実バグ5件**（**IME 変換確定Enter でタグ化＝日本語全滅**／重複タグ→nonceガード＋送信済みSet／bookmarklet 悪用→bookmark存在ゲート＋`getBookmark`／keyup漏れ 等）摘出・全修正。**manifest 0.1.24・zip 生成・ユーザーが審査提出**。web 反映済。tsc0/**vitest1959**。commit `31e1092`/`eb2b5c2`/`958e255`。
- **オンボ PopOut にペースト保存を追加**：[PopOutReenactment.tsx](../components/onboarding/PopOutReenactment.tsx) に「URL 貼り付け→カード保存」ビート＋**キャプション15言語更新**（拡張もブクマも不要で保存を教える）。commit `419fb4d`・反映済。
- **アイデア洗い出し**：5レンズ→実現性判定→統合の workflow で **X-01〜X-25** を IDEAS.md に記録（拡張ロードマップ統合版）。
- **高解像度化（案X=Lightbox の X 写真のみ）を試みて revert**：表示時に新URLへ差し替えると **FLIP 時に未デコードで小さく表示**する劣化 → `6f4621d` でまるごと revert・本番は既知の良い状態に復帰。**教訓＝見た目変更は tsc/vitest 通過≠OK、実機確認してから出す**（次に高解像度を再挑戦するなら「元画像を先に表示→裏で先読み→差し替え」＋実機検証）。
- **次（セッション160）＝ N-23 動画Lightbox「がくっと」を安全に修正**（下記・ユーザー明示）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 158 — オンボ改善 N-21+N-22 出荷・master マージ済・allmarks.app 反映済／ユーザー実機目視のみ残)

- **オンボ改善 N-21+N-22 を出荷**（merge `28931b9`・`--no-ff`・tsc0 / **vitest1945** / build OK・`allmarks.app` 反映済・default 盤面 byte-identical）。
  - **N-21**＝`manage`/`settings` beat の `OnboardingSpotlight` に `captionAtBottom` 追加（1行）→ SETTINGS 説明が画面下中央に固定され開いたドロワーに埋もれない。
  - **N-22**＝desktop 専用 `popout` cinema シーンを `install` の後に追加。**当初 v1 はユーザー実機で①詰まり（NEXT 不可・盤面がクリックを奪う＝`.stage` の暗幕/`pointer-events:auto` 欠落）②品質低の2問題→ 同セッションで v2 に全面作り直し**（merge `ca81341`）。v2＝拡張チュートリアルと同方式（偽ブラウザ＋実LPスクショ＋緑カーソルが `POP OUT` をクリック→相棒窓が `back.out` でポップアウト→カードが右からグライドイン `power4.out`/0.7s＋常時メーター `00/00→01/01→02/02`→「+ TAG」でタグチップ点灯）。淡々コピー＋タグ/ジャンプ追記を15言語。実 PiP 非結合。
  - 進め方＝`superpowers:subagent-driven-development`。v1＝6タスク＋opus 全ブランチレビュー。v2＝2タスク＋各レビュー＋opus 全ブランチレビュー（Ready to merge YES）＋flash 修正 `eff5fc3`。正本 v1 [spec](superpowers/specs/2026-07-04-onboarding-settings-popout-design.md)/[plan](superpowers/plans/2026-07-04-onboarding-settings-popout.md)・v2 [spec](superpowers/specs/2026-07-04-onboarding-popout-reenactment-v2-design.md)/[plan](superpowers/plans/2026-07-04-onboarding-popout-reenactment-v2.md)・narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158。
- **同セッション末に実機フィードバックの追い込み修正4連（master `fb16eb8`/`bf34335`/`9305cbd` 他・全て allmarks.app 反映）**: POP OUT タグチップ被り→左上／SETTINGS beat のリングずれ→**トグルを上に固定＋スクロールロック**（[ExtensionEntry.tsx]）／キャプションをトグルの**すぐ左に寄り添う**（`captionLeftOfHole`）／**緑リングを body portal でドロワー(z401)より前面(z410)に**出して可視化（`ringAbovePanels`・定数 `ONBOARDING_SPOTLIGHT_RING`）。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158 末。**オンボは概ね OK**（残りは気になれば次回微調整）。
- **次（セッション159）＝拡張 N-20 修正＋再審査**（下記・ユーザー合図で着手）。
- **次（セッション159）**: N-20（拡張クイックタグ2列・`EXTENSION_STORE_URL` 投入と同回）／③プレミアムテーマ／④K3 解錠。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 157 — 選択的シェア「SELECT CARDS」出荷・master マージ済・本番実測 PASS)

- **選択的シェアを出荷**（merge `1aaeb37`・tsc0 / **vitest1942** / build OK・`allmarks.app` 反映済・Playwright 本番スモーク **12/12 PASS**・default 盤面 byte-identical）。SHARE モーダルに **SELECT CARDS** を追加 → 盤面が選択モードに（tap で選択トグル・0枚スタート・緑✓バッジ+緑アウトライン・下部バー `n/100 SELECTED`＋SELECT ALL＋SHARE(n)＋CANCEL＋琥珀「100 MAX」）→ SHARE(n) で確定すると**選んだカードだけ**を盤面順で共有（`filter:null`・タグ帯なし）。既存の「押したらすぐ新しい順100枚」は無変更。**受け取り側 /s/ は無変更**。
  - 純関数 `lib/share/selection.ts`(12テスト)＋`ShareSelectBar`(5テスト)＋`SenderShareModal` SELECT CARDS(3テスト)。CardsLayer 選択モードは tap ハンドラ＝receiver のツイン、選択中はホバーchrome を全非マウント。BoardRoot 配線は normal path が旧コードに一致（byte-identical 再検証）。
  - 進め方＝brainstorm→spec→plan→**サブエージェント駆動6タスク＋各2段レビュー＋opus 全ブランチレビュー（Ready to merge）**。レビューで実バグ2件摘出・修正（+TAG/タグpill行の未ゲート／再生トグルが `pointer-events:auto` でタップを奪う）。正本 [spec](superpowers/specs/2026-07-03-selective-share-design.md) / [plan](superpowers/plans/2026-07-03-selective-share.md) / narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s157。
  - **未対応の任意ブラッシュアップ（ユーザー実機判断待ち）**: 緑アウトラインの強さ／選択バッジの登場トランジション（spec通り今は無し）／選択の永続化はしない設計。
- **同セッションで追加**: ユーザー実機フィードバックを反映＝N-15 解決／拡張ストア審査通過（残＝`EXTENSION_STORE_URL`）／新規 N-20（拡張クイックタグ上だけ2列）N-21・N-22（オンボ）を backlog 追加。**オンボ改善 N-21+N-22 の spec と実装計画を完成**（[spec](superpowers/specs/2026-07-04-onboarding-settings-popout-design.md) / [plan](superpowers/plans/2026-07-04-onboarding-settings-popout.md)・6タスク・**実装は未着手**）。
- **次（セッション158）**: **オンボ改善計画をサブエージェント駆動で実装**（上記 plan）→ その後 N-20（拡張・URL投入と同回）／③プレミアムテーマ／④K3。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 156 — N-05 ブラッシュアップ v2+v3 完遂・master マージ済・本番反映済。LP はいったん区切り)

- **N-05 を3段直列＋境界マイクロ演出に刷新**（merge `782dcf6`・tsc0 / **vitest1922** / build OK・`allmarks.app` 実測 **13項目 PASS**・ユーザーOK → LP はいったんここで区切り）。
  - **v2（3段直列）**: 帯上は本文の姿のまま → ナビの行で止まって左→右の衣装替え（時間制の波 約0.45s）→ **横移動はスクロール駆動**（とどまり `holdPx:160` → `dashPx:140` を easeOutBack でスクラブ・完全可逆）。docked 状態と時間制 zip/return を**廃止**＝帯を離れる帰還は垂直のみ（**斜め軌跡を根治**）。**着地形はナビ実体と完全一致**（"Features" 混在ケース・-0.005em。s155 の uppercase+0.06em は誤実測だった。dockSlot は navLink 継承に修正）。許容差: per-char 化でカーニング分 幅+1.9px（実物と同時表示なし＝不可視）。
  - **v3（境界演出4点・全案採用）**: ①乗り上がり＝跳ねの波にスクロール駆動化（引き継ぎ瞬間は実 kicker と完全同姿＝がたっ根治。**DOM＝純関数 誤差0.000px 実測**）②hairline 屈折（横断中のみ per-char clip 分割・静止観察可）③玉ノック（下向き接触で一度・時間制は意図）④境界線グロー（語の真上だけ緑に灯る）。
  - 純関数 `dashProgress/dashEase/bandClimbProgress/charHopArc/crossGlow`（nav-dock-math **35テスト**）。チューニングは `NAV_DOCK` 定数（hold/dash/hop/knock 等）と `.module.css` の px 値だけ。
- 正本 spec: [2026-07-03-lp-nav-dock-morph-brushup-design.md](superpowers/specs/2026-07-03-lp-nav-dock-morph-brushup-design.md)（§9=v2 / §10=v3）/ narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s156。
- **同セッション追加＝LP最下部の黒幕バグ根治**（master `9e7ea1b`・本番実測 PASS）。ユーザー報告の「黒い部分の白い矩形」は **N-05 以前からの既存構造バグ**（s153 ビルドとピクセル同一を実測で確定）: 幕(finale)が footer の横 padding 内側で左右40px を覆えず＋トップLPは z文脈でヘッダーを覆えたことが無かった → ①幕の全幅化（PC全画面時のみ）②幕が上端に達したらヘッダー自身がフェード退場（可逆）。詳細 narrative s156 末尾。
- **未決（急がない）**: 13言語で演出が出ない件＝kicker を全言語英語に統一すれば全言語発動（見た目が変わるので要ユーザー相談・CURRENT_GOAL 検討メモ）。
- **次**: 本命バックログの優先順相談＝③プレミアムテーマ制作／④K3 解錠実装（`docs/private/2026-07-01-k3-unlock-plan.md`）／選択的シェア／タグ付け強化。

### 直近の状態 (セッション 155 — N-05 LPナビ格納演出を作り直して出荷・本番反映済 ※s154は全損だった)

- **N-05 完遂**（master `b0d81a6`・tsc0 / **vitest1901** / build OK・`allmarks.app` 反映済・本番実測 PASS）。5サブページで kicker がガラス帯に1文字ずつ乗り上がり→右へダッシュ→ナビの自分のスロットへバウンド着地（可逆）。
  - 新規 `lib/scroll/nav-dock-math.ts`(+14テスト)＝**範囲＋ラッチ式**判定（Lenis 慣性すり抜け不能・大ホイール実測で証明）／新規 `NavDockTraveler.tsx/.module.css`／配線＝SiteHeader スロット2枚持ち・MarketingShell(Lenis+traveler)・5ページ kicker anchor・landing-tokens ゲート。
  - **演出オフ条件（確定）**: reduced-motion（ユーザー確定・OS設定尊重）／≤960px／kicker≠ナビ語（**13言語はローカライズ済みで自動オフ**・en/ja は有効）。属性 `html[data-nav-dock]` は mount 後にのみ書く＝SSR/JS無効は従来表示。
  - 正本 [spec](superpowers/specs/2026-07-03-lp-nav-dock-design.md)（※§2「実コード確認」は s154 の偽読み混入 → [plan](superpowers/plans/2026-07-03-lp-nav-dock.md) 冒頭の訂正対照表が正）/ narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s155。
- **重大事実**: s154 の「実装済み・commit 88178ff」は**偽保存で実在しなかった**（fsck/reflog/origin/worktree まで捜索し痕跡ゼロ）。ディスクに届いていたのは spec/TODO追記/計測メモのみ。教訓＝**書き込み・commit は独立した実出力で確認**。
- **残る微調整（任意）**: バウンド強さ/ダッシュ速度/着地書体は実機の好みで `NAV_DOCK` 定数と `.module.css` の `--mp` 補間値をいじるだけ。
- **次（セッション156）**: ユーザー実機で N-05 の動きを確認→好みチューニング → 本命バックログ（③プレミアムテーマ／④K3 解錠／選択的シェア／タグ強化）。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

### 直近の状態 (セッション 152 — N-19「サイズ/並び順を default に戻す」出荷 → master マージ済 / allmarks.app 反映済)

- **N-19 完遂**（master `a7be63d`・tsc0 / **vitest1887** / build OK・default 盤面 byte-identical・本番反映済）。SETTINGS ドロワーに新グループ **LAYOUT** を追加し2操作を配線：
  - **RESET CARD SIZES**（リサイズ済み枚数表示・0枚で無効）＝全カードの手動サイズを解除→既定サイズへ（既存 `resetAllCustomWidths` 配線）。
  - **SORT: NEWEST FIRST** ＝ `savedAt` 降順で並び直し（新関数 `resortByNewestFirst`＝フラグ非依存で何度でも実行可。マイグレーション `repairOrderIndexIfNeeded` は無変更）。
  - どちらも**その場2タップ確認**＋実行後トースト。EXPORT バックアップが同ドロワーの保険。個別 ↺・TUNE ↺ は温存。
- 進め方＝brainstorm→spec→plan→**サブエージェント駆動5タスク＋各2段レビュー＋opus 全ブランチレビュー（Ready to merge）**→`--no-ff` マージ→デプロイ。15言語 i18n・機微情報なし。正本 [spec](superpowers/specs/2026-07-02-board-reset-layout-design.md) / [plan](superpowers/plans/2026-07-02-board-reset-layout.md)。narrative は [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション152。
- **フォローアップ修正（同セッション・master `365ddd4`・本番反映済）**：SETTINGS ドロワーのスクロールフェードが下端に固定されず特定項目（チュートリアル行）に黒帯が貼り付いて遅れて消えるバグを修正。根本原因＝`.scrollFade` の `position:absolute` がスクロールコンテナ（flex-column ドロワー）内でコンテンツと一緒に流れていた → 内側 `.drawerScroll` を新設してドロワー本体を非スクロール化、フェードを可視下端に常駐。Playwright 実測で dev＋本番とも合格。ユーザー実機OK（N-19 本体）。
- **次（セッション153）**：まず **フェード修正の実機目視**（allmarks.app ハードリロード→SETTINGS を少しスクロールし、黒帯が下端に留まり項目に貼り付かないか）→ その後 本命バックログ（③テーマ／④K3／選択的シェア／タグ強化）or N-05 LP格納演出。詳細 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

---

### 公開向け残タスク (= session 83 以降の優先度順、 session 82 で整理)

**release blocker (= 公開前 必須・残り)**:
1. **onboarding チュートリアル** — ✅ session 121 でユーザー「一旦OK」。追加ブラッシュアップは公開後でも可(ユーザーと一緒に随時)。
2. **拡張機能 Chrome Web Store 提出** — ✅ **完了**。v0.1.21 で初回審査通過→公開、**`EXTENSION_STORE_URL` は commit `108e198` で既に投入・本番点灯済**（`lib/board/constants.ts:34`、ID `gefnpf…` 固定・HTTP200確認）。N-20 を入れた **v0.1.24 も審査通過（セッション160）**＝ストアが自動で最新版配信。**URL投入の残作業はゼロ**（TODO の旧「残作業＝URL投入」記述は誤り）。
3. **公開前の残り片付け** — ✅ **実態調査で完了/不要と判明(TODO記載が古かった)**: `chrome-extension/` は不在(本物は `extension/`＝提出対象)。残るは上記2の `EXTENSION_STORE_URL` 投入のみ。
   - **BackupButton.tsx/backup.ts は未描画の孤立コード** → **B5(rank15)で「ユーザー向けバックアップ機能」として復活配線する方針に確定(session123)**。これは将来の DBバージョン上げ前に「ユーザーが自分でバックアップを取れる」安全網を用意する目的(=version bump の前提)。置き場所は SETTINGS ドロワー内が候補(要 user 確認)。

> ✅ 完了済 (詳細は TODO_COMPLETED.md): ドメイン取得 (session 102) / mood→tag rename (session 101) / **i18n 言語切替の配線**(層① runtime=session 106・層② LP言語別URL=session 109、 [lib/i18n/config.ts](../lib/i18n/config.ts) が locale 別動的 import) / **LP 全面作り直し + 紹介9ページ15言語化** (session 107〜112)。

**公開後でも OK (= 上澄み polish)**:
7. convex bezel 数値調整 (= session 82 試作 OK 後の微調整余地)
8. /triage 外周 4 段 bloom halo の 0.5x 絞り (= ハロ強すぎ件、 一旦 OK)
9. TagDeleteConfirmDialog 2 秒長押し feel (= 一旦 OK)
10. 「TAG THIS.」 サイズ + 緑パルス強度 (= 一旦 OK)

**別軸 (= 機能追加、 公開後の発展)**:
11. Song Bottle 風ブクマ交換 (= IDEAS.md)
12. ~~multi-playback (= 複数動画/音声同時再生)~~ ❌ **session 130 で user 見送り判断**
13. per-tag theme (= dominantColor + ThemeLayer 切替) — (N-01)カラーハントと統合余地
14. (N-02) Lightbox 自動再生プレイリスト (= 再生終了で次カードへ。multi-playback 見送り後の「再生体験」主役候補)
15. テーマシステム + 有料テーマ (= N-06、 ノーアカウント・ライセンスキー解錠案。 IDEAS.md)

### foundation 3 本柱 (= セッション 32 以降)

セッション 30 で合意した骨組み:
1. **サイジング汎用化** (= clamp(MIN, vw, BASE)、 spec 既存 `docs/specs/2026-05-12-sizing-migration-spec.md`)
2. **manual tag schema** (= IDB schema bump + tag CRUD + filter)
3. **広告 placement 予約 slot** (= board / footer / PiP)

推奨順 (1) → (3) → (2)。 詳細は `docs/private/IDEAS.md` 既存セクション + 戦略 spec。

### 拡張機能 polish (= セッション 32 以降、 別 sprint)

セッション 30 で 3 項目合意 (詳細 IDEAS.md F 項):
- ✅ PiP 自動常駐 (= 高難度)
- ✅ SNS いいね / ブクマ連動 (X / YouTube から、 設定で挙動切替)
- ❌ 右クリック位置改善は不採用、 代替の ショートカット + floating action button で対応

---

## 🐛 未対応バグ・改善 (active backlog)

完了済バグは TODO_COMPLETED.md に移動済。 ここはアクティブのみ。

### session 183 で報告（PC盤面＋共有の磨き — ★ローンチ前・s183 で着手）

> 束B（スマホ保存）実機OK後にユーザーが挙げた5件。s183 で調査（各項目 subagent 並行・事実確認済）→ **①②③④を s183 で着手／⑤(N-28) は来週**。グループ A=共有（②③）／B=PC質感（①④）。

- ~~**(N-42) ① PC のテキストカードのスクロールバーを廃止→両端フェードに**~~ ✅ **s183完了・本番反映**（`computeTagScrollEdge` 流用・両端フェード・バー非表示）。 — 旧: 現状 `.titleScroll`（[components/board/cards/PlaceholderCard.tsx](../components/board/cards/PlaceholderCard.tsx)）は `overflow-y:auto` の（薄く整えた）ネイティブスクロールバー＋**下端のみ**フェード（上端フェード無し）。**要望＝両端フェード＋バー完全非表示＋端まで行けばその側のフェードが解ける**。**気づき＝同パターンは既に FILTER のタグ一覧で完成・出荷済**（純関数 `computeTagScrollEdge` の `none/top/middle/bottom` 4状態＋`data-scroll-edge`＋mask-image・`FilterPill` / `tag-scroll-edge.ts`）。それを `.titleScroll` に移植＋バーを完全非表示に。**規模：小**。※ライトボックスの大文字カード instance にも同時に効く点に注意。
- ~~**(N-43) ② 共有リンク受け取り画面の乱れ（本物のボード機構の“移植し忘れ”2点）**~~ ✅ **s183完了・本番反映**（スマホ3列幅移植＝1列解消／メーターを枠下帯へ）。**実機確認の残**＝スマホ受け取りの3列/タップ開閉/×削除・メーター位置。 — 旧: 受け取り画面 `SharedBoard`（[components/share/SharedBoard.tsx](../components/share/SharedBoard.tsx)）は**再発明ではなく本物の `CardsLayer`/`ScrollMeter`/`computeSkylineLayout` を既に再利用**。乱れの原因は2つだけ：**(a) スマホで1列**＝`BoardRoot` の「モバイル=3列・カード幅上書き（`MOBILE_LAYOUT`）」が受け取り側に**未移植**→送信者の広い幅のまま→狭画面で1枚/行。**(b) PC メーターが古い**＝部品は最新だが**配置が s170 以前**（画面下中央 absolute・canvas 内）のまま。今の本物は `.frameBottomChrome`（枠下帯・canvas 外）。→ (a) `useIsMobile`+`MOBILE_LAYOUT` 由来の幅/gap/customWidths を CardsLayer と spacer に流す、(b) メーターを `frame.frameBottomChrome` に移す。**規模：小〜中**。※要注意＝`CardsLayer` の onPointerDown は `isMobile` を `receiverMode` より先に判定するので、受け取り側で isMobile=true にすると受け取り専用タップ処理が飛ばされ得る＝実機確認必須（memory `reference_native_scroll_touch_action_playwright`）。
- ~~**(N-44) ③ SHARE の「作成中」インジケーターが撮影中に消える**~~ ✅ **s183完了・本番反映**（body への portal「CREATING YOUR LINK…」で撮影〜完了まで常時表示・撮影に写らない）。 — 旧: CREATE 押下→自動撮影中は唯一の進捗表示（ボタンの「CREATING…」）が**撮影対象の枠内**にあり、`.outerFrame[data-capturing]` の `[data-no-capture]{visibility:hidden}` で**丸ごと非表示**。100枚だと画像100枚取得で数秒〜十数秒、その間「何も出ない＝スクショ撮れと言われてる?」に見える（ユーザー不安）。手動スクショ文言は既に未使用（残骸のみ）。→ **進捗表示を撮影対象の外（body への portal）に出す**（`shareCreateState==='creating'` で表示・撮影に写り込まず完了まで見える）。[ShareToast.tsx](../components/board/ShareToast.tsx) / `handleCreateHostedShare`（[BoardRoot.tsx](../components/board/BoardRoot.tsx)）。**規模：小**。

- ~~**(N-46) ★共有受け取り画面：スマホでスクロールがさくさく動かない**~~ ✅ **s184 で根治・本番反映**（**実機確認待ち**）。**真因＝カードの `touch-action:none` の緩め忘れ**（候補(a)が的中）。`SharedBoard` が `CardsLayer` に `isMobile` を渡していない → `data-lock-card-scroll` が付かない（[CardsLayer.tsx:1304](../components/board/CardsLayer.tsx#L1304)）→ `.cardNode` が `touch-action:none` のまま（[CardNode.module.css:12](../components/board/CardNode.module.css#L12)）→ 3列密グリッドでは指が必ずカードに落ちネイティブ縦スクロールが打ち消される＝**s180 と同一のバグが受け取り側だけ未修正**。**実 Chromium 計測で確定**（390×844・ビルド済 out/）：受け取り `.cardNode` = `none` / lock属性 0-of-100、本物盤面 = `pan-y` / 51-of-51。
  - **`isMobile` をそのまま渡すのは不可**（`hoverActive = !isMobile && …`＝受け取りの `×`・タグピルが消える）→ 属性だけを駆動する専用 prop **`lockCardScroll`** を新設し `lockCardScroll={isMobile}` を渡す。`.scroller` も本物の `.mobileScrollContainer` に揃えた（`overscroll-behavior:contain` / `-webkit-overflow-scrolling:touch` / `touch-action:pan-y`）。
  - **`setPointerCapture` は温存**（W3C Pointer Events 3：パン/ズームは pointer event の default action ではなく capture では抑止不能、かつ触りは pointerdown 時点で暗黙キャプチャ済み）。スクロール開始時は `pointercancel` が飛び既存コードが正しく弾く。
  - **検証**：tsc0 / vitest **2201**（+3 配線テスト）/ e2e 6本 / 修正後の再計測で受け取り `pan-y` 100-of-100・盤面は不変。e2e 回帰ガード2本は「修正を外すと落ちる」ことを確認済。**CDP `Input.synthesizeScrollGesture` は既知の正解（盤面）すらスクロールさせられず、合成での実スクロール再現は不可と確定**（memory `reference_native_scroll_touch_action_playwright` を追認）。
  - **残（実機のみ）**：①受け取りのスクロールが実際に滑るか ②100枚全マウント（受け取りは `UNCULLED_VIEWPORT_H` で間引き無効・盤面は51枚）による残ジャンクの有無 ③スクロール中に触れたカードの `×`／タグピルが一瞬光る点が気になるか。
- ~~**(N-47) 共有受け取り：タブレット（>640px の触り端末）でも同じスクロール不全**~~ ✅ **s184 完了・本番反映**（ユーザー承認「タブレットも指スクロールなので直して」）。判定を**幅ではなくポインタ**に変更＝`lockCardScroll={isMobile || isTouchDevice}`（既存 `lib/board/use-is-touch-device.ts`＝`(pointer: coarse)`、s183 の「+」ボタンと同じフック）。受け取り側のカードは並べ替えもリサイズもしないので `touch-action:none` に用は無い。副作用（承認済）＝タブレットでもテキストカードの内部スクロールは止まる。**実測**: Chromium は `hasTouch` だけで 1024px でも `(pointer: coarse)` を返すと確認 → e2e 1024×768 で `pan-y` を固定。

- ~~**(N-48) ★共有受け取り：スマホ・タブレットに「取り込む」導線が無い**~~ ✅ **s184 完了・本番反映**（実機確認待ち）。**実測**（本番 `/s/LJ41eU`）: スマホ 390px は `.frameTopChrome` が `display:none` で **IMPORT が 0×0 ＝完全に不可視**、タブレットは 196×**27px**＝指の最小 32px も Apple の 44pt も下回る。**確立した規則＝「大きさは入力で決める。並べ方は幅で決める」**（Apple HIG 44pt / Material 48dp は入力基準、Google は `isTablet` 型のレイアウト分岐を明確に非推奨）。→ 触り端末（`isMobile || isTouchDevice`）に `ReceiverImportBar`（盤面の床に `position:absolute`・高さ 52px・`BoardMobileNav` と同素材・`BOARD_Z_INDEX.TOUCH_BOTTOM_BAR=150`）。上部の 27px IMPORT と **ScrollMeter（掴む部分 360×18px）は触り端末では描画しない**。押下は既存 `handleSave` のまま。**検証**: tsc0 / vitest 2207 / e2e 10本 / 本番実測（スマホ 366×52・タブレット 904×52・PC は 196×27＋メーター維持・エラー0）。[spec](superpowers/specs/2026-07-10-receiver-touch-import-bar-design.md)。
- ~~**(N-49) ★スマホ・タブレットから SHARE できない**~~ ✅ **s185 完了・本番反映**（実機確認待ち）。[spec](superpowers/specs/2026-07-10-mobile-share-bottom-nav-design.md) / [plan](superpowers/plans/2026-07-10-mobile-share-bottom-nav.md)。サブエージェント駆動9タスク＋各レビュー＋opus 全ブランチレビュー **READY TO MERGE**（Critical/Important ゼロ）。tsc0 / vitest **2246** / クリーンビルド / e2e 新規5本（フルスイートでも緑）/ `merge --no-ff b9c43511` / `allmarks.app` デプロイ済。
  - **ボトムナビ = `TAG / THEME / SHARE / CORNERS / MORE`**。MOTION は MORE パネル（`ExtensionEntry` の VIEW 行・**モバイル時のみ描画**＝デスクトップは 1 行も増えない）へ降格。SHARE は中央・`data-active` 無し（共有中はナビ自体が引っ込むので点く瞬間が無い）。
  - **スマホに「並べる段」は無い**。CREATE が `sharePhase='arrange'` に**一瞬だけ**入り、選択カードを**画面に内接する中央の 1.91:1 の帯**に自動配置 → 2 フレーム待つ → `.outerFrame` を `fit:'cover'` で撮る → `computeCoverRect` が中央を切る＝**帯とぴったり一致**。**黒帯ゼロ・レプリカゼロ**（s169 の「レプリカ再構成は排除」を守る＝背景の二重管理を増やさない）。
  - **新規純関数** `lib/share/mobile-band.ts`（`mobileCollageBandRect` / `mobileCaptureScale(bandWidth)`）。鮮明さは `dom-to-image` の `scale = 1200/帯幅`（`renderShareImage`・`capture-collage` に `scale?` を新設。**未指定なら `scale` キー自体が付かない**＝デスクトップ撮影はバイト同一）。
  - **結果シート** `MobileShareResult`＝撮った 1200×630 を大きく見せ、`SHARE`（`navigator.share({files,url})`／files 不可なら url のみ／Web Share 無しなら非表示）・`COPY LINK`・`DONE`。`AbortError`（OS シートを閉じた）は**何も出さない**。撮影失敗でもリンクは作る。
  - **回転ノブ**を `@media (hover: none)` で常時表示に。**先に `data-no-capture` を付けた**（付けずに開けると、タブレットの共有画像にノブが焼き付く）。
  - **設計の穴を2つ、レビューで潰した**: ①初版の `mobileCollageBandRect` は帯の高さを画面に切り詰めており、横長画面で帯≠切り出しになった（帯を「内接する中央の 1.91:1 矩形」と定義し直して無条件成立に）②**`fit:'cover'` を誰も固定していなかった**（`'contain'` に戻しても全テストが緑だった）→ 画像の左右300pxを8px格子でサンプルして色数を数える**黒帯検出テスト**を追加。`contain` で確実に赤くなることを実装者とレビュアーが独立に確認。
  - **★s185 実機フィードバックで (N-56) が発覚＝画像ができない**。下記参照。合成環境（Playwright 390×844）では 5/5 緑だったので、**撮影は実機でしか検証できない**を追認。
- **(N-55) 撮影成功後もコラージュがシートの裏で触れる（s185 最終レビュー発見・非ブロック・実害なし）** — 成功後も `sharePhase` は `'arrange'` のままなので `CollageCanvas` が生きており、帯のカードを指で動かせてしまう（回転ノブも `hover:none` で見えている）。画像は既に撮り終えて R2 に載っているので**共有内容は 1mm も変わらない**が、「動かせるのに何も起きない」のは小さな UX の傷。直すなら成功時に当たり判定を殺す。※**(N-58) を実装するなら消える**（触れて正しくなる）。

### session 185 実機フィードバック（★次セッション最優先・N-56 は致命）

- **(N-56) ★★スマホで共有画像が作成されない（実機・致命・ローンチブロッカー）** — 症状（s186 でユーザー確定）＝**(a) プレビューが出ない・iPhone Safari・4枚でも発生**。
  - **✅ s188 で「診断可視化＋倍率フォールバック＋真っ白検出」を実装・本番反映済**（計画書 Task 1〜5 完了・opus 全ブランチレビュー READY TO MERGE・Critical/Important ゼロ）。撮影を段階別（no-frame/timeout/render/decode/blank/normalize）に診断し、失敗したら**倍率1で撮り直し**、iOS の「真っ白な成功画像」を失敗扱いにする。結果シートに **NO IMAGE — LINK ONLY** の琥珀枠＋**1行の診断文字列**（例 `#1 x3.08 render 9000ms RangeError… / #2 x1 ok 2100ms`）を出す。**デスクトップはバイト同一**（レビュアーが呼び出し元で検証）・**撮影失敗でもリンクは必ず作る**。
  - **★次セッション最優先＝実機で診断行を1回読む**: ユーザーに iPhone で `allmarks.app` → SHARE → SELECT ALL → CREATE を実行してもらい、結果シートの診断行（黄枠 or プレビュー下の灰色英数字）を報告してもらう。**その1行で真因が確定**し、恒久対応（下表）を1つ選んで別セッションで実装する:
    - `#1 x3.08 … → #2 x1 ok`（倍率が犯人）＝ F1: `fallbackScales` を `[2,1]` にして中間画質を確保＋将来「帯だけ撮る」最適化（canvas 面積 1/4）。**この場合は既にフォールバックで救えている**（画像は出る）ので、診断で確定させるだけ。
    - `blank`（iOS foreignObject 空振り＝真っ白）＝ F4: ユーザーと相談。canvas 直描画のモバイル専用レンダラー（大工事）か、「この端末は画像なし」を正直に出す（現状の NO IMAGE 表示のまま）か。
    - 両方 `timeout` ＝ F2: `timeoutMs` を 30000 に＋arrange 進入時に proxy URL を先読みして CF edge を温める。
    - `render SecurityError` ＝ F3: proxy 対象漏れ（srcset/CSS 背景）を特定。**この F3 で診断行の URL 切り詰めも同時に行う**（レビュアー Minor #2・現状は自端末・自データ・非送信なので出荷可）。
  - **N-58 との関係**: retry は現状「全再実行」（新しい /s リンクを作る）。N-58 実装後に「撮影だけ再実行」へ差し替わる（計画書明記）。
  - **★s188 実機結果（想定より深刻）＝OOM タブクラッシュ**: 100枚 SELECT ALL で、共有ボードは表示されるが CREATE（撮影）で**タブごと強制終了**（黒画面→再読込→ボードに戻る→繰り返すと Safari が止める）。リンクも作られない＝`createHostedShare` 到達前に死亡＝catch 不能なメモリ枯渇。**画面表示の診断（s188）はページごと消えて読めない**。s188 の倍率フォールバックも**タブが死ぬと土台ごと消えるので効かない**＝1回目の撮影を軽くするしかない。
  - **★s188.1 出荷済（本番反映）＝クラッシュ耐性パンくず**: `lib/share/capture-breadcrumb.ts`（localStorage 同期）＋`CaptureCrashNotice.tsx`（次回起動時に琥珀枠で読み返し）。撮影直前に `枚数・canvas WxH・元画像総MP(sourceMP)` を記録→無事終われば消す→落ちて残れば次回表示。tsc0 / vitest 2269 / build OK。
  - **★主犯確定（実機パンくず）**: `100 cards · canvas 1200×1744 (x3.2) · images 78MP`。canvas=210万画素(無害)、**images 78MP=撮影時に全カード画像を原寸展開で約310MB→タブ上限超過が主犯**（canvas の約37倍）。
  - **★s188.2 恒久修正 出荷済（本番反映）＝撮影時のカード画像 適応縮小**: `lib/share/capture-thumbnails.ts`（`captureThumbnailMaxPx`＝合計約12MP予算・100枚→346px・少数→原寸1200／`buildCaptureThumbnailMap`＝proxy 経由 fetch＋canvas 縮小・同時実行4）。`capture-collage.ts` に `captureThumbnails?` opt（**デスクトップは渡さず byte-identical**）。BoardRoot モバイル多枚数時のみサムネ Map を渡す（少数は原寸＝不変）。tsc0 / vitest 2277 / build OK。
  - **★s188.2 でクラッシュは解消（実機確認済）**。だが **6枚でも 100枚でも画像が出ない（暗い）＝枚数非依存**。→ **iOS Safari の dom-to-image が foreignObject 内の画像を描けない**制限が確定（PC Chrome では出る＝iOS 固有・候補①/F4 が現実化）。小技では直らない。
  - **★恒久修正＝canvas 直描画へ移行**（foreignObject 不使用）。計画書 **[2026-07-12-n56-mobile-canvas-renderer.md](superpowers/plans/2026-07-12-n56-mobile-canvas-renderer.md)**（Task 1〜5）。土台 `lib/share/capture-mirror.ts`（既存の canvas 直描画レンダラー・primitives 完成）を流用し、`chosen`＋`collagePositions`＋`band` から直接描く。**デスクトップは dom-to-image のまま触らない**。ユーザー承認済（¥0・安全確認済）。
  - **★次セッション最優先＝この計画書を subagent-driven-development で実装** → 実機で写真が出るか確認 → 出れば N-56 完了→N-58段階1。
  - 旧計画 [n56](superpowers/plans/2026-07-11-n56-mobile-share-image-fix.md)（診断・縮小）／ narrative [TODO_COMPLETED.md](./TODO_COMPLETED.md) s188。
- **(N-57) スマホのボードに背景タイトル（ワードマーク）が出ていない** — **これは s185 のスコープ外**（N-51 の残りとして次に置いてあった）。`BoardBackgroundTypography` の `!isMobile` ゲートを外すだけ。ユーザーの理由＝「ボトムナビの THEME からカスタマイズできるように見えるのに見えないのはおかしい」。出したら**スマホの共有画像にもタイトルを載せるか**を決める（s185 は盤面に無いので `setShareTitle(null)` にしてある）。
- **(N-58) ★スマホでもコラージュさせたい（＝s185 の「並べる段を出さない」決定を撤回）** — ユーザー曰く「簡素でもコラージュしたい。表現の場なのでスマホでもきちんと表現させたい」。s185 spec §2.1 でユーザー自身が「並べる段は出さない（失うもの＝移動・回転・拡縮・タイトル編集）」を承認していたが、実機で触って**表現できないことが受け入れられないと判明**。
  - **既に指で動く**（s184 調査）: 並べる段のドラッグ移動／リサイズ（掴めるが弧が hover 依存で見えなかった → s185 で `@media (hover:none)` により**回転ノブは指で触れるようになっている**）。
  - **要設計**: 帯（画面中央 1.91:1・390px なら高さ 204.75px）は指で編集するには狭すぎる。**「撮る枠」と「編集する画面」を分ける**必要がある（例: 帯だけをピンチズームして編集／編集中は帯を画面いっぱいに拡大して見せ、撮影時に縮める）。撮影の不変条件（帯＝`computeCoverRect` の切り出し）を壊さないこと。
  - **(N-55) と (N-56) と束ねて考える**。N-56 が直らないと編集しても写らない。
- **(N-59) スマホでも列数と余白を簡易的に変えたい（新規要望・小）** — 「決められた余白の値だけ動かせるようにしてもいい」。デスクトップの TUNE（W/G フェーダー）はスマホに無い。`MOBILE_LAYOUT.COLUMNS`(3) / `GAP_PX`(14) / `SIDE_MARGIN_PX`(16) は現在ベタ書き定数。**離散的な選択肢**（例: 列数 2/3/4、余白 小/中/大）にして THEME か MORE パネルに置くのが素直。IDB `board-config` に載せれば永続も既存の器で済む。
- **(N-50) タブレットの作法（s184 発見・ローンチ前）** — **このアプリにタブレット用レイアウトは存在しない**。分岐は `useIsMobile()` の 640px だけで、**744〜1180px は 1489px の PC と同一描画**。結果、iPad では SHARE 60×27 / TITLE 60×27 / TUNE 53×28 / POP OUT 74×27 / MANAGE TAGS 103×27 / メーター 18px と、**主要操作が全て指の最小寸法未満**。合格は「＋」保存ボタン 56×56 のみ。規則は N-48 で確立済（大きさ＝入力／並べ方＝幅）。適用先の棚卸しが要る。
- ~~**(N-51) スマホでボード背景が見えず、テーマの意味が薄い**~~ ✅ **s184 完了・本番反映**（ユーザーがモック5案から **(c) 3列のまま左右16px・すき間14px** を選択）。`MOBILE_LAYOUT` に `SIDE_MARGIN_PX: 16` を追加＋`GAP_PX: 6→14`。`BoardRoot` の `layoutSidePaddingPx`（モバイルのみ16／PCは `BOARD_INNER.SIDE_PADDING_PX`=9）で幅とオフセットを一本化。受け取り画面の `.scroller` も 640px 以下で左右16px。390px でカード幅は 120→110px、列数は3のまま。PC は不変。
  - **★残り（ユーザー判断）**: **スマホのボードでは背景ワードマーク（タイトル）はいまも描画されない**（`!isMobile` ゲート）。今回で見えるようになったのは**パターンと盤面色だけ**。タイトルも出すなら別対応（モック案 (e) 相当）。
- ~~**(N-52) パターン（グリッド・ドット等）の太さをスライダーで調整したい**~~ ✅ **s184 完了・本番反映**。THEMES→CUSTOMIZE の DENSITY 直下に **THICKNESS** 行（1〜6px・刻み0.2・右で太く）。**太さは2箇所にベタ書きだった**＝`patternSvgDataUri`（受け取り画面・OG 画像）と `themes.module.css` の CSS グラデーション（本物盤面・SHARE スクショ）→ 両方を `patternStroke` と純関数 `effectivePatternStroke`（`min(太さ, 間隔/2 − 1)`、下限0.5）に集約＝**盤面と共有リンクで線の太さが食い違わない**。**既定は1px も動かない**（線=1・ドット=1.4、**パターン種別ごとの既定**なのでグリッド→ドットに変えても r=1.4 のまま）。DB バージョン上げ不要（`board-config` の JSON 塊内）。共有スキーマは `.optional()`（必須にすると既存リンクの `custom` が丸ごと落ちる）。opus 敵対的レビュー＝SHIP・欠陥0。tsc0 / vitest 2215。
- **(N-54) ★グリッド/クロスハッチの「線が交わる所だけ濃くなる」（s184 実機FB・N-52 出荷後に判明）** — 薄い色ほど目立つ。**原因（要確認だが濃厚）＝本物盤面はパターンを CSS の重ね合わせグラデーション2枚で描いており、半透明の線が交点で二重合成される**（[themes.module.css](../components/board/themes.module.css) `.patternLayer[data-pattern='grid'|'crosshatch']`）。一方 **受け取り画面／OG 画像は `patternSvgDataUri` の SVG（1本の path に2本のサブパス＝1回の描画）なので交点は濃くならない**＝ここでも盤面と共有リンクで見た目が食い違っている疑い。
  - **候補の直し方**: 本物盤面も同じ SVG data-URI を背景に使う（`background-image: url(data:...)` ＋ `background-size`）。**副次効果**＝`theme-customization.ts:160-163` が言う「dom-to-image は重ねた CSS グラデーションの片方向を落とす」問題も同時に解消し、SHARE スクショの忠実度が上がる。`patternSvgDataUri` は毎回 `encodeURIComponent` するので `useMemo` 必須。パララックス（`background-position-y`）と `background-size` の互換を要確認。
  - **必ず受け取り画面でも確認**（memory `feedback_board_change_check_receiver`）。
- **(N-51 の残り) ★スマホのボードに背景タイトル（ワードマーク）を出す（s184 ユーザー確定）** — 現状 `BoardBackgroundTypography` は `!isMobile` ゲートで**スマホでは描画されない**。受け取り画面では出ている。**ユーザーの理由**＝「ボトムナビの THEME からカスタマイズできるように見えるのに、実際は見えないのはおかしい」。s184 で左右16px・すき間14px の余白ができたので出す余地はある。TITLE 色は既に `ThemeCustomization.titleColor` で可変。
- **(N-53) ★フル e2e が半分落ちる（s184 発見／s185 で実態が判明・想定よりずっと大きい・非ブロック）** — s184 は「`board-b0.spec.ts` の7本中6本」と書いたが、**s185 のフル実行で 58本中 30本が落ちると判明**。しかも **master 単体で 30本落ちる**（s185 ブランチと同数＝新規混入ゼロ、A/B 実測済）。
  - **失敗の内訳**（s185 実測）: `Test timeout of 30000ms exceeded` 20件／`VersionError: The requested version (9) is less than the existing version (16)` 13件／`toHaveAttribute` 8件／`element(s) not found` 2件。
  - **落ちる20ファイル**: `board-b0` `board-b-embeds` `board-mixed-media` `lightbox-video-flip-regression` `board-share-polish` `board-i-07-multi-image` `save-iframe` `bookmarklet-save` `board-theme` `triage-flow` `mobile-save` `lightbox-flow` `display-mode` `destefanis-save-flow` `board-b0-perf` `b-11-debug-open-scale` `board-backfill` `board-b-11-source-hide` `tune-corners-and-snap` `board-lightbox-nav`。
  - **VersionError の原因**＝`seedBoard` が `/board` を開いた**後**に `indexedDB.open(dbName, 9)` する（`[data-theme-id]` は React マウント前のプリペイント script が付けるので待機になっていない）。アプリが先に v16 で開き終えると失敗、開発サーバーが冷えていると偶然通る**競合状態**。無版数 open に直すと減るが、一部は v9→v16 移行による行の正規化に依存していた可能性がある。
  - **`Test timeout` 20件は未診断**。VersionError とは別の病気かもしれない（要調査）。
  - **1本 flaky**（連続実行で 29↔30 failed が揺れる）。
  - **腰を据えた掃除が要る**。単体 `vitest`（2246 全緑）と `tsc`(0) は健全なので、リリースの直接ブロッカーではない。ただし**この状態では「e2e が緑」と誰も名乗れない**＝回帰検出網が半分機能していない。
- ~~**(N-45) 掃除：古い SHARE e2e 3本が消えた testid を参照**~~ ✅ **実は完了済みと s186 調査で判明**（3本は commit `ac0b35da` で削除済み・この記載が古かった）。残る `lib/board/fill-snap.ts` の旧 `fillCandidates`/`snapToFill` prune は [N-53 計画](superpowers/plans/2026-07-11-n53-e2e-repair.md) Task 6 に組込み済み。

### session 161 で報告（Mac 実機・友人フィードバック ＋ 雑多改善 — ★ローンチ前クロスプラットフォーム）

> **前提の要確認（最重要）**: 友人が Mac で使ったのは **Chrome か Safari か**。拡張は Chrome ウェブストア版＝Chrome 専用。Safari だと拡張自体が入らない（＝タグメニュー等が出ないのは想定内で、対応は「Safari 拡張を別ビルド（大）」or「拡張なし導線＝ブックマークレット/貼り付け/PopOut を磨く」）。Mac-Chrome なら実バグ。ここで scope が大きく変わる。

- ~~**(N-40) ★SHARE アレンジで多数カードが表示されない**~~ ✅ **セッション167 完了（本番反映・merge `b42c2fe`）**。「1画面に最大サイズで自動配置」＝新純関数 `fitSelectionToScreen`（skyline パック＋収まる最大倍率の二分探索＋安全領域中央寄せ・gap も倍率で縮小）で何枚でも画面外に出ない。`handleEnterArrange` を WYSIWYG→フィットシードに。Playwright で 40/100枚×一般/実機画面すべて画面外0 実測。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s167。**残＝ユーザー実機目視のみ**。
- ~~**(N-41) コラージュ回転ノブのデザインを業界水準に**~~ ✅ **セッション167 完了（本番反映・N-40 と同回）**。Canva/Figma 風の円形回転アイコン（弧＋矢印 SVG）に刷新。角度ロジック `collage-rotate.ts` 不変・見た目のみ。**残＝ユーザー実機目視のみ**。
- **(N-24) ★Mac 対応必須（ローンチ前）** — 友人実機で複数箇所うまく動かない。スマホと並ぶ公開前クロスプラットフォーム項目。**ブラウザ＝Chrome 確定（s161）**＝Safari 非対応ではなく Mac-Chrome の実バグ。**タグ窓が出なかった件は N-25（タグ0件バグ）だった可能性大＝修正済**。残りの「複数箇所」＝下記 N-39 ほか、Mac 実機で1つずつ洗い出し（systematic-debugging Phase1）。
- ~~**(N-39) ブックマークレット保存の `/save` ウィンドウが「画面いっぱいの PiP みたいな見た目」（Mac-Chrome）**~~ ✅ **セッション162 完了（本番反映・commit `a3d53ed`/`ccae0f1`）**。真因＝**Mac-Chrome はフルスクリーン中 `window.open` を別タブ化する Chrome 仕様**（コードのバグでない）。対応＝`/save` が自ビューポートで「タブとして開かれた」と検知→中立な中央カード（間延び解消）＋初回フルスクリーン案内＋最短クローズ＋15言語化。**残＝Mac 実機の目視のみ（「おそらく大丈夫」）**。
- **拡張の再審査は束ねる**：拡張本体に関わる修正（**N-25 済／N-28 Pinterest／N-29 設定導線**）は**まとめて manifest 版上げ→1回でストア再審査**（審査サイクルを何度も回さない）。N-30(PopOut) は web(PiP) 側なので拡張再審査には不要。
- ~~**(N-25) タグ付けウィンドウが出ない（タグ0件の初回状態が原因・★ローンチ致命的）**~~ ✅ **コード修正済み（s161・要実機/再審査）**。systematic-debugging で確定：面＝**拡張のフローティングボタン quick-tag 帯**（`getStripAnchor` が画面右端・縦中央＝「別画面で画面中央右」に一致・ホストページ注入）。真因＝**受信側 [floating-button.js:611] の `msg.tags.length > 0` ガードが空配列を捨てていた**（送信側 dispatch.js は0件でも送っている／作成入力欄 `enterInputMode` は0件でも動く）＝**全新規ユーザーが保存時に最初のタグを作れない**。修正＝611 を `Array.isArray(msg.tags) && msg.bookmarkId` に（`tags.length>0` 撤廃）＋源泉 `shouldShowStrip`（tag-strip-model.js）とデッド copy(371) も同期＋テスト更新（tag-strip-model.test.ts）。本体ボード/PiP は0件でも正常（無条件で開く）と確認済。tsc0・拡張テスト131緑・node --check OK。**残＝ユーザー実機（unpacked reload で0件保存→右中央に「+ ADD TAG」帯が出るか）＋ Chrome ストア再審査（他の拡張修正 N-28/29/30 と束ねて1回で出すのが効率的）**。
- **(N-26/32/33/35) フラット化 — サブ①完了（s163）→ 次はサブ②** — 親 spec [2026-07-05-flat-theme-and-theme-boundary-design.md](superpowers/specs/2026-07-05-flat-theme-and-theme-boundary-design.md)。**白フラットを新default／現・暗い体験は「音波」テーマとして盤面 byte-identical 温存／テーマは盤面5項目だけ／全メニュー中立＋大パネル右ドロワー統一／角丸トグル＋N-35 つまみ／N-33 はサブ④で確定**。分解＝~~①テーマ境界＋メニュー中立化＋右スライド統一~~ ✅ **s163完了**（[spec](superpowers/specs/2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md)/[plan](superpowers/plans/2026-07-05-flat-sub1-menu-neutrality-right-drawer.md)・`ChromeDrawer` 統一＋メニュー中立化）→ **②白フラット default テーマ（次）** →③カスタマイズ（角丸＋N-35）→④音波命名＋N-33 タグ表記。下記の個別 N-26/32/33/35 はこの spec に統合済み（archive 用に残置）。
- ~~**(N-27) 左右マージンでスナップ＝実装済だが“矯正が有害”で作り直し（s183 実機で判明）**~~ ✅ **s183完了・本番反映**（中央寄せせず左詰め維持・今の列数のまま左右一致値に吸着＝列数を変えない・範囲で緑マーク点灯・画面px吸着。`snapToFillAtCurrentColumns`）。**実機確認の残**＝吸着の効き/範囲UIの見え。 — 旧: s173 で `fill-snap.ts`（`fillCandidates`/`snapToFill`・W/G 両フェーダー配線・当時実機OK）として出荷済。**が s183 実機で真の問題が判明＝スナップが強すぎて列数の意図を上書きする**：ユーザーは 5列にしたいのに、指を離すと「左右マージンが揃う別候補（4列）」に**矯正される**（`243.57/34.16` で 5列狙い→離すと 4列化）。原因＝`snapToFill` は「N×幅+(N−1)×gap=盤面幅」の**全 N の候補**から近い方に吸着するため、隣の列数の even-fill 候補に飛ぶ。**s183 調査の「吸着範囲が約2px で届かない」という当初診断は誤り**（届く時に誤爆している）。→ **正しい狙い＝「今の列数のまま左右マージンを揃える」**（列数を変えずに幅/gap を even-fill 値へ）。**設計を brainstorm し直す**（列数固定スナップ／ずっと弱く+明確な目印だけ／FILL ボタンで任意発火 等）。scope 小〜中。**s183 で着手予定（束B）**。
- **(N-28) ★Pinterest 保存ボタン連動（優先度高・来週着手予定・s183 でユーザー確定）** — s183 調査で確定: **Pinterest の URL を通常保存するのは今でも動く**（Pin ページの `og:image`(i.pinimg)/`og:title`/`og:url` 完備＝きれいなカードになる・実 fetch で確認）。**未対応＝Pinterest 自身の「保存」ボタン押下での自動連動**（X like/YouTube like と同じ per-site 方式）＝**s49 で一度作って実機で動かず外した所**（真因未診断＝保存ボタンの DOM/`data-test-id` が検出できず）。再挑戦は**まず実機で実 DOM をダンプ→本当の属性特定**の1手が必須（note.js/vimeo.js が s49 でやった手法）。code は git history に生存（`TODO_COMPLETED.md:2908`）。scope 小〜中だが不確実。**他の拡張修正（N-25/N-29）と束ねて1回で再審査**。
- **(N-29) 拡張の設定、入れてすぐ見れる状態に** — インストール直後に設定/使い方が見える導線（初回 options ページ自動表示 or アイコンからの案内）。現状は気づきにくい。
- ~~**(N-30) PopOut の「＋タグ」をカード外へ**~~ ✅ **セッション162 完了（本番反映・commit `eab12f1`）**。カード左上の重ね表示 → PopOut 窓上部中央の読みやすいピル（`PipStack .addTagPill`）。カード形が変わっても位置固定・明るい画像でも埋もれない。spec [2026-07-05-pip-add-tag-outside-card-design.md](superpowers/specs/2026-07-05-pip-add-tag-outside-card-design.md)。**残＝Mac/実機の目視のみ**。
- **(N-31) タグ体験の作り直し：MANAGE TAGS 画面を廃止 → 「選択してタグにドラッグ＆ドロップ」** — 現状のマネージ/Triage（1枚ずつスワイプ）を廃止し、**ボタンで選択モード→カードを選ぶ→タグへ D&D で付与**に。s157 の SELECT CARDS 選択モード＋s95 の「画像ドラッグでタグ付け＋ガラス演出」構想を土台に流用余地。**大改修＝brainstorm 必須**。関連 memory `project_selective_share_shipped` / `project_tagging_top_priority`。
- **(N-32) メニュー系を全部フラットに刷新（design 方針・N-26 と一体）** — 全メニュー UI をフラット化。N-26（default テーマをフラットにして LP に寄せる）と同じ「フラット化」方針の一部。**まとめて brainstorm**（視覚言語の再定義＝大物）。
- **(N-33) タグの大文字表示（＝実は“見た目の設計判断”・brainstorm 合流／s161 調査済）** — **調査結果**：保存側は**既にケース保持**（`applyNewQuickTag` は入力どおり `trimmed` で作成、`addTag` は `input.name` 保存、照合は `toLowerCase()===toLowerCase()` の case-insensitive）＝**機能的に直すものは無い**。「小文字に見える」の正体は**表示側の `text-transform: lowercase` がアプリ全体で一貫**（[CardsLayer.module.css:41] 本体タグ／[FilterPill.module.css:366,419] フィルタ／[TagAddPopover.module.css:89]／triage TagPicker・TriageCard／ShareMirror／拡張 floating-button.css 計8+箇所）＝**意図的な統一デザイン**。→ 大文字を出す＝**アプリ全体の視覚変更**＝**フラット化 brainstorm（N-26/32/35）で「タグの見た目」として決定**（ui-design.md：見た目変更は要ユーザー承認、勝手に剥がさない）。**要確認の小さな別件**：share import (`lib/share/import.ts`) は名を lowercase 保存の疑い（import.test が `'design'` 期待）＝取り込みタグだけケースが落ちる不整合の可能性→ brainstorm 時に確認。
- **(N-35) 見た目の微調整コントロール：タイトルの font/サイズ、背景の格子の太さ・ドット径 等を変えられる** — ユーザーが盤面の見た目を微調整（タイトル書体・サイズ／背景パターンの格子線の太さ・ドット径 等）。既存 theme-customization（`resolveThemeCustomization`/`patternSvgDataUri`）＋TUNE 資産に接続。※N-26/N-32（フラット化・TUNE 見直し）と**方針の擦り合わせが要る**：default は静かに・でもユーザーに“表現の摘み”は残す＝両立可能。どの摘みを新フラット系で残す/露出するかは brainstorm で確定。
> **【N-34/36/37/38 統合 SHARE 作り直し — フェーズ1 出荷済（s165・本番反映）／フェーズ2・3 残】** [spec](superpowers/specs/2026-07-06-share-collage-screenshot-rebuild-design.md)／[plan](superpowers/plans/2026-07-06-share-collage-screenshot-rebuild.md)（10タスク3フェーズ）。**✅ フェーズ1（Task1-4＝コアモード：SHARE→選ぶ→並べる自由配置→範囲選択スクショ→終了でグリッド復帰／旧ドロワー撤去）出荷**。残：**フェーズ2＝編集/移動できるコラージュ・タイトル（Task5-7・N-37）** → **フェーズ3＝COPY LINK 併記（Task8-10・N-38 の /s 併記）**。以下の N-34/36/37/38 原文は経緯として保持。

- **(N-34) Share の作り方そのものを作り直す：選択→“疑似 Share タグ”で本物の盤面に入り、その場でサイズ/並び順を整えて送る** — 現状の選択的シェア(s157)は「選んだら即共有」。新案＝Share で選ぶ＝**疑似的に Share タグ/フィルタが付いた状態**で**本物のボード画面**に切替（複製プレビュー・ShareMirror を挟まない）→その場でカードの**サイズ・並び順を編集**→「この状態で送る」。**要設計判断**：その場の並べ替え/サイズ変更を **(a)** 共有だけの一時状態にして送信後に元の盤面へ戻すか、**(b)** 本物の盤面にも反映して残すか。**N-31（選択→本物の作業ビューで操作→実行）と同じ操作モデル**＝「選択して本物の画面で仕上げて実行」を Share・タグで一貫させる好機。既存 reorder/free-size 資産＋ `project_selective_share_shipped` を流用。
- **(N-36) 共有画面のときだけ“完全自由配置”解禁＝コラージュモード（N-34 の核心強化）** — N-34 の share 編集画面では通常盤面のグリッド/skyline を外し、**カードを自由配置（位置・重なり・サイズ）できるコラージュ**に。**通常の盤面はグリッド維持**（memory `feedback_allmarks_grid_no_tilt`＝グリッド常時・傾けない は“本体盤面”のルールとして継続）、free 配置は**共有画面限定の意図的な例外**。要設計判断：①傾き/回転まで許すか（従来 no-tilt との関係）②自由配置の座標を**共有データ形式に載せる**（現状は並び順ベース＝x/y を持たせる必要）③**受け取り側 /s も自由配置を再現**できるようにするか④`dom-to-image` 書き出し（シェア画像）との整合。＝データ形式・受け取り・書き出しまで波及する中〜大。
- **(N-37) 共有ボードのタイトルを自由化（無し〜自由文言／font・サイズも自由）** — Share 時にボードのタイトルを「無し」から任意テキストまで設定可。**盤面いっぱいに文字が欠けてもよい**＝font・サイズも自由（巨大タイトルが盤面を横断してOK）。N-35（タイトル font/サイズ）・N-34/36（コラージュ編集）と一体。コラージュの“見出し”として機能。
- **(N-38) ★Share の根本転換：レプリカ再構成でなく“本物の画像”で送る（WYSIWYG・スクショモード）** — ユーザー不満＝「共有すると自分のボードの見た目どおりにならない」。要望＝**1手増えてでも「スクショモードに入る→その画像を添付」**でピクセル一致で送る（レプリカを再現しない）。
  - **見解**：バイラル（X/IG 投稿）にはこれが正解＝**画像こそ拡散する**。N-34/36/37（自由配置コラージュ＋自由タイトル）→**CAPTURE して画像化→投稿**、で「作って見せる」一連に束ねられる。既存 `project_share_theming_screenshot`（dom-to-image スクショ方向）・`capture-mirror.ts` と地続き。
  - **正直な技術的壁**：ボードは他サイトのサムネ＝**クロスオリジン画像**を含む→ dom-to-image でキャンバスが tainted になり黒窓/失敗（既知 `reference_dom_to_image_bound_subtree`）。だから今の共有は“データ再構成”になっている。**ピクセル一致の画像化には画像中継（same-origin proxy）が要る**＝ここが本丸（中〜大）。
  - **推奨形**：**「画像で共有（投稿用・WYSIWYG）」と「ボードで共有（/s・取り込み可の従来型）」を別アクションに分ける**。1つに両立を強いない。ユーザー不満は前者で解消。

### session 157 で報告（ユーザー実機メモ・新規）

- ~~**(N-20) 拡張クイックタグ窓：上だけ2列のまま**~~ ✅ **セッション159 完了**（折りたたみを「+ add tag」ハンドル1個＋ホバー1列ドロワーに刷新＝2列を根治。さらに「+ add tag クリックで新規タグ作成」まで追加。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s159／manifest 0.1.24 提出）。

### session 159 で報告（ユーザー実機メモ・新規）

- ~~**(N-23) YouTube 動画カード→Lightbox で「がくっと小さくなる」**~~ ✅ **セッション160 完了（実機OK）**。真因＝板と Lightbox で別サムネ/別 object-fit（板 maxres/cover vs LB hqdefault/contain）→ handoff で絵が 888→667幅にレターボックス縮小。修正＝poster を板と同じ maxres 鎖＋`.embedPoster` を cover 復元。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s160／memory `reference_lightbox_youtube_poster_parity`。既存の潜在不一致（新規リグレッションではなかった）。
- **(参考) 高解像度化は s159 で試みて revert 済**（表示時に新URL差し替え→FLIP で未デコード縮小の劣化）。再挑戦時は「元画像を先に表示→裏で先読み→差し替え」or 保存時のみ、＋実機検証。memory `reference_lightbox_flip_content_equivalence` 隣に学びを記録。
- ~~**(N-21) オンボ：SETTINGS の説明が埋もれる**~~ ✅ **セッション158 完了**（`captionAtBottom` で下中央固定。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158）。ユーザー実機目視のみ残。
- ~~**(N-22) オンボ：POP OUT の説明シーンが無い**~~ ✅ **セッション158 完了**（desktop 専用 `popout` cinema シーン＋`PopOutReenactment`＝右グライドイン再現。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s158）。ユーザー実機目視のみ残。

### session 150続き で報告（ユーザー実機メモ7件 — 残タスクのみ）

> ✅ 完了（→ TODO_COMPLETED セッション150続き）: **N-17** TRASH の EMPTY TRASH ボタン赤 danger 化（本番反映・確認OK）／ **N-18** 拡張クイックタグ窓の見切れ（1列スクロール化・v0.1.22 パッケージ→**2026-07-02 ストア審査提出済**）。
> ⏹ 対応不要: **N-14** Lightbox 中のボードモーション（カード/動画/スライドショーは既に `ambientOn` gate で停止済）。
> 🅿 保留: **N-16** 空ボードの青モーダル＝**スマホ限定**（未対応プラットフォーム）。色トークンだけダーク化済（デスクトップは背景ワードマークに occlude され不可視＝実害なし）。スマホ対応時に再確認。

- ~~**(N-15) PC 電源入れ直し後、初回1回だけ拡張の保存が失敗するかも**~~ ✅ **セッション157でユーザー「終わってます」判定**（実機で再現しなくなった＝解決扱い。コード側の恒久対策が要るなら再浮上時に）。
- ~~(N-19) カードのサイズ/並び順を default に戻す~~ ✅ **セッション152 完了**（SETTINGS→LAYOUT に RESET CARD SIZES / SORT: NEWEST FIRST を2タップ確認付きで出荷。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s152）。
- ~~(#4 = 既出 N-05) LP ナビの格納演出ブラッシュアップ~~ ✅ **セッション155で実装・156でブラッシュアップ完遂**（3段直列＋スクロール駆動ダッシュ＋境界マイクロ演出4点。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s155/s156）。未決の残メモ: 13言語は kicker≠ナビ語で自動オフ（英語統一案は要相談）。

### session 140 で報告（新規・未調査）

- ~~**(N-08) ボード中央上に「よくわからない線」がある**~~ ✅ **session 141 完了** — 真因は DOM 実測で確定: paper 化で TUNE/SETTINGS の閉じた drawer に付けた `border:1px`+parchment 背景が、`max-height:0` でも上下ボーダー計2pxの帯として残り横線化（TUNE と SETTINGS が重なる中央が二重で濃い）。SETTINGS drawer は body に portal されるため Lightbox を貫通していた。修正: 羊皮紙サーフェスを `[data-open='true']` のみに限定（閉じ時は default 同様 border:0→高さ0→不可視）。代わりにユーザー要望の**手書き風インク下線**を TopHeader の actions `.group::after`（paper限定）に追加＝ヘッダーの子なので Lightbox で一緒にフェード。
- ~~**(N-09) 影の強度**~~ ✅ **session 146** — paper の3影（ボードパネル/台紙/破れ紙）を深い墨茶 `26,22,17`＋高アルファ＋遠層拡大で「がっつり」濃く。実レンダリング computed 値を実測。さらなる微調整は実機判断で随時。
- ~~**(N-10) 共有画像テキストカードの紙パリティ**~~ ✅ **session 146** — ShareMirror をノート紙シート＋手書きに（`pickTextNoteSheet` で盤面と選択一致・`isPaperTextNote` で `pickCard` 再現）。破れシート黒帯・サムネ CORS 黒窓も解消。同一実行で盤面↔共有一致を実測。本物写真の焼き込みは CORS 制約のため別途「画像中継」案を IDEAS.md に記録。

### session 141 で報告（新規・未調査 — ユーザー実機メモ）

- ~~**(N-11) タグ絞り込みメニュー最上部の黄緑**~~ ✅ **session 146** — 実測で当初の neon 緑は s141 で既に forest 化済と判明。真の指摘は「ALL 行の横長の緑塗り」で、user 判断により **どのテーマでも `.item.active` の背景塗りを撤去**（アクティブは下線＋文字明るさに一本化）。
- ~~**(N-12) Lightbox を開くと台紙（mat）が消える**~~ ✅ **session 144 ユーザー実機確認OK**（実装は s141）。ユーザー案で「台紙を Lightbox にも出す」のでなく**「額縁から中身だけ取り出す」**方式に決定: paper 画像カードは台紙＋キャプション＋空の紙窓を盤面に残し、**写真/動画だけ**が窓 rect から Lightbox へ飛ぶ（閉じると窓へ戻る）。clone を `[data-paper-window]` 要素だけにし、写真は `[data-photo-content]`＋`photoHidden` で source 側のみ不可視化。clone(写真)→media(写真) で従来の「台紙→裸写真」の唐突な差し替えも解消。**scope=paper画像カードのみ**（default/非paper/動画(VideoThumb)/テキストは gate 済みで無変更）。「空き額縁」見た目は Playwright で検証済だが、**開閉アニメは実クリックが要るため未自動検証→ユーザー実機で開閉確認待ち**。実装: [ImageCard.tsx](../components/board/cards/ImageCard.tsx) / [CardsLayer.tsx](../components/board/CardsLayer.tsx) / [Lightbox.tsx](../components/board/Lightbox.tsx)。
- ~~**(N-13) 画像カードの台紙リデザイン**~~ ✅ **session 142 完遂**（1コミット=1確認で進行・全実機確認OK）: ②写真を台紙に直接 cover（白窓撤去）/ ①高解像9種に刷新（Figma シート番号ピッカー選定→`card-mat-s*` JPEG、共有定数 `IMAGE_CARD_BACKING_POOL`）/ 方眼・ノートのシートを画像カード(全URL)にも `100% 100%` 全面表示で使用。途中で出た**白い下地3連バグ**（シート透明部裏の ivory 2層・矩形ボーダー幽霊枠・破れシートの矩形影）を実描画 repro で特定し透明化/drop-shadow化。破れシートでは写真コーナー抑制（`paperCardHasTornBacking`）。**残: N-09影強度 / N-10 共有テキストカード紙パリティ は別途**。
- ~~（旧 N-13 メモ）次回はこの順で1つずつ実機確認しながら~~ ✅ 上記で消化済（以下は当時の段取りメモ・archive）:**良くなった分は維持**（下線/N-11緑/N-12写真持ち上げ/テキスト先頭切れ/テキスト紙のままLB）。**次回はこの順で1つずつ実機確認しながら**:
  - **①台紙の品質** — 低解像の `card-mat-1/2/3/aged` は使わない（ぼける）。高解像 `card-mat-4/5` + `lined/grid` + 方眼/ノート `card-paper-graph/notepad` を使う。
  - **②写真/動画の乗せ方** — **白い下地を出さない**。台紙の上に**直接 cover で乗せる**（`.paperPhoto` の `--paper-window-bg` 撤去＋`object-fit:contain`→`cover`、CardSlideshow も同様）。**キャプション等は見切れてOK**。
  - **③シートを使うとき** — 方眼/ノートは「穴・罫・綴じ」が見えるように（cover で切れない見せ方を要検討。`100% 100%` は伸びる）。**ユーザーが本当に欲しいのは「高品質な台紙の上に画像/動画が乗る」だけ**＝シンプルに保つ。
  - **④ライトボックス** — 写真だけ持ち上げ（N-12 済）／テキストは紙のまま（済）。台紙リデザイン時に矛盾が出ないか確認。
  - 関連スクショ/学び: 白窓の正体は `.paperPhoto` の warm 白背景＋`contain` レターボックス。低品質台紙は session140 で `card-mat-4/5` に置換された旧 `1/2/3/aged`。

### session 132 フォローアップ（Plan 2 で出た非ブロッキング・別タスク）

- **(N-07) e2e シード版数ズレ＝既存テスト債務** — `tests/e2e/board-b0.spec.ts` が IndexedDB を `open(dbName, 9)` で開くが app `DB_VERSION=16`([lib/constants.ts:30](../lib/constants.ts#L30)) のため VersionError → board-b0 全テストが seed 時に失敗。Plan 2 起因ではない(7回の DB 版数更新で蓄積)。テーマ切替 e2e は **構造は正しく un-skip 済**。直すにはシードを現行スキーマに合わせる(版数を 16 にし onupgradeneeded で現行ストアを作る、もしくはアプリのスキーマ生成を流用)。中優先。
- **`useTweetTranslation` 引数名リネーム** — [use-tweet-translation.ts](../lib/board/use-tweet-translation.ts) の引数 `themeId` は実際は motion キー('ink-underline'/'glitch-crt')を受ける(Lightbox が `getThemeMeta(themeId).motion.text` を渡す)。`textTransitionKey` 等へリネーム。軽微。
- **perf watch (4K)** — `lib/animation/tag-shutdown/themes/paper.module.css` の `filter: blur(1.5px)` アニメ(tagged-out カードのみ・一回0.46s)と `RulerTrack.module.css .marker { will-change: left }`(非標準)。現状許容、4K でジャンク報告が出たら最初に外す候補。

### session 130 棚卸しで追加（新規・実装可能）

- **(N-04) 一部ツイートで本文テキストが取れない** — repro `https://x.com/fta7/status/2059754329058488795`。次セッションで `/api/tweet-meta`→`cdn.syndication.twimg.com/tweet-result` の payload を実取得し、`text/full_text` が空か別フィールド(note/article)かを確認 → `parseTweetData`([tweet-meta.ts:137](../lib/embed/tweet-meta.ts#L137)) の分岐補強。詳細 IDEAS.md (N-04)。
- **(N-03) ローカル保存の安全性対策** — `navigator.storage.persist()` 要求で eviction 耐性を上げる(安価・高効果)＋EXPORT を目立たせる。Mac デフラグ等は IndexedDB に実質無関係。詳細 IDEAS.md (N-03)。

> session 130 で user が ✅完了 判定: 共有OGタイトル目視 / (I-03)ギャップスライダー / (I-08)フローティングボタン / (I-09)pill音波化 / PiP貼り付け保存・拡張なしカーソルpill。❌見送り: 複数同時再生 / (M)受け取りUI統一。新アイデア (N-01)カラーハント (N-02)Lightbox自動再生プレイリスト (N-05)LPナビ演出 (N-06)有料テーマ → IDEAS.md。

### 共有 (share) — 次セッション着手候補 (session 96 で user 要望)

- ~~**選択的シェア（新しい順100枚固定の改善）**~~ ✅ **セッション157完了**（SELECT CARDS で1枚ずつ選んで共有。詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) s157）。
- **受け取り画面 (/s/<id>/triage) をマネージ画面と同じ UI に** (session 96 user 要望) — 現状 [ReceiverTriage.tsx](../components/share/ReceiverTriage.tsx)(239行) はマネージ [TriagePage.tsx](../components/triage/TriagePage.tsx)(857行)/[TriageCard.tsx](../components/triage/TriageCard.tsx) を**全く再利用していない別物**。user は「マネージと同じ UI で文言だけ共有用に変える」体験を希望。ただし目的が違う (マネージ=自分のブクマ整理 / 受け取り=他人のを取り込み + 送り主タグ提案 + 重複検出) ので「共通部品を共有 + 取り込み固有の振る舞いを差し込む」設計が要る。**brainstorming で方針合意してから実装** (大改修、勝手にやらない)。マネージ側には session 95 の「画像ドラッグでタグ付け + ガラス演出」もあり、受け取りにも欲しいか含め要相談。
- ~~**フィルターのタグ 1 つでもフェードがかかり視認性が落ちる**~~ ✅ **session 122 完了** — 真因は静止時でなく「開くアニメ中に clientHeight が過小なまま→overflow 誤判定→フェードが一瞬タグを隠す」。判定を max-height 基準の安定値に変更（純関数 [computeTagScrollEdge](../lib/board/tag-scroll-edge.ts) に切出し+単体テスト15件）。実機計測で前後検証済。

### 表示・サムネ系

- ~~**B-#23 Vimeo / SoundCloud Lightbox 再生未対応**~~ ✅ session 51 で完遂 (= 専用 Embed コンポーネント追加 + 全 embed 共通 50% 音量デフォルト + SoundCloud カスタムスライダーまで波及)
- ~~**B-#22 長文 tweet Lightbox 末尾だけ表示 bug + 全文表示 enhancement**~~ ✅ session 52 で完遂 (= cleanTitle 過剰マッチ修正 + TextCard 透明グラス redesign + scroll + persistTitle backfill 開通 + font jump 解消、 9 file 変更 / 5 deploy / 19 unit test 追加)
- ~~**スクロール中にカードの場所が入れ替わる問題**~~ ✅ **session 122 完了 (rank1)** — 真因: サムネ無しカードの高さを「画面表示の瞬間に初測(w/1.25)」する作りで、表示前(推定aspect)→表示後で高さが変わり下のカードが全部ずれていた。高さ計算を決定論の共通純関数 [itemSkylineHeight](../components/board/cards/index.ts) に一本化（CardsLayer描画 / BoardRootスクロール範囲 / 共有プレビューの3箇所）。マウント順非依存に。実機で再現(12枚Δ804px)→決定論を単体テストで証明。**ユーザー実機での最終確認待ち**。
- **カードが左端に詰まらず隙間ができることがある** (session 93 報告) — 上記 reshuffle 修正で多くは解消の見込みだが、**残因として F5 = skyline-layout が segment の左端しか試さず右の窪みに詰めない**点が残る（監査 board-layout finder 指摘）。reshuffle のユーザー実機確認で「左すき間まだ出る」なら skyline に右端候補/backfill を追加。別途・低優先。
- ~~**共有ミラー (ShareMirror) の再現精度**~~ ✅ **session 96 で完了** — (a) カードの角丸: プレビュー `.card` を直書き 3px → ボードと同じ `var(--card-radius)` (20px) に統一 + OG 画像 ([capture-mirror.ts](../lib/share/capture-mirror.ts)) を角丸クリップ (`roundRectPath`+`clip`) 描画 + 半径をカード幅比で算出 (縮小率非依存) に修正。 実機 Chromium ピクセル検証済。 (b) 背景タグ文字は session 94 で対応済。
- **B-#3 重複 URL でサムネ等が出ない問題** — 同 URL 重複追加時の表示挙動を確認・修正 (セッション 20 では真因未調査、 個別 session で着手)
- **MinimalCard polish** — 64px favicon が S サイズ (160px) で大きく見える可能性。 Visual Companion でモック比較してサイズ判定 (セッション 20 で実装後、 視覚調整は次回)
- **Task 12: 全件再 check 設定 UI** — viewport revalidation で日常運用は OK だが、 ユーザーが 「いま全件チェック」 を 1 クリックで kick できる設定パネル。 設定パネル自体が未実装なので別 spec 立ち上げ要

### Lightbox animation 系 (セッション 23-24 で B-#17 open/close/動画 + 揺れ完成、 残課題あり)

- **B-#17-#3 internal nav (wheel scroll で隣カード) の clone-based 移行** (中期) — open/close は clone-based に移行済だが、 Lightbox 内で wheel scroll した時の隣カード切替は **既存 transform:scale ロジックのまま**。 動作確認まだ。 open/close が本番で安定したのを受けて、 次に着手するならここ

- **角丸 24 → 20 検討** (= B-#17 落ち着いた現時点でやって良い視覚比較) — 短時間タスク

### カード操作・PiP

- **B-#7 自由サイジング 縮小時の clipping ポイント** — サイズ 3 付近で「がくっ」 と変わる感触あり
   - セッション 13 で調査済 (修正 revert、 持ち越し)
   - root cause: 縮小カード自身は滑らかだが**周囲カードの reflow burst** が原因 (skyline masonry が discrete に bin-packing)
   - 計測スクリプト: `C:\Users\masay\AppData\Local\Temp\playwright-test-resize-neighbors.js` / `-enlarge.js`
   - 保留中の代替案: (a) リサイズ中は周囲固定、 release で reflow / (b) FLIP tween 再チューニング (duration / ease) / (c) skyline ヒステリシス / (d) 受容
   - ユーザー希望: 周囲の「ぬるっと」 質感は維持、 完全固定 (案 a) は最終手段
- **B-#8 PiP click → カードへスクロール の見切れ** — カードサイズによって画面外で止まる、 画面中央付近で止まる scroll に変更
- **B-#12 拡大時 viewport overflow 破綻** (セッション 13 で観測) — 自由リサイズで viewport を超える幅まで拡大すると skyline が破綻、 他カードが画面外に押し出される
   - root cause 仮説: `computeSkylineLayout` の containerWidth clamp が単一カードの超過時に未定義
   - 対策候補: (a) `maxCardWidth` を絞る / (b) skyline 側で width > containerWidth カードを単独行 / (c) ResizeHandle で max を明示

### ★★ 最優先: スマホ本格対応 (2026-07-06 月〜開始・ユーザー指示 s161)

**格上げ理由**: ローンチ告知（動画＋共有ボードのツイート）を見据える。X 流入の大半がスマホで、現状モバイル UX が最大の穴。「最後に回す」→ **最優先**に変更（s161 ユーザー指示）。まず**実機スマホで LP / 空 board / 共有ボード（`/s/xxxx`）がどう見えるか実測**→ brainstorm→spec→plan→サブエージェント駆動。共有受け取り側はオンボ非発火＝摩擦ゼロを確認済み（s161）。

> **★ ローンチ前必須の2本柱（s161 ユーザー決定）**: **(1) スマホ本格対応**（この節）＋ **(2) 端末間同期＝案B（ユーザー自身のクラウド／Googleドライブ等・サーバー無し・ポリシー無違反・課金候補）**。同期は**着手前に必ず1日スパイク**でブラウザだけで OAuth-PKCE 読み書きが完結するか実証してから本実装（緑→実装／赤→手動ファイル同期で先に出し後で自動化）。骨子 `docs/private/IDEAS.md` (SYNC) 節。加えて (3) 見せ用共有ボード作成／(4) 公開前の法務・ネイティブレビュー（13言語規約条項）。

- **ローンチ素材: 見せ用の共有ボードを1枚作る**（個人的でない“魅せ用”の綺麗なボード→共有リンク化。ツイートで押させるのはこの `/s/xxxx`。動画＋このリンクが告知の主役）。※これはコードでなくコンテンツ作業（ユーザー主体）。

- **B-#10 モバイル UX 本格チューニング** (セッション 9 末ユーザー報告・= 最優先の本体)
   - モバイルでカード列数が多すぎる + テキストカード縦伸び
   - デフォルトでモバイルは ~3 列にする
   - ピンチ操作でカード size 変更 (将来機能)
   - 実装方針: A 案 (即効) = `lib/board/size-levels.ts` で viewport-aware column / B 案 = mobile 起動時 level 2 default / C 案 (本格) = モバイル専用 SizeLevel テーブル
   - テキストカード縦伸び: `TextCard.tsx` に `max-height` or `aspect-ratio` クランプ + overflow:hidden

### TopHeader / chrome

- ~~**B-#13 TopHeader brushup**~~ ✅ session 41 で完了 (TUNE トリガー + 文字 chrome 化)
   - session 39 で ScrollMeter 下配置 + Lightbox 表現統一 (B-#20 解消)
   - session 41 で残りの上部 chrome (filter pill 以外) を TUNE / POP OUT / SHARE に整理 + scramble アニメで polish

### 拡張機能関連 (= session 44-45 で SNS ボタン連動 ship 後の残課題)

- ~~**B-#21 縦動画 tweet の card 縦横比**~~ ✅ session 45 で **(c) 受容** に user 判断確定 (= 翌ボードセッションで [lib/board/tweet-backfill.ts](../lib/board/tweet-backfill.ts) + [lib/board/backfill-queue.ts](../lib/board/backfill-queue.ts) が再取得して mediaSlots を更新するので直る前提)

### 拡張機能 連動の最終構成 (= session 49 user 検証後の確定 scope、 5 サイト 8 ボタン)

- ✅ **X (Twitter)** いいね + ブクマ
- ✅ **YouTube** 高評価 + 後で見る
- ✅ **note** スキ
- 🔧 **Vimeo** Like + Watch Later (= session 49 後半 fix、 user 再検証待ち)
- 🔧 **SoundCloud** Like (= session 49 後半 fix、 user 再検証待ち)
- ❌ **Instagram** 諦め (= ログイン壁 + CORS でサムネ取得不可)
- ❌ **TikTok / Bluesky / Threads / Reddit / Pixiv / Pinterest** 削除 (= session 49 で user 判断、 アカウントなし or 使用頻度低、 URL 保存経路は維持)

**重要原則**: 削除サイトでも 全 URL 保存経路 (= ショートカット Ctrl+Shift+B / 右クリック → Save to AllMarks / 拡張機能アイコン click / ブックマーレット) は **生きたまま**。 削除したのは「ボタン押すだけで自動保存」 連動だけ。

### 拡張機能 磨きフェーズ (= 9 サイト追加が終わった後、 詳細 IDEAS.md (I-08) (I-09))

- 🔜 **(I-08) 画面右端 floating ボタン**: content.js が全サイトに右端 fixed ボタンを inject、 設定で ON/OFF + 位置 (右上 / 右中 / 右下)
- 🔜 **(I-09) cursor pill 音波化 + テーマ連動設計**: 拡張機能の保存中フィードバック pill を音波 motif に + 将来テーマ system 追加時に連動できる CSS 変数受け口を仕込む

---

## ✨ 新機能アイデア (詳細は IDEAS.md)

`docs/private/IDEAS.md` 参照。 ここはタグだけ:

- **(s186 新規)** 切り抜きコラージュ（clipart.studio 型・手動なげなわ→AI 背景除去の2段）
- **(s186 新規)** シェーダーテーマ（WebGL 1 枚 canvas の擬似 3D 背景・超軽量）
- **(s186 新規)** 既存分の一括取り込み — **方針確定「対応サイトは基本全部、拡張で一括取り込みできるようにする」**（X ブクマ/いいね・YouTube 高評価/後で見る・note/Vimeo/SoundCloud。拡張の自動スクロール収穫が本命＋Takeout CSV 等は拡張なしの受け皿。per-site 見立ては IDEAS.md s186 節）
- X 自動翻訳取り込み + 原文切替 (Lightbox 内)
- テーマ案: SF 軍事スタイル (ガンプラ / 戦闘機パネル分け / デカール / 墨入れ質感)
- ギャップスライダー (カード間 gap 無段階) + 背景タイポ
- PiP 内広告
- SNS Share ボタン連携 (X / YouTube)
- ブラウザ完結 AI 自動タグ付け
- **ボード全体音量ロータリーノブ (= IDEAS.md K section、 session 51 user 発案)** — multi-playback vision で同時再生が立ち上がった瞬間に必要になる「ボード上の全カード音量を一括変更するつまみ」。 オーディオミキサー POT 風 + 円弧 LED 列で現在値が光る、 既存 `defaultVolume` global state (= session 51 で立ち上げ済) に直結。 multi-playback sprint と同時 or 直後に着手
- ✅ 複数画像 / 動画ホバー切替 (mediaSlots 実装中、 セッション 17 deploy 済)

---

## 📐 サイズ設計移行 (Phase 2-6 残)

- Phase 1 完了 (セッション 15、 `app/globals.css` :root に `--fs-*` namespace 追加、 参照ゼロ = 見た目変化なし)
- Phase 2-6 は `docs/specs/2026-05-12-sizing-migration-spec.md` 参照
- 全プロジェクト共通思想: `C:\Users\masay\.claude\design-philosophy-sizing.md`

---

## 過去の試行・教訓 (消すな、 同じ轍を避けるため)

### IDB schema bump は不可逆
- 一度 v12 → v13 に上げた IDB は v12 コードで開けない (VersionError)
- rollback は schema bump を含む deploy では事実上不可
- **bump 前にローカル dev で v12 → v13 を実機検証**することが**絶対**必要
- 恒久対策の 3 本柱は `docs/specs/2026-05-12-idb-launch-readiness.md` 参照

### Lightbox `.media` の rect 計測
- FLIP open/close アニメは `.media` の `getBoundingClientRect()` ベース
- `.media` の子に explicit width のない wrapper を置くと intrinsic 依存で rect が崩れる
- `<img>` は intrinsic dim を持つので安定、 `<div>` wrapper は要 explicit width

### 拡張機能 sideload
- `<all_urls>` host_permission を加えたら **再 sideload 必須** (Chrome は既存承認を upgrade しない)
- 検証手順は TODO_COMPLETED.md にアーカイブ済
