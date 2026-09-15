# 次セッションのゴール — 端末間同期 束6②(SyncPanel UI 残り)・③(vault食い違いUI)

## ★s213 の到達点(束5=最小K3 + 束6①=パスワード変更/再設定 + 束6②の一部=鍵入力欄。★全部 master マージ済・未push)

- **束6②の一部(SETTINGSの「SYNC」鍵入力欄)完了・master マージ済**(未push)。SETTINGSに「SYNC」セクションを新設 — 未解錠なら説明文+鍵貼り付け欄+「応援する(近日公開)」、解錠済みなら「✓ 同期を解錠しました / 端末をつなぐ機能は近日公開予定です」の確認画面。`activateLicenseKey`の4状態(unlocked/invalid-key/unsupported/cap-exceeded)を全て文言化済み(実装前にユーザー承認済みの文面)。**まだ誰も踏めない導線**(クレームレコード未seed・支援者向けリンク未配布)なので実害ゼロで安全に出荷。
  - レビューで発見・修正した実質的なバグ: `SyncPanel`の状態読み込み・鍵送信の両方が`initDB()`等の失敗にtry/catchを付けておらず、テストスイート全体が`exit 1`(未処理rejection)になっていた。本番でIndexedDBが使えない状況(プライベートブラウジング等)だと画面が永久に空白/ボタンが永久に押せないままになる実害もあった → 修正済み(`BackupStatus`等の既存コンポーネントと同じtry/catchパターンに揃えた)。新規エラー文言`sync.errorActivateFailed`(「有効化できませんでした。もう一度お試しください。」)を1件追加(既存の類似文言と同じ言い回し・15言語対応済み)。
- **束5(K3最小ライセンスゲート)master マージ済**。運用セットアップも完了(K3_KVの本番/preview namespace作成・Ed25519鍵ペア生成・秘密鍵はCloudflare Pages Secret・公開鍵は`.env.production`)。ただし**クレーム(発券)レコードは未seed**=支援者向けリンクはまだ機能しない。

- **束5(K3最小ライセンスゲート)master マージ済**。運用セットアップも完了(K3_KVの本番/preview namespace作成・Ed25519鍵ペア生成・秘密鍵はCloudflare Pages Secret・公開鍵は`.env.production`)。ただし**クレーム(発券)レコードは未seed**=支援者向けリンクはまだ機能しない(まだ誰にも配っていない・束6②のUI配線後でよい)。
- **束6①(Privateの金庫パスワード変更/再設定)master マージ済**。「解錠済み端末からなら古いパスワード無しで再設定できる」方式(Norton Password Manager型)。詳細=`docs/superpowers/plans/2026-09-15-private-password-change.md`(7タスクplan・subagent-driven実行済)。
- **本番デプロイ実施済**(`allmarks.app`)。ユーザーが実機で①目のマーク3画面一貫動作②解錠済みSETTINGS→PRIVATEで管理画面③パスワード変更後の再解錠、を確認済。
- **実機でのみ見つかったCSSバグ2件、修正・再デプロイ済**(自動テストでは検知不可な類のもの・次の似た作業の参考に): (1) Edgeが`type="password"`全部に自前の目アイコンを埋め込み自作トグルと衝突→`::-ms-reveal`/`::-ms-clear`を無効化、(2) ブラウザの自動入力ハイライトで背景が明転し薄色トグルアイコンが同化→`-webkit-autofill`時の背景を強制的に固定し直す定番対策。**新しい入力欄を作るたびにこの2点は要注意**。
- **束6③の一部(テーマのバージョン差保護)完了・master マージ済**(`lib/storage/board-config.ts`の`guardUnknownThemeId`。未知の`themeId`は`loadBoardConfig`の時点で`DEFAULT_THEME_ID`にフォールバック・IndexedDBの生値は無傷。画面変更なし=承認不要の裏側修正)。

## ★未着手のまま残っているUI設計マター(`isPrivateVault`タグ重複問題)

- **`isPrivateVault`タグの重複問題は「バックエンドだけの修正」では済まない**と判明(調査済): vault(金庫)が食い違ったまま(=publicKeyが違う=別々の金庫)tags[]だけは通常どおりマージされるため、`isPrivateVault:true`のタグが2つ並びうる。根治には「2つのうちどちらが本物の金庫か」をユーザーに選んでもらう画面が要る(自動判定できない=どちらの端末も正当に暗号化していた可能性がある)。**vault食い違いUIと同時に設計すること**(文言の事前提示・承認フロー対象)。

