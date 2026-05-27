# Share Rebuild — Design Spec (Phase 1)

**Date:** 2026-05-27 (session 83)
**Status:** Approved (design), awaiting user review of this file before plan phase
**Supersedes:** `docs/superpowers/specs/2026-05-05-share-system-design.md` (= 旧 ShareComposer 系設計、 廃案)
**Context:** session 82 までにトンマナ (= editorial 黒 + 緑チェック + monospace + convex bezel + 音波 motif) が固まったので、 4 月時点で作った PNG コラージュエクスポート系シェア機能を完全作り直す。 既存実装 (= `ShareComposer` / `ShareFrame` / `ShareSourceList` / `ShareAspectSwitcher` / `ShareActionSheet` / `SharedView` / PNG export) はすべて廃棄。

---

## 1. なぜ作り直すか

旧シェア機能の課題：

- **トンマナ古い**: 旧 `ShareActionSheet` は絵文字 (📥/🔗/𝕏) + 日本語混在ボタン (「画像をダウンロード」 「URL をコピー」 「X で投稿」) + 「閉じる」 ボタン、 destefanis editorial 感ゼロ。 session 53 以降の AllMarks 視覚言語と完全に乖離。
- **シェア体験が複雑すぎる**: 旧 ShareComposer は「別 modal でカード選択 + 並び替え + アスペクト切替 + ウォーターマーク」 という gadget UI。 user の現在の好み (= シンプル一発、 ボードそのものを送る) と合わない。
- **画像中心の発想 (= PNG エクスポート) が刺さらない**: 旧設計は「コラージュ PNG を SNS に貼る」 が主動線。 だが AllMarks の核は「ボードという空間体験」 で、 静止画 PNG に潰すと一番美味しい部分 (= 触れる、 Lightbox 開く、 動画再生) が消える。
- **URL が長くて醜い**: 旧設計は URL fragment 4KB 詰込み (`booklage.pages.dev/share#d=<4000文字>`)、 X 投稿で URL preview 効かず、 ペースト先で truncate される事故も。
- **件数制限 (= 実用 30 件) が実装上の壁になっていた**: fragment 制約のせいで「全件シェア」 が事実上不可。

新方針: **「いま見ているボードそのものを共有する。 受信者はそれを見て、 自分の AllMarks に取り込める。」**

---

## 2. 確定事項一覧 (= 2026-05-27 brainstorming 結果)

| # | 決定 | 補足 |
|---|---|---|
| 1 | 料金 OK (= ¥0 launch、 100 万 MAU で約 ¥15k/月) | Cloudflare KV + Pages Functions、 §8 参照 |
| 2 | シェア範囲 = フィルタ後全件 | スクロール先のカードも含む、 上限 100 件 |
| 3 | URL 形式 = `allmarks.app/s/<6文字>` | Cloudflare KV に snapshot 保存 |
| 4 | 受信者着地 = 送信者ボード表示 + sticky CTA | 「全部取り込む」 / 「選びながら取り込む」 |
| 5 | sender's tags を payload に入れる | schema v2 に `tg[]` + `tags{}` フィールド追加 |
| 6 | タグ取り込み = (β) 提案表示、 receiver が accept したものだけ | bulk は cards only、 triage で per-card accept |
| 7 | 送信側 SHARE = 軽量 action sheet (= 中央 modal) | viewport snapshot プレビュー + URL コピー + X 投稿 |
| 8 | サムネ = SHARE 押した瞬間の viewport snapshot | WebP 5-10KB、 OG image 用 |
| 9 | Modal トンマナ = AllMarks デフォルトテーマ | editorial 黒 + 緑 + monospace + convex bezel + 音波 motif |
| 10 | 既存実装は全廃案、 完全作り直し | §10 削除対象一覧 |
| 11 | 重複 = 黙って skip、 bulk 完了 toast 「Already saved: N」 1 行、 triage は queue から除外 | extension の「Already saved」 アンバー pill 言語と揃える |
| 12 | expiry = 30 日 | KV TTL で自動削除、 ストレージコスト一定化 |
| 13 | 受信側 board の広告 = phase 1 出さない | 取り込み後の自分の board には通常通り広告 (= 別 sprint) |
| 14 | 受信側に sender's filter context = 右上に小さく | `· Filtered: music + design` |
| 15 | 新規ユーザー = 取り込み時に IDB 自動初期化 | 確認ダイアログなし、 取り込みボタン押下が同意 |
| 16 | PNG export = 完全廃止 | URL シェアに統一、 サムネ WebP は内部用 |
| 17 | 旧 share schema (v1) = decode 失敗で error | phase 1 で誰も使ってない前提、 fallback 実装しない |

---

## 3. Goals (= Phase 1 で出すもの)

