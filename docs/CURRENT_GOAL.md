# 次セッションのゴール (= セッション 85) — シェア機能 Phase 7 (= Pages Function 化 + 本番 ship)

## 今のゴール (1 行)

**session 84 でシェア機能 Phase 3-6 (= 送信側 modal + 受信側 landing + triage + 旧実装完全削除) を 20 commits で master に ship 済。 Phase 7 は `output: 'export'` + edge runtime + 動的セグメントの架構衝突で blocker、 次セッションで Cloudflare Pages Function `functions/s/[id].ts` 化に切替えて本番 ship する。**

## 開始時の動き (= Claude の最初の発言)

1. **このファイル** ([docs/CURRENT_GOAL.md](./CURRENT_GOAL.md))、 **[docs/TODO.md](./TODO.md) 「現在の状態」**、 **[docs/superpowers/specs/2026-05-28-share-pages-function-design.md](./superpowers/specs/2026-05-28-share-pages-function-design.md)** (= Pages Function 設計 spec) を順に読む
2. **本番 (booklage.pages.dev) 確認**: 旧コードのまま、 user 影響ゼロを再確認
3. **🔴 allmarks.app ドメイン取得確認** — 取得済なら `docs/private/2026-05-11-allmarks-branding-spec.md` 計画開始は phase 1.5 で良い (= phase 1 シェア出してから)、 未取得なら取得促し
4. Pages Function 化の実装に着手

## session 84 到達点 (= Phase 3-6 ship、 21 commits)

### 完了 (= 全 21 commits、 master 反映済、 本番未反映)

20 commits の feat/chore + 1 commit の build fix。 詳細は [TODO_COMPLETED.md](./TODO_COMPLETED.md) セッション 84 セクション。 概略:

- **Phase 3** (Tasks 12-15): `lib/share/import.ts` + `SenderShareModal` + snapshot/API 配線 + BoardRoot SHARE button 切替
- **Phase 4** (Tasks 16-22): `/s/[id]` route + `ReceiverLanding` (= fetch / masonry / bulk import / inline Lightbox / 背景タイポ) + `BulkImportToast`
- **Phase 5** (Tasks 23-26): `/s/[id]/triage` route + `ReceiverTriage` (= queue + YES/NO + sender tag suggestions + receiver 既存 tags + completion toast)
- **Phase 6** (Tasks 27-30): 旧 ShareComposer 系 + 旧 /share route + 旧 lib/share v1 modules + BoardRoot 残骸 全削除 (= 30 ファイル / 2500 行)
- **build fix**: `lib/share/snapshot.ts` を dynamic import 化

### 検証

- tsc 0 errors、 vitest 843 PASS、 既存テスト regression なし
- 本番 (booklage.pages.dev) 未反映、 user の普段使いに影響なし

## Phase 7 architectural blocker (= 持ち越し理由)

`pnpm build` が `Cannot find module 'app-edge-has-no-entrypoint'` で死亡。 原因:

- `/s/[id]` route が `runtime = 'edge'` + 動的セグメント + `dynamic = 'force-dynamic'`
- プロジェクトは `next.config.ts` で `output: 'export'` (= 完全静的書き出し)
- 静的書き出しは 「事前に全 HTML を生成」 方式 → 動的セグメントは `generateStaticParams()` で事前列挙必要 → シェア ID は実行時生成 → 不可能

**根本原因**: session 83 設計時に「per-id 動的 OG metadata が欲しい」 から edge runtime を選んだが、 プロジェクトの基本姿勢 (= 静的書き出し + Cloudflare Pages) を見落とした。

## 解決方針 (= user 「B」 確定、 次セッション実施)

**Cloudflare Pages Function で `/s/[id]` HTML を直接返す**

1. `app/(app)/s/[id]/page.tsx` + `app/(app)/s/[id]/triage/page.tsx` を削除 (= Next.js route から外す)
2. `functions/s/[id].ts` 新規実装:
   - リクエスト時に KV から payload + thumb を fetch
   - HTML を組み立てて返す (= per-id OG metadata を `<meta property="og:image">` 等に inline + React app shell + JS bundle 参照)
