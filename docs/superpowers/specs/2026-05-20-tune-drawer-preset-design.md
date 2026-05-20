# TUNE drawer 物理ボタン preset (J) — 設計仕様

> **状態**: design approved (= 2026-05-20 session 60、 user 承認済)
> **着手予定**: session 60 内に実装 → ship
> **関連 memory**: `project_theme_sound_wave.md` / `feedback_layman_simple_path.md` / `project_pill_visual_language.md`
> **関連 IDEAS**: [docs/private/IDEAS.md §J](../../private/IDEAS.md) (= 元 brainstorming)

---

## 1. 概要

TUNE drawer (= `components/board/TuneTrigger.tsx`) に **5 個の preset 行**を縦並びで追加する。 各 preset は (カード幅 W、 ギャップ G) の組み合わせをワンクリックで適用する物理スイッチ風 UI。 Yamaha AG03 ミキサーの**ラッチング・トグルスイッチ**を視覚 reference とし、 現在 active な preset は**ずっと凹んだ位置で固定**される。 LED は state mirror として「今 W/G が preset と一致してるか」 を反映する。

## 2. 動機

- 現状の TUNE drawer は W/G スライダー 2 本のみ。 user が「DENSE な見え方が欲しい」 と思った時に毎回スライダーを 2 本動かす必要がある
- preset があれば「DENSE / TIGHT / DEFAULT / OPEN / AMBIENT」 の 5 段階のうち**ワンクリック**で典型値に snap できる
- 同時に AllMarks の音波 motif theme (= `project_theme_sound_wave.md`) と AG03 ミキサー UI 語彙が結合、 「サウンドミキサーで board を tune する」 という世界観の中核体験になる

## 3. レイアウト

TUNE drawer を**2 列構成**に変更:

```
┌─ TUNE drawer ────────────────────────────────────┐
│   267.84 · 97.21 · DEFAULT                        │  ← 既存 readout (= 不変)
├──[ 左列 = preset ]──[ 右列 = 既存 ]───────────────┤
│  ● DENSE                                          │
│                          │      │                 │
│  ● TIGHT                ●       ●                 │  ← 既存 W/G slider (= 不変)
│                         ║       ║                 │
│  ● DEFAULT             ║       ║                 │
│                         ║       ║                 │
│  ● OPEN                ║       ║                 │
│                          │      │                 │
│  ● AMBIENT               W      G                 │
│                                                   │
│  ┌─────────────┐                                 │
│  │             │   · DRAG TO TUNE                 │
│  │ ALLMARKS    │   · SHIFT FOR FAST               │  ← 既存 opsLegend (= 不変)
│  │  MK-1       │   · CLICK TO JUMP                │
│  │             │   · CTRL+Z UNDO                  │
│  └─────────────┘   · CTRL+SHIFT+Z REDO            │
└───────────────────────────────────────────────────┘
```

- 既存の `styles.faderGroup` (= W/G slider) と `styles.opsLegend` (= hint) は**右列に集約**、 中身一切変更なし
- **左列**は新規追加: 上から「5 個の preset 行」 + 「ALLMARKS MK-1 プレート」 を縦に並べる
- drawer の幅は左列分だけ増える (= 既存幅 + 左列幅 ~150px 程度)

## 4. preset 値 (= 5 段階)

| 順 (上→下) | ラベル | W (= カード幅 px) | G (= ギャップ px) |
|---|---|---|---|
| 1 | DENSE | 207.80 | 23.21 |
| 2 | TIGHT | 220.03 | 65.70 |
| 3 | DEFAULT | 267.84 | 97.21 |
| 4 | OPEN | 412.74 | 62.38 |
| 5 | AMBIENT | 607.56 | 147.87 |

- 値は user が自分の環境 (= 1489 CSS viewport) で「列数の境目ギリギリ手前」 を狙って tune 済
- DEFAULT 値は既存 `BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX` / `CARD_GAP_DEFAULT_PX` (= `lib/board/constants.ts:128-131`) と完全一致 (= 既存 reset 動作と整合)
- 全 5 個の (W, G) は互いに異なる組み合わせ (= 同時に複数 LED が点灯することはない)
- 値は新規 constants に定義する (= `lib/board/constants.ts` 内 or 新規 `lib/board/tune-presets.ts`)