1. **送信者**: board chrome の `SHARE` ボタン押下で軽量 modal が開く。 modal は AllMarks デフォルトテーマトンマナで作る。 viewport snapshot プレビュー + 件数 + tags 表示 + 「URL コピー」 + 「X で投稿」 + 「閉じる」 の 3 ボタン。
2. **シェアデータ生成**: フィルタ後全件 (= 視界外のカードも含む) を ShareData v2 形式に詰めて Cloudflare KV に保存。 6 文字 base62 ID を発行し、 短縮 URL `allmarks.app/s/<id>` を返す。 expiry 30 日。
3. **OG image**: SHARE 時に撮った viewport snapshot を WebP として KV に同梱。 `/s/<id>` ページの `<meta property="og:image">` に同 endpoint を指定し、 X / Discord / Slack の URL preview で画像が出る。
4. **受信者着地**: `/s/<id>` を開くと、 送信者のボードがそのまま (= 同じレイアウト、 同じカードサイズ、 同じ並び順) 読み取り専用で表示される。 ボード装飾 (= 背景大文字、 ScrollMeter) は出す、 chrome (= TAG / TUNE / POP OUT / SHARE) は出さない。
5. **受信者 CTA**: 着地画面の下に sticky で 2 つのボタン: 「全部取り込む」 (= bulk import) / 「選びながら取り込む」 (= triage swipe へ)。
6. **bulk import**: 1 タップで全カードを receiver の IDB に追加。 重複は黙って skip、 完了時に小さい toast「N cards saved · M already saved」 を 1 行表示。 sender's tags は適用しない (= cards only)。 取り込み後、 受信者の board へ遷移。
7. **triage import**: `/triage` の体験を流用 (= 同じ TriageCard / TopTagStrip / AmbientBackdrop / Yes-No swipe)。 違いは: (a) queue = 重複以外の shared cards、 (b) chip strip に **receiver's existing tags + sender's tags (= 提案、 dimmed 表示)** を並べる、 (c) YES = card を IDB に保存 + accept した tags を適用、 (d) 完了後に receiver の board へ遷移。
8. **新規ユーザー対応**: receiver が初めて AllMarks を触る場合、 取り込みボタン押下のタイミングで IDB を silent に初期化、 取り込み後そのまま board へ。 確認ダイアログなし。

## 4. Non-goals (= Phase 2/3 以降にまわす、 やらないもの)

- **PNG エクスポート / 画像コラージュ生成**: 完全廃止。 受信側でボードそのものを見せられる以上、 静止画 PNG は不要。
- **送信者によるサムネ位置の微調整 UI** (= ミニマップにドラッグ枠): Phase 1 では「viewport そのまま」 一択。 user が位置を変えたければ board を scroll してから SHARE。
- **送信者の board chrome (= ScrollMeter / 背景大文字) を含めた snapshot**: 含める。 ただし「装飾なしの素朴な作品共有モード」 のような切替は phase 1 では作らない (= 常に装飾込み)。
- **受信側で sender's board chrome を完全再現**: TAG / TUNE / POP OUT / SHARE ボタンは出さない。 受信者は board の装飾は見るが操作 chrome は触らない。
- **受信側で動画自動再生 / multi-playback の発火**: phase 1 では受信側 board は静止画ベース (= Tier 1 viewport playback は受信側は無効化)、 Lightbox 開いた時のみ再生。 動画ボード共有体験は phase 2。
- **expiry を user が選ぶ UI**: phase 1 は 30 日固定。 「90 日にしたい」 「永久に残したい」 等の要望が来たら phase 2 で検討。
- **シェア履歴一覧 (= 自分が作ったシェア URL のリスト)**: phase 1 では作らない。 user は SHARE 押すたびに新規 URL 発行、 過去のは追跡しない。
- **シェアの編集 / 削除 UI**: phase 1 は「作って投げて 30 日後に勝手に消える」 の一方向。
- **受信側広告**: phase 1 は出さない。 取り込み後の自分の board には通常通り出る (= 別 sprint で広告カード混在方式を実装中)。
- **LP の ShareDemoSection 更新**: phase 1.5 以降。 旧 component は phase 1 では touch しない (= LP リデザインの sprint で一緒にやる)。
- **動的 OG image (= リアルタイムレンダリング)**: phase 1 は KV に保存済の WebP をそのまま返す。 動的生成は phase 1.5 以降。
- **旧 URL (= `/share#d=<fragment>`) の後方互換**: 廃止、 404 or 「このシェア URL は古い形式です」 error。 phase 1 launch 前の旧 URL は実質的に誰も使っていない (= 自分のテスト URL のみ)。
- **複数のシェア schema version 共存**: phase 1 は v2 のみ。 将来 v3 が必要になったら schema 内 `v: 2` で fallback する設計余地は残す。

---

## 5. アーキテクチャ概要

