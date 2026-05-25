# Tagging — Design (Phase 1)

**Date:** 2026-05-25 (session 69)
**Status:** Approved (design), pending spec review → plan
**Theme name introduced:** `WAVE` (= 旧称 default、 内部 ID `wave`、 表示名は将来変更可)
**Context:** user 最重要機能 (memory `project_tagging_top_priority`)。 これまで TODO.md の foundation 柱 2 として概念のみ存在、 今回 brainstorming で全仕様確定。

---

## Problem

ブクマが増えると、 ボード上で「アート系だけ見たい」「音楽系まとめて」 が今は出来ない。 全部混ざって表示されたまま → user は探しづらく、 ボードが「整理されてない倉庫」 になる。

業界の主流ブクマツールはすべてタグ機能を持つ。 だがどこも:

- サイドバーに list でタグが並ぶだけ (= 見た目地味)
- タグ絞り込み = 画面が「再描画」 されるだけ (= アニメ無し、 emotional moment ゼロ)
- 複数タグの組み合わせ操作が直感的でない
- タグごとの「世界観」 が無い (= 全部同じ list)

業界水準を踏襲するのは簡単、 **超える余地が大きい**。 AllMarks の「触って気持ちいい」 と「テーマ世界観」 を絞り込み体験に持ち込めば、 一目で違う差別化になる。

## Core insight

1. **タグ = フォルダの完全上位互換**: フォルダは 1 ブクマ = 1 箇所だけ、 タグは 1 ブクマが何枚でも所属可能。 ムードボード的体験では タグの方が圧倒的に強い (= 同じ 1 枚が「夏の朝に聞く音楽」 にも「作業 BGM」 にも所属できる)。 → TODO.md 旧 B2 「フォルダ機能」 は廃止、 タグ機能で吸収する。
2. **絞り込みアニメを主役にする**: 業界はここを地味にしてる。 ここを「気持ちいい儀式」 に変えると差別化が一目瞭然になる。 user 提案の「ブラウン管シャットダウン (ざざーー ぶつん)」 を採用。
3. **エフェクト・表現はテーマ連動**: AllMarks default テーマ (= WAVE) では CRT shutdown、 将来テーマ (forest / glass / cork 等) では葉ふわ / 水滴 / ピン外し etc. に差し替わる構造で作る。 「default 専用」 は作らない。

## Goals (Phase 1 で出すもの)

1. ブクマに `tags: string[]` を持たせる + タグマスター CRUD
2. ボード上で複数タグの **AND/OR 絞り込み** が出来る (= chip click でトグル、 「アート ∩ ジャパン」 が 2 click)
3. 絞り込み時、 **非該当カードに WAVE テーマの CRT shutdown** (= F6) アニメ + 該当カードが上に **reflow で詰まる** (= FLIP)
4. 通常モードのタグ付与 = カード hover で `+ TAG` → 候補チップ click / drag 付与 / 手動入力
5. テーマ連動の差し替え構造 (= Phase 1 では WAVE 用 CRT shutdown のみ実装、 他テーマ用は空欄)
6. ヘッダー chrome に **`TAG` ボタン** (= Phase 2 の Triage 画面入口、 Phase 1 は placeholder か簡易タグ一覧)
7. タグごとに optional な `theme` フィールドを schema に空欄で予約 (= Phase 3 のタグ別テーマ切替用)

## Non-goals (Phase 2/3 にまわすもの、 やらないもの)

- **Phase 2**: Triage モード本実装 (= 大量未タグ ブクマを WASD / 矢印 / 数字キー で高速振り分け、 カード中央表示)
- **Phase 3**: タグ × multi-playback (= タグ全部同時再生)、 タグごとテーマ切替の本実装、 タグ削除の儀式アニメ、 Song Bottle 風タグ交換
- AI を使ったタグ自動提案 (= 外部 API 課金が AllMarks ¥0 設計と合わない)。 「元サイト情報 + 既存ブクマからの候補提案」 で代替する
- WAVE 以外のテーマ用 shutdown アニメ (= 拡張ポイント空欄、 各テーマ実装時に追加)
- **エフェクトをボード全体 / 該当カード / 通常状態にかけること** = 厳禁。 CRT エフェクトは非該当カードの shutdown 0.4-0.55 秒間だけ

