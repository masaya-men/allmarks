# N-58 段階2 — スマホのコラージュ編集の操作系（再設計）設計書

> 対象: SHARE のコラージュ編集段（`sharePhase === 'arrange'`）のスマホ（`isMobile` / `<=640px`）操作系。
> 段階1（ARRANGE→CREATE の2手・回転を画像に反映）は実機確認済み。本書はその上に載る**操作モデルの作り直し**。
> 旧計画 `docs/superpowers/plans/2026-07-11-n58-stage2-pinch-zoom-pan.md`（1本指=カード / 2本指=ステージ）は**実行しない**。本書が正本。

## 背景と目的

段階1 の実機フィードバック（2026-07-12・正本）:

1. 常時表示の回転ノブが「出っぱなしで操作しづらい」。
2. スマホの標準操作（Canva 等）にしたい ＝ **カードを1回タップで選択 → その選択カードを「ピンチで拡縮」「二本指で回転」**。四隅リサイズ＋常時ノブはスマホでは廃止。
3. **ボード自体の拡縮ができない** ＝ ステージのズーム/パンも要る（100枚コラージュを実用にする）。

目的: スマホの編集段を「標準的で誤爆の少ないマルチタッチ操作」に作り直す。**表現（回転・自由サイズ）は削らず**、操作の入口だけを標準化する。

## 確定した設計判断（ユーザー承認済み）

- **D1 ピンチの仕分け＝選択で切り替え（selection-gated）**: カード選択中は指をどこに置いても2本指＝そのカードの拡縮＋回転。非選択中（余白タップで解除した状態）のみ2本指＝ボードのズーム/パン。理由: コラージュはカードが大量に重なるので「どのカードか」をタップで先に確定するのが最も誤爆しない。選択枠がモード表示を兼ねる。
- **D2 ボードのズーム/パンは編集専用で、共有画像に一切影響しない**。スマホの撮影は `renderCollageCanvasToJpeg`（canvas 直描画）で **state（`collagePositions`/`collageRotations`/`collageOrder`）＋ `band` から再描画**しており、編集画面の DOM をスクショしない。よって編集面に CSS transform でズーム/パンをかけても撮影結果は不変（＝撮影直前のリセットは不要）。
- **D3 選択枠は白**: カードの角丸・回転に沿う細い白枠（約2px）＋淡い暗い影で、どんな写真の上でも見える無彩表示。ハンドルの点は出さない（四隅リサイズ・常時ノブを廃止するため）。

## 不変条件（崩さない）

- **撮影系は1行も変えない**: `renderCollageCanvasToJpeg`・`mobileCollageBandRect`／band 幾何・`mobileCaptureScale`・2フレーム待ち・パンくず。撮影は state から。編集した位置/サイズ/回転/重なり順はすべて共有画像に反映（z順=`collageOrder`・回転=レンダラー）。
- **デスクトップ（>640px）は1px 不変**: 新 UI は全て `isMobile` の内側。デスクトップは従来どおり（ホバーで出る回転ノブ・四隅リサイズ）。
- z-index は `BOARD_Z_INDEX`（`lib/board/constants.ts`）の定数のみ。ズーム倍率の範囲も定数（`lib/share/stage-zoom.ts` に集約）。
- TypeScript strict / `any` 禁止 / return type 明示 / CSS は `.module.css` / Tailwind・Framer Motion 禁止。
- UI 文言は世界に通じる乾いた英語（i18n キーは足さない＝board chrome は英語リテラル）。
- `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` は必ず try/catch（jsdom・Playwright の合成ポインタが投げる）。

## 操作モデル（状態機械）

編集面上の**アクティブなポインタ数**と**選択状態（`selectedId`）**で分岐する。

