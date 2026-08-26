# 次セッションのゴール — N-73の本番デプロイ確認→残り候補から1つ選んで着手

## ★s205 の到達点(N-77・N-70根治・デプロイ済／N-73実装済・未デプロイ)
- **N-77**(YouTubeサムネがスクロール中に灰色になる): `public/sw.js`がサードパーティ画像まで無差別インターセプトし、スクロールでのアンマウント時に`respondWith(undefined)`→ネットワークエラーになっていたのが原因。クロスオリジンの早期returnを追加(`CACHE_VERSION`もbump)。**push・`allmarks.app`デプロイ済**。
- **N-70**(デッドリンクの誤判定): `lib/board/tweet-liveness.ts`の`checkTweetLiveness`が「200だがTweet形式でなければgone」と判定していたのが原因。本番`curl`で実CDN検証し「本当に存在しないツイートは404、200のtombstoneは"匿名チェッカーから見えないだけ"(鍵アカウント等)」と実証、後者を`gone`→`unknown`(安全側)に変更。**push・`allmarks.app`デプロイ済**。
- **N-73**(デッドリンクにも「TRASH DEAD LINKS」一括ボタン): brainstorming(Bounded path、ユーザー承認済)→TDD実装。ソフト削除(取り消し可能)なので確認ダイアログ無し、`deleteMany`という新しい一括取り消し種別で1回のCtrl+Zで全件復元。15言語のトースト文言も追加。**未push・未デプロイ**。
- 副産物: `functions/api/ogp.ts`の502丸め込みバグ(一般サイト側は`gone`に絶対到達しない)を発見、N-70調査で原因ではないと確認済(修正は別スコープのため見送り)。
- 全項目 tsc0/vitest全301ファイル2514緑/関連e2e緑/`pnpm build`成功。詳細は`docs/TODO.md`セッション205節・`docs/TODO_COMPLETED.md`参照。

## ★次セッション最優先＝N-73デプロイ確認→残り候補
1. ユーザーにN-73のcommit・push・本番デプロイ可否を確認 → OKなら実行・実機確認依頼。
2. その後、`docs/TODO.md`「session 204 で提案」節の残り6件(N-69/71/72/74〜76)から次を選ぶ。着手前に該当項目だけ改めてsuperpowers:brainstormingから。

| # | 内容 | 種別 |
|---|---|---|
| N-69 | タグ絞り込みに「タグ無し」フィルタを追加 | 新機能 |
| N-71 | 長押し削除ボタンに「HOLD TO DELETE」等の明示ラベル | UI微修正(N-73調査で判明: `TrashConfirmDialog.tsx`のDELETEボタンが該当、`deleteBtnLabel`が空spanのまま) |
| N-72 | MANAGE TAGS複数選択、タグ名クリックでも一括タグ付け | 新機能 |
| N-74 | SHARE画面のボードタイトル配置オプション(現状/最前面) | 視覚変更・要承認 |
| N-75 | SHARE画面のUI文言を平易化+多言語化 | UI改善 |
| N-76 | SHARE画面の自動配置を業界標準ライブラリ活用で改善 | 技術調査から |

## 保留中(いつでも合流可)
- **N-64**: カードの＋TAGポップオーバーが、フィルタ等で一瞬消えて再表示された後にもう一度開けなくなることがある(`CardsLayer.tsx`の既存バグ、Private機能とは無関係)。
- **N-63**: バックアップ提案(`BackupReminder`)の表示位置がScrollMeterに被るバグ。視覚変更のためモック→承認後に実装。
- **N-65**: ECDH秘密鍵のunwrap時、生バイト列が一瞬JS側を経由する(severity LOW、修正は設計変更が要るため見送り)。
- ResizeHandleの当たり判定が小さいカードで＋TAGボタンを奪うバグ(s203由来、視覚変更のため承認後)。
- TODO.mdが900行超(目安200行を大幅超過)→ 古いセッションnarrativeをTODO_COMPLETED.mdへ移動する軽い掃除タスク(非ブロッキング)。
- さらなるテーマ/Flat磨き、支援まわり(非公開`docs/private/IDEAS.md`)、C2翻訳仕上げ(Private文言の13言語ネイティブレビューもこれに合流できる)。

## 恒久ルール(継承)
- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素の npx(`rtk npx`は既知の不具合)・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後(CLAUDE.md安全ルール)。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。
- **選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く**。
- **IDB/vaultなど不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する**(s204でPhase1旧vault削除の際に実践)。
- **サブエージェントへの検証指示には、影響範囲に応じてplaywright e2eも含める**(s204で「vitest/tscだけ指示→e2eで初めて発覚したバグ」を経験、教訓化)。
- **拡張機能を審査提出する前に、`_locales`フォルダ名がChromeの公式ロケールコード(地域つき、例: `zh_CN`/`pt_BR`)に沿っているか確認する**(s204で`zh`/`pt`の裸コードがダッシュボードに認識されない問題を発見)。
