# 次セッションのゴール (= セッション 71) — タグ機能 Phase 1e 配線 (= BoardRoot 統合 + 視覚検証 + 本番 ship + user 検証)

## 今のゴール (1 行)

**session 70 で完成した Phase 1b/1c/1d (= 9 タスク 10 commits、 全部 dead code として bundle に存在) を BoardRoot.tsx / CardsLayer.tsx に配線して活性化、 user 視点で「タグ chip 押せる + CRT shutdown 発動 + reflow + popover」 が動く状態を本番に出す**。

## session 70 (= 直前) の到達点

- **Phase 1b/1c/1d 9 タスク完遂** (= 10 commits、 vitest 770 → **804 PASS** [+34]、 tsc 0 errors、 build success、 deploy 1)
- 全部 subagent-driven (= 8 タスクは初回両 review PASS、 Task 15 のみ CSS divergence で 1 回 fix loop)
- user 視点: **見た目変化なし** (= 配線が Phase 1e 残のため未活性、 dead code として bundle に同居)
- 完成したもの:
  - `lib/board/use-tag-filter.ts` (filter state hook)
  - `lib/board/tag-candidates.ts` (siteName + ハッシュタグ + 同ドメイン頻出スコアリング)
  - `lib/animation/tag-shutdown/themes/wave.module.css` (F6 CRT shutdown + scanline + flicker)
  - `lib/animation/tag-shutdown/index.ts` (theme key → CSS class API)
  - `lib/animation/tag-shutdown/reflow.ts` (Web Animations API translate FLIP)
  - `components/board/TagFilterBar/` (chip + AND/OR + counter + 解除)
  - `components/board/TagAddPopover/` (既存タグ + サイト候補 + 新規入力 + Esc、 click-only)
  - `components/board/TagButton/` (chrome の TAG ボタン)
  - i18n 15 言語 (`messages/{ar,de,en,es,fr,it,ja,ko,nl,pt,ru,th,tr,vi,zh}.json` の `tag.*` 7 keys 英語値統一)

## session 71 でやること (= plan Task 17-22)

1. **Task 17: BoardRoot に tag filter state 配線** (= 最重要、 最初に着手)
   - `useTagFilter()` 呼び出し
   - 各カードに `data-tagged-out="true"` (= 非該当時) 属性付与
   - `getShutdownAnimationClass('wave')` で取得した class を `data-tagged-out` カードに付与
   - 視覚不変保証 (= 既存テスト 804 PASS 維持)

2. **Task 18: TagAddPopover を CardsLayer に統合**
   - カード hover で右上に `+ TAG` アイコン (= MediaTypeIndicator / リサイズハンドルと被らない位置)
   - click で popover open、 Esc / 外 click / 再度 click で close
   - `addTagToBookmark` / `removeTagFromBookmark` (= Phase 1a の API) 呼び出しで IDB 永続化
   - tag-candidates ([extractCandidatesFromBookmark](../lib/board/tag-candidates.ts)) で siteCandidates 算出して popover に渡す

3. **Task 19: TagButton を chrome に追加**
   - 既存 TUNE / POP OUT / SHARE と並列配置 (= ScrollMeter の隣接エリア)
   - click で Phase 1 用の簡易タグ管理 modal を出す or `Sidebar.tsx` 流用 (= plan で判断、 Phase 2 Triage 入口プレースホルダー)

4. **Task 20: FLIP reflow を BoardRoot に統合**
   - shutdown 開始と同期して該当カードの新 masonry 位置計算
   - `runFlipReflow` 呼び出し、 GSAP timeline と共存させるか
   - **既存 [CardsLayer.tsx](../components/board/CardsLayer.tsx) に GSAP-FLIP 実装があるのを Task 12 implementer が発見** → ここで統合判断 (= 既存流用 or runFlipReflow で代替)

5. **Task 21: preview で全機能を実機検証**
   - playwright + 本人画面 1489×2.58、 4K デバイス
   - チェック項目: ①CRT shutdown 5 段階の見た目 ②stagger の波感 ③reflow なめらか + FLIP 詰まる位置のズレなし ④popover 出る位置正確 ⑤AND/OR トグル動作 ⑥50/200 ブクマでのパフォーマンス ⑦prefers-reduced-motion ON で simple-fade 置換

6. **Task 22: 本番 ship + user 検証案内**
   - `pnpm build` + `wrangler pages deploy out/`
   - user に「`booklage.pages.dev` ハードリロード」 案内
   - user 検証チェックシート (= タグ作成 → chip click → CRT shutdown 確認 → reflow 確認 → 解除 → 別 chip click → AND/OR 切替 → popover で削除トグル 等)

## 重要な事前準備 (= session 71 着手時にまず読む)

1. **必ず [BoardRoot.tsx](../components/board/BoardRoot.tsx) を読んでから着手** (= 既存 chrome 配線パターン + ScrollMeter 周辺の隣接配置の流れを把握)
2. [CardsLayer.tsx](../components/board/CardsLayer.tsx) も読む (= 既存 GSAP-FLIP の場所を確認、 統合方式を decide)
3. plan の Task 17-22 詳細: [tagging-phase1.md](./superpowers/plans/2026-05-25-tagging-phase1.md) L1900-2255

## subagent-driven 続行 or 直接実装の判断

- Task 17 は BoardRoot.tsx (= 大きい既存 file) を modify するので、 **直接実装が安全** (= subagent は既存パターンを掴みにくい、 context 不足リスク)
- Task 18-20 も既存 component と密結合、 直接実装推奨
- Task 21 (preview 検証) は controller 自身が playwright で実行
- Task 22 (ship) は controller 自身

つまり session 71 は **subagent dispatch ≠ メインモード、 直接実装 + 適宜 subagent で TDD test 起こす** の混合戦略推奨。

## Phase 1a で発見された cleanup 候補 6 件 (= Phase 1e と並列処理 OK)

session 69 / 70 で code reviewer が指摘した cosmetic 残:
1. `BoardFilter` type の `mood:${string}` literal (= IDB 永続化、 Phase 1e で `tag:${string}` 移行検討)
2. `data-testid="mood-chip-..."` (= e2e test 依存、 Phase 1e で `tag-chip-` に更新)
3. CSS Modules class 名 `.moodChip` / `.moodDot` 等 (= 視覚不変保証で Phase 1a で温存、 後フェーズ一括 rename 候補)
4. `NewMoodInput.tsx` ファイル名 + i18n key (= cosmetic sweep 候補)
5. `indexeddb.ts` の v9 `/** v9: mood id array */` JSDoc comment (= `tag id array` に揃える軽微 fix)
6. v16 で旧 moods store 削除 migration (= Phase 1+2+3 全部本番安定後、 rollback safety 不要になったら)

これらは Phase 1e 着手と並列処理 OK。 ただし**最優先は Phase 1e 配線**。

## Phase 2 brainstorm 時の重要メモ

session 69 user 発案: **Triage 別 route の背景に board うっすら見せる案** (= IDEAS.md に詳細記録)。 Phase 2 brainstorm 時に必ず検討。

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (memory `feedback_collaboration_style`)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 無視 OK、 単体 PASS)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **月末 (2026-05-31) まで残り 6 日**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)
- session 70 までで本セッション内 deploy は 1 (= 月次枠余裕、 1 日 16 deploy 上限内)
