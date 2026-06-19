# 次セッションのゴール (= セッション 114)

## 今のゴール (1 行)

**✅ セッション 113 で ①AGPL-3.0 ライセンス整備 ②拡張ストア提出ドキュメント ③貼り付け保存(Ctrl+V)実装・本番反映 ④日本語コピー一括見直し+15言語反映・本番反映 まで完了。次は 実機目視確認 + 残りの公開前TODO(動画・オンボーディング・テーマ1つ・モバイル・バックアップ・公式X)+ 拡張ストア素材。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 113)」を読む
2. `git branch --show-current` で master 確認(feat/paste-to-save はマージ済・削除済)
3. ユーザーに方向確認 → 下記から着手

## 最優先: 本番 allmarks.app で実機目視(ユーザー)
- **貼り付け保存**: ボードで普通サイト URL を Ctrl+V → 読み込み中(音波)→ カード着地・サムネ表示 / ツイート・YouTube は即 / 同じURL再貼り=Already saved / タグ入力欄では普通の貼り付け / bot拒否サイトはフォールバック保存
- **コピー**: `/ja` と `/` の LP・features・guide・faq・about を見て、保存3経路・サーバー正直化・テーマ控えめ・Instagram 淡々・「同時再生」撤回 が自然か目視

## 次: 公開前の残りTODO(セッション113で確定・未着手)
- 初回ボードのチュートリアル(オンボーディング)
- ガイド等への操作動画(ユーザー「絶対つける」)
- リリース前にテーマを1つ作る(ユーザーがイメージ画像所持)
- スマホ最適化(コピーは「近日対応」に弱め済み)
- バックアップを表に出す(EXPORT/IMPORT セットで)
- 公式X開設 → Contact に導線(ハンドル決定後)+ Contact のアイデア募集文を「不具合報告歓迎」に

## 次: 拡張ストア素材の判断2点(セッション113で保留)
1. 掲載言語: 英語のみ or 英語+日本語
2. スクショ/プロモタイル: Claude が Playwright でボード撮影+タイル生成 or ユーザー用意
提出原稿一式は [docs/extension-store-submission.md](./extension-store-submission.md) に完成済み。zip は `dist/booklage-extension-0.1.20.zip`。

## 注意(コピー目視で見つかったら直す小残)
- LP の LIVE GRID デモ(NASA動画3本同時再生の見せ方)は、コピーを「フォーカス1本+他静止画」に正直化したので、デモ映像と文言の整合を一度確認(デモが過剰演出なら寄せる)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変。
- 個人情報(本名/個人メアド/個人 X 垢)を tracked ファイルに書かない。デザイン変更は提案→承認。応答は日本語。
