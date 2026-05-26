# 次セッションのゴール (= セッション 81) — /triage polish 続き + ドメイン取得確認

## 今のゴール (1 行)

**session 80 で /triage の凸レンズ屈折 / 連続スライド / カード overflow 修正 / スポットライト効果 / Yes/No クリッカブル / Z 取り消し修正を全て ship 済 (booklage.pages.dev/triage)。 次は user の実機評価でまだ気になる polish を 1 つずつ。 開始日が 2026-05-28 以降なら allmarks.app 取得確認も**。

## 開始時の動き (= Claude の最初の発言)

1. **🔴 allmarks.app ドメイン取得確認** (= 2026-05-28 朝以降 user 取得予定、 開始日次第)
2. user に「**session 80 で ship した polish 9 項目の実機評価、 まだ気になる箇所**を教えてください」 と聞く (= 平文、 AskUserQuestion 使わない)
3. brushup を 1 項目ずつ「現状確認 → 案提示 → 承認 → 実装 → 検証」 で進める

## session 80 到達点 (= booklage.pages.dev/triage で動作中)

### ガラス周りの polish 9 つ

1. **凸レンズ屈折**: `scripts/generate-lens-edge-displacement.mjs` で barrel distortion PNG 生成、 中央うっすら拡大 + 縁で強い連続屈折
2. **連続スライド**: 2 枚並走 slider、 旧 + 新 card 同時 render、 純粋 translateX で「1 枚の絵が横スクロール」 感、 暗黒間隙ゼロ
3. **カード overflow 修正**: `canvasCardHost` を `grid-template-rows: 1fr` で親 height clamp、 長文 description カードもガラス内に収まる
4. **mount-flash 修正**: animation-fill-mode `forwards` → `both` で 1 frame flash 排除
5. **白オーバーレイ削除**: ガラスの 10% 白 transparent に変更
6. **スポットライト効果**: 9999px spread shadow + 4 段 bloom halo (= 寒色寄り白)、 box-shadow を `::before` から `.canvas` 本体に移動 (= 子要素の外向き shadow が親 `overflow: hidden` で clip される問題を発見 + 解決)
7. **操作系 polish**: ヒント「1-9 タグ ON/OFF · Z 取り消し」、 文字色 0.92 白、 Yes/No を `<button>` 化 (= マウスクリック可、 hover でリッチに反応)
8. **HeuristicTagger 統合 → 即撤去**: user の汎用英単語タグ (= YOUTUBE / DESIGN 等) で keyword 部分一致 (0.5 confidence) が誤爆爆発、 撤去判断。 機構 (`lib/tagger/heuristic.ts`) は残置
9. **Z 取り消し 3 バグ修正**: race (= 360ms wait 中の persistTags 競合) + state 喪失 (= No で lastAction クリア) + index 復元 (= queue.findIndex で正確位置)、 Playwright で end-to-end 検証済

### 検証

- 829 PASS 維持、 tsc 0 errors、 build 25 routes static prerender 全 success
- user backup JSON (= 567 ブクマ + 5 tags) を Playwright で IDB 注入してスキャン、 overflow / Z undo を end-to-end 検証

## 残課題 (= 次セッション議論)

### user 観察 (= polish 候補)

- **ハロが強すぎ件** (= session 80 で「一旦 OK」 保留): 4 段 bloom の透明度 (= 0.45 / 0.32 / 0.20 / 0.10) を 0.5x に絞る or 段数減らす
- **チュートリアル** (= 初回 onboarding): 「タグを選んでから振り分けるフロー」 の認知問題、 user 自身が言及。 初回 only mini-tutorial overlay or 恒久ヒント文字 or 数秒だけ「タグをクリック → 右に振る」 のアニメ点滅、 等の案
- **No 含めて巻き戻す undo 拡張**: 現状は Yes-with-tags のみ undo 可、 user が言及したら実装

### Phase D 残り (= session 78 / 79 持ち越し継続)

- **D1 中断再開** (= localStorage で完了 id 永続 + 続きから prompt) — model 変わっても有効
- **D4 他 14 言語の mood → tag rename** — messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json の "newMood" / "moodNamePlaceholder" 等
- **D5 NewMoodInput → NewTagInput rename** — internal name 改修

### convex bezel (= session 78 から持ち越し)

- α 案 = pre-built PNG triplet + build script
- model 確定 + ガラス polish 着地したので polish に注力するなら次以降

## 守ること (= user memory + session 80 反省 参照)

- **「対話で進める、 一括で 3 つも 4 つも変えない」** — feedback_one_thing_at_a_time
- **「武装」 等の脳内ショートハンドを UI 文言に漏らさない** — feedback_ui_vocabulary
- **verify before claiming it works** — feedback_verify_before_claiming、 deploy 後 Playwright で確認してから user に投げる (= session 80 で Z undo は実際に Playwright で end-to-end 検証してから user 報告)
- **大きい構造変更前は方針確認** — feedback_consult_before_big_changes
- **AskUserQuestion で polish / design を聞かない** — feedback_no_question_box_for_design
- **おすすめ系は精度問題で再挑戦時は慎重に** — substring 部分一致は誤爆爆発、 ハッシュタグ + ドメイン (= confidence ≥0.8) のみで attempt するなら可
- **session 80 で見つけた CSS の罠は memory 化推奨** — overflow:hidden が子の外向き shadow を clip / grid auto-rows が親 height 無視 / animation-fill-mode forwards だけだと mount-flash

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」
- deploy は **Claude 判断で OK**、 ただし 1 日 16 deploy 上限を意識
- 大きい構造変更 (= 100 行+ refactor) は事前相談、 brainstorm からやり直す

## 確認事項・運用

- 確認は常に `booklage.pages.dev/triage` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (= 特に design 系)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- user backup JSON は `C:\Users\masay\Downloads\allmarks-backup-2026-05-25.json` (= 835 KB)、 Playwright IDB 注入手順は `C:\Users\masay\AppData\Local\Temp\playwright-test-undo.js` 参照
- **🔴 ドメイン (2026-05-28 朝以降)**: `allmarks.app` 取得確認 ([project_allmarks_domain_reminder](memory))
