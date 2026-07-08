# #8 共有画像の一時保管 — 「画像＋リンク」で SNS 投稿（X でも確実に画像表示）設計

- 日付: 2026-07-08（セッション 174）
- ステータス: 設計確定（ユーザー承認済み）
- 関連: TODO.md バックログ #8 / s169「レプリカ再構成しない」決定の**発展**（覆すのではなく、手動スクショを土台に据える）
- 前提スキル: brainstorming（本 spec）→ writing-plans（実装計画）

---

## 1. ゴール（一言）

ユーザーがアレンジしたコラージュを、**「本物のコラージュ画像を背負った共有リンク」**にして SNS に投稿できるようにする。
流れ（ユーザー発案・そのまま採用）：

1. コラージュをアレンジ（既存）
2. 画面の案内どおり**自分でスクショを撮る**（Win+Shift+S 等）
3. 撮った画像を**貼り付け(Ctrl+V)／ドロップ**でアプリに渡す
4. **「共有リンクを作る」** → 画像＋共有データがサーバーへ（既存の保管路）→ リンクが返る
5. **「Xに投稿」／「リンクをコピー」／（スマホ）ワンタップ共有** で拡散

狙い：リンクを貼ると**プレビューに本物のコラージュが出る**（今は汎用カード /og.png）。
「画像で目を留めさせ、リンクで AllMarks に流入」＝ミッション（表現・共有・バイラル）の導線を完成させる。

---

## 2. なぜ「自分で撮ったスクショ」なのか（自動画像化を選ばない根拠）

自動でコラージュを画像化するのは**技術的に今も不可**。実測で確定した事実：

- 盤面カードの `<img>` は**生の外部 URL**（`pbs.twimg.com` 等）を `crossOrigin` 無しで読む
  （[ImageCard.tsx:174-197](../../../components/board/cards/ImageCard.tsx) / [CardNode.tsx:49](../../../components/board/CardNode.tsx)）。
- サムネは**外部 URL 文字列**として保存され、data-URL/Blob 化していない
  （[indexeddb.ts:26-27](../../../lib/storage/indexeddb.ts) / [use-board-data.ts:88-89](../../../lib/storage/use-board-data.ts)）。同一オリジン画像 proxy も**無い**。
- よって dom-to-image / canvas で撮ると**クロスオリジン汚染で該当カードが真っ白**（コード自身が明言：[ShareMirror.tsx:264-271](../../../components/share/ShareMirror.tsx)「pbs.twimg.com は ACAO を返さない」）。s169 が手動スクショに倒した理由そのもの。

→ **ユーザー自身のスクショは同一オリジンの綺麗な画像**なので汚染ゼロ。s169 で却下した「偽プレースホルダで埋める複製」も踏まない。**手動スクショが唯一きれいな道**。

（自動画像化を将来やるなら別案 = 同一オリジン画像 proxy 新設。手間＋プライバシー/帯域コストにつき**本 spec の対象外・後回し**。）

---

## 3. 「X で確実に画像を出す」土台（LoPo 実証レシピの移植）

姉妹プロジェクト LoPo（lopoly.app / `FF14Sim`）が**同じ症状（Discord は出る／X だけ小さい summary カード）を実際に解決**した記録から移植する。

**LoPo が突き止めた要点**（`FF14Sim/docs/superpowers/plans/2026-04-18-ogp-static-cache-with-auto-cleanup.md` ＋ `api/share/_sharePageHandler.ts:96` のコメント）：

- `twitter:card=summary_large_image` は**最初からあった＝それだけでは直らない**。
- 効いた修正：OG 画像を **`/api/` 配下から外し**、`/og/{hash}.png` という**静的ファイル風の同一オリジン URL**で、**リダイレクトせず HTTP 200 で画像バイトを直接**返す（＋長期 immutable キャッシュ＋投稿前にキャッシュを温める）。コード内コメント：「**X クローラーが `/api/` プレフィックスを嫌う問題を回避**」。

**AllMarks の現状は LoPo の地雷を踏んでいる**（実測）：

