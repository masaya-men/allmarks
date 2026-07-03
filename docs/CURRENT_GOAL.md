# 次セッションのゴール (= セッション 158)

## 今の状態（選択的シェア出荷済み／オンボ改善は spec+plan 完成・実装は次回）

**セッション157でやったこと：**

1. **選択的シェア「SELECT CARDS」出荷**（merge `1aaeb37`・本番反映・Playwright 本番スモーク **12/12 PASS**）。飛び飛び選択→共有→受け取りページが**上から詰め直される**ことも実リンクで実証済み。
2. **ロードマップを1枚に整理**（Artifact）＋ユーザー実機フィードバック反映：**N-15 解決**／**拡張はストア審査通過**（残＝`EXTENSION_STORE_URL` 投入）／新規 **N-20**（拡張クイックタグが上だけ2列）**N-21/N-22**（オンボ）を backlog 追加。
3. **オンボ改善 N-21+N-22 の spec と実装計画を完成**（brainstorm→spec→plan）。**実装は未着手**＝次セッションの本題。

## 次にやる（セッション158）＝オンボ改善の実装

**計画をサブエージェント駆動で実行する**（前回の選択的シェアと同じ進め方）:

- 実行スキル：`superpowers:subagent-driven-development`
- 計画：[docs/superpowers/plans/2026-07-04-onboarding-settings-popout.md](superpowers/plans/2026-07-04-onboarding-settings-popout.md)（6タスク・TDD・完全コード入り）
- spec：[docs/superpowers/specs/2026-07-04-onboarding-settings-popout-design.md](superpowers/specs/2026-07-04-onboarding-settings-popout-design.md)
- 中身：**N-21**＝SETTINGS beat のキャプションを下中央に（`captionAtBottom` 1行）／**N-22**＝`install` の後に `popout` cinema シーン追加＋新 `PopOutReenactment`（**右からカードがグライドイン→中央着地** `power4.out`/0.7s＋常時メーター＝実 PiP 挙動どおり／実 PiP は import しない）＋15言語コピー
- master から `feat/onboarding-polish` 等でブランチを切って開始。BASE＝このセッション終了時の master HEAD（下記引継メッセージ参照）。
- 完了後：master マージ→デプロイ→**本番実機でオンボを頭から通し**、①SETTINGS 説明が読める②install の次に POP OUT が出て右からカードが入る、を目視確認。

## その後の本命バックログ（順不同・相談して決める）

- **N-20（拡張クイックタグ上だけ2列）** — 直すと拡張の新バージョン再提出。`EXTENSION_STORE_URL` 投入と**同じ回にまとめる**のが得。
- **③ プレミアムテーマ制作**（Claude 推奨・売り物＋告知の引き金・1本目候補 Liquid Glass）。
- **④ K3 解錠実装**（計画完成済 `docs/private/2026-07-01-k3-unlock-plan.md`）。
- タグ付け強化。

## 守ること（毎回）

- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー `tests/lib/channel.test.ts`（再実行で緑）。**vitest は dev サーバー並走禁止**
- **偽保存対策**：Write/Edit 後は独立 Read、commit/マージ後は**生 `git log --graph`** の実出力で確認（rtk git log はマージコミットを隠す＝s157 で実証）
- アニメは GSAP（Framer Motion 禁止）。応答は日本語・簡潔に
