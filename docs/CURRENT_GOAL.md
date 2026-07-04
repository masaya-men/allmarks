# 次セッションのゴール (= セッション 159)

## 今の状態（オンボ N-21/N-22 出荷済＝概ね OK／次は拡張 N-20 修正＋再審査）

**セッション158でやったこと（オンボ改善を完遂）:**
- **N-21（SETTINGS 説明の埋もれ）＋ N-22（POP OUT 説明シーン）を出荷**（v1 `28931b9`）→ 実機フィードバックで **POP OUT を v2 に全面作り直し**（`ca81341`＝暗幕/クリックブロック＋偽ブラウザ＋自動カーソル＋タグ点灯）→ さらに**追い込み修正4連**（`fb16eb8`/`bf34335`/`9305cbd`）で POP OUT タグ被り・SETTINGS のリングずれ/隠れ・キャプション寄り添い・**リングを portal で前面化**まで対応。全て allmarks.app 反映済・tsc0/vitest1945/build OK。詳細 [TODO_COMPLETED.md](TODO_COMPLETED.md) s158。
- オンボは概ね OK。気になる点が残っていれば冒頭で微調整。

## このセッションのゴール ＝ 拡張 N-20 修正 → v0.1.24 → 再審査提出

**ユーザー要望**：拡張のクイックタグ窓「上だけ2列」を直して Chrome ウェブストアに再提出したい（前セッション末に「次で安全に」と区切り）。

### 事実（前セッションで実コード確認済み）
- 拡張の本体＝メインリポの **`extension/` フォルダ**（tracked＝提出した本物。`chrome-extension/` は無い）。現バージョン **`0.1.23`**（[extension/manifest.json](../extension/manifest.json)）。
- 「上だけ2列」の正体＝[extension/floating-button.js:453](../extension/floating-button.js#L453) の `tagstripSplit(tags, 2)`（折りたたみプレビュー行が上位2タグを横並び）。純関数は [extension/lib/tag-strip-model.js](../extension/lib/tag-strip-model.js)、横並び CSS は `extension/floating-button.css`（L227〜）。
- **拡張は審査通過済（v0.1.23 live）＝コードを直す＝新バージョンにして再提出→審査、が必須。**

### 最初に決めること（ユーザーと相談）
- プレビュー行の直し方：**(a) 1タグに**（`tagstripSplit(tags, 1)`・最小変更）／**(b) handle だけ**（開くまでタグを出さない）。→ ユーザーの好みを聞いてから着手。

### 手順
1. **まず [docs/private/IDEAS.md](private/IDEAS.md) を読む**（拡張作業は IDEAS 先読みがルール＝I-05 SNS ボタン等）。
2. 決めた方式で [floating-button.js:453](../extension/floating-button.js#L453)（＋必要なら `floating-button.css`）を修正。
3. **`node --check` で構文確認**（拡張の JS は tsc/vitest の対象外＝偽保存/構文ミス防止）。
4. `extension/manifest.json` を **`0.1.24`** に。
5. zip でパッケージ化。
6. **ユーザーがストアに再提出**（審査待ち＝外向きの動き）。
7. 動作確認は sideload で（拡張 sprint 中は都度質問せず、最後にまとめて検証＝[feedback_batch_extension_verification]）。

### 補足
- `EXTENSION_STORE_URL`（サイトにストアリンクを載せる）は**別作業**（web 側）。「直した版を通してから公開リンクを広める」のが綺麗。同じ回にまとめるかは提出タイミングで判断。

## その後の本命バックログ（順不同・相談）
- **③ プレミアムテーマ制作**（Claude 推奨・1本目候補 Liquid Glass）。
- **④ K3 解錠実装**（計画完成済 `docs/private/2026-07-01-k3-unlock-plan.md`）。
- タグ付け強化。

## 守ること（毎回）
- default 盤面 byte-identical。**web** 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。**拡張は web deploy とは別**（wrangler 不要・zip 再提出）。
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）。**vitest は dev サーバー並走禁止**
- **偽保存対策**：Write/Edit 後は独立 Read、commit/マージ後は**生 `git log --graph`**。**拡張 JS は `node --check`**（tsc/vitest 対象外）
- オンボ spotlight を触るときは **①ターゲットを可視域に固定②portal パネルより前面にリング(z順)③説明はターゲットに寄り添える** を守る（s158 の教訓）
- アニメは GSAP（Framer Motion 禁止）。応答は日本語・簡潔に
