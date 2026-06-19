# 次セッションのゴール (= セッション 114)

## 今のゴール (1 行)

**✅ セッション 113 で ①AGPL-3.0 ライセンス ②拡張ストア提出ドキュメント ③貼り付け保存(Ctrl+V、ボード+PiP)④コピー15言語正直化 ⑤YouTubeライブURL修正 ⑥PiPプレースホルダー一致 まで実装・本番反映・ユーザー実機「完璧」確認済。次は 公開前の残TODO + 拡張ストア素材。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 113)」を読む
2. `git branch --show-current` で master 確認
3. ユーザーに方向確認 → 下記から着手

## 次の候補(公開前の残TODO・セッション113で確定・未着手)
- **初回ボードのチュートリアル(オンボーディング)** — 貼り付け保存(Ctrl+V)を初回案内に組み込める
- **ガイド等への操作動画**(ユーザー「絶対つける」)
- **リリース前にテーマを1つ作る**(ユーザーがイメージ画像所持。コピーは「テーマ順次追加」で控えめ化済み)
- **スマホ最適化**(コピーは「近日対応」に弱め済み)
- **バックアップを表に出す**(EXPORT/IMPORT セットで。IDEAS.md「ちゃんとしたデータ持ち運び」と統合)
- **公式X開設** → Contact に導線(ハンドル決定後)+ Contact のアイデア募集文を「不具合報告歓迎」に

## 次: 拡張ストア素材の判断2点(セッション113で保留)
1. 掲載言語: 英語のみ or 英語+日本語
2. スクショ/プロモタイル: Claude が Playwright でボード撮影+タイル生成 or ユーザー用意
提出原稿一式は [docs/extension-store-submission.md](./extension-store-submission.md) に完成済み。zip は `dist/booklage-extension-0.1.20.zip`。提出後 `EXTENSION_STORE_URL`(`lib/board/constants.ts`)に URL を入れると board の「GET EXTENSION」と紹介ページが自動点灯。

## 小残・気づいたら直す
- LP の LIVE GRID デモ(動画3本の見せ方)とコピー「フォーカス1本+他静止画」の整合を一度確認(デモが過剰なら寄せる)。
- `/api/ogp` の favicon 抽出は一部サイトで取れない(貼り付け時)。no-image はプレースホルダーで揃うので影響軽微・据え置き可。
- 法務ページ本文の補助リンク href のローカライズ(`/ja/privacy` の「お問い合わせ」が英語 `/contact` 着地)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変。
- 個人情報(本名/個人メアド/個人 X 垢)を tracked ファイルに書かない。デザイン変更は提案→承認。応答は日本語。
