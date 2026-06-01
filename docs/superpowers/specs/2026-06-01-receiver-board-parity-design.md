# 受け取り画面 = ボード完全一致 設計 (session 98)

> 目的: 共有受け取り画面 `/s/<id>`（`SharedBoard`）を、本物のボードと**見た目・操作・アニメーションまで同一**にする。受け取り専用の発明物を減らし、ボードの本物の chrome 部品をそのまま流用する。受け取りであることは「一部ボタンの取り消し線」と背景タイポ「SHARED WITH YOU」だけで示す。

最終更新: 2026-06-01 / 対象ブランチ: `feat/receiver-moodboard`

---

## 背景・現状（なぜやるか）

`SharedBoard` は本物のボードの **CardsLayer / Lightbox / ScrollMeter / 枠 CSS** を流用しているが、上部 chrome は独自の簡易物（左上 SAVE カウンター＋カード上の緑 SAVE 選択）だった。ユーザー要望は「分かりやすくボードとまったく同じ見た目」。よって上部を**本物のボード chrome に作り直す**。

本物ボードの chrome 構成（流用元）:
- 外側上帯（BoardRoot 内）: `MotionToggle`(MOTION) ＋ `FilterPill`(フィルター＋読み出し)
- `TopHeader` の actions 行（キャンバス右上）: `ChromeLedToggle`(TITLE) / `TuneTrigger`(TUNE) / `TagButton`(MANAGE TAGS) / `ChromeButton`(POP OUT) / `ChromeButton`(SHARE)

ボードの並び順仕様: **orderIndex 降順＝新しいものが上**。新規保存は `nextOrderIndex`（既存最大+1）。

---

## 決定事項（確定仕様）

### 1. 本物の chrome 部品を流用（見た目を真似るのではない）
`SharedBoard` が上記コンポーネントを**そのまま描画**する。トンマナ・インタラクション・アニメは部品由来でボードと完全一致。低リスク方針として `BoardRoot` 自体の改造はしない（巨大かつ IDB 結合のため）。`SharedBoard` 側でこれらを組み立てる。

### 2. 新「IMPORT」ボタン
- 配置: 外側上帯の **MOTION の左**（帯の並びは `[IMPORT] [MOTION] [FILTER(取消線)]`）。
- 文言: **`IMPORT N TO YOUR BOARD`**（N＝今表示中のカード枚数。× で減る）。ネイティブに自然な英語。
- 見た目/挙動: 周囲の chrome ボタン（`ChromeButton`）とトンマナ・アニメ完全一致。
- 動作: **今見えているカード全部**を取り込む（選択概念は廃止。下記5）。
- N=0（全部 × した）時は無効表示。

### 3. 取り消し線＋無効化するコントロール（＝受け取りの証）
**フィルター（FilterPill）・POP OUT・MANAGE TAGS** の3つ。見える状態のまま `line-through` ＋ `pointer-events:none` ＋減光。共通ラッパ（例 `BlockedChrome`）で包む。

### 4. そのまま有効なコントロール
**TITLE・TUNE・MOTION・SHARE**。
- **TITLE**: 背景タイポ「SHARED WITH YOU」の表示切替（無害・世界観そのまま）。
- **TUNE**: 幅/間隔をボードと完全同一に変更可。選別しやすく小さく並べる用途。**TUNE を触った時点で送り主の正確な配置からは離れてよい**（初回に送り主の表現は見えている前提）。
  - 実装条件: 共有データに送り主の**基準カード幅 `w`** を追加（既に `gap` は追加済）。受け取りはボード状態を完全再現する: `cardWidthPx = w`, `cardGapPx = gap`, `customWidths = { 各 url: cw（cw≠w のカードのみ）}`。これでボードと同じく TUNE-幅は「個別リサイズされていないカード」に効く。
- **MOTION**: アニメ切替（無害）。
- **SHARE**: **今見えているカード**で新しい共有を作る（数枚 × して再共有）。本物の `SenderShareModal` ＋ `buildShareDataFromBoard` ＋ 共有作成 API を流用。受け取りの可視カードを `BoardItemForShare` にマップして渡す。

### 5. 取捨選択モデル ＝ × 削除一本（緑 SAVE 廃止）
- 各カードに **×**（ボードの `CardCornerActions` を受け取りモードでも描画）。押すと**画面上の除外セット**に入り、その場で消えてマソンリーが詰め直る。**IDB は触らない**（受け取りカードは画面上の配列のみ）。
- 戻したい時は共有 URL を再読み込み（元データは不変）。
- **緑の per-card SAVE フェード（saveFade/saveLabel）と per-card 送り主タグ選択 UI は削除**。
- **タグは取り込まない（決定: 案A、2026-06-01 調査ふまえ）**。IMPORT はブックマーク本体（url/title/description/thumbnail/type）のみを保存し、`tags: []`。`convertSenderTagsForReceiver` 等のタグ変換ロジックは取り込み経路から撤去。理由は `docs/private/2026-06-01-tag-import-research.md`（他人の集めた物を取り込む場面ではタグ非継承が主流／名前空間を汚さない／最もシンプル）。受け取り後はユーザーが自分の体系で `MANAGE TAGS` から付け直す。
- **送り主タグの表示**: カード上に **読み取り専用ラベル**として表示は残す（ボードの TagIndicatorStrip と同じ見た目。送り主の整理＝表現の一部を見せるため）。トグル無し・フィルター連動無し・取り込み無しの純粋な情報表示。
- IMPORT＝可視カード全取り込み、SHARE＝可視カードで再共有。除外は × 一本に統一。

