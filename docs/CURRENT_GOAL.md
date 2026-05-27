# 次セッションのゴール (= セッション 83) — ドメイン取得確認 + 公開向け Phase D 着手

## 今のゴール (1 行)

**session 82 でタグ削除 UI 復活 + フィルターボタン editorial 化 + favicon polish + Z 単純 undo + convex bezel 全 ship 済。 次は 🔴 allmarks.app ドメイン取得確認 (= 2026-05-28 朝以降 user 取得予定) と、 公開向け Phase D 残課題着手。**

## 開始時の動き (= Claude の最初の発言)

1. **🔴 allmarks.app ドメイン取得確認** — 取得済なら `docs/private/2026-05-11-allmarks-branding-spec.md` に従い リブランド実装計画、 未取得なら取得促し ([project_allmarks_domain_reminder](memory))
2. user に「公開向け Phase D 残課題のどれから着手?」 を平文で聞く

## session 82 到達点 (= booklage.pages.dev で動作中)

### 完了 11 項目 (5 deploy)

1. /triage chip 右クリック削除メニュー (= 第 1 段)
2. board FilterPill dropdown + カード TagIndicatorStrip 右クリック削除 (= 第 2 段)
3. フィルターボタン全面 editorial 改修 (= TUNE と同言語、 right-anchor + viewport clamp + 700ms grace close)
4. TRASH 行ミュート赤 (= DEAD LINKS と区別)
5. OR mode 統一 (= toggleTagInFilter default OR、 dropdown 内 click 閉じない複数選択)
6. 背景大文字に絞り込みタグ全展開 (= ` · ` join + 自動 2 段 wrap、 floor 96px)
7. TagDeleteConfirmDialog に「カードは残る」 明示行追加
8. favicon + 拡張 floating button の透明箱削除 (= SVG filter 全削除)
9. favicon に白枠線追加 (= 黒 A + 白枠 + 緑チェック 3 層)
10. Z = 単純に前のカードに戻る (= 何の操作後でも、 タグ変更あれば一緒に revert)
11. convex bezel ガラス厚み試作 (= ::after の照り + 縁全周 highlight、 user OK 試作値)

### 検証

- vitest **852 PASS** (= +23 net)、 tsc 0 errors、 build 25 routes 全 success、 deploy 5 回

## 公開向け残タスク (= session 82 終了時整理)

### release blocker (= 公開前 必須)

1. 🔴 allmarks.app ドメイン取得確認 (= 明日 2026-05-28 朝以降)
2. Phase D1 中断再開 (= localStorage で `completedBookmarkIds` 永続 + 続きから prompt)
3. Phase D4 他 14 言語 mood → tag rename
4. Phase D5 NewMoodInput → NewTagInput 内部 rename
5. onboarding チュートリアル
6. 拡張機能 Chrome Web Store 公開準備

### 公開後でも OK (= 上澄み polish)

- convex bezel 数値調整
- /triage 外周 4 段 bloom halo の 0.5x 絞り
- TagDeleteConfirmDialog 2 秒長押し feel
- 「TAG THIS.」 サイズ + 緑パルス強度

(全部「一旦 OK」 で棚上げ、 user の気が向いたら brushup)

### 別軸 (= 機能追加、 公開後の発展)

- Song Bottle 風ブクマ交換 (= IDEAS.md)
- multi-playback (= 差別化の核、 IDEAS.md)
- per-tag theme

## 守ること (= user memory + session 82 学習 参照)

- **対話で進める、 一括で複数項目を勝手に変えない** ([feedback_one_thing_at_a_time](memory))
- **大きい構造変更前は方針確認** ([feedback_consult_before_big_changes](memory)) = session 82 で 6 項目 polish も全 user 承認後に着手、 守れた
- **ui-design.md 「現状確認 → 案提示 → 承認 → 実装」 厳守**
- **AskUserQuestion で polish / design を聞かない** ([feedback_no_question_box_for_design](memory)) = 平文で 1-2 案提示が筋
- **frontend-design / motion-design skill は creative polish で素直に呼ぶ**
- **横文字カタカナ控えめ、 平易な日本語で** ([feedback_jargon_in_japanese](memory))
- **verify before claiming it works** ([feedback_verify_before_claiming](memory))

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」
- deploy は **Claude 判断で OK**、 1 日 16 deploy 上限内
- 大きい構造変更 (= 100 行+ refactor) は事前相談

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
