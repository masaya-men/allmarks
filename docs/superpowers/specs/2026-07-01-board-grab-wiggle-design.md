# 空き盤面「掴んでぐりぐり」微インタラクション — 設計 (Design)

- **日付**: 2026-07-01 (session 147)
- **発案**: ユーザー (IDEAS.md 2026-07-01「何もない盤面を掴んで『ぐりぐり』動かす微インタラクション」)
- **位置づけ**: 上澄み polish (ローンチ blocker ではない)。テーマの世界観を強める「目が楽しい」要素。
- **不変条件**: default 盤面 byte-identical / ¥0 (サーバー非接触) / deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。

---

## 1. 概要 (What)

盤面の**カードの無い余白を左クリックで掴んで動かす**と、世界が指につられて少しズレ、**離すとバネで元に戻る**「その場の遊び」。実スクロール位置は変えない。paper テーマでは既存の3層パララックス (奥=羊皮紙 / 中間=散布シミ / 手前=カード) がそれぞれ違う量だけズレて**奥行き**が出る。default (黒+音波) は奥行き層が無いので**カード層だけが平らにズレる**。

### 体験仕様 (ふるまい)

| 項目 | 仕様 |
|------|------|
| トリガー | 盤面余白の**素の左ドラッグ** (カード/ヘッダー/ピルの上では発動しない) |
| 動く方向 | **2D 自由** (上下左右斜め) |
| 抵抗 | **rubber-band** — 小さい引きは素直に追従、引くほど重くなり頭打ち (上限 ~90px) |
| 奥行き | paper: 3層が重み付きでズレる (手前ほど大きい)。default: カード層のみ (平ら) |
| 離した時 | **spring-back** — わずかにオーバーシュートして 0 に戻る ("ぷるっ") |
| スクロール | **変えない**。スクロールはホイールに一本化 |
| テーマ | **全テーマ** (paper=奥行きあり / default=平ら) |
| スマホ | **今回対象外**。将来「長押し→同じ遊び」を別タスク (§7 参照) |

---

## 2. 既存挙動との関係 (制約の発見)

[InteractionLayer.tsx](../../../components/board/InteractionLayer.tsx) には既に**空き盤面ドラッグ = スクロール (pan)** の挙動がある:

- **中ボタン (button===1)** または **左ボタン+Space held** → カードの上でもパン (scroll)
- **素の左ボタン × 余白 (`e.target === e.currentTarget`)** → パン (scroll)

本機能は **「素の左ボタン × 余白」だけ** を新しい掴み遊びに置き換える。

- **温存 (現状コードのまま)**: 中ボタンパン / Space+ドラッグパン / ホイールスクロール。
- **reduced-motion 時**: 素の左ドラッグも**従来のスクロールにフォールバック** (機能を壊さない・演出だけ消す)。
- スマホのタッチ・スクロールは「素の左ドラッグ = pan」に依存するが、**今回スマホは対象外**なので影響を考慮しない (将来 §7)。

---

## 3. 技術方式 (How)

### 3.1 中核アイデア: CSS変数 + calc、React 再描画を通さない

カードを1枚ずつ動かさない。既存の**3つの層ラッパーの transform に「掴みズレ量」を足すだけ**。

掴み移動量を CSS変数 `--grab-x` / `--grab-y` (px) に入れ、各層の transform が `calc()` で読む。層ごとに**静的な重み**を掛けて奥行きを作る。

```
--grab-x, --grab-y  … 掴みの基準ズレ量 (rubber-band 済み)。素の状態では 0。
```

各層 (BoardRoot の該当 wrapper) の transform を拡張:

```
/* 羊皮紙 (背景) : 現状 translate3d(-viewport.x, -viewport.y + paperParallaxY, 0) */
translate3d(
  calc(${-viewport.x}px + var(--grab-x, 0px) * 0.28),
  calc(${-viewport.y + paperParallaxY}px + var(--grab-y, 0px) * 0.28),
  0)

/* 散布シミ (中間) : 重み 0.55 */
/* カード (手前) : 重み 1.0 — 全テーマ共通 */
```

- 重み: **カード 1.0 / 散布 0.55 / 羊皮紙 0.28** (初期値・実機で微調整)。手前ほど大きく動く = 掴んだ面が一番ついてくる自然な視差。
- default はカード層だけがこの calc を持つ (羊皮紙/散布層は未マウント)。→ 平らなズレ。
- `--grab-x/y` を container の ref に**直接書き込む** (React state を経由しない) ので、掴み中・バネ戻り中も**再描画ゼロ・60fps**。既存 transform 合成に乗るだけなので **4K 負荷はスクロールと同等** (カード再生成なし)。
- **default byte-identical**: 素の状態では `--grab-x/y = 0` (未設定フォールバック `0px`) なので calc の加算項が 0 → transform 文字列の**評価結果は従来と一致**。CSS変数は paper/default 共通の calc に足すだけで、静止レンダリングは変わらない。

> `calc()` は `var(...) * 数値` を受け付ける (CSS Values Level 3)。`translate3d(calc(...), calc(...), 0)` も有効。

### 3.2 rubber-band (純関数)