### 6. 取り込み中インジケーター（出現・最中・消滅すべてアニメ）
- **出現**: ボード全体を暗転（Lightbox と同じ backdrop フェード ~200ms）。全 chrome をロック（操作不可）。
- **最中**: 中央に `IMPORTING`（枚数カウントは出さない）＋**動作中ビジュアル**。ビジュアルは**テーマ駆動**:
  - デフォルトテーマ＝音波モチーフ（ScrollMeter と同じ波形）を動かす SVG。
  - 将来テーマ追加時は、そのテーマ固有の「動作中」表現へ自動的に切り替わる設計（テーマ id → 動作中ビジュアルの解決関数。今はデフォルトのみ実装、拡張点を用意）。
  - 業界水準のなめらかなループアニメ。
- **完了**: 緑の ✓（アプリ共通の pill グロー言語）へモーフ、~600ms ホールド。
- **消滅**: フェード＋上方向退場 → **自動でボードへ遷移**（既存の取り込み後遷移を踏襲）。

### 7. 取り込み後の並び順バグ修正
- 原因: `handleSave` が `data.cards` を**先頭から**順に `addBookmark`。各回 `nextOrderIndex`（max+1）で**昇順**に付与されるため、降順表示で送り主末尾が最上段＝**反転**。
- 修正: **`data.cards` を逆順で保存**する（送り主先頭が最後に保存→最大 orderIndex→最上段）。
- 期待結果: 取り込んだ束は既存カードの**さらに上（最新扱い）**に乗り、**束の中は送り主のボードと同じ順**。

### 8. 共有スキーマ追加
- `ShareDataV2.w?: number`（送り主の基準カード幅 `cardWidthPx`）。任意。旧共有は `BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX` にフォールバック。
- 変更ファイル: `types-v2.ts` / `validate-v2.ts`（`w: z.number().positive().max(2000).optional()`）/ `board-to-share.ts`（書き出し）/ `BoardRoot.tsx`（`w: cardWidthPx` を渡す）/ `SharedBoard.tsx`（読み取り）。

### 9. 既存の確定（このセッションで反映済・維持）
- 背景タイポ白（0.95）、列数パリティ（scroller 左右 padding 9px＝ボード基準で4列）、Lightbox FLIP モーフ配線（sourceCardId＋clone-host）。

---

## アーキテクチャ / コンポーネント境界

- **`SharedBoard`**（受け取りの親・状態保持）
  - 状態: `removedUrls`（×除外）, `cardWidthPx`/`cardGapPx`（TUNE）, `bgTypoEnabled`（TITLE）, `motionEnabled`（MOTION）, `importPhase`（idle/importing/done）, `shareModalOpen`。
  - 可視カード = 共有カード − removedUrls。`items` / `customWidths` / `spacerHeight` はこれを基に算出。
  - 上帯: `<ImportButton>` ＋ `<MotionToggle>` ＋ `<BlockedChrome><FilterPill/></BlockedChrome>`。
  - `<TopHeader actions={ TITLE / TUNE / <BlockedChrome>MANAGE</> / <BlockedChrome>POP OUT</> / SHARE }>`。
- **`BlockedChrome`**（新・極小）: children を line-through＋pointer-events:none＋減光で包む。
- **`ImportProgressIndicator`**（新）: `phase` と `themeId` を受け、出現/最中/完了/消滅アニメを担当。動作中ビジュアルは `resolveWorkingVisual(themeId)`（今は音波 SVG のみ）。
- **`CardsLayer`**: 受け取りモードで × を出すよう変更（`receiverMode` でも `CardCornerActions` を許可、`onDelete` を受け取りの除外ハンドラに配線）。緑 SAVE オーバーレイ描画は削除。
- **再共有**: `SenderShareModal`（流用）＋ 可視カード→`buildShareDataFromBoard`。

## データフロー

1. fetch → sanitize → `state.ready`。`cardWidthPx=w(or default)`, `cardGapPx=gap(or default)`, `customWidths` 構築。
2. 表示: 可視カードを CardsLayer に流す。TUNE で width/gap 変更、× で removedUrls 追加。
3. IMPORT: `importPhase=importing` → 暗転＋インジケーター → `data.cards` のうち可視分を**逆順**に addBookmark（`tags: []`＝本体のみ）→ `done`（✓）→ 退場 → `/board` 遷移。
4. SHARE: 可視カード→buildShareData→create API→`/s/<newId>`。

## テスト

- 並び順: 受け取り取り込み後、IDB の orderIndex が「送り主先頭＝最大」になることを単体検証（純関数化した順序割当を test）。
- スキーマ: `w` の round-trip（board-to-share → validate）。
- 列数: 既存の幅基準テスト＋ playwright で 4 列確認（本番）。
- インジケーター: phase 遷移で出現/完了/消滅クラスが付くこと（可視性は state の純関数。アニメに依存させない＝既存方針）。

## 非対象（YAGNI）

- `BoardRoot` 自体の受け取り対応化（リスク大）。
- 受け取り画面でのタグ編集・カード並べ替えドラッグ・PiP・実フィルタ。
- 進捗カウント表示（`IMPORTING` のみ）。
