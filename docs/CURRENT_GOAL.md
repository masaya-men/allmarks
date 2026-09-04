# 次セッションのゴール — 端末間同期 束3(Drive 読み書き + 足し算マージ)

## ★s210 の到達点(束2 = ログイン受け渡し・完了・本番反映済み)
- 計画書 `docs/superpowers/plans/2026-09-03-device-sync-bundle-2-auth.md`(tracked)。subagent-driven で5コードタスク・各2段レビュー・opus 全ブランチレビュー・修正1波・再レビュー clean。master マージ `c63d1724`、`allmarks.app` デプロイ済。
- 出荷: `functions/api/gauth/token.ts`/`refresh.ts`(stateless OAuth 中継・無保存無ログ)＋ `_shared.ts`(`readCappedText`/`jsonResponse`/`postToGoogleToken`/`relayGoogleTokenResponse`/`extractGoogleError`)/ `lib/sync/gauth-types.ts`(zod)/ `lib/sync/google-identity.ts`(GIS ローダ)/ `lib/sync/auth.ts`(`requestAuthCode`/`exchangeCode`/`refreshAccessToken`＋純関数 `computeExpiresAt`/`isAccessTokenExpired`・`SyncTokens{accessToken,expiresAt,scope,refreshToken?,idToken?}`・IDB 非依存)。
- **同期ロジック・UI はゼロ配線 = 既存挙動は完全不変**(`auth.ts` の import 元が components/app/lib-board/lib-storage に 0 件)。
- 本番実機確認済: `POST /api/gauth/token` に `{}` → 400 `invalid_request` / ダミー code → 400 `google_rejected:invalid_grant`(= CF シークレット読込 + Google 到達 + 中継の全チェーン生存)。
- Google Cloud: プロジェクト `allmarks-sync`・OAuth 同意画面(External・**テスト中**)・非機密スコープ `drive.file`/`userinfo.email`/`userinfo.profile`・OAuth クライアント "AllMarks Web"。client_id → `.env.production` + CF env、client_secret → CF 暗号化シークレット + `.dev.vars`。JSON は `docs/private/secrets/`(git 管理外)。
- tsc 0 / フルスイート **2642/2642** / ビルド OK。`channel.test.ts` の既存 flake も修正済(`vi.waitFor` 化)。

## ★次セッション = 束3(設計書 §14)

### 0. ★ユーザー作業(束3 実装前・1回)— Google Drive API を有効化
- `console.cloud.google.com` → プロジェクト `AllMarks Sync` を選択 → 検索バーで「Google Drive API」→「**有効にする**」。これをしないと `drive-adapter` の Drive REST 呼び出しが弾かれる。所要1分。**費用は発生しない**(無料枠・カード未登録)。

### 1. 束3 の計画書を writing-plans で作る
- `lib/sync/drive-adapter.ts` — Google Drive REST v3 の read/write/list(fetch のみ・認証は**注入**＝`auth.ts` の `SyncTokens.accessToken` を受け取る。`postToGoogleToken` と違い secret は使わない)。可視フォルダ `AllMarks/` の探索(名前 + `appProperties`)、各 `.json` の GET、`files.get(fileId, fields=headRevisionId)` の楽観ロック用取得、multipart PATCH。
- `lib/sync/merge.ts` — **純関数・IDB 非依存・テストの主戦場**。store 別の足し算マージ(設計 §6)。bookmarks/tags/cards/board-config/vault。
- 設計 §5(Drive 上のファイル構成)・§6(マージ規則)が下敷き。

### 2. 束3 の実装(subagent-driven)
- テスト厚め: 片側のみ追加 / 両側で別ブクマ追加(3+2=5) / 同一ブクマ scalar 衝突(新しい方) / tags 衝突(集合和) / トゥームストーン vs 編集(時刻境界) / 復元がトゥームストーンに勝つ / **Private ブクマ(`encryptedPayload`)を中身を見ず id 単位でマージ** / 決定性(順序非依存)。
- `drive-adapter` は fetch モックで単体テスト。
- deploy 前ゲート: `npx tsc --noEmit && npx vitest run && rtk pnpm build`。

## ★束3 の必須制約(設計書 §15・忘れると手戻り)
- **`merge.ts` は `updatedAt` を必ず `typeof x === 'number' ? x : 0` で読む**(v17前バックアップ復元で `updatedAt` 無し行が残る・migration 再実行不可・生の値の数値比較は `NaN`)。代替=`importAllStores` に3行 backfill。**どちらか明示的に選ぶ**。
- 並び替え(`updateBookmarkOrderBatch`/`resortByNewestFirst`)とツイートメディア後追い取得は `updatedAt` を bump する。「device B が板を開いただけ」が「device A のタイトル編集」に LWW で勝ちうる。§6.5 衝突退避の文脈で扱う。
- `emptyTrash`/`deleteBookmark` はブクマを**墓標なしで物理削除** → 足し算マージだとクラウドから復活する。設計 §6 が「EMPTY TRASH は端末ローカル」を実際にカバーしているか、束4着手前に確認。

## ★公開前タスク(束2 で発生・忘れない — 詳細は docs/TODO.md §公開前)
- **PL-1**: OAuth 同意画面のメールを個人 Gmail → 専用アドレス(Google グループ)。memory `project_oauth_support_email_swap`。
- **PL-2**: OAuth アプリを「テスト中」→「本番」公開 + Search Console で `allmarks.app` ドメイン検証(束4 の放置運転自動同期の前に必須。テスト中だと refresh token が7日で失効)。

## 恒久ルール(継承)
- 視覚変更は `ui-design.md`「承認後」。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx(`rtk npx` は既知の不具合)・Framer Motion 禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)は tracked に書かない＝`docs/private/`。
- merge/push/deploy は必ずユーザー確認後。ただし deploy は「本番で見たい」等の明示的な合図があれば即実行可。docs だけの push はしない(次の実務 push に同梱)。
- 選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。
- 文言(UI コピー)を新規/変更するときは、実装前に実際の英語・日本語の文面そのものを見せて確認を得る。
- IDB/vault など不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する。
- 大規模調査・実装はサブエージェントに委譲(司令塔は診断・設計・指示書・検収)。

## 保留中(同期の後 or 並行)
- **N-78**: 画像無しツイート専用カード(見た目案の提示・承認が必要)。
- **N-64**: カードの＋TAGポップオーバーが再表示後に開けなくなる既存バグ(`CardsLayer.tsx`)。
- **N-63**: `BackupReminder` の表示位置が ScrollMeter に被る(モック→承認後)。
- **N-65**: ECDH 秘密鍵 unwrap 時に生バイトが一瞬 JS 経由(severity LOW・設計変更要)。
- さらなるテーマ/Flat 磨き、C2 翻訳仕上げ。
