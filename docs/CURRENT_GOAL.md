# 次セッションのゴール (= セッション 123)

## 今のゴール (1 行)

**監査で確定した44件の修正を「安全に確実に」continue。重い項目は実機計測/確認しながら、バッチごとに commit+deploy。B4(保存経路セキュリティ)は session123 で完了・本番反映済。次は B5(バックアップ安全化＋配線)から。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **[docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md) を読む** ← 監査フィックスの作業キュー（全バッチの状態・どこまで終わったか）。これが真実の場所
3. 監査レポート本体は [docs/private/2026-06-22-adversarial-audit.md](./private/2026-06-22-adversarial-audit.md)（確定44件の詳細）
4. ユーザーに「session 123 開始」+ 続行確認を出し、B4 から進める

## 状況サマリ（セッション122でやったこと）
- **敵対的・徹底監査を実施**（12領域×探索→2懐疑役で反証→統合）。総指摘57件→**確定44件**。
- 修正完了＋本番反映済（4 commit）:
  - フィルタのタグ一覧フェードが開く瞬間に短いリストを隠す不具合（max-height基準の安定判定に）
  - **rank1 スクロールでカードが並び替わる**（カード高さ計算を決定論化＝マウント順非依存。共通純関数 itemSkylineHeight に一本化）→ ✅ **ユーザー実機(545件)で「カードが動かなくなった」確認済(session122末)**。左すき間(F5)は未確認だが low 優先
  - B2 プライバシー掃除（実メアド/実名/競合・収益記述を docs/private へ退避、robots/sw 微修正）
  - 実機FB: 旧ブランド紫アクセント→ブランド緑 #28F100 に統一、PWA色も黒へ

## 残りの作業キュー（B5 以降。詳細は progress.md）
- ✅ **B4 保存経路セキュリティ＋重複統合**（rank2/12/14/30）= session123 完了・本番反映済。共通 saveBookmarkDeduped に3経路統合 + scheme検証 + atomic。実機まとめ確認は次回シート対象
- **B5 バックアップ安全化＋配線**（rank3 復元でカード配置消失 / rank8 無言失敗 / rank15 BackupButton配線=**置き場所要相談**）★次ここ。rank3/rank8 は安全に着手可、rank15 の置き場所だけ要確認（SETTINGS ドロワー内が候補）
- **B6 拡張**（rank5 フローティングボタン移動で勝手保存 / rank13 同時保存タイムアウト巻き添え / rank27,28,42,46）
- **B7 ストレージ堅牢性**（rank22 orderIndex重複 / rank31,32,38,41）
- **B8 共有堅牢性**（rank9 DoS / rank19 R2期限 / rank20 OGP差込 / rank25 / rank45）
- **B9 オンボーディング**（rank7 自分リンク削除 / rank23,39,43,48）
- **B10 パフォ/React**（rank29 リサイズ間引き / rank24,26,40,44）
- **B11 i18n**（rank16 翻訳もれ検知+英語fallback / rank11 / rank47）
- **B3 OGP画像**（rank4 SNS用画像。画像アセット作成が要るので後回し可）

## ユーザー確認待ち / 要相談
- ✅ **rank1 実機確認 完了**: ユーザーが「カード動かなくなった」と確認(session122末)。左すき間(F5)は未報告＝low優先で様子見
- rank15: BackupButton をどこに置くか（SETTINGS ドロワー内が候補）
- 全部おまかせ方針だが「重い変更は事前に一言」「区切り適宜」がユーザー希望

## 別トラック（監査と無関係・継続中）
- **拡張ストア審査結果待ち**: 承認メールが来たら最優先で `EXTENSION_STORE_URL` 投入＋デプロイ（[docs/extension-store-submission.md](./extension-store-submission.md) §7）

## 守ること
- 本番 = `allmarks.app`。deploy前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。応答は日本語。
- バッチごとに commit+push。重い/UI変更は事前確認。新i18nキーは15言語同期。
- progress.md を都度更新（文脈の永続化）。docs/private は gitignored（センシティブはそこへ）。
