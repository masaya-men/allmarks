# TopHeader 右クラスタ brushup — TUNE トリガー + ホバー scramble — design spec

> セッション 41 (2026-05-18) brainstorm 確定。 B-#13 TopHeader brushup の右クラスタ部分。 既存の Apple v3 (= 文字 chrome) 路線を維持しつつ、 W/G slider をホバー展開する TUNE トリガーに統合する。

---

## 0. ゴール

TopHeader 右側に並んでいる 6 要素 (PopOut / SizeSlider / GapSlider / WidthGapReset / ResetAll / Share) を **3 つのテキスト label** (`TUNE` / `POP OUT` / `SHARE`) に整理する。 `TUNE` はホバーで Matrix 風 scramble して W/G readout に展開、 値の上でドラッグして slider 操作、 末尾 `↺` でデフォルトに戻す。

下端 ScrollMeter (= session 27-39 確定) はそのまま、 左側 FilterPill もそのまま。 上端の chrome の vocabulary と密度を整える brushup。

---

## 1. レイアウト確定

```
[ ALL · 124 ▾ ]                              TUNE   POP OUT   SHARE
       (左 = nav)                                  (右 = actions / display)

           ・・・・カード領域・・・・

                [ 0001 — 0012 / 0124 ]
                       ∿∿∿∿∿
                  (= ScrollMeter)
```

- 左: 既存 `FilterPill` そのまま
- 右: 新しい `TUNE` / `POP OUT` / `SHARE` の 3 テキスト label
- 全 chrome 共通: 11px monospace、 ALL CAPS、 `letter-spacing: 0.10em`、 `color: rgba(255,255,255,0.85)`、 `-webkit-text-stroke: 0.5px rgba(0,0,0,0.45)` + `paint-order: stroke fill`
- 背景・border・pill 一切なし (= 既存 Apple v3 と完全統一)
- padding: 各 label `8px 12px` (= hit area ≥32×32、 大ポインタ user 対応)
- gap: `4px` (right-group 内の label 同士)

---

## 2. ホバーインタラクション (= TUNE → W/G readout の Matrix scramble)

### 2-1. ふだん (idle)

```
[ALL · 124]                              TUNE   POP OUT   SHARE
```

`TUNE` は **完全静止 のプレーンテキスト**。 idle jitter / breathing / pulse 等のアニメ一切なし。 他 chrome (POP OUT / SHARE) と完全同等のスタイル。

### 2-2. ホバー時 (mouse over TUNE)

mouse enter で **即座** に readout に展開:

```
[ALL · 124]            [W 267.84 · G 97.21 · ↺]   POP OUT   SHARE
```

readout = `W <width>.<decimal> · G <gap>.<decimal> · ↺` の plain text。 box / border / background 一切なし。

### 2-3. scramble アニメーション (v4-inplace)

**Open 動作** (mouse enter):

- readout の **全 cell** (= ~22 文字、 `W` `␣` `2` `6` `7` `.` `8` `4` `␣` `·` ...) が **t=0 で同時に出現** (= 容器幅は即座に full に snap、 左方向の伸び感ナシ)
- 各 cell は出現と同時に `SCRAMBLE_CHARS` (= `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·#@$%&*?/\|<>=+-`) からランダム文字を per-frame で表示
- 各 cell の `settleAt` = `index × 11ms + (125-190ms randomized)` で settle (= target 文字に固定)
- 視覚的に **左から「ピピピピッ」 と順に止まっていく**
- 全体 open 完了 ≈ `21 × 11 + 190 = 421ms`

**Close 動作** (mouse leave + 180ms delay):

- 全 cell が再度 scramble 状態に戻る
- 各 cell の `settleAt` = `(N-1-index) × 11ms + (125-190ms randomized)` で settle (= 右から左に順に消える stagger)
- settle = empty (= cell が DOM から除去される)、 全 cell empty 後に `TUNE` プレーンテキストに戻す
- 視覚的に **右から「ピッピッ」 と順に消えて TUNE に戻る**

**Mouse leave grace**: leave 直後 180ms は close を発火しない (= readout の上にカーソル移動する間に消えない buffer)。 180ms 経過後に close 発火。

