# PC盤面＋共有の磨き 4点 設計書（①テキストカードのフェード ②共有受け取り画面 ③SHARE作成中インジケーター ④TUNEマージン一致スナップ）

- **日付**: 2026-07-09（セッション183 後半）
- **状態**: 設計確定・実装前
- **背景**: 束B（スマホ保存）実機OK後にユーザーが挙げた5件のうち、①②③④を対象（⑤Pinterest=N-28 は来週）。TODO.md の N-42/N-43/N-44/N-27 に対応。
- **前提事実は s183 で subagent 並行調査・実コードで裏取り済**（行番号はズレ得る）。

---

## スコープ

### やること（この設計書）
- **① PC のテキストカードのスクロールバー廃止 → 両端フェード**（N-42）
- **② 共有リンク受け取り画面の乱れ修正**（N-43）＝スマホ1列＋PC古メーター
- **③ SHARE の「作成中」インジケーターが撮影中に消える → 撮影外に常時表示**（N-44）
- **④ TUNE の W/G スナップを「左右マージン一致（今の列数のまま）」に作り直し＋範囲UI**（N-27）

### やらないこと
- **⑤ Pinterest 拡張連動**（N-28・来週・拡張再審査束ね）。
- ④で**中央寄せはしない**（ユーザー明確に却下＝左詰め維持）。
- スマホの盤面レイアウト変更（②は受け取り側に既存モバイル設定を移植するだけ）。

---

## ① PC テキストカードのスクロールバー → 両端フェード（N-42）

