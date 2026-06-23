# 次セッションのゴール (= セッション 127)

## 今のゴール (1 行)

**監査フィックスの残りバッチを推奨順で進める（次候補 = B8 共有堅牢性 か B10 パフォ）。安全に確実に・バッチごと commit+deploy。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **[docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md) を読む** ← 監査フィックスの作業キュー（真実の場所・約25/44 完了）
3. ユーザーに「session 127 開始」+ 続行確認を出す

## 残りの監査バッチ（推奨順）
- **B8 共有 堅牢性**（rank9 本文バイト上限 / rank19 R2ライフサイクル明文化+掃除Cron / rank20 OGP差込ビルド時アサート / rank25 [id].ts 404統一 / rank45 sanitize純粋化）← コードのみ・次候補
- **B10 パフォ/React**（rank29 リサイズ間引き / rank24 PiP rAF cancel / rank26 persistReadFlag 画面更新 / rank40 タグ候補 useMemo / rank44 use-scroll-trigger 全消し撤去）← コードのみ
- **B11 i18n**（rank16 全キー照合テスト+translate英語フォールバック / rank11 x-intent本文配線 or 削除 / rank47 ko kicker）← 15言語同期注意
- **B3 公開用 OGP 画像**（rank4 = 🔴高優先だが**画像アセットの相談が必要**: LP を SNS に貼った時のプレビュー画像 1200×630 をどうするか。既存の共有OG生成を流用する/ブランド静的画像を作る等を user と決めてから）

## 据え置き確定（理由付き・再検討は将来）
- **rank31** by-tag インデックス利用（getAll+filter が十分速く単純・正確、複雑化の割に IndexedDB 単一ユーザーで実利益薄。将来数万件で再検討）
- **rank43** 複数タブ初回オンボ競合（rare・デモカードのみ・実データ無傷。マルチタブ協調は過剰）

## session 126 でやったこと（3つ本番反映済）
- **rank6 SSRF**: `/api/ogp` の踏み台化を封鎖（スキーム限定+内部IP排除+自前IPv4正規化+サイズ上限+リダイレクト再検証）。敵対検証3ラウンド+本番実測。**workerd の URL パーサ罠を発見**（整数/16進IPv4 非正規化・IPv6 ブラケット切断）→ [[reference_workerd_url_parser_quirks]] に記録
- **B7 ストレージ堅牢性**: rank22a(addBookmark の orderIndex を tx 内計算=同時保存重複防止)/ rank22b・41(移行ガード読取失敗のフェイルセーフ+書き戻し)/ rank32(tags.ts any→AllMarksDB)/ rank38(v14→v16 移行テスト)。rank31 据え置き
- **B9 オンボーディング**: rank7(チュートリアル中の自分リンク消失バグ=SAMPLE_URL一致時のみデモ印)/ rank23(manage の嘘コメント修正)/ rank39(MANAGE TAGS 欠落時のみ NEXT フォールバック=teach-by-doing 維持)。rank48 偽陽性・rank43 据え置き

## 守ること
- 本番 = `allmarks.app`。deploy前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。応答は日本語。
- **拡張(extension/)の修正は Pages 非対象＝commit のみ**（本番デプロイ不要）。lib/・components/・functions/ は app バンドル＝デプロイ対象。
- バッチごとに commit+push+deploy。UI変更は事前一言（ui-design.md）。新 i18n キーは15言語同期。
- progress.md を都度更新。docs/private は gitignored。
- **方針: 監査は全44件「処理」する（user 確定）**＝直す/偽陽性/据え置き(理由付き) のいずれかに必ず決着させる。コスト最適化＝サブエージェントのモデルを作業の重さで使い分け（機械的=haiku/sonnet、調査=sonnet、難所+敵対的検証=opus）。検証は省かない。
- **既知フレーキー**: `tests/lib/channel.test.ts`（BroadcastChannel タイミング）が full run でたまに落ちる→再実行で green。無関係。
- **OnboardingController はコンポーネントテスト harness 無し**。rank39 フォールバックは tsc+目視検証のみ＝実機オンボ確認は任意。
