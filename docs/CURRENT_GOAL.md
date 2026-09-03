# 次セッションのゴール — 端末間同期 束2(極小 Function + 認証 + Google Cloud 設定)

## ★s209 の到達点(束1 = 下ごしらえ・完了・本番反映済み)
- 設計書(s208)を `superpowers:writing-plans` で実装計画に落とし(`docs/superpowers/plans/2026-09-02-device-sync-bundle-1-groundwork.md`・tracked)、`subagent-driven-development` で束1を実装。7タスク・各2段レビュー・opus 全ブランチレビュー = Ready to merge。
- 出荷: `BookmarkRecord.updatedAt?` + **v16→v17 migration**(`Date.parse(savedAt)` backfill・壊れた savedAt は `0`)/ `CardRecord.updatedAt?`(migration なし・`?? 0`)/ `touchBookmark(rec)` 純関数を全ユーザー起点書き込みに(受動書き込み=`updateBookmarkHealth`/`repairOrderIndexIfNeeded`/migration は bump しない)/ タグのソフト削除(`isDeleted`/`deletedAt` 墓標・`getAllTags` が弾く・ブクマ scrub は従来通り)/ `lib/sync/device-id.ts`(呼び出し元ゼロ)。
- **同期ロジックはゼロ。同期未接続の挙動は完全不変。** master マージ(`c5c70c98`)・`allmarks.app` デプロイ・ユーザー実機で「いつも通り」確認済(本番545件で v17 migration 通過)。
- tsc 0 / フルスイート 2581/2581 / ビルド OK。`feat/device-sync` ブランチは削除済(次の束は新ブランチ)。

## ★次セッション = 束2

### 0. 冒頭でやる(束1のレビュー積み残し・小)
設計書 `docs/private/2026-09-02-device-sync-design.md` **§15「束2 の頭でまとめて片付けるマイナー」**を消化:
- `lib/storage/tags.ts` の墓標リテラル重複 → `tombstone(tag)` ヘルパー抽出
- 古いコメント修正: `lib/tagger/quick-tag-apply.ts:38-40`、`lib/storage/use-tags.ts:43`(「UNFILTERED」記述)
- テスト補強: 純 `touchBookmark` の入力非変更 / `removePrivateTag` の bump / `apply-tag-change.test.ts` のアサート強化 / `clearCustomCardWidth` 系の専用ケース
- 見た目: `CardRecord.updatedAt` のコメントブロック位置 / `idb-v10-migration.test.ts:101` のタイトル
- (任意)`tests/lib/channel.test.ts` のフルスイート flake 調査

### 1. 束2 の計画書を writing-plans で作る
分割は設計書 §14。束2 = 極小 Function `functions/api/gauth/*`(token 交換 + refresh・**何も保存しない**)＋ `lib/sync/auth.ts`(GIS コードモデル `initCodeClient` + refresh token 管理)＋ `_routes.json` 追加。設計 §4.2 が下敷き。

### 2. ★ユーザーに Google Cloud の初期設定を1回お願いする
設計 §4.3 が下敷き。**束2 の計画書に、画面ステップで手順を書く**:
- 新規プロジェクト作成 / OAuth 同意画面(External・本番・スコープ `drive.file` `openid` `email` `profile`)/ OAuth 2.0 クライアントID = ウェブアプリケーション型(`client_secret` 発行)/ 承認済み JS 生成元 `http://localhost:3000` + `https://allmarks.app` / リダイレクト URI `https://allmarks.app`(+ローカル)
- `client_id` → `.env.production` 等 / `client_secret` → Cloudflare Pages のシークレット + `.dev.vars`

### 3. 束2 の実装(subagent-driven)
- `functions/api/gauth/token.ts` / `refresh.ts`(stateless・ログなし・zod で入力検証)
- `lib/sync/auth.ts` — 純関数中心・fetch モックで単体テスト
- deploy 前ゲート: `rtk tsc && npx vitest run && rtk pnpm build`

## 束3 以降への必須制約(設計書 §15・忘れると手戻り)
- **束3 の `merge.ts` は `updatedAt` を必ず `typeof x === 'number' ? x : 0` で読む**(v17前バックアップ復元で `updatedAt` 無し行が残る・migration 再実行不可・生の値の数値比較は `NaN`)。代替=`importAllStores` に3行 backfill。どちらか明示的に選ぶ。
- 並び替え / ツイートメディア後追い取得が `updatedAt` を bump する点を §6.5 衝突退避の文脈で扱う。
- `emptyTrash` / `deleteBookmark` はブクマを墓標なしで物理削除 → 束4着手前に設計 §6 が「EMPTY TRASH は端末ローカル」を実際にカバーしているか確認。

## 恒久ルール(継承)
- 視覚変更は `ui-design.md`「承認後」。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx(`rtk npx` は既知の不具合)・Framer Motion 禁止。
- 音(dotted-notebook)/紙(paper-atelier)＝バイト同一を死守。
- 機微(支援・値付け・戦略)は tracked に書かない＝`docs/private/`。
- merge/push/deploy は必ずユーザー確認後。ただし deploy は「本番で見たい」等の明示的な合図があれば即実行可。docs だけの push はしない(次の実務 push に同梱)。
- 選択ボックス(AskUserQuestion)はデザイン判断・意思決定・調査/デバッグ中の質問には使わない。普通の会話で聞く。
- 文言(UI コピー)を新規/変更するときは、実装前に実際の英語・日本語の文面そのものを見せて確認を得る。
- IDB/vault など不可逆な本番データに関わる変更は、実行前に必ずユーザーに事実確認する。
- 大規模調査・実装はサブエージェントに委譲(司令塔は診断・設計・指示書・検収)。

## 保留中(同期の後 or 並行)
- **N-78**: 画像無しツイート専用カード(見た目案の提示・承認が必要)。
- **N-64**: カードの＋TAGポップオーバーが再表示後に開けなくなる既存バグ(`CardsLayer.tsx`)。
- **N-63**: `BackupReminder` の表示位置が ScrollMeter に被る(モック→承認後)。
- **N-65**: ECDH 秘密鍵 unwrap 時に生バイトが一瞬 JS 経由(severity LOW・設計変更要)。
- さらなるテーマ/Flat 磨き、C2 翻訳仕上げ。
