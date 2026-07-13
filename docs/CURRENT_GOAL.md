# 次セッションのゴール — PC リリース滑走路の続き（N-53 完了。次の1件を選んで実行）

## ★このセッション（s195）でやったこと
1. **PC リリースにピボット**。スマホのアレンジ作り直し（s194）はユーザー判断で**後回し**（「あまりにもダメ」）。実機フィードバック3点は `docs/private/IDEAS.md` に「次に作り直す時の厳守要件」で保存（①常時チロムは1行 ②ズームはスライダー ③パンモード切替ボタン）。
2. **N-53（フル e2e が30本落ち＝回帰検出網が半死）を完遂**・master マージ済（`d453ba21`・**デプロイ不要**＝test infra＋死コード prune）。30本 → **0本**（72 pass / 0 fail / 5 skip・2回連続で安定）。検証は一切弱めず、古いテストは現挙動へ再ターゲット or 撤去済みは削除。opus 全ブランチ Ready=YES。

## ★次セッション最優先＝リリース滑走路の残りから1件を選んで実行

**束A/B（スマホ閲覧・保存）は完了済。** 残りの PC リリース項目（すべて計画書あり・subagent-driven で自走可）:

| 候補 | 中身 | 計画書 |
|---|---|---|
| **N-54** | グリッド交点が濃くなる不具合を根治（盤面 CSS グラデ → SVG に統一・共有画像とも一致） | `docs/superpowers/plans/2026-07-11-n54-pattern-svg-unification.md` |
| **TOWER** | 公開前の無料看板テーマ（超高層の全窓＝カード・WebGL 1枚）。**ユーザー確定「公開までに作る」** | `docs/superpowers/plans/2026-07-12-shader-theme-b-tower.md` |
| **束C** | 13言語の翻訳仕上げ＋規約の「正文条項」（最大の関門・4〜5セッション・Sonnet以上） | `docs/private/2026-07-08-release-runway-plan.md` §束C |
| （後）束D/E | 公開素材（見せ用ボード・支援ページ・告知）→ 総仕上げ・公開 | 同上 §束D/E |

**推奨**: まず可視な前進（**N-54** か **TOWER**）→ その後 **束C** の長丁場。ただし着手順はユーザーが決める。**セッション冒頭で「どれから？」を1問だけ聞く**。

## ★N-53 のフォロー（非ブロッキング・気が向いたら）
- drag-pan（Space/中クリック）の e2e を1本追加（board-b0:81 の skip を置換）。
- `DisplayModeSwitch.tsx`＋孤立 `handleDisplayModeChange`（BoardRoot.tsx:2002）＝**既存の死んだ製品コード**の掃除。
- `waitForStableBox` を `tests/e2e/helpers/` に集約。

## 恒久ルール（継承）
- e2e 修理・テストは **検証を弱めない**（待ち/seed だけ直す・撤去済み機能のみ削除・skip は文書化）。
- seed は版数非固定の共有ヘルパー `tests/e2e/helpers/seed-db.ts`（新規）に寄せる。カードクリック系は `linkStatus:'alive'`+`lastCheckedAt` を seed。
- `rtk` 前置・`--no-verify` 禁止／vitest・playwright は素の `npx`（`rtk npx` は壊れる）／機微・競合名は `docs/private/`。
- 盤面の見た目を変えたら受け取り画面（`/s/<id>`）も必ず確認。デスクトップ描画は 1px 不変（新 UI は 640px ゲート内）。
- 新しい操作系・見た目・大改修は着手前に superpowers:brainstorming。
