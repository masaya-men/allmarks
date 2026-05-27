# 次セッションのゴール (= セッション 84) — シェア機能作り直し Phase 3-7 (= UI + 本番 ship)

## 今のゴール (1 行)

**session 83 でシェア機能の完全作り直しを brainstorming + 設計 + 実装計画 + Phase 1-2 (= データ層 + Cloudflare 基盤) まで完了。 次は Phase 3-7 (= 送信側 modal + 受信側 landing + triage + 旧実装削除 + 本番 ship)、 subagent-driven 推奨。**

## 開始時の動き (= Claude の最初の発言)

1. **🔴 wrangler.toml の KV namespace ID 確認** — user が Cloudflare ダッシュボードで `SHARE_KV` + `SHARE_KV_preview` を作成して ID を貼ったか確認。 未対応なら手順案内 (= 後述 §user 操作待ち)
2. **🔴 allmarks.app ドメイン取得確認** — 取得済なら `docs/private/2026-05-11-allmarks-branding-spec.md` 計画開始は phase 1.5 で良い (= phase 1 シェア出してから)、 未取得なら取得促し ([project_allmarks_domain_reminder](memory))
3. 実装計画書 [docs/superpowers/plans/2026-05-27-share-rebuild.md](./superpowers/plans/2026-05-27-share-rebuild.md) を読んで Phase 3 から再開

## session 83 到達点 (= 設計完了 + Phase 1-2 ship)

### 完了 (= 全 11 commits、 既存挙動への副作用ゼロ)

1. **設計仕様書** [docs/superpowers/specs/2026-05-27-share-rebuild-design.md](./superpowers/specs/2026-05-27-share-rebuild-design.md) — 612 行、 17 確定事項、 Goals/Non-goals/schema/UI/cost/routing/files/tests/phasing 網羅
2. **実装計画書** [docs/superpowers/plans/2026-05-27-share-rebuild.md](./superpowers/plans/2026-05-27-share-rebuild.md) — 3942 行、 32 tasks × 7 Phase、 TDD + 段階 commit
3. **Phase 1 (Tasks 1-7)**: lib/share/ に v2 系 (types-v2 / validate-v2 / kv-id / encode-v2 / decode-v2 / snapshot / board-to-share / api-client) + 各テスト、 vitest +29 unit
4. **Phase 2 (Tasks 8-11)**: wrangler.toml + functions/api/share/{create, [id], [id]/og}.ts

### 検証

- vitest 852 → **881 PASS** (= +29 新規)、 tsc 0 errors、 既存テスト regression なし
- ファイル新規 17 個、 既存ファイル変更 0 個

## 🔴 user 操作待ち (= Phase 3 以降の前提条件)

session 83 close-out の commit 後に user 側で実施:

1. https://dash.cloudflare.com/ → Workers & Pages → KV
2. 「Create namespace」 で **`SHARE_KV`** 作成 (= 本番用)
3. 「Create namespace」 で **`SHARE_KV_preview`** 作成 (= preview deploy 用)
4. 2 つの ID (= 32 文字 hex) を [wrangler.toml](../wrangler.toml) に貼り付け:
   - `REPLACE_WITH_KV_NAMESPACE_ID` → `SHARE_KV` の ID
   - `REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID` → `SHARE_KV_preview` の ID
5. commit して push

session 84 開始時にこれが完了していれば Phase 3 すぐ着手可能。

## 残作業 (= Phase 3-7、 session 84 で実施)

| Phase | Tasks | 内容 |
|---|---|---|
| 3 | 12-15 | 送信側 SenderShareModal + BoardRoot 配線 (= import logic + UI skeleton + snapshot+API integration + SHARE chrome button 切替) |
| 4 | 16-22 | 受信側 ReceiverLanding (= route + state machine + masonry + bulk import + Lightbox + 背景文字) |
| 5 | 23-26 | 受信側 ReceiverTriage (= queue + sender tag suggestions + completion toast + receiver tag chip) |
| 6 | 27-30 | 旧実装の完全削除 (= ShareComposer / lib/share v1 / /share route / BoardRoot 残骸) |
| 7 | 31-32 | preview deploy + 本番 ship |

## 進め方 (= subagent-driven 推奨)

session 84 開始時に `superpowers:subagent-driven-development` skill 起動。 各 task で fresh subagent dispatch + 結果 review checkpoint で進める。 32 タスクを 1 セッションで完遂は厳しい可能性、 Phase 3-4 を完成 → preview deploy で動作確認 → Phase 5-7 を別セッション、 という 2 区切りも視野に。

## 公開向け残タスク (= シェア作り直し完了後の release blocker)

session 83 で D1 中断再開は撤回済 (= 未分類は manage button で後付け可能のため不要)。 残:

1. ~~🔴 シェア機能完全作り直し~~ ← session 83 で Phase 1-2 完了、 session 84 で残実装
2. 🔴 allmarks.app ドメイン取得確認 (= 2026-05-28 朝以降)
3. Phase D4 他 14 言語 mood → tag rename (= `messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json` の `newMood` / `moodNamePlaceholder`)
4. Phase D5 NewMoodInput → NewTagInput 内部 rename
5. onboarding チュートリアル (= 初回ユーザー向け)
6. 拡張機能 Chrome Web Store 公開準備

公開後でも OK (= 上澄み polish):
- convex bezel 数値調整 / /triage 外周 4 段 bloom halo 0.5x 絞り / TagDeleteConfirmDialog 2 秒長押し feel / 「TAG THIS.」 サイズ + 緑パルス強度

## 守ること (= user memory + session 83 学習 参照)

- **対話で進める、 一括で複数項目を勝手に変えない** ([feedback_one_thing_at_a_time](memory))
- **大きい構造変更前は方針確認** ([feedback_consult_before_big_changes](memory))
- **ui-design.md 「現状確認 → 案提示 → 承認 → 実装」 厳守**
- **AskUserQuestion で polish / design を聞かない** ([feedback_no_question_box_for_design](memory))
- **frontend-design / motion-design skill は creative polish で素直に呼ぶ**
- **横文字カタカナ控えめ、 平易な日本語で** ([feedback_jargon_in_japanese](memory))
- **verify before claiming it works** ([feedback_verify_before_claiming](memory))
- **subagent-driven 進行時、 各 task の review checkpoint で 1 つずつ確認 → 一気に流さない**

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)、 ただし session 84 では preview branch (= `share-rebuild-preview` 等) でも検証
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 多用しない
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- preview deploy: `--branch=<preview-branch-name>` で本番 URL に出さず別 URL で検証可能

## 重要ドキュメント (= session 84 で読む順)

1. このファイル ([docs/CURRENT_GOAL.md](./CURRENT_GOAL.md))
2. [docs/TODO.md](./TODO.md) 「現在の状態」 セクション
3. [docs/superpowers/specs/2026-05-27-share-rebuild-design.md](./superpowers/specs/2026-05-27-share-rebuild-design.md)
4. [docs/superpowers/plans/2026-05-27-share-rebuild.md](./superpowers/plans/2026-05-27-share-rebuild.md) ← 実装開始時に Phase 3 から逐次参照