---

## 確定事項一覧 (= brainstorming 結果)

| # | 項目 | 確定内容 |
|---|---|---|
| A | 目的 | タグで絞り込み (= 業界水準を踏襲) |
| B | 重点 | ビジュアル遷移主役 + 複数タグ絞り込み (= 業界を超える) |
| C | フォルダ概念 | 廃止、 タグの完全上位互換、 TODO.md の B2 を吸収 |
| D | 通常モード付与 | drag + 候補チップ click + 手動入力 |
| E | Triage 入り口 | 右上 chrome に `TAG` ボタン → 専用画面 (Phase 2 で本実装) |
| F | Triage 振り分け先 | 既存タグ + 元サイト情報自動候補 + 新規タグその場作成 |
| G | Triage 候補数 | 4 個メイン (WASD/矢印) + **Shift で 5-8 番に切替** (全 8 個常時可視、 裏は薄く) |
| H | 絞り込みアニメ | **F6 (lbebber 風 CRT shutdown)** + 緑 flash + scanline + flicker + 縦膨らみ + reflow |
| I | アニメ適用範囲 | **非該当カードだけ・shutdown 0.4-0.55 秒間だけ** (該当 / ボード背景 / 通常状態には一切何も乗らない) |
| J | 拡張ポイント | タグごと optional `theme` フィールドを schema に空欄で予約 |
| K | Phase 2 | Triage 高速振り分け本実装 |
| L | Phase 3 | タグ × multi-playback / タグごとテーマ / 楽しい削除 / Song Bottle 交換 |
| M | テーマ名 | default テーマ = **WAVE** (= 内部 ID `wave`、 表示名は将来変更可) |
| N | エフェクトのテーマ連動 | Phase 1 = WAVE 用 CRT shutdown のみ実装、 他テーマ用は差し替え構造で空欄 |
| O | プロジェクト全体方針 | 今後あらゆるエフェクト・表現は「テーマに沿った」 ものに、 default 専用は作らない |
| P | IDB schema 鉄則 | 1 回で正解出す、 後から軽い気持ちで変えない (= memory `project_idb_irreversibility` 厳守) |

---

## データ層設計

### IDB スキーマ変更 (= 不可逆、 慎重に)

**bookmark テーブル** に `tags: string[]` フィールド追加:

```ts
interface Bookmark {
  id: string
  url: string
  // ...既存
  tags: string[]   // ← 追加。 既存全件は migration で空配列で fill
}
```

**新規 tags テーブル** (= タグマスター):

```ts
interface TagMaster {
  id: string              // 内部 unique ID (例: uuid)
  name: string            // 表示名 (= user 入力、 ユニーク、 case-sensitive 仕様は要詰め)
  theme: string | null    // ← Phase 3 用。 Phase 1 では常に null で書き込む
  createdAt: number       // unix ms
  updatedAt: number       // unix ms
}
```

**index 設定**: bookmark の tags 配列に対して `multiEntry: true` index を作る。 これで `bookmark.where('tags').anyOf(['アート', 'ジャパン'])` (= OR) / `allOf(...)` (= AND) が IDB native で高速実行できる。 全件スキャンしないので数百〜数千ブクマでも瞬時。

**migration 戦略**:
- schema バージョン番号を 1 つ上げる
- 既存 bookmark 全件に `tags: []` を fill
- 新規 tags テーブルは空で初期化
- migration の安全テストは vitest で「旧 schema → 新 schema データ移行」 を unit テスト

**鉄則** (= memory `project_idb_irreversibility`):
- 一度 schema バージョンを上げて user ブラウザに反映すると、 古いバージョンに戻せない
- 古いコードに戻すと「未来 schema 読めない」 エラーで全ブクマが画面に出てこない
- 過去 session 17 でこの事故あり
- → Phase 1 で「最初に決めた tags 構造」 で勝負、 後から変えるなら必ず追加 migration を慎重に書く

