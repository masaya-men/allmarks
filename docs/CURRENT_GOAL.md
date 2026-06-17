# 次セッションのゴール (= セッション 106)

## 今のゴール (1 行)

**🎉 session 105 で「保存直後タグ付け 第3段(拡張なしブックマークレット)」完成・本番 allmarks.app に反映済。`/save` ポップアップ窓が、トグル ON かつ PiP 未表示のとき PiP 風のタグUI(既存タグ + 新規作成、カードなし)に変身して、その場でタグ付けできる。サブエージェント駆動(各タスク2段レビュー + 通し最終レビュー opus)で実装。tsc 0 / vitest 1018 / build OK。次は user 実機確認(下記)→ OK なら 公開準備(言語切替・onboarding・LP・拡張ストア素材)へ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 105)」を読む
2. **本番は `allmarks.app`**(deploy は `--project-name=allmarks --branch=master`)
3. user に「第3段の実機確認どうだった?」を確認 → 問題なければ公開準備へ

## session 105 末の user 実機確認 結果(本番で確認済)
- `window.resizeTo` で小窓が広がる = **OK(Task 6 不要・確定)**。
- ライフサイクル(自動で消える/触ると止まる/付けて離れると閉じる/✕)= **OK**。
- ただし「窓が中身付きでチラッと出てから閉じる/切り替わる」のが体験悪い(OFF・PiP開・PiPなし 全ケース)→ **同 session で改善 ship 済**: 決定するまで小窓は**暗い無地**で何も出さない(`.blank`、保存合図は元ページのトーストが担当)+ タグ画面は**広げてから1回だけ**表示(`resizeTo` を `setState('tags')` の前に)。commit `abd2db3`。本番反映済。
- **🔴 次セッション最初**: この no-flash 改善を本番で再確認(チラつきが許容範囲になったか)。窓が一瞬現れること自体はブラウザ仕様上ゼロにできない(保存に AllMarks の窓が必須)= user 了承済。

## 拡張なしでもカーソルピルを出す(= user が「ちゃんとやる」確認、別タスク)
- 今回の第3段とは**別機能**。`docs/private/IDEAS.md` に記録済。次のどこかで brainstorming→spec→plan→実装。本命は**本物のピル(extension の CSS)を透明 iframe で元ページに重ね、ブックマークレットがカーソル追従させる案(B)**。今日は未着手で正しい。

## 次の候補(第3段の確認が済んだら)
- **公開準備**: i18n 言語切替の配線(要 brainstorming)/ onboarding / LP 整備 / 拡張ストア公開素材。
- **(別タスク・保留)拡張なしでもカーソルピルを出す**: `docs/private/IDEAS.md` に記録済。本物のピル(extension のCSS)を透明 iframe で重ねてカーソル追従させる案(B)が本命。着手時は brainstorming から。

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機/本番で測ってから「動いてる」と報告
- 設計 `docs/superpowers/specs/2026-06-17-quick-tag-on-save-phase3-bookmarklet-design.md` / 計画 `docs/superpowers/plans/2026-06-17-quick-tag-on-save-phase3-bookmarklet.md`
- 発明しない・本物の部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。デザイン変更は提案→承認→実装
- `DB_NAME='booklage-db'`・`booklage:*`・`booklage-save` 窓名 等の不可視符号は**永久に維持**
- i18n: 新 key は 15 言語全部に同期
- **フォローアップ(非急)**: PiP の付与ロジックを共有ヘルパー `lib/tagger/quick-tag-apply.ts` に寄せて二重管理を解消(今は温存=リスク回避)。IDEAS.md にも記録。
