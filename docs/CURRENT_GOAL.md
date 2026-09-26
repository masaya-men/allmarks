# 次セッションのゴール — LP v10 の本番実装を Task 3 から続け、15言語で確認して公開

## ★最初に(s222 の到達点)
- 作業ブランチ **`feat/lp-v10`**(master は本番と同じ状態のまま・未マージ)。
- 計画 `docs/superpowers/plans/2026-09-26-lp-v10.md` / 設計 `docs/superpowers/specs/2026-09-26-lp-v10-design.md` / 見本(正本・非公開) `docs/private/lp-v10-mock.html`(ユーザー承認済 v10)。
- 進み具合の台帳(git 管理外): `.superpowers/sdd/2026-09-26-lp-v10/progress.md` — **Task 1(15言語の文言)・Task 2(動きの計算)は完了・レビュー済**。Task 3 は夜の中断で未着手(ファイル変更なし・`task-3-brief.md` 作成済)。
- 進め方: `superpowers:subagent-driven-development` で Task 3→9 を直列に(実装 Sonnet・各タスク後にレビュー)→ 最後に全体レビュー → Task 10(全ゲート・見本との見比べ)→ 本番公開(CLAUDE.md の固定手順)→ master へ統合・push。
- **注意**: このブランチの文言は見出しに改行の印(`\n`)が入っているため、古いトップページでは表示が崩れる。新しい部品が揃うまで**このブランチから本番公開しない**。

## Paddle(月曜以降)
- ユーザーに書類確認の結果を聞く。通っていれば有料公開(手順は下)。LP の同期区画・流れる帯の「Sync」・料金への案内は、公開日に一緒に出す(v10 見本の Sync 区画)。

## 有料公開の手順(書類が通ったら・この順で)
1. `.env.production` の `# NEXT_PUBLIC_PADDLE_*` 6行のコメントを外す。SyncPanel の「応援する(近日公開)」→料金ページへのリンクに(`navHref(locale,'pricing')`、新しいタブ)。
2. **素の** `rtk pnpm build`(`.env.sandbox` を読み込まない)→ tsc+vitest → deploy。`out/` に sandbox の値(`pri_01m39e0`)が無いことを grep で確認してから。
3. 本番で ¥500 を実購入 → 鍵表示 → 同期 → Paddle 管理画面から返金+解約 → 停止を確認。
4. 後片付け: Sandbox の API キー(`claude-mcp`)を Sandbox 管理画面で削除、`claude mcp remove paddle-sandbox-manual`。

## ユーザー本人の作業
- 月曜以降: 銀行取引明細 → Paddle 再提出(ダメなら住民票の写し)。
- Payoneer 承認メール → Paddle 本番 Payouts → Payout Settings(TODO「ユーザー本人の作業待ち」に詳細)。
- グループアドレス名義で返信する Gmail 設定(未)。

## 恒久ルール(継承)
- 視覚変更は見本→承認→実装。文言は日英の実文を見せて承認。`rtk`前置・`--no-verify`禁止。
- 公開文面は落ち着いた書き方。日本語「運営者」、英語 "I"。運営者名はローマ字のみ。
- 機微は `docs/private/`。課金・本番切替など不可逆操作は必ず事前確認。選択ボックスは使わず会話で聞く。
- 実装はサブエージェント、司令塔は設計・指示書・検収。
- ユーザーはターミナル操作不可 → 秘密の値の登録は Cloudflare/Paddle の管理画面(ブラウザ)で案内する。本番の秘密キーはチャットに貼らせない。
