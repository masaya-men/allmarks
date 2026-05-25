# 次セッションのゴール (= セッション 72) — タグ機能 Phase 1 ブラッシュアップ sprint

## 今のゴール (1 行)

**session 71 で ship 完了したタグ機能 Phase 1 の「動くけど見た目/配置/トンマナがイマイチ」 部分を user feedback 起点で一気に磨き込む sprint**。 実装は終わってるので、 視覚調整・配置・トンマナ統一・小さな UX 不整合の polish に専念。

## 開始時の動き (= Claude の最初の発言)

1. user に**「Phase 1 を触ってみて、 どこが・どうおかしかったか教えてください」** と聞く
   - 例示候補: + TAG ボタンの位置 / TagFilterBar の配置 / SimpleTagList modal の見た目 / shutdown 演出の見え方 / 色味 / フォント / 余白 / アニメ秒数 / 解除時の瞬間表示
2. user から複数項目出てきたら一覧化 → 優先順位を user と決める
3. 1 項目ずつ調整 → 都度 build + deploy or 最後にまとめ deploy (= user 判断)

## session 71 の到達点 (= ship 済、 触れる状態)

- `booklage.pages.dev` で動く: カード hover で `+ TAG` button (= top-left) → popover (= 既存 toggle + サイト候補 + 新規入力) → タグ作成 → canvas top-left の TagFilterBar に chip 出現 → click で CRT shutdown + reflow → × で解除
- chrome 右上に `TAG` button (= TUNE の隣) → SimpleTagList modal (= Phase 1 placeholder)
- 詳細: [docs/TODO.md](./TODO.md) の「直近の状態 (= session 71)」

## ブラッシュアップで触る可能性が高い file (= 開始時に読む候補)

1. **+ TAG button**: [components/board/CardsLayer.tsx](../components/board/CardsLayer.tsx) L770-820 付近の inline style (= 位置・色・サイズ・opacity 遷移)
2. **TagFilterBar 配置**: [components/board/BoardRoot.module.css](../components/board/BoardRoot.module.css) の `.tagFilterHost` (= top:14 left:24、 z-index 110)
3. **TagFilterBar 見た目**: [components/board/TagFilterBar/TagFilterBar.module.css](../components/board/TagFilterBar/TagFilterBar.module.css) (= chip / mode toggle / counter / clear button)
4. **TagAddPopover 見た目**: [components/board/TagAddPopover/TagAddPopover.module.css](../components/board/TagAddPopover/TagAddPopover.module.css)
5. **TagButton chrome**: [components/board/TagButton/TagButton.module.css](../components/board/TagButton/TagButton.module.css)
6. **SimpleTagList modal**: [components/board/BoardRoot.tsx](../components/board/BoardRoot.tsx) 上部の `SimpleTagList` 関数 (= inline style、 必要なら CSS module に切り出し)
7. **CRT shutdown 演出**: [lib/animation/tag-shutdown/themes/wave.module.css](../lib/animation/tag-shutdown/themes/wave.module.css) (= duration / stretch / 緑 flash 色 / stagger / scanline / flicker、 全部 CSS 変数で調整可)

## トンマナ参考 (= 既存 AllMarks 視覚言語に揃える時の参照)

- **既存 chrome button** ([ChromeButton.module.css](../components/board/ChromeButton.module.css)): scramble + RGB chromatic aberration ghost (= 既存 TUNE/POP OUT/SHARE と同じ recipe)
- **既存 ScrollMeter** ([ScrollMeter.module.css](../components/board/ScrollMeter.module.css)): モノスペース font + 音波 motif + glitch
- **既存 pill 視覚言語**: ✓ 緑 / ⚠ アンバー / ! 赤 の 3 段意味体系 + 3 段 glow halo + RGB glitch (memory `project_pill_visual_language`)
- **AllMarks success green**: `#28F100` (= 緑 flash / chip 選択時 / + TAG hover 時に既に使用)
- **デフォルトテーマ**: 黒 + 白 minimal + 音波 motif (memory `project_theme_sound_wave`)
- **ロゴモチーフ**: 黒 A 形 + 緑チェック (memory `project_a_motif_logo`)

## 守ること (= user memory 参照)

- AI っぽいデザイン禁止 (= 青→紫グラデ、 shadcn デフォルト、 SaaS テンプレ感) — memory `feedback_design_quality`
- UI 英語は globally-clear (= 業界用語より中学英語動詞優先) — memory `feedback_globally_clear_english`
- クリックターゲットは 32×32 px 以上確保 — memory `feedback_large_pointer`
- アニメ・配置調整は CSS 変数経由で (= shutdown は 8 変数あり、 直接 keyframes 触らない方が後で戻せる)
- 「verify before claiming "it works"」 — playwright getComputedStyle で実測してから「動いてる」 報告 — memory `feedback_verify_before_claiming`
- 一貫性目的で隣接要素に勝手に波及させない、 user 確認 — memory `feedback_dont_overgeneralize`

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 変更案提示 → user 承認 → 実装 → 検証」 の 4 ステップ (= [.claude/rules/ui-design.md](../.claude/rules/ui-design.md) の方針)
- 小さい調整は黙って実装でも OK、 大きい構造変更 (= 100 行+ refactor、 新 component 追加) は事前相談 — memory `feedback_consult_before_big_changes`
- deploy は user 判断で都度 or まとめ。 1 日 16 deploy 上限内なら気軽に reload しやすい都度 deploy 推奨

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (memory `feedback_collaboration_style`)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 無視 OK、 単体 PASS)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **月末 (2026-05-31) まで残り 6 日**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)
- session 71 までで deploy は 2 回 (= 月次枠余裕)

## ブラッシュアップ完了後の次の選択肢 (= sprint 終わりに user と相談)

- (a) Phase 2 = Triage 本実装 (= SimpleTagList を Triage UI に進化、 IDEAS.md に user 発案メモあり)
- (b) Phase 1 cleanup (= mood → tag 一括 rename 6 件、 cosmetic sweep)
- (c) 別 backlog (= multi-playback Tier 2 / 音波テーマ sprint 等)
