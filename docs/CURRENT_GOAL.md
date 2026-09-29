# 次セッションのゴール — LP v10 の実機確認を反映し、次の機能を決める

## ★最初に(s223 の到達点)
- **LP v10 は本番公開済み**(allmarks.app・15言語・master に統合済み)。詳細 `docs/TODO_COMPLETED.md` の「s223」節。
- 最初にユーザーへ聞く: スマホ(iPhone Safari)とパソコンで LP を見た感想・気になった点。特に、固定して見せる3区画(Problem・Features・締め)の留まり方、入口の演出、長い言語で見出しが3行になる所。
- 指摘があれば見本(`docs/private/lp-v10-mock.html`)と見比べて直す → テスト(`tests/e2e/landing-v10.spec.ts`)→ 公開。

## 次の機能(ユーザーと相談して1つ選ぶ)
- ボード UI の刷新(棚卸し `docs/superpowers/specs/2026-09-26-board-ui-inventory.md`)
- スマホの操作(削除できない・絞り込み一覧が下のナビに隠れる)— TODO.md「スマホの操作」
- LP v10 の後片付け候補 — TODO.md「LP v10 の持ち越し」

## 決済(Paddle)
- 書類確認の結果をユーザーに聞く。本人作業と有料公開の手順は非公開ファイル `docs/private/2026-09-29-paddle-user-tasks.md`(公開リポジトリには書かない)。

## 恒久ルール(継承)
- 視覚変更は見本→承認→実装。文言は日英の実文を見せて承認。`rtk`前置・`--no-verify`禁止。
- 公開文面は落ち着いた書き方。機微(価格の考え方・本人書類・個人情報)は `docs/private/` のみ。
- 実装はサブエージェント、司令塔は設計・指示書・検収。選択ボックスは使わず会話で聞く。
- LP の CSS: `overflow-x` は `hidden` ではなく `clip`(`hidden` は sticky を壊す)。LP 専用の見た目は `.lpRoot.lpHome` の下に限定。
