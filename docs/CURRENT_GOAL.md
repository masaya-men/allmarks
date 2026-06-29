# 次セッションのゴール (= セッション 140)

## 今の状態（セッション139で完了・master マージ + allmarks.app 反映済み）

**⑤ SHARE のテーマ化** を **サブエージェント駆動で全6タスク実装・出荷完了**。3面（送信プレビュー・OG画像・受信ページ `/s/`）すべてに送信者のテーマ + カスタマイズが乗る。

- **方式**: 見えてる共有プレビューを `dom-to-image` でスクショ（visible-only でメモリ爆発回避、失敗時は従来 canvas へ自動 fallback）。受信ページは `<html data-theme-id>` + 単層SVG patternLayer。
- **検証**: tsc clean / vitest **1813緑** / build OK / opus 最終レビュー（whole-branch）/ **live allmarks.app で Grid 受信ページ実測 PASS**（patternLayer height 583px・SVGグリッド描画、旧=height0 を修正）。
- **default(Sound Wave) は byte-identical**（.module.css 無編集・inline only）、**¥0**（サーバー無変更）。
- 計画: [docs/superpowers/plans/2026-06-29-share-theming-screenshot.md](superpowers/plans/2026-06-29-share-theming-screenshot.md)（6タスク完了）。
- commit: master `510b7bf`（feature ブランチ `share-theming-screenshot` を no-ff マージ）。

## 次にやる（最優先）

**⑥ マステ/ピン配置** に着手（user と相談しながら設計から）。
1. まず `docs/private/IDEAS.md` と TODO.md の該当項目を読む
2. ブレスト（superpowers:brainstorming）で要件・配置ロジックを固める
3. spec → plan → 実装の順

## 残り（順次）
⑥ マステ/ピン配置 ／ ⑦ チュートリアル PiP 紹介 ／ ⑧ 枠付きカードの使い道 ／ follow-up: 明色 BOARD のヘッダー色ハードコード対応 ／ follow-up: OG画像の Google Fonts CORS（dom-to-image、現状 fallback でカバー・要観察）。

## 守ること（毎回）
- default 盤面 byte-identical。deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`。deploy は `--project-name=allmarks --branch=master`。
- 既知フレーキー: `tests/lib/channel.test.ts`（再実行で緑）。応答は日本語、UI見た目変更は承認フロー（ただし設計合意済みの実装は継続実行）。
