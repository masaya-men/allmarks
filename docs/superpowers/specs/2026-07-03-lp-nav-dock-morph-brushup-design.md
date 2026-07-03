# N-05 ブラッシュアップ — 変身を3段直列にする（乗り切る → その場で変身 → ダッシュ）

- 日付: 2026-07-03（セッション 156）
- 状態: ユーザー承認済みの設計。実装は plan 参照
- 前提: N-05 本体は s155 で出荷済み（spec `2026-07-03-lp-nav-dock-design.md` / master `b0d81a6`）。本書はその演出面の作り直し

## 1. 背景（ユーザー実機フィードバック）

スクロール判定・着地位置は OK。ただし現行は「帯に乗ったあとスクロール量に連動して**徐々に**フォントが変わり、ダッシュ中にフォントファミリーがこっそり切り替わる」構成で、変身の瞬間が知覚できない。これを**時間軸で分離した3段直列**に変える:

1. **乗り切る** — kicker がガラス帯に1文字ずつ乗り上がる（現行どおり）。乗っている間は**本文の姿のまま**（スクロール連動モーフは廃止）
2. **その場で変身** — ナビ文字と同じ高さに達したらその場で止まり、**左から右へ1文字ずつ衣装替え**（沈む→ナビのフォント姿で起き上がる）。スクロールとは独立した時間制アニメ
3. **ダッシュ** — 変身完了後、右へダッシュして**元からあるナビ文字の位置に寸分違わず**バウンド着地。最終形＝元のナビのフォント・場所そのまま＋**緑の玉だけが足された状態**

## 2. 状態機械（純関数層 `lib/scroll/nav-dock-math.ts`）

`DockMode` に **`morphing`** を1段追加: `armed → traveling → morphing → docked`。

| 遷移 | 条件 | 備考 |
|------|------|------|
| armed → traveling | `morphProgress(anchorTop) > glassOnAt` | 現行どおり（乗り上がり開始） |
| traveling → morphing | `anchorTop <= dockY` | **現行の traveling → docked を置き換え**。範囲判定なので Lenis の大ジャンプでもすり抜けない |
| morphing → docked | **タイマーのみ**（変身完了 = `morphTotalMs(文字数)` 経過） | スクロールでは進まない。純関数は morphing を維持し、コンポーネントのタイマーが docked へ進める |
| morphing → traveling | `anchorTop >= dockY + releaseGap` | 変身キャンセル（§4）。docked の解除と同じヒステリシス |
| docked → traveling | `anchorTop >= dockY + releaseGap` | 現行どおり |
| traveling → armed | `anchorTop > glassStart + restGap` | 現行どおり |

- `morphProgress` は**帯進入判定（glassOnAt との比較）専用**になる。CSS の `--mp` スクラブには使わない
- 新純関数 `morphTotalMs(charCount)` = `(charCount - 1) * morphCharDelayMs + morphCharMs`（ラベル長で変身時間が決まる。テスト対象）
- `NAV_DOCK` 追加定数（初期値・実機チューニング前提）:
  - `morphCharDelayMs: 30` — 衣装替えの1文字ごとの遅延
  - `morphCharMs: 240` — 1文字の沈み→起き上がり全体
  - `morphCancelMs: 180` — キャンセル時の一斉逆戻し
  - `morphAlignMs: 120` — 凍結位置への寄せ（§3）

## 3. 変身フェーズの挙動（`NavDockTraveler.tsx` / `.module.css`）

**凍結**: morphing 進入時に anchor 追従を止め、`left = anchor の left`（横は動かさない）、`top = target（ナビスロット）の top`（ナビの行に高さを揃える → ダッシュが純横移動になる）。Lenis の大ジャンプで直前フレームから位置が飛んでいても、`morphAlignMs` の短い transition で滑らかに寄せる。

**衣装替えの波**（左→右、文字 i は `i * morphCharDelayMs` 開始）:

- 前半 `morphCharMs / 2`: 文字が少し沈む（`translateY(3px)` + 減光）
- 折り返し時点: JS がその文字の span に swap 印（data 属性）を立て、**font-family をナビの書体へ切替**（ファミリーは補間不能なので、沈みの底で掛け替えて知覚をずらす）
- 後半 `morphCharMs / 2`: ナビ姿で起き上がる（`translateY(0)` + 復光）
- 実装は**既存の乗り上がりと同じ「transition + class 切替」方式**（CSS keyframe アニメは使わない。キャンセル時に transition で滑らかに巻き戻すため）。タイミングは JS のタイマーで刻む

**語全体の寸法モーフ**: `--mp` を 0→1 に反転し、`font-size`（12→14px）/ `letter-spacing`（0.2→0.06em）/ `font-weight`（500→450）/ `gap`（9→8px）に `morphTotalMs` の transition を掛けて波と並走させる（custom property の変化でも実プロパティの transition は発火する）。緑玉は両姿共通なのでそのまま。

**完了**: `morphTotalMs(文字数)` 経過 → 既存 `toDocked()`（zip 460ms・バウンド easing）へ。docked の見た目は現行どおり = ナビスロットと 0px 一致。

**タイマー管理**: s155 の教訓を踏襲 — settle/morph タイマーの満了時は**現在の mode を反映**し状態を巻き戻さない。mode が morphing を離れるときは必ず全タイマー clear。

## 4. 逆スクロール（可逆性）

