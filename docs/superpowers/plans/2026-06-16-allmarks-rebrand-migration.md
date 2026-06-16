# AllMarks リブランド移行プラン (2026-06-16, session 102)

> 前提 spec: `docs/private/2026-05-11-allmarks-branding-spec.md` §5
> ドメイン `allmarks.app` 取得済 (2026-06-16)。本プランは「最も綺麗な業界水準の形」で合意した移行手順。

## 採用する形 (= 業界標準のドメイン移行)

- **新 `allmarks` Pages プロジェクト**に本体をデプロイ (既定サブドメイン `allmarks.pages.dev` = ブランド一致)
- **旧 `booklage` プロジェクトは恒久 301 リダイレクト専用シェル**に転換 (`booklage.pages.dev/* → allmarks.app/* 301`)
- 同一プロジェクトにカスタムドメインを足す方式では「素の .pages.dev を自プロジェクトの custom domain へ 301」できない (Cloudflare 制約: `_redirects` はホスト条件不可) ため、綺麗な 301 には**プロジェクト分割が必須**

### データは安全に持ち越せる (要点)

- シェアの **KV `SHARE_KV` / R2 `SHARE_OG`** は `wrangler.toml` に **ID 直書き**で宣言 → デプロイ先プロジェクトを変えても同じ wrangler.toml で**同じ KV/R2 に再バインド**される。既存シェア全保持・データ損失ゼロ
- ユーザー(=開発者本人)の **IndexedDB 約372件は origin 単位**なので `allmarks.app` には自動移行しない → **BackupButton で 1 回 export/import**(下記ステップ1・4)

### 「変えない」確定リスト (壊すとデータ/互換破壊)

- `DB_NAME='booklage-db'` … **永久維持**(リネーム=全データ消失。レガシー内部名の維持はプロの判断)
- bookmarklet 内部 programmatic ID
- KV namespace ID / R2 bucket 名(wrangler.toml の現値)

## 確認済みの事実 (session 102 調査)

- Cloudflare Pages: `booklage` 1 つのみ、カスタムドメイン未設定。wrangler はアカウントにログイン済
- `_redirects` 未存在。`next.config.ts` = `output: 'export'`(静的書き出し)
- **canonical の起点 = `lib/constants.ts` の `APP_URL`/`APP_NAME`(= `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_APP_NAME`)**
- `.env.local`(gitignored)が `NEXT_PUBLIC_APP_URL=http://localhost:3000` / `NEXT_PUBLIC_APP_NAME=Booklage` → **本番ビルドでもこれが効いている**
  - sitemap/robots は localhost 判定でハードコード `booklage.pages.dev` fallback を使用
  - `layout.tsx` metadataBase は本番でも localhost(潜在 OG バグ)
- `booklage.pages.dev` ハードコード箇所(実体):
  - app側ビルド時 fallback: `app/sitemap.ts`, `app/robots.ts`
  - 拡張(`extension/`, v0.1.17): `content.js`(host判定), `floating-button.js`(host判定), `offscreen.js`(`BOOKLAGE_ORIGIN`), `options.js`(board URL)
  - マーケ説明文: `app/(marketing)/extension/privacy/page.tsx`
  - 実行時自動追従(対応不要): `BoardRoot.tsx` の bookmarklet appUrl は `window.location.origin`
- 拡張ディレクトリが 2 つ: **`extension/`(本体・v0.1.17)** と **`chrome-extension/`(v1.0.0・古い試作と思われる)**。後者は使用状況を確認して、死んでいれば削除

## 手順 (あなた=最小限 / 私=大半)

### ステップ1【あなた・最初に必須】データ退避
- いま `booklage.pages.dev` を開き、BackupButton で 372 件を **export**(リダイレクト化前の命綱)

### ステップ2【私】コード手当て(インフラ作業を待たず進められる安全部分)
- env 構成を業界標準に整える:
  - `.env.development`(新規, dev用): `NEXT_PUBLIC_APP_URL=http://localhost:3000` / `NEXT_PUBLIC_APP_NAME=AllMarks`
  - `.env.production`(新規・tracked, 本番用 / NEXT_PUBLIC_* は公開値): `NEXT_PUBLIC_APP_URL=https://allmarks.app` / `NEXT_PUBLIC_APP_NAME=AllMarks`
  - `.env.local` から `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_APP_NAME` を除去(上書きを止める)。他の値があれば温存
- `app/sitemap.ts` / `app/robots.ts` の fallback `booklage.pages.dev` → `allmarks.app`
- `app/layout.tsx` metadataBase を localhost のとき本番URLにフォールバック(OG修正)
- 拡張 host 判定を **allmarks.app + booklage.pages.dev 両対応**(保存先の正は allmarks.app)
  - `extension/content.js`, `floating-button.js`, `offscreen.js`, `options.js`, `manifest.json`(host_permissions 追加 + version bump)
- マーケ privacy ページ説明文を allmarks.app に
- 影響する vitest 期待値を更新(`bookmarklet.test.ts`, `x-intent.test.ts`, `functions/s/*.test.ts`, `BookmarkletInstallModal.test.tsx` 等は引数渡しが多く大半は無影響。fallback 変更で割れた分のみ修正)
- tsc 0 / vitest 全 pass / `pnpm build` 成功 まで通す

### ステップ3【あなた・画面操作】新プロジェクト作成 + ドメイン
- 私が用意するコマンドで新 `allmarks` プロジェクトへ初回デプロイ
- Cloudflare ダッシュボードで `allmarks` プロジェクトに `allmarks.app` をカスタムドメイン追加(同アカウント zone なので数分)

### ステップ4【あなた】データ復元
- `allmarks.app` で backup を **import** → 372 件が新 origin に乗る・動作確認

### ステップ5【私+あなた】旧URLを 301 シェル化
- 旧 `booklage` プロジェクトに `_redirects`(`/* https://allmarks.app/:splat 301`)だけの最小ビルドをデプロイ
- ※ステップ1の export 完了後にのみ実施(リダイレクト後は booklage.pages.dev でデータを取り出せなくなる)

### ステップ6【私】片付け + repo
- GitHub repo rename `booklage` → `allmarks`(旧URL自動リダイレクト)
- `package.json` name → `allmarks`
- 古い `chrome-extension/` を確認して削除(死んでいれば)
- CLAUDE.md のデプロイ手順を `--project-name=allmarks` + `booklage.pages.dev`→`allmarks.app` に更新

### ステップ7【後日】拡張ストア
- 拡張を再パッケージ(host=allmarks.app)
- `EXTENSION_STORE_URL`(lib/board/constants.ts)はストア公開素材ができてから 1 行投入 → 全員に `ADD TO CHROME` 自動点灯

## 検証方針
- 各ステップ後 tsc/vitest/build。ステップ3後は allmarks.app で実機(playwright/本番)確認してから「動いた」と報告
- デプロイ前 `npx wrangler whoami`