```
[送信者ブラウザ]
   ├─ SHARE クリック
   ├─ SenderShareModal 開く
   │   ├─ viewport snapshot 撮影 (= dom-to-image-more → WebP)
   │   ├─ ShareDataV2 構築 (= filteredItems + cards[] + tags{} + filter{})
   │   └─ POST /api/share/create { share, thumb }
   │       └─ Pages Function: KV write (TTL 30d), ID 発行, return { id }
   │
   ├─ URL = `allmarks.app/s/<id>` をクリップボード
   └─ 「X で投稿」 → window.open(X intent URL)

[受信者ブラウザ]
   ├─ allmarks.app/s/<id> 開く
   ├─ Next.js page (= /s/[id]) が SSR で OG meta 出す
   │   ├─ <meta og:image content="allmarks.app/api/share/<id>/og.webp">
   │   └─ Pages Function: /api/share/<id>/og.webp → KV から thumb 返す
   │
   ├─ client 側: GET /api/share/<id> → ShareData 取得
   ├─ ReceiverLanding が board を読み取り専用でレンダリング
   ├─ sticky CTA: 「全部取り込む」 / 「選びながら取り込む」
   │
   ├─ 「全部取り込む」 → bulkImport(shareData)
   │   ├─ IDB 初期化 (新規 user の場合)
   │   ├─ 各 card: 重複チェック → addBookmark
   │   ├─ toast 「N saved · M already saved」
   │   └─ /board へ遷移
   │
   └─ 「選びながら取り込む」 → /s/<id>/triage へ
       ├─ ReceiverTriage (= TriagePage 派生)
       ├─ queue = shared cards minus duplicates
       ├─ chip strip = receiver's tags + sender's tags (= 提案 dimmed)
       ├─ swipe Yes/No、 accept tag click で active
       └─ 完了 → /board へ遷移
```

---

## 6. データスキーマ (= ShareData v2)

### 6.1 KV エントリ構造

```typescript
// KV key: 6-char base62 ID (e.g., "k3p9xv")
// KV value: JSON-serialized:
type KVEntry = {
  share: ShareDataV2
  thumb: string  // base64-encoded WebP, ~5-10KB
}
// KV TTL: 30 days (= expiry 設定)
```

### 6.2 ShareDataV2

```typescript
export type ShareDataV2 = {
  /** Schema version. v1 is the old fragment-based format (廃止). */
  readonly v: 2

  /** Cards in send-order. Up to MAX_CARDS (= 100). */
  readonly cards: ReadonlyArray<ShareCardV2>

  /** Sender's tag dictionary, keyed by tag ID. Absent if no card has tags.
   *  Receiver imports these as "suggestions" (= dimmed chips), not auto-applied. */
  readonly tags?: TagDict

  /** Filter context shown to receiver as small label.
   *  Absent if sender shared "all" (= no filter applied). */
  readonly filter?: {
    readonly mode: 'and' | 'or'
    /** Tag IDs from the `tags` dict above. */
    readonly tagIds: ReadonlyArray<string>
  }

  /** Sender's board background theme hint. Phase 1 always 'wave'. */
  readonly theme?: 'wave'

  /** Unix ms timestamp of share creation. Debug + analytics use only. */
  readonly createdAt: number
}

export type ShareCardV2 = {
  /** Bookmark URL (http/https only, max 2048 chars). */
  readonly u: string
  /** Title (max 500 chars, trimmed). */
  readonly t: string
  /** Description (optional, max 500 chars). */
  readonly d?: string
  /** Thumbnail URL (optional, http/https only). */
  readonly th?: string
  /** URL type — re-detected on import, never trusted. */
  readonly ty: ShareCardType  // 'tweet' | 'youtube' | ... | 'website'
  /** Explicit card width in px (= sender's per-card sizing). */
  readonly cw: number
  /** Aspect ratio = width / height. Receiver re-runs masonry with this. */
  readonly a: number
  /** Sender's tag IDs (= references into ShareData.tags). Optional. */
  readonly tg?: ReadonlyArray<string>
}

export type TagDict = {
  readonly [tagId: string]: {
    readonly n: string       // tag name (e.g., "music")
    readonly c?: string      // tag color hex (optional, sender's color)
  }
}

export const SHARE_LIMITS_V2 = {
  MAX_CARDS: 100,
  MAX_TITLE: 500,
  MAX_DESCRIPTION: 500,
  MAX_URL: 2048,
  MAX_THUMB_BYTES: 50 * 1024,  // 50KB WebP cap (= 通常 5-10KB だが念のため)
  MAX_KV_ENTRY_BYTES: 200 * 1024,  // 200KB total entry cap
} as const
```

### 6.3 ID 生成

6 文字 base62 (`a-zA-Z0-9` ⇒ 62 文字)、 `crypto.getRandomValues()` で生成。 衝突確率：

