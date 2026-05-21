# Multi-Playback (生きてる board + 能動ミックス) — 設計仕様

> **状態**: design draft (= 2026-05-21 session 61、 user とブレスト中)
> **関連 memory**: `project_allmarks_vision_multiplayback.md` (= 核の差別化) / `project_theme_sound_wave.md` (= 音波テーマ) / `feedback_large_pointer.md` (= 32px+ クリックターゲット)
> **調査根拠**: session 61 で 2 本の web 調査 (= 同時再生の負荷上限 + トリガーの業界標準) を実施、 本仕様はその結論に基づく

---

## 1. 概要

board のカードを「静止サムネ + クリックで Lightbox」 から、 **3 段階のインライン再生体験**に進化させる。 AllMarks の核の差別化 (= 「集める道具」 ではなく「ミックスして世界を作る道具」) を board 上で実現する。

- **Tier 1 (常時・受動)**: 画面内の全カードが「動いて見える」。 デコーダ消費ゼロの軽量演出
- **Tier 2 (ホバー・半能動)**: マウスを留めたカードが本物のミュート再生に昇格 (最大 4 枚、 LRU)
- **Tier 3 (クリック・能動)**: 右下アイコン押しで音 ON + ピン留め。 自分だけの mood ミックス (最大 4 枚音つき)

カード本体クリック = 従来どおり Lightbox を開く (= 変更しない)。 役割が ホバー / アイコン押し / 本体クリック の 3 つに分離される。

## 2. 動機と調査結論 (= なぜこの設計か)

### 同時再生の物理上限 (調査 1 の結論)

- 動画同時再生のボトルネックは GPU 描画ではなく **ハードウェア動画デコーダのセッション数**。 一般的な消費者 GPU は実質 2 本程度で、 超えると CPU ソフトデコードに落ちて深刻な jank + メモリ膨張
- **iframe 埋め込み (YouTube/Vimeo) は raw `<video>` より遥かに重い** (= それぞれが独立した nested document)。 現実的に同時自動再生できる iframe プレイヤーは **3〜6 枚**。 Chrome は 1 frame あたり 75 WebMediaPlayer のハード上限あり
- → **「全カードを本物再生」 は物理的に破綻する**。 GPU 最適化では解決しない

### 「生きてる感」 の正体 (調査 1 の結論)

- Pinterest / TikTok / Instagram / X / YouTube グリッド、 **どこも全部を本物再生していない**。 実際に再生してるのは 1〜数本、 残りは静止画 or 軽い動き
- 「board が生きてる感」 は**全カードの軽量モーション** (= ストーリーボード / Ken Burns / クロスフェード) から生まれる。 本物のデコーダは注目カードにだけ使う

### トリガーの業界標準 (調査 2 の結論)

- **2D 密集キャンバスでは「ポインタが乗ったカード」 が唯一明確なトリガー** (= YouTube グリッドのホバープレビューと同型)。 TikTok 式「画面中心を再生」 は 1 列フィード専用で 2D では破綻
- Milanote / FigJam / Mural 等のボード系は **そもそも同時自動再生していない** (= 未実装の要望段階)。 AllMarks がここを実装すれば業界を超える
- **hover-intent = 300ms 留め** が標準 (NN/g・Baymard)。 同時本物再生は **4 枚上限 + LRU 退避** (= Netflix の同時 4 と同思想、 デコーダ上限内)

## 3. 3 段階モデル詳細

### Tier 1 — 常時の軽量モーション (画面内の全カード)

デコーダを 1 個も使わずに「動いて見える」 を全カバーする。 カード種別ごと:

| カード種別 | Tier 1 演出 |
|---|---|
| 動画 (YouTube) | ストーリーボード sprite (= 1 枚の mosaic 画像を `background-position` で flipbook 再生)。 取得できない場合はサムネを Ken Burns (ゆっくりズーム/パン) にフォールバック |
| 動画 (Vimeo / TikTok) | サムネを Ken Burns (= ストーリーボードが安定取得できないため最初からこちら) |
| 複数画像 (X 複数画像 tweet 等) | 画像をクロスフェードで巡回 (= slideshow)。 既存の I-07 multi-image 機構を流用 |
| 音楽 (SoundCloud) | 波形をうっすら表示 (= 既存 SoundCloud `visual=true` の静止プレビュー)。 音波テーマと整合 |
| 単一画像 / テキスト | モーションなし (= 静止のまま。 無理に動かさない) |

- スクロール/パンで画面外に出たカードは Tier 1 モーションも停止 (= IntersectionObserver で viewport 判定)
- 全体 ON/OFF (= §5) が OFF の時は Tier 1 も止まり、 全カード完全静止

### Tier 2 — ホバーで本物ミュート再生 (最大 3 枚)

- カードに **300ms マウスを留める** (= hover-intent) と、 そのカードが本物のミュート再生に昇格
- 乗った瞬間に **0.1 秒で視覚反応** (= 枠/scrim 等。 プレイヤー起動の待ちを感じさせない)
- 本物再生は **最大 3 枚同時** (= `MAX_HOVER_PLAYERS = 3`)。 4 枚目を昇格させる時は、 **最も古いプレイヤーを停止して Tier 1 に戻す** (= LRU 退避)
- マウスが離れても **約 0.8 秒は再生キープ** (= 即座に unmount するとデコーダ再生成で thrash する。 user 体感は「乗ってる間だけ」 で、 余韻は意識されない長さ)。 その後停止
- 再生は必ず `muted` + `playsinline` (= ブラウザ自動再生ポリシー必須要件)
- ファストスクロール中は昇格を抑制 (= スクロール停止後 ~150ms debounce)

> **Phase 2 実装確定 (session 64, 2026-05-21)**: user とのブレストで上限を **3 枚** (= マウスは 1 つなので普通は 1 枚、 素早い移動時の余韻重なりを捌く保険として 3)、 余韻を **0.8 秒** に確定。 元仕様の「4 枚 / 2〜3 秒」 は Tier 2 + Tier 3 統合後の全体ビジョン値で、 Tier 2 単独の今回はこの確定値を採用。 ホバー位置スクラブ (= storyboard シーク) は **今回もスコープ外** (= カード端で操作不能 + 本物再生と役割重複、 user 判断で見送り)。

### Tier 3 — アイコン押しで音 ON + ピン留め (最大 4 枚音つき)

- ホバーで右下に出る **動画=▶ / 音楽=♪ アイコンを押す** と、 そのカードが音 ON
- 音 ON にしたカードは **ピン留め** = Tier 2 の LRU 自動退避の対象外になる (= 勝手に止まらない)
- ピン留めは最大 4 枚まで (= 本物再生上限と同じ)。 これが「選んで同時再生する mood ミックス」
- もう一度アイコンを押すと音 OFF + ピン解除 (= Tier 2 に戻る)
- 音つきは user gesture 必須 (= クリックがその gesture になる、 ポリシー的に正しい)
- 複数音つき時は各カードが自前の音量で鳴る (= 既存の `defaultVolume` global state + カード間同期を流用。 真のミキシング)

## 4. カード右下アイコンの操作可能化 (= リサイズ干渉の解決)

### 現状の問題 (= 確認済)

- 右下の `MediaTypeIndicator` は今 **`pointer-events: none` + z-index 20** で、 上に乗る `.handle.br` リサイズハンドル (z-index 30) が操作を取っている = **押せない**

### 解決 (= 既存の `CardCornerActions` パターンを流用)

カードには既に押せる隅アイコンが 2 つある (= 右上 × 削除 / 左下 ↺ リセット、 `CardCornerActions`)。 これらは **z-index 50 + ボタン本体だけ pointer-events: auto + pointerdown/mousedown/click で stopPropagation** により「アイコン上はアイコンが勝つ、 隅の残りはリサイズ素通し」 を実現済。 右下の再生アイコンに同じ仕組みを適用する。

