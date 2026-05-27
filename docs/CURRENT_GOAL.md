# 次セッションのゴール (= セッション 82) — ドメイン取得確認 + 残 polish の brushup

## 今のゴール (1 行)

**session 81 で /triage の装飾削減 + TRASH 機能完全復活 + editorial 大見出し + 質素ページ削除 + auto-mode + review pre-arm を全 ship 済 (booklage.pages.dev)。 次は 🔴 allmarks.app ドメイン取得確認 (= 2026-05-28 朝以降) と、 user の実機評価で気になる polish を 1 つずつ**。

## 開始時の動き (= Claude の最初の発言)

1. **🔴 allmarks.app ドメイン取得確認** (= 2026-05-28 朝以降 user 取得予定) — 取得済なら リブランド実装に進む or 別 session で計画、 未取得なら取得を促す
2. user に「**session 81 で ship した polish 9 項目の実機評価、 まだ気になる箇所**」 を平文で聞く (= AskUserQuestion 使わない)
3. brushup を 1 項目ずつ「現状確認 → 案提示 → 承認 → 実装 → 検証」 で進める

## session 81 到達点 (= booklage.pages.dev で動作中)

### 完了 9 項目

1. **chip strip 装飾削減**: ピル枠 + 色付き丸 + ✓ 全削除、 文字完全白、 armed = 緑文字 + glow のみ
2. **YES / NO 白黒化**: 赤緑廃止、 白 0.92 + 矢印で意味区別
3. **board dropdown polish**: INBOX 行削除、 ARCHIVE → TRASH rename、 色付き丸削除 (= DEAD 赤丸は警告意味で残置)
4. **TRASH 機能完全復活**: 隠れていた bug 治癒 (= use-board-data load 段階で削除済みを除外してた)、 `deletedItems` 独立 state、 個別 ↺ Restore + EMPTY TRASH 一括削除
5. **カスタム TrashConfirmDialog**: editorial 黒 backdrop blur + monospace + 赤ボタン 2 秒長押し
6. **「+ TAG」 新規タグトリガー**: board と語彙統一、 click でアニメ展開 + underline input field
7. **「TAG THIS.」 巨大 editorial 見出し**: clamp 34-56px monospace、 緑 period パルス、 chrome 2 行構成、 stagger 入場
8. **質素ページ削除 + auto-mode**: EntryPicker 全削除、 未分類あれば untagged / 0 件で all 自動判定、 board 動線も簡素化
9. **「全部」 / 「タグ X」 mode の体験設計**: カード切替で armed = current.tags 同期、 YES で armed そのまま persist (= 既存タグ削除も自然動作)、 untagged mode は session 79 武装維持仕様

+ おまけ: **ガラス外 click で離脱** (= 真っ黒余白 click で板に戻る、 ESC 同等)

### 検証

- vitest **829 PASS** 維持、 tsc 0 errors、 build 25 routes 全 success、 deploy 7 回
- e2e testid 更新済 (= triage-flow.spec.ts の new-mood-* → new-tag-*)

## 残課題 (= 次セッション議論候補)

### user 評価待ち (= session 81 ship 9 項目)

session 82 開始時に user に「ship した polish の体感」 を聞く。 反応次第で brushup を順次:

- TRASH の挙動 (= 削除 → 表示 → 戻す → 一括削除) の体感
- TrashConfirmDialog の 2 秒長押し feel (= 短すぎ / ちょうどいい / 長すぎ)
- 「TAG THIS.」 のサイズ + 緑パルス強度
- 「全部」 mode で armed pre-arm の使い勝手 (= タグ見直しが直感的か)
- ガラス外 click で離脱の便利さ

### session 80 / 81 持ち越し brushup

- **ハロ強すぎ件** (= /triage 外周 4 段 bloom halo 0.5x 絞り、 session 80 で「一旦 OK」 保留中)
- **タグ削除専用 UI** (= session 81 で削除経路ごと消えた、 user 必要と感じたら復活)
- **チュートリアル** (= 初回 onboarding、 session 81 の `TAG THIS.` 大見出しで部分達成、 残りは初回限定の動的ヒント等)
- **No 含めて巻き戻す undo 拡張** (= 現状 Yes-with-tags のみ、 No も undo 可能に)

### Phase D 残り (= 機能追加、 polish より重い)

- **D1 中断再開** = localStorage で completedBookmarkIds 永続 + 続きから prompt
- **D4 他 14 言語の mood → tag rename** = messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json の "newMood" / "moodNamePlaceholder" 等 (= session 81 で TagPicker 内 i18n key 参照を hardcoded に置換済、 string 自体は残置で cleanup タイミング)
- **D5 NewMoodInput → NewTagInput rename** = file + 内部識別子

### convex bezel (= session 78 持ち越し)

- α 案 = pre-built PNG triplet + build script
- model 確定 + ガラス polish 着地したので polish 注力する余裕あれば次以降

## 守ること (= user memory + session 81 反省 参照)

- **「対話で進める、 一括で 3 つも 4 つも変えない」** — feedback_one_thing_at_a_time
- **「武装」 等の脳内ショートハンドを UI 文言に漏らさない** — feedback_ui_vocabulary
- **verify before claiming it works** — feedback_verify_before_claiming
- **大きい構造変更前は方針確認** — feedback_consult_before_big_changes (= session 81 で TRASH 機能復活 + EntryPicker 削除 + review pre-arm 全部 user 承認後実装、 これ守った)
- **AskUserQuestion で polish / design を聞かない** — feedback_no_question_box_for_design (= 平文で 1-2 案提示が筋)
- **frontend-design / motion-design skill は creative polish で素直に呼ぶ** — session 81 で `TAG THIS.` editorial design に invoke、 効いた
- **横文字カタカナ多用しない** — feedback_jargon_in_japanese (= user が技術 jargon で理解できなくなる、 平易な日本語へ)
- **修正は最小 diff、 隣接要素を勝手に拡大しない** — feedback_dont_overgeneralize

## 進め方 (= 候補、 user 指示優先)

- 1 項目ずつ「現状確認 → 案提示 → user 承認 → 実装 → 検証」
- deploy は **Claude 判断で OK**、 1 日 16 deploy 上限内
- 大きい構造変更 (= 100 行+ refactor) は事前相談

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない (= 特に design 系)
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- **🔴 ドメイン (2026-05-28 朝以降)**: `allmarks.app` 取得確認 ([project_allmarks_domain_reminder](memory))、 取得済なら docs/private/2026-05-11-allmarks-branding-spec.md に従い リブランド実装計画
