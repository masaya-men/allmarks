# N-58 スマホ ARRANGE のボードズーム・スライダー 設計書

> 対象: スマホ（`isMobile`）の SHARE コラージュ編集段（`sharePhase === 'arrange'`）。
> N-58 段階2（tap-select + 2本指でカード拡縮回転 + 2本指ボードズーム）に続く小さな追補。
> 段階2 spec: `docs/superpowers/specs/2026-07-12-n58-stage2-mobile-gesture-model-design.md`。

## 背景（実機で判明した穴）

段階2 は selection-gated（カード選択中は2本指=カード／非選択で2本指=ボードズーム）。実機で**100枚選ぶと帯がカードで埋まり、選択解除に必要な「余白タップ」ができない → ボードズームに入れない**ことが判明（ユーザー報告 2026-07-12）。根因は「ボードズーム＝非選択状態が前提」なのに、埋まった盤面では非選択状態に**到達できない**こと。

## 確定した設計判断（ユーザー承認済み）

- **D1 見えるズーム操作を足す（方針A）**: 画面下部（ARRANGE バーの最上段）に**ズーム・スライダー**を常設。**選択状態と無関係にいつでも効く**＝解除不要。
- **D2 拡大は「選択中のカードを中心に」**（何も選んでいなければ画面中心）。選びたい一枚が真ん中で大きくなり、パンがほぼ要らない。別カードを触りたければタップ（選択が移る）→そこへ寄れる。
- **D3 既存の2本指ボードズームは残す**（保険）。スライダーは現在のズーム率を映す＝両者は同じ `stageTransform` を読み書きし常に一致。
- **D4 見た目はミニマルなモノトーン＋ガラス**: 細いトラック＋丸いつまみ（タッチ ≥32px 相当）、端に小さな虫めがねグリフ、**数字は出さない**。ARRANGE バーと同じガラス面に載せて一体化。

## 不変条件（崩さない）

- **ボードのズームは編集専用で共有画像に一切影響しない**（撮影は state 由来の `renderCollageCanvasToJpeg`）。スライダーは `stageTransform`（CSS transform）だけを触り、`collagePositions`/`collageRotations`/`band` を変えない。段の出入りで IDENTITY 復帰＝スライダーは自動で 1× に戻る（既存挙動を流用）。
- **デスクトップ（>640px）は不変**: スライダーは `isMobile` の ARRANGE バー内のみ。
- z-index は `BOARD_Z_INDEX` の定数のみ。TS strict / `any` 禁止 / return type 明示 / CSS は `.module.css` / Tailwind・Framer Motion 禁止。
- `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` は try/catch。
- ズーム率の範囲は既存 `STAGE_ZOOM_MIN`(1)〜`STAGE_ZOOM_MAX`(6)（`lib/share/stage-zoom.ts`）をそのまま使う。感触調整はこの定数1箇所。

## 挙動

- スライダーのつまみ位置 ↔ `stageTransform.scale` を**線形**対応（0→1×、1→6×）。
- つまみをドラッグ／トラックをタップ → `onScaleChange(nextScale)` → BoardRoot が**軸（pivot）を決めて** `zoomStageToScale` で適用し `setStageTransform`。
  - pivot＝**選択カードの中心の画面座標**（`collagePositions[selectedId]` の中心を現在の transform で screen に写像）／選択なしなら**画面中心**（`vw/2, vh/2`）。
- 既存の2本指ボードズーム（非選択時）はそのまま。スライダーは `scale` を props で受ける controlled＝2本指で拡大するとつまみも動く。
- 1× に戻す＝つまみを左端へ（clamp が原点に戻す）。

## アーキテクチャ（既存流用）

### 新規
- **`lib/share/stage-zoom.ts` に純関数を1つ追加**: `zoomStageToScale(current, nextScale, pivot, viewportW, viewportH): StageTransform`。指定 pivot（screen 座標）の下のコンテンツ点を画面上の同じ位置に保ったままスケールだけ変える（＝pivot 中心ズーム）。中身は `pinchStageTransform` の「点固定ズーム」を1点で行う版。`clampStageTransform` を再利用。
- **`components/board/MobileZoomSlider.tsx`（＋ `.module.css`）**: `{ scale, onScaleChange }` を受ける controlled スライダー。位置指定を持たない（ARRANGE バーの縦積みの中に載る flex 行）。トラックへ pointer で `scale` を通知（`setPointerCapture` は try/catch）。`data-no-capture`。testid `mobile-zoom-slider` / `mobile-zoom-slider-track` / `mobile-zoom-slider-thumb`。

### 変更
- **`components/board/MobileArrangeBar.tsx`**: 任意 prop `zoom?: { scale: number; onScaleChange: (n: number) => void }` を追加。与えられたら `.bar` の**最上段**に `<MobileZoomSlider>` を描く（省略時は現状不変＝既存テスト緑）。ヒント文言を「TWO FINGERS ZOOM」から「SLIDER ZOOMS THE BOARD」中心に更新。
- **`components/board/BoardRoot.tsx`**: `handleZoomSliderChange(nextScale)`＝pivot（選択カード中心 or 画面中心）を求め `zoomStageToScale` を関数型 setState で適用（`setStageTransform((prev) => …)`＝stale closure 回避）。`vw/vh` は `boardFrameRef` の rect。arrange の `MobileArrangeBar` に `zoom={{ scale: stageTransform.scale, onScaleChange: handleZoomSliderChange }}` を渡す（`isMobile` の内側なので既に mobile 限定）。**撮影・リセット・段階2 の配線は変更しない**。

## テスト戦略

- 単体: `zoomStageToScale`（pivot 固定＝pivot 下のコンテンツ点が画面上で動かない・画面中心ズーム・scale クランプ [1,6]・1× で原点）。`MobileZoomSlider`（scale→つまみ位置・トラック pointer で onScaleChange・range 端クランプ）。`MobileArrangeBar`（zoom 省略で従来通り／zoom 有りでスライダー描画）。
- e2e（Playwright）: ARRANGE で**カードを1枚選択した状態でも**スライダー操作でボードが拡大する（`mobile-arrange-stage` の scale が 1→>1）＝**選択解除なしでズームできる**という今回の穴の回帰テスト。

## スコープ外
- パン専用 UI（拡大が選択カード中心なので当面不要・要望が出たら）。対数スケール（当面は線形）。デスクトップのタッチ最適化。
