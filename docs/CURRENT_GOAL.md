# 次セッションのゴール — Paddle Sandbox で通しテスト(商品登録 → テスト購入 → 鍵 → 解約で停止)

## ★s221(2026-09-24)の到達点

Paddle 本番審査 **通過**(live)。Payoneer 申請済(審査待ち約2営業日)。決済→鍵→失効の仕組みを**コードは全部完成**(push 済・未デプロイ):
- サーバー: `functions/api/license/{purchase,status,release}.ts`、activate の端末名+外した端末の記録(`rm:<kid>`)。webhook は使わず確認のたびに Paddle API へ問い合わせる方式(ユーザー了承・¥0)。
- アプリ: `runSyncCycle` 入口の関門(`lib/board/license-check.ts`、24h ごと確認・7日猶予)、SYNC 欄に停止表示3種(承認済み文面)。
- 公開側: 料金ページのボタン → Paddle.js 決済(`NEXT_PUBLIC_PADDLE_*` 未設定なら今まで通り押せない)、購入完了ページ `/purchase?txn=`(15言語・noindex)。
- 設計書: `docs/private/2026-09-24-paddle-license-lifecycle-design.md`。Paddle 公式プラグイン(`paddle@claude-community`)導入済・**本番(live)接続は許可しない方針**。

## ★次にやること(この順で)

1. 再起動後、Paddle プラグインの Sandbox キー入力をユーザーが実施済みか確認 → paddle-sandbox MCP で **商品2つ・価格4つ**(同期 月¥500/年¥5,000、サポーター 月¥1,500/年¥15,000)を Sandbox に作成。client-side token も作成(MCP で不可ならユーザーに画面で)。
2. サーバー用 Sandbox API キー(transaction.read + subscription.read のみ)をユーザーに作ってもらい `.dev.vars` に `PADDLE_API_KEY` / `PADDLE_ENV=sandbox`(ユーザーが自分で貼る・チャットに出さない)。`.env.local` に `NEXT_PUBLIC_PADDLE_*`(公開値)。
3. ローカル(`wrangler pages dev`)で偽カード購入 → 鍵表示 → 貼付 → 同期 → Sandbox で解約 → 翌確認で停止。**領収書メールに txn_ が載るか確認**(載らなければ購入完了ページの「注文番号」文言と入力値を変える)。
4. 残り: 端末一覧+「外す」UI(見本→承認)、`応援する(近日公開)`→料金ページ、プライバシーの「Paddle から受け取るもの」修正、本番キー切替は事前確認。

## ユーザー本人の作業
- Payoneer 承認メール → Paddle 本番 Payouts → Payout Settings 入力(TODO「ユーザー本人の作業待ち」に詳細)。
- グループアドレス名義で返信する Gmail 設定(未)。

## 恒久ルール(継承)
- 視覚変更は見本→承認→実装。文言は日英の実文を見せて承認。`rtk`前置・`--no-verify`禁止。
- 公開文面は落ち着いた書き方。日本語「運営者」、英語 "I"。運営者名はローマ字のみ。
- 機微は `docs/private/`。課金・本番キー切替など不可逆操作は必ず事前確認。選択ボックスは使わず会話で聞く。
- 実装はサブエージェント、司令塔は設計・指示書・検収。
