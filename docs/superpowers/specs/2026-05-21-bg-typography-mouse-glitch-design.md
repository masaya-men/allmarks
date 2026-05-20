# 背景文字 マウス追従グリッチ (I) — 設計仕様

> **状態**: design approved (= 2026-05-21 session 60、 user 承認済)
> **着手予定**: session 60 内に実装 → ship
> **関連 memory**: `project_theme_sound_wave.md` / `feedback_layman_simple_path.md`
> **関連 IDEAS**: [docs/private/IDEAS.md §I](../../private/IDEAS.md) (= 元 brainstorming)

---

## 1. 概要

board 背景に常時表示されている AllMarks ロゴ (= 既存 [BoardBackgroundTypography](../../../components/board/BoardBackgroundTypography.tsx)) に、 マウス座標を追跡する**ローカルグリッチエフェクト**を追加する。 マウス近傍 (= 半径 80 px 程度の円形範囲) のロゴ部分だけ RGB シフトで chromatic aberration / 信号ノイズ風に破断する。 範囲外は通常通りクリーンな白文字。

「光のスポットライトの代わりに**信号ノイズのスポットライト**」 がコンセプト。

## 2. 動機

- board の背景の AllMarks 文字が**静的すぎる**: 既存 BoardBackgroundTypography は 'static' variant のみ実装、 文字が動かない
- 一方で TUNE drawer / chrome 要素には glitch hover / scramble 等の信号ノイズ表現が既にあり、 board 中央の最大要素だけが無味
- マウスが触れた所だけ壊れる効果は board の「ライブ感」 を上げる + AllMarks の音波 motif theme と整合
- IDEAS.md §I に元アイデア記録済、 session 43 で user 発案

## 3. 動作

- board に入って**マウスを動かすと**、 マウス近傍の AllMarks 文字が glitch する
- 範囲外の文字は通常通り見える
- マウスが board の外に出たら、 **直前の位置で固定** (= フェード等の特殊処理は無し)
- 別ウィンドウからフォーカスが戻った時は、 最初の `pointermove` で更新される (= 初期化不要)

## 4. 視覚仕様 (= 信号ノイズスポットライト)

### 3 層構造

DOM に 3 つの span を重ねる:

| 層 | 中身 | 表示範囲 | 色 |
|---|---|---|---|
| 1. 通常文字 | テキスト本体 (= 既存) | 全領域 | 白 `rgba(255, 255, 255, 0.95)` |
| 2. 赤チャンネルゴースト | 同じテキストを **+2 px 右**にずらして配置 | マウス周辺の円形のみ (= mask) | 赤 `rgba(255, 80, 90, 0.85)` |
| 3. シアンチャンネルゴースト | 同じテキストを **-2 px 左**にずらして配置 | マウス周辺の円形のみ (= mask) | シアン `rgba(80, 220, 255, 0.85)` |

層 2 と 3 が同じ位置に重なる箇所では完全に白に戻り、 ずれた左右端だけ赤・シアンが見えて RGB アベレーション (= 信号ノイズ風) になる。

### radial mask

層 2 と 3 に CSS `mask-image: radial-gradient(...)` を適用:

```css
mask-image: radial-gradient(
  circle at var(--bg-typo-glitch-mx, 50%) var(--bg-typo-glitch-my, 50%),
  black 0,
  black var(--bg-typo-glitch-radius, 60px),
  transparent var(--bg-typo-glitch-falloff, 100px)
);
```

`--bg-typo-glitch-mx` / `--bg-typo-glitch-my` は JS マウストラッカーが px 値で更新する。 mask 内側 (中心〜60 px) は完全可視、 60〜100 px でグラデーションフェード、 100 px 以上は透明。 結果として円形の「信号ノイズエリア」 が常にマウスを追従する。

### 既存テキスト styling は保持

`font-family: var(--font-geist)`、 `font-weight: 600`、 `font-size: clamp(72px, 17vw, 260px)`、 `letter-spacing: -0.035em` 等の現状値はそのまま。 ゴースト層も同じスタイルで揃える (= 必ず文字位置がぴったり重なる前提)。

## 5. テーマ・フィルタ拡張性

### テーマ切替への対応

将来テーマシステム導入時に色味やサイズ感を切り替えられるよう、 すべての可変パラメータを CSS 変数として外出しする:

| 変数名 | デフォルト | 役割 |
|---|---|---|
| `--bg-typo-glitch-radius` | `60px` | 完全可視範囲の半径 |
| `--bg-typo-glitch-falloff` | `100px` | 透明への境界半径 |
| `--bg-typo-glitch-offset` | `2px` | RGB シフトのピクセル量 |
| `--bg-typo-glitch-red` | `rgba(255, 80, 90, 0.85)` | 赤チャンネル色 |
| `--bg-typo-glitch-cyan` | `rgba(80, 220, 255, 0.85)` | シアンチャンネル色 |
| `--bg-typo-glitch-mx` | `50%` | マウス X (= JS が更新) |
| `--bg-typo-glitch-my` | `50%` | マウス Y (= JS が更新) |

将来テーマセレクタ (例: `[data-theme="cyber"]`) で `--bg-typo-glitch-red: #ff00ff` 等を上書きすれば、 デフォルト挙動を保ったままテーマごとに色味調整可能。

### フィルタ切替への対応