3. 同様に `functions/s/[id]/triage.ts` も実装
4. ReceiverLanding / ReceiverTriage を `window.location.pathname` から ID 抽出して boot するように修正 (= 現在は Next.js page から `params` prop 受け取り)
5. 既存 `/api/share/[id]/og.webp` Pages Function はそのまま、 HTML 内の OG meta で参照
6. preview deploy で動作確認
7. 本番 ship

詳細設計: [docs/superpowers/specs/2026-05-28-share-pages-function-design.md](./superpowers/specs/2026-05-28-share-pages-function-design.md)

## 進め方 (= 推奨)

subagent-driven は task 数少ない (= 5-7 task) ので、 私 (controller) が直接実装でも OK。 ただし HTML テンプレート組み立ては慎重に (= per-id OG が肝)。 spec で「Pages Function HTML テンプレート」 を確定させてから実装に入る。

## 公開向け残タスク (= session 83 終了時から変わらず)

Phase 7 完了後の release blocker:

1. ~~🔴 シェア機能完全作り直し~~ ← session 84 で Phase 3-6 完了、 session 85 で Phase 7 ship
2. 🔴 allmarks.app ドメイン取得確認 (= 2026-05-28 朝以降)
3. Phase D4 他 14 言語 mood → tag rename (= `messages/{en,ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json` の `newMood` / `moodNamePlaceholder`)
4. Phase D5 NewMoodInput → NewTagInput 内部 rename
5. onboarding チュートリアル (= 初回ユーザー向け)
6. 拡張機能 Chrome Web Store 公開準備

公開後でも OK (= 上澄み polish):
- convex bezel 数値調整 / /triage 外周 4 段 bloom halo 0.5x 絞り / TagDeleteConfirmDialog 2 秒長押し feel / 「TAG THIS.」 サイズ + 緑パルス強度

## 守ること (= user memory + session 84 学習 参照)

- **`AskUserQuestion` ボックスで聞かない**: design だけでなく engineering tradeoff も含めて、 user が「一方通行過ぎる」 と即否定。 平文で 1 個ずつ対話 ([feedback_no_question_box_for_design](memory) を engineering tradeoff にも拡張)
- **複雑な状況説明は「1 個ずつ理解しながらすすめたい」 のペース**: 「ここまで OK?」 で区切る ([feedback_one_thing_at_a_time](memory))
- **大きい構造変更前は方針確認** ([feedback_consult_before_big_changes](memory))
- **対話で進める、 一括で複数項目を勝手に変えない** ([feedback_one_thing_at_a_time](memory))
- **平易な日本語、 横文字カタカナ控えめ** ([feedback_jargon_in_japanese](memory))
- **verify before claiming it works** ([feedback_verify_before_claiming](memory))
- **plan の前提と実コードの差異は subagent が adapt するパターン**: implementer 側で grep + adapt が圧倒的に効率良い、 controller が事前に全 file 読んで plan 修正する作業は不要

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード (= Ctrl+Shift+R)、 ただし session 85 では preview branch (= 例 `share-pages-function-preview`) でも検証
- 応答は日本語、 横文字カタカナ控えめ、 AskUserQuestion 使わない
- deploy 前に tsc + vitest (= 既知 flake `tests/lib/channel.test.ts` 単体 PASS 確認で OK)
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`
- preview deploy: `--branch=<preview-branch-name>` で本番 URL に出さず別 URL で検証可能

## 重要ドキュメント (= session 85 で読む順)

1. このファイル ([docs/CURRENT_GOAL.md](./CURRENT_GOAL.md))
2. [docs/TODO.md](./TODO.md) 「現在の状態」 セクション
3. [docs/superpowers/specs/2026-05-28-share-pages-function-design.md](./superpowers/specs/2026-05-28-share-pages-function-design.md) ← Pages Function 化の設計詳細
4. (= 必要に応じて) [docs/superpowers/specs/2026-05-27-share-rebuild-design.md](./superpowers/specs/2026-05-27-share-rebuild-design.md) ← 元の rebuild design (= Phase 7 以外は ship 済の参考)