### 2-4. cell の color (= target に応じて kind 別)

| kind | 用途 | color |
|---|---|---|
| `label` | `W`, `G`, `↺`, 空白 | `rgba(255,255,255,0.85)` (= chrome 共通) |
| `num` | `267.84`, `97.21` の数字 + 小数点 | `rgba(255,200,120,0.95)` (= accent、 既存 PrecisionSlider tooltip と統一) |
| `dim` | `·` separator、 空白 | `rgba(255,255,255,0.30)` |

scramble 中のランダム文字も同じ `kind` の color を維持する (= color は cell 識別子、 文字内容だけ変化する)。

### 2-5. クリック挙動

- **Mouse click on TUNE 自体**: sticky open (= マウスが離れても閉じない)、 outside click または ESC で close
- **Mouse click on number cell** (`267.84` / `97.21`): カーソル位置の値を「scrub 開始」、 horizontal drag で値変更 (= 既存 `PrecisionSlider` の `setPointerCapture` + `movementX × ratio` ロジック流用)
- **Mouse click on `↺`**: W/G を default 値 (`267.84` / `97.21`) に戻す。 Ctrl+Z で undo 可 (= session 40 undo system に統合)

### 2-6. キーボード / a11y

- TUNE 要素は `<button>` で `aria-haspopup="dialog"` + `aria-expanded`
- Tab で focus、 Enter / Space で sticky open 切替
- ESC で close
- Focus 中もホバー扱い (= readout 表示状態)
- readout 内の各 number cell は別 button、 Tab で 2 段階 focus 可、 ←/→ で値変更可

---

## 3. mobile / touch

**今回は対応しない、 B-#10 モバイル UX 本格チューニング に合流して別 sprint で扱う**。

- 現状 (= 暫定): `@media (max-width: 640px)` で `[data-group="actions"] > :not([data-testid="share-pill"]) { display: none }` で SHARE 以外を隠す既存ルールを残す (= TUNE / POP OUT も隠れる)
- 将来 mobile sprint で: tap で sticky open (toggle)、 outside tap で close 等の touch 対応

---

## 4. 削除する component / DOM (cleanup)

`BoardRoot.tsx` の `<TopHeader actions={...}>` slot から以下を削除:

- `<PopOutButton>` (= `↗` 矢印 icon button) → 新しい `POP OUT` 文字 button に置換
- `<SizeSlider>` 単独表示 (= 機能は TuneTrigger 内の readout drag で代替)
- `<GapSlider>` 単独表示 (同上)
- `<WidthGapResetButton>` (= ↺ 単独 button) → TuneTrigger 内の `↺` cell で代替
- `<ResetAllButton>` (= 「全カード幅 reset」 button) → **完全廃止**、 Ctrl+Z (session 40 undo system) で 1 ステップずつ revert する方針に統一

ファイル自体は残す:

- `SizeSlider.tsx` / `GapSlider.tsx` の内部 slider ロジック (= `setPointerCapture` 周り) は TuneTrigger が import して reuse
- `ResetAllButton.tsx` は不使用になるが file は残す (= 将来「全カード幅 reset」 機能を別 UI で復活させる可能性。 削除は別 cleanup commit で)

---

## 5. 新規 component: `<TuneTrigger>`

ファイル: `components/board/TuneTrigger.tsx` + `TuneTrigger.module.css`

### 5-1. Props

```typescript
type Props = {
  readonly widthPx: number          // 現在の cardWidth (= 267.84 等)
  readonly gapPx: number            // 現在の cardGap (= 97.21 等)
  readonly onChangeWidth: (w: number) => void
  readonly onChangeGap: (g: number) => void
  readonly onReset: () => void      // ↺ クリック時 (= W/G を default に戻す)
  readonly label?: string           // default 'TUNE'、 将来テーマ vocab で override 可
}
```

### 5-2. 内部 state

- `mode`: `'idle-tune' | 'opening' | 'idle-readout' | 'closing'` (= 4 state、 demo の `phase` と同じ)
- `stickyOpen`: boolean (= click 後の open 維持 flag)
- `cells`: `Array<{ targetCh, kind, settleAt }>` (= rAF で参照、 React state ではなく ref)
- `scrambleStartRef`: phase 開始の `performance.now()` 値
- `rafIdRef`: requestAnimationFrame ID

