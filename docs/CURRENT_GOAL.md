# 次セッションのゴール (= セッション 80) — Yes/No swipe 動作確認 + サイズ・レイアウト brushup + ドメイン取得確認

## 今のゴール (1 行)

**session 79 で /triage を 4 方向 swipe → 武装タグ multi 選択 + Yes/No swipe + ワールドスライドに全面 redesign し ship 済 (booklage.pages.dev/triage)。 次は user の実機評価 → サイズ / レイアウト brushup → 必要に応じて snap → continuous slide 改修 + 2026-05-28 朝以降 allmarks.app ドメイン取得確認**。

## 開始時の動き (= Claude の最初の発言)

1. **🔴 allmarks.app ドメイン取得確認** (= 2026-05-28 朝以降 user 取得予定、 今日が 28 以降ならまず確認)
2. user に「**Yes/No swipe model の実機評価**、 何が気持ち良くて何が気持ち悪いか教えてください」 と聞く (= user memory)
3. brushup 候補を text + (必要なら) Visual Companion で提案 → 承認 → 実装 → 検証

## session 79 到達点 (= booklage.pages.dev/triage で動作中)

### model 変更 (= 4 方向廃止)

- 4 方向 swipe + co-tag → **武装タグ multi 選択 (緑 + ✓) + Yes/No swipe**
- カードはサイズ維持で translateX 360ms、 ガラスは固定窓で overflow:hidden clip
- 背景 (AmbientBackdrop) も同方向に同期スライド
- TopTagStrip 上中央固定、 1-9 + click で武装トグル、 + NEW で新規作成 (即武装 on)
- → / D = Yes (= 武装タグ全部一括付与 + 次へ)
- ← / A / Space = No、 Z = undo、 Esc = exit

### 削除した遺物

- DirChip component 完全削除
- 4 方向 strip / chip wrapper の CSS 全部削除
- TriageCard / AmbientBackdrop の上下左右 4 方向 exit アニメ削除 (= translateX Yes/No 2 種のみに)
- Shift で副タグ 5-8 切替の機能廃止 (= 全タグが TopTagStrip で同列、 階層なし)

### 副産物: Tweet 動画 pipeline memory 化

- 新 memory `reference_tweet_video_frames_pipeline`: AllMarks の 6 ファイル + 4 落とし穴
- user の並行プロジェクト LoPo (= ハウジング) に移植する時用のコピペ message を提供済

## 残課題 (= 次セッション議論)

### 確実にやる
- **🔴 2026-05-28 朝以降 allmarks.app ドメイン取得確認** ([project_allmarks_domain_reminder](memory))
- **user 実機評価のヒアリング** = Yes/No swipe の体感、 武装タグ chip の操作感、 ワールドスライドの気持ちよさ、 全部

### user 観察 (= 解消候補)
- **ガラス中央の歪みが純黒タブでも見える**: displacement map (scale=80) が AmbientBackdrop の微妙な色グラデを歪めて blob shape 可視化。 user 「今は残し」 → 後で評価
- **snap でカード退場 → 入場が繋がる**: 旧 card 退場アニメ中に新 card 並走しない (= 「continuous slide」 未実装)、 中規模追加工事 (= 2 枚並走 slider 実装)
- **ガラスのサイズ / レイアウト brushup**: user 「もっとブラッシュアップしたい」 と発言、 具体的にどこをどう変えるか議論

### Phase D 残り (= session 78 持ち越し + 79 の model 変更で意味変容)
- **D1 中断再開** (= localStorage で完了 id 永続) — model 変わっても有効
- **D4 他 14 言語 mood→tag rename** — まだ有効
- **D5 NewMoodInput → NewTagInput rename** — internal name 改修
- **D2 しゅっアニメ進化** / **D3 タグ削除 fx** — model 変更で意味が変わった、 再設計必要

### convex bezel (= session 78 から持ち越し)
- α 案 = pre-built PNG triplet + build script
- model 確定したのでガラス polish に注力するなら次以降

## 守ること (= user memory + session 79 反省 参照)

- **「対話で進める、 一括で 3 つも 4 つも変えない」** — session 77-79 通じて user 一貫主張
- **「武装」 等の脳内ショートハンドを UI 文言に漏らさない** — memory `feedback_ui_vocabulary` 強化済、 視覚状態だけで semantics
- **「verify before claiming it works」** — memory `feedback_verify_before_claiming`、 deploy 後自分で playwright で確認してから user に投げる
- **大きい構造変更前は方針確認** — memory `feedback_consult_before_big_changes`
- **AskUserQuestion で polish / design を聞かない** — memory `feedback_no_question_box_for_design`
- **brainstorming skill 使ったら最後まで follow** — Visual Companion で mockup 比較 → 設計の根本 reframe ができる、 session 79 で実証

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」 の 4 ステップ
- deploy は **Claude 判断で OK**、 ただし 1 日 16 deploy 上限を意識
- 大きい構造変更 (= 100 行+ refactor) は事前相談、 brainstorm からやり直す

## 確認事項・運用

- 確認は常に `booklage.pages.dev/triage` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (= 特に design 系)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- Visual Companion は `.superpowers/brainstorm/` に persist 済、 30 分無操作で auto-exit
- **🔴 ドメイン (2026-05-28 朝以降)**: `allmarks.app` 取得確認 ([project_allmarks_domain_reminder](memory))
