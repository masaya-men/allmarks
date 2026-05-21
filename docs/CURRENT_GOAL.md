# 次セッションのゴール (= セッション 63) — コントロールバーのブラッシュアップ続き

## 最優先: 再生コントロールバーの作り込み (4 項目)

session 62 で「カード再生中に真下へ出る AllMarks ミキサー調コントロールバー（カード個別音量 + 一時停止）」を実装・本番反映済。 user が細部をさらに詰めたいと、 以下 4 項目を指定。 **これを上から順に潰す。**

### 対象ファイル
- [components/board/PlaybackControlBar.tsx](../components/board/PlaybackControlBar.tsx) — バー本体（音量スライダー + ⏸再生/停止）
- [components/board/PlaybackControlBar.module.css](../components/board/PlaybackControlBar.module.css) — 全スタイル（テーマ変数 `--pc-*`）
- [components/board/CardsLayer.tsx](../components/board/CardsLayer.tsx) — バーの配置（active カードラッパー内、`top:100%`, `translateX(-50%)`, `zIndex:60`）。 `visible={hoveredBookmarkId === it.bookmarkId}` で hover 出し入れ
- 音量/停止 state は [BoardRoot.tsx](../components/board/BoardRoot.tsx)（`audioVolume`/`audioPaused`、 active 変更でデフォルトにリセット、 IDB 非保存）

### ブラッシュアップ項目（user 指定、 上から順に）

1. **背景の黒を TUNE ドロワーと完全に同一にする**（「まったくなってない」）。
   - 今は `--pc-bar-bg: rgba(10,10,10,0.92)` + `backdrop-filter: blur(8px)` + `border:0` で **CSS ファイルの値だけ**合わせたが、 見た目が合っていない。
   - **やり方**: `pnpm preview` で TUNE ドロワーを開き、 **実際にレンダリングされた `.drawer` の computed style を取得**して 1:1 で合わせる（ファイル値だけでなく、 親の stacking / 子カラムの背景重なり / blur の効き方まで確認）。 TUNE 実装は [TuneTrigger.module.css](../components/board/TuneTrigger.module.css) の `.drawer` (L169-189 付近) + 子の TunePresetColumn / FaderColumn。 バーと TUNE ドロワーを**並べて目視比較**して同質にする。
   - 注意: バーは小さい + カードの下（板の上）に出るので backdrop-filter が拾う背景が TUNE と違う可能性。 必要なら blur 量や不透明度を実測で詰める。

2. **他カードに隠れないように重ねる**（最前面でなくて良いが、 TUNE メニューのようにカードの上に重なること）。
   - 現状: バーは active カードラッパー内 `zIndex:60` だが、 **DOM 順で後ろのカードラッパーがその上に描画される**ため、 gap が小さい配置だと隣/下のカードに隠れる。
   - **やり方**: active カードのラッパー自体に高い z-index を付ける（[CardsLayer.tsx](../components/board/CardsLayer.tsx) の card wrapper `style.zIndex`、 今は drag 中のみ 1000）。 `audioActiveId === it.bookmarkId` のとき例えば `zIndex: 500` を付与 → そのカード + バーが他カードの上に出る。 または overlay layer / portal に逃がす。 まず wrapper z-index 付与で十分。

3. **バーの横幅をカード幅に合わせる。 ただし DENSE 時のカードサイズ (= 幅 207.80px) を最小値とする**（コントロール性確保）。 → **実装可能。確定。**
   - **やり方**: CardsLayer は各カードの実幅 `p.w` を持っている。 バーに `width` を渡し（or CSS 変数）、 バー幅 = `Math.max(p.w, 207.80)` にする。 DENSE 値 207.80 は [lib/board/tune-presets.ts](../lib/board/tune-presets.ts) L22 `{ id:'dense', w:207.80 }`（ハードコード回避したいなら import して参照）。
   - バー内: ⏸ボタンは固定、 スライダー (`.sliderWrap`/`.volume`) を flex で伸縮させて幅を埋める。 `.sliderWrap { flex:1 }` 等。

