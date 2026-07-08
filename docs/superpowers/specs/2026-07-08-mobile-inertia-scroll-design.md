# スマホ盤面：慣性スクロール ＋ 上部タップで先頭へ ＋ テキストカード内部スクロール停止 — 設計

- 日付: 2026-07-08 / セッション179
- ゴール: スマホ盤面スクロールを業界標準の手触りにする。加えて (2) 上部帯タップで先頭へ戻る、(3) 盤面テキストカードの内部スクロールを止めてスワイプを必ず盤面パンへ向ける。
- 前提調査: 本セッションの Explore 3本（モバイルスクロール実装／ライトボックスモーフ／viewport.y 依存の全洗い出し）＋ 業界標準物理リサーチ2本（ネイティブOS／JSライブラリ）。すべて行番号・出典付き。

---

## スコープ / 非目標

- **すべて `isMobile`（`MOBILE_BP_PX = 640`）ゲート。デスクトップ経路は1行も変えない。** 具体的に温存する経路: PCホイール→`InteractionLayer` バネ物理→`handleScroll`（BoardRoot.tsx:1149-1163）、並べ替えドラッグのエッジオートスクロールが共有する `handlePanY`（BoardRoot.tsx:1169-1183）。
- **非目標(A)**: ネイティブ `overflow` スクロールへの全面移行（別調査の「(b)案」）。今回は既存の JS パン方式のまま慣性を足す「(a)案」。理由: (b) は touch-action の二重掛け解除・自前タップ/スクロール判別の作り直し・パララックス/深リンク追従など中〜大規模＋高リスク。将来 (a) で物足りなければ (b) を別セッションで。
- **非目標(B)**: ライトボックスのテキストスクロール。③は盤面カード（PlaceholderCard）のみが対象、ライトボックスの本文（DefaultText）は不変。
- **非目標(C)**: 今回はスマホ（≤640px）のみ。タブレット拡張（ブレークポイント引き上げ）は将来判断。

---

## ① 慣性スクロール（業界標準を模倣）

### 現状（確定）
`handleMobilePointerDown`（CardsLayer.tsx:1050-1105）が pointerdown → `window` の pointermove を購読 → `onPanY(-dyStep)` を都度呼ぶ「1:1追従」。`end`（:1086-1095）に速度計算・減速ループが**無い**＝指を離すと即停止。これが「慣性が無い」の直接原因。

### 変更
1. **速度サンプリング**: `move` 中に各 pointermove の `(clientY, timestamp)` を短いリングバッファ（直近 ~100ms）に記録。
2. **初速算出**: `pointerup` で直近サンプルから初速 `v0`（px/ms）を算出。直近 50〜100ms の Δy/Δt。`pointerup` 直前 32ms 以内に pointermove が無い場合は速度計算をスキップ（use-gesture の実務補正）。
3. **慣性ループ**: `v0` が最小しきい値以上なら自前 `requestAnimationFrame` ループを開始し、連続指数減衰で流す。
4. **スマホ専用の位置更新経路を新設**（`handlePanY` はデスクトップ共有なので触らない）。端で rubber-band 表示（クランプ外の一時オフセット）を許すため、モバイル用のオーバースクロールを扱える小さな追加 state を持つ。
5. **中断**: 慣性ループ中に新しい pointerdown が来たら即座にループを停止（ネイティブと同じ「触ったら止まる」）。

### 業界標準パラメータ（出典付き・すべて定数で外出しして実機調整可能に）

| 項目 | 値 | 出典 |
|---|---|---|
| 減衰モデル | 連続指数減衰 `pos(t) = target - amplitude · exp(-t/τ)` | Framer Motion inertia.ts / ariya.io（frame-rate 非依存） |
| amplitude | `power · v0`（power = 0.8） | Framer Motion default |
| τ (timeConstant) | 325ms | Framer Motion default ＝ Apple 実測（1フレーム16.7msごと0.95倍）と数学的に一致 |
| 停止位置予測 | `X_final = x0 − v0/ln(d)` ≈ `v0 · d/(1−d)`（d = 0.998） | WWDC 2018「Designing Fluid Interfaces」project 関数 |
| rubber-band（端の抵抗） | `dist · dim · c / (dim + c · dist)`（c = 0.15） | @use-gesture maths.ts / aholachek（独立に同値＝Apple 由来） |
| 端の戻り（離した後） | spring `stiffness = 500`, `damping = 10` | Framer Motion createSpring |
| 停止しきい値 | 残り 0.5px | Framer Motion restDelta |
| 時間上限（保険） | 6·τ ≈ 1950ms | ariya.io（6·timeConstant で目標の0.25%以内） |
| 最小フリング速度 | **未確定（実機調整）** | 一次情報の確定値なし。Swiper のモメンタム発動 0.02px/ms を参考に実機で詰める |

補足（iOS `DecelerationRate.normal = 0.998` は「1msあたりの速度倍率」＝実測値。公式ドキュメントには数値記載なし＝コミュニティ実測の業界公認値）。