### 現状（事実）
- スクロール要素は `.titleScroll`（[components/board/cards/PlaceholderCard.tsx:213-220](../../../components/board/cards/PlaceholderCard.tsx#L213)・`data-overflow`/`data-at-bottom`/`data-card-scroll`）。
- [PlaceholderCard.module.css:82-111](../../../components/board/cards/PlaceholderCard.module.css#L82)＝`.titleScroll { overflow-y:auto }`＋thin スクロールバー（hover で薄く見える）。**下端のみ**フェード（`.titleScroll[data-overflow='true'][data-at-bottom='false']`, module.css:116-127）。**上端フェードは無い**（状態は `hasOverflow`/`atBottom` のみ・`atTop` 無し、PlaceholderCard.tsx:119-132）。
- モバイルは globals.css:72-80 で `overflow:hidden` 化済＝**この native スクロールバーはデスクトップ専用**（CardsLayer.tsx:1304 `data-lock-card-scroll` が isMobile 時のみ）。
- **ライトボックスの大文字カードも同 `PlaceholderCard` を使い、モバイルロックの外**（globals.css:65-69）＝この修正はライトボックスの文字カードにも効く。

### 既存プリオール（そのまま流用）
FILTER のタグ一覧が**まさに要望どおりの実装を出荷済**：
- 純関数 `computeTagScrollEdge({scrollHeight, scrollTop, clientHeight, maxHeight}): 'none'|'top'|'middle'|'bottom'`（[lib/board/tag-scroll-edge.ts:35-41](../../../lib/board/tag-scroll-edge.ts#L35)・単体テスト有）。
- 配線 [FilterPill.tsx:119-133](../../../components/board/FilterPill.tsx#L119)（scroll/resize で edge 更新）＋ `data-scroll-edge` 属性（:420）。
- [FilterPill.module.css:220-246](../../../components/board/FilterPill.module.css#L220)＝**スクロールバー完全非表示**（`scrollbar-width:none` + `::-webkit-scrollbar{width:0;display:none}`）＋`data-scroll-edge` で3つの mask-image（middle=両端／top=下だけ／bottom=上だけ）。

### 設計
`.titleScroll` を FilterPill パターンに合わせる：
1. `PlaceholderCard.tsx` のスクロール状態を「4状態 edge（none/top/middle/bottom）」に拡張。既存の `computeTagScrollEdge`（純関数）を流用可。onScroll/resize で更新。**固定 max-height ベースで判定**（FilterPill と同じ・アニメ由来の誤検知回避）。
2. `.titleScroll` に `data-scroll-edge` を付与（既存の `data-overflow`/`data-at-bottom` は撤去 or 併存整理）。
3. `PlaceholderCard.module.css` の `.titleScroll`：**スクロールバーを完全非表示**（現 thin/hover を撤廃）＋`data-scroll-edge` で middle=両端／top=下だけ／bottom=上だけ の mask-image。
4. paper-note バリアント（`.paperNoteScroll`, PlaceholderCard.tsx:168-195）は同 `.titleScroll` クラス＋属性を使うので自動追従。

### 注意
- `mask-image` は**スクロール要素自身**に当たる（クリック要素ではない）＝`reference_mask_image_pointer_events` のヒット縮小バグは非該当（既存の下端フェードが実証済）。ただし**フェード帯の上で wheel/スクロールが効くか**は Chromium 実機で1度確認（既存下端フェードで実質OKのはずだが未命名テスト）。
- **規模：小**。

---

## ② 共有リンク受け取り画面の乱れ（N-43）

### 現状（事実 — 再発明ではない）
受け取り画面 `SharedBoard`（[components/share/SharedBoard.tsx](../../../components/share/SharedBoard.tsx)）は**本物のボードと同じ部品を既に再利用**：`CardsLayer`（SharedBoard.tsx:27-29）／`ScrollMeter`（:557-576）／`computeSkylineLayout`（:264-274）。乱れは**2つの“移植し忘れ”**だけ。

### 原因と設計

**(a) スマホで1列**
- 本物のボードは isMobile 時にカード幅を上書き（[BoardRoot.tsx:1074-1083](../../../components/board/BoardRoot.tsx#L1074)：`MOBILE_LAYOUT.COLUMNS=3`・`mobileCardWidth`・`customWidths` を捨てる）。`SharedBoard` には `useIsMobile`/`MOBILE_LAYOUT` が**無く**、送信者の生カード幅（~268〜600px）を常に渡す→狭画面で1枚/行。
- **設計**: `SharedBoard` に `useIsMobile()`＋`MOBILE_LAYOUT` 由来の width/gap/customWidths を導出し、**spacer 用 skyline（:264-274）と `CardsLayer` props（:512-537）の両方**に流す（BoardRoot と同じ導出をミラー）。

**(b) PC メーターが古い配置**
- 部品 `ScrollMeter` は最新だが、`SharedBoard.tsx:551-576` が**s170 以前の position**（`absolute; bottom:24px; left:50%; translateX(-50%)`・canvas 内）を手書き。今の本物は `.frameBottomChrome`（枠下帯・canvas 外、[BoardRoot.tsx:2884-2896](../../../components/board/BoardRoot.tsx#L2884)）。
- **設計**: メーターのラッパを `frame.frameBottomChrome`（`SharedBoard.tsx:40` で既に同 CSS module を import 済）に置き換え、canvas の**外**の兄弟にする。`--canvas-margin` はグローバル CSS 変数（globals.css）なので受け取り側でも有効。narrow 幅での表示可否は本物に合わせる（本物は `!isMobile` 時のみ表示）。

### 注意（要実機）
- `CardsLayer` の onPointerDown は `isMobile` を `receiverMode` より**先に**判定（[CardsLayer.tsx:1311-1317](../../../components/board/CardsLayer.tsx#L1311)）＝受け取り側で isMobile=true にすると受け取り専用タップ（`handleReceiverPointerDown`）が飛ばされ、汎用 `handleMobileCardClick` を通る。**両者とも同じ `onClick(id, rect)` を呼ぶのでライトボックスは開く見込みだが、`receiverMode`+`isMobile` の組合せは本物では起きない未検証の組**＝**実機（390×844）で開閉と縦スクロールを必ず確認**（`reference_native_scroll_touch_action_playwright`＝合成イベントでは判定不可）。受け取り側の他の receiverMode 分岐（角×・タグpill 等）も isMobile 先行の影響を実装時に一通り確認。
- **規模：小〜中**。

---

## ③ SHARE「作成中」インジケーターが撮影中に消える（N-44）

### 現状（事実 — 原因特定）
- `ShareToast`（[components/board/ShareToast.tsx](../../../components/board/ShareToast.tsx)）は `createState: 'idle'|'creating'|'error'`＋`shareUrl` 駆動。**唯一の進捗表示＝ボタン文言「CREATING…」（disabled）**（ShareToast.tsx:54,82-88）。スピナー等は無い。
- `handleCreateHostedShare`（[BoardRoot.tsx:2404-2437](../../../components/board/BoardRoot.tsx#L2404)）＝`setShareCreateState('creating')` → `setCapturing(true)` → `captureCollageShareImage`（dom-to-image・全 `<img>` を `/api/img` 経由で取得＝**100枚で画像100取得＝数秒〜十数秒**、20s タイムアウト有） → `createHostedShare`（R2 アップロード） → 完了。
- **根因**: `ShareToast` は `[data-no-capture]` の中（BoardRoot.tsx:3490-3502）、それは撮影対象 `.outerFrame` の中。`.outerFrame[data-capturing] [data-no-capture] { visibility:hidden }`（[BoardRoot.module.css:20-25](../../../components/board/BoardRoot.module.css#L20)）＝**撮影中は進捗表示ごと非表示**。100枚ほど長く消える＝「何も起きない・スクショ撮れと言われてる?」。
- 旧手動スクショ文言は**未使用**（`screenshot-hint.ts`／`ShareToast.module.css` の `.snipBtn` 等は孤児・原因ではない）。

### 設計
- 「Creating your link…」進捗表示を **`document.body` への React portal**（撮影対象 `boardFrameRef` の subtree の**外**）で出す。`shareCreateState === 'creating'` で表示、完了/エラーで消す。portal なので dom-to-image のクローン walk に**写り込まない**＋`data-capturing` の非表示 CSS にも掛からない＝**撮影・アップロード両フェーズを通してずっと見える**。
- 見た目は既存の緑ドット等（ShareToast.module.css の視覚言語）を流用。撮影対象の外なので `[data-no-capture]` 不要。
- **規模：小**（新規小 JSX＋CSS。capture パイプライン・`data-capturing`/`[data-no-capture]` は無改造）。

---

## ④ TUNE の W/G スナップ＝「左右マージン一致（今の列数のまま）」＋範囲UI（N-27）

### 現状（事実）
- `fill-snap.ts`（[lib/board/fill-snap.ts:57-108](../../../lib/board/fill-snap.ts#L57)）＝`fillCandidates(other, containerWidth, axis, min, max)` が「N×幅+(N−1)×gap=containerWidth」を**全 N** 列挙、`snapToFill` が離した値を**しきい値10**内で最近傍候補に吸着。
- 配線: W/G 両フェーダーが `containerWidth`＋相手値を受け（[TuneTrigger.tsx:496-516](../../../components/board/TuneTrigger.tsx#L496)）、`FaderColumn` が緑マーク描画（[FaderColumn.tsx:88-92](../../../components/board/FaderColumn.tsx#L88), CSS `.fillMark` :72-81）、離した時 `snapToFill`（[FaderColumn.tsx:191-206](../../../components/board/FaderColumn.tsx#L191)・`!shiftKey` gated）。
- `containerWidth = effectiveLayoutWidth = viewport.w − 2×SIDE_PADDING_PX`（[BoardRoot.tsx:1066](../../../components/board/BoardRoot.tsx#L1066)、`SIDE_PADDING_PX=9`）。カードは左端 `horizontalOffset = SIDE_PADDING_PX = 9`（BoardRoot.tsx:1110）から**左詰め**。
- **幾何**: カード合計幅 == effectiveLayoutWidth（余りゼロ）の時、左マージン＝右マージン＝9px で**等しくなる**。余りがあると右に溜まり左<右。
- **問題（実機で判明）**: `snapToFill` が**全 N から最近傍**を選ぶため、5列狙いで離すと隣の「4列でぴったり」候補に飛び**列数が矯正される**。ユーザーは「5列のまま左右を揃えたい」。

### 設計（ユーザー確定）
- **左詰めは維持（中央寄せしない）。**
- **スナップ対象を「今の列数の候補だけ」に限定**：離した時点の値から**現在の列数 N**を算出（`N = floor((containerWidth + gap) / (width + gap))`）→ その N の even-fill 値（幅なら `(containerWidth − (N−1)·gap)/N`、gap なら `(containerWidth − N·width)/(N−1)`）にだけ吸着。**N は絶対に変えない**（5列→4列にしない）。この値＝左マージン＝右マージン＝9px。
- **範囲UI**: フェーダーの値が現在Nの候補の吸着範囲に入ったら、**緑マークを光らせる/太くする**（近づくほど強調）＋ぴったりで吸着。「今、左右が揃う」が目で分かる。マークは（全候補でなく）**今の列数の候補**を主に見せる。
- **Shift（精密）中は従来どおり吸着オフ**は維持（微調整優先）。しきい値は画面px基準で気持ちよく（実装で調整・視認と誤爆のバランス）。

### 実装の勘所
- `fill-snap.ts` に「現在の列数を求める」＋「その N の候補だけ返す/スナップする」関数を追加（純関数・単体テスト）。既存 `fillCandidates`/`snapToFill`（全N）は SHARE 等で使っていないか確認の上、TUNE 経路を新ロジックに差し替え。
- `FaderColumn.tsx` は「現在Nの候補マーク＋範囲内ハイライト」を描画。`containerWidth`/相手値は既に流れているので追加配線は最小。
- **デスクトップ専用**（モバイルに TUNE 無し）。
- **規模：小〜中**。

---

## テスト（全体）
- `rtk tsc` / `rtk vitest run` / `pnpm build`。
- 単体（vitest）: ④の新純関数（現在列数の算出・N固定スナップ・範囲判定）、①の edge 判定（`computeTagScrollEdge` 流用なら既存テストで担保＋PlaceholderCard 配線）。
- Playwright: ①テキストカードのフェード（両端・端で解ける）、③CREATE 中に portal 進捗が見える（撮影中も）、②受け取り画面（PC メーター位置・スマホ列数）。④のフェーダー吸着は `setPointerCapture` で Playwright 駆動不可＝純関数＋fireEvent 単体で担保（memory `reference_board_card_click_pointer_capture`）。
- **実機/目視のみ**: ②スマホ受け取りのタップ開閉＋縦スクロール（`receiverMode`+`isMobile` の未検証組）、④の吸着の気持ちよさ・範囲UIの見え、①フェード帯上のスクロール反応。
- デスクトップ 1489×679 回帰（①③④はデスクトップ変更＝盤面本体の他要素に回帰が無いこと）。

## 非対象・deferred
- ⑤ Pinterest（N-28・来週）。
- ③の孤児コード（`screenshot-hint.ts`・`ShareToast.module.css` の旧クラス）の掃除は任意（原因ではない）。別途でも可。

## ファイル一覧（見込み）
**①**: `components/board/cards/PlaceholderCard.tsx` / `.module.css`（＋`lib/board/tag-scroll-edge.ts` 流用）
**②**: `components/share/SharedBoard.tsx`（`useIsMobile`/`MOBILE_LAYOUT` 導出＋メーターを `frameBottomChrome` へ）
**③**: `components/board/BoardRoot.tsx`（portal 進捗）／新規小コンポーネント `components/board/ShareCreatingIndicator.tsx`＋`.module.css`（or ShareToast に portal 分岐）
**④**: `lib/board/fill-snap.ts`（現在列数スナップ関数＋テスト）／`components/board/FaderColumn.tsx`（現在N候補マーク＋範囲ハイライト）／必要に応じ `TuneTrigger.tsx`
