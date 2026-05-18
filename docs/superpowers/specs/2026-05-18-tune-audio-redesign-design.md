# TUNE chrome 音 motif redesign — vertical fader + radio dial + chrome polish

**作成**: 2026-05-18 (session 43)
**ステータス**: spec 確定 → 実装プラン作成待ち
**前提 spec**: [2026-05-18-topheader-tune-trigger-design.md](./2026-05-18-topheader-tune-trigger-design.md) (= session 41 で ship 済の現行 TUNE chrome)

---

## なぜやるか

session 42 で TUNE chrome の chip 中央問題 (= 「数字=ハンドル」 路線の math 上完璧だが視覚的にずれて見える) を 5 phase で解消しきれず、 user 「もしくは思い切った変更で、 スライダー自体音波メーターみたいにしたり、 ラジオのチューンとかサウンドミキサーのつまみとか、 マイクのゲインの縦のスライダーみたいにして、 数値は別のところにガタガタしないように置いちゃうのは？」 と提案。

**チップ中央補正 (= +3.18 / +0.75 px シフト) は本 spec で廃止**。 「数字=ハンドル」 路線そのものを捨てて、 オーディオ機材の語彙で再発明する方向に switch。

AllMarks の default theme は **黒+白 minimal + 音波 motif** (= memory `project_theme_sound_wave.md`)。 ScrollMeter は既に audio waveform 化済、 TUNE chrome も同じ音テーマ語彙に合流させて TopHeader 全体を「音テーマ」 で統一する。

---

## スコープ

**含む (= 本 spec で実装)**
- TUNE chrome の vertical fader + radio dial 化
- POPOUT / SHARE の音 motif polish (= idle scramble + hover static crackle)
- 数値 readout は既存 TopHeader 行内の挙動を完全継承 (= 位置・scramble・色)
- 既存 drag / reset / Ctrl+Z 体験の継承
- 1000ms hover leave grace (= 既に session 43 で ② として ship 準備済)

