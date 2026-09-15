# 次セッションのゴール — 端末間同期 束6②③(SyncPanel UI・vault食い違いUI)

## ★s213 の到達点(束5=最小K3 + 束6①=パスワード変更/再設定。★両方 master マージ済)

- **束5(K3最小ライセンスゲート)master マージ済**。運用セットアップも完了(K3_KVの本番/preview namespace作成・Ed25519鍵ペア生成・秘密鍵はCloudflare Pages Secret・公開鍵は`.env.production`)。ただし**クレーム(発券)レコードは未seed**=支援者向けリンクはまだ機能しない(まだ誰にも配っていない・束6②のUI配線後でよい)。
- **束6①(Privateの金庫パスワード変更/再設定)master マージ済**。「解錠済み端末からなら古いパスワード無しで再設定できる」方式(Norton Password Manager型)。詳細=`docs/superpowers/plans/2026-09-15-private-password-change.md`(7タスクplan・subagent-driven実行済)。
- **本番デプロイ実施済**(`allmarks.app`)。ユーザーが実機で①目のマーク3画面一貫動作②解錠済みSETTINGS→PRIVATEで管理画面③パスワード変更後の再解錠、を確認済。
- **実機でのみ見つかったCSSバグ2件、修正・再デプロイ済**(自動テストでは検知不可な類のもの・次の似た作業の参考に): (1) Edgeが`type="password"`全部に自前の目アイコンを埋め込み自作トグルと衝突→`::-ms-reveal`/`::-ms-clear`を無効化、(2) ブラウザの自動入力ハイライトで背景が明転し薄色トグルアイコンが同化→`-webkit-autofill`時の背景を強制的に固定し直す定番対策。**新しい入力欄を作るたびにこの2点は要注意**。

## ★次セッション = 束6②(SyncPanel UI本体)・③(vault食い違いUI等)

設計書 §4.1(SyncPanel)参照。責務(設計書§4.1)+ これまでの申し送り:

### ②SyncPanel UI本体(未着手)
- 初回接続フロー・同期状態表示・エラー表示(SETTINGS内)
- **SETTINGSに「キーを入力」欄を新設** → `lib/board/license-activate.ts`の`activateLicenseKey(db, keyString)`を呼ぶだけ(束5で実装済み・呼び出し元ゼロのまま待機中)。戻り値の4状態(`unlocked(verified:true/false)`/`invalid-key`/`unsupported`/`cap-exceeded`)をどう見せるか文言設計が必要(実装前に実際の英語・日本語の文面を提示して確認)。
- **貼り付けたキー文字列の内部の空白を除去しない**(先頭末尾のtrimのみ)。メール転記等で改行/空白が入ると弾かれる。入力欄実装時に`.replace(/\s+/g, '')`を足す。
- **`verifyLicenseKey`の`'unsupported'`が2つの原因を区別しない**問題は未解決(「ブラウザがEd25519非対応」と「鍵未設定」が同じ結果)。ただし公開鍵は今回設定済なので後者は解消済、前者だけ残る。
- ユーザー本人が無料で使うための専用キーは、この入力欄ができた段階で1本発行して渡す(秘密鍵で直接署名・課金フロー不要)。

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
