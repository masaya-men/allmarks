# Tier 1 = 画面内自動再生 + MOTION マスタースイッチ — 設計メモ

> 2026-05-21 (session 65)。 multi-playback の **Tier 1 を再定義**。 元 spec [multi-playback-design](./2026-05-21-multi-playback-design.md) §3 Tier 1 (= storyboard flipbook / Ken Burns / crossfade) は **本案で置き換える**。 Tier 2 (ホバー再生) は session 65 で撤去済 ([project_tier2_hover_removed])。

## 1. 背景と狙い

- Tier 2 (ホバー300msでミュート再生) を撤去した。 撤去理由は「ホバー = マウスの動きで偶発発火 → 通過しただけのカードが鳴って**うるさい・予測不能**」。
- 代わりに **「画面内に見えている動画を、音なしで自動再生」** に挑戦する。 これはマウスと無関係に「**見えてるものが動く**」 ＝ 予測可能で、 X / TikTok のフィード自動再生と同じ正攻法。 Tier 2 の偶発ノイズ問題が原理的に起きない。
- ゴール: **video カードが多いボードが、開いた瞬間から生きて動いて見える**。 ただし 50 枚で 60fps を死守する。

## 2. スコープ (= 何が動いて何が動かないか)

| カード種別 | Tier 1 の挙動 |
|---|---|
| **動画** (YouTube / Vimeo / TikTok / X動画 / mp4 slot) | **画面内で“いちばん見えている”ものから上限 N 枚だけミュート実再生**。 残りはサムネ静止。 スクロールで再生が見えてる方へ移る |
| **複数画像カード** (= 2 枚以上の画像を持つ) | 画像を **ぱっと切り替え (= hard cut)** で巡回。 **クロスフェードしない** (動画が動いてる中では瞬間切替の方が締まる、 user 確定) |
| **単一画像 / Web サイトのサムネ** | **完全静止。 一切の加工なし** (Ken Burns 等もしない、 user 確定) |
| **テキストカード** | 完全静止 (動く必要なし、 user 確定) |

- 「全部を本当に同時再生」 は性能が持たない (= YouTube 埋め込みは 1 枚ごとに重い)。 だから **上限 N 枚 + 見え具合 (intersectionRatio) で優先** する。
- 上限 N の初期値は実機計測で決める (= YouTube/Vimeo iframe は重いので控えめ、 mp4 native `<video>` は軽い)。 **初期値は控えめに `4`** で start し、 preview で 60fps を見ながら調整。

## 3. MOTION マスタースイッチ (= 全体 ON/OFF)

- **常に見える場所** (= ボード上部ヘッダー) に MOTION の ON/OFF を置く。
- **ON**: §2 の自動再生 + 複数画像巡回が動く。
- **OFF**: 全カード完全静止 = 「静かな鑑賞モード」。 実再生プレイヤーも全停止。
- 状態は **IndexedDB の board config に永続化** (= 既存 `loadBoardConfig` / `saveBoardConfig` 流用)。 リロードしても維持。
- **既定値**: **ON で start** (= 開いた瞬間に生きてる体験が core。 うるさければ user が切れる)。 ただし OS が prefers-reduced-motion の場合のみ既定 OFF (§6)。 ※ user 確認ポイント (§9)。

### MOTION の見た目 (= user 確定事項、厳守)

- **囲わない**。 ボタンの箱・枠は付けない。 **TUNE / POP OUT / SHARE と全く同じ素のテキスト**にする。
  - → 既存 [ChromeButton](../../../components/board/ChromeButton.tsx) をそのまま流用 (= `.btn` は `background:none; border:none`、 monospace 11px、 ホバーで RGB グリッチ)。 これで他ボタンとエフェクト完全一致。