- 62^6 = 約 568 億通り
- 100 万シェア時点で衝突確率 ≈ 0.0009% (= birthday paradox 1 - exp(-N^2 / 2K))
- KV write 時に exists チェック → 衝突したら再生成 (= 実用上ほぼ起きない)

---

## 7. UI 設計

### 7.1 送信側 SenderShareModal

**起動**: board chrome の `SHARE` chrome button (= 既存 `BoardRoot.tsx:1580` の onClick で既存 `setShareComposerOpen` を `setShareModalOpen` に rename + 新 component を mount)。

**レイアウト** (= AllMarks editorial 黒 panel、 中央、 max-width 480px):
```
┌─────────────────────────────────────────┐
│  SHARE BOARD                         ✕  │ ← header (monospace uppercase, 11px)
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   [viewport snapshot]           │    │ ← preview (300×157 webp, convex bezel)
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  23 CARDS · MUSIC + DESIGN              │ ← meta (緑 accent, monospace 11px)
│                                         │
├─────────────────────────────────────────┤
│  ⌗ allmarks.app/s/k3p9xv      [COPY]    │ ← URL display + copy button (緑 hover)
│  [POST TO X]              [CLOSE]       │ ← actions (緑 fill primary, secondary)
└─────────────────────────────────────────┘
```

**状態**:
- `loading` = modal 開いた直後、 snapshot 撮影 + KV write 中。 preview 枠は skeleton、 URL 部分は spinner。 「COPY」 / 「POST TO X」 は disabled。
- `ready` = URL 取得済、 全 button active。
- `error` = KV write 失敗 (= network etc.)。 「再試行」 button 出す。

**snapshot 撮影**:
- `dom-to-image-more` で `canvasWrap` の現在 viewport (= scroll 位置反映、 chrome は除外) を WebP として撮影
- 縮小 width 600px (= 1200px dpr 2 高解像度デバイス向け retina 対応)、 quality 0.7
- 期待サイズ 5-15KB

**KV write リクエスト**:
- POST `/api/share/create`
- Body: `{ share: ShareDataV2, thumb: base64WebP }`
- Response: `{ id: 'k3p9xv', expiresAt: 1735603200000 }`

**URL 表示**:
- 緑 dot prefix (= `⌗` 風) + `allmarks.app/s/k3p9xv` をモノスペース表示
- click でクリップボードコピー、 1.5 秒 「COPIED」 toast

**X 投稿**:
- `window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(shareUrl), '_blank')`
- 既存 `lib/share/x-intent.ts` を再利用 (= 数行修正のみ)

**閉じる**:
- ESC キー / 背景 click / 「CLOSE」 ボタン
- URL 発行済の KV エントリは消さない (= 30 日後 expiry で自然消滅)

### 7.2 受信側 ReceiverLanding (= `/s/<id>` 着地)

**ヘッダー** (= sticky top、 minimal):
```
┌─────────────────────────────────────────┐
│  A (logo)  · Filtered: MUSIC + DESIGN   │
└─────────────────────────────────────────┘
```
- 左: AllMarks ロゴ (= A モチーフ、 click で AllMarks トップへ = 新規 user 向け onboarding 入口)
- 右: sender's filter context (= 緑 accent monospace、 sender の絞り込み label を表示)

**メイン**:
- 送信者の board と同一 column-masonry layout で全カード描画
- 受信者の viewport 幅に対して masonry を**再計算** (= `relayShareLayout` 系処理を新 schema で書き直す)
- カード click で **Lightbox 起動** (= 既存 Lightbox を read-only mode で再利用)
- 背景大文字タイポ (= sender's filter tags が `MUSIC · DESIGN` 形式で展開) 表示
- ScrollMeter 表示
- 動画カード: thumbnail のみ、 hover/viewport playback 無効化 (= Phase 1 制約)

**Sticky CTA (= bottom):
```
┌─────────────────────────────────────────┐
│   [IMPORT ALL 23]   [PICK ONE BY ONE]   │
└─────────────────────────────────────────┘
```
- 「IMPORT ALL N」 = 緑 fill primary、 click で bulk import 実行
- 「PICK ONE BY ONE」 = secondary outline、 click で `/s/<id>/triage` へ遷移

**エラー状態**:
- expired (= 30 日経過): 「This share has expired. Create your own on AllMarks.」 + AllMarks トップへの CTA
- not found (= 無効 ID): 同上文言
- network error: 「Could not load. Retry?」 + retry button

### 7.3 受信側 ReceiverTriage (= `/s/<id>/triage`)

**ベース**: 既存 `components/triage/TriagePage.tsx` の構造をほぼそのまま流用。 違いを以下に列挙。

**queue**:
- shared cards から **既に receiver IDB にある URL** を除外したリスト
- `useEffect` で初期化時に `getAllBookmarks(db).map(b => b.url)` と比較して filter
- 空の場合は「All cards already in your AllMarks」 表示 + 「Go to board」 CTA

**chip strip (= TopTagStrip)**:
- 既存: receiver の `useTags()` で取った tags を chip として並べる
- 新規: shared cards に紐づく sender's tag を **dimmed (= opacity 0.4 + 縁なし) チップ**として末尾に追加
- 「sender's tag」 chip click → opacity 1.0、 click パルス、 active (= armed) 扱い
- 名前衝突 (= receiver に同名 tag 既存) は dimmed chip 表示せず、 既存 chip を armed にする

**YES swipe**:
- 既存: `persistTags(bookmarkId, armed)` で受信者 IDB の bookmark を更新
- 新規: bookmark **新規追加** が必要 (= `addBookmark` 呼出)
  - sender's tag accept 済 (= armed) なら、 tag ID は receiver 側で発行し直す必要あり (= sender's tagId は receiver の DB に存在しない)
  - 流れ: armed set の各 tag ID について receiver IDB に同名 tag があるか確認 → なければ `addTag(name, color)` で新規作成 → 新 ID を armed に置換 → addBookmark with tags