### リサイズを絶対に殺さない制約 (= 必須)

- 再生アイコンは **角の先端から 8px 内側** に配置 (= 現状 bottom:8/right:8 を維持)。 **角の先端 + 外周 8px はリサイズ専用のまま空ける**
- ホバー拡大は **カード中心方向 (= 内側) にのみ広がる**。 角の先端には絶対にかぶせない。 拡大後サイズは 32px 以上 (= `feedback_large_pointer` 準拠の押しやすさ)
- z-index 50 + ボタンのみ pointer-events + 伝播停止
- **実装後の検証必須**: br リサイズが先端つまみで引き続き機能すること (= playwright で br ハンドル drag → リサイズ発火を確認)

### アイコンの状態

| 状態 | 動画カード | 音楽カード |
|---|---|---|
| ホバー (Tier 2 中) | ▶ アイコン (= 押すと音 ON) | ♪ アイコン (= 押すと音 ON) |
| ピン留め (Tier 3 中) | ▶ が active 表示 (= 音波テーマの光る状態)、 押すと音 OFF | ♪ が active 表示、 押すと音 OFF |

active 表示は AllMarks の音波/pill 視覚言語 (= 緑系 glow 等、 `project_pill_visual_language` 参照) に揃える。

## 5. 全体 ON/OFF マスタースイッチ

- board のどこかに、 multi-playback 全体を切る master スイッチを置く
- **音波・ミキサーテーマの視覚** (= 既存 TUNE drawer / ScrollMeter の物理機材トーンに合わせる。 トグルスイッチ or 電源ボタン風)
- OFF にすると: Tier 1 モーション停止 + Tier 2/3 全プレイヤー停止 + 全カード完全静止 (= 「静かな鑑賞モード」)
- ON/OFF 状態は IndexedDB の board config に永続化 (= 既存 `loadBoardConfig` / `saveBoardConfig` 流用)
- 配置の具体案は実装フェーズで詰める (= TopHeader / TUNE drawer 内 / 独立ボタン のいずれか、 §10 で要決定)

## 6. アーキテクチャ

### 中核: アクティブプレイヤープール

新規 hook `usePlaybackPool` (= `lib/board/use-playback-pool.ts`):
- アクティブな本物プレイヤーの集合を管理 (= Phase 2 では最大 `MAX_HOVER_PLAYERS = 3`。 Tier 3 統合時に pin 対応 + 上限再検討)
- 各エントリ: `{ bookmarkId, tier: 2 | 3, lastActiveAt, pinned: boolean }`
- API: `promote(bookmarkId, tier)` / `demote(bookmarkId)` / `pin(bookmarkId)` / `unpin(bookmarkId)` / `isActive(bookmarkId)`
- LRU 退避ロジック: プールが満杯で新規 promote 時、 `pinned === false` の中で `lastActiveAt` 最古を demote
- ピン留め (Tier 3) は退避対象外。 Phase 2 では pin は常に false (= Tier 2 のみ)

### hover-intent

新規 hook `useHoverIntent(delayMs)` (= `lib/board/use-hover-intent.ts`):
- `onPointerEnter` で `delayMs` (= 300) のタイマー開始、 `onPointerLeave` でキャンセル
- タイマー満了で `onIntent()` を発火 → プールに `promote(id, 2)`
- 既存の card hover state (`hoveredBookmarkId`) とは別レイヤー (= hover は即時、 intent は 300ms)

### Tier 1 モーション

- カード種別ごとの軽量モーションコンポーネント。 既存の card レンダリング (`components/board/cards/`) を拡張
- ストーリーボード sprite 取得は best-effort util (`lib/embed/storyboard.ts`)。 失敗時は Ken Burns CSS アニメにフォールバック
- viewport 判定は CardsLayer の既存 culling (`CULLING`) を流用 or IntersectionObserver

### 既存資産の流用