## ★次セッション = 束6②(SyncPanel UI本体)・③(vault食い違いUI等)

設計書 §4.1(SyncPanel)参照。責務(設計書§4.1)+ これまでの申し送り:

### ②SyncPanel UI本体(残り — 鍵入力欄は完了、以下が未着手)
- 初回接続フロー(「Googleで接続」ボタン→同意画面→初回アップロード/合体→完了)・接続後の同期状態表示(最終同期時刻・「今すぐ同期」ボタン)・エラー表示(設計書§8: 破損ファイル・大量削除確認・容量不足・トークン失効時の「Googleに再接続」等)。
- 鍵入力欄が完了したことで`verifyLicenseKey`の`'unsupported'`の曖昧さは実質解消(公開鍵は設定済み・残るのは「ブラウザがEd25519非対応」の1パターンのみ)。
- ユーザー本人が無料で使うための専用キーは、クレームリンク配布を始める前に1本発行して渡す(秘密鍵で直接署名・課金フロー不要)。今回はまだ発行していない(入力欄はできたが、まだ「渡す鍵」自体を作っていない)。

### ③vault食い違いUI・周辺ガード(未着手)
- **vault(金庫)食い違い時のUI**: 黙って進めずユーザーに選ばせる、または今回作ったパスワード再設定導線への案内。②が先にあった方が設計しやすい(「食い違ったら再設定してね」と言える)。
- **`isPrivateVault`タグの重複問題**: vault食い違い時、tags[]は通常どおりマージされるためローカルに`isPrivateVault:true`のタグが2つ並びうる。vault食い違いUIと同時に設計。
- **テーマのバージョン差保護が無い**: 未知の`themeId`を含む`board-config`を取り込むとボード描画が壊れる。`manifest.json`の`appDbVersion`を書いてはいるが読むコードが無い。
- **EMPTY TRASHの注意書き文言**(設計書§6.6・ユーザー承認済みの2点を含める): 「安全のための仕組み」「もう一方の端末でも空にすれば消える」
- `sync-controller.ts`の`onResult`コールバックをここで初めて使う。コールバック内で例外を投げないこと(`void flushNow()`経由だと未処理rejectionになりうる)。

### ★束6着手前 or 並行の運用セットアップ(ユーザーの手作業・実機確認に必要)

- claimレコードを1件seed: `wrangler kv key put --binding=K3_KV "claim:<合言葉>" '{"label":"launch","issuedCount":0,"maxIssue":50,"active":true}'`(②の入力欄ができてから・支援者に配る合言葉を決めてから)

## ★公開前タスク(束2で発生・継続)

- **PL-1**: OAuth同意画面のメールを個人Gmail → 専用アドレス(Googleグループ)。memory `project_oauth_support_email_swap`。
- **PL-2**: OAuthアプリを「テスト中」→「本番」公開 + Search Consoleで`allmarks.app`ドメイン検証(放置運転自動同期の前に必須。テスト中だとrefresh tokenが7日で失効)。

## 恒久ルール(継承)

- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素のnpx(`rtk npx`は既知の不具合)・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。docsだけのpushはしない(次の実務pushに同梱)。
- 選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。
- 文言(UIコピー)を新規/変更するときは、実装前に実際の英語・日本語の文面そのものを見せて確認を得る。
- IDB/vaultなど不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する。
- 大規模調査・実装はサブエージェントに委譲(司令塔は診断・設計・指示書・検収)。

## 保留中(同期の後 or 並行)

- **N-78**: 画像無しツイート専用カード(見た目案の提示・承認が必要)。
- **N-64**: カードの＋TAGポップオーバーが再表示後に開けなくなる既存バグ(`CardsLayer.tsx`)。
- **N-63**: `BackupReminder`の表示位置がScrollMeterに被る(モック→承認後)。
- **N-65**: ECDH秘密鍵unwrap時に生バイトが一瞬JS経由(severity LOW・設計変更要)。
- さらなるテーマ/Flat磨き、C2翻訳仕上げ。
