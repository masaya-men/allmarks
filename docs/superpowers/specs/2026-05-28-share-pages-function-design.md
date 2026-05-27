# Share Receiver Pages Function 設計仕様書 (= Phase 7 / session 85)

> session 84 で発覚した `output: 'export'` + edge runtime + 動的セグメントの架構衝突を解消するための設計。 session 83 の design spec (= [2026-05-27-share-rebuild-design.md](./2026-05-27-share-rebuild-design.md)) の §9 routing の差し替え。

## 1. 問題のおさらい

session 83 設計時に「per-id 動的 OG metadata を返したい」 → Next.js の `runtime = 'edge'` + `dynamic = 'force-dynamic'` を選択。 しかし:

- プロジェクトは `next.config.ts` で `output: 'export'` (= 完全静的書き出し、 事前に全 HTML を生成して Cloudflare に配置)
- 静的書き出しは動的セグメント `[id]` に対し `generateStaticParams()` で事前列挙必要
- シェア ID は user 操作で実行時生成 → 事前列挙不可能
- `pnpm build` が `Cannot find module 'app-edge-has-no-entrypoint'` で死亡

## 2. 解決方針 (= 確定済、 user 「B」 承認)

**Next.js page を廃止 → Cloudflare Pages Function で HTML を直接返す**

Cloudflare Pages は `functions/` 配下のファイルを request 時実行する Workers ランタイム。 既存 `functions/api/share/{create, [id], [id]/og}.ts` は既に動いている。 同じパターンで `/s/[id]` 用の HTML 返却 Pages Function を追加する。

## 3. アーキテクチャ全景

```
[User Browser]                                          [Cloudflare Edge]
                                                        
  https://allmarks.app/s/k3p9xv ─────── GET ───────►  functions/s/[id].ts (= 新規)
                                                          │
                                                          ├─ KV lookup (= SHARE_KV.get("k3p9xv"))
                                                          ├─ decode payload
                                                          ├─ HTML テンプレート組み立て
                                                          │  - per-id OG meta (og:image = /api/share/k3p9xv/og.webp)
                                                          │  - per-id title (= "Shared collection on AllMarks")
                                                          │  - React app shell mount-point div
                                                          │  - JS bundle <script> (= 既存 Next.js export 流用)
                                                          │
                                                          ▼
                                              HTML response (status 200)
                                                          │
  ◄────────── HTML + OG meta ────────────────────────────┘
  │
  ├─ JS bundle load (= ReceiverLanding component)
  ├─ window.location.pathname から ID 抽出 (= "k3p9xv")
  ├─ fetch('/api/share/k3p9xv') で payload 再取得
  ├─ ReceiverLanding render (= masonry + bulk import + Lightbox + 背景タイポ)
  └─ 受信者操作
```

`/s/[id]/triage` も同じパターンで `functions/s/[id]/triage.ts`。

## 4. 設計上の決定事項

### (4.1) HTML テンプレートのインライン埋め込み vs 別 HTML ファイル参照

**選択**: インライン文字列で組み立てる

理由:
- KV から payload を取って per-id OG を埋めるためには response 時に動的組み立てが必要
- 別ファイル参照だと結局 fetch + replace になり 1 段増える
- HTML サイズは ~5KB 程度、 Pages Function のレスポンスサイズに余裕

### (4.2) React app shell の JS bundle はどこから来るか

**選択**: 既存 Next.js `output: 'export'` の build 出力から流用

- `pnpm build` で `out/` に `_next/static/chunks/*.js` が生成される
- HTML テンプレート内で `<script src="/_next/static/chunks/main-app-XXXX.js" />` 参照
- Cloudflare Pages は `out/` を静的配信する設定 → `/_next/static/*` は自動で配信される
- bundle のファイル名にハッシュが入る (= cache busting) ので、 deploy ごとに変わる

**課題**: Pages Function (= server-side) がどうやって最新の bundle ファイル名を知るか?

**解決策**:
- build 時に `_next/static/chunks/main-app-XXXX.js` のファイル名を抽出して `functions/s/_bundle-manifest.json` に書き出す build hook を追加 (= `next.config.ts` の `webpack.optimization` + 自前 plugin、 もしくは `pnpm build` 後の post-build script)
- Pages Function は起動時に manifest を読み込んでファイル名を解決
- OR: HTML response に `<script type="module">import('/_next/static/...')</script>` で動的解決させる (= 複雑)
- **推奨**: post-build script で manifest 生成、 シンプル

### (4.3) ReceiverLanding が ID を取る方法

**選択**: `useEffect` で `window.location.pathname` から正規表現抽出

