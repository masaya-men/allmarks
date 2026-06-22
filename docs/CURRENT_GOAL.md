# 次セッションのゴール (= セッション 125)

## 今のゴール (1 行)

**監査で確定した44件の修正を「安全に確実に」continue。B5(バックアップ安全化＋配線＋15言語化)は session124 で完了・本番反映済。次は B6(拡張の堅牢化)。バッチごと commit+deploy、重い/UI変更は事前一言。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **[docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md) を読む** ← 監査フィックスの作業キュー（全バッチの状態）。これが真実の場所
3. 監査レポート本体は [docs/private/2026-06-22-adversarial-audit.md](./private/2026-06-22-adversarial-audit.md)（確定44件の詳細）
4. ユーザーに「session 125 開始」+ 続行確認を出し、B6 から進める

## 状況サマリ（セッション124でやったこと）
- **B5 完了・本番反映済**: バックアップを「安全＋ユーザー可用」に。
  - rank3 安全復元（原子的復元＝version照合/空・欠落倉庫を消さない/単一tx＋abortで全ロールバック）。敵対的レビュー(workflow)で実データ消失バグ2件を検出→根絶
  - rank8 無言失敗解消（catch全経路＋Zod＋confirm＋多言語アラート）
  - rank15 配線（SETTINGSドロワー内「BACKUP」区画、EXPORT/IMPORT 枠付きボタン）
  - 多言語化: 前面英語ラベルは残し、文章を `board.backup.*` で全15言語化（翻訳→検証ワークフロー26体）
  - tsc0/vitest1499/build green、実機(1489×679)＋本番スモーク確認済

## 残りの作業キュー（B6 以降。詳細は progress.md）
- **B6 拡張**（rank5 フローティングボタン移動で勝手保存 / rank13 同時保存タイムアウト巻き添え / rank27 window監視リーク / rank28 normalizeUrl照合 / rank42 デバッグログ・空locale / rank46 タグ追加要求の送信元）★次ここ
- **B7 ストレージ堅牢性**（rank22 orderIndex重複 / rank31,32,38,41）
- **B8 共有堅牢性**（rank9 DoS / rank19 R2期限 / rank20 OGP差込 / rank25 / rank45）
- **B9 オンボーディング**（rank7 自分リンク削除 / rank23,39,43,48）
- **B10 パフォ/React**（rank29 リサイズ間引き / rank24,26,40,44）
- **B11 i18n**（rank16 翻訳もれ検知+英語fallback / rank11 / rank47）
- **B3 OGP画像**（rank4 SNS用画像。画像アセット作成が要るので後回し可）

## follow-up（B5 から派生・別タスク化、優先度は低〜中）
- 拡張の設定画面(extension/options)が `_locales/en` のみ＝英語。多言語化するなら別バッチ
- TrashConfirmDialog 等、他の chrome 文章も英語ベタ書き。多言語化するなら独立バッチ（rank16=B11 と一緒にやると効率的かも）

## ユーザー確認待ち / 要相談
- 全部おまかせ方針だが「重い変更は事前に一言」「区切り適宜」がユーザー希望
- UI 見た目に関わる変更は承認フロー（現状→案→承認→実装）

## 別トラック（監査と無関係・継続中）
- **拡張ストア審査結果待ち**: 承認メールが来たら最優先で `EXTENSION_STORE_URL` 投入＋デプロイ（[docs/extension-store-submission.md](./extension-store-submission.md) §7）

## 守ること
- 本番 = `allmarks.app`。deploy前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。応答は日本語。
- バッチごとに commit+push。重い/UI変更は事前確認。新i18nキーは15言語同期。
- progress.md を都度更新（文脈の永続化）。docs/private は gitignored（センシティブはそこへ）。