4. **消える時も出現時のように「カードに帰っていく」アニメーションにする**（今アニメしていない）。
   - 現状: 出現 = keyframe `pcPop`（mount 時も再生）。 消失 = base `.bar` の transition（opacity + transform tuck）。 だが user 観察で消失がアニメしていない。
   - **疑い**: ① hover-out では transition で tuck するはずだが効いていない（`animation both` の fill 状態と transition の競合の可能性）。 ② ■停止（`audioActiveId→null`）時はブロックごと即 unmount で**アニメ無し**。
   - **やり方**: 消失も確実にアニメさせる。 hover-out は出現の逆（カード方向 = 上へ translateY + scale down + fade）を transition か専用 keyframe で。 ■停止の unmount ケースは、 アニメさせたいなら「消えるまでマウント維持」する小さな state が要る（要判断）。 出現と対称の「カードにしまい込まれる」動きにする。

### テスト方法（重要 — ローカル実機検証）
- **`pnpm preview`**（= `next build && wrangler pages dev out`、 port 8788）。 これで `/api/tweet-video` `/api/tweet-meta` 等の Cloudflare 関数が動き、 **ツイート動画も実再生で確認可**。 `pnpm dev`（next dev）だと関数 404 で動画再生不可。
- カード投入: `http://127.0.0.1:8788/save?url=<encoded>` で 1 件ずつ（bookmark+card を schema 正で作る）。 動画ツイート URL は **user 個人のものなので tracked ファイルに書かない**（検証スクリプトは Temp のみ）。
- playwright で activate → hover でバー出現 → 音量/停止/リサイズ確認。 高 DPR で close-up スクショして立体感を目視。 過去スクリプト: `C:/Users/masay/AppData/Local/Temp/verify-controls.mjs` / `verify-bar-detail.mjs` / `diag-leak.mjs`（消えてたら作り直す）。

### 既知の罠 / 設計メモ
- range の **`accent-color: auto` が緑漏れの原因**だった（Chromium がトラック端を緑で塗る）。 解決済: 緑フィルを独立 `.fill` div にして `.groove`(overflow:hidden) でクリップ、 native track は透明。 **再発防止: native track-gradient で fill を作らない。**
- **テーマ着せ替え**: 全色 `--pc-*` 変数化済（`--pc-bar-bg` / `--pc-accent` / `--pc-knob-*` / `--pc-btn-*` / `--pc-track-empty`）。 将来テーマで上書き、 or コンポーネントごと差し替え可能な設計。
- 立体ディテール（溝の inset 影、 横長グレーノブのグリップ + ベベル、 物理ボタンの :active 押し込み）は維持すること。 user は**立体感を超重視**。
- 役割分担: 右下 ■ = 再生終了(unmount) / バー ⏸ = その場一時停止・再開。

## このプロジェクトの user 対応で厳守すること
- AskUserQuestion の質問箱を多用しない。 普通の chat で 1 問ずつ
- 「徹底調査して」 = 実際に調査を回す。 勝手に memory を増やさない
- 応答は日本語、 横文字カタカナ多用しない
- **既存機能を壊さない**: Lightbox 等を触る時は依存を先に洗い、 task ごとに全テスト + preview 実機確認。 commit はこまめに、 deploy 前に tsc + vitest

## コントロールバー以降の backlog
- テーマ別コントロールの実際の作り込み（変数は用意済）
- **Phase 2 = Tier 2 hover プール**（`usePlaybackPool` 4枚LRU + `useHoverIntent` 300ms、 [multi-playback-design](./superpowers/specs/2026-05-21-multi-playback-design.md) §3/§6）
- Phase 3 = Tier 1 ambient モーション / Phase 4 = master スイッチ
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認

## 引き継ぎ resources
- [docs/TODO.md](./TODO.md) / [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md)「セッション 62 続き2」
- plans: [inline-playback-controls](./superpowers/plans/2026-05-21-inline-playback-controls.md) / [board-media-playback-unification](./superpowers/plans/2026-05-21-board-media-playback-unification.md)
- 現状: 683 PASS / tsc clean / 本番反映済（バー = TUNE風ガラス + 70% + 立体ノブ + 物理ボタン + 出現ポップ）