[deriveBoardBgTypoText](../../../components/board/BoardBackgroundTypography.tsx) は既に filter / mood に応じて表示テキストを切り替える (= 'AllMarks' / 'Inbox' / 'Archive' / 'Dead Links' / mood:xxx)。 3 層は全部同じ `{text}` を子に持つので、 フィルタ切替時に**自動で全層が同期更新される**。 特別な処理は不要。

- mouse tracker は host 要素に subscribe、 host は再マウントしないので tracker も継続
- テキスト変更時に glitch 位置がリセットされない (= シームレス)

### variant 拡張

既存の `BoardBgTypoVariant` 型は触らない:
- `'static'` = **今回追加するマウス追従グリッチを含む新デフォルト**
- 他の予約 variant ('dvd-bounce' / 'glitch' / 'multi' / 'marquee' / 'card-wind') は今のまま予約
- 将来 `'static-pure'` 等を追加して「マウス追従なしの静的版」 を選べるようにする予定枠を残す (= 今回は実装しない)

## 6. 実装 (= CSS mask + JS マウストラッカー)

### CSS

[BoardBackgroundTypography.module.css](../../../components/board/BoardBackgroundTypography.module.css) を更新:

1. `:root` または `.host` に上記 CSS 変数のデフォルト値を定義
2. `.host` に `position: relative` を保証 (= 既に inset: 0 で flex 中心配置)
3. 3 層 (`.text` / `.glitchRed` / `.glitchCyan`) のスタイルを定義
4. ゴースト 2 層は `position: absolute` で `.text` と完全に重ねる
5. ゴースト 2 層は `mask-image: radial-gradient(...)` を適用
6. ゴースト色は `color: var(--bg-typo-glitch-red)` 等で外出し
7. mix-blend-mode: `screen` (= 加算的合成で本物の RGB シフトに近い見た目)

### TSX

[BoardBackgroundTypography.tsx](../../../components/board/BoardBackgroundTypography.tsx) を更新:

1. `useEffect` でマウストラッカーセットアップ
   - host 要素の最も近い positioned ancestor (= board canvas) にリスナー登録
   - 見つからなければ document level fallback
2. `pointermove` を rAF throttle:
   - pointermove → pending 座標を保存
   - rAF cb → host.style.setProperty で `--bg-typo-glitch-mx` `--my` 更新、 rafId クリア
3. クリーンアップで removeEventListener + cancelAnimationFrame
4. JSX に 3 層追加: 通常 `<span>` + 赤ゴースト `<span aria-hidden>` + シアンゴースト `<span aria-hidden>`

### Performance

- rAF throttle で 60 fps 上限
- pointer-events: none を host に保持 (= board 操作と競合しない)
- mask-image / mix-blend-mode は GPU 合成 (= 軽い)
- 既存 board の rendering perf 影響は無視できる範囲

## 7. テスト

### 既存維持

- 既存 vitest: BoardBackgroundTypography.test.tsx (= deriveBoardBgTypoText、 isBoardBgTypoVariant) は全部 PASS 維持
- 既存 board 関連テスト 653 PASS 維持

### 新規 unit test

- BoardBackgroundTypography render 時に 3 層 (`.text` / `.glitchRed` / `.glitchCyan`) が DOM にある
- マウス追従: pointermove 発火後、 host の `style.--bg-typo-glitch-mx` が更新される (= happy-dom + fireEvent + rAF を vi.useFakeTimers で進める)
- variant prop が 'static' (= default) で正しく描画される

## 8. スコープ外 (= この設計に含めない)

- pointerleave 時のフェード処理 (= 直前位置で固定で OK と確認済)
- マウスが board 外にいる時の特殊効果 (= 動作なし)
- prefer-reduced-motion 対応: mask 効果は静止画なので reduce-motion でもそのままで OK
- mobile (touch) 対応: touch event なし、 desktop only (= 既存仕様と合わせる)
- variant 'static-pure' の実装 (= 将来枠だけ予約、 今回は実装しない)
- 他の variant ('dvd-bounce' / 'glitch' 等) の中身実装

## 9. ファイル変更想定

| ファイル | 変更内容 |
|---|---|
| `components/board/BoardBackgroundTypography.tsx` | useEffect 追加 (= マウストラッカー)、 JSX に 2 つのゴースト span 追加 |
| `components/board/BoardBackgroundTypography.module.css` | CSS 変数定義、 .glitchRed / .glitchCyan セレクタ追加、 mask + mix-blend-mode |
| `components/board/BoardBackgroundTypography.test.tsx` | 3 層存在テスト + マウス追従テスト追加 |

## 10. 関連 reference

- IDEAS.md §I (= 2026-05-18 session 43 user 発案、 「信号ノイズスポットライト」 コンセプト)
- memory `project_theme_sound_wave.md` (= AllMarks 音波 motif theme 確定)
- memory `project_pill_visual_language.md` (= ✓ pill の chromatic aberration 表現と統一感)

---

## 承認状態

- [x] 設計コンセプト確定 (2026-05-21 session 60 user 承認)
- [x] 3 層構造 + radial mask アプローチ
- [x] CSS 変数で全パラメータ外出し (= テーマ対応)
- [x] フィルタ切替時の自動同期 (= host 再マウントなし)
- [x] variant 'static' を新デフォルトに上書き
- [ ] 実装 plan (= writing-plans skill で作成、 別ファイル)
- [ ] 実装 + ship + user 検証