- **morphing 中にキャンセル**（`anchorTop >= dockY + releaseGap`）: 全文字**一斉**に `morphCancelMs` で本文の姿へ逆戻し（swap 印を全部剥がす・`--mp` を 0 へ・transition は短い一律値）、mode は traveling に戻して anchor 追従を再開
- **docked からの復帰**: 現行どおり（`returnMs` で本文へ帰る）。帰り道の途中の姿は現行と同じく本文形へ戻す（`--mp` 0 へ）
- **traveling → armed**: 現行どおり（実 kicker 表示に戻す）

## 5. CSS の変更点

- `NavDockTraveler.module.css`:
  - スクロール連動スクラブ前提のコメント・構造を時間制に書き換え
  - `data-state='morphing'` の word に寸法 transition、文字に dip/swap の transition 定義
  - swap 印付き文字の `font-family: var(--lp-sans)` 上書き（docked では word 全体が sans になり冗長化＝現行どおり）
- `landing-tokens.css`: 本文 kicker を隠すセレクタに `html[data-nav-dock='morphing']` を**追加**（隠しっぱなしの対象は traveling / morphing / docked の3値になる）
- `SiteHeader.module.css`: **変更なし**（`html[data-nav-dock]` は値不問セレクタのため morphing でもスロット切替はそのまま効く）

## 6. 変えないもの（不変条件）

- 発動条件 `isDockEligible`（reduced-motion オフ / >960px / kicker＝ナビ語。13言語自動オフ・en/ja のみ有効）
- SSR/prerender は無属性＝従来表示のまま（属性は mount 後にのみ書く）
- ダッシュ（zip）・帰還（return）の時間と easing
- 本文 kicker / ナビ実ラベルの HTML 構造（per-char の swap 印は traveler 内部のみ）
- LP の他ページ・トップ LP・ボード本体には非接触

## 7. テストと検証

- `nav-dock-math.test.ts` に追加: morphing の全遷移（進入・キャンセル・維持・大ジャンプ）、`morphTotalMs` の計算、既存テストの traveling → docked 直行を traveling → morphing に更新
- `rtk tsc && rtk vitest run && rtk pnpm build` 緑で deploy（vitest は dev サーバー並走禁止）
- dev で Playwright 実測: ①乗り上がり中に font-size が 12px のまま不変 ②morphing で位置が凍結・波の間に per-char family が順次切替 ③docked ずれ 0px（現行検証の再実行） ④morphing 中の逆スクロールで本文復帰
- 本番 `allmarks.app` で目視 + 実測

## 8. チューニング面

バウンド強さ・ダッシュ速度は従来どおり `NAV_DOCK.zipMs`・zip の cubic-bezier。変身の速さ・波の間隔・キャンセル速度は §2 の新定数。すべて `NAV_DOCK` に集約されているので実機の好みで数値だけ変えられる。

---

## 9. 追補（同日・ユーザー実機フィードバック反映＝v2。§2〜§5 の該当箇所を上書きする）

実機確認で2点の指摘。以下が確定仕様。

### 9-1. ダッシュはスクロール駆動（時間制 zip と docked 状態を廃止）

- 変身完了後も**その場に「結構しっかり」とどまり**（`holdPx: 160` = 発動後のスクロール距離）、さらに下へスクロールすると**スクロール量に応じて**右のナビ枠へ横移動する（`dashPx: 140` の区間で 0→1）。逆に動かせば同じ道を左へ戻る＝**完全可逆のスクラブ**
- 横位置 = `anchor.left + (target.left - anchor.left) * dashEase(dashProgress(anchorTop))`。毎フレーム実 rect から計算（保存状態なし）
- `dashEase` = easeOutBack 系（出だし素早く、終端で僅かに行き過ぎて「はまる」。定数 `dashBack: 0.65` ≒ 行き過ぎ約1.5%）
- **`docked` 状態と `zipMs`/`returnMs` は廃止**。帯上の全期間（とどまり→横移動→枠に定着）は `morphing` 一状態で、位置は anchorTop の純関数
- **斜め軌跡の根治**: 上スクロールで帯を離れる時（`dockY + releaseGap`）には横スクラブが必ず 0 に戻っているため、本文への帰還は**真下への垂直移動のみ**（`morphCancelMs`）。時間制の斜め帰還は消滅
- 新純関数: `dashProgress(anchorTop)`（`dockY - holdPx` で 0、そこから `dashPx` 下で 1、clamp）と `dashEase(p)`。どちらもテスト対象
- 速いスクロールで変身の波と横移動が重なるのは許容（演出が凝縮されるだけで破綻しない）

### 9-2. 着地形はナビ実体と完全一致（実測し直し）

`.navLink` の実体は **`--lp-sans` 14px / weight 450 / letter-spacing -0.005em / text-transform なし（"Features" 混在ケース）/ color ink-soft**。s155 の「uppercase + 0.06em」は誤りだった。

- traveler の着地形（`--mp: 1`）の letter-spacing 目標を **-0.005em** に修正
- 文字の swap 時に **`text-transform: none`** も掛け替える（大文字 → 本来のケースへ。衣装替えの沈みで切替が隠れる）
- `SiteHeader.module.css .dockSlot` の誤った上書き（font-size/letter-spacing/text-transform）を削除し、`.navLink` から**継承**させる（幅予約もナビ実体と一致する）
- 寸法モーフの transition は `.word`（inline が left/top で占有）ではなく **`.txt` に CSS で**掛ける（`--morph-total` はラベル長から render 時に算出）。gap 9→8px の 1px は非遷移スナップで許容
- `html[data-nav-dock]` の値は `armed / traveling / morphing` の3値になる（landing-tokens の隠しリストから docked を削除）
