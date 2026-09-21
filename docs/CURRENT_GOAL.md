# 次セッションのゴール — 同期の近リアルタイム化・PL-1/PL-2は完了。残りは運用セットアップ

## ★s218(2026-09-22)の到達点

- 保存のたびに自動で同期信号が出るよう配線(`lib/sync/sync-signal.ts`)、`allmarks.app`へデプロイ済。詳細は`docs/TODO_COMPLETED.md`のs218節。
- PL-1(同意画面メール差替)・PL-2(OAuth本番公開+ドメイン検証)、両方ともユーザー本人が完了。refresh token 7日失効問題は解消。

## ★次にやること

1. **運用セットアップ(ユーザーの手作業・未着手)**: (a) claimレコードを1件seed(`wrangler kv key put --binding=K3_KV "claim:<合言葉>" '{"label":"launch","issuedCount":0,"maxIssue":50,"active":true}'`)、(b) ユーザー本人用の無料キーを1本発行。**合言葉(招待コードの文字列)をユーザーに決めてもらう必要あり**。

## 恒久ルール(継承)

- 視覚変更は`ui-design.md`「承認後」。`rtk`前置・`--no-verify`禁止・vitest/playwrightは素のnpx(`rtk npx`は既知の不具合)・Framer Motion禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)はtrackedに書かない＝`docs/private/`。
- merge/push/deployは必ずユーザー確認後。ただしdeployは「本番で見たい」等の明示的な合図があれば即実行可。docsだけのpushはしない(次の実務pushに同梱)。
- 選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。
- 文言(UIコピー)を新規/変更するときは、実装前に実際の英語・日本語の文面そのものを見せて確認を得る。**ユーザーが指定した具体的な値(文字列など)は、実装前にそのまま使うこと — 勝手に別の値に置き換えない**(s217でこの失敗をした教訓)。
- IDB/vaultなど不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する。
- 大規模調査・実装はサブエージェントに委譲(司令塔は診断・設計・指示書・検収)。同一ファイルへの並行実行は避ける。

## 保留中(並行可)

- **N-78**: 画像無しツイート専用カード(見た目案の提示・承認が必要)。
- **N-64**: カードの＋TAGポップオーバーが再表示後に開けなくなる既存バグ(`CardsLayer.tsx`)。
- **N-63**: `BackupReminder`の表示位置がScrollMeterに被る(モック→承認後)。
- **N-65**: ECDH秘密鍵unwrap時に生バイトが一瞬JS経由(severity LOW・設計変更要)。
- さらなるテーマ/Flat磨き、C2翻訳仕上げ。

## 備考(TODO.mdの肥大化・未着手)

`docs/TODO.md`が376行程度あり、CLAUDE.mdの目安(200行)を大きく超えている。古いセッションのnarrativeを`TODO_COMPLETED.md`へ移す整理作業がまだ手つかず。次に手が空いたタイミングで着手すること。