### タグ参照は「表示名」 ではなく「マスター ID」 にすべきか?

**判断: 表示名 (string) で持つ**。 理由:

- ID 参照だと tag 名 rename 時にすべての bookmark 走査不要 = 設計がシンプル
- でも「タグ名」 自体は uniqueness で識別 → 同じ名前の異なるタグマスターは作れない (= UNIQUE 制約)
- rename したい場合は (1) 全 bookmark 走査 + tag 配列内文字列置換 (2) tags マスターの name 更新、 を atomic に行う。 数千ブクマでも数秒で完了
- 表示名で持つ方が JSON エクスポート / 共有 URL 圧縮の互換性も高い

(= 別案: 内部 ID 参照の正規化スキーマ。 これは Phase 1 では採用せず、 必要になったら Phase 3 で再評価)

---

## UI 層設計

### `TAG` ボタン (= ヘッダー chrome 追加)

- 既存ボード右上 chrome (= TUNE / POP OUT / SHARE と並ぶ) に追加
- 同じ ChromeButton 系コンポーネント流用 (memory `feedback_glassmorphism` の glass 系統と整合)
- Phase 1 click 時の挙動 = 「タグ一覧 viewer (= 全タグ + 件数表示)」 modal、 もしくは「Triage は Phase 2 で実装予定」 placeholder。 plan で決める

### タグ chip filter bar (= ボード上に配置)

配置候補 3 つ、 **おすすめ a)**:

- **a) ScrollMeter 隣接 (= 既存 chrome の延長)** ← おすすめ。 視線移動が最小、 既存 spacing 流用、 削除しても reset 楽
- b) ボード上部の独立 strip (= 新 chrome 段が増えて圧迫)
- c) 左 sidebar (= 他ブクマツール主流の配置、 AllMarks の overlay chrome 哲学と合わない)

**chip click 挙動**:
- 1 chip click → 単体絞り込み (= そのタグだけ)
- もう 1 chip click → 2 タグ絞り込み (デフォルト AND)
- 「OR 切替」 トグルが filter bar 内に 1 つ (= AND / OR mode 切替)
- もう一度同じ chip click → 解除
- 「× すべて解除」 ボタン (= 全 chip リセット)
- 絞り込み中の chip は緑 glow (= WAVE テーマ accent `#28F100`)、 未絞り込みは neutral

**絞り込み中インジケーター**:
- 「47 件中 3 件」 (= 件数表示)
- 配置 = filter bar の右端

### タグ付与 UI (= 通常モード = 1 枚ずつ付ける)

カード hover で右上 (= 既存 MediaTypeIndicator / リサイズハンドル と被らない位置) に **`+ TAG`** アイコン:

- アイコン click → 候補チップ list popover (= カード上にポップアップ)
- popover 内の候補:
  - **既存タグ** (= 過去に作ったやつ、 関連度高い順)
  - **元サイト情報からの自動候補** (= Twitter ハッシュタグ / YouTube チャンネル名 / OGP site_name など、 色違いで強調表示)
  - **+ 新規タグをここで打って Enter 即作成 + 即付与**
- popover 内 chip を **カードに drag** で付与可能、 取り外しも **drag away** で
- 既に付いてるタグは「✓」 マーク + click でトグル OFF (= 取り外し)

### タグ管理画面 (= Phase 1 では簡易版でも OK)

役割分離を明示: **TagAddPopover (= カード hover で出る付与 UI) は単一ブクマへの即時付与専用**、 **タグ管理画面は全タグの一覧 / rename / 削除専用** = 用途が分かれる。

- `TAG` ボタンから入れる画面
- 既存タグ一覧 (= name + bookmark 件数 + createdAt)
- タグ rename / 削除 (= 削除時、 該当 bookmark の tags 配列から該当 string 除去)
- Phase 1 では plain な list view で OK、 Phase 3 で「タグごとテーマ」「楽しい削除」 のためにリッチ化