### 純ロジック `lib/board/momentum-scroll.ts`（TDD で先に書く）
純関数（副作用なし・テスト可能）:
- `estimateVelocity(samples: {y:number; t:number}[]): number` — 直近窓から v0(px/ms)。32ms 補正込み。
- `projectEndPosition(current: number, v0: number, decel?: number): number` — 停止位置予測。
- `momentumOffset(elapsedMs: number, amplitude: number, tau: number): number` — その時刻の減衰オフセット。
- `rubberband(distance: number, dimension: number, c?: number): number` — 端の抵抗量（デフォルト c=0.15）。
- `springStep(pos: number, vel: number, target: number, stiffness: number, damping: number, dtMs: number): {pos:number; vel:number}` — 戻りバネの1ステップ。
- `hasSettled(pos: number, target: number, restDelta?: number): boolean`。

定数（同ファイル or constants に外出し）:
```
MOMENTUM = {
  POWER: 0.8, TAU_MS: 325, DECEL: 0.998,
  RUBBERBAND_C: 0.15, SPRING_STIFFNESS: 500, SPRING_DAMPING: 10,
  REST_DELTA_PX: 0.5, MAX_MS: 1950,
  MIN_FLING_VELOCITY: /* 実機調整・暫定 0.05 px/ms */,
  VELOCITY_WINDOW_MS: 100, PU_IGNORE_MS: 32,
}
```

### 配線
- `CardsLayer.tsx` の `handleMobilePointerDown` を改修（この関数は isMobile 分岐でしか呼ばれない＝デスクトップ非影響）。`move` でサンプル記録、`end` で慣性ループ起動。
- 慣性ループ／rubber-band は**モバイル専用ドライバ**が既存の位置更新を駆動。rubber-band 表示（viewport.y のクランプ外表示）のため、モバイル用の overscroll オフセット state（例: `mobileOverscrollY`）を BoardRoot に追加し、カード群 transform（BoardRoot.tsx:3048）へ `isMobile` 時だけ加算。デスクトップは常に 0。

---

## ② 上部帯タップ → 先頭へ

- `BOARD_TOP_PAD_PX = 80`（constants.ts:25）の上部帯に、`isMobile` 時だけ透明タップ領域を置く。左上ロゴ（BoardChrome, `href="/"`）・右上 FILTER（`.mobileTopFilter`）を避ける。
- タップで**先頭（y=0）へスムーズスクロール**: 既存の `handleScrollMeterJump`（BoardRoot.tsx:1198-1243, rAF アニメ）相当を target y=0 で呼ぶ。新規アニメは書かない。
- カードのタップと競合しないよう、上部の細い帯（ロゴ/FILTER のバンド高さ）に限定。z-index はカードより上・ロゴ/FILTER ボタンより下。
- **デスクトップは対象外**（ホイール＋スクロールメーターで先頭に戻れる。上部空白クリックは誤爆リスクのため入れない）。

---

## ③ テキストカード内部スクロール停止（盤面のみ・スマホのみ）

- **対象**: 盤面の文字カード `PlaceholderCard` の `.titleScroll`（PlaceholderCard.module.css:74-87 `overflow-y: auto`）。ここがスマホで「カード内が動く」箇所。
- **変更**: `isMobile` 時、盤面の `.titleScroll` を `overflow: hidden`（＋ `touch-action` を盤面パンへ委譲）にしてスワイプを必ず盤面パンへ。
- **ライトボックス非影響**: ライトボックス本文は `DefaultText`（別実装）で対象外。`PlaceholderCard` がライトボックスでも使われる場合は、盤面スコープ（`CardsLayer` 配下の data 属性 / クラス）でのみ効かせる。実装時に `PlaceholderCard` の使用箇所を Grep で確認して担保。
- ユーザー確定方針: 「スマホ時はライトボックス以外でテキストカードのスクロール機能そのものを止める」。

---

## テスト / 検証

- `momentum-scroll.ts` の純関数を vitest（減衰・停止位置予測・rubber-band・spring・settled・速度推定）。
- 滑らかさ・跳ね返り・先頭戻りは**実機**（CDP 合成タッチは1ドラッグ=pointermove1回のみで計測不可＝memory `reference_playwright_board_share_verify`）。全パラメータを定数外出しし、実機でユーザーが微調整できる形にする。
- tsc 0 / vitest 全緑 / クリーンビルドを満たしてからデプロイ。

## リスク

- rubber-band 表示に viewport.y のクランプ外表示が要る＝小規模な追加 state。`isMobile` 分岐でデスクトップ非影響を厳守。
- ③は `PlaceholderCard` の使用箇所（盤面／ライトボックス）を実装時に確認し、ライトボックス非影響を担保。
- 最小フリング速度・跳ね返り強度は一次情報の確定値がなく実機調整前提（定数外出しで対応）。
