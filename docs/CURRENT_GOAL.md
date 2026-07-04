# 次セッションのゴール (= セッション 162)

## 今の状態（③バックアップの法的守り A〜D 出荷・本番反映済／次＝①自動画像）

**セッション161でやったこと（全て本番 `allmarks.app` 反映済・merge `bb168f5`）:**
- **③ バックアップの法的守り A〜D 完遂**（brainstorm→spec→plan→サブエージェント駆動7タスク＋各レビュー＋opus 全ブランチレビュー「READY TO MERGE」）:
  - **A 利用規約**：§3 に「データは端末内のみ・**自分で控えを取る責任は利用者**・端末変更/消去/故障での消失は復元不可」を15言語追記（**本番 /terms で live 確認済**）。
  - **B 初回カード**：オンボ後（既存ユーザーは初回ロード）に一度だけ「データはこの端末の中だけ」を**淡々調**（ポエム排除）で説明→「GOT IT」で了解時刻を記録＝二度と出ない。
  - **C SETTINGS 表示**：「Last backup: N days ago / never」を常駐表示。
  - **D 定期リマインド**：**新規15件＋30日**が揃った時だけ「EXPORT で控えを」＝まめな人には出ず溜める人にだけ稀に。EXPORT で自然沈黙。
  - EXPORT を共有ヘルパ `exportBackupFile` に集約し **最終バックアップ時刻を記録**（SETTINGS ボタン／リマインド両方）。tsc0 / **vitest1970** / build OK / default 盤面 byte-identical。
- **重要な学び**：`BoardItem` は `savedAt` を持たない（raw `BookmarkRecord` のみ）→ D の新規件数は effect 内で `db.getAll('bookmarks')` を `!isDeleted` で絞って算出（use-board-data と同じ実削除フィールド）。vitest4 は `vi.fn<[..],..>()` の2引数ジェネリックが tsc で落ちる（`vi.fn<Fn>()` に）。

## このセッションのゴール ＝ ① 自動画像（保存時に操作ゼロで良い絵を採用）

**目的**：保存時に**手間を増やさず**（memory `feedback_automatic_capture_no_steps`）、og:image が無い記事はページ内の良い画像を自動採用／無ければブランドタイル自動生成。詳細は IDEAS.md の **X-01 / X-11 / X-13**（ヒーロー底上げ・フィルムストリップ）。まず `superpowers:brainstorming` で範囲合意→spec→plan→サブエージェント駆動。

## その後のバックログ（順）
- **② カラーハント**：保存時パレット抽出（既存 backfill・他サイト画像は CORS で画像中継が要る）。IDEAS.md X 節。
- **E（DB更新前の控え促し）**：将来のスキーマ変更（不可逆）の直前に自動で控えを促す安全網。今回 non-goal として先送り。spec `2026-07-04-backup-legal-safeguard-design.md` §3 に記載。
- **複数端末同期（案B＝ユーザー自身のGoogleドライブ等）**：サーバー無しを守ったまま同期。課金対象候補。**専用セッションで brainstorm**（まず技術spike）。骨子は `docs/private/IDEAS.md` の `(SYNC)` 節。

## ⚠ 公開前ゲート（忘れない）
- **バックアップ機能の13言語（en/ja以外）の翻訳、特に Terms 法的条項は Claude のたたき台＝未レビュー**。ワイドローンチ前に**ネイティブ＋弁護士等の法務レビュー**を必ず通す（spec 冒頭にも明記）。ru の `{days} дн.` は格変化省略。

## 守ること（毎回）
- 見た目変更は ui-design.md 準拠＋実機検証してからデプロイ。default 盤面 byte-identical。
- web 変更は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 機微情報は `docs/private/` のみ。既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）。vitest は dev サーバー並走禁止。Write/Edit 後は独立 Read、マージ後は生 `git log`。応答は日本語・簡潔・平易に。