### Phase 1 で持たないもの (= 明示)

- **タグごとのカラー**: 持たない。 chip は緑 (= WAVE accent `#28F100`) 統一で進める。 Phase 3 で「タグごとテーマ」 と一緒に色も持たせる
- **タグの階層 (= 親子関係)**: 持たない、 フラット。 階層タグは Phase 3 以降で検討
- **タグ名の長さ制限 / 禁止文字**: plan で詳細決定 (= 仮 30 文字、 emoji 含む可、 改行不可)

---

## アニメ層設計

### CRT shutdown (= WAVE テーマ、 F6)

業界ベストプラクティス (= lbebber CodePen) を踏襲しつつ AllMarks 緑 flash + 上方向 reflow を追加:

**shutdown 5 段階** (合計 0.55 秒):

1. **glitch phase** (~0.06s) — RGB chromatic aberration (= TUNE button / cursor pill と同じ視覚言語)
2. **vertical stretch** (~0.04s) — `transform: scale(1, 1.3)` で縦に少し膨らむ (= ウォームアップ感)
3. **horizontal line + green flash** (~0.06s) — `transform: scale(1.3, 0.02) + filter: brightness(8) + background: #28F100` で 横膨らんで緑の水平線
4. **point collapse** (~0.04s) — `transform: scale(0.001, 0.001) + filter: brightness(30)` で中央 1 点に消える
5. **fade out** — 完全に消滅、 0.35s 経過

**並列発火 + stagger** (= 「ざざーー」 集合波):
- 全非該当カードに同時発火、 ただし各カードに 10-30ms の `animation-delay` (= 一気にじゃなく波打って消える)

**FLIP reflow** (= 該当カードが上に詰まる):
- shutdown が始まった直後、 該当カードの新しい masonry 位置を計算
- GSAP timeline で First → Last → Invert → Play (= FLIP) で 0.4-0.5 秒で滑らかに詰まる
- 既存技法、 memory `reference_flip_scale_compensation` 参照

**scanline + flicker overlay** (= shutdown 中だけ非該当カード内に出る):
- 非該当カードの `::before` = scanline (= horizontal 2px + vertical 3px RGB sub-pixel、 aleclownes 業界正規値)
- 非該当カードの `::after` = flicker (= opacity 20 ステップランダム、 7Hz、 aleclownes 値)
- どちらも shutdown 中だけ opacity 1、 それ以外 opacity 0
- **絶対に常時かからない**、 該当カード / ボード背景 / 通常状態には一切無い

### prefers-reduced-motion 対応

OS の「視覚効果減らす」 設定が ON の user には:
- CRT shutdown 全段階を opacity 0 への単純 fade に置換
- reflow も即座配置 (= アニメ無し)
- アクセシビリティ + 視覚過敏ユーザ配慮

### CSS 変数 (= 後で数値だけ調整可能)

```css
:root {
  --tag-shutdown-duration: 0.55s;
  --tag-shutdown-stretch-y: 1.3;
  --tag-shutdown-easing: cubic-bezier(0.230, 1.000, 0.320, 1.000);
  --tag-shutdown-flash-color: #28F100;
  --tag-shutdown-stagger-step: 30ms;
  --tag-shutdown-scanline-intensity: 0.4;
  --tag-shutdown-flicker-intensity: 0.5;
}
```

実装後、 user 検証しながら数値だけ書き換えて微調整可能。

---

## テーマ連動 (= 拡張ポイント)

### Phase 1 で作る構造

```
lib/animation/tag-shutdown/
  index.ts                  # 公開 API: getShutdownAnimation(themeId) → CSS class
  themes/
    wave.css                # ← Phase 1 で実装、 F6 CRT shutdown
    wave.module.css         # CSS Modules で scope
    (forest.css)            # ← Phase 3 で追加 (例: 葉ふわ)
    (glass.css)             # ← Phase 3 で追加 (例: 水滴弾性)
    ...
```

