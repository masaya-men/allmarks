# 次セッションのゴール — LP v10 の実機確認を反映し、次の機能を決める

## ★進行中(s224・途中で中断した場合はここから)
- ブランチ `s224-lp-feedback`。決定事項と手順の全体は非公開メモ `docs/private/2026-09-29-s224-lp-design-notes.md`。
- A(本番反映済み・ユーザー確認 OK / commit b9303181): ヒーローがヘッダーに潜る件、締めの円の反応範囲と白い部分を押せるように、流れる文字を常に右→左、フッターの斜体と後ろの黒い全画面の削除(全ページ)。
- B(見本 v11 → ユーザー指示で見本を省き本番へ直接移植中・未 commit): 移植元 `docs/private/lp-v11-mock.html`。最新の指摘 = 目盛りを5倍速く(ストロボ防止つき)、傾き 26°/20° で渡りの向きと同期して左右交互、フッターで縦に戻す、p=1 は画面が全部黒になる瞬間(締めの上端)で線が画面の下端に届き下へ抜けて消える、Share が出ない(デモ追従の上限 0.32 段/秒が原因)→ 遅れに応じて速くなる追従へ。担当2つ: (1) ScrollRail+rail.ts+BackgroundGrid+FinalCta 属性、(2) feature-timeline.ts+Features.tsx/css。作業ツリーの diff を検収 → tsc+vitest → build → deploy。e2e は未実行(ユーザー指示で重い確認なし。Features の e2e は時間配分の変更で要更新の可能性)。

## (s223 の到達点)
- **LP v10 は本番公開済み**(allmarks.app・15言語・master に統合済み)。詳細 `docs/TODO_COMPLETED.md` の「s223」節。

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