### 5-3. rAF loop

`scrambleStartRef.current` + `cells` を読みつつ、 cell ごとに `elapsed - cell.settleAt < 0 ? randomChar() : targetCh` を innerHTML に書く (= ScrollMeter の同じパターン、 React re-render を避けるため `wrapEl.innerHTML = ...` 直接書き換え)。

### 5-4. drag-scrub (number cell 上)

- pointerdown on `.cell.num` → 対応する slider (W or G) の `setPointerCapture(pointerId)`
- pointermove → `movementX × ratio` で値変更 (= 既存 `PrecisionSlider` の感度設定を踏襲、 Shift キーで高速、 通常 10× slow)
- pointerup → release
- drag 開始時点では readout は既に settled (= scramble 終了済) なので scramble 状態との競合は発生しない
- 値変化は既存の `handleCardWidthChange` / `handleCardGapChange` (BoardRoot) を呼ぶ → session 40 で入った 500ms debounce 付き undo entry に自動連携

### 5-5. dependencies

- `lib/board/scramble.ts` (新規 utility) — `SCRAMBLE_CHARS` 定数 + `pickRandomChar()` helper
- `components/board/PrecisionSlider.tsx` の internal drag ロジックを抽出して shared hook 化 (= `useDragScrub({ pointerRatio, slow, fast })`)
- `lib/i18n/t.ts` の既存 `t()` 関数

---

## 6. 削除順序 (= 安全な migration sequence)

1. `TuneTrigger.tsx` 新規実装 + 単体 vitest で scramble / drag-scrub / sticky open / a11y を検証
2. `BoardRoot.tsx` の `<TopHeader actions={...}>` slot 内、 既存 6 component を `<TuneTrigger>` + `POP OUT` button + `SHARE` button の 3 つに置換
3. tsc + 既存 test (TopHeader.test.tsx 含む) が pass することを確認
4. 既存の `<SizeSlider>` `<GapSlider>` `<WidthGapResetButton>` `<ResetAllButton>` `<PopOutButton>` の DOM 出力部分は削除されたので、 BoardRoot から `import` も削除
5. ファイル自体は残す (上記 §4 ノート)
6. playwright 実機検証 (= ユーザー viewport 1489×679):
   - idle = TUNE 静止
   - hover → 421ms で readout 完全表示
   - mouse leave + 180ms → readout 消えて TUNE 復帰
   - readout の `267.84` を drag → cardWidth 変化、 board reflow
   - `↺` click → W/G が default に戻る + Ctrl+Z で復元できる
   - sticky open + outside click → close
   - keyboard: Tab → Enter → readout open、 ESC → close
7. tsc clean / vitest 全 pass / build pass を確認
8. wrangler pages deploy (= `--branch=master --commit-dirty=true`)

---

## 7. i18n

新規 key を `messages/{15 言語}.json` 全部に追加:

| key | en (default) | ja (default) |
|---|---|---|
| `board.chrome.tune` | `TUNE` | `TUNE` (= 全言語 verbatim 英語、 将来 theme vocab で override 可) |
| `board.chrome.popout` | `POP OUT` | `POP OUT` (同上) |
| `board.chrome.share` | `SHARE` | `SHARE` (同上) |
| `board.tune.width` | `W` | `W` (= 単位 label、 全言語共通) |
| `board.tune.gap` | `G` | `G` (同上) |
| `board.tune.reset_tooltip` | `Reset to defaults` | `初期値に戻す` |

「Polish per-language」 (= 各言語の慣用句に合わせた最適化) は **別 sprint** で各言語担当に振る案。 今回は英語 verbatim でローンチ。

---

## 8. 将来拡張のための構造 (= 今回は実装しない、 hook だけ残す)

### 8-1. テーマ毎の vocab 切替 (= 「TUNE → CALIBRATE」 等)

`TuneTrigger` の `label` prop で外から差し替え可能にしておく。 将来テーマ system 実装時に:

```typescript
const themeVocab = useThemeVocab() // 将来 implement
<TuneTrigger label={themeVocab.tune ?? t('board.chrome.tune')} ... />
```

の形で接続できる。 今回は `label` prop は default `'TUNE'` でハードコード、 vocab map は構築しない。

### 8-2. PopOut オンボーディング (= 「これ PiP 機能だよ」 案内)

別 task で扱う。 今回は `POP OUT` 文字 button を click したら現在の `PopOutButton` と同じ動作 (= `pip.open()`) だけ実装。 オンボーディング (= 初見ユーザーへのチュートリアル) は backlog。

### 8-3. mobile (≤640px)

B-#10 モバイル UX 本格チューニング に合流。 暫定として既存「SHARE 以外 hidden」 のメディアクエリを残す (= TUNE / POP OUT も mobile では一旦隠す)。

---

## 9. 変更ファイル一覧 (= 実装 plan の input)

### 新規

- `components/board/TuneTrigger.tsx`
- `components/board/TuneTrigger.module.css`
- `components/board/TuneTrigger.test.tsx`
- `lib/board/scramble.ts` (= `SCRAMBLE_CHARS` 定数 + helper)

### 編集

- `components/board/BoardRoot.tsx` — actions slot を 3 button に置換、 既存 import 削除
- `components/board/TopHeader.module.css` — 既存 `@media (max-width: 640px)` の `[data-testid="share-pill"]` 以外を hidden にするルールはそのまま (= 新しい TUNE / POP OUT button は testid 持たないので自動的に mobile で hidden、 CSS 変更不要だが implementation 時に verify)
- `messages/{15 言語}.json` 全部 — 新 key 追加
- `components/board/PrecisionSlider.tsx` — 内部 drag ロジックを `lib/board/useDragScrub.ts` hook に抽出 (= `TuneTrigger` と共有)、 PrecisionSlider 自体は hook を消費する形に refactor

### 削除する DOM 参照 (file は残す)

- `<PopOutButton>` import + render
- `<SizeSlider>` import + render
- `<GapSlider>` import + render
- `<WidthGapResetButton>` import + render
- `<ResetAllButton>` import + render

---

## 10. 確定事項 / 範囲外

### 確定

- 文字サイズ 11px、 monospace、 letter-spacing 0.10em、 ALL CAPS、 `paint-order: stroke fill`
- 背景・border・pill ナシ (= 完全文字 chrome、 Apple v3 路線)
- TUNE idle = 完全静止、 jitter なし
- scramble = v4-inplace (= 全 cell 同時 appear + stagger 11ms / scramble 125-190ms で settle)
- 左方向への伸び感はナシ (= 容器幅は瞬間で full に snap)
- mouse leave grace = 180ms
- TUNE の click = sticky open
- number cell drag = scrub (= PrecisionSlider 流用)
- `↺` = W/G default 値戻し、 Ctrl+Z で undo 可
- ResetAll は完全廃止 (= Ctrl+Z で代替)

### 範囲外 (= 別 sprint or backlog)

- テーマ毎の vocab 切替 (= 将来テーマ system 実装時)
- PopOut オンボーディング (= 別 task)
- mobile (≤640px) の touch UI (= B-#10 mobile sprint)
- i18n polish per-language (= 別 sprint)
- 各言語担当による「TUNE」 のローカライズ最適化

---

## 11. 関連 spec / memory

- `docs/superpowers/specs/2026-05-15-board-chrome-minimal-design.md` — Apple v3 chrome 路線確定 spec (= 上端 scrim + thin stroke 文字)
- `docs/superpowers/specs/2026-05-16-precision-slider-design.md` — drag-scrub ロジック (= `setPointerCapture` + ratio) の元
- memory `project_board_header_brushup.md` — 「TopHeader brushup 視野」 のメモ
- memory `feedback_large_pointer.md` — hit area ≥32×32 確保ルール
- memory `feedback_ui_vocabulary.md` — UI text は世界共通英語語彙 (= TUNE / POP OUT / SHARE はこのルールに準拠)

---

*文書化日: 2026-05-18 / セッション 41 brainstorm 確定。 次は writing-plans skill で実装 plan に展開。*
