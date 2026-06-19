# Paste-to-Save — 設計書 (spec)

> ボードにフォーカスがある状態で URL を Ctrl+V / 右クリック貼り付けすると、その場でブクマとして取り込む。
> 作成: 2026-06-19 (session 113) / brainstorming 承認済み

---

## 1. 目的

インストール不要の「第3の保存方法」を成立させる。現状の保存はブックマークレットと Chrome 拡張のみで、**「URL をボードに貼って保存」という、コピー全体が主役として宣伝してきた経路が実装されていない**。これを埋める。

ユーザー像は非エンジニア。体験は「コピーした URL をボードで Ctrl+V → その場でカードが生えて育つ」。

---

## 2. スコープ

### やること (MVP)
- ボード(`/board`)で `paste` イベントを拾い、クリップボードが**単一の http(s) URL**のときだけ取り込む。
- URL 種別を既存ロジックで判別し、埋め込み系は生きたカード、一般サイトは `/api/ogp` でサムネ取得。
- 楽観的表示(貼った瞬間にテーマ駆動の読み込み中カード → 取れ次第差し替え)、新着ハイライト、重複は Already saved、失敗はフォールバック保存。

### やらないこと (将来)
- 文中からの URL 抽出 (例: 「いいよ https://…」) — `extractUrlFromText` が既にあるので後で容易に拡張可。
- 複数 URL の一括貼り付け。
- クリップボード画像データの取り込み。
- 受け取り画面 `/s/*` での貼り付け(ボード本体のみ)。

---

## 3. トリガとガード

### 3.1 イベント
- `document` レベルの `paste` リスナを board マウント時に登録(キーボード Ctrl/Cmd+V も右クリック「貼り付け」も同じ `paste` イベントで届く)。
- `event.clipboardData.getData('text/plain')` を読む。

### 3.2 横取りしない条件 (最重要 — 通常コピペを壊さない)
以下のいずれかなら**何もしない**(ブラウザ既定の貼り付けに任せる):
- `document.activeElement` が編集可能 = `input` / `textarea` / `contenteditable`(タグ入力欄・検索欄・将来の入力 UI)。
- `event.target` を遡って編集可能な祖先がある場合。
- クリップボードのテキストが、トリム後に**単一の http(s) URL ちょうど一致**でない(`isValidUrl(trimmed)` が false、または空白を含む複数トークン)。

ガード判定は純粋関数に切り出してテストする(§6.1)。

---

## 4. 取り込みフロー

```
paste → ガード通過 → URL確定
  ├─ detectUrlType(url)
  │    ├─ tweet/youtube/tiktok/instagram/vimeo/soundcloud (埋め込み系)
  │    │     → OGP取得は不要。URL/ID からカードが自前描画。
  │    │       addBookmark(type) で即保存。
  │    └─ website (一般サイト)
  │          → GET /api/ogp?url=… で {title,description,image,siteName,favicon} 取得
  │            (8秒タイムアウト。失敗時は空メタ=フォールバック)
  └─ 重複チェック → addBookmark → 新着通知
```

### 4.1 重複判定
既存の作法に揃える(SaveToast と同一):
```
const all = await getAllBookmarks(db)
const existing = all.find((b) => b.url === url && !b.isDeleted)
```
重複なら addBookmark せず、Already saved (⚠ アンバー) を一瞬出す。削除済み(`isDeleted`)の同 URL は重複扱いしない(再取り込み可)= 既存ポリシー準拠。

### 4.2 保存ペイロード (既存 `addBookmark` 再利用)
```
addBookmark(db, {
  url,
  title,        // website: og:title || <title> || ''  / 埋め込み系: '' (カードが解決)
  description,  // website: og:description || ''
  thumbnail,    // website: /api/ogp の image  / 埋め込み系: ''
  favicon,      // website: /api/ogp の favicon
  siteName,     // website: og:site_name
  type: detectUrlType(url),
  tags: [],
})
```
保存後 `postBookmarkSaved({ bookmarkId })` で board に通知(既存経路)。

### 4.3 取得タイミング (確定した方針)
**「メタ取得 → 単一 addBookmark」**(ブックマークレット/拡張と同じく、メタを集めてから1回書く)。
- 埋め込み系は取得不要なので即 addBookmark(ほぼ瞬時)。
- 一般サイトは `/api/ogp` の応答(最大8秒)を待つ間、**ボード state 上の一時的な読み込み中カード**を表示。応答後に本物のカードへ確定。
- タイムアウト/失敗でも**必ず**フォールバックメタ(title=ドメイン名 等)で addBookmark する(取りこぼさない)。
- トレードオフ: 取得中(≤8秒)にタブを閉じると保存は成立しない。MVP では許容(更新パスを足す複雑さを避ける)。

---

## 5. 楽観的表示とフィードバック (テーマ駆動)

横断原則: **読み込み中 skeleton・新着ハイライト・ピルはハードコードせず、アクティブテーマのトークン駆動**にする(先例 `ImportProgressIndicator`)。現テーマ(`dotted-notebook`/`grid-paper`)では既定の音波モチーフで描画され、将来テーマを足せば自動で着替わる。

- **読み込み中カード**: 貼った瞬間に出る、テーマ駆動の skeleton(音波の脈動)。一般サイトでのみ目に見える時間が出る(埋め込み系は即確定)。
- **確定**: メタが揃ったら本物のカードへふわっと差し替え → 既存の**新着ハイライト**で着地。
- **重複**: カードを足さず、既存ピル言語で **Already saved (⚠ アンバー)** を一瞬。
- **失敗**: エラーを煽らず、フォールバックカードとして静かに着地(✓緑の新着扱い)。

UI 文言は既存ピルの語彙(`Already saved` 等)を verbatim 流用。新規の生スクロールバーや AI 的演出は出さない。

---

## 6. ユニット分割 (独立して理解・テスト可能に)

### 6.1 `lib/board/paste-url.ts` (純粋関数)
- `extractSinglePastedUrl(text: string): string | null` — トリム後に単一 http(s) URL ちょうどなら返す、それ以外 null。`isValidUrl` を内部利用。
- `isEditableTarget(el: EventTarget | null): boolean` — input/textarea/contenteditable 祖先判定。
- 単体テスト対象(URL/非URL/複数トークン/前後空白/編集要素)。

### 6.2 `lib/board/paste-ingest.ts` (オーケストレーション、fetch 注入可)
- `ingestPastedUrl(url, deps): Promise<IngestResult>` — detectUrlType 分岐、website なら ogp fetch(注入された fetcher)、重複チェック、addBookmark 呼び出し。`deps` に db/fetch を注入してテスト可能に。
- 返り値 `IngestResult = { outcome: 'saved' | 'duplicate' | 'fallback', bookmarkId? }`。

### 6.3 `useUrlPasteSave` (board のフック)
- `document` に paste リスナ登録/解除、ガード適用、読み込み中カード state、`ingestPastedUrl` 呼び出し、フィードバック表示。
- BoardRoot から呼ぶ。IndexedDB は `typeof window !== 'undefined'` 前提の client。

### 6.4 フィードバック描画
- 読み込み中カード/Already-saved ピルはテーマトークン参照(`ImportProgressIndicator` のパターンに合わせる)。可能なら同コンポーネント/同 util を再利用。

---

## 7. 再利用マップ (既存資産)

| 必要なもの | 既存実体 |
|---|---|
| サーバー側 OGP 取得 | `functions/api/ogp.ts`(`GET /api/ogp?url=` → `{title,description,image,siteName,favicon,url}`、8秒timeout、稼働中) |
| URL 種別判別 | `lib/utils/url.ts` `detectUrlType` / `isValidUrl` / `extractUrlFromText` |
| 保存書き込み | `lib/storage/indexeddb.ts` `addBookmark` / `getAllBookmarks` |
| 保存通知 | `postBookmarkSaved`(SaveToast が使用) |
| サムネ解決/フォールバック描画 | `lib/storage/use-board-data.ts` `deriveThumbnail` + `ImageCard` |
| 取り込みインジケータ(テーマ駆動の先例) | `components/share/ImportProgressIndicator.tsx` |

---

## 8. エラー処理・エッジケース

- `/api/ogp` が 4xx/5xx/timeout → 空メタ扱いでフォールバック保存(エラー表示なし)。
- クリップボード読めない(権限)→ 何もしない(既定貼り付けに任せる)。
- 同一 URL の連打 → 2回目以降は重複として Already saved。
- 埋め込み系で再生不可(Instagram 等)→ 既存のリンクアウトカード挙動に従う(貼り付け固有処理なし)。
- 非常に長い/壊れた URL → `isValidUrl` で弾く。

---

## 9. テスト

- 単体: `extractSinglePastedUrl` / `isEditableTarget`(§6.1)、`ingestPastedUrl`(fetch/db モックで saved/duplicate/fallback/embeddable 分岐)。
- 既存テスト維持: SaveToast の重複ロジックと同等であることを確認。
- 手動/本番: 一般サイト・ツイート・YouTube を貼って、読み込み中→確定→新着ハイライト、重複時 Already saved、`/api/ogp` 失敗時フォールバックを実機確認。

---

## 10. 未確定・計画フェーズで詰める点

- 読み込み中カードを「board の cards 配列に一時要素として差し込む」か「cards とは別レイヤーの placeholder で重ねる」か(既存 CardsLayer の構造を読んで決める)。
- テーマトークン名(skeleton 用)の有無 — 無ければ `ImportProgressIndicator` が使うトークンを流用 or 追加。
- Web Share Target 経路(`extractUrlFromText` の現利用者)が既に URL→addBookmark を持つなら、取り込みロジックを共通化できるか確認。

---

## 11. コピーへの波及 (別作業だが関連)

本機能が入ると、保存セクションのコピー(features/guide/faq)を「貼り付け・ブックマークレット・拡張の3経路」で正直に書ける。コピー修正は本 spec とは別タスクで一括実施(15言語)。
</content>
