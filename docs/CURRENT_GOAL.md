# 次セッションのゴール (= セッション 126)

## 今のゴール (1 行)

**B6（拡張の堅牢化）完了。次は監査フィックスの残りバッチ（次候補=B7 ストレージ堅牢性）を進める。安全に確実に・バッチごと commit+deploy。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **[docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md) を読む** ← 監査フィックスの作業キュー（真実の場所）
3. ユーザーに「session 126 開始」+ 続行確認を出す

## 拡張の実機確認状況（rank5 = 確認済み）
session125 で B6 拡張修正を ship。**拡張は Cloudflare Pages に乗らない**（Chrome に unpacked で読み込む別物＝commit のみ・本番デプロイ不要）。
- ✅ **rank5（ドラッグで勝手に保存しない）= user 実機確認 OK（session125 末）**。最重要かつ唯一手で確かめる価値があった所＝完了。
- rank13（同時保存の巻き添え失敗）／回帰スモークは **実機テスト任意**。rank13 は稀で手動再現が非現実的、敵対的コードレビュー2ラウンド＋自動テスト(vitest 1505)で担保済。rank42 のログ除去は grep で「extension/ に console.log 0件」を確認済。→ 追加の実機確認は不要扱いで OK（user が気にしたら案内）。

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
- **方針: 監査は全44件やる（user 確定）。ただしコスト最適化＝サブエージェントのモデルを適宜選ぶ**: 機械的作業=haiku/sonnet、調査=sonnet、難所＋敵対的検証=opus（安いモデルが作業→強いモデルが検証）。メインモデルは user が /model・/fast で制御。