**NO swipe**:
- 既存: 次のカードへ進む。 何も保存しない。
- 新規: 同上。

**完了時**:
- 「N cards added」 toast + `/board` へ遷移

### 7.4 Modal トンマナ詳細 (= AllMarks デフォルトテーマ準拠)

| 要素 | 値 |
|---|---|
| 背景 | `rgba(8, 8, 10, 0.96)` + `backdrop-filter: blur(20px)` |
| 角丸 | 8px (= board chrome dropdown と統一) |
| 縁 | `1px solid rgba(255, 255, 255, 0.08)` + convex bezel `::after` (= board canvas と同じ照り) |
| primary text | `#ffffff` 92% alpha |
| meta text | `#28F100` 80% alpha (= AllMarks 緑) |
| body font | `Geist Mono` 11px uppercase |
| heading font | `Geist Mono` 11px uppercase + 0.05em letter-spacing |
| 緑 accent | `#28F100` (= AllMarks brand 緑、 logo チェックと同じ) |
| ボタン緑 fill | `#28F100` 12% alpha + 緑 1px border + hover で 24% alpha |
| ボタン secondary | 透明 + `rgba(255, 255, 255, 0.16)` border + hover で 28% alpha |
| open animation | 100ms fade + 8px slide-up |
| close animation | 80ms fade (= 軽快) |

---

## 8. コストモデル

### 8.1 ユニットコスト (= Cloudflare 公式料金 2026)

| サービス | 無料枠 | 有料 ($5/月 Workers Paid) |
|---|---|---|
| KV Read | 100k/日 (= 3M/月) | 10M 含 + 超過 $0.50/1M |
| KV Write | 1k/日 (= 30k/月) | 1M 含 + 超過 $5.00/1M |
| KV Storage | 1GB | 1GB 含 + 超過 $0.50/GB-month |
| Pages Functions リクエスト | 100k/日 | 10M 含 + 超過 $0.50/1M |

### 8.2 スケール別月額試算

仮定:
- 1 user が平均 5 シェア/月生成 = write
- 1 シェアあたり平均 10 view = read
- 1 シェアエントリ = ~55KB (= ShareData 4KB + thumb 50KB)
- 30 日 expiry でストレージは「30 日分の在庫」 で常に同サイズ

| 規模 | KV Read | KV Write | KV Storage | Functions | 月額 USD | 月額 ¥ |
|---|---|---|---|---|---|---|
| 1 万 MAU | 50万 | 5万 | ~280MB | 50万 | $0 | **¥0** |
| 10 万 MAU | 500万 | 50万 | ~2.8GB | 500万 | $5 | **¥800** |
| 100 万 MAU | 5000万 | 500万 | ~28GB | 5000万 | ~$95 | **¥15,000** |

注: 100 万 MAU 試算の内訳: 基本 $5 + Read $20 + Write $20 + Storage ~$15 + Functions $25 + thumb 配信 ~$10 ≈ $95/月。 細部は実装後に Cloudflare ダッシュボードで計測する。

### 8.3 expiry なし (= 永久保存) との比較

参考: もし expiry を切ると、 ストレージは毎月積み上がる (= 100 万 MAU で月 +28GB)。 12 ヶ月で +336GB = 月 +¥18,000、 24 ヶ月で +672GB = 月 +¥36,000。 30 日 expiry を採用することでストレージコストを長期にわたり一定化できる。

---

## 9. ルーティング / API

### 9.1 Next.js Pages

| Path | 役割 |
|---|---|
| `app/(app)/s/[id]/page.tsx` | 受信者着地 (= ReceiverLanding をマウント) |
| `app/(app)/s/[id]/triage/page.tsx` | 受信者 triage (= ReceiverTriage をマウント) |
| `app/(app)/board/page.tsx` | 既存 board (= 取り込み後の遷移先、 変更なし) |
| ~~`app/share/page.tsx`~~ | 旧 SharedView 廃止 (= 削除) |

