# 次セッションのゴール — テーマ実行の続き（サブ2 or サブ3 の皮作り込み）＋残タスク

## ★s197 の到達点（2つ本番出荷済・司令塔Opus＋安価モデル subagent-driven）
- **サブ6 出荷**（拡張 options フラット中立化＋15言語 i18n・parity テスト付き）。`extension/` のみ＝**盤面不変ゆえ allmarks デプロイ不要**（拡張は Web Store 別配布）。master merge/push 済。
- **サブ1 出荷**（chrome スキントークン基盤・merge/push/`allmarks.app` デプロイ済）。既定テーマはバイト同一・全テーマ×全 chrome パネル抜けゼロ検査を固定。**視覚は不変＝基盤のみ**。
  - **保留＝旧 Task 4（light-BOARD の chrome 反転）**: 明色盤面テーマ（フラット/紙）が出るまで意味を持たず、視覚変更ゆえサブ2/3 とモック承認つきで一緒に。
  - fix-1 で紙テーマの退行（死蔵 `--chrome-btn-color` 上書きが sub1 で発火→ドロップダウン暗×暗）を修正済＝紙は sub1 以前に厳密復元。

## ★次セッションの最優先（甲＝作り込んでから公開・各回頭でモック承認→写経）
テーマ実行の続き。以下から1つを深く（親 spec §7）:
1. **サブ2 フラットパターンテーマ＋その TUNE 皮**（`kind:'pattern'`・一般ユーザーの標準・静かなメーター/モーション・清潔な TUNE 皮）。
2. **サブ3 Grid・紙の TUNE 皮**（Grid＝方眼世界／紙＝道具箱の皮）。
- **手順（掟）**: 「紙っぽく」だけでは安価モデルが写経できない＝美的判断が中身。**小さなモック→ユーザー承認→写経 plan→subagent-driven**。着手前に superpowers:brainstorming。
- **サブ1 が用意したトークン**（皮が読む・`globals.css :root`）: `--chrome-panel-surface/-border/-radius/-blur/-shadow`・`--chrome-btn-color`・`--chrome-btn-hover`・`--chrome-font`・`--chrome-hover-fx`。**皮の掟**: 文字色を暗インクにするなら面もクリーム/明色に（片方だけ＝不可視の罠・s197 fix-1）。紙は既存 `--paper-panel-*` クリーム面を再配線（489caf7e が面消費を剥がした）。

## ★独立・いつでも（波0 残）
- **C2 バッチ1（zh/ko）盤面翻訳仕上げレビュー**（Sonnet+・s196 で一次訳済の 13言語の本レビュー・正文条項 en/ja は確定）。以降 es/fr/pt/it→de/nl/tr/ru→ar/th/vi。
- N-62 課金防御バッチ1（監査 §4・任意）／N-60 オンボ文言／N-61 影焼き込み（素材待ち）。

## 恒久ルール（継承）
- 翻訳は Sonnet+（Haiku 不可）。placeholder 保持・機能名は訳さない（parity テストが守る）。
- **視覚変更は ui-design.md「承認後」**（(1)現状→(2)変更案→(3)承認→(4)実装）。`rtk` 前置・`--no-verify` 禁止・vitest/playwright は素の npx・Framer Motion 禁止・デスクトップ既定はバイト同一原則・盤面を変えたら受け取り画面も確認。
- 機微（支援・値付け・戦略）は tracked に書かない＝`docs/private/`。支援ページ早期化（束D2）はユーザー要望として保留中。
- 課金: 監査済（Free なら悪用されても請求ほぼ0・Budget alert $0.01 設定済）。
- **テーマ実装の教訓**: `var(--x, fb)` の fb は `--x` が :root 定義済みなら死にコード＝トークン化のバイト維持は「元値=:root 値」で判定。トークンを live 化すると死蔵テーマ上書きが復活しうる（memory `reference_token_fallback_dead_when_root_defined`）。