- OG 画像は **`/api/share/<id>/og`**（＝`/api/` 配下）で配信（[og.ts](../../../functions/api/share/[id]/og.ts)）。
- 画像が無い共有は **302 リダイレクト**で `/og.png` に飛ばしている（同 og.ts 末尾）。
- 一方で良い点：`twitter:card=summary_large_image` は成功ページに**既にある**（ルート [app/layout.tsx:67](../../../app/layout.tsx)、`patch-share-html` は twitter:card を触らない）。robots も `/api/`・`/og/` を**塞いでいない**（[app/robots.ts](../../../app/robots.ts) の disallow に無し）＝crawl 可。

→ **本 spec の新規サーバー作業＝「OG 画像を `/api/` の外の静的風 URL から 200 直接配信に変える」だけ**。保管（create.ts）と R2/KV は無改造。

---

## 4. アーキテクチャ / コンポーネント

### 4.1 サーバー（小さい変更）

**(S1) 新規 OG 配信ルート `/og/<id>`（非 `/api/`・200 直接・無リダイレクト）**
- ファイル：`functions/og/[id].ts`（Cloudflare Pages Function → ルート `/og/:id`）。
- 動作：`id` を検証（`isValidShareId`。拡張子付き `<id>.jpg` で来たら末尾 `.jpg` を剥がす）→ **R2 `SHARE_OG.get(id)` → 200 で画像バイト直接**（`Content-Type` は R2 の httpMetadata、無ければ `image/jpeg`）。
- キャッシュ：`Cache-Control: public, max-age=31536000, immutable`（共有 id の画像は不変。crawler に優しい）。
- **画像が無い時も 302 しない**：既定カード `/og.png` の**バイトを同一オリジンから取得して 200 で返す**（`ctx.env.ASSETS.fetch` or `${origin}/og.png` を fetch）。＝どんな時もリダイレクト無しの 200。
- 旧 `/api/share/[id]/og.ts` は**後方互換で残す**（既存 crawl キャッシュ用。無改造）。

**(S2) `patch-share-html.ts` の OG 画像 URL 差し替え**
- `og:image` と `twitter:image` の向き先を `${baseUrl}/api/share/${id}/og` → **`${baseUrl}/og/${id}.jpg`** に変更（[patch-share-html.ts:42,69-72](../../../functions/s/patch-share-html.ts)）。
- `og:image:width/height`（現 1200×628）は §5 の正規化サイズ（1200×630）に合わせて **630** に統一。
- `patch-share-html.test.ts` / `assert-share-template.mjs` の対象アンカー（`og:type` 注入・`<head>` 等）は不変。**注入する URL 値のみ更新**。
- `/s/<id>` はリクエスト毎に再パッチされるため、**旧共有も自動で新 URL を指す**（R2 は同 id を読む＝移行不要）。

**(S3) ルーティングの実機検証（scar 対策）**
- 過去 `.webp` 拡張が「どの関数にも当たらず Next 404 HTML」を返した傷（[patch-share-html.ts:38-42](../../../functions/s/patch-share-html.ts)）がある。
- よって **`/og/<id>.jpg` が実 Cloudflare で関数に届き 200 を返すことを deploy 後に curl で必ず確認**。もし 404 なら拡張子なし `/og/<id>` に切替（S1/S2 を無拡張で再配線）。**この判定は plan の deploy タスクで実施**。

### 4.2 クライアント（中規模・ここが主作業）

**(C1) スクショ受け口（アレンジモード）**
- アレンジ中の下部（[ShareToast](../../../components/board/ShareToast.tsx) 周辺）に「スクショを貼る／ドロップ」受け口を追加。
- 入力手段：**貼り付け(Ctrl+V, `paste` イベントの `clipboardData.items` 画像)** ／ **ドラッグ&ドロップ** ／ **ファイル選択**（保険）。
- 画像以外は無視して優しいヒント。既存の撮り方1行ヒント（[screenshot-hint.ts](../../../lib/share/screenshot-hint.ts)）は据え置き（「①こう撮る → ②ここに貼る」の順路に）。