### 9.2 Cloudflare Pages Functions

| Path | Method | 役割 |
|---|---|---|
| `functions/api/share/create.ts` | POST | KV write (= ShareDataV2 + thumb)、 ID 発行、 30 日 TTL |
| `functions/api/share/[id].ts` | GET | KV read → ShareDataV2 + thumb 返却 (= JSON、 thumb は base64) |
| `functions/api/share/[id]/og.ts` | GET | KV read → thumb (WebP) のみ返却、 OG image エンドポイント |

### 9.3 SSR / SEO

- `app/(app)/s/[id]/page.tsx` の `generateMetadata` で:
  - `<title>` = sender's filter tags or "Shared collection on AllMarks"
  - `<meta property="og:image" content="https://allmarks.app/api/share/<id>/og.webp">`
  - `<meta property="og:title" content="N items on AllMarks">`
  - `<meta property="og:description" content="Filtered: music + design">`
- Cloudflare Pages の SSR は edge runtime で動かす (= `export const runtime = 'edge'`)

---

## 10. ファイル変更計画

### 10.1 新規追加

```
app/(app)/s/[id]/page.tsx                                # 受信者着地 page
app/(app)/s/[id]/triage/page.tsx                         # 受信者 triage page
components/share/SenderShareModal.tsx                    # 送信側 modal (新規 ⇆ 旧 ShareComposer)
components/share/SenderShareModal.module.css
components/share/ReceiverLanding.tsx                     # 受信者着地 UI
components/share/ReceiverLanding.module.css
components/share/ReceiverTriage.tsx                      # 受信者 triage UI (TriagePage 派生)
components/share/ReceiverTriage.module.css
components/share/BulkImportToast.tsx                     # bulk 完了 toast (= 軽量、 緑 accent)
components/share/BulkImportToast.module.css
functions/api/share/create.ts                            # Cloudflare Pages Function (POST)
functions/api/share/[id].ts                              # Cloudflare Pages Function (GET)
functions/api/share/[id]/og.ts                           # OG image endpoint
lib/share/types-v2.ts                                    # ShareDataV2 schema
lib/share/encode-v2.ts                                   # gzip + base64 for KV payload
lib/share/decode-v2.ts                                   # mirror
lib/share/snapshot.ts                                    # viewport WebP capture (dom-to-image-more)
lib/share/import.ts                                      # bulk + triage import logic
lib/share/kv-id.ts                                       # 6-char base62 ID generation
lib/share/api-client.ts                                  # POST create + GET fetch helpers
lib/share/validate-v2.ts                                 # Zod schemas for ShareDataV2

# Tests (vitest)
lib/share/encode-v2.test.ts
lib/share/decode-v2.test.ts
lib/share/snapshot.test.ts
lib/share/import.test.ts
lib/share/kv-id.test.ts
lib/share/validate-v2.test.ts
components/share/SenderShareModal.test.tsx
components/share/ReceiverLanding.test.tsx
components/share/ReceiverTriage.test.tsx
```

### 10.2 削除対象

```
components/share/ShareComposer.tsx + .module.css
components/share/ShareFrame.tsx + .module.css
components/share/ShareSourceList.tsx + .module.css
components/share/ShareAspectSwitcher.tsx + .module.css
components/share/ShareActionSheet.tsx + .module.css     # SenderShareModal に置換
components/share/SharedView.tsx + .module.css           # ReceiverLanding に置換
components/share/use-share-reorder-drag.ts
components/share/use-share-fullscreen.ts + .test.ts
lib/share/aspect-presets.ts + .test.ts
lib/share/board-to-cards.ts + .test.ts
lib/share/composer-layout.ts + .test.ts
lib/share/png-export.ts + .test.ts
lib/share/relay-layout.ts + .test.ts                    # (要再評価、 受信側 masonry で部分流用検討)
lib/share/watermark-config.ts
lib/share/lightbox-item.ts + .test.ts                   # (要再評価、 受信側 Lightbox 統合で部分流用検討)
lib/share/schema.ts                                     # v1 schema 廃止
lib/share/validate.ts + .test.ts                        # v1 validate 廃止
lib/share/encode.ts + .test.ts                          # v1 encode 廃止
lib/share/decode.ts + .test.ts                          # v1 decode 廃止
lib/share/types.ts                                      # v1 types 廃止
app/share/page.tsx                                      # 旧 /share ルート (= 受信側) 廃止
```

### 10.3 維持 + 部分流用