`getShutdownAnimation('wave')` → WAVE 用 CSS class を返す、 該当カード `[data-tagged-out=true]` がその class を持つ。

別テーマ追加時は:
- `themes/forest.css` 等を 1 ファイル足す
- 公開 API の switch に case 追加 1 行
- それだけ

### Phase 3 で増えるテーマ用 shutdown (= IDEAS.md 既存構想)

| テーマ | shutdown アニメ案 |
|---|---|
| `dotted-notebook` (紙ノート) | 付箋がぺりっと剥がれる + 斜めに飛ぶ |
| `grid-paper` (方眼) | 製図線で囲んで → スナップ消去 + 「カキッ」 SE |
| `beach-horizon` (砂浜) | 波がさらっていく + 砂跡が残る |
| `forest` (森) | 葉っぱのようにふわっと落ちる + 風の音 |
| `space` (宇宙) | 重力で吸い込まれて点に + 慣性 |
| `cork` (コルクボード) | ピンが外れてカードが落ちる + 「トン」 SE |
| `glass` (ガラス) | 水滴のように弾けて広がって消える + 屈折 |

これは Phase 3 で各テーマ実装時にまとめて追加 (= テーマシステム本格化スプリント)。 Phase 1 ではテーマ key と CSS class 切替の構造のみ。

---

## Components & data flow

1. **`lib/storage/tags.ts`** — タグマスター CRUD + bookmark の tags 配列 read/write API
   - `createTag(name)`, `renameTag(id, newName)`, `deleteTag(id)`, `addTagToBookmark(bookmarkId, tagName)`, `removeTagFromBookmark(...)`, `filterBookmarks({ tags: [...], mode: 'and' | 'or' })`
   - unit テスト必須 (= migration 含む)