- 本物再生のプレイヤー実装 = 既存 Lightbox の `YouTubeEmbed` / `VimeoEmbed` / `SoundCloudEmbed` / TikTok 再生を **インラインカード用に再利用** (= 抽出/共通化)
- 音量 = 既存 `lib/embed/default-volume.ts` (= 50% デフォルト + カード間同期)
- 削除追従 = 既存 channel.ts 機構

## 7. パフォーマンス制約 (= 厳守)

- 本物プレイヤー同時 **4 枚上限**を絶対超えない (= デコーダ上限内)
- Tier 1 モーションはデコーダ 0 消費 (= 画像/CSS のみ)
- 画面外カードは Tier 1/2/3 全て停止
- ファストスクロール中は昇格抑制 (= 150ms debounce)
- 50 枚カードが見える DENSE viewport で 60fps 維持を目標

## 8. テスト

### unit (vitest)

- `usePlaybackPool`: promote/demote/pin/unpin、 LRU 退避 (= 5 枚目で最古非ピンが落ちる)、 ピン留めは退避されない、 上限超過しない
- `useHoverIntent`: 300ms 後に発火、 300ms 前の leave でキャンセル
- `storyboard.ts`: 取得成功/失敗 (= 失敗時 null)
- 右下アイコン: video/audio で正しいアイコン、 押下で pin トグル

### 実機 (playwright)

- **br リサイズが再生アイコン導入後も機能する** (= 角先端 drag でリサイズ発火) ← §4 必須検証
- ホバー 300ms で本物再生昇格、 離脱 2-3s 後に Tier 1 復帰
- アイコン押しで音 ON + ピン、 5 枚目ホバーで最古非ピンが Tier 1 に落ちる
- master OFF で全停止

## 9. スコープ外 (= この設計に含めない)

- mobile / touch 対応 (= desktop-first、 hover 前提。 touch は将来別途)
- ミックス状態の URL 共有エンコード (= 魅力的だが別 sprint。 memory には残す)
- board 全体音量ロータリーノブ (= IDEAS.md K、 別途)
- prefers-reduced-motion: Tier 1 モーションを止める対応は入れる (= アクセシビリティ最低限)
- Spotify 等の新規プラットフォーム追加 (= 既存対応分のみ)

## 10. 実装フェーズ要決定事項 (= writing-plans で詰める)

- master スイッチの配置 (= TopHeader / TUNE drawer / 独立) と視覚デザイン
- ストーリーボード sprite の YouTube 取得方式の実現可能性 (= 静的サイトで取得できるか、 ダメなら全部 Ken Burns)
- 既存 Lightbox プレイヤーのインライン共通化の具体リファクタ範囲
- フェーズ分割案: Phase 1 = 右下アイコン操作化 + Tier 3 単体再生 / Phase 2 = Tier 2 hover プール / Phase 3 = Tier 1 ambient モーション / Phase 4 = master スイッチ

---

## 承認状態

- [x] 3 段階モデル (Tier 1 受動 / Tier 2 hover / Tier 3 ミックス) — user 承認 (session 61)
- [x] トリガー = hover-intent 300ms、 本物再生 4 枚上限 + LRU、 音 ON はアイコン押し + ピン — user 承認
- [x] 右下アイコンの操作化は既存 × ボタンパターン流用 + 内側拡大でリサイズ温存 — user 承認 (リサイズ死守が条件)
- [x] その他は業界水準を守る/超える — user 承認
- [x] spec 全体の user review (= Phase 1 着手時)
- [x] Phase 1 (Tier 3 単体) 実装プラン + 完遂 (session 62)
- [x] **Phase 2 (Tier 2 hover) スコープ + 振る舞い確定 — user 承認 (session 64)**: 300ms 昇格 / 0.1s 視覚反応 / muted / 上限 3 枚 LRU / 離脱 0.8s 余韻 / スクラブなし
- [ ] Phase 2 実装プラン (= writing-plans skill)