- 状態 LED を付けるなら **新しい平らなドットは作らない**。 既存の **立体ドーム型 LED を流用** (= [TuneTrigger.module.css](../../../components/board/TuneTrigger.module.css) `.led`: `radial-gradient` で反射 + 縁の暗み + `data-color`)。
  - **ON** = `.led data-color="green"` (= 点灯)。 **OFF** = 消灯状態 (= 暗いドーム、 unlit)。
  - 配置: `MOTION` の文字に LED を 1 個添える (= `MOTION ●`)。

## 4. ヘッダーレイアウト (= user 確定事項、厳守)

現状: 左上 = `FilterPill` (= フィルタ名 · 件数、 例 `AllMarks · 192`)。 右上 1 行 = `TUNE` `POP OUT` `SHARE`。

変更後 = **右上を 2 段**にする:

```
  [ 左上は空ける ]                         上段:  MOTION ●   AllMarks · 192
                                           下段:  TUNE   POP OUT   SHARE
```

- **下段 (TUNE / POP OUT / SHARE) の位置は絶対に動かさない** (user 厳命)。
- **上段** = `MOTION ●` (左) + `FilterPill` (右)。 FilterPill は左上から上段へ移動。
- **FilterPill の右端を SHARE の右端にぴったり合わせる** (= 右揃え)。 readout 文字幅が scramble で変わっても**常に右端が揃う** (= 右アンカーで左へ伸びる)。
- **左上は意図的に空ける** (= 非対称・編集的レイアウト。 左右対称は「初期テンプレ感 = 素人臭い」 を避ける。 中央の巨大 `AllMarks` 文字 + 左下 `AllMarks ↔ Drag me` ピルが画面を支える)。
- TUNE のドロワーは**下段から下へ**開くので、 上段の MOTION・FilterPill に被らない (= 2 段化はこの衝突回避も兼ねる)。

## 5. アーキテクチャ / コンポーネント

### 5-1. MOTION 状態
- BoardRoot に `motionEnabled: boolean` state。 board config に永続化 (load 時に復元、 toggle 時に save)。
- 新規 `MotionToggle.tsx` (小) = ChromeButton 流用の `MOTION` ラベル + ドーム LED (TuneTrigger `.led` の markup/CSS を共有可能な形に切り出すか、 最小複製)。 props: `enabled`, `onToggle`。
  - LED CSS は TuneTrigger 専用 module に閉じているので、 **共有 LED として小さく切り出す** (例: `components/board/StatusLed.tsx` + `.module.css`) → TuneTrigger も将来揃えられる。 ※ 今回は MOTION 用に最小流用、 TuneTrigger 側の改変はしない (無破壊)。

### 5-2. ヘッダー 2 段化
- [TopHeader.tsx](../../../components/board/TopHeader.tsx) は今 `nav` (左) + `actions` (右 1 群)。 これを **右側 2 段** に対応させる:
  - 案: `actionsTop` (= MOTION + FilterPill) と `actionsBottom` (= TUNE/POPOUT/SHARE) を受け取り、 右側で縦 stack。 `nav` (左) は廃止 or 空。
  - 右揃え + 下段固定を CSS で担保 (= 下段は従来の位置のまま、 上段をその上に右揃えで足す)。
- FilterPill を BoardRoot の `nav` から `actionsTop` へ移す。

### 5-3. 画面内自動再生プール (= 上限 N + 見え具合優先)
- **viewport 可視性で駆動するプール**。 session 64 で消した hover プールの「最大数 + LRU 退避」 の考え方を、 **トリガーを“ホバー”から“IntersectionObserver の可視率”に変えて**再導入する。
- 新規 `lib/board/use-viewport-playback-pool.ts` (純粋ロジック + hook):
  - CardsLayer が各カードに IntersectionObserver を張り、 `visible card id → intersectionRatio` を集約。
  - プールは「可視率が高い順に上限 N 枚」 を `active` 集合として返す。 画面外に出たカードは即 inactive。
  - **fast-scroll 抑制**: スクロール中は昇格を保留、 停止後 ~150ms debounce で確定 (= スクロール中に大量の player を起動して thrash しない)。
