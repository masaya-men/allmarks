# 次セッションのゴール (= セッション 70) — タグ機能 Phase 1b + 1c 実装 (= filter state + tag-candidates + WAVE CRT shutdown + FLIP reflow)

## 今のゴール (1 行)

**session 69 で完成した Phase 1a (= mood → tag rename + IDB migration) の上に、 Phase 1b (filter state + tag candidates) と Phase 1c (WAVE CRT shutdown CSS + FLIP reflow) を subagent-driven で実装する**。

## session 69 (= 直前) の到達点

- **タグ機能の brainstorming + spec + plan + Phase 1a 実装 完遂**
- spec: [tagging-design.md](./superpowers/specs/2026-05-25-tagging-design.md) 確定 (= 14 確定事項 A-T、 WAVE テーマ命名、 F6 CRT shutdown 採用、 mood リネーム前提、 カラーハント Phase 3 予約)
- plan: [tagging-phase1.md](./superpowers/plans/2026-05-25-tagging-phase1.md) 22 タスク
- **Phase 1a 完了 = 7 タスク (= 12 commits + 1 close commit)** 全 770 vitest PASS / tsc 0 errors / build success / 本番 deploy 済
  - Task 1: 型 rename (`MoodRecord` → `TagRecord` 等)
  - Task 2: `moods.ts` → `tags.ts` rename + 新規 API (`addTagToBookmark` / `removeTagFromBookmark` / `filterBookmarks`) + atomicity fix
  - Task 3: tags.ts unit テスト 13 PASS
  - Task 4: `use-moods.ts` → `use-tags.ts` rename
  - Task 5: IDB schema bump 14→15 + migration + atomic 切替
  - Task 6: v15 migration unit テスト 6 PASS
  - Task 7: UI 10 file の mood → tag 参照 rename
- user 検証: ブクマ全表示 ✓、 既存タグ無破壊 ✓、 `/triage` 旧 UI 動作確認 ✓

## session 70 でやること

1. **Phase 1b 実装 (= plan Task 8-9)**:
   - `lib/board/use-tag-filter.ts` (= filter state hook、 selectedTagIds + mode + toggle + clearAll)
   - `lib/board/tag-candidates.ts` (= サイト情報からの候補抽出 + 既存ブクマからのスコアリング)
   - 各 unit テスト
2. **Phase 1c 実装 (= plan Task 10-12)**:
   - `lib/animation/tag-shutdown/themes/wave.module.css` (= F6 CRT shutdown 全 keyframes + scanline + flicker + CSS 変数)
   - `lib/animation/tag-shutdown/index.ts` (= `getShutdownAnimationClass(theme)` API)
   - `lib/animation/tag-shutdown/reflow.ts` (= FLIP 移動 logic)
   - unit テスト
3. **時間あれば Phase 1d 着手** (= TagFilterBar、 TagAddPopover、 TagButton、 i18n 15 言語) — そうでなければ session 71 へ

## subagent-driven の継続

- ガイド: [`superpowers:subagent-driven-development`](C:/Users/masay/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/subagent-driven-development/)
- 各 task: implementer dispatch → spec reviewer → code quality reviewer → fix loop
- 不可逆 task (= IDB schema 変更) は無いので、 session 69 と同じ流れで safe

## Phase 1a で発見された後フェーズ対応事項 (= session 70 着手前にメモ)

session 69 Task 7 で code reviewer が指摘:

1. **`BoardFilter` type の `mood:${string}` literal**: IDB `board-config.activeFilter` で永続化 → Phase 1b で migration 検討余地 (= 後フェーズで `tag:${string}` に揃えるか、 現状維持か)
2. **`data-testid="mood-chip-..."`**: e2e test 依存、 Phase 1b で test 側も `tag-chip-` に更新する手あり
3. **CSS Modules class 名 `.moodChip` / `.moodDot` 等**: 視覚不変保証のため Phase 1a で触らず、 後フェーズで一括 rename 候補
4. **`NewMoodInput.tsx` ファイル名 + i18n key**: cosmetic sweep 候補
5. **`indexeddb.ts` の v9 mood 関連 JSDoc comment (`/** v9: mood id array */`)**: `tag id array` に揃える軽微 fix
6. **v16 で旧 moods store 削除 migration**: Phase 1+2+3 全部本番安定後、 rollback safety 不要になったら考える

これらは session 70 着手前後に並列処理 OK。 ただし**最優先は Phase 1b / 1c の機能実装**。

## Phase 2 brainstorm 時の重要メモ (= session 71 or 72 で扱う)

session 69 user 発案: **Triage 別 route の背景に board うっすら見せる案** (= IDEAS.md に詳細記録)。 Phase 2 brainstorm 時に必ず検討。

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (memory `feedback_collaboration_style`)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` は無視 OK、 単体 PASS)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **月末 (2026-05-31)**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)
- **使用量に注意**: session 69 は subagent dispatch 多用で消費中、 session 70 も同様の subagent 駆動 (= context は subagent 隔離されるので effective)