| 指 | カードの上 | 余白の上 |
|---|---|---|
| タップ（スロップ内で離す） | そのカードを**選択**（枠が出る・最前面へ `bringToFront`） | **選択解除**（`selectedId = null`） |
| 1本指ドラッグ | 選択して**移動**（`moveElement`）。ズーム中は指移動量 ÷ 倍率で layout px に戻す | ボードを**パン**（`panStageTransform`）。倍率1では動かない＝実質 no-op |
| 2本指 | **選択中** → そのカードを**拡縮＋回転**（`scaleElementFromCenter` ＋ 回転は base+Δ角）。カード**中心が軸** | **非選択中** → ボードの**ズーム＋パン**（`pinchStageTransform`・1〜6倍） |

- カード選択中に2本目の指が下りたら、進行中の1本指カード操作は**その場の状態で中断**（巻き戻さない）してピンチに入る（`CollageGestureArbiter`）。
- ピンチを離した後もカードのサイズ/角・ボードのズームは**維持**。IDENTITY に戻すのは段の出入りのみ（下記 D2 のとおり撮影では戻さなくてよいが、段の再入場を綺麗にするため enter/exit で戻す）。
- 2本指の**拡縮と回転は同時**に効く（distance 比＝倍率、angle 差＝回転角）。移動は1本指が担うので2本指の平行移動は取らない（中心軸固定＝予測しやすい）。

## 選択枠 UI（D3）

- 選択カードの `.element`（回転済み）の**内側にオーバーレイ**を敷く＝角丸（`--card-radius`）と回転に自動追従。
- 白 2px 実線 ＋ 外側に淡い暗い影（`box-shadow 0 0 0 1px rgba(0,0,0,.35)` 程度）でどの写真にも視認可。`pointer-events: none`・`data-no-capture`。
- ハンドルの点・ノブは無し（拡縮/回転は2本指）。

## 廃止 / 維持

| | スマホ（`isMobile`） | デスクトップ（>640px） |
|---|---|---|
| 常時回転ノブ | **廃止**（レンダリングしない） | 維持（ホバーで出る） |
| 四隅リサイズ | **廃止**（レンダリングしない） | 維持 |
| 回転 | **維持**（2本指へ移設） | 維持（ノブ） |
| 拡縮 | 2本指ピンチ | 四隅ドラッグ |
| 選択枠 | あり（白） | なし（従来どおりホバー affordance） |

## アーキテクチャ（境界と流用）

### 新規

- **`lib/share/stage-zoom.ts`（純関数・ボードズーム/パンの数学）**
  - `type StageTransform = { scale; tx; ty }` / `type StagePoint = { x; y }`
  - `IDENTITY_STAGE_TRANSFORM` / `STAGE_ZOOM_MIN = 1` / `STAGE_ZOOM_MAX = 6`
  - `clampStageTransform(t, vw, vh)`: scale を [1, MAX]、tx/ty を「拡大ステージが常に画面を覆う」範囲（`vw*(1-scale) <= tx <= 0`）へ。
  - `pinchStageTransform(base, startA, startB, currA, currB, vw, vh)`: ピンチ開始基準の**絶対計算**（誤差が溜まらない）。中点の下のコンテンツ点が中点の下に留まるよう scale+translate を同時に解く → `clampStageTransform`。
  - `panStageTransform(base, dx, dy, vw, vh)`: 1本指パン（`tx+dx, ty+dy` を clamp）。
  - `type CollageGestureArbiter = { register; clear; cancelActive }` / `createCollageGestureArbiter()`: 進行中の1本指カード操作を、2本目の指着地で1回だけ中断する調停役。