```
lib/share/x-intent.ts + .test.ts                        # X 投稿 URL builder、 そのまま流用
components/board/BoardRoot.tsx                          # SHARE chrome ボタン onClick の参照先を SenderShareModal に切替
components/board/Lightbox.tsx                           # 受信側 ReceiverLanding でも使う、 read-only モード追加
components/triage/TriagePage.tsx + 関連                 # ReceiverTriage がこれの派生として再利用
lib/storage/indexeddb.ts                                # addBookmark / getAllBookmarks 等、 import.ts から呼ぶ
lib/storage/use-tags.ts + tags.ts                       # 受信側 tag 操作で再利用
lib/board/skyline-layout.ts                             # 受信側 masonry 計算で再利用
```

### 10.4 LP 影響 (= phase 1 では touch しない)

```
components/marketing/sections/ShareDemoSection.tsx       # 旧 ShareComposer のデモ、 phase 1 では古いまま放置
components/marketing/LandingPage.tsx                     # 上記の組み込み、 同上
```

phase 1.5 で LP リデザイン sprint と一緒に新シェア体験のデモに作り直す。

---

## 11. テスト戦略

### 11.1 Unit (= vitest)

- `lib/share/types-v2.ts` / `validate-v2.ts`: Zod schema が ShareDataV2 を正しく検証する (= 不正な URL / 長すぎる title / cards 配列空 / 重複 tagId 等)
- `lib/share/encode-v2.ts` / `decode-v2.ts`: roundtrip (= encode → decode で元データに一致)、 大きい payload (= 100 cards) でもサイズ妥当
- `lib/share/kv-id.ts`: 6-char base62 生成、 衝突確率テスト (= 1 万件発行で衝突 0)
- `lib/share/snapshot.ts`: dom-to-image-more wrapper、 WebP encode、 サイズ 50KB 以下
- `lib/share/import.ts`: bulk import の重複検知 (= 既存 IDB の url と比較)、 sender's tag → receiver's tag 変換 (= 同名 merge / 新規作成)
- `lib/share/api-client.ts`: POST / GET 呼出のリクエスト形式

### 11.2 Component (= vitest + jsdom)

- `SenderShareModal`: open/close、 loading 状態、 URL コピー成功 toast、 X 投稿 intent URL 生成
- `ReceiverLanding`: ShareData レンダリング、 sticky CTA 表示、 expired / not found エラー表示
- `ReceiverTriage`: queue 生成 (= 重複除外)、 sender's tag chip 表示 (= dimmed)、 YES で addBookmark 呼出
- `BulkImportToast`: 「N saved · M already saved」 文言表示、 自動 dismiss

### 11.3 Integration (= playwright スクリプト、 手動)

- 送信フロー: board で SHARE 押下 → modal 開く → preview 出る → URL コピー → クリップボード一致確認
- 受信フロー: 上で取った URL を別タブで開く → board レンダリング → 「IMPORT ALL」 押下 → IDB に N 件追加確認
- triage フロー: 受信側 triage 開く → swipe YES で 1 件保存確認、 sender's tag accept チェック
- 重複: 同 URL 再シェア → 受信側で bulk → 既存 user IDB に重複追加されないこと確認、 toast 表示確認

### 11.4 Cloudflare 環境テスト (= preview deploy)

- POST /api/share/create → KV write 成功 → ID 返却
- GET /api/share/<id> → KV read 成功 → JSON 返却
- GET /api/share/<id>/og.webp → WebP 返却、 `Content-Type: image/webp`
- 存在しない ID → 404
- expiry 動作確認 (= TTL 短く設定したテスト ID で expire 後に 404 確認)

---

## 12. 段階リリース計画

### Phase 1 (= 本 spec の範囲、 launch)

§3 Goals 全部。

### Phase 1.5 (= launch 後数週間以内)