**含まない (= 別 sprint)**
- FILTER pill (= 別 family の chrome、 別 sprint で polish)
- mobile (≤640px) 対応 (= B-#10 mobile UX sprint に合流)
- drawer の touch 対応 (= 同上)
- テーマ vocab map (= TUNE → CALIBRATE 等の言い換え、 テーマ system 着手時)

---

## 配置とインタラクション

### TopHeader 行 (= idle 時の見え、 既存と同じ)

```
TUNE                                          POPOUT  SHARE  FILTER ▾
```

「TUNE」 文字だけ表示、 数値は隠れている。 既存の session 41 ship 仕様を完全継承。

### TopHeader 行 (= hover / sticky open 時、 既存と同じ位置で reveal)

```
TUNE  267.84 · 97.21  DEFAULT                 POPOUT  SHARE  FILTER ▾
```

- 数値の scramble reveal 演出 / 整数 bright + 小数 dim / オレンジ color = **既存と完全同一**
- 「TUNE」 自体は idle 時オレンジ → hover 中グレー (= 既存 session 42 grey 化挙動継承)
- 「DEFAULT」 は値 default 時 grey、 値変動時 white に切替 (= 既存仕様継承)

### 同期して下に展開する drawer (= 新規)

TUNE hover (or sticky click) で **TopHeader の下に drawer がスライド展開**。

```
┌─────────────────────────────────────────────┐
│ TUNE  267.84 · 97.21  DEFAULT  POPOUT SHARE │
├─────────────────────────────────────────────┤
│                                             │
│    [W fader]  [W ruler]   [G fader]  [G r]  │
│       ║ ▬       │           ║          │    │
│       ║         │           ║ ▬        │    │
│       ║         │═          ║         ═│    │
│       ║         │           ║          │    │
│       W                     G               │
│                                             │
└─────────────────────────────────────────────┘
```

**drawer 開閉アニメ**
- transition: `max-height 500ms cubic-bezier(0.16, 1, 0.3, 1)` (= 数値 reveal と同じ ease)
- 開閉と数値 scramble の reveal タイミングは同期 (= 同じ trigger / 同じ duration)
- mouseleave 後 1000ms grace を経て collapse 開始 (= session 43 ② で ship 準備済の `LEAVE_GRACE_MS` 流用)

**drawer 内部レイアウト**
- W column と G column が横並び (= ミキサーコンソール語彙)
- 各 column = fader (左) + ラジオダイヤル目盛 (右) の 2 要素ペア
- column 下に「W」 「G」 ラベル (= 9px Geist Mono、 letter-spacing 0.16em、 グレー)

---

## fader + ラジオダイヤルの仕様

### 縦 fader 本体

- 幅 22px × 高 110px (= drag 範囲確保)
- track: 2px 幅、 縦線、 中央が最も明るい gradient (`#333 → #555 → #333`)
- 中央 default 印: 横の細い線 (= 12px × 1px、 grey `#888`)、 track 中央位置
- handle: 22px × 7px、 オレンジ `#ff9d3f`、 角丸 2px、 グリップマーク (= 上下に 1px 黒線 inset)
  - box-shadow: `0 1px 4px rgba(255,157,63,0.6)` (= 光沢感)、 内側 inset で立体感
- 縦 drag 操作: 上=増、 下=減
- track 空クリックでその位置にジャンプ
- Shift+drag で 4 倍速 (= 既存 `SHIFT_SPEED_MULTIPLIER` 流用)

### ラジオダイヤル目盛 (= fader 右側に併設)

- 幅 18px × 高 110px
- 22 本の tick mark (5% 刻み)
  - 0% / 25% / 50% / 75% / 100% = major tick (= 12px 幅、 grey `#777`)
  - 50% は special major (= 14px 幅、 brighter grey `#aaa`、 = default 位置の強調印)
  - その他 = minor tick (= 6px 幅、 dark grey `#444`)
- handle 近辺の 3 本 (= handle ±10% range) = オレンジ点灯 `#ff9d3f` + `box-shadow: 0 0 4px rgba(255,157,63,0.6)`
  - = 「今ここ」 印、 ラジオの周波数チューニングの「合わせ」 感
- ラジオダイヤル目盛上 click で fader handle がその位置にジャンプ (= 装飾だけでなく操作可能)

### default-center マッピング (= session 38 で確立済、 継承)

- fader 中央 50% = default 値
- 上半分 (50% → 100%) = default → max
- 下半分 (50% → 0%) = default → min
- 既存 `valueToFraction` / `chipLeftPx` 関数のロジックを縦軸に転用

---

## POPOUT / SHARE chrome polish

### idle scramble (= 自発発火)

- 各ボタン独立、 10-20 秒ランダム間隔で 1 回 scramble (= 文字置換アニメ)
- ScrollMeter / TUNE と同じ scramble 語彙 (= `scramble.ts` の `pickRandomChar` 関数を再利用)
- duration: 125-190ms per character、 stagger 11ms (= 既存 STAGGER_MS / SCRAMBLE_MIN_MS / MAX_MS 流用)
- accessibility: `prefers-reduced-motion: reduce` で発火停止

### hover static crackle (= 「じじっ」)

- mouse enter で 1-2 frame の電気ノイズエフェクト
  - 文字が 0.5-1px 横振動 (= jitter)
  - 文字に薄い blur (= 0.5px) が一瞬入る
  - 隣の文字 outline が低 opacity で一瞬重なる (= ghost trail)
- 持続: 80-120ms (= 短く、 hover 開始時の一発のみ、 hold 中は走らない)
- 実装: CSS keyframe + `:hover` trigger (= JS 不要)
- accessibility: `prefers-reduced-motion: reduce` で fallback (= opacity 変化のみ)

---

## 既存挙動の継承一覧 (= 触らない)

| 項目 | 現状 | 本 spec での扱い |
|---|---|---|
| 数値 reveal 位置 | TopHeader 左 (TUNE 横) | 不変 |
| 数値 scramble 演出 | v4-inplace、 stagger 11ms | 不変 |
| 整数 bright / 小数 dim | あり (= 整数 `#fff`、 小数 0.5 opacity) | 不変 |
| DEFAULT 文字 click reset | あり | 不変 |
| Ctrl+Z undo / Ctrl+Shift+Z redo | あり | 不変 |
| Shift+drag 高速化 | `SHIFT_SPEED_MULTIPLIER = 40` | 不変 |
| 30000 px full-range drag | `MOUSE_PX_FOR_FULL_RANGE = 30000` | 不変 |
| sticky open (TUNE click) | あり | 不変 |
| ESC + outside click で close | あり | 不変 |
| `aria-expanded` 状態管理 | あり | 不変 |
| i18n キー `board.chrome.{tune,popout,share}` | あり | 不変 |
| i18n キー `board.tune.{width,gap,reset_tooltip}` | あり | 不変 (= chrome 言語ポリシーで 15 言語英語固定済) |

---

## 廃止される要素

| 項目 | 現状 | 本 spec での扱い |
|---|---|---|
| chip (= 透明ピル + オレンジ数字 handle) | あり (= `chipLeftPx()` で位置計算) | **廃止** |
| chip 視覚補正 (= session 43 ① で予定だった +3.18 / +0.75 px) | 未実装 | **着手しない (= 廃止と同時)** |
| 短いピル track (= 100px) | あり | **廃止** |
| `CHIP_INSET_PX = 18` | あり | **廃止** |
| `TRACK_WIDTH_PX = 100` | あり | **廃止** |

---

## アーキテクチャ (= ファイル / モジュール構成)

### 既存 file (= 改修)

- `components/board/TuneTrigger.tsx` — chip 周辺を fader + radio dial の DOM に置換
- `components/board/TuneTrigger.module.css` — chip 関連 class 削除、 fader / radio-ruler / drawer の class 追加
- `components/board/TuneTrigger.test.tsx` — 既存 8 test を fader DOM に追従、 新規 test 3-5 追加
  - fader drag で onChangeWidth 発火
  - radio ruler click で fader 位置ジャンプ
  - drawer の hover open / leave grace close
- `components/board/TopHeader.tsx` (or 該当場所) — POPOUT / SHARE に scramble + crackle 適用

### 新規 file (= 候補)

- `components/board/FaderColumn.tsx` — 単一 column (fader + radio ruler + label) の独立 component
  - props: `value` / `min` / `max` / `def` / `onChange` / `label`
  - = W / G で同じ component を 2 回描画
- `components/board/FaderColumn.module.css` — 該当 styles
- `components/board/FaderColumn.test.tsx` — column 単体テスト

### 既存 helper (= 再利用)

- `lib/board/scramble.ts` — `pickRandomChar` 等を POPOUT / SHARE scramble にも流用
- `lib/board/constants.ts` の `BOARD_SLIDERS.*` — 既存 default / min / max 値継承
- 既存 `valueToFraction()` を縦 fader fraction に流用

---

## エラーハンドリング / 境界

- drawer が viewport 下端を超えるケース: TopHeader sticky 配置なので発生しないと判断 (= 板の最上端固定)
- drawer 内 click が board に貫通するケース: drawer に `pointer-events: auto` + `stopPropagation()` で防御
- `prefers-reduced-motion: reduce`: scramble 停止、 crackle は opacity のみ、 drawer 開閉は 0ms (即時)
- TUNE hover 中に POPOUT に mouse move → drawer 閉じる (= 既存 leave grace 挙動継承)

---

## テスト計画

### 単体 (vitest)

- 既存 `TuneTrigger.test.tsx` の 8 test を fader DOM 構造に追従改修
- 新規 `FaderColumn.test.tsx`:
  - 初期 render で handle が default 位置 (= 50%) にある
  - pointermove で onChange が呼ばれる
  - radio ruler click でその位置にジャンプ
  - Shift+drag で 4 倍速
- POPOUT / SHARE の idle scramble: timer mock で発火確認

### 統合 (playwright at 1489×679)

- TUNE hover → 数値 reveal + drawer open 同期確認
- fader drag → W 値変化 + radio ruler ハイライト追従 + 数値 readout 更新
- DEFAULT click → fader handle が 50% に戻る
- Ctrl+Z で 1 step undo (= 既存 undo system 経由)
- mouseleave → 1000ms 後に collapse 開始
- POPOUT hover で crackle 発火、 80-120ms で終了
- POPOUT idle で 10-20 秒以内に scramble 発火 (= 確率的なので long timeout で 30 秒待つ)

### prod 検証

- `https://booklage.pages.dev` でハードリロード後、 user 視認 (= 1489×679 で確認)
- 60fps 維持 (= drawer open 中 + drag 中)
- Lighthouse 90+ 維持

---

## 段階的 ship 戦略

1 PR で全部 ship (= scope 小、 互いに依存)。 内訳:
1. `LEAVE_GRACE_MS = 1000` (= session 43 で既に edit 済、 本 spec の一部として同梱 commit)
2. chip 廃止 + fader 追加 (= TuneTrigger 改修 + FaderColumn 新設)
3. radio ruler 追加
4. POPOUT / SHARE scramble + crackle
5. test 改修 + 新規追加

---

## オープン question (= 実装時 user 確認)

なし (= 設計レベルでは合意済、 詳細は実装プラン writing-plans で詰める)

---

## 参考 mockup

- 視覚イメージ: `.superpowers/brainstorm/1868-1779074573/content/final-shape.html` (= session 43 brainstorm 中の最終モックアップ)
- 5 案比較: `.superpowers/brainstorm/1868-1779074573/content/slider-shape-options.html`
- 3 配置比較: `.superpowers/brainstorm/1868-1779074573/content/fader-placement.html`