- **`components/board/MobileArrangeGestures.tsx`（＋ `.module.css`）— 多点タッチ担当ラッパー**
  - `enabled=false`（デスクトップ）は wrapper DOM を足さず `<>{children}</>`（バイト同一）。
  - 覗き窓（`touch-action:none`・`overflow:hidden`・z=`SHARE_CANVAS`）＋ 内側 transform 層（`transform-origin:0 0`・inline transform）。子（`CollageCanvas`＋`MobileBandOverlay`）を包む。
  - capture 相でポインタを数える。**1本指はカードへ素通し**（stopPropagation しない）＝ カード上なら `CollageCanvas` の既存 drag、余白なら覗き窓自身が pan/tap-deselect を処理。**2本目の指は capture 相で握り**（stopPropagation ＝ 2つ目のカード操作を始めさせない）、`selectedId` の有無で分岐:
    - 選択中: `onSelectedPinchStart()`（→ arbiter.cancelActive & BoardRoot が base をスナップショット）→ 毎フレーム `onSelectedPinch({ factor, deltaDeg })`。
    - 非選択: `onStageTransformChange(pinchStageTransform(...))`。
  - Props: `enabled` / `stageTransform` / `onStageTransformChange` / `selectedId` / `onSelectedPinchStart` / `onSelectedPinch` / `onDeselect` / `children`。
  - `MobileArrangeBar`・result scrim・`MobileShareResult` は **wrapper の外**（`position:fixed` が transform の containing block に捕まらない）。

### 変更

- **`lib/share/collage-layout.ts`（純関数を1つ追加）**
  - `scaleElementFromCenter(positions, id, factor, maxCardWidth): CollagePositions`: **base 矩形の中心を固定**して w,h を factor 倍（w を `[COLLAGE_MIN_WIDTH_PX, maxCardWidth]` にクランプ、h はアスペクト維持で追従、中心一定になるよう x,y 再計算）。呼び出し側は「ピンチ開始時の base positions」を渡す＝絶対計算で誤差ゼロ。
- **`components/board/CollageCanvas.tsx`**
  - `pointerScale?: number`（省略1）: 移動の指差分を `/scale` で layout px に戻す。
  - `selectedId?: string | null` ＋ `onSelect?(id)`: カード pointerdown（grab）で選択にする。選択カードに**白い選択枠**オーバーレイを描く。
  - `touchMode?: boolean`（＝`isMobile`）: true で**回転ノブと四隅 ResizeHandle をレンダリングしない**（拡縮/回転は2本指へ）。false（デスクトップ）は現状不変。
  - `gestureArbiter?: CollageGestureArbiter`: 1本指ドラッグ開始時に自分の後始末を register（2本目の指で中断される）。
  - **デスクトップ非回帰**: BoardRoot は `selectedId`/`onSelect`/`touchMode`/`pointerScale`/`gestureArbiter` を**モバイルのみ**渡す（デスクトップは全て省略＝これらの追加 prop が undefined ＝ DOM・挙動ともバイト同一）。
- **`components/board/BoardRoot.tsx`**
  - state: `selectedCollageId: string | null` / `stageTransform: StageTransform` / `collageArbiter`（1個維持）/ ピンチ base の ref（`{ rect, rotation }`）。
  - `arrange` ブロックの `CollageCanvas`＋`MobileBandOverlay` を `MobileArrangeGestures` で包む（`enabled={isMobile}`）。`CollageCanvas` に `pointerScale`/`selectedId`/`onSelect`/`touchMode`/`gestureArbiter` を配線。
  - `onSelectedPinchStart`: `collageArbiter.cancelActive()` ＋ `selectedCollageId` の現 rect/rotation を ref にスナップ。`onSelectedPinch({factor,deltaDeg})`: `setCollagePositions(p => scaleElementFromCenter(baseRef, id, factor, maxCardWidth))` ＋ `setCollageRotations(r => ({...r, [id]: baseRot + deltaDeg}))`。
  - リセット（enter/exit で `selectedCollageId=null`・`stageTransform=IDENTITY`）: `handleMobileEnterArrange` / `handleExitShareMode` / `handleShareReselect`。**撮影ハンドラ `handleMobileCaptureAndCreate` は変更しない**（D2）。
- **`components/board/MobileArrangeBar.tsx`**: ヒント文言を新操作に更新（乾いた英語）。例: `TAP A CARD TO SELECT — PINCH TO RESIZE OR ROTATE — TWO FINGERS ON EMPTY SPACE ZOOMS THE BOARD`。
- **`components/board/CollageCanvas.module.css`**: `.selectionFrame` を追加。`@media (hover:none)` の常時ノブ表示は不要になる（スマホでノブ自体を描かない）ので整理。

