# 次セッションのゴール (= セッション 106)

## 今のゴール (1 行)

**🎉 session 105 で「保存直後タグ付け 第3段(拡張なしブックマークレット)」完成・本番 allmarks.app に反映済。`/save` ポップアップ窓が、トグル ON かつ PiP 未表示のとき PiP 風のタグUI(既存タグ + 新規作成、カードなし)に変身して、その場でタグ付けできる。サブエージェント駆動(各タスク2段レビュー + 通し最終レビュー opus)で実装。tsc 0 / vitest 1018 / build OK。次は user 実機確認(下記)→ OK なら 公開準備(言語切替・onboarding・LP・拡張ストア素材)へ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 105)」を読む
2. **本番は `allmarks.app`**(deploy は `--project-name=allmarks --branch=master`)
3. user に「第3段の実機確認どうだった?」を確認 → 問題なければ公開準備へ

## 🔴 user の実機確認(本番 allmarks.app + 拡張オフ + 自前ブックマークレット)
**重要: この経路は「拡張機能を入れていない人」専用。確認するには Chrome 拡張を一時オフにする。**
1. ブックマークレットを再取得(配布元ページから)。**まず `window.resizeTo` で小窓が広がるか**を見る(横280×縦360 目安)。**広がらなければ次セッションで Task 6**(ブックマークレットの `resizable=1` 化、`lib/utils/bookmarklet.ts`、公開前なので影響ゼロ)を実施。
2. 設定 **OFF** → 保存で窓が一瞬で閉じる(今まで通り)。
3. 設定 **ON + ボードで PiP(Pop Out)を開いた状態** → 保存で窓は出ず、PiP に新カードが入る(そこでタグ付け)。
4. 設定 **ON + PiP なし**(大多数) → 窓がタグUIに変身。既存タグタップで付与 → 開いてるボードに即反映。**新規タグ作成**もできて反映。
5. ライフサイクル: **無操作で約5秒で自動クローズ** / マウスを乗せる or **入力し始めると閉じない** / タグ付け後にマウスが窓から離れると閉じる / ✕ で閉じる / 新規タグを打鍵中(入力欄に文字がある)は離れても閉じない。
6. **拡張あり経路・カーソルピルが不変**(回帰なし)。

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