## 5. 視覚仕様 (= ラッチング・トグルスイッチ feel)

### 状態 2 種

**(A) Inactive = 浮いてる (= raised)**

- 行 box が 1-2 px 浮き上がってる視覚
- 上端ハイライト: `inset 0 1px 0 rgba(255,255,255,0.08)` (= 上から光反射)
- 下方向 drop shadow: `0 2px 0 rgba(0,0,0,0.5)` (= 箱の下に影)
- background: 暗灰グラデーション `linear-gradient(180deg, rgba(40,40,44,1) 0%, rgba(28,28,32,1) 100%)`
- LED OFF: 暗灰 `rgba(255,255,255,0.15)`
- ラベル色: 暗灰 `rgba(255,255,255,0.55)` 程度

**(B) Active = 凹んでる (= recessed、 押し込まれて固定)**

- 行 box が 1-2 px 下がった位置に固定 (= `transform: translateY(2px)`)
- 上端ハイライト消える (= 光当たらない)
- 内側 shadow: `inset 0 2px 4px rgba(0,0,0,0.6)` (= 凹んで影落ちる)
- background 微妙に暗く: `rgba(20,20,22,1)` 程度
- LED ON: 緑 `rgba(74,222,128,0.98)` + 3 段 drop-shadow halo (= ✓ pill と同レシピ)
  - 1 段目: `0 0 3px rgba(134,239,172,0.95)`
  - 2 段目: `0 0 6px rgba(74,222,128,0.65)`
  - 3 段目: `0 0 12px rgba(34,197,94,0.4)`
- ラベル色: 白 `rgba(255,255,255,0.95)`

### 状態遷移 (= シーソー切り替え)

別の preset を click した時:

1. 元の active 行: `translateY(2px) → 0` で raise (= 150ms ease-out)、 LED OFF (= 80ms snap)
2. 新しい active 行: `translateY(0) → 2px` で press (= 150ms ease-out)、 LED ON (= 80ms snap)
3. W/G slider は GSAP tween で 200ms かけて preset 値に snap (= 既存 slider の値更新で発火)

両方同時に animate するので、 user 視点では**シーソーが切り替わった感**が出る。

### ホバー時 (= まだクリックされてない inactive 行)

- 上端ハイライトが微妙に強くなる: `inset 0 1px 0 rgba(255,255,255,0.14)`
- カーソル `pointer`
- 「クリック待ち」 感を弱く伝える

### 全 preset が一致しない状態 (= "no preset" 状態)

- user が手で slider を動かして preset 値からずれた瞬間
- **全 5 行が raised 状態**、 LED 全 OFF
- これは現在 W/G が `267.83` 等の preset と微妙にずれた値の時に発生

### 各行のサイズ

- 高さ: 28 px (= 既存 opsRow と同程度に揃える)
- 幅: 左列幅に合わせて伸縮 (~120-140 px)
- 行間 (margin): 6-8 px
- padding: 上下 4 px / 左右 12 px
- border-radius: 6 px

### ラベル text

- font-family: monospace (= 既存 chrome と同じ)
- font-size: 11 px
- letter-spacing: `0.08em`
- font-weight: 600
- text-align: left
- LED dot (= 8×8 px、 行内左端) → 12 px の gap → ラベル text

## 6. ALLMARKS MK-1 プレート

- 左列の preset 5 行の下に配置 (= 余ったスペース)
- 文字: `ALLMARKS` (上段) + `MK-1` (下段) の 2 行、 または `ALLMARKS · MK-1` の 1 行 (= 実装時に視覚バランスで選ぶ)
- font-family: monospace
- font-size: 9-10 px
- color: 控えめ暗灰 `rgba(255,255,255,0.25)` 程度 (= 装飾なので主役を食わない)
- letter-spacing: `0.12em`
- 刻印 / etched 風: `text-shadow: 0 1px 0 rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.05)` (= 上下のコントラストで掘られた感)
- background: 暗灰の rectangle (= プレート風)、 border-radius 4 px、 微妙な border `1px solid rgba(255,255,255,0.04)`
- インタラクション: なし (= 完全装飾、 click 不可、 hover 効果なし)