## 数学メモ（実装者向け・確認済みの事実）

- 現行 `handleElementPointerDown`（`CollageCanvas.tsx` L124-126）は移動を screen px 1:1 加算。ズーム対応は `/pointerScale` を挟むだけ（等倍は `/1` で従来完全一致）。
- 2本指カード変形は**開始スナップショット基準の絶対計算**: 開始2指距離 `d0`・現距離 `d1` → `factor=d1/d0`（`d0<=0` は 1）。開始角 `a0`・現角 `a1`（`atan2`）→ `deltaDeg=a1-a0`。base rect/rotation は BoardRoot が `onSelectedPinchStart` で ref に固定。
- 回転はスケール不変（一様スケール下で角度保存）＝ 既存 `collage-rotate` の角度計算はそのまま通用。
- カード中心軸スケール: 中心 `cx=x+w/2, cy=y+h/2` 固定、`w'=clamp(w0*factor)`、`h'=w'/aspect`、`x'=cx-w'/2, y'=cy-h'/2`。

## テスト戦略

- **単体（vitest + jsdom）**
  - `lib/share/stage-zoom.test.ts`: clamp（scale/translate 範囲）、pinch（開いて拡大・平行移動でパン・下限クランプ・退化距離）、pan、arbiter（cancelActive 1回・clear で不発）。
  - `lib/share/collage-layout.test.ts`（既存に追記）: `scaleElementFromCenter`（中心保存・下限/上限クランプ・アスペクト維持）。
  - `components/board/MobileArrangeGestures.test.tsx`: disabled=素通し（wrapper 無し）／選択中の2本指→`onSelectedPinch`（factor 検証）＋`onSelectedPinchStart` 1回／非選択の2本指→`onStageTransformChange`（scale 検証）／1本指は素通し（ズーム・pinch 発火せず）／片指離脱で終了／余白タップで `onDeselect`。
  - `components/board/CollageCanvas.test.tsx`（既存に追記）: `pointerScale=2` で移動が半分の layout px／`onSelect` が grab で発火／`touchMode` でノブ・四隅が DOM に出ない／選択カードに枠が出る。
- **e2e（Playwright・合成 PointerEvent を dispatch）** `tests/e2e/mobile-share.spec.ts`:
  - カードをタップ→選択枠が出る。
  - 選択中に2本指ピンチ→そのカードの `transform` 幅（rect）が拡大。
  - 余白タップで解除→2本指ピンチ→`mobile-arrange-stage` の `transform` scale が拡大。
  - ズームしても CREATE で出来る**画像は同一**（撮影は state 由来＝ズーム無影響）／100枚でも成立。
  - 実タッチの感触（慣性・追従）は**実機のみ**（恒久ルール）。

## 併せて取り込む（s190 opus レビューの deferred minor・非ブロッカー・実装計画側で拾う）

1. 撮影中の BACK で孤児 /s ができる → `creating` 中 BACK を disable。
2. `MobileBandOverlay` の NaN 帯ガードを `!(band.width > 0) || !(band.height > 0)` に。
3. 回転テストを `mock.invocationCallOrder` で translate→rotate→translate 順に。
4. `BoardRoot` の canvasCards 構築（`collageOrder`）に「盤面順でなく重なり順を焼く」1行コメント。

## スコープ外（別タスク・本書では扱わない）

- `/s` **ページ**の再構成が盤面順（`buildArrangeShare`＝`selectedInBoardOrder`）である件（**画像**は編集どおり）。/s ページにも編集配置を載せるかは**ユーザー判断**＝載せるなら payload に配置データを足す別タスク（本書の操作系再設計とは独立）。
- タブレット（>640px・デスクトップ経路）向けのタッチ最適化。
- ダブルタップでのズームリセット等の飾り（YAGNI・実機の要望が出てから）。
