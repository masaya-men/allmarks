# 次セッションのゴール (= セッション 73) — タグ機能 Phase D 視覚 polish + 中断再開 sprint

## 今のゴール (1 行)

**session 72 で機能 ship 完了したタグ機能 (= MANAGE TAGS = Triage swipe) の「動くけど更に良くしたい」 部分を user feedback 起点で polish + 中断再開機能の追加**。 機能は揃っているので視覚 polish / アニメ進化 / 14 言語 i18n / 細部 UX を集中投下。

## 開始時の動き (= Claude の最初の発言)

1. user に**「Triage 触ってみてどこが違和感あったか / どこを polish したいか教えてください」** と聞く
   - 例示候補: 「しゅっ」 アニメの気持ち良さ / タグ削除の見た目 (= 今 window.confirm) / EntryPicker の配置 / TagPicker 2 段 chip の見え方 / Shift 切替の体感 / co-tags strip の余白 / 背景うっすら board の透け度合い / 「mood」 残り (= NewMoodInput) の違和感
2. user 列挙待ち → 一覧化 → 優先順位 → 1 つずつ調整 → 都度 ship
3. 並行で **Phase D 必須項目** (= user feedback とは別軸) も消化:
   - **D1 中断再開** (= localStorage に completedBookmarkIds 保存、 続きから prompt) — IDEAS.md 「保留」 ボタン仕様準拠
   - **D2 「しゅっ」 進化** (= 紙が折りたたまれる / 光のトレイル / 音波減衰 等、 IDEAS.md 3+ 案から prototype 試作で選択)
   - **D3 タグ削除の楽しい fx** (= IDEAS.md 「タグごと爆発」 / 「音波で消える」、 現状 window.confirm を inline 確認 + 削除アニメに進化)
   - **D4 他 14 言語の mood → tag rename** (= 既存 messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json の newMood / moodNamePlaceholder の文字列内 mood/ムード 等を tag/各国語訳に更新)
   - **D5 NewMoodInput → NewTagInput rename** (= file rename + import 更新、 内部識別子も統一)

## session 72 の到達点 (= ship 済、 触れる状態)

- `booklage.pages.dev` で動く: chrome 右上 **MANAGE TAGS** → /triage 別 page → 4 方向 swipe 振り分け
- 振り分け対象: AllMarks 中 = 「未分類 / 全部」 二択画面、 タグ絞り込み中 = 集合継承
- 操作: 矢印キー / drag swipe / chip click / 数字キー 1-9 (= toggle) / S skip / Z undo / Esc 戻り / Shift で副タグ 5-8 切替
- 複数同時付与: 主タグ swipe + co-tags toggle 全部一気に付与
- おすすめタグ: HeuristicTagger (= ドメイン辞書 18 件 + title keyword + **hashtag literal #xxx 抽出 0.95 confidence**) 緑強調
- タグ削除: EntryPicker から × Delete + window.confirm + cascade (= tag store + 全 bookmark の tags array 同 transaction で scrub)
- 背景: BoardBackdrop = サムネ 60 枚 grid opacity 0.14 + blur 3px (= 自分のボードが裏に薄く透ける)
- アニメ: TriageCard exit 3 段 (= 反対方向 10px 反り + brightness 1.18 → 飛び去り scale 0.84 + brightness 0.72) 220ms cubic-bezier

詳細: [docs/TODO.md](./TODO.md) の「直近の状態 (= session 72)」、 narrative: [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md)

## ブラッシュアップで触る可能性が高い file (= 開始時に読む候補)

1. **「しゅっ」 アニメ**: [components/triage/TriageCard.module.css](../components/triage/TriageCard.module.css) (= exit 4 方向 keyframes、 IDEAS.md 5 案からどう進化させるか)
2. **TagPicker レイアウト**: [components/triage/TagPicker.tsx](../components/triage/TagPicker.tsx) + [.module.css](../components/triage/TagPicker.module.css) (= 4 方向 2 段 chip、 co-tags strip)
3. **背景透け度**: [components/triage/BoardBackdrop.module.css](../components/triage/BoardBackdrop.module.css) (= opacity / blur 値、 grid sizing)
4. **EntryPicker トンマナ**: [components/triage/TriagePage.tsx](../components/triage/TriagePage.tsx) (= EntryPicker function) + [.module.css](../components/triage/TriagePage.module.css) (= .entry* / .tagManagement*)
5. **中断再開実装場所**: [components/triage/TriagePage.tsx](../components/triage/TriagePage.tsx) (= localStorage 操作 + 続きから prompt)
6. **15 言語 i18n**: [messages/](../messages/) 各 .json の `triage.newMood` / `triage.moodNamePlaceholder` value

## トンマナ参考 (= 既存 AllMarks 視覚言語に揃える時の参照)

- **既存 chrome button** ([ChromeButton.module.css](../components/board/ChromeButton.module.css)): scramble + RGB chromatic aberration ghost
- **既存 pill 視覚言語**: ✓ 緑 / ⚠ アンバー / ! 赤 の 3 段意味体系 + 3 段 glow halo + RGB glitch
- **AllMarks success green**: `#28F100`
- **デフォルトテーマ**: 黒 + 白 minimal + 音波 motif

## 守ること (= user memory 参照)

- AI っぽいデザイン禁止 — memory `feedback_design_quality`
- UI 英語は globally-clear、 中学英語動詞優先 — memory `feedback_globally_clear_english`
- クリックターゲット 32×32 px 以上 — memory `feedback_large_pointer`
- アニメ・配置調整は CSS 変数経由で
- 「verify before claiming "it works"」 — memory `feedback_verify_before_claiming`
- 一貫性目的の隣接波及は user 確認 — memory `feedback_dont_overgeneralize`

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 変更案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- 小さい調整は黙って実装でも OK、 大きい構造変更 (= 100 行+ refactor) は事前相談
- deploy は user 判断で都度 or まとめ。 session 72 で 4 deploy 済、 月次枠余裕

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= /triage は MANAGE TAGS 経由 or URL 直打ち)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 無視 OK、 単体 PASS、 session 72 では全 804 PASS 連続)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **月末 (2026-05-31) まで残り 6 日**: `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)

## Phase D 完了後の次の選択肢 (= sprint 終わりに user と相談)

- (a) 他の backlog (= multi-playback Tier 2 / 音波テーマ sprint / LP リデザイン 等)
- (b) Triage を更に深堀り (= Triage 内での「カードプレビュー拡大」 + 「直前へ戻る」 + 「タグ rename / 並べ替え / 色変更」)
- (c) allmarks.app ドメイン取得 → 全コード rebrand sprint