## 7. LED 挙動 (= 状態の鏡)

- W と G が **preset 値と ±0.5 px 以内で一致**してる時、 該当 LED 緑点灯
- 一致しないなら全 LED 暗灰
- 同時に複数点灯することはない (= preset 値は互いに異なる)

### tolerance の理由

float 演算と GSAP tween の精度問題で `267.84` を厳密に再現できない可能性がある。 `267.839` や `267.841` でも DEFAULT と認識するため ±0.5 px の許容を持たせる。

### 一致判定 logic (= 疑似 code)

```ts
function findActivePreset(w: number, g: number): PresetId | null {
  for (const preset of PRESETS) {
    if (Math.abs(w - preset.w) <= 0.5 && Math.abs(g - preset.g) <= 0.5) {
      return preset.id
    }
  }
  return null
}
```

### 適用タイミング

- TuneTrigger render 毎に算出 (= 既存 widthPx / gapPx props から)
- preset click → W/G が GSAP tween で snap → render → 一致判定 → LED 点灯
- 手で slider 動かして preset 値からずれた瞬間 → render → 一致しない → LED 消える
- board reload 時も IDB から復元された W/G で初回 render → 一致判定 → 該当 LED 点灯した状態で立ち上がる

## 8. preset click 動作

```
user click → preset row が active 表示に切り替え (= CSS transition 150ms)
           → setWidth(preset.w) + setGap(preset.g) を呼ぶ
           → slider が GSAP tween で 200ms 経過後 snap
           → LED 一致判定で点灯 (= 既に CSS で active 視覚は表示済)
           → undo entry 1 個 push (= W と G の delta を同時に保持)
```

### 同じ preset を再 click した場合

- 既に active な preset を再 click → 何もしない (= W/G 既に一致、 undo entry も追加しない)
- 視覚的にも変化なし

## 9. Undo 統合

- preset クリック = **1 個の undo entry** (= [pushBounded](../../../lib/board/undo.ts) に乗せる)
- Ctrl+Z 1 回で「preset 適用前の W と G が同時に元に戻る」
- entry 構造: 既存 entry type に **W/G 両方の before/after を持つ新 type** を追加する
  - 既存 type (= cardWidth slider drag) は W のみ保持
  - 既存 type (= cardGap slider drag) は G のみ保持
  - 新規 type (= preset apply) は W + G 両方
- Ctrl+Z での復元: 新 type の entry を pop → before W と before G を同時に setWidth / setGap
- redo (= Ctrl+Shift+Z) も対称的に動作

### debounce

- 既存 slider drag の debounce (= 500ms) は preset click には適用しない (= 単発 event)
- preset click は即座に undo entry push

## 10. 多言語

- ラベル文字 (= DENSE / TIGHT / DEFAULT / OPEN / AMBIENT / ALLMARKS MK-1) は**全 15 言語共通の英語固定**
  - 理由: chrome 語彙ルール (= memory `feedback_ui_vocabulary.md`)
- aria-label のみ各言語化: 例
  - DENSE: 「DENSE: ぎゅっと詰まったレイアウト」 (ja) / 「DENSE: tightly packed layout」 (en)
  - 15 言語ファイル (`messages/{lang}.json`) に新 key 追加

## 11. アクセシビリティ

- preset 行は `<button type="button">` 要素として実装
- `role="radiogroup"` を 5 行の親に付与 (= 5 個から 1 個選ぶ exclusive group)
- 各行は `role="radio"` + `aria-checked={isActive}` (= 既に CSS で表現済の active 状態を assistive tech にも伝える)
- キーボード: Tab で group に入り、 ↑↓ で行間移動、 Space / Enter で apply
- focus ring: 既存 chrome focus と同レシピ (= 微妙な外側 outline)

## 12. テスト

### vitest unit