**(C2) 画像正規化 純関数 `lib/share/normalize-shot.ts`**
- 入力：ユーザー画像（`File`/`Blob`/data-URL）→ `<img>` デコード → `<canvas>` に **1200×630 で cover 描画** → **JPEG data-URL**（`canvasToJpegUnderTarget` を [capture-mirror.ts](../../../lib/share/capture-mirror.ts) から共有利用）でバイト予算内に圧縮。
- 出力：`data:image/jpeg;base64,...`（create.ts の regex `^data:image/(jpeg|webp);base64,` に適合）。
- ユーザー画像は**同一オリジン**なので汚染せず `toDataURL('image/jpeg')` が通る。
- cover（外側を少しトリミングして全面）採用理由：フルブリードの方がプレビュー映えする。盤面パネルは概ね横長で 1.9:1 に近く欠けは僅少。**微調整余地としてメモ**（contain 化は後日容易）。
- テスト：サイズ/予算の純ロジックを検証（jsdom で canvas 制約時は draw を no-op ガード。方針は capture-mirror と同じ）。

**(C3) 「共有リンクを作る」→ 作成 → アクション**
- 既存の [buildShareDataFromBoard](../../../components/board/BoardRoot.tsx)（`selectedIds` を盤面順・`filter:null`）で `share` を組み、正規化 thumb を付けて **既存 [createShare](../../../lib/share/api-client.ts)`({ share, thumb })`** を呼ぶ（サーバー無改造で R2 保管まで通る）。
- 返った `id` → `url = ${origin}/s/${id}`。
- **キャッシュ温め**：作成直後に `fetch(${origin}/og/${id}.jpg)` を fire-and-forget（投稿前に CF エッジ＆crawler が拾いやすく）。
- アクション（死蔵 [SenderShareModal](../../../components/share/SenderShareModal.tsx) の実装済みパターンを流用）：
  - **COPY LINK**：`url` をクリップボードへ（既存 [copy-share-link.ts](../../../lib/share/copy-share-link.ts) 系。画像添付時も同じ URL。ラベルは既存の COPY→COPIED✓ サイクル）。
  - **POST TO X**：`https://twitter.com/intent/tweet?url=<url>&text=<任意>` を新規タブで開く（X 側で OG 画像 unfurl）。
  - **（スマホ）SHARE**：`navigator.canShare?.({ files:[file] })` が真なら、正規化 JPEG を `File` 化して `navigator.share({ files, text, url })` ＝**画像そのものを添付**して1タップ投稿（X でも確実に画像）。非対応環境では非表示。

**(C4) 画像なしでも壊れない**
- スクショを貼らずに COPY LINK した場合も**従来どおり動く**（サーバー thumb 任意。プレビューは §4.1 の 200 直接フォールバックで既定カード）。＝画像添付は「プレビューの格上げ」。

---

## 5. データフロー（1本道）

```
アレンジ → ユーザーがスクショ → 貼付/ドロップ
  → normalize-shot（1200×630 JPEG data-URL・同一オリジン・無汚染）
  → createShare({ share, thumb })            [既存・無改造]
     → KV: share データ / R2 SHARE_OG[id]: 画像   [既存・無改造]
  → returns { id } → url = /s/<id>
  → warm: fetch(/og/<id>.jpg)                 [新規・fire-and-forget]
  → ユーザーが url を投稿
     → crawler GET /s/<id> HTML（patch で og:image = /og/<id>.jpg）
     → crawler GET /og/<id>.jpg → 200 画像バイト直接（無リダイレクト）
     → カードに本物のコラージュ表示
```

---

## 6. 主要な決定（既定値・後で微調整可）

| 論点 | 決定 |
|---|---|
| 画像の入れ方 | 貼付(Ctrl+V)＋ドロップを主、ファイル選択を保険。クリップボード自動読取は権限が不安定なので MVP 見送り |
| 正規化サイズ | 1200×630（X summary_large_image 適合・declared メタと一致）、cover 描画、JPEG |
| OG 画像 URL | `/og/<id>.jpg`（非 `/api/`・200 直接・無リダイレクト・immutable）。実機で 404 なら無拡張 `/og/<id>` に退避 |
| 旧ルート | `/api/share/<id>/og` は後方互換で残置（無改造） |
| 画像なし COPY LINK | 従来どおり可（既定カードプレビュー） |
| POST TO X | intent URL（PC は unfurl 頼み／スマホは Web Share で画像添付が確実） |