```
新規: lib/board/rubber-band.ts

/** 引くほど重くなり ±limit に漸近する抵抗曲線。
 *  小さい delta ではほぼ素通し (自然な追従)、大きい delta で頭打ち。 */
export function rubberBand(delta: number, limit: number): number {
  return limit * Math.tanh(delta / limit)
}
```

- `rubberBand(0, L) = 0` / 単調増加 / `|結果| < limit` (厳密) / 符号保存 (左右対称) / 小入力は ≈ delta。
- 上限 `limit = MAX_GRAB_PX = 90` (基準ズレ量に適用。各層は重み倍後なのでカード ~90 / 散布 ~50 / 羊皮紙 ~25)。

### 3.3 spring-back (GSAP)

離した時、`--grab-x/y` を GSAP で 0 へ tween:

```
gsap.to(grabState, {
  x: 0, y: 0,
  duration: 0.7,               // 初期値
  ease: 'elastic.out(1, 0.4)', // わずかにオーバーシュート "ぷるっ"
  onUpdate: () => writeVars(grabState.x, grabState.y),
})
```

- ズレ量 (`--grab-*`) とスクロール (viewport, React state) は**別チャネル**。戻り途中にホイールしても transform 上で加算合成されるだけで喧嘩しない。
- 掴み再開時は走行中の tween を kill。

### 3.4 ファイル構成

| ファイル | 役割 |
|---------|------|
| `lib/board/rubber-band.ts` (新規) | `rubberBand` 純関数 + 定数 (`MAX_GRAB_PX`, 層重み) |
| `lib/board/rubber-band.test.ts` (新規) | 純関数の単体テスト |
| `components/board/use-grab-wiggle.ts` (新規) | 掴み状態管理 / CSS変数書き込み / GSAP バネ / reduced-motion gate。container ref を受け取り `--grab-x/y` を設定。掴み中/バネ中フラグを返す |
| `components/board/InteractionLayer.tsx` (改修) | 「素の左ドラッグ×余白」を wiggle に分岐 (中ボタン/Space/reduced-motion は現状維持) |
| `components/board/BoardRoot.tsx` (改修) | 3層 wrapper の transform を `calc(... + var(--grab-*)*重み)` に拡張。`useGrabWiggle` を配線 |

### 3.5 カーソル affordance

余白 hover 時 `cursor: grab`、掴み中 `cursor: grabbing` (wiggle 有効時のみ)。既存の InteractionLayer style に条件付与。

---

## 4. エッジ / 誤操作防止

- **クリック (移動なし)** → ズレ量 ~0 のまま離す → バネは 0→0 = 無変化。閾値不要。
- **カード/chrome の上** → `e.target !== e.currentTarget` で従来どおり無視 (wiggle 非発動)。
- **掴み中にウィンドウ外へ** → pointercancel / pointerup で spring-back 発火。
- **掴み中に別テーマ切替** → wiggle 継続中でも、テーマ変更は静止 transform を差し替えるだけ。念のため切替時に tween kill + 変数リセット。
- **reduced-motion** → wiggle を engage せず、InteractionLayer 既存のスクロールにフォールバック。

---

## 5. テスト / 検証

- **自動 (単体)**: `rubberBand` を網羅 (0/単調/上限/符号/小入力素通し)。
- **回帰 (default 無傷)**: 掴んでない静止時、3層 transform の評価結果が従来一致 (playwright で `getComputedStyle` 実測、default/paper 両方)。`tsc0 / vitest / build` を deploy 前に通す。
- **手動 (実機・ユーザー)**: 掴みドラッグは `setPointerCapture` を使うため **playwright 合成ポインタでは発火しない** (既知 = memory `reference_board_card_click_pointer_capture`)。実際の「掴んで→離してぷるっ」の触感は allmarks.app デプロイ後に**ユーザーが実機確認** → 重み/上限/ease を数値で寄せる。
- **アクセシビリティ**: OS「視差を減らす」ON でスクロールにフォールバックすることを確認。

---

## 6. 数値まとめ (すべて初期値・実機で微調整)

| 定数 | 初期値 | 意味 |
|------|--------|------|
| `MAX_GRAB_PX` | 90 | 基準ズレ量の上限 (rubber-band limit) |
| 重み: カード | 1.0 | 手前層 (全テーマ) |
| 重み: 散布シミ | 0.55 | 中間層 (paper) |
| 重み: 羊皮紙 | 0.28 | 奥層 (paper) |
| バネ duration | 0.7s | spring-back |
| バネ ease | `elastic.out(1, 0.4)` | わずかにオーバーシュート |

---

## 7. 今回やらないこと (Out of scope / 将来)

- **スマホ (タッチ)**: 今回対象外。将来「ボード**長押し** → 同じ掴み遊び (long-press でモード入り、ドラッグで wiggle)」を別タスクで追加。タッチの「素ドラッグ=スクロール」は温存する設計になる (今回のデスクトップ置換とは別分岐)。
- **default 用の奥行きモチーフ**: 今回 default は「平らなズレ」で割り切る。将来、音波背景などを奥で動かして default にも立体感を足すのは別タスク (静止見た目は変えない前提)。
- **横方向の実パン化**: 掴みは spring-back の遊び専用。長距離を掴んで移動 (実スクロール化) はしない。