- LP の ShareDemoSection を新シェア体験に作り直し
- 動的 OG image (= リクエスト時に sender's snapshot を SVG 合成等で生成、 KV thumb 保存をやめる)
- シェア時の analytics (= 何件作られたか、 何回 view されたか、 何回 import されたか)

### Phase 2 (= 数ヶ月後)

- 受信側で動画 / multi-playback の自動再生
- expiry を user が選べる UI (= 30d / 90d / 永久)
- シェア履歴一覧 (= 自分が作った URL の管理画面)
- シェア URL の編集 / 削除 (= 「やっぱり消したい」 への対応)
- 受信側広告 (= 別 sprint の board 内広告カード混在方式が出来てから)
- shared view → 「自分の AllMarks に board ごとフォーク」 機能 (= 似た board を別 URL として作る)

---

## 13. 実装フェーズへの open questions (= 計画書 phase で解決)

- **dom-to-image-more が WebP encode をサポートする?** → サポートしてなければ canvas API で再 encode する処理を `snapshot.ts` に追加
- **Cloudflare KV から WebP を返す Content-Type の制御**: Pages Function で `Response.headers` に `Content-Type: image/webp` を明示
- **同時 SHARE 発行のレート制限**: 1 user が 1 分に 100 回 SHARE 押せる? 現実的に問題にならない想定だが、 Cloudflare Pages Functions の rate-limit を 1 IP あたり 10 req/分で念のため有効化
- **新規 user の IDB 初期化タイミング**: 「IMPORT ALL」 押した瞬間か、 `/s/<id>` 着地時か。 後者は不要な初期化を発生させるので前者で確定
- **Lightbox を read-only モードで動かす方法**: 既存 Lightbox は IDB の bookmark を直接 query するので、 受信側では「ShareData の cards を仮想的な bookmark として渡す adapter」 が必要。 既存 `lib/share/lightbox-item.ts` の流用検討
- **受信側 masonry 計算**: 既存 `relayShareLayout.ts` は v1 schema 前提なので、 v2 用に書き直し or 部分流用判断
- **sender's tag 名前衝突時の挙動**: 「receiver に既に同名 tag (= "music") 既存、 sender も "music" tag」 のとき、 受信側でどっちの色を採用する? 推奨: receiver の既存色を維持 (= 上書きしない)、 sender's tag は ID merge のみ
- **TriagePage の流用粒度**: ReceiverTriage は `TriagePage` を直接 import するのか、 共通 helper に切り出して両方が使う形にするのか。 推奨: 後者 (= `useTriageEngine.ts` のような hook 抽出)、 ただし sprint 量増える
- **境界: 0 件シェア / 1 件シェア**: フィルタ後 0 件のとき SHARE ボタンを disabled にする? それともクリック後に modal で「シェアするカードがありません」 表示?

これらは plan phase (= `superpowers:writing-plans` skill) で詳細詰める。

---

## 14. メトリクス / 成功指標 (= phase 1.5 で計測開始)

- **生成数**: 1 日あたりの新規シェア URL 発行数
- **CTR**: シェア URL を踏まれた回数 / SNS 投稿数
- **取り込み率**: 受信者が「IMPORT ALL」 or 「PICK ONE BY ONE」 を押した割合
- **取り込み完走率**: triage 開始 → 最後まで swipe した割合
- **新規 user 獲得**: シェア経由で初めて IDB 初期化した user 数
- **expiry 影響**: 30 日 expire 後に踏まれる「死んだ URL」 のリクエスト数 (= 高いなら 90 日に延長検討)

phase 1 では計測しない (= analytics 入れる sprint は phase 1.5)。

---

## 15. リスク / 想定外シナリオ

- **KV write 障害**: SHARE 押したのに URL 発行できない。 → modal の error 状態で「再試行」 button + 「失敗が続くなら時間を置いてください」 文言
- **大量シェア攻撃**: 悪意ある user が 1 秒間に 1000 シェア発行 → KV write リミット消費 + コスト爆発。 → Cloudflare Pages Functions の rate-limit (= 1 IP あたり 10 req/分) で防ぐ
- **巨大カード数 (= 100 件超え) のシェア試行**: クライアント側で MAX_CARDS チェック、 超えたら modal で「100 件まで」 警告 + SHARE 不可
- **WebP 撮影が遅い (= 100 カードボードで 3 秒以上)**: 受信側ボード再現用のデータ取得を background で進めつつ、 thumb は viewport だけなので影響なし
- **expired URL を SNS に貼った後で 30 日経過**: 受信者は error ページ着地。 受け入れる (= 1 ヶ月以内に見てもらえる前提のシェア体験)
- **新規 user の予期せぬ IDB 初期化**: 「IMPORT ALL」 押したつもりが、 既存 user IDB を上書きすることはない (= 既存 user は init をスキップ)
- **sender's tag が極端に多い (= 50 個)**: chip strip overflow → 既存 TopTagStrip の overflow 処理 (= horizontal scroll) で吸収

---

## 16. リリース判定基準

phase 1 を本番出すための最低条件：

- [ ] 全 §3 Goals 機能完了
- [ ] vitest 新規 + 既存 すべて pass
- [ ] tsc 0 errors
- [ ] preview deploy で送信→受信→ bulk import / triage import 全て手動動作確認
- [ ] expiry 動作確認 (= 短 TTL テスト ID で 404 確認)
- [ ] OG image が X / Discord で実際に preview 表示確認
- [ ] 新規 user (= 別ブラウザ + IDB clear) でも取り込み動作確認
- [ ] 既存 user (= IDB 有り) で重複処理動作確認
- [ ] 1 日 16 deploy 上限内で完結

---

## 17. このセッション以降の作業順

1. **本 spec の user review** (= 今ここ) → 承認 / 修正
2. `superpowers:writing-plans` で実装計画書を書く (= 各タスクの順序、 依存、 検証方法)
3. plan の user review
4. 実装着手 (= 既存ファイル削除は最後にしてリスク減らす、 新規ファイル追加から)
5. preview deploy で動作確認
6. 本番 deploy
7. session 終了時の close-out (= TODO_COMPLETED 追記、 CURRENT_GOAL 更新)