---

## 7. エラー処理

- 貼付/ドロップが画像でない → 無視＋ヒント。
- 正規化後もバイト上限超過（create.ts thumb cap = `MAX_THUMB_BYTES*2`≈600KB）→ 品質を段階的に下げ、なお超過なら「画像が大きすぎます」トースト。
- `createShare` 失敗 → トースト。**貼った画像は保持**して再試行可。
- Web Share 非対応 → SHARE ボタン非表示（COPY/POST TO X は残す）。
- クリップボード読取不可環境 → 貼付/ファイルで代替（自動読取に依存しない）。

---

## 8. テスト戦略

- **純関数 vitest**：
  - `normalize-shot`：出力サイズ/予算ロジック（canvas 制約下の no-op ガード込み）。
  - `functions/og/[id].ts`：R2 ヒット→200 直接／R2 ミス→既定バイト 200（**決してリダイレクトしない**ことを assert）／不正 id→404／`.jpg` 剥がし。
  - `patch-share-html`：og:image・twitter:image が `/og/<id>.jpg` を指す／**og:image は1個だけ**（B3 リグレッションガード維持）／width/height=630。
- **Playwright（out/ ローカル or 本番）**：アレンジ到達（[reference_playwright_board_share_verify] 手順：SELECT ALL→ARRANGE、IDB 事前投入でオンボ/データ窓回避）→ テスト画像を `paste` イベントで注入 → CREATE → URL 取得 → `/s/<id>` HTML の og:image が `/og/<id>.jpg` → `/og/<id>.jpg` が **200 image/jpeg で直接**（リダイレクト無し）。
- **手動（ユーザー1回）**：実際に X に貼って**大きい画像カード**が出るか。※クローラー相手のため自動テストでは 100% 保証不可。ここだけ実機確認。

---

## 9. スコープ境界（YAGNI）

- 自動画像化・画像 proxy・サーバー側画像生成（Satori 等）は**やらない**（ユーザーのスクショが画像）。
- 新規ストレージは**作らない**（既存 SHARE_OG / KV）。
- 受信ページ（`/s/<id>` の SharedBoard 表示）は**無改造**。
- 旧 SHARE ドロワー（`SenderShareModal`）は死蔵のまま（実装パターンだけ流用）。

---

## 10. リスクと緩和

| リスク | 緩和 |
|---|---|
| X が結局画像を出さない（クローラー不確実） | LoPo 実証レシピ（非 `/api/`・200 直接・温め）に準拠＋スマホは画像添付が確実＋PC は最悪ユーザーが手元スクショを手動添付可（画像は既に手元にある） |
| `/og/<id>.jpg` が CF で 404（.webp scar 再発） | **deploy 後 curl 検証を必須タスク化**。404 なら無拡張 `/og/<id>` に退避 |
| OG URL 変更が旧共有に影響 | patch はリクエスト毎再実行＋新ルートは同 R2 を読む＋旧ルート残置＝移行不要 |
| 正規化で汚染 SecurityError | 入力はユーザー自身のスクショ＝同一オリジンなので発生しない（外部カード画像は一切触らない） |
| キャッシュ温めが投稿に間に合わない | immutable 長期キャッシュ＋作成直後 fetch。X が後追い crawl でも 200 が返るので最終的に表示 |

---

## 11. 成果物一覧（plan で分割）

新規：`functions/og/[id].ts`(+test)、`lib/share/normalize-shot.ts`(+test)、スクショ受け口 UI（ShareToast 拡張 or 小コンポーネント）、作成＋アクション配線（BoardRoot）。
変更：`functions/s/patch-share-html.ts`(+test)、`scripts/assert-share-template.mjs`（アンカー不変・確認のみ）、`ShareToast.tsx`（アクション追加）。
無改造：`functions/api/share/create.ts`、R2/KV、`SharedBoard`、受信ルート。
