# 次セッションのゴール (= セッション 72) — タグ機能 Phase 2 着手 or Phase 1 cleanup の優先順位を user と確認 + 着手

## 今のゴール (1 行)

**session 71 で完成した Phase 1 (= chip 押下で CRT shutdown + reflow、 hover で + TAG popover、 chrome の TAG button + 簡易 list modal) を user に実機検証してもらい、 (a) Phase 2 (= Triage 本実装) ・ (b) Phase 1 polish (= reverse-fade-in アニメ、 mood → tag 一括 rename) ・ (c) 別 backlog (= multi-playback Tier 2 等) のどれを次に進めるか合意 → 着手**。

## session 71 (= 直前) の到達点

- **Phase 1 完成 + ship 済** (= 3 commits、 vitest 804 PASS 維持、 tsc 0 errors、 deploy 2 回)
- 動くもの (= booklage.pages.dev で確認):
  - カード hover で top-left に `+ TAG` ボタン
  - 押すと popover: 既存タグ toggle (= ✓ 表示) + 元サイト候補 (= YouTube/X/Vimeo/TikTok/SoundCloud/Instagram/note/GitHub の friendly name + 同サイトの頻出タグ) + 新規入力 (= Enter で作成 + 即付与)
  - chrome に `TAG` ボタン (= TUNE の隣)、 押すと SimpleTagList placeholder modal (= 全タグ列表示 + CLOSE、 Phase 2 で Triage 本実装に進化)
  - タグが 1+ 件あれば canvas top-left に `TagFilterBar` (= chip + AND/OR + counter + ×、 Lightbox open 時 fade)
  - chip click で非該当カードに CRT shutdown (= 緑 flash + scanline + flicker + 5 段 keyframes、 WAVE テーマ)、 該当カードが既存 GSAP-FLIP で compact 位置に reflow
  - × で解除 (= 全カード復活、 reverse アニメは未実装、 Phase 2 polish 候補)
- 重要な技術判断:
  - 計画書 Task 20 の新規 `runFlipReflow` API はスキップ → CardsLayer の既存 GSAP-FLIP を流用 (= matchedBookmarkIds で itemsForMasonry を絞るだけで自動 reflow 発火、 重複実装回避)
  - inner wrapper div 導入 (= outer = GSAP 位置 transform、 inner = CSS shutdown transform で responsibility 分離、 CSS transform が GSAP matrix を上書きしてカードが (0,0) に飛ぶ問題を解決)
- 検証中に踏んだ trap (= 次回避):
  - `displayedPositions` useMemo が `prevPositionsRef.current` を参照、 ref 宣言が後にあって TDZ ReferenceError → ref 宣言を useMemo より上に移動して fix (commit `c8e84cb`)

## session 72 でやること

1. **user に Phase 1 実機検証してもらう** (= 開始時にまず案内)
   - `booklage.pages.dev` をハードリロード
   - カードを hover → 左上に + TAG → click → popover で「Test」 タグ作成
   - 別カードにも同じ「Test」 を付与
   - canvas 左上の `Test` chip を click → 非該当カードに CRT shutdown + reflow を確認
   - × で解除 → 全カード復活 (= 瞬間表示で違和感あるかもしれない、 reverse アニメ Phase 2 候補)
   - chrome の TAG button → SimpleTagList modal の表示確認

2. **検証 OK なら user に次の優先順位を聞く** (= AskUserQuestion 不要、 自然な対話で):
   - (a) **Phase 2 = Triage 本実装** (= タグ rename / reorder / delete / swipe-assign / 一括振り分け、 SimpleTagList 廃止)。 user 発案「Triage 別 route の背景に board うっすら見せる案」 (= IDEAS.md 記録) も検討
   - (b) **Phase 1 polish** = reverse-fade-in アニメ (= 解除時の瞬間表示問題)、 mood → tag 一括 rename (= 6 件、 cleanup 候補)、 SimpleTagList の見た目 polish
   - (c) **別 backlog** = multi-playback Tier 2 / 音波テーマ sprint / その他

3. **検証で問題発見した場合**は個別対応 (= 想定: shutdown 演出の見え方違和感、 reflow タイミング ずれ、 popover 位置調整 等)

## 重要な事前準備 (= session 72 着手時にまず読む)

1. [TODO.md](./TODO.md) の「直近の状態 (= session 71)」 セクション (= 全 ship 内容 + 技術判断記録)
2. [docs/superpowers/specs/2026-05-25-tagging-design.md](./superpowers/specs/2026-05-25-tagging-design.md) (= Phase 2/3 設計の仕様詳細、 Triage UI スコープ)
3. [docs/private/IDEAS.md](./private/IDEAS.md) の Phase 2 メモ (= user 発案「Triage 別 route の背景に board うっすら見せる案」)

## Phase 1a で発見された cleanup 候補 6 件 (= Phase 2/3 並列 OK、 ship 影響なし)

1. BoardFilter `mood:` literal → `tag:` rename
2. data-testid `mood-chip-` → `tag-chip-` 更新 (= e2e test 依存箇所)
3. CSS Modules class 名 `.moodChip` / `.moodDot` → `.tagChip` / `.tagDot` (= 視覚不変保証で温存中)
4. `NewMoodInput.tsx` ファイル名 + i18n key
5. `indexeddb.ts` v9 `/** v9: mood id array */` JSDoc → `tag id array`
6. v16 旧 moods store 削除 migration (= Phase 1+2+3 全部本番安定後、 rollback safety 不要になったら)

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (memory `feedback_collaboration_style`)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 無視 OK、 単体 PASS)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **月末 (2026-05-31) まで残り 6 日**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)
- session 71 までで本セッション内 deploy は 2 (= 月次枠余裕、 1 日 16 deploy 上限内)