2. **`components/board/TagFilterBar/`** — chip 表示 + 絞り込み state
   - props: 全タグ list、 現在の絞り込み state、 onChipClick callback
   - state は BoardRoot or 専用 context に置く (= shutdown アニメに反映するため）

3. **`components/board/TagAddPopover/`** — カード hover で出る `+ TAG` popover
   - 候補チップ (既存 / 元サイト情報 / 新規入力欄)
   - drag 付与は `react-dnd` or `@dnd-kit/core` (= 既存実装の有無で判断)

4. **`lib/animation/tag-shutdown/`** — F6 CRT shutdown CSS + FLIP reflow ロジック
   - `getShutdownAnimation(themeId)` 公開 API
   - GSAP FLIP プラグインの可否は plan で確認 (= 既に board で使ってる masonry FLIP があれば流用)

5. **`BoardRoot.tsx` 最小変更**:
   - tag filter state を読む
   - 非該当カードに `data-tagged-out="true"` 属性付与
   - reflow 発火タイミングを shutdown 開始と同期

6. **`lib/storage/migrations/{version}.ts`** — schema migration (= bookmark に tags: [] fill、 tags テーブル作成)

---

## ユーザ体験シナリオ

### シナリオ 1: 初めてタグを付ける

1. user がボードを開く、 既存 50 ブクマがある (= 全部タグ無し)
2. あるカードに hover、 右上に `+ TAG` アイコン
3. click → popover 出る、 候補 = (元サイト情報からの自動候補 1-2 個 + 「+ 新規」)
4. user 「アート」 と打って Enter → 即新規タグ作成 + そのブクマに付与
5. ボード右上 (= ScrollMeter 隣) の filter bar に **`アート` chip が出現**
6. 別カードにも同じ流れで「アート」 や「音楽」 を付ける

### シナリオ 2: タグで絞り込む

1. user が filter bar の **`アート` chip を click**
2. **WAVE shutdown アニメ発動**: 非該当 47 枚が ざざーー ぶつん で 0.55 秒で消滅、 該当 3 枚が上に詰まる
3. インジケータが「47 件中 3 件」 に更新、 解除ボタンが現れる
4. もう 1 chip 「**ジャパン**」 を click → 「アート ∩ ジャパン」 で更に絞り込み (= 1 枚だけ残る等)
5. AND/OR 切替 click → 「アート ∪ ジャパン」 になり、 該当が再度増える + 再 shutdown / reflow
6. `× 解除` click → 全カードが戻ってくる (= reverse アニメ、 ふわっと出現)

### シナリオ 3: 既存タグの管理

1. user が `TAG` ボタン click → タグ一覧 modal
2. 既存タグ list (= 「アート 12 件」 「音楽 28 件」 「ジャパン 5 件」)
3. タグの rename / 削除可能 (= 削除確認ダイアログ + 関連ブクマ件数表示)

---

## Edge cases / 既存挙動との整合

- **タグが 1 つも無い状態**: filter bar は表示しない (= UI 占有しない)、 `+ TAG` だけ出る
- **絞り込み中に新規ブクマ追加**: 自動的に tags: [] で保存、 絞り込み条件に該当しなければ shutdown アニメで即消える (= 違和感ある? 議論余地、 plan で UX 詰める)
- **Lightbox open 中の絞り込み**: 既存挙動 (= ボード操作止まる) と整合、 Lightbox 閉じた瞬間に shutdown 完了状態で復帰
- **MOTION switch OFF** (memory `project_tier1_viewport_playback`): shutdown アニメも opacity フェードに置換 (= reduced-motion と同じ挙動)
- **同タグ名 case 違い** (= 「アート」 と「ART」): デフォルトは case-sensitive で別タグ扱い、 plan で「正規化するか」 議論

---

## Testing

### Unit (Vitest)
- `lib/storage/tags.ts` 全 API (= CRUD、 filter AND/OR、 migration)
- 元サイト情報からのタグ候補抽出 (= Twitter ハッシュタグ / YouTube チャンネル / OGP site_name パース)
- 既存ブクマからのタグ候補スコアリング (= 同ドメイン頻出タグ等)
- FLIP reflow 計算 (= 該当カードの新 masonry 位置)
- IDB schema migration の旧 → 新変換 (= 既存全件が tags: [] で fill されるか)

### 視覚 (= preview / 本番手動)
- CRT shutdown 5 段階の見た目
- stagger の波感
- reflow のなめらかさ + FLIP の正確さ (= 詰まる位置のズレなし)
- prefers-reduced-motion ON 時の挙動
- 50 / 200 / 500 ブクマでのパフォーマンス (= 4K 画面 user で確認)

---

## Tuning knobs (= 実装後 user 検証で調整)

- `--tag-shutdown-duration` (default 0.55s) — 全体時間、 短いほど鋭い「ぶつん」
- `--tag-shutdown-stretch-y` (default 1.3) — 縦膨らみ量、 派手にしたいなら 1.6 等
- `--tag-shutdown-easing` (default ease-out-quint) — easing カーブ
- `--tag-shutdown-flash-color` (default `#28F100`) — flash 色、 テーマ連動で差し替え
- `--tag-shutdown-stagger-step` (default 30ms) — 「ざざーー」 集合波の間隔
- `--tag-shutdown-scanline-intensity` / `--tag-shutdown-flicker-intensity` — overlay 強さ

すべて CSS 変数 → 数値変更だけで微調整可能、 実装後本番で検証しながら詰める。

---

## Phasing

- **Phase 1 (= 本 spec の scope、 1 sprint で完遂目標)**
  - IDB schema bump (= tags 配列 + tags テーブル) + migration
  - タグ CRUD + filter (AND/OR) API
  - 通常モードの付与 UI (= カード hover `+ TAG` + 候補チップ + drag)
  - filter bar (= chip 表示 + click トグル)
  - WAVE CRT shutdown F6 + 並列 stagger + FLIP reflow
  - prefers-reduced-motion 対応
  - テーマ連動の構造 (= wave.css のみ実装、 他テーマ用は空欄)
  - `TAG` ボタン (= Phase 2 placeholder or 簡易タグ一覧)
  - Phase 1 ship + 本番反映 + user 検証

- **Phase 2 (= Phase 1 検証後すぐ続けて出す)**
  - Triage 専用画面 (= `app/triage/page.tsx` 新規 route)
  - カード中央表示 + WASD / 矢印 / 数字キー高速振り分け
  - Shift で 5-8 番候補に切替 (= 全 8 個常時可視)
  - Skip / Undo / Esc 中断 + 状態保存
  - 振り分けアニメ (= 「しゅっ」 のフィードバック、 4 方向に飛ぶ)
  - Phase 2 ship + 本番反映 + user 検証

- **Phase 3 (= 別 sprint、 他機能と合流するタイミング)**
  - タグ × multi-playback (= タグ全部同時再生)
  - タグごとテーマ切替の本実装 (= schema に予約済 theme フィールドを読む)
  - 楽しい削除フロー (= タグ全削除アニメ、 IDEAS.md L102-108 5 案から prototype)
  - 各テーマ用 shutdown variant 追加 (= 上記テーマ表)
  - Song Bottle 風タグ交換 (= backend 必要、 別 spec)

各フェーズが独立 implementation plan + deploy + user verification を持つ。

---

## 関連 memory / IDEAS.md / 既存 spec

**memory**:
- `project_tagging_top_priority` — タグ付け = AllMarks 最優先機能 (= 本 sprint の根拠)
- `project_theme_sound_wave` — WAVE テーマの音波 motif 定義
- `project_idb_irreversibility` — schema bump は不可逆、 過去 session 17 事故
- `feedback_collaboration_style` — 平易日本語、 board 既存コード流用検討
- `feedback_ui_vocabulary` — UI label は世界共通英語語彙のみ
- `feedback_jargon_in_japanese` — 横文字カタカナ多用禁止
- `reference_flip_scale_compensation` — FLIP アニメ手法
- `feedback_glassmorphism` — chrome 系の glass テクスチャ

**IDEAS.md 関連セクション**:
- §「楽しい削除フロー / タグ一括削除との連携」 (= Phase 3 楽しい削除)
- §「テーマ別アニメーションパーソナリティ」 (= Phase 3 各テーマ shutdown)
- §「Song Bottle 風 1 ブクマ交換」 (= Phase 3 タグ交換 + ジャンル分け)
- §「フォルダごとの配置モード」 (= 旧 B2 フォルダ計画 → タグで吸収)
- §「2026-04-21 WASD マッチングアプリ方式」 (= Phase 2 Triage Directional)
- §「Triage 一括仕分けモード」 (= Phase 2 詳細)

**既存 spec**:
- `docs/specs/2026-05-12-sizing-migration-spec.md` (= foundation 柱 1、 タグは柱 2)
- `docs/superpowers/specs/2026-05-21-multi-playback-design.md` (= Phase 3 で合流)

---

## 業界比較

(= 競合名直接記述は `docs/private/` のみに留め、 ここでは抽象化)

| 機能 | 業界主流ツール | **AllMarks (Phase 1 後)** |
|---|---|---|
| タグ機能 | ✅ | ✅ 手動 + 半自動候補 |
| 複数タグ絞り込み | △ list 操作中心 | **✅ chip 2 click で AND/OR** |
| 絞り込みアニメ | ❌ 即再描画 | **✅ CRT shutdown ざざーー ぶつん** |
| テーマ連動 | ❌ | **✅ Phase 3 で完全実装、 Phase 1 で構造準備** |
| 高速振り分けモード | ❌ | **✅ Phase 2 で WASD + Shift 拡張** |
| サーバー依存 | ✅ あり | **❌ なし (= IndexedDB 完結)** |

ここまで踏み込めば、 タグ機能 1 つで「業界水準を踏襲しつつ、 視覚体験 + 操作快感 + テーマ世界観 で明確に超える」 ポジションを確立できる。

---

*次のステップ: 本 spec を user レビュー → 承認後、 writing-plans skill で実装 plan を作成。*