```tsx
useEffect((): void => {
  const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9]{6})(?:\/triage)?$/)
  if (!match) {
    setState({ kind: 'error', code: 'invalid', message: 'invalid share URL' })
    return
  }
  const shareId = match[1]
  // ... existing fetch logic
}, [])
```

現状の `ReceiverLanding` は `shareId` を props で受け取っているが、 Pages Function 経由だと props 渡せない (= HTML テンプレートに inline できる data 属性経由は可能だが、 シンプルさのため pathname 抽出を採用)。

- triage page も同様、 pathname `/s/<id>/triage` から抽出
- 既存 ReceiverLanding/ReceiverTriage の `shareId: string` prop は撤去、 内部で pathname 抽出に置き換え

### (4.4) per-id OG metadata の inline

HTML テンプレート例:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shared collection on AllMarks</title>
  <meta name="description" content="A curated set of bookmarks shared via AllMarks">

  <!-- Open Graph -->
  <meta property="og:title" content="Shared collection on AllMarks">
  <meta property="og:description" content="A curated set of N bookmarks">
  <meta property="og:image" content="https://allmarks.app/api/share/${id}/og.webp">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="627">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://allmarks.app/s/${id}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://allmarks.app/api/share/${id}/og.webp">

  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/_next/static/css/${cssBundle}">
</head>
<body>
  <div id="__next"></div>
  <script>window.__SHARE_ID__ = "${id}"; window.__SHARE_CARD_COUNT__ = ${cardCount};</script>
  <script type="module" src="/_next/static/chunks/${jsBundle}"></script>
