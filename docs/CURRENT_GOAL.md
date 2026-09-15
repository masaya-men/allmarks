# 次セッションのゴール — 端末間同期 束6(SyncPanel UI)

## ★s213 の到達点(束5 = 最小K3。★master マージ済)

- **master マージ済**（merge commit あり・`feat/device-sync-bundle-5-k3` は削除済）。**デプロイは未実施**（呼び出し元ゼロ＝既存挙動に影響ゼロ。同期が実際に使える形になってから本番反映する方針は継続）。
- セッション冒頭で**束4からの最優先申し送り(`connectSync`の`hasRequiredScopes`不具合)を先に修正**（空scopeはスキップ・`drive.file`だけを見る方式に）。commit `314eef60`。
- subagent-driven 6コードタスク + 各タスクレビュー（Task4 は1回の修正ラウンド） + opus 全ブランチレビュー + 修正波1（3件） + opus 再レビュー。フルスイート **2813/2813** / tsc 0 / eslint 0（このブランチが触ったファイルは新規混入エラーなし） / `pnpm build` OK。
- 出荷: `lib/board/license-types.ts`（ワイヤーフォーマット・base64url符号化）/ `lib/board/license-crypto.ts`（`verifyLicenseKey`＝オフラインEd25519検証）/ `lib/board/license-store.ts` + `theme-entitlement.ts`の`isSyncUnlocked`（解錠状態の永続化・ゲート判定）/ `functions/claim.ts`（発券）/ `functions/activate.ts`（発動・5台キャップ）/ `lib/board/license-activate.ts`（`activateLicenseKey`＝クライアント側オーケストレーション・フェイルオープン）/ `scripts/generate-k3-keypair.mjs`（鍵ペア生成スクリプト）。
- 計画書 `docs/superpowers/plans/2026-09-15-device-sync-bundle-5-k3.md`（tracked）。

### ★s213 最終レビューで発見・修正した重要な指摘（もう判断不要・記録のみ）

- **`/claim`のKVレコードに実行時バリデーションが無く、手入力タイポで発行上限が無効化されうる**（例: `maxIssue`のスペルミス→`NaN>=undefined`は常にfalse→無制限発行）。zod検証を追加し修正済み。
- **`/activate`へのfetchにタイムアウトが無く、Worker がハングすると「フェイルオープンのはずが永久に固まる」**状態になりうる不具合。`AbortSignal.timeout(10000)`を追加し修正済み。
- **5台キャップに達した支援者を救う手段が無かった**。`/claim`成功画面に`Key ID`（=`kid`）を表示するよう追加（将来`wrangler kv key delete act:<kid>`で手動リセットする際の窓口）。

### ★束6着手前に必ず読む・未解決の申し送り（s213で新規発見・低優先度）

- **`verifyLicenseKey`の`'unsupported'`が2つの原因を区別しない**: 「ブラウザがEd25519非対応」と「`K3_PUBLIC_KEY`が未設定（鍵ペア未生成）」が同じ結果になる。今は公開鍵が空文字なので実質全員`'unsupported'`になるが、UIがまだ無いので誰も踏まない。束6でSETTINGSのキー入力欄を作る前に、原因を分けるか少なくとも文言で区別すること。
- **貼り付けたキー文字列の内部の空白を除去しない**（先頭末尾のtrimのみ）。メール転記等で改行/空白が入ると弾かれる。束6の入力欄実装時に`.replace(/\s+/g, '')`を足す。

## ★次セッション = 束6（SyncPanel UI）

設計書 §4.1（SyncPanel）参照。責務（設計書§4.1）+ 束4/5からの申し送り:

- 初回接続フロー・同期状態表示・エラー表示（SETTINGS内）
- **SETTINGSに「キーを入力」欄を新設** → `lib/board/license-activate.ts`の`activateLicenseKey(db, keyString)`を呼ぶだけ（束5で実装済み・呼び出し元ゼロのまま待機中）。戻り値の4状態（`unlocked(verified:true/false)`/`invalid-key`/`unsupported`/`cap-exceeded`）をどう見せるか文言設計が必要（実装前に実際の英語・日本語の文面を提示して確認）。
- **vault（金庫）食い違い時のUI**: 黙って進めずユーザーに選ばせる or パスワード再設定導線
- **`isPrivateVault`タグの重複問題**（未対応・merge.ts自身のJSDocが束4に警告していた点）: vault食い違い時、tags[]は通常どおりマージされるためローカルに`isPrivateVault:true`のタグが2つ並びうる。vault食い違いUIと同時に設計。
- **テーマのバージョン差保護が無い**: 未知の`themeId`を含む`board-config`を取り込むとボード描画が壊れる。`manifest.json`の`appDbVersion`を書いてはいるが読むコードが無い。束6の前にガードが必要。
- **EMPTY TRASHの注意書き文言**（設計書§6.6・ユーザー承認済みの2点を含める）: 「安全のための仕組み」「もう一方の端末でも空にすれば消える」
- `sync-controller.ts`の`onResult`コールバックをここで初めて使う。コールバック内で例外を投げないこと（`void flushNow()`経由だと未処理rejectionになりうる）。

### ★束6着手前 or 並行の運用セットアップ（ユーザーの手作業・実機確認に必要）

- `wrangler kv namespace create K3_KV`（+`--preview`）→ 出力IDを`wrangler.toml`に反映
- `node scripts/generate-k3-keypair.mjs`実行 → 公開鍵を`.env.production`の`NEXT_PUBLIC_K3_PUBLIC_KEY=`へ・秘密鍵を`wrangler pages secret put K3_PRIVATE_KEY`へ
- claimレコードを1件seed: `wrangler kv key put --binding=K3_KV "claim:<合言葉>" '{"label":"launch","issuedCount":0,"maxIssue":50,"active":true}'`

## ★公開前タスク（束2で発生・継続）

- **PL-1**: OAuth同意画面のメールを個人Gmail → 専用アドレス（Googleグループ）。memory `project_oauth_support_email_swap`。
- **PL-2**: OAuthアプリを「テスト中」→「本番」公開 + Search Consoleで`allmarks.app`ドメイン検証（放置運転自動同期の前に必須。テスト中だとrefresh tokenが7日で失効）。

## 恒久ルール（継承）

- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素のnpx（`rtk npx`は既知の不具合）・Framer Motion禁止。
- 音（dotted-notebook）/紙（paper-atelier）＝バイト同一を死守。
- 機微（支援・値付け・戦略）はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。docsだけのpushはしない（次の実務pushに同梱）。
- **束1-5は各々masterマージ済みだが、本番デプロイは同期が実際に使える形（束6以降）になってからまとめて行う**（単独デプロイは省く）。
- 選択ボックス（AskUserQuestion）はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。
- 文言（UIコピー）を新規/変更するときは、実装前に実際の英語・日本語の文面そのものを見せて確認を得る。
- IDB/vaultなど不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する。
- 大規模調査・実装はサブエージェントに委譲（司令塔は診断・設計・指示書・検収）。

## 保留中（同期の後 or 並行）

- **N-78**: 画像無しツイート専用カード（見た目案の提示・承認が必要）。
- **N-64**: カードの＋TAGポップオーバーが再表示後に開けなくなる既存バグ（`CardsLayer.tsx`）。
- **N-63**: `BackupReminder`の表示位置がScrollMeterに被る（モック→承認後）。
- **N-65**: ECDH秘密鍵unwrap時に生バイトが一瞬JS経由（severity LOW・設計変更要）。
- さらなるテーマ/Flat磨き、C2翻訳仕上げ。
