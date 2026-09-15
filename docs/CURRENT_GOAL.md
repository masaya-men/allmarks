# 次セッションのゴール — 端末間同期 束5(最小K3)or 束6(SyncPanel UI)

## ★s212 の到達点(束4 = engine.ts オーケストレーション。★master マージ済)

- **master マージ済**（merge commit あり・`feat/device-sync-bundle-4` は削除済）。**デプロイは未実施**（呼び出し元ゼロ＝既存挙動に影響ゼロ。同期が実際に使える形になってから本番反映する方針は継続）。
- subagent-driven 9コードタスク + 各タスクレビュー（Task4/Task8 は各1回の修正ラウンド） + opus 全ブランチレビュー + 修正波1（6件） + opus 再レビュー。フルスイート **2770/2770** / tsc 0 / eslint 0（新規混入エラーなし・masterに既存の無関係な1件のみ） / `rtk pnpm build` OK。
- 出荷: `lib/sync/sync-store.ts`（トークン・接続状況・baseスナップショット・直近3世代バックアップ） / `lib/storage/board-config.ts`（`updatedAt`打刻配線） / `lib/sync/snapshot-schema.ts`（zod検証） / `lib/sync/engine.ts`（`buildLocalSnapshot`/`applySnapshotToLocal`/`ensureAccessToken`/`hasRequiredScopes`/`pullRemoteSnapshot`/`pushSnapshot`/`runSyncCycle`/`connectSync`） / `lib/sync/sync-controller.ts`（20秒デバウンスpush・visibilitychange/beforeunload flush・`onResult`コールバック・同時実行ガード）。
- 計画書 `docs/superpowers/plans/2026-09-14-device-sync-bundle-4-engine.md`（tracked）。設計書 §15「束4」節に束5/6への申し送り全部。

### ★s212 で発見・修正した重大バグ（もう判断不要・記録のみ）

- **Task 8実装直後の全ブランチレビュー(opus)で発見**: push衝突後の再試行経路でvault（金庫）の食い違いを再検知しない Critical バグ。「2台の端末がそれぞれ別々にPrivateを設定してから初めて同期する」代表的な初回利用シナリオで、片方の端末の秘密鍵が恒久的に失われうる。同ラウンドで4点まとめて修正（vault食い違い時は`vault:null`にする・再試行経路でも安全弁を再評価・例外を投げずSyncCycleResultで返す）。
- **束4全体の最終レビュー(2回目のopus・独立)で同じ失敗モードの別経路を発見**: 再試行経路が「サイクル開始時点の古いローカル状態」を参照していた（`buildLocalSnapshot`を都度読み直していなかった）。同ラウンドで修正。あわせて`pushSnapshot`の楽観ロックが「pull時に存在しなかったファイル」を素通ししていた穴も閉じた。
- 詳細は設計書 §15「束4」節・memory 不要（tracked plan + design doc に全部残してある）。

## ★次セッション = 束5(最小K3)or 束6(SyncPanel UI) — どちらから着手するかユーザーと相談

設計書 §10（最小K3）・§4.1（SyncPanel）参照。

### ★★最優先・必ず先に直す（束6でconnectSyncを配線する前に）

- **`connectSync`の`hasRequiredScopes`ゲートが実際の接続を弾く不具合**（束4最終レビューの修正波で新規混入・現在は呼び出し元ゼロなので実害ゼロ）。原因: ①Googleは`scope`を返さないことがある（`gauth-types.ts`自身が「緩い確認用」と明記）→ 空文字は必ずfalse ②Googleは`email`/`profile`を短縮形ではなく`userinfo.email`/`userinfo.profile`の正式URLで返す → 完全一致比較が同意済みユーザーでも失敗。直し方: 空scopeはチェックをスキップする（既存の設計意図どおり）／短縮形と正式URLを対応させる／実質必須なのは`drive.file`だけなのでそれだけ見る。詳細=設計書§15「束4」節の申し送り1番。

### 束5（最小K3）の責務（設計書§10）
- Worker `/claim?c=<secret>`（発券）・`/activate`（発動・5台キャップ・冪等）
- `lib/board/license-store.ts`（新規）・`isSyncUnlocked`（`isThemeUnlocked`と同じ土台）
- フェイルオープン（Worker障害時は署名が本物なら通す）

### 束6（SyncPanel UI）の責務（設計書§4.1）+ 束4からの申し送り
- 初回接続フロー・同期状態表示・エラー表示（SETTINGS内）
- **vault（金庫）食い違い時のUI**: 黙って進めずユーザーに選ばせる or パスワード再設定導線
- **`isPrivateVault`タグの重複問題**（未対応・merge.ts自身のJSDocが束4に警告していた点）: vault食い違い時、tags[]は通常どおりマージされるためローカルに`isPrivateVault:true`のタグが2つ並びうる。vault食い違いUIと同時に設計。
- **テーマのバージョン差保護が無い**: 未知の`themeId`を含む`board-config`を取り込むとボード描画が壊れる。`manifest.json`の`appDbVersion`を書いてはいるが読むコードが無い。束5/6の前にガードが必要。
- **EMPTY TRASHの注意書き文言**（設計書§6.6・ユーザー承認済みの2点を含める）: 「安全のための仕組み」「もう一方の端末でも空にすれば消える」
- `sync-controller.ts`の`onResult`コールバックをここで初めて使う。コールバック内で例外を投げないこと（`void flushNow()`経由だと未処理rejectionになりうる）。

## ★公開前タスク（束2で発生・継続）

- **PL-1**: OAuth同意画面のメールを個人Gmail → 専用アドレス（Googleグループ）。memory `project_oauth_support_email_swap`。
- **PL-2**: OAuthアプリを「テスト中」→「本番」公開 + Search Consoleで`allmarks.app`ドメイン検証（放置運転自動同期の前に必須。テスト中だとrefresh tokenが7日で失効）。

## 恒久ルール（継承）

- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素のnpx（`rtk npx`は既知の不具合）・Framer Motion禁止。
- 音（dotted-notebook）/紙（paper-atelier）＝バイト同一を死守。
- 機微（支援・値付け・戦略）はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。docsだけのpushはしない（次の実務pushに同梱）。
- **束1-4は各々masterマージ済みだが、本番デプロイは同期が実際に使える形（束5/6以降）になってからまとめて行う**（単独デプロイは省く）。
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