</body>
</html>
```

- `${id}`: Pages Function が path param から取得
- `${cardCount}`: KV から payload を decode して count
- `${cssBundle}` / `${jsBundle}`: build 時生成の manifest から読み込み
- `window.__SHARE_ID__`: pathname 抽出のバックアップ (= ReceiverLanding が優先的にこれを使ってもよい)

### (4.5) Next.js build はどうする?

`/s/[id]` の Next.js page を削除した後、 build はどう動く?

- `app/(app)/board/page.tsx` 等は引き続き静的 export される
- `/s/*` は Next.js 管轄外 (= Cloudflare Pages Function 直接処理)
- `out/_next/static/chunks/*.js` は build で生成、 これを Pages Function が参照

ただし ReceiverLanding を Next.js bundle 内に含めるためには、 どこかの page で import される必要がある。 案:

**(a) 専用エントリーページ `app/(app)/s/page.tsx` を作る** (= ReceiverLanding を import、 でも実際の routing は Pages Function 経由なのでアクセスされない)
- メリット: Next.js build が自然に ReceiverLanding を bundle に含める
- デメリット: 「アクセスされないページ」 が存在する不自然さ

**(b) 既存 board page から動的 import 経由で ReceiverLanding を bundle に含める**
- メリット: 専用エントリ不要
- デメリット: lazy chunk が分離して bundle 参照解決が複雑

**(c) Pages Function 内で React server rendering して HTML 完成版を返す**
- メリット: client-side hydration 不要、 静的 HTML で完結
- デメリット: React + ReceiverLanding を Pages Function ランタイムで動かす設定が必要 (= ESM resolve、 dom-to-image-more 等の DOM 依存 module の扱いなど複雑)

**推奨**: (a) — シンプル、 1 ファイル追加で済む、 後から (c) に移行するときの障壁にもならない

### (4.6) 既存 `functions/api/share/{create,[id],[id]/og}.ts` への影響

ゼロ。 これらは引き続き使う:
- `POST /api/share/create`: 送信側 SenderShareModal から呼ばれる
- `GET /api/share/[id]`: 受信側 ReceiverLanding/ReceiverTriage が JS で payload 再取得
- `GET /api/share/[id]/og.webp`: HTML テンプレートの og:image から参照

### (4.7) Test 戦略

- HTML テンプレート組み立て関数を別 module (`functions/s/_template.ts`) に切り出して unit test
- KV mock を用意して Pages Function の挙動 (= 404 / 200) を test
- ReceiverLanding の props 経由 → pathname 抽出への変更は既存 test を更新

### (4.8) ローカル開発で動かす方法

`npx wrangler pages dev out/` で Pages Functions も含めてローカル起動可能。 既存 `/api/share/*` も同じやり方で local 検証してきた。

## 5. ファイル変更計画

### 新規追加

```
functions/s/[id].ts                                # /s/<id> HTML 返却
functions/s/[id]/triage.ts                         # /s/<id>/triage HTML 返却
functions/s/_template.ts                           # HTML テンプレート組み立て (= 共通化)
functions/s/_template.test.ts                      # unit test
functions/s/_bundle-manifest.json                  # post-build script 生成 (= JS/CSS bundle ファイル名)
scripts/build-share-manifest.mjs                   # post-build script (= out/_next を scan して manifest 出力)
app/(app)/s/page.tsx                               # 専用エントリ (= ReceiverLanding を bundle に含める用、 (a) 案)
```

### 編集 (= 既存ファイル修正)

```
package.json                                       # build script に post-build manifest 生成を追加
components/share/ReceiverLanding.tsx               # shareId prop 廃止、 pathname 抽出に変更
components/share/ReceiverTriage.tsx                # 同上
```

### 削除 (= 既存ファイル廃棄)

```
app/(app)/s/[id]/page.tsx                          # Next.js dynamic route 廃止 → Pages Function 化
app/(app)/s/[id]/triage/page.tsx                   # 同上
```

## 6. 実装順序 (= 推奨 5 task)

| Task | 内容 |
|---|---|
| 1 | HTML テンプレート関数 `functions/s/_template.ts` + unit test (= 入力: id, cardCount, jsBundle, cssBundle / 出力: HTML 文字列) |
| 2 | post-build manifest script `scripts/build-share-manifest.mjs` + `package.json` の build hook 追加 |
| 3 | `functions/s/[id].ts` 実装 (= KV fetch + template 呼び出し + response) + triage 版 |
| 4 | ReceiverLanding / ReceiverTriage の shareId prop → pathname 抽出に書き換え + 既存 test 更新 |
| 5 | 旧 Next.js page 削除 + `app/(app)/s/page.tsx` (= bundle エントリ) 追加 + build + preview deploy で動作確認 |

## 7. 完了条件 (= ship 可能の判定)

- `pnpm build` が成功 (= 既存 23 routes + JS/CSS bundle 生成 + manifest 生成)
- preview deploy で:
  - `/s/<実 ID>` を開くと ReceiverLanding が render される
  - HTML の `<meta property="og:image">` に per-id URL が入っている
  - `/s/<実 ID>/triage` が動く
  - 期限切れ ID で 404 (= Pages Function が KV miss を検知して 404 HTML を返す)
- 本番 deploy で同じ動作確認
- X に `/s/<実 ID>` を貼って OG image preview が出る (= 視覚確認)

## 8. リスク・代替案

### リスク 1: bundle ファイル名 manifest の同期ずれ

deploy 時に JS bundle が新ファイル名で生成されるが manifest 更新を忘れる → HTML から古い JS 参照 → 404。

**対策**: post-build script を `package.json` の `build` ステップに組み込む (= 必ず実行)。 deploy script でも manifest 存在確認を入れる。

### リスク 2: Pages Function ランタイムの制約

Cloudflare Pages Function は edge runtime (= V8 Isolates)、 Node.js builtins 利用不可、 `fetch` / `Response` / `crypto` 等のみ。 HTML テンプレートは文字列組み立てなので問題なし、 KV API も既存 functions で動いている。

### リスク 3: ReceiverLanding が SSR 想定なら CSR-only への移行で挙動変化

現状 ReceiverLanding は `'use client'` の React 関数コンポーネント、 props で `shareId` を受け取る。 pathname 抽出に変えても `useEffect` で実行する形なので挙動は同等。 mount 時に 1 frame の loading 表示が走るのも既存と同じ。

### 代替案

- **代替案 A**: Next.js を捨てて React SPA + Vite で全部書き直し → スコープ過大、 採用しない
- **代替案 B**: `output: 'export'` を廃止して `output: 'standalone'` (= Node.js サーバー) に → Cloudflare Pages 静的配信の利点喪失、 採用しない

## 9. 完了後の体験 (= user 視点)

送信側:
- board で SHARE 押す → SenderShareModal (= 黒 + 緑 + monospace + convex bezel)
- 4 秒で URL `https://allmarks.app/s/k3p9xv` がコピー可能 + X 投稿ボタン

受信側 (= 他人のブラウザ):
- URL を踏むと per-id OG カードが X / Slack でプレビュー表示 (= バイラル性の核)
- ページが開くと送信者のボードがそのまま表示 + 「IMPORT ALL N」 / 「PICK ONE BY ONE」 sticky CTA
- 「PICK ONE BY ONE」 → triage 画面で YES/NO + sender tag chip
- 完了 → toast 表示 → `/board` 遷移、 user の AllMarks に取り込まれる

session 83 の design spec で約束した user 体験を維持。
