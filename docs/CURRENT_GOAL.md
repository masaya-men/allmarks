# 次セッションのゴール (= セッション 149 進行中 → 次は本命バックログ)

## 今の状態（grab-reaction を master に squash マージ完了・allmarks.app 反映済）

**縁エフェクト（3回却下）を撤去し「掴んだ瞬間に盤面UIが一斉反応する grab-reaction」に転換 → 実機OK・opusレビュー Ready → セッション149で `feat/edge-data-dissolve`（正味差分＝grab-reaction のみ）を master に squash マージ済（却下した縁エフェクト20コミットは畳んで履歴をクリーンに）。ブランチは削除済。** 本番 `allmarks.app` は既にこの状態を反映済（別デプロイ不要）。

- **ふるまい**：掴んでいる間ずっと、メニュー文字（TITLE/TUNE/SETTINGS 等）スクランブル＋RGBグリッチ／**TUNE**／**メーターの数字**が反応。離すと収まる。default 限定。背景ワードマークの grab グリッチは撤去済。
- **正本**: [spec](superpowers/specs/2026-07-02-board-grab-reaction-design.md) / [plan](superpowers/plans/2026-07-02-board-grab-reaction.md)。詳細 narrative は TODO_COMPLETED.md セッション148続き2。

## 次にやる（本命バックログ — 優先順は相談）

1. **③プレミアムテーマ制作**（有料テーマの中身。`docs/private/IDEAS.md`）
2. **④K3 解錠実装**（`docs/private/2026-07-01-k3-unlock-plan.md` の工程表）
3. **選択的シェア**（どの100枚を送るか選ぶ。`docs/private/IDEAS.md`）
4. **タグ付け強化**（最優先機能・memory `project_tagging_top_priority`）

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `--project-name=allmarks --branch=master`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- board のドラッグ/カードクリックは playwright 不可（setPointerCapture）→ 見た目は実機確認
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語・簡潔に