- CardsLayer: `active` かつ動画カードに、 **ミュートの InlineMediaPlayer をオーバーレイ** (= `muted` + `playsinline`、 `pointer-events:none` で hover/click を邪魔しない)。
  - **muted embed 対応を再導入**する。 Tier 2 撤去で revert した `muted` prop (iframe=`mute=1`/`muted=1`, native `<video>`=`muted` 属性, SoundCloud=`setVolume(0)`) を embeds + media-players に**戻す**。 revert は Tier 2 (ホバー) には正しかったが、 Tier 1 (画面内自動再生) には正当に必要。
- **Tier 3 (= 右下アイコン押しで音つき) との関係**: 音つきの `audioActiveId` カードは Tier 1 のミュート自動再生の対象外 (= 音つきが優先、 二重 mount しない)。 既存の `audioActiveId !== id` ガードと同型。

### 5-4. 複数画像カードの hard-cut 巡回
- 既存の複数画像カード (= I-07 multi-image、 `mediaSlots` に画像複数) の表示を流用。
- MOTION ON + 画面内のとき、 表示画像 index を一定間隔で進める (= `setInterval` 的に、 ただし可視 + MOTION 連動)。 **切替は瞬間 (hard cut)、 トランジションなし**。
  - 間隔の初期値 **~2.2s/枚** (preview で調整)。
  - 画面外 / MOTION OFF では巡回停止 + index リセットは不要 (= 現在の絵のまま静止)。

## 6. 性能 / 既知の制約

- **同時再生数 = 60fps の最大リスク**。 上限 N + 可視率優先 + fast-scroll debounce で抑える。 preview で 50 枚 + 多数 video の実機計測必須 (= playwright + 体感)。
- YouTube/Vimeo iframe は重い、 mp4 native `<video>` は軽い → 同じ N でも内訳で負荷が違う。 必要なら「軽い player を優先的に N に入れる」 重み付けを後で足す (= 初期は単純に可視率順)。
- TikTok iframe フォールバック / SoundCloud は外部制御の限界あり (= Tier 3 と同じ既知制約)。
- prefers-reduced-motion: ユーザーが OS で motion 削減を選んでいる場合は **MOTION 既定 OFF** にする (= アクセシビリティ。 手動 ON は可能)。

## 7. テスト方針

- `use-viewport-playback-pool` の純粋ロジック (= 可視率順で上限 N、 画面外で除外、 debounce) を unit test (TDD)。
- `MotionToggle` の ON/OFF レンダリング + LED 状態 + ChromeButton 流用を test。
- TopHeader 2 段構造の test (= 下段不動、 上段右揃え、 FilterPill 移動)。
- board config 永続化 (= motionEnabled の save/load) を test。
- 複数画像 hard-cut 巡回ロジックを test (= MOTION + 可視連動で index 進行、 OFF/画面外で停止)。
- **実機検証 (= 必須)**: preview で ①画面内動画が音なし再生 ②上限 N 超で可視率低いものは止まる ③スクロールで再生が追従 ④MOTION OFF で全停止 ⑤複数画像が hard-cut 巡回 ⑥単一画像/テキストは静止 ⑦下段ボタン位置不動 + FilterPill 右端が SHARE と揃う ⑧60fps。

## 8. 段階 (= 実装計画で詰める)

1. MOTION マスタースイッチ + ヘッダー 2 段化 (= 見た目の骨格、 まだ再生は繋がない。 OFF/ON state + 永続化 + LED + レイアウト)
2. 画面内自動再生プール + muted embed 再導入 + CardsLayer 配線 (= 動画の画面内自動再生)
3. 複数画像 hard-cut 巡回
4. 性能チューニング (= 上限 N の確定、 fast-scroll debounce、 60fps 計測)

## 9. user 確認が必要な小さな点

- **MOTION の既定値**: 初期 ON で start 提案 (= 開いた瞬間に生きてる)。 reduced-motion 時のみ OFF。 → 要確認
- **上限 N の初期値**: 4 で start、 preview 計測で調整。 → 実装中に一緒に見て決める
