# 次セッションのゴール (= セッション 125)

## 今のゴール (1 行)

**まず SETTINGS ドロワーの文言3点を直す（user FB・下記 A/B/C、多言語15言語）→ 終わったら B6(拡張の堅牢化) に進む。安全に確実に・バッチごと commit+deploy。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. **[docs/private/2026-06-22-audit-fix-progress.md](./private/2026-06-22-audit-fix-progress.md) を読む** ← 監査フィックスの作業キュー（真実の場所）
3. ユーザーに「session 125 開始」+ 続行確認を出し、下記 A→B→C を進める

## ★最優先: SETTINGS ドロワー文言の修正（session124 末 user FB・未着手）

session124 で BACKUP を最下部移動＋ドロワー操作文を15言語化済（commit `feat(settings)`、本番反映済）。その後 user から追加 FB：

- **A. QUICK-TAG ON SAVE も多言語化する**
  - 現状: [ExtensionEntry.tsx:172](../components/board/ExtensionEntry.tsx#L172) で `<span className={styles.toggleLabel}>QUICK-TAG ON SAVE</span>` と**英語ベタ書き**
  - やること: 新キー `board.settings.quickTagOnSave` を15言語追加し `{t('board.settings.quickTagOnSave')}` に置換
  - **連動修正(重要)**: `board.onboarding.manage.settingsBody`（15言語、各 messages/*.json）が本文で「QUICK-TAG ON SAVE」を引用している（en例: `Turn this “QUICK-TAG ON SAVE” off`）。トグル名を多言語化したら、この引用も各言語のトグル名に合わせて更新（または「この保存時タグ付けのトグル」等に一般化）。**settingsBody は ja.json 等で1行インライン化されたオブジェクト内**なので、値文字列だけを狙って Edit（JSON 全体 re-stringify はインライン展開で巨大 diff になる。要注意）
  - 推奨 en/ja: en `"QUICK-TAG ON SAVE"`（en は原文のまま）/ ja `"保存時にすぐタグ付け"`

- **B. 「拡張機能なしで保存」が意味不明 → ブックマークレット方向の良い文言に**
  - 対象キー: 既存 `board.settings.saveWithoutExtension`（15言語、値を**更新**）。ボタンはブックマークレット設置モーダルを開く（[ExtensionEntry.tsx](../components/board/ExtensionEntry.tsx) `onOpenBookmarkletModal`）
  - user 指示: 「ブックマークレットを使う。とかそういう方向で良い感じの」
  - 推奨 en/ja（要 user 確認）: en `"SAVE VIA BOOKMARKLET"` / ja `"ブックマークレットで保存"`

- **C. 「イントロをもう一度見る」→ チュートリアル方向に**
  - 対象キー: 既存 `board.settings.replayIntro`（15言語、値を**更新**）。ボタンは初回オンボーディングを再生（`onReplayIntro`）
  - user 指示: 「イントロは好きだが、ちゃんとチュートリアルをみる。とかにしましょう」
  - 推奨 en/ja（要 user 確認）: en `"REPLAY TUTORIAL"` / ja `"チュートリアルをもう一度見る"`

### 進め方メモ（効率化）
- A の新キーは「翻訳→検証ワークフロー（13言語）＋ en/ja は自分で確定」→ message へ挿入。B/C は**既存キーの値更新**なので、ワークフローで新文言を13言語訳→各 messages/*.json で当該キーの値を Edit 置換（saveWithoutExtension/replayIntro は各自1行なので置換しやすい）
- 15言語: ja, en, zh, ko, es, fr, de, pt, it, nl, tr, ru, ar, th, vi（[lib/i18n/config.ts](../lib/i18n/config.ts)）。ブランド名 AllMarks/X/YouTube/Chrome/SNS は不訳
- 検証: tsc / vitest / build → 実機(1489×679)で ja ドロワー描画確認 → 本番デプロイ。ExtensionEntry.test は testid 参照なので文言変更で壊れない
- 切り分け方針の根拠: [[feedback_ui_vocabulary]]（記号ラベルは英語/意味文は多言語）

## 残りの作業キュー（A/B/C 後。詳細は progress.md）
- **B6 拡張**（rank5 フローティングボタン移動で勝手保存 / rank13 同時保存タイムアウト巻き添え / rank27,28,42,46）
- B7 ストレージ堅牢性 / B8 共有堅牢性 / B9 オンボーディング / B10 パフォ・React / B11 i18n(rank16翻訳もれ検知) / B3 OGP画像
- follow-up（低優先）: 拡張 options 画面(英語のみ)の多言語化 / TrashConfirmDialog 等ボード内ダイアログの多言語化（B11 と一緒が効率的）

## 状況サマリ（session124 でやったこと）
- **B5 完了・本番反映済**: バックアップを「安全＋ユーザー可用」に（rank3 原子的復元/rank8 無言失敗解消/rank15 SETTINGSドロワー配線/全15言語化）。敵対的レビューで実データ消失バグ2件検出→根絶。**user が実機で EXPORT 成功（version16・全データ確認）**
- **追加**: BACKUP を仕切り線付きで最下部へ移動＋ドロワー操作文を15言語化（A/B/C はその後の追加 FB）

## 守ること
- 本番 = `allmarks.app`。deploy前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。応答は日本語。
- バッチごとに commit+push。UI変更は事前一言。新i18nキーは15言語同期。
- progress.md を都度更新（文脈の永続化）。docs/private は gitignored。
