# 次セッションのゴール (= セッション 106)

## 今のゴール (1 行)

**🎉 session 105: 拡張なしブックマークレットの保存窓を再設計・本番反映済。`/save` 窓を**最初から最終サイズ(300×380)で開き**(リサイズなし=チラつきの根本排除)、**Saving → Saved / Already saved / Failed** を意図して見せ、**quick-tag ON かつ PiP未表示なら Saved の下に任意タグ付け**(既存+新規)。元ページ右上トーストは廃止。サブエージェント駆動(各タスク2段レビュー + 通し最終レビュー opus、tsc 0 / vitest 1019 / build OK)。次は user 実機確認(下記)→ OK なら公開準備へ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 105)」を読む
2. **本番は `allmarks.app`**(deploy は `--project-name=allmarks --branch=master`)
3. user に「保存窓の実機確認どうだった?」を確認 → OK なら公開準備へ

## 🔴 user の実機確認(本番 allmarks.app + 拡張オフ + 自前ブックマークレット)
**重要: ブックマークレットの中身を変えた(窓サイズ + トースト廃止)ので、必ず配布元からブックマークレットを「取り直し」してから確認すること。** 拡張は一時オフに。
1. 保存 → 窓が**最初から最終サイズ(300×380)で一発で出る**(小→大の変身・チラつきが無いか = 今回の肝)。
2. 新規保存 → Saving → **Saved ✓**(英語ラベル、1文字ずつ出る)。同じURL再保存 → **Already saved**(⚠アンバー)。失敗 → **Failed**。
3. quick-tag **ON + PiP なし** → Saved の下にタグ(既存+新規作成)。タップでボード即反映。
4. quick-tag **OFF / PiP 開** → Saved/Already saved だけで自動クローズ(~1.8s)。
5. ライフサイクル: 無操作5sで閉じる / マウス乗せる・入力で止まる / 離れたら閉じる(入力中は閉じない)/ ✕。
6. 元ページ右上の四角いトーストが**もう出ない**こと。
7. **拡張あり経路・カーソルピルが不変**(回帰なし)。
8. 目視微調整候補(気になれば次セッションで): 窓サイズ・位置・✕配置・Saved の世界観の作り込み。

## 次の候補(保存窓の確認が済んだら)
- **公開準備**: i18n 言語切替の配線(要 brainstorming)/ onboarding / LP 整備 / 拡張ストア公開素材。

## 設計・計画
- 設計 `docs/superpowers/specs/2026-06-17-bookmarklet-save-window-redesign-design.md`
- 計画 `docs/superpowers/plans/2026-06-17-bookmarklet-save-window-redesign.md`
- (没)カーソルピル案・第3段は撤去/不採用。経緯は [[project_bookmarklet_popup_flash_deadend]]・IDEAS.md。

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機/本番で測ってから「動いてる」と報告
- 発明しない・本物の部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。デザイン変更は提案→承認→実装
- `DB_NAME='booklage-db'`・`booklage:*`・窓名 `booklage-save` 等の不可視符号は**永久に維持**
- i18n: 新 key は 15 言語全部に同期