- `PRESETS` 定数: 5 個、 W/G が範囲内 (= 120-720 / 0-300)、 互いに異なる組
- `findActivePreset(w, g)`: 
  - ぴったり一致 → 該当 preset id
  - ±0.5 px 以内 → 該当 preset id
  - ±0.51 px 外 → null
  - 全 5 preset を入力 → 全部対応する id 返す
- preset click → undo entry が 1 個 push される、 entry 内容に W と G 両方含む
- Ctrl+Z → W と G 両方が before 値に戻る

### 既存テスト維持

- 既存の `TuneTrigger.test.tsx` / `FaderColumn.test.tsx` は全部 PASS
- 633 PASS の現状を維持

### 視覚回帰 (= 手動確認)

- TUNE drawer 開く → 5 個の preset 行が表示
- 現在の W/G が DEFAULT 値 (= 267.84 / 97.21) なら DEFAULT 行が active 表示
- DEFAULT 行 click → 何も起きない (= 既に active)
- DENSE 行 click → DEFAULT 行が浮き上がる、 DENSE 行が押し込まれる、 W/G が 207.80 / 23.21 に snap
- W slider を手で動かす → DENSE 行が浮き上がる (= "no preset" 状態)
- Ctrl+Z → 直前の preset 状態に戻る

## 13. ファイル変更 (= 想定範囲)

| ファイル | 変更内容 |
|---|---|
| `lib/board/constants.ts` (or 新規 `lib/board/tune-presets.ts`) | `PRESETS` 定数定義、 5 個の (id, label, w, g) |
| `components/board/TuneTrigger.tsx` | drawer 内に**左列**追加、 preset 行 + プレート、 click handler + LED 一致判定 |
| `components/board/TuneTrigger.module.css` | 左列 style、 preset 行 raised/active、 LED glow、 プレート |
| `lib/board/undo.ts` | 新 entry type 追加 (= preset apply で W/G 両方を保持)、 既存 push / pop logic に統合 |
| `messages/{15 言語}.json` | preset の aria-label 翻訳 key 追加 |
| `components/board/TuneTrigger.test.tsx` | preset 関連 test 追加 |

## 14. スコープ外 (= この設計に含めない)

- I (= 背景 AllMarks 文字グリッチ) は別 brainstorming + 別仕様 doc
- 「カチッ」 効果音 (= IDEAS.md にあったが、 audio feedback は本設計では実装しない、 将来検討)
- mobile (= touch) 専用挙動 (= 既存 TUNE drawer が desktop only と仮定、 必要なら別 sprint)
- preset 値の user カスタマイズ (= options ページで自分 preset を保存、 など。 将来検討)
- preset 名の自由編集 (= label が user 変更可能、 将来検討)

## 15. 関連 reference

- IDEAS.md §J (= 2026-05-19 session 50 user 発案、 AG03 reference の元 brainstorming)
- IDEAS.md §H (= スライダー本体 redesign 5 案、 完全相補的だが別 sprint)
- memory `project_theme_sound_wave.md` (= AllMarks 音波 motif theme 確定)
- memory `project_pill_visual_language.md` (= ✓ 緑 / glow halo の visual language)
- memory `feedback_layman_simple_path.md` (= user の縦並び案が私の水平 row 案より良かった事例、 session 60 で再確認)
- session 50 で session 確立済 cursor pill ✓ の 3 段 drop-shadow halo recipe (= LED glow に流用)

---

## 承認状態

- [x] 設計コンセプト確定 (2026-05-20 session 60 user 承認)
- [x] 5 個の preset 値確定 (= user tune 済)
- [x] ラベル確定 (= DENSE / TIGHT / DEFAULT / OPEN / AMBIENT)
- [x] LED state mirror 挙動 ± 0.5 px tolerance
- [x] レイアウト確定 (= 2 列、 縦並び 5 preset + プレート)
- [x] ラッチング・トグルスイッチ視覚 (= 凹みっぱなし固定)
- [x] プレート文字 = `ALLMARKS MK-1`
- [ ] 実装 plan (= writing-plans skill で作成、 別ファイル)
- [ ] 実装 + ship + user 検証
