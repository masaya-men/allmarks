# 次セッションのゴール (= セッション 158)

## 今の状態（選択的シェア出荷済み・全部 master マージ済＋本番反映済）

**セッション157でやったこと：**

- **選択的シェア「SELECT CARDS」を出荷**（merge `1aaeb37`・tsc0 / **vitest1942** / build OK・`allmarks.app` 反映済・Playwright 本番スモーク **12/12 PASS**）。SHARE モーダルに SELECT CARDS → 盤面が選択モード（tap で選択・0枚スタート・緑✓バッジ・下部バー `n/100 SELECTED`＋SELECT ALL＋SHARE(n)＋CANCEL＋琥珀「100 MAX」）→ SHARE(n) で**選んだカードだけ**を盤面順で共有（`filter:null`）。既存の「押したらすぐ新しい順100枚」は無変更・受け取り側 /s/ も無変更。
- サブエージェント駆動6タスク＋各2段レビュー＋opus 全ブランチレビュー。レビューで実バグ2件（+TAG/タグpill行の未ゲート・再生トグルの pointer-events でタップ横取り）を摘出・修正。default 盤面 byte-identical。
- 正本 [spec](superpowers/specs/2026-07-03-selective-share-design.md) / [plan](superpowers/plans/2026-07-03-selective-share.md) / narrative [TODO_COMPLETED.md](TODO_COMPLETED.md) s157。

## 次にやる（セッション158）＝本命バックログの残り

1. **③ プレミアムテーマ制作** ← Claude 推奨。サポーター制（¥500/月）の売り物＋build-in-public の発信ネタ。1本目の世界観は要相談（前回は (a) Liquid Glass を推した＝レシピ・コード資産あり／(b) SF軍事／(c) 車。ユーザーは選択的シェアを先にやりたいと言って保留していた）。
2. **④ K3 解錠実装**（設計・10タスク計画は完成済み `docs/private/2026-07-01-k3-unlock-plan.md`）— ③の1本目が見えたら差し込むのが自然。
3. **タグ付け強化**（ユーザーが以前「最優先」と言った機能）。

## 選択的シェアの任意ブラッシュアップ（急がない・ユーザー実機判断待ち）

- 緑アウトラインの強さ（実機で見て「強すぎ/ちょうど良い」を判断。デザイン変更は要ユーザー承認）。
- 選択バッジの登場トランジション（今は spec 通り無し・ポップイン）。
- ユーザー本人の実機（545枚）で「タグから数枚＋別タグから数枚」の混在選択→共有→受け取りリンクを一度確認してもらえると盤石。

## 検討メモ（未決・急がない・s156 から継続）

- 13言語で N-05 演出が出ない件: kicker を全言語英語に統一すれば全言語発動（見た目が変わる13ファイル編集なので**要ユーザー相談**）。

## 守ること（毎回）

- default 盤面 byte-identical。web 変更時は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- **機微情報は `docs/private/` のみ。tracked に書かない・commit しない**（CLAUDE.md 厳守）
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。**vitest は dev サーバー並走禁止**
- **偽保存対策**: Write/Edit 後は独立 Read、commit/マージ後は**生 `git log --graph`** の実出力で確認（rtk git log はマージコミットを隠すことがある＝s157 で実証）
- 応答は日本語・簡潔に
