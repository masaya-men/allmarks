# 次セッションのゴール (= セッション 126)

## 今のゴール (1 行)

**B6（拡張の堅牢化）完了。次は監査フィックスの残りバッチ（次候補=B7 ストレージ堅牢性）を進める。安全に確実に・バッチごと commit+deploy。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **[docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md) を読む** ← 監査フィックスの作業キュー（真実の場所）
3. ユーザーに「session 126 開始」+ 続行確認を出す

## ⚠️ 拡張の実機まとめ確認が未消化（最初に案内）
session125 で B6 拡張修正を ship 済だが、**拡張は Cloudflare Pages に乗らない**（Chrome に unpacked で読み込む別物）。動作確認はユーザーが拡張を再読込して手で試す形。session125 末に「実機確認シート」を提示済み。まだ試していなければ最初に促す：
- rank5: フローティングボタンを**ドラッグ移動**→保存されない／**普通に1クリック**→保存される／**動かさず長め（0.5秒）に押して離す**→保存される（v2 で直した回帰ポイント）
- rank13: 重いページ（YouTube 等）で自動保存と手動保存を重ねて発火→両方正しく結果が出る（片方が赤い失敗にならない）。稀なので単独保存・タグ付けが普段通りでも OK
- 回帰スモーク: ペースト/ブックマークレット/拡張ワンクリック保存、重複「保存済み」表示、保存後クイックタグ付け が普段通り。DevTools に [AllMarks] デバッグログが出ない

## 残りの監査バッチ（progress.md が詳細・真実）
- **B7 ストレージ堅牢性**（rank22 orderIndex 同時保存重複→1tx / rank31 by-tag index / rank32 storage層 any / rank38 v14→v16移行テスト / rank41 移行ガード書き戻し）← 次候補
- B8 共有堅牢性（rank9,19,20,25,45）/ B9 オンボーディング（rank7,23,39,43,48）/ B10 パフォ・React（rank24,26,29,40,44）/ B11 i18n（rank11,16,47）/ B3 公開用 OGP 画像（rank4）
- follow-up（低）: 拡張 options 画面(英語のみ)多言語化 / TrashConfirmDialog 等ボード内ダイアログ多言語化（B11 と一緒が効率的）

## session125 でやったこと（要約）
- **A/B/C SETTINGS ドロワー文言の多言語化（15言語）完了・本番 allmarks.app 反映＆確認済**: A=トグル名を新キー `board.settings.quickTagOnSave`（ja「保存時にすぐタグ付け」）＋連動オンボ文、B=`saveWithoutExtension`→ブックマークレット方向、C=`replayIntro`→チュートリアル方向。tsc/vitest1505/build green、実機(1489×679) ja 描画クリップ無し確認。
- **B6 拡張の堅牢化 完了**: rank5（ドラッグ後の勝手保存→justDragged を movement-gate 化）/ rank13（同時保存の巻き添え失敗→offscreen 参照カウント化、増分を冲頭へ、undefined 復旧）/ rank42（残存 console.log 全除去）/ rank28（normalizeUrl 不変条件ガードテスト）。rank27・rank46 は**偽陽性**と確定。**敵対的検証2ラウンドで両修正の隠れ不具合（静止長押し回帰・OGP 窓レース）を発見→v2 で修正→再確認**。全 commit+push 済。

## 守ること
- 本番 = `allmarks.app`。deploy前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。応答は日本語。
- **拡張(extension/)の修正は Pages 非対象＝commit のみ**（本番デプロイ不要）。動作確認は拡張再読込＋手動。
- バッチごとに commit+push。UI変更は事前一言。新 i18n キーは15言語同期。
- progress.md を都度更新（文脈の永続化）。docs/private は gitignored。
